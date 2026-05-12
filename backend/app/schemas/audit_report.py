from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditClientBasic(BaseModel):
    id: UUID
    name: str
    sector: str | None = None
    employee_count: int | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditUserBasic(BaseModel):
    id: UUID
    full_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class AuditReportListItem(BaseModel):
    id: UUID
    client_id: UUID
    template_id: UUID
    report_year: int
    report_code: str | None
    status: str
    entity_name: str
    audit_date: date | None
    created_at: datetime
    updated_at: datetime
    client: AuditClientBasic
    created_by: AuditUserBasic | None = None


class AuditReportCreateRequest(BaseModel):
    client_id: UUID
    report_year: int = Field(ge=2000, le=2200)
    template_code: str = Field(default="P03", min_length=1, max_length=64)
    entity_name: str | None = Field(default=None, min_length=1)
    auditor_organization: str | None = None
    audited_area: str | None = None
    audit_date: date | None = None
    tipo_auditoria: str | None = None
    modalidad: str | None = None
    audited_facilities: str | None = None
    quality_responsible_name: str | None = None
    manager_name: str | None = None
    reference_standard_revision: str | None = None
    audit_budget_code: str | None = None
    system_scope: str | None = None
    audit_description: str | None = None


class AuditReportUpdateRequest(BaseModel):
    entity_name: str | None = Field(default=None, min_length=1)
    auditor_organization: str | None = None
    audited_area: str | None = None
    audit_date: date | None = None
    tipo_auditoria: str | None = None
    modalidad: str | None = None
    audited_facilities: str | None = None
    quality_responsible_name: str | None = None
    manager_name: str | None = None
    reference_standard: str | None = None
    reference_standard_revision: str | None = None
    audit_budget_code: str | None = None
    system_scope: str | None = None
    audit_description: str | None = None
    conclusions_text: str | None = None
    final_dispositions_text: str | None = None
    status: str | None = None


class AuditReportRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    client_id: UUID
    template_id: UUID
    created_by_user_id: UUID | None
    approved_by_user_id: UUID | None
    source_diagnostic_id: UUID | None
    report_year: int
    report_code: str | None
    status: str
    entity_name: str
    auditor_organization: str | None
    audited_area: str | None
    audit_date: date | None
    tipo_auditoria: str | None
    modalidad: str | None
    audited_facilities: str | None
    quality_responsible_name: str | None
    manager_name: str | None
    reference_standard: str
    reference_standard_revision: str | None
    audit_budget_code: str | None
    system_scope: str | None
    audit_description: str | None
    conclusions_text: str | None
    final_dispositions_text: str | None
    last_generated_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportIntervieweeRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    full_name: str
    role_name: str | None
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportIntervieweeCreateRequest(BaseModel):
    full_name: str = Field(min_length=1)
    role_name: str | None = None
    sort_order: int | None = Field(default=0, ge=0)


class AuditReportSectionRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    section_code: str
    title: str
    sort_order: int
    auditor_notes: str | None
    ai_draft_text: str | None
    final_text: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportSectionUpdateRequest(BaseModel):
    auditor_notes: str | None = None
    ai_draft_text: str | None = None
    final_text: str | None = None
    status: str | None = None


class AuditReportItemRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    section_code: str
    item_code: str
    item_label: str
    value_text: str | None
    value_json: dict | list | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportItemInput(BaseModel):
    item_code: str = Field(min_length=1)
    item_label: str = Field(min_length=1)
    value_text: str | None = None
    value_json: dict | list | None = None
    sort_order: int | None = Field(default=0, ge=0)


class AuditReportSectionItemsUpsertRequest(BaseModel):
    items: list[AuditReportItemInput] = Field(default_factory=list)


