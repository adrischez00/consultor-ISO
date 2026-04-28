from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

MANAGEMENT_REVIEW_STATUS_VALUES = ("pending", "in_progress", "completed")
MANAGEMENT_REVIEW_REFERENCE_TYPES = (
    "audit_report",
    "kpi_indicator",
    "non_conformity",
    "improvement_opportunity",
    "risk_opportunity",
    "customer_feedback",
    "supplier",
)


class ManagementReviewReferenceInput(BaseModel):
    reference_type: str = Field(min_length=1, max_length=40)
    source_id: UUID
    source_label: str | None = None


class ManagementReviewReferenceRead(BaseModel):
    id: UUID
    management_review_id: UUID
    consultancy_id: UUID
    reference_type: str
    source_id: UUID
    source_label: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ManagementReviewCreateRequest(BaseModel):
    review_date: date
    reviewed_period: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1)
    conclusions: str = Field(min_length=1)
    decisions: str = Field(min_length=1)
    derived_actions: str = Field(min_length=1)
    responsible_name: str = Field(min_length=1, max_length=255)
    followup_status: str = Field(default="pending", min_length=1, max_length=24)
    followup_notes: str | None = None
    references: list[ManagementReviewReferenceInput] = Field(default_factory=list)


class ManagementReviewUpdateRequest(BaseModel):
    review_date: date | None = None
    reviewed_period: str | None = Field(default=None, min_length=1, max_length=120)
    summary: str | None = Field(default=None, min_length=1)
    conclusions: str | None = Field(default=None, min_length=1)
    decisions: str | None = Field(default=None, min_length=1)
    derived_actions: str | None = Field(default=None, min_length=1)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    followup_status: str | None = Field(default=None, min_length=1, max_length=24)
    followup_notes: str | None = None
    references: list[ManagementReviewReferenceInput] | None = None


class ManagementReviewRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    review_date: date
    reviewed_period: str
    summary: str
    conclusions: str
    decisions: str
    derived_actions: str
    responsible_name: str
    followup_status: str
    followup_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ManagementReviewListItem(BaseModel):
    id: UUID
    review_date: date
    reviewed_period: str
    responsible_name: str
    followup_status: str
    created_at: datetime
    updated_at: datetime
    linked_audit_reports_count: int
    linked_kpis_count: int
    linked_nonconformities_count: int
    linked_improvement_opportunities_count: int
    linked_risks_count: int
    linked_customer_feedback_count: int
    linked_suppliers_count: int


class ManagementReviewDetailResponse(BaseModel):
    review: ManagementReviewRead
    references: list[ManagementReviewReferenceRead]
    linked_audit_reports_count: int
    linked_kpis_count: int
    linked_nonconformities_count: int
    linked_improvement_opportunities_count: int
    linked_risks_count: int
    linked_customer_feedback_count: int
    linked_suppliers_count: int


class ManagementReviewSummaryRead(BaseModel):
    total_reviews: int
    pending_reviews: int
    in_progress_reviews: int
    completed_reviews: int
    latest_review_date: date | None
