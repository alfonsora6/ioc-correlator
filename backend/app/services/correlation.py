import asyncio
from typing import Any
from uuid import UUID

import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ApiKey
from app.services import intel_clients
from app.services.aggregate import aggregate_scores, per_source_severity
from app.services.encryption import decrypt_secret
from app.services.ioc_detect import detect_ioc
from app.services.redis_cache import get_cached, set_cached


async def load_tenant_keys(db: AsyncSession, tenant_id: UUID) -> dict[str, str]:
    q = await db.execute(select(ApiKey).where(ApiKey.tenant_id == tenant_id))
    keys: dict[str, str] = {}
    for row in q.scalars().all():
        try:
            keys[row.provider] = decrypt_secret(row.encrypted_key)
        except Exception:
            continue
    return keys


async def run_correlation(
    db: AsyncSession,
    redis_client: redis.Redis,
    tenant_id: UUID,
    ioc_raw: str,
) -> dict[str, Any]:
    ioc_type, normalized = detect_ioc(ioc_raw)
    tid = str(tenant_id)
    cached = await get_cached(redis_client, tid, ioc_type, normalized)
    if cached:
        return cached

    keys = await load_tenant_keys(db, tenant_id)
    tasks = []
    labels = []

    if k := keys.get("virustotal"):
        tasks.append(intel_clients.query_virustotal(k, ioc_raw))
        labels.append("virustotal")
    if k := keys.get("abuseipdb"):
        tasks.append(intel_clients.query_abuseipdb(k, ioc_raw))
        labels.append("abuseipdb")
    if k := keys.get("shodan"):
        tasks.append(intel_clients.query_shodan(k, ioc_raw))
        labels.append("shodan")
    if k := keys.get("otx"):
        tasks.append(intel_clients.query_otx(k, ioc_raw))
        labels.append("otx")

    if not tasks:
        # Config state (missing keys), not threat-intel — never cache.
        results = [
            {"provider": "virustotal", "available": False, "error": "no_api_key", "score": None},
            {"provider": "abuseipdb", "available": False, "error": "no_api_key", "score": None},
            {"provider": "shodan", "available": False, "error": "no_api_key", "score": None},
            {"provider": "otx", "available": False, "error": "no_api_key", "score": None},
        ]
        score, severity = aggregate_scores(results)
        return {
            "ioc_type": ioc_type,
            "ioc_value": normalized,
            "score": score,
            "severity": severity,
            "sources": per_source_severity(results),
        }

    gathered = await asyncio.gather(*tasks, return_exceptions=True)
    results: list[dict[str, Any]] = []
    for label, item in zip(labels, gathered, strict=True):
        if isinstance(item, BaseException):
            results.append({"provider": label, "available": False, "error": str(item), "score": None})
        else:
            results.append(item)

    for p in ("virustotal", "abuseipdb", "shodan", "otx"):
        if p not in labels:
            results.append({"provider": p, "available": False, "error": "no_api_key", "score": None})

    order = ["virustotal", "abuseipdb", "shodan", "otx"]
    by_p = {r["provider"]: r for r in results}
    results = [by_p[p] for p in order]

    score, severity = aggregate_scores(results)
    payload = {
        "ioc_type": ioc_type,
        "ioc_value": normalized,
        "score": score,
        "severity": severity,
        "sources": per_source_severity(results),
    }
    await set_cached(redis_client, tid, ioc_type, normalized, payload)
    return payload
