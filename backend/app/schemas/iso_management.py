from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

INTERESTED_PARTY_TYPE_VALUES = (
    "internal",
    "external",
    "customer",
    "supplier",
    "regulator",
    "other",
)
PRIORITY_VALUES = ("low", "medium", "high")
ACTIVE_STATUS_VALUES = ("active", "inactive")
PROCESS_TYPE_VALUES = ("strategic", "operational", "support")
OBJECTIVE_STATUS_VALUES = ("planned", "in_progress", "completed", "on_hold")
CHANGE_PLAN_STATUS_VALUES = ("planned", "in_progress", "completed", "cancelled")
NONCONFORMITY_ORIGIN_TYPE_VALUES = ("audit", "complaint", "process", "supplier", "kpi", "other")
NONCONFORMITY_STATUS_VALUES = ("open", "in_progress", "pending_verification", "closed")
IMPROVEMENT_SOURCE_TYPE_VALUES = (
    "risk_opportunity",
    "audit_recommendation",
    "nonconformity",
    "management_review",
    "other",
)
IMPROVEMENT_STATUS_VALUES = ("proposed", "in_progress", "implemented", "validated", "closed")


class IsoContextProfileUpsertRequest(BaseModel):
    internal_context: str = Field(min_length=1)
    external_context: str = Field(min_length=1)
    system_scope: str = Field(min_length=1)
    exclusions: str | None = None
    review_date: date
    next_review_date: date | None = None


class IsoContextProfileRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    updated_by_user_id: UUID | None
    internal_context: str
    external_context: str
    system_scope: str
    exclusions: str | None
    review_date: date
    next_review_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoInterestedPartyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    party_type: str = Field(min_length=1, max_length=32)
    needs_expectations: str = Field(min_length=1)
    monitoring_method: str | None = None
    priority: str = Field(default="medium", min_length=1, max_length=16)
    status: str = Field(default="active", min_length=1, max_length=16)
    review_date: date | None = None


class IsoInterestedPartyUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    party_type: str | None = Field(default=None, min_length=1, max_length=32)
    needs_expectations: str | None = Field(default=None, min_length=1)
    monitoring_method: str | None = None
    priority: str | None = Field(default=None, min_length=1, max_length=16)
    status: str | None = Field(default=None, min_length=1, max_length=16)
    review_date: date | None = None


class IsoInterestedPartyRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    name: str
    party_type: str
    needs_expectations: str
    monitoring_method: str | None
    priority: str
    status: str
    review_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QualityPolicyCreateRequest(BaseModel):
    client_id: UUID | None = None
    version_label: str = Field(min_length=1, max_length=40)
    policy_text: str = Field(min_length=1)
    approved_by_name: str | None = Field(default=None, max_length=255)
    approved_date: date | None = None
    review_date: date | None = None
    is_active: bool = True


class QualityPolicyUpdateRequest(BaseModel):
    client_id: UUID | None = None
    version_label: str | None = Field(default=None, min_length=1, max_length=40)
    policy_text: str | None = Field(default=None, min_length=1)
    approved_by_name: str | None = Field(default=None, max_length=255)
    approved_date: date | None = None
    review_date: date | None = None
    is_active: bool | None = None


class QualityPolicyRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    client_id: UUID | None
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    version_label: str
    policy_text: str
    approved_by_name: str | None
    approved_date: date | None
    review_date: date | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoRoleAssignmentCreateRequest(BaseModel):
    role_name: str = Field(min_length=1, max_length=255)
    responsible_name: str = Field(min_length=1, max_length=255)
    responsibility_details: str = Field(min_length=1)
    related_process: str | None = Field(default=None, max_length=255)
    status: str = Field(default="active", min_length=1, max_length=16)


class IsoRoleAssignmentUpdateRequest(BaseModel):
    role_name: str | None = Field(default=None, min_length=1, max_length=255)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    responsibility_details: str | None = Field(default=None, min_length=1)
    related_process: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, min_length=1, max_length=16)


class IsoRoleAssignmentRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    role_name: str
    responsible_name: str
    responsibility_details: str
    related_process: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoProcessMapItemCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    process_type: str = Field(min_length=1, max_length=16)
    description: str = Field(min_length=1)
    process_inputs: str | None = None
    process_outputs: str | None = None
    responsible_name: str = Field(min_length=1, max_length=255)
    position_order: int = Field(default=100, ge=0, le=10000)
    status: str = Field(default="active", min_length=1, max_length=16)


class IsoProcessMapItemUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    process_type: str | None = Field(default=None, min_length=1, max_length=16)
    description: str | None = Field(default=None, min_length=1)
    process_inputs: str | None = None
    process_outputs: str | None = None
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    position_order: int | None = Field(default=None, ge=0, le=10000)
    status: str | None = Field(default=None, min_length=1, max_length=16)


class IsoProcessMapItemRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    name: str
    process_type: str
    description: str
    process_inputs: str | None
    process_outputs: str | None
    responsible_name: str
    position_order: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoQualityObjectiveCreateRequest(BaseModel):
    linked_kpi_id: UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    period_label: str = Field(min_length=1, max_length=120)
    responsible_name: str = Field(min_length=1, max_length=255)
    status: str = Field(default="planned", min_length=1, max_length=24)
    tracking_notes: str | None = None
    target_date: date | None = None
    review_date: date | None = None


class IsoQualityObjectiveUpdateRequest(BaseModel):
    linked_kpi_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    period_label: str | None = Field(default=None, min_length=1, max_length=120)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, min_length=1, max_length=24)
    tracking_notes: str | None = None
    target_date: date | None = None
    review_date: date | None = None


class IsoQualityObjectiveRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    linked_kpi_id: UUID | None
    title: str
    description: str
    period_label: str
    responsible_name: str
    status: str
    tracking_notes: str | None
    target_date: date | None
    review_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoQualityObjectiveSummaryRead(BaseModel):
    total: int
    planned: int
    in_progress: int
    completed: int
    on_hold: int
    linked_to_kpi: int


class IsoChangePlanCreateRequest(BaseModel):
    change_title: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=1)
    impact: str = Field(min_length=1)
    responsible_name: str = Field(min_length=1, max_length=255)
    planned_date: date
    status: str = Field(default="planned", min_length=1, max_length=24)
    followup_notes: str | None = None
    completion_date: date | None = None


class IsoChangePlanUpdateRequest(BaseModel):
    change_title: str | None = Field(default=None, min_length=1, max_length=255)
    reason: str | None = Field(default=None, min_length=1)
    impact: str | None = Field(default=None, min_length=1)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    planned_date: date | None = None
    status: str | None = Field(default=None, min_length=1, max_length=24)
    followup_notes: str | None = None
    completion_date: date | None = None


class IsoChangePlanRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    change_title: str
    reason: str
    impact: str
    responsible_name: str
    planned_date: date
    status: str
    followup_notes: str | None
    completion_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoNonconformityCreateRequest(BaseModel):
    client_id: UUID | None = None
    source_recommendation_id: UUID | None = None
    linked_action_task_id: UUID | None = None
    origin_type: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    cause_analysis: str | None = None
    immediate_correction: str | None = None
    corrective_action: str | None = None
    responsible_name: str = Field(min_length=1, max_length=255)
    due_date: date | None = None
    effectiveness_verification: str | None = None
    verification_date: date | None = None
    status: str = Field(default="open", min_length=1, max_length=32)
    closure_notes: str | None = None


class IsoNonconformityUpdateRequest(BaseModel):
    client_id: UUID | None = None
    source_recommendation_id: UUID | None = None
    linked_action_task_id: UUID | None = None
    origin_type: str | None = Field(default=None, min_length=1, max_length=32)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    cause_analysis: str | None = None
    immediate_correction: str | None = None
    corrective_action: str | None = None
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    due_date: date | None = None
    effectiveness_verification: str | None = None
    verification_date: date | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)
    closure_notes: str | None = None


class IsoNonconformityRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    client_id: UUID | None
    source_recommendation_id: UUID | None
    linked_action_task_id: UUID | None
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    origin_type: str
    title: str
    description: str
    cause_analysis: str | None
    immediate_correction: str | None
    corrective_action: str | None
    responsible_name: str
    due_date: date | None
    effectiveness_verification: str | None
    verification_date: date | None
    status: str
    closure_notes: str | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoNonconformitySummaryRead(BaseModel):
    total: int
    open: int
    in_progress: int
    pending_verification: int
    closed: int


class IsoImprovementCreateRequest(BaseModel):
    linked_nonconformity_id: UUID | None = None
    source_type: str = Field(default="other", min_length=1, max_length=40)
    source_id: UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    action_plan: str = Field(min_length=1)
    responsible_name: str = Field(min_length=1, max_length=255)
    status: str = Field(default="proposed", min_length=1, max_length=24)
    due_date: date | None = None
    followup_notes: str | None = None
    benefit_observed: str | None = None
    review_date: date | None = None


class IsoImprovementUpdateRequest(BaseModel):
    linked_nonconformity_id: UUID | None = None
    source_type: str | None = Field(default=None, min_length=1, max_length=40)
    source_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    action_plan: str | None = Field(default=None, min_length=1)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, min_length=1, max_length=24)
    due_date: date | None = None
    followup_notes: str | None = None
    benefit_observed: str | None = None
    review_date: date | None = None


class IsoImprovementRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    linked_nonconformity_id: UUID | None
    source_type: str
    source_id: UUID | None
    title: str
    description: str
    action_plan: str
    responsible_name: str
    status: str
    due_date: date | None
    followup_notes: str | None
    benefit_observed: str | None
    review_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IsoImprovementSummaryRead(BaseModel):
    total: int
    proposed: int
    in_progress: int
    implemented: int
    validated: int
    closed: int
