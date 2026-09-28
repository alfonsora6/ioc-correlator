"""Redis-backed auth rate limiting.

In this Docker deployment, uvicorn typically sees request.client.host as the
compose bridge gateway (e.g. 172.18.0.1), so many browsers share one IP.
Login limits therefore key on IP + normalized email; an IP-only ceiling is a
secondary safety net. AUTH_RATE_LIMIT_TRUST_PROXY defaults to false so forged
X-Forwarded-For / X-Real-IP headers cannot bypass limits.

If Redis errors, we fail open (allow the request) and log a warning: taking
down all logins when Redis is unavailable would lock out every client behind
the shared gateway. Rate limiting must never return 500.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import HTTPException, Request

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Atomic INCR + EXPIRE. Keys without TTL (TTL == -1) are treated as expired and reset.
_INCR_EXPIRE_LUA = """
local key = KEYS[1]
local window = tonumber(ARGV[1])
local ttl = redis.call('TTL', key)
if ttl == -1 then
  redis.call('DEL', key)
end
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window)
  ttl = window
else
  ttl = redis.call('TTL', key)
  if ttl < 0 then
    redis.call('SET', key, 1, 'EX', window)
    current = 1
    ttl = window
  end
end
return {current, ttl}
"""

RATE_LIMIT_DETAIL = "Too many attempts. Try again later."


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    count: int
    retry_after: int


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_client_ip(request: Request, *, trust_proxy: bool | None = None) -> str:
    settings = get_settings()
    if trust_proxy is None:
        trust_proxy = settings.auth_rate_limit_trust_proxy
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
        real_ip = request.headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def login_email_key(ip: str, email: str) -> str:
    return f"rl:auth:login:{ip}:{normalize_email(email)}"


def login_ip_key(ip: str) -> str:
    return f"rl:auth:login:ip:{ip}"


def register_ip_key(ip: str) -> str:
    return f"rl:auth:register:{ip}"


def rate_limit_http_exception(retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail=RATE_LIMIT_DETAIL,
        headers={"Retry-After": str(max(1, retry_after))},
    )


async def _incr_with_expire(redis, key: str, window_seconds: int) -> tuple[int, int]:
    """Return (count, ttl). Keys stuck without TTL are reset (treated as expired)."""
    result = await redis.eval(_INCR_EXPIRE_LUA, 1, key, str(window_seconds))
    count = int(result[0])
    ttl = int(result[1])
    if ttl < 1:
        ttl = window_seconds
    return count, ttl


async def _get_count_ttl(redis, key: str) -> tuple[int, int]:
    """Read count/TTL without incrementing. Missing or no-TTL keys count as 0."""
    ttl = await redis.ttl(key)
    if ttl == -2:
        return 0, 0
    if ttl == -1:
        await redis.delete(key)
        return 0, 0
    raw = await redis.get(key)
    if raw is None:
        return 0, 0
    return int(raw), max(1, int(ttl))


async def hit(
    redis,
    key: str,
    *,
    limit: int,
    window_seconds: int,
) -> RateLimitResult:
    """Increment key and report whether the new count is within limit."""
    try:
        count, ttl = await _incr_with_expire(redis, key, window_seconds)
    except Exception:
        logger.warning("Auth rate limit: Redis error on hit(%s); failing open", key, exc_info=True)
        return RateLimitResult(allowed=True, count=0, retry_after=0)
    return RateLimitResult(allowed=count <= limit, count=count, retry_after=ttl)


async def peek(
    redis,
    key: str,
    *,
    limit: int,
) -> RateLimitResult:
    """Check current count without incrementing."""
    try:
        count, ttl = await _get_count_ttl(redis, key)
    except Exception:
        logger.warning("Auth rate limit: Redis error on peek(%s); failing open", key, exc_info=True)
        return RateLimitResult(allowed=True, count=0, retry_after=0)
    return RateLimitResult(allowed=count < limit, count=count, retry_after=ttl)


async def reset_key(redis, key: str) -> None:
    try:
        await redis.delete(key)
    except Exception:
        logger.warning("Auth rate limit: Redis error on reset(%s); ignoring", key, exc_info=True)


def _redis_from_request(request: Request):
    return getattr(request.app.state, "redis", None)


async def enforce_login_precheck(request: Request, email: str, settings: Settings | None = None) -> None:
    """Reject with 429 if IP+email or IP ceiling already exceeded (failed attempts only)."""
    settings = settings or get_settings()
    redis = _redis_from_request(request)
    if redis is None:
        logger.warning("Auth rate limit: Redis unavailable; failing open on login precheck")
        return

    ip = get_client_ip(request)
    email_key = login_email_key(ip, email)
    ip_key = login_ip_key(ip)

    email_rl = await peek(redis, email_key, limit=settings.auth_rate_limit_login)
    if not email_rl.allowed:
        raise rate_limit_http_exception(email_rl.retry_after)

    ip_rl = await peek(redis, ip_key, limit=settings.auth_rate_limit_login_ip)
    if not ip_rl.allowed:
        raise rate_limit_http_exception(ip_rl.retry_after)


async def record_login_failure(request: Request, email: str, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    redis = _redis_from_request(request)
    if redis is None:
        logger.warning("Auth rate limit: Redis unavailable; skipping login failure record")
        return

    ip = get_client_ip(request)
    email_hit = await hit(
        redis,
        login_email_key(ip, email),
        limit=settings.auth_rate_limit_login,
        window_seconds=settings.auth_rate_limit_login_window_seconds,
    )
    ip_hit = await hit(
        redis,
        login_ip_key(ip),
        limit=settings.auth_rate_limit_login_ip,
        window_seconds=settings.auth_rate_limit_login_ip_window_seconds,
    )
    # If this failure pushed over the limit, still return 401 from auth; the next
    # request will get 429. Do not convert this response to 429 mid-failure.
    _ = (email_hit, ip_hit)


async def clear_login_failures(request: Request, email: str) -> None:
    """Successful login resets the IP+email failure counter (not the IP ceiling)."""
    redis = _redis_from_request(request)
    if redis is None:
        return
    ip = get_client_ip(request)
    await reset_key(redis, login_email_key(ip, email))


async def enforce_register(request: Request, settings: Settings | None = None) -> None:
    """Every register attempt counts toward the per-IP limit."""
    settings = settings or get_settings()
    redis = _redis_from_request(request)
    if redis is None:
        logger.warning("Auth rate limit: Redis unavailable; failing open on register")
        return

    ip = get_client_ip(request)
    result = await hit(
        redis,
        register_ip_key(ip),
        limit=settings.auth_rate_limit_register,
        window_seconds=settings.auth_rate_limit_register_window_seconds,
    )
    if not result.allowed:
        raise rate_limit_http_exception(result.retry_after)
