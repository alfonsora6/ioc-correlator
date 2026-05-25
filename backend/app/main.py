from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analyses, api_keys, auth, batch, dashboard, reports, users, vt_files
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.redis = redis.from_url(settings.redis_url, decode_responses=True)
    yield
    await app.state.redis.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="IOC Correlator API", lifespan=lifespan)

    cors_kw: dict = {
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if settings.environment == "development":
        # Acceso por IP del servidor (p. ej. http://192.168.1.50:5173)
        cors_kw["allow_origin_regex"] = r"https?://[^/]+:5173"
    else:
        cors_kw["allow_origins"] = settings.cors_origins
    app.add_middleware(CORSMiddleware, **cors_kw)

    api = APIRouter(prefix="/api/v1")
    api.include_router(auth.router)
    api.include_router(api_keys.vt_router)
    api.include_router(api_keys.router)
    api.include_router(analyses.router)
    api.include_router(vt_files.router)
    api.include_router(batch.router)
    api.include_router(dashboard.router)
    api.include_router(reports.router)
    api.include_router(users.router)
    app.include_router(api)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
