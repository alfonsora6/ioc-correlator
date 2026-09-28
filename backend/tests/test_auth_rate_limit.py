"""Auth rate limiting: Redis counters, proxy headers, and recovery."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request as StarletteRequest

from app.core.config import Settings, get_settings
from app.core.rate_limit import (
    RATE_LIMIT_DETAIL,
    clear_login_failures,
    enforce_login_precheck,
    enforce_register,
    get_client_ip,
    hit,
    login_email_key,
    normalize_email,
    peek,
    record_login_failure,
)


class FakeRedis:
    """Minimal async Redis with eval semantics matching _INCR_EXPIRE_LUA."""

    def __init__(self, *, fail: bool = False) -> None:
        self.store: dict[str, tuple[int, float | None]] = {}
        self.fail = fail
        self._now = time.monotonic()

    def advance(self, seconds: float) -> None:
        self._now += seconds
        expired = [
            k
            for k, (_, exp) in self.store.items()
            if exp is not None and exp <= self._now
        ]
        for k in expired:
            del self.store[k]

    def _check(self) -> None:
        if self.fail:
            raise ConnectionError("redis down")

    async def get(self, key: str):
        self._check()
        self.advance(0)
        item = self.store.get(key)
        if item is None:
            return None
        return str(item[0])

    async def ttl(self, key: str) -> int:
        self._check()
        self.advance(0)
        item = self.store.get(key)
        if item is None:
            return -2
        _, exp = item
        if exp is None:
            return -1
        return max(0, int(exp - self._now))

    async def delete(self, *keys: str) -> int:
        self._check()
        n = 0
        for key in keys:
            if self.store.pop(key, None) is not None:
                n += 1
        return n

    async def eval(self, script: str, numkeys: int, *keys_and_args):
        """Mirror the Lua INCR+EXPIRE script used in production."""
        self._check()
        self.advance(0)
        key = keys_and_args[0]
        window = int(keys_and_args[1])
        item = self.store.get(key)
        if item is not None and item[1] is None:
            del self.store[key]
            item = None
        if item is None:
            self.store[key] = (1, self._now + window)
            return [1, window]
        count = item[0] + 1
        exp = item[1]
        if exp is None or exp <= self._now:
            self.store[key] = (1, self._now + window)
            return [1, window]
        ttl = max(1, int(exp - self._now))
        self.store[key] = (count, exp)
        return [count, ttl]

    def plant_no_ttl(self, key: str, count: int) -> None:
        """Simulate a stuck key after INCR without EXPIRE."""
        self.store[key] = (count, None)


def _make_request(
    *,
    redis=None,
    client_host: str = "172.18.0.1",
    headers: dict[str, str] | None = None,
) -> StarletteRequest:
    app = FastAPI()
    app.state.redis = redis
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/auth/login",
        "raw_path": b"/api/v1/auth/login",
        "query_string": b"",
        "headers": [
            (k.lower().encode(), v.encode()) for k, v in (headers or {}).items()
        ],
        "client": (client_host, 12345),
        "server": ("test", 80),
        "state": {},
        "app": app,
    }
    return StarletteRequest(scope)


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def settings(monkeypatch) -> Settings:
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN", "5")
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN_WINDOW_SECONDS", "60")
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN_IP", "200")
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS", "60")
    monkeypatch.setenv("AUTH_RATE_LIMIT_REGISTER", "10")
    monkeypatch.setenv("AUTH_RATE_LIMIT_REGISTER_WINDOW_SECONDS", "60")
    monkeypatch.setenv("AUTH_RATE_LIMIT_TRUST_PROXY", "false")
    get_settings.cache_clear()
    return Settings(_env_file=None)


@pytest.mark.asyncio
async def test_hit_returns_429_semantics_on_n_plus_one(settings):
    redis = FakeRedis()
    key = login_email_key("172.18.0.1", "User@Example.com")
    assert normalize_email("User@Example.com") == "user@example.com"

    for i in range(5):
        result = await hit(redis, key, limit=5, window_seconds=60)
        assert result.allowed is True
        assert result.count == i + 1

    blocked = await hit(redis, key, limit=5, window_seconds=60)
    assert blocked.allowed is False
    assert blocked.count == 6
    assert blocked.retry_after >= 1


@pytest.mark.asyncio
async def test_other_email_key_not_affected(settings):
    redis = FakeRedis()
    ip = "172.18.0.1"
    key_a = login_email_key(ip, "a@example.com")
    key_b = login_email_key(ip, "b@example.com")

    for _ in range(5):
        await hit(redis, key_a, limit=5, window_seconds=60)
    assert (await hit(redis, key_a, limit=5, window_seconds=60)).allowed is False

    other = await hit(redis, key_b, limit=5, window_seconds=60)
    assert other.allowed is True
    assert other.count == 1


@pytest.mark.asyncio
async def test_successful_login_does_not_consume_quota(settings):
    redis = FakeRedis()
    req = _make_request(redis=redis)
    email = "ok@example.com"

    for _ in range(3):
        await record_login_failure(req, email, settings)

    peek_before = await peek(redis, login_email_key("172.18.0.1", email), limit=5)
    assert peek_before.count == 3

    await clear_login_failures(req, email)
    peek_after = await peek(redis, login_email_key("172.18.0.1", email), limit=5)
    assert peek_after.count == 0
    assert peek_after.allowed is True

    # Successful path must not increment; another clear is a no-op
    await clear_login_failures(req, email)
    assert (await peek(redis, login_email_key("172.18.0.1", email), limit=5)).count == 0


@pytest.mark.asyncio
async def test_recovery_after_window(settings):
    redis = FakeRedis()
    key = login_email_key("172.18.0.1", "recover@example.com")
    for _ in range(5):
        await hit(redis, key, limit=5, window_seconds=60)
    assert (await hit(redis, key, limit=5, window_seconds=60)).allowed is False

    redis.advance(61)
    recovered = await hit(redis, key, limit=5, window_seconds=60)
    assert recovered.allowed is True
    assert recovered.count == 1


@pytest.mark.asyncio
async def test_key_without_ttl_is_treated_as_expired(settings):
    redis = FakeRedis()
    key = login_email_key("172.18.0.1", "stuck@example.com")
    redis.plant_no_ttl(key, 99)
    result = await hit(redis, key, limit=5, window_seconds=60)
    assert result.allowed is True
    assert result.count == 1


@pytest.mark.asyncio
async def test_forged_forwarded_headers_ignored_when_trust_proxy_false(settings, monkeypatch):
    monkeypatch.setenv("AUTH_RATE_LIMIT_TRUST_PROXY", "false")
    get_settings.cache_clear()
    settings = Settings(_env_file=None)
    assert settings.auth_rate_limit_trust_proxy is False

    redis = FakeRedis()
    email = "victim@example.com"
    # Exhaust the real client IP (Docker gateway)
    real_req = _make_request(
        redis=redis,
        client_host="172.18.0.1",
        headers={
            "X-Forwarded-For": "203.0.113.50",
            "X-Real-IP": "203.0.113.50",
        },
    )
    assert get_client_ip(real_req) == "172.18.0.1"

    for _ in range(5):
        await record_login_failure(real_req, email, settings)

    # Attacker tries to bypass with a fresh forged IP — still keyed on 172.18.0.1
    forged = _make_request(
        redis=redis,
        client_host="172.18.0.1",
        headers={"X-Forwarded-For": "198.51.100.1"},
    )
    assert get_client_ip(forged) == "172.18.0.1"
    with pytest.raises(HTTPException) as exc:
        await enforce_login_precheck(forged, email, settings)
    assert exc.value.status_code == 429
    assert exc.value.detail == RATE_LIMIT_DETAIL
    assert "Retry-After" in exc.value.headers


@pytest.mark.asyncio
async def test_trust_proxy_true_uses_x_forwarded_for(monkeypatch):
    monkeypatch.setenv("AUTH_RATE_LIMIT_TRUST_PROXY", "true")
    get_settings.cache_clear()
    req = _make_request(
        redis=FakeRedis(),
        client_host="172.18.0.1",
        headers={"X-Forwarded-For": "203.0.113.9, 10.0.0.1"},
    )
    assert get_client_ip(req) == "203.0.113.9"


@pytest.mark.asyncio
async def test_redis_failure_fails_open(settings):
    redis = FakeRedis(fail=True)
    req = _make_request(redis=redis)
    # Must not raise 500 / 429
    await enforce_login_precheck(req, "x@example.com", settings)
    await record_login_failure(req, "x@example.com", settings)
    await clear_login_failures(req, "x@example.com")
    await enforce_register(req, settings)


@pytest.mark.asyncio
async def test_enforce_login_precheck_raises_429_with_retry_after(settings):
    redis = FakeRedis()
    req = _make_request(redis=redis)
    email = "limit@example.com"
    for _ in range(5):
        await record_login_failure(req, email, settings)

    with pytest.raises(HTTPException) as exc:
        await enforce_login_precheck(req, email, settings)
    assert exc.value.status_code == 429
    assert exc.value.detail == RATE_LIMIT_DETAIL
    assert int(exc.value.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_register_limit_independent(settings):
    redis = FakeRedis()
    req = _make_request(redis=redis)
    for _ in range(10):
        await enforce_register(req, settings)
    with pytest.raises(HTTPException) as exc:
        await enforce_register(req, settings)
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_shared_ip_ceiling_under_cap_allows_other_email_over_cap_blocks(
    monkeypatch,
):
    """Distinct-email failures share the IP counter; below the cap another email
    still passes precheck, past the cap everyone on that IP gets 429.
    Cap is lowered via AUTH_RATE_LIMIT_LOGIN_IP so the test stays small.
    """
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN", "5")
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN_WINDOW_SECONDS", "60")
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN_IP", "8")
    monkeypatch.setenv("AUTH_RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS", "60")
    monkeypatch.setenv("AUTH_RATE_LIMIT_TRUST_PROXY", "false")
    get_settings.cache_clear()
    settings = Settings(_env_file=None)
    assert settings.auth_rate_limit_login_ip == 8

    redis = FakeRedis()
    req = _make_request(redis=redis)

    for i in range(7):
        await record_login_failure(req, f"spray{i}@example.com", settings)

    # Under IP cap: a never-tried email must not be blocked by the safety net
    await enforce_login_precheck(req, "legitimate@example.com", settings)

    await record_login_failure(req, "spray7@example.com", settings)

    with pytest.raises(HTTPException) as exc:
        await enforce_login_precheck(req, "another@example.com", settings)
    assert exc.value.status_code == 429
    assert exc.value.detail == RATE_LIMIT_DETAIL
    assert "Retry-After" in exc.value.headers


def test_default_login_ip_ceiling_is_200():
    get_settings.cache_clear()
    assert Settings(_env_file=None).auth_rate_limit_login_ip == 200


@pytest.mark.asyncio
async def test_login_endpoint_returns_429_after_failures(settings, monkeypatch):
    """Wire-level: failed logins then 429; success path clears counter."""
    from app.api import auth as auth_module
    from app.db.session import get_db

    redis = FakeRedis()
    app = FastAPI()
    app.include_router(auth_module.router, prefix="/api/v1")
    app.state.redis = redis

    async def _db():
        session = MagicMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(return_value=result)
        yield session

    app.dependency_overrides[get_db] = _db

    with (
        patch("app.api.auth.get_settings", return_value=settings),
        patch("app.core.rate_limit.get_settings", return_value=settings),
        TestClient(app) as client,
    ):
        for _ in range(5):
            r = client.post(
                "/api/v1/auth/login",
                json={"email": "brute@example.com", "password": "wrong-password"},
            )
            assert r.status_code == 401

        blocked = client.post(
            "/api/v1/auth/login",
            json={"email": "brute@example.com", "password": "wrong-password"},
        )
        assert blocked.status_code == 429
        assert blocked.json()["detail"] == RATE_LIMIT_DETAIL
        assert "retry-after" in {k.lower() for k in blocked.headers.keys()}

        # Other email still allowed
        other = client.post(
            "/api/v1/auth/login",
            json={"email": "other@example.com", "password": "wrong-password"},
        )
        assert other.status_code == 401
