from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ClientCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sector: str | None = Field(default=None, max_length=255)
    employee_count: int | None = Field(default=None, ge=0)
    description: str | None = None


class ClientListItem(BaseModel):
    id: UUID
    name: str
    sector: str | None
    employee_count: int | None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientRead(BaseModel):
    id: UUID
    user_id: UUID | None
    name: str
    sector: str | None
    employee_count: int | None
    description: str | None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientDiagnosticItem(BaseModel):
    id: UUID
    status: str
    total_score: float | None
    maturity_level: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ClientDetailResponse(BaseModel):
    client: ClientRead
    diagnostics: list[ClientDiagnosticItem]
