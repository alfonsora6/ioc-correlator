"""Empty env vars must not break Settings int defaults."""


def test_empty_refresh_token_days_uses_default(monkeypatch):
    monkeypatch.setenv("REFRESH_TOKEN_EXPIRE_DAYS", "")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "")
    from app.core.config import Settings

    s = Settings(_env_file=None)
    assert s.refresh_token_expire_days == 7
    assert s.access_token_expire_minutes == 30


def test_explicit_refresh_token_days_is_honored(monkeypatch):
    monkeypatch.setenv("REFRESH_TOKEN_EXPIRE_DAYS", "14")
    from app.core.config import Settings

    s = Settings(_env_file=None)
    assert s.refresh_token_expire_days == 14


def test_secret_key_has_no_default(monkeypatch):
    import pytest
    from pydantic import ValidationError

    from app.core.config import Settings

    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError, match="secret_key"):
        Settings(_env_file=None)

    monkeypatch.setenv("SECRET_KEY", "")
    with pytest.raises(ValidationError, match="secret_key"):
        Settings(_env_file=None)


def test_database_url_default_is_a_non_working_placeholder(monkeypatch):
    from app.core.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    s = Settings(_env_file=None)
    assert "iocpass" not in s.database_url
    assert ".invalid" in s.database_url