class AuditInterestedPartiesDocumentRowInput(BaseModel):
    stakeholder_name: str | None = None
    needs: str | None = None
    expectations: str | None = None
    requirements: str | None = None
    risks: str | None = None
    opportunities: str | None = None
    actions: str | None = None
    # Deprecated compatibility field. Prefer needs/expectations.
    needs_expectations: str | None = None
    applies: bool = True
    observations: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class AuditInterestedPartiesDocumentUpsertRequest(BaseModel):
    code: str | None = Field(default="P09", min_length=1, max_length=32)
    status: str | None = Field(default="completed", min_length=1, max_length=32)
    rows: list[AuditInterestedPartiesDocumentRowInput] = Field(default_factory=list)


class AuditInterestedPartiesDocumentRowRead(BaseModel):
    id: UUID
    document_id: UUID
    stakeholder_name: str
    needs: str | None
    expectations: str | None
    requirements: str | None
    risks: str | None
    opportunities: str | None
    actions: str | None
    # Deprecated compatibility field. Prefer needs/expectations.
    needs_expectations: str | None
    applies: bool
    observations: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditInterestedPartiesDocumentRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    code: str
    revision_number: int
    revision_label: str
    document_date: date | None
    status: str
    rows: list[AuditInterestedPartiesDocumentRowRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditContextDocumentRowInput(BaseModel):
    context_group: str | None = None
    environment: str | None = None
    risks: str | None = None
    opportunities: str | None = None
    actions: str | None = None
    observations: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class AuditContextDocumentUpsertRequest(BaseModel):
    code: str | None = Field(default="P09", min_length=1, max_length=32)
    status: str | None = Field(default="completed", min_length=1, max_length=32)
    reviewed_by: str | None = None
    approved_by: str | None = None
    rows: list[AuditContextDocumentRowInput] = Field(default_factory=list)


class AuditContextDocumentRowRead(BaseModel):
    id: UUID
    document_id: UUID
    context_group: str
    environment: str
    risks: str | None
    opportunities: str | None
    actions: str | None
    observations: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditContextDocumentRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    code: str
    revision_number: int
    revision_label: str
    document_date: date | None
    reviewed_by: str | None
    approved_by: str | None
    status: str
    rows: list[AuditContextDocumentRowRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditRiskOpportunityDocumentRowInput(BaseModel):
    row_id: UUID | None = None
    row_type: str | None = None
    swot_category: str | None = None
    description: str | None = None
    process_name: str | None = None
    impact: str | None = None
    probability: str | None = None
    severity: str | None = None
    viability: int | None = None
    attractiveness: int | None = None
    benefit: str | None = None
    action: str | None = None
    responsible: str | None = None
    follow_up_status: str | None = None
    follow_up_date: date | None = None
    source_key: str | None = None
    reference_kind: str | None = None
    reference_row_id: UUID | None = None
    action_type: str | None = None
    indicator: str | None = None
    due_date: date | None = None
    action_result: str | None = None
    is_auto_generated: bool | None = False
    sort_order: int | None = Field(default=None, ge=0)


class AuditRiskOpportunityDocumentUpsertRequest(BaseModel):
    code: str | None = Field(default="P09", min_length=1, max_length=32)
    status: str | None = Field(default="completed", min_length=1, max_length=32)
    rows: list[AuditRiskOpportunityDocumentRowInput] = Field(default_factory=list)


class AuditRiskOpportunityDocumentRowRead(BaseModel):
    id: UUID
    document_id: UUID
    row_type: str
    swot_category: str | None
    description: str | None
    process_name: str | None
    impact: str | None
    probability: str | None
    severity: str | None
    viability: int | None
    attractiveness: int | None
    benefit: str | None
    action: str | None
    responsible: str | None
    follow_up_status: str | None
    follow_up_date: date | None
    source_key: str | None
    reference_kind: str | None
    reference_row_id: UUID | None
    action_type: str | None
    indicator: str | None
    due_date: date | None
    action_result: str | None
    is_auto_generated: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditRiskOpportunityDocumentRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    code: str
    revision_number: int
    revision_label: str
    document_date: date | None
    status: str
    rows: list[AuditRiskOpportunityDocumentRowRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportClauseCheckRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    section_code: str
    clause_code: str
    clause_title: str
    applicable: bool
    clause_status: str
    evidence_summary: str | None
    observation_text: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportClauseCheckInput(BaseModel):
    clause_code: str = Field(min_length=1)
    applicable: bool = True
    clause_status: str = Field(default="compliant", min_length=1)
    evidence_summary: str | None = None
    observation_text: str | None = None
    sort_order: int | None = Field(default=0, ge=0)


class AuditReportClauseChecksUpsertRequest(BaseModel):
    clause_checks: list[AuditReportClauseCheckInput] = Field(default_factory=list)


class AuditReportRecommendationRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    client_id: UUID
    consultancy_id: UUID
    section_code: str | None
    recommendation_year: int
    source_audit_report_id: UUID | None
    recommendation_type: str
    priority: str
    body_text: str
    followup_comment: str | None
    recommendation_status: str
    carried_from_previous: bool
    generated_by_ai: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportRecommendationCreateRequest(BaseModel):
    section_code: str | None = None
    recommendation_type: str = Field(default="recommendation")
    priority: str = Field(default="medium")
    body_text: str = Field(min_length=1)
    followup_comment: str | None = None
    recommendation_status: str = Field(default="new")
    carried_from_previous: bool = False


class AuditReportRecommendationUpdateRequest(BaseModel):
    section_code: str | None = None
    recommendation_type: str | None = None
    priority: str | None = None
    body_text: str | None = None
    followup_comment: str | None = None
    recommendation_status: str | None = None
    carried_from_previous: bool | None = None


class AuditReportAnnexRead(BaseModel):
    id: UUID
    audit_report_id: UUID
    annex_code: str | None
    title: str
    file_url: str | None
    notes: str | None
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditReportAnnexCreateRequest(BaseModel):
    annex_code: str | None = None
    title: str = Field(min_length=1)
    file_url: str | None = None
    notes: str | None = None
    sort_order: int | None = Field(default=0, ge=0)


class AuditReportAnnexUpdateRequest(BaseModel):
    annex_code: str | None = None
    title: str | None = Field(default=None, min_length=1)
    file_url: str | None = None
    notes: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class AuditComplianceBlockRead(BaseModel):
    block_code: str
    block_title: str
    section_code: str
    status: str
    required_fields: list[str]
    completed_fields: list[str]
    missing_fields: list[str]


class AuditReportComplianceRead(BaseModel):
    report_id: UUID
    overall_status: str
    completed_blocks: int
    total_blocks: int
    blocks: list[AuditComplianceBlockRead]


class AuditRecommendationHistoryItem(BaseModel):
    id: UUID
    audit_report_id: UUID
    source_audit_report_id: UUID | None
    report_year: int
    report_code: str | None
    recommendation_year: int
    recommendation_type: str
    priority: str
    section_code: str | None
    body_text: str
    followup_comment: str | None
    recommendation_status: str
    carried_from_previous: bool
    created_at: datetime
    updated_at: datetime


class AuditReportDetailResponse(BaseModel):
    report: AuditReportRead
    client: AuditClientBasic
    interviewees: list[AuditReportIntervieweeRead]
    sections: list[AuditReportSectionRead]
    items: list[AuditReportItemRead]
    clause_checks: list[AuditReportClauseCheckRead]
    recommendations: list[AuditReportRecommendationRead]
    annexes: list[AuditReportAnnexRead]


class AuditIsoWorkbenchSummaryRead(BaseModel):
    report_id: UUID
    client_id: UUID
    report_year: int
    context_profile_completed: bool
    interested_parties_active: int
    quality_policies_active: int
    role_assignments_active: int
    process_map_items_active: int
    objectives_total: int
    objectives_linked_to_kpi: int
    kpis_total: int
    kpis_alert_or_critical: int
    risks_open: int
    suppliers_critical: int
    customer_feedback_total: int
    customer_feedback_average: float | None
    recommendations_total: int
    nonconformities_from_audit_total: int
    nonconformities_from_audit_open: int
    improvements_from_audit_total: int
    management_reviews_linked_total: int
    missing_tables: list[str]
