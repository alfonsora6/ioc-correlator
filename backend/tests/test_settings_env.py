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
