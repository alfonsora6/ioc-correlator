from pydantic import BaseModel, Field


class ApiKeyUpsert(BaseModel):
    api_key: str = Field(min_length=8)


class ApiKeyPublic(BaseModel):
    provider: str
    status: str
    has_key: bool
