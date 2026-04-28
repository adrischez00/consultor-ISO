from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

SUPPLIER_FINAL_RATING_VALUES = (
    "excellent",
    "approved",
    "conditional",
    "critical",
)


class SupplierCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    service_category: str = Field(min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=64)
    quality_score: int = Field(ge=1, le=5)
    delivery_score: int = Field(ge=1, le=5)
    incidents_score: int = Field(ge=1, le=5)
    certifications_score: int = Field(ge=1, le=5)
    additional_score: int | None = Field(default=None, ge=1, le=5)
    incidents_count: int = Field(default=0, ge=0)
    evaluation_date: date
    evaluation_notes: str | None = None


class SupplierUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    service_category: str | None = Field(default=None, min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=64)
    quality_score: int | None = Field(default=None, ge=1, le=5)
    delivery_score: int | None = Field(default=None, ge=1, le=5)
    incidents_score: int | None = Field(default=None, ge=1, le=5)
    certifications_score: int | None = Field(default=None, ge=1, le=5)
    additional_score: int | None = Field(default=None, ge=1, le=5)
    incidents_count: int | None = Field(default=None, ge=0)
    evaluation_date: date | None = None
    evaluation_notes: str | None = None


class SupplierRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    name: str
    service_category: str
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    quality_score: int
    delivery_score: int
    incidents_score: int
    certifications_score: int
    additional_score: int | None
    global_score: float
    incidents_count: int
    evaluation_date: date
    final_rating: str
    evaluation_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplierListItem(BaseModel):
    id: UUID
    name: str
    service_category: str
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    quality_score: int
    delivery_score: int
    incidents_score: int
    certifications_score: int
    additional_score: int | None
    global_score: float
    incidents_count: int
    evaluation_date: date
    final_rating: str
    evaluation_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplierSummaryRead(BaseModel):
    total_suppliers: int
    average_global_score: float | None
    excellent_count: int
    approved_count: int
    conditional_count: int
    critical_count: int
    latest_evaluation_date: date | None
