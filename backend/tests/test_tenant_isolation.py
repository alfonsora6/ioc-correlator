"""RF-12: tenant B must not see tenant A's analyses (history, dashboard, PDF report).

Runs against a real database through the real routers and real JWTs:

* history and PDF run on in-memory SQLite by default (JSONB is rendered as JSON);
* the dashboard uses PostgreSQL-only SQL (``date_trunc``), so that test is skipped
  unless ``TEST_DATABASE_URL`` points to a PostgreSQL database, e.g.
  ``postgresql+asyncpg://user:pass@host:5432/iocdb_test``. With that variable set,
  all three tests run on PostgreSQL. Use a throwaway database: tables are created
  if missing and the rows created by the test are deleted afterwards.
"""
from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool

from app.api import analyses, dashboard
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models import Analysis, Tenant, User
from app.db.session import get_db

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
IS_POSTGRES = bool(TEST_DATABASE_URL and TEST_DATABASE_URL.startswith("postgresql"))

IOC_A = "a-secret-tenant.example.com"
IOC_B = "b-visible-tenant.example.org"


@compiles(JSONB, "sqlite")
def _jsonb_as_json_on_sqlite(_type, _compiler, **_kw):
    return "JSON"


def _reports_module():
    try:
        from app.api import reports
    except OSError as exc:  # weasyprint native libs (cairo/pango) missing
        pytest.skip(f"weasyprint not usable in this environment: {exc}")
    return reports


@pytest_asyncio.fixture
async def world():
    if TEST_DATABASE_URL:
        engine = create_async_engine(TEST_DATABASE_URL)
    else:
        engine = create_async_engine(
            "sqlite+aiosqlite://",
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)

    now = datetime.now(UTC)
    ids = {}
    async with maker() as s:
        for label, ioc in (("a", IOC_A), ("b", IOC_B)):
            tenant = Tenant(name=f"Tenant {label.upper()} {uuid4().hex[:6]}")
            s.add(tenant)
            await s.flush()
            user = User(
                tenant_id=tenant.id,
                email=f"{label}-{uuid4().hex[:8]}@example.com",
                full_name=f"User {label.upper()}",
                hashed_password="not-used",
            )
            s.add(user)
            await s.flush()
            s.add(
                Analysis(
                    tenant_id=tenant.id,
                    user_id=user.id,
                    ioc_value=ioc,
                    ioc_type="domain",
                    score=80,
                    severity="CRITICAL",
                    results_json={"sources": []},
                    created_at=now,
                )
            )
            ids[label] = {
                "tenant": tenant.id,
                "token": create_access_token(str(user.id), str(tenant.id), user.email),
            }
        await s.commit()

    async def override_db():
        async with maker() as session:
            yield session
            await session.commit()

    app = FastAPI()
    app.include_router(analyses.router, prefix="/api/v1")
    app.include_router(dashboard.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = override_db

    yield app, ids, maker

    if TEST_DATABASE_URL:
        async with maker() as s:
            await s.execute(delete(Tenant).where(Tenant.id.in_([v["tenant"] for v in ids.values()])))
            await s.commit()
    await engine.dispose()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _client(app):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_history_is_isolated_between_tenants(world):
    app, ids, _ = world
    async with await _client(app) as c:
        rb = await c.get("/api/v1/analyses/history", headers=_auth(ids["b"]["token"]))
        ra = await c.get("/api/v1/analyses/history", headers=_auth(ids["a"]["token"]))
    assert rb.status_code == 200 and ra.status_code == 200
    assert [x["ioc_value"] for x in rb.json()] == [IOC_B]
    assert IOC_A not in rb.text
    assert [x["ioc_value"] for x in ra.json()] == [IOC_A]
    assert IOC_B not in ra.text


@pytest.mark.asyncio
async def test_history_requires_authentication(world):
    app, _, _ = world
    async with await _client(app) as c:
        r = await c.get("/api/v1/analyses/history")
    assert r.status_code == 401


@pytest.mark.skipif(
    not IS_POSTGRES,
    reason="dashboard uses PostgreSQL-only SQL (date_trunc); set TEST_DATABASE_URL=postgresql+asyncpg://...",
)
@pytest.mark.asyncio
async def test_dashboard_is_isolated_between_tenants(world):
    app, ids, _ = world
    async with await _client(app) as c:
        rb = await c.get("/api/v1/dashboard/summary", headers=_auth(ids["b"]["token"]))
    assert rb.status_code == 200
    body = rb.json()
    assert [t["ioc"] for t in body["top_iocs"]] == [IOC_B]
    assert body["severity_counts"]["CRITICAL"] == 1
    assert sum(t["count"] for t in body["timeline"]) == 1
    assert IOC_A not in rb.text


@pytest.mark.asyncio
async def test_pdf_report_is_isolated_between_tenants(world):
    reports = _reports_module()
    app, ids, _ = world
    app.include_router(reports.router, prefix="/api/v1")
    captured: dict[str, str] = {}

    class FakeHTML:
        def __init__(self, string: str):
            captured["html"] = string

        def write_pdf(self) -> bytes:
            return b"%PDF-fake"

    now = datetime.now(UTC)
    params = {"from": (now - timedelta(days=1)).isoformat(), "to": (now + timedelta(days=1)).isoformat()}
    with patch.object(reports, "HTML", FakeHTML):
        async with await _client(app) as c:
            r = await c.get("/api/v1/reports/pdf", params=params, headers=_auth(ids["b"]["token"]))
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert IOC_B in captured["html"]
    assert IOC_A not in captured["html"]
