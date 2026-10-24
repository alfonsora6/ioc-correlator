"""RF-07: batch upload extracts IOCs from .txt/.csv/.log and enforces limits."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import batch
from app.api.deps import get_current_user
from app.db.session import get_db
from app.services.ioc_detect import extract_iocs_from_text

IP = "185.220.101.34"
DOMAIN = "evil.example.com"
MD5 = "d41d8cd98f00b204e9800998ecf8427e"
SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

MIXED = {
    "iocs.txt": f"{IP}\n{DOMAIN}\n{MD5}\n{SHA256}\n",
    "iocs.csv": f"ioc,note\n{IP},c2 server\n{DOMAIN},phishing\n{MD5},dropper\n",
    "iocs.log": f"2026-01-01 ALERT src={IP} dns={DOMAIN} sample={SHA256} end\n",
}


def test_extract_from_mixed_text():
    found = set(extract_iocs_from_text(MIXED["iocs.txt"]))
    assert {IP, DOMAIN, MD5, SHA256} <= found


def test_extract_from_text_without_iocs_is_empty():
    assert extract_iocs_from_text("nothing to see here, just words\n") == []


def test_extract_ignores_overlong_values():
    long_url = "http://x.com/" + "a" * 2100
    found = extract_iocs_from_text(long_url)
    assert long_url not in found
    assert all(len(v) <= 2040 for v in found)


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(batch.router)

    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()

    async def fake_db():
        yield session

    user = SimpleNamespace(id=uuid4(), tenant_id=uuid4())
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: user
    with patch.object(batch.process_batch_job, "delay") as delay:
        c = TestClient(app)
        c.session = session
        c.delay = delay
        c.user = user
        yield c


@pytest.mark.parametrize("name", list(MIXED))
def test_upload_extracts_iocs(client, name):
    r = client.post("/batch/upload", files={"file": (name, MIXED[name].encode(), "text/plain")})
    assert r.status_code == 200
    body = r.json()
    expected = set(extract_iocs_from_text(MIXED[name]))
    assert body["total_iocs"] == len(expected) >= 3
    job = client.session.add.call_args[0][0]
    assert job.filename == name
    assert job.tenant_id == client.user.tenant_id
    assert job.total_iocs == body["total_iocs"]
    client.delay.assert_called_once()


def test_upload_without_iocs_returns_400(client):
    r = client.post("/batch/upload", files={"file": ("empty.txt", b"hello world\n", "text/plain")})
    assert r.status_code == 400
    assert "No IOCs" in r.json()["detail"]
    client.session.add.assert_not_called()
    client.delay.assert_not_called()


def test_upload_larger_than_2mb_returns_413(client):
    big = (IP + "\n").encode() * (batch.MAX_UPLOAD_BYTES // (len(IP) + 1) + 10)
    assert len(big) > 2 * 1024 * 1024
    r = client.post("/batch/upload", files={"file": ("big.log", big, "text/plain")})
    assert r.status_code == 413
    client.session.add.assert_not_called()
    client.delay.assert_not_called()


def test_upload_of_exactly_2mb_is_accepted(client):
    line = (IP + "\n").encode()
    data = line * (batch.MAX_UPLOAD_BYTES // len(line))
    data += b" " * (batch.MAX_UPLOAD_BYTES - len(data))
    assert len(data) == batch.MAX_UPLOAD_BYTES
    r = client.post("/batch/upload", files={"file": ("edge.txt", data, "text/plain")})
    assert r.status_code == 200
