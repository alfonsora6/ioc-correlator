from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.models import User
from app.db.session import get_db
from app.schemas.misc import ChangePasswordRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    return {"ok": True}
