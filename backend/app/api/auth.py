from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token_value,
    refresh_cookie_params,
    verify_password,
)
from app.db.models import RefreshToken, Tenant, User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


async def _persist_refresh(db: AsyncSession, user_id: UUID, plain: str) -> None:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    rt = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(plain),
        expires_at=expires,
        revoked=False,
    )
    db.add(rt)
    await db.flush()


def _set_refresh_cookie(response: Response, plain: str) -> None:
    params = refresh_cookie_params()
    response.set_cookie(value=plain, **params)


def _clear_refresh_cookie(response: Response) -> None:
    p = refresh_cookie_params()
    response.delete_cookie(key=p["key"], path=p.get("path", "/"))


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant = Tenant(name=body.tenant_name)
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    refresh_plain = new_refresh_token_value()
    await _persist_refresh(db, user.id, refresh_plain)

    access = create_access_token(str(user.id), str(user.tenant_id), user.email)
    _set_refresh_cookie(response, refresh_plain)
    return TokenResponse(access_token=access)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    q = await db.execute(select(User).where(User.email == body.email))
    user = q.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    refresh_plain = new_refresh_token_value()
    await _persist_refresh(db, user.id, refresh_plain)

    access = create_access_token(str(user.id), str(user.tenant_id), user.email)
    _set_refresh_cookie(response, refresh_plain)
    return TokenResponse(access_token=access)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_session(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plain = request.cookies.get(refresh_cookie_params()["key"])
    if not plain:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    th = hash_refresh_token(plain)
    q = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == th, RefreshToken.revoked.is_(False))
        .options(selectinload(RefreshToken.user))
    )
    row = q.scalar_one_or_none()
    if row is None or row.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = row.user
    row.revoked = True
    new_plain = new_refresh_token_value()
    await _persist_refresh(db, user.id, new_plain)

    access = create_access_token(str(user.id), str(user.tenant_id), user.email)
    _set_refresh_cookie(response, new_plain)
    return TokenResponse(access_token=access)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plain = request.cookies.get(refresh_cookie_params()["key"])
    if plain:
        th = hash_refresh_token(plain)
        q = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == th))
        row = q.scalar_one_or_none()
        if row:
            row.revoked = True
    _clear_refresh_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def read_me(
    user: Annotated[User, Depends(get_current_user)],
):
    return UserPublic(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        tenant_id=str(user.tenant_id),
        tenant_name=user.tenant.name if user.tenant else None,
    )
