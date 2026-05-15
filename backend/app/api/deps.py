from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token_safe
from app.db.models import User
from app.db.session import get_db

security = HTTPBearer(auto_error=False)


async def get_redis(request: Request):
    r = getattr(request.app.state, "redis", None)
    if r is None:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    return r


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token_safe(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    q = await db.execute(select(User).options(selectinload(User.tenant)).where(User.id == UUID(sub)))
    user = q.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
