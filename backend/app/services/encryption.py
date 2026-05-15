from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def get_fernet() -> Fernet:
    settings = get_settings()
    key = settings.encryption_key.strip()
    if not key:
        raise RuntimeError("ENCRYPTION_KEY is not set")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plain: str) -> str:
    return get_fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    try:
        return get_fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError("Invalid encrypted payload") from e
