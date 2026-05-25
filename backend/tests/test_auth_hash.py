"""Comprueba que bcrypt/passlib pueden hashear contraseñas (fallo frecuente en Debian/Docker)."""
from app.core.security import hash_password, verify_password


def test_hash_and_verify_password():
    hashed = hash_password("TestPass123!")
    assert hashed.startswith("$2")
    assert verify_password("TestPass123!", hashed)
    assert not verify_password("wrong", hashed)
