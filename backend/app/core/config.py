from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "changeme"
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"

    database_url: str = "postgresql+asyncpg://iocuser:iocpass@localhost:5432/iocdb"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    encryption_key: str = ""

    vt_client_id: str = ""
    vt_client_secret: str = ""
    vt_redirect_uri: str = "http://localhost:8000/api/v1/auth/virustotal/callback"

    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    @property
    def cors_origins(self) -> list[str]:
        return [self.frontend_url.rstrip("/")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
