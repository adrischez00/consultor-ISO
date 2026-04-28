from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

RISK_OPPORTUNITY_TYPE_VALUES = ("risk", "opportunity")
RISK_OPPORTUNITY_STATUS_VALUES = ("pending", "in_progress", "completed")
RISK_OPPORTUNITY_LEVEL_VALUES = ("low", "medium", "high", "critical")


class RiskOpportunityCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    item_type: str = Field(min_length=1, max_length=16)
    probability: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    action_plan: str = Field(min_length=1)
    responsible_name: str = Field(min_length=1, max_length=255)
    status: str = Field(default="pending", min_length=1, max_length=24)
    review_date: date


class RiskOpportunityUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    item_type: str | None = Field(default=None, min_length=1, max_length=16)
    probability: int | None = Field(default=None, ge=1, le=5)
    impact: int | None = Field(default=None, ge=1, le=5)
    action_plan: str | None = Field(default=None, min_length=1)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, min_length=1, max_length=24)
    review_date: date | None = None


class RiskOpportunityRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    name: str
    description: str | None
    item_type: str
    probability: int
    impact: int
    level_score: int
    level: str
    action_plan: str
    responsible_name: str
    status: str
    review_date: date
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskOpportunityListItem(BaseModel):
    id: UUID
    name: str
    description: str | None
    item_type: str
    probability: int
    impact: int
    level_score: int
    level: str
    action_plan: str
    responsible_name: str
    status: str
    review_date: date
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskOpportunitySummaryRead(BaseModel):
    total_items: int
    open_items: int
    completed_items: int
    risks_count: int
    opportunities_count: int
    critical_count: int
    high_count: int
