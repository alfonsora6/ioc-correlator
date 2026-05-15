from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import Analysis, ApiKey, User
from app.db.session import get_db
from app.services import intel_clients
from app.services.encryption import decrypt_secret

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _ping(provider: str, api_key: str) -> tuple[str, str | None]:
    if provider == "virustotal":
        r = await intel_clients.query_virustotal(api_key, "8.8.8.8")
        return ("live", None) if r.get("available") else ("down", str(r.get("error")))
    if provider == "abuseipdb":
        r = await intel_clients.query_abuseipdb(api_key, "8.8.8.8")
        return ("live", None) if r.get("available") else ("down", str(r.get("error")))
    if provider == "shodan":
        r = await intel_clients.query_shodan(api_key, "8.8.8.8")
        return ("live", None) if r.get("available") else ("down", str(r.get("error")))
    if provider == "otx":
        r = await intel_clients.query_otx(api_key, "8.8.8.8")
        return ("live", None) if r.get("available") else ("down", str(r.get("error")))
    return "unknown", None


@router.get("/summary")
async def dashboard_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    since = datetime.now(UTC) - timedelta(days=30)
    q = await db.execute(
        select(Analysis.severity, func.count())
        .where(Analysis.tenant_id == user.tenant_id, Analysis.created_at >= since)
        .group_by(Analysis.severity)
    )
    counts = {sev: 0 for sev in ("LOW", "MEDIUM", "HIGH", "CRITICAL")}
    for sev, c in q.all():
        if sev in counts:
            counts[sev] = int(c)

    day = func.date_trunc("day", Analysis.created_at).label("d")
    tq = await db.execute(
        select(day, func.count())
        .where(Analysis.tenant_id == user.tenant_id, Analysis.created_at >= since)
        .group_by(day)
        .order_by(day)
    )
    timeline = [{"date": (row[0].date().isoformat() if row[0] else ""), "count": int(row[1])} for row in tq.all()]

    topq = await db.execute(
        select(Analysis.ioc_value, func.count())
        .where(Analysis.tenant_id == user.tenant_id, Analysis.created_at >= since)
        .group_by(Analysis.ioc_value)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_iocs = [{"ioc": row[0], "count": int(row[1])} for row in topq.all()]

    origins: dict[str, int] = {}
    aq = await db.execute(
        select(Analysis.results_json).where(Analysis.tenant_id == user.tenant_id, Analysis.created_at >= since).limit(500)
    )
    for (doc,) in aq.all():
        if not doc:
            continue
        for s in doc.get("sources", []) or []:
            raw = (s or {}).get("raw") or {}
            c = raw.get("country") or raw.get("countryCode") or raw.get("country_name")
            if c:
                origins[str(c)] = origins.get(str(c), 0) + 1

    integrations = []
    kq = await db.execute(select(ApiKey).where(ApiKey.tenant_id == user.tenant_id))
    keys = {k.provider: k for k in kq.scalars().all()}
    for p in ("virustotal", "abuseipdb", "shodan", "otx"):
        row = keys.get(p)
        if not row:
            integrations.append({"provider": p, "status": "missing"})
            continue
        try:
            k = decrypt_secret(row.encrypted_key)
            st, _ = await _ping(p, k)
            integrations.append({"provider": p, "status": st})
        except Exception:
            integrations.append({"provider": p, "status": "error"})

    return {
        "severity_counts": counts,
        "timeline": timeline,
        "top_iocs": top_iocs,
        "origins": origins,
        "integrations": integrations,
    }
