import secrets
from typing import Annotated
from uuid import UUID

from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_redis
from app.core.config import get_settings
from app.db.models import ApiKey, User
from app.db.session import get_db
from app.schemas.api_key import ApiKeyPublic, ApiKeyUpsert
from app.services import intel_clients
from app.services.encryption import decrypt_secret, encrypt_secret

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

PROVIDERS = {"virustotal", "abuseipdb", "shodan", "otx"}


@router.get("", response_model=list[ApiKeyPublic])
async def list_keys(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    q = await db.execute(select(ApiKey).where(ApiKey.tenant_id == user.tenant_id))
    rows = q.scalars().all()
    by_p = {r.provider: r for r in rows}
    out: list[ApiKeyPublic] = []
    for p in ("virustotal", "abuseipdb", "shodan", "otx"):
        row = by_p.get(p)
        out.append(ApiKeyPublic(provider=p, status=row.status if row else "missing", has_key=row is not None))
    return out


@router.post("/{provider}")
async def upsert_key(
    provider: str,
    body: ApiKeyUpsert,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    enc = encrypt_secret(body.api_key.strip())
    q = await db.execute(
        select(ApiKey).where(ApiKey.tenant_id == user.tenant_id, ApiKey.provider == provider)
    )
    row = q.scalar_one_or_none()
    if row:
        row.encrypted_key = enc
        row.status = "pending"
    else:
        db.add(
            ApiKey(
                tenant_id=user.tenant_id,
                provider=provider,
                encrypted_key=enc,
                status="pending",
            )
        )
    return {"ok": True}


@router.delete("/{provider}")
async def delete_key(
    provider: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    q = await db.execute(
        select(ApiKey).where(ApiKey.tenant_id == user.tenant_id, ApiKey.provider == provider)
    )
    row = q.scalar_one_or_none()
    if row:
        await db.execute(delete(ApiKey).where(ApiKey.id == row.id))
    return {"ok": True}


async def _validate_provider(provider: str, api_key: str) -> tuple[str, str | None]:
    test_ioc = "8.8.8.8"
    try:
        if provider == "virustotal":
            r = await intel_clients.query_virustotal(api_key, test_ioc)
            return ("valid", None) if r.get("available") else ("invalid", str(r.get("error")))
        if provider == "abuseipdb":
            r = await intel_clients.query_abuseipdb(api_key, test_ioc)
            return ("valid", None) if r.get("available") else ("invalid", str(r.get("error")))
        if provider == "shodan":
            r = await intel_clients.query_shodan(api_key, test_ioc)
            return ("valid", None) if r.get("available") else ("invalid", str(r.get("error")))
        if provider == "otx":
            r = await intel_clients.query_otx(api_key, test_ioc)
            return ("valid", None) if r.get("available") else ("invalid", str(r.get("error")))
    except Exception as e:
        return "invalid", str(e)
    return "invalid", "unknown"


@router.post("/{provider}/validate")
async def validate_key(
    provider: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    q = await db.execute(
        select(ApiKey).where(ApiKey.tenant_id == user.tenant_id, ApiKey.provider == provider)
    )
    row = q.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="No key stored for provider")
    key = decrypt_secret(row.encrypted_key)
    status_val, err = await _validate_provider(provider, key)
    row.status = status_val
    return {"status": status_val, "error": err}


vt_router = APIRouter(prefix="/auth/virustotal", tags=["virustotal-oauth"])


@vt_router.get("/authorize")
async def vt_authorize(
    user: Annotated[User, Depends(get_current_user)],
    redis=Depends(get_redis),
):
    settings = get_settings()
    if not settings.vt_client_id:
        raise HTTPException(status_code=400, detail="VirusTotal OAuth is not configured")
    state = secrets.token_urlsafe(24)
    await redis.setex(f"vt_oauth:{state}", 600, str(user.id))
    params = {
        "client_id": settings.vt_client_id,
        "redirect_uri": settings.vt_redirect_uri,
        "response_type": "code",
        "scope": " ".join(["user:read", "file:read"]),
        "state": state,
    }
    url = "https://www.virustotal.com/oauth/authorize?" + urlencode(params)
    return {"authorization_url": url, "state": state}


@vt_router.get("/callback")
async def vt_callback(
    code: str,
    state: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    uid = await redis.get(f"vt_oauth:{state}")
    if not uid:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    await redis.delete(f"vt_oauth:{state}")

    settings = get_settings()
    if not settings.vt_client_id or not settings.vt_client_secret:
        raise HTTPException(status_code=500, detail="OAuth not configured")

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            "https://www.virustotal.com/oauth/token",
            data={
                "client_id": settings.vt_client_id,
                "client_secret": settings.vt_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.vt_redirect_uri,
            },
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Token exchange failed: {r.text}")
        data = r.json()
    access = data.get("access_token")
    if not access:
        raise HTTPException(status_code=400, detail="No access_token in response")

    q = await db.execute(select(ApiKey).where(ApiKey.tenant_id == UUID(uid), ApiKey.provider == "virustotal"))
    row = q.scalar_one_or_none()
    enc = encrypt_secret(access)
    if row:
        row.encrypted_key = enc
        row.status = "pending"
    else:
        db.add(ApiKey(tenant_id=UUID(uid), provider="virustotal", encrypted_key=enc, status="pending"))
    return {"ok": True, "message": "VirusTotal token stored. Run validate from the API Keys page."}
