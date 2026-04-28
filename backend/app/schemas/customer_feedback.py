from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

CUSTOMER_FEEDBACK_TYPE_VALUES = (
    "survey",
    "meeting",
    "call",
    "email",
    "complaint",
    "other",
)


class CustomerFeedbackCreateRequest(BaseModel):
    client_id: UUID
    feedback_date: date
    score: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1)
    feedback_type: str = Field(default="survey", min_length=1, max_length=32)


class CustomerFeedbackUpdateRequest(BaseModel):
    client_id: UUID | None = None
    feedback_date: date | None = None
    score: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, min_length=1)
    feedback_type: str | None = Field(default=None, min_length=1, max_length=32)


class CustomerFeedbackRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    client_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    feedback_date: date
    score: int
    comment: str
    feedback_type: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerFeedbackListItem(BaseModel):
    id: UUID
    client_id: UUID
    feedback_date: date
    score: int
    comment: str
    feedback_type: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerFeedbackSummaryRead(BaseModel):
    total_feedback: int
    average_score: float | None
    satisfied_count: int
    neutral_count: int
    unsatisfied_count: int
    score_5_count: int
    score_4_count: int
    score_3_count: int
    score_2_count: int
    score_1_count: int
    latest_feedback_date: date | None
