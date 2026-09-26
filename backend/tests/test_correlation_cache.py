"""Regression: missing API keys must not poison the IOC Redis cache."""
import fnmatch
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.correlation import run_correlation
from app.services.redis_cache import invalidate_tenant_cache


class _FakeRedis:
    """Minimal async Redis stand-in for cache get/set/scan/delete."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def setex(self, key: str, _ttl: int, value: str) -> None:
        self.store[key] = value

    async def delete(self, *keys: str) -> int:
        n = 0
        for key in keys:
            if self.store.pop(key, None) is not None:
                n += 1
        return n

    async def scan_iter(self, match: str = "*", count: int = 100):
        for key in list(self.store):
            if fnmatch.fnmatch(key, match):
                yield key


@pytest.mark.asyncio
async def test_no_api_keys_result_is_not_cached_then_real_sources_are_queried():
    """Analyze without keys, then with keys: second run must hit intel, not stale cache."""
    tenant_id = uuid4()
    ioc = "8.8.8.8"
    db = MagicMock()
    redis_client = MagicMock()

    vt_result = {
        "provider": "virustotal",
        "available": True,
        "score": 10,
        "error": None,
    }

    with (
        patch("app.services.correlation.get_cached", new_callable=AsyncMock) as get_cached,
        patch("app.services.correlation.set_cached", new_callable=AsyncMock) as set_cached_mock,
        patch("app.services.correlation.load_tenant_keys", new_callable=AsyncMock) as load_keys,
        patch("app.services.correlation.intel_clients") as intel,
    ):
        get_cached.return_value = None
        load_keys.return_value = {}

        first = await run_correlation(db, redis_client, tenant_id, ioc)

        assert first["ioc_type"] == "ip"
        assert first["ioc_value"] == "8.8.8.8"
        assert {s["error"] for s in first["sources"]} == {"no_api_key"}
        set_cached_mock.assert_not_awaited()
        intel.query_virustotal.assert_not_called()

        load_keys.return_value = {"virustotal": "vt-secret"}
        intel.query_virustotal = AsyncMock(return_value=vt_result)

        second = await run_correlation(db, redis_client, tenant_id, ioc)

        intel.query_virustotal.assert_awaited_once_with("vt-secret", ioc)
        set_cached_mock.assert_awaited_once()
        assert second["ioc_value"] == "8.8.8.8"
        by_provider = {s["provider"]: s for s in second["sources"]}
        assert by_provider["virustotal"]["available"] is True
        assert by_provider["virustotal"]["score"] == 10
        assert by_provider["abuseipdb"]["error"] == "no_api_key"


@pytest.mark.asyncio
async def test_invalidate_tenant_cache_uses_scan_not_keys():
    redis_client = MagicMock()
    redis_client.scan_iter = MagicMock(
        return_value=_async_iter(["ioc:t1:ip:1.1.1.1", "ioc:t1:domain:evil.com"])
    )
    redis_client.delete = AsyncMock(return_value=1)
    redis_client.keys = AsyncMock()

    deleted = await invalidate_tenant_cache(redis_client, "t1")

    redis_client.scan_iter.assert_called_once_with(match="ioc:t1:*", count=100)
    redis_client.keys.assert_not_called()
    assert redis_client.delete.await_count == 2
    assert deleted == 2


async def _async_iter(items):
    for item in items:
        yield item


@pytest.mark.asyncio
async def test_adding_missing_source_key_invalidates_partial_cache():
    """Partial keys cache an IOC; after invalidation, same IOC re-queries newly added source."""
    tenant_id = uuid4()
    tid = str(tenant_id)
    ioc = "8.8.8.8"
    db = MagicMock()
    redis_client = _FakeRedis()

    vt_result = {"provider": "virustotal", "available": True, "score": 10, "error": None}
    abuse_result = {"provider": "abuseipdb", "available": True, "score": 20, "error": None}

    with (
        patch("app.services.correlation.load_tenant_keys", new_callable=AsyncMock) as load_keys,
        patch("app.services.correlation.intel_clients") as intel,
    ):
        load_keys.return_value = {"virustotal": "vt-secret"}
        intel.query_virustotal = AsyncMock(return_value=vt_result)
        intel.query_abuseipdb = AsyncMock(return_value=abuse_result)

        first = await run_correlation(db, redis_client, tenant_id, ioc)

        by_first = {s["provider"]: s for s in first["sources"]}
        assert by_first["virustotal"]["available"] is True
        assert by_first["abuseipdb"]["error"] == "no_api_key"
        assert any(k.startswith(f"ioc:{tid}:") for k in redis_client.store)
        intel.query_virustotal.assert_awaited_once()
        intel.query_abuseipdb.assert_not_called()

        # Simulate upsert_key / delete_key side effect
        await invalidate_tenant_cache(redis_client, tid)
        assert not any(k.startswith(f"ioc:{tid}:") for k in redis_client.store)

        load_keys.return_value = {"virustotal": "vt-secret", "abuseipdb": "abuse-secret"}
        intel.query_virustotal.reset_mock()
        intel.query_abuseipdb.reset_mock()

        second = await run_correlation(db, redis_client, tenant_id, ioc)

        intel.query_virustotal.assert_awaited_once_with("vt-secret", ioc)
        intel.query_abuseipdb.assert_awaited_once_with("abuse-secret", ioc)
        by_second = {s["provider"]: s for s in second["sources"]}
        assert by_second["virustotal"]["score"] == 10
        assert by_second["abuseipdb"]["available"] is True
        assert by_second["abuseipdb"]["score"] == 20


@pytest.mark.asyncio
async def test_upsert_and_delete_key_call_invalidate():
    from app.api.api_keys import delete_key, upsert_key
    from app.schemas.api_key import ApiKeyUpsert

    tenant_id = uuid4()
    user = MagicMock()
    user.tenant_id = tenant_id
    redis_client = MagicMock()
    db = AsyncMock()

    # upsert: no existing row
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()

    with (
        patch("app.api.api_keys.encrypt_secret", return_value="enc"),
        patch("app.api.api_keys.invalidate_tenant_cache", new_callable=AsyncMock) as inv,
    ):
        out = await upsert_key(
            "virustotal",
            ApiKeyUpsert(api_key="long-enough-key"),
            db,
            user,
            redis_client,
        )
        assert out == {"ok": True}
        inv.assert_awaited_once_with(redis_client, str(tenant_id))

        inv.reset_mock()
        # delete: existing row
        row = MagicMock()
        row.id = uuid4()
        result.scalar_one_or_none.return_value = row
        out = await delete_key("virustotal", db, user, redis_client)
        assert out == {"ok": True}
        inv.assert_awaited_once_with(redis_client, str(tenant_id))
