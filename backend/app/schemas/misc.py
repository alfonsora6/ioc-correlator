from pydantic import BaseModel, Field


class BatchJobOut(BaseModel):
    id: str
    filename: str
    total_iocs: int
    processed: int
    status: str
    created_at: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
