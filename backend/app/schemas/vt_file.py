from typing import Any

from pydantic import BaseModel, Field


class VtEngineResult(BaseModel):
    engine: str
    category: str
    result: str | None = None
    method: str | None = None


class VtFileStats(BaseModel):
    malicious: int = 0
    suspicious: int = 0
    undetected: int = 0
    harmless: int = 0
    total: int = 0


class VtFileScanResult(BaseModel):
    found: bool
    sha256: str
    filename: str | None = None
    analysis_id: str | None = None
    status: str = "completed"
    score: int | None = None
    severity: str | None = None
    detections: str | None = None
    stats: VtFileStats | None = None
    engines: list[VtEngineResult] = Field(default_factory=list)
    provider: str = "virustotal"


class VtAnalysisPoll(BaseModel):
    analysis_id: str
    status: str
    found: bool = False
    sha256: str | None = None
    score: int | None = None
    severity: str | None = None
    detections: str | None = None
    stats: VtFileStats | None = None
    engines: list[VtEngineResult] = Field(default_factory=list)


class VtUploadResponse(BaseModel):
    analysis_id: str
    status: str
    sha256: str | None = None
    found: bool = False
