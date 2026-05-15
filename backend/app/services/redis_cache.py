import json
from typing import Any

import redis.asyncio as redis

from app.core.config import get_settings

CACHE_TTL_SECONDS = 3600


def cache_key(tenant_id: str, ioc_type: str, normalized: str) -> str:
    return f"ioc:{tenant_id}:{ioc_type}:{normalized}"


async def get_cached(
    redis_client: redis.Redis, tenant_id: str, ioc_type: str, normalized: str
) -> dict[str, Any] | None:
    raw = await redis_client.get(cache_key(tenant_id, ioc_type, normalized))
    if not raw:
        return None
    return json.loads(raw)


async def set_cached(
    redis_client: redis.Redis, tenant_id: str, ioc_type: str, normalized: str, payload: dict[str, Any]
) -> None:
    await redis_client.setex(
        cache_key(tenant_id, ioc_type, normalized), CACHE_TTL_SECONDS, json.dumps(payload)
    )
