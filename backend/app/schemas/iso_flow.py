from datetime import date

from pydantic import BaseModel


class IsoFlowSummaryRead(BaseModel):
    context_clients_total: int
    objectives_total_kpis: int
    objectives_ok_kpis: int
    objectives_alert_kpis: int
    objectives_critical_kpis: int
    risks_total: int
    risks_open: int
    opportunities_total: int
    operation_suppliers_total: int
    operation_suppliers_critical: int
    audits_total: int
    audits_open: int
    audits_closed: int
    nonconformities_total: int
    corrective_actions_total: int
    corrective_actions_open: int
    customer_feedback_total: int
    customer_feedback_average: float | None
    management_reviews_total: int
    management_reviews_pending: int
    management_reviews_in_progress: int
    management_reviews_completed: int
    last_management_review_date: date | None
    improvement_opportunities_total: int
    missing_tables: list[str]
