from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    ioc: str = Field(min_length=1, max_length=2048)


class AnalysisOut(BaseModel):
    id: str
    ioc_value: str
    ioc_type: str
    score: int
    severity: str
    results_json: dict
    created_at: str
