import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(subject: str, tenant_id: str, email: str) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "tenant_id": tenant_id,
        "email": email,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


def decode_token_safe(token: str) -> dict[str, Any] | None:
    try:
        return decode_access_token(token)
    except JWTError:
        return None


def new_refresh_token_value() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def refresh_cookie_params() -> dict[str, Any]:
    settings = get_settings()
    max_age = settings.refresh_token_expire_days * 24 * 60 * 60
    return {
        "key": "refresh_token",
        "httponly": True,
        "secure": settings.environment == "production",
        "samesite": "lax",
        "max_age": max_age,
        "path": "/",
    }

