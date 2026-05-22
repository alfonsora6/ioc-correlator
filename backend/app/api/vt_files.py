import re
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import ApiKey, User
from app.db.session import get_db
from app.services.encryption import decrypt_secret
from app.services.vt_files import VtFileError, get_analysis, lookup_file, upload_file

router = APIRouter(prefix="/vt", tags=["virustotal-files"])

SHA256_RE = re.compile(r"^[a-fA-F0-9]{64}$")


async def _get_vt_key(db: AsyncSession, tenant_id) -> str:
    q = await db.execute(
        select(ApiKey).where(ApiKey.tenant_id == tenant_id, ApiKey.provider == "virustotal")
    )
    row = q.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=400, detail="no_vt_api_key")
    try:
        return decrypt_secret(row.encrypted_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail="key_decrypt_failed") from e


def _map_vt_error(exc: VtFileError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message or exc.code},
    )


@router.get("/files/{sha256}")
async def vt_file_lookup(
    sha256: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if not SHA256_RE.match(sha256):
        raise HTTPException(status_code=400, detail="invalid_sha256")
    api_key = await _get_vt_key(db, user.tenant_id)
    try:
        return await lookup_file(api_key, sha256)
    except VtFileError as e:
        raise _map_vt_error(e) from e


@router.post("/files")
async def vt_file_upload(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
):
    api_key = await _get_vt_key(db, user.tenant_id)
    content = await file.read()
    filename = file.filename or "upload.bin"
    try:
        return await upload_file(api_key, content, filename)
    except VtFileError as e:
        raise _map_vt_error(e) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "upload_failed", "message": str(e)},
        ) from e


@router.get("/analyses/{analysis_id}")
async def vt_analysis_poll(
    analysis_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    sha256: str | None = None,
    filename: str | None = None,
):
    api_key = await _get_vt_key(db, user.tenant_id)
    try:
        return await get_analysis(api_key, analysis_id, sha256=sha256, filename=filename)
    except VtFileError as e:
        raise _map_vt_error(e) from e
