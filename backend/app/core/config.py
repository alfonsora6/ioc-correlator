from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Empty env values (VAR=) must not override defaults — otherwise int fields like
    # REFRESH_TOKEN_EXPIRE_DAYS= raise ValidationError instead of using 7.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )

    # No default: the app must not start with a guessable JWT signing key.
    # Set SECRET_KEY in .env (see .env.example) or the process environment.
    secret_key: str
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"

    # Placeholder only: the host is a reserved .invalid name, so connecting fails
    # with a clear DNS error instead of reaching a database with a known password.
    database_url: str = "postgresql+asyncpg://user:set-DATABASE_URL-in-env@database-url-not-set.invalid:5432/iocdb"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    encryption_key: str = ""

    vt_client_id: str = ""
    vt_client_secret: str = ""
    vt_redirect_uri: str = "http://localhost:8000/api/v1/auth/virustotal/callback"

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Auth rate limits (Redis). Behind Docker, request.client.host is often the
    # bridge gateway (e.g. 172.18.0.1), so login keys include normalized email.
    auth_rate_limit_login: int = 5
    auth_rate_limit_login_window_seconds: int = 60
    # Shared-IP safety net (AUTH_RATE_LIMIT_LOGIN_IP): with one gateway IP for all
    # clients, a low ceiling becomes a global login lockout. Brute-force resistance
    # comes from the per IP+email limit; keep this high (default 200/min).
    auth_rate_limit_login_ip: int = 200
    auth_rate_limit_login_ip_window_seconds: int = 60
    auth_rate_limit_register: int = 10
    auth_rate_limit_register_window_seconds: int = 60
    auth_rate_limit_trust_proxy: bool = False

    @property
    def cors_origins(self) -> list[str]:
        origins = {self.frontend_url.rstrip("/")}
        if self.environment == "development":
            origins.update(
                {
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                }
            )
        return sorted(origins)


@lru_cache
def get_settings() -> Settings:
    return Settings()
