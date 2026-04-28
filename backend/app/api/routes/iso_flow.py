import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, and_, cast, func, inspect, or_, select
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.db.session import get_db
from app.models.action_task import ActionTask
from app.models.audit_report import AuditReport
from app.models.audit_report_recommendation import AuditReportRecommendation
from app.models.client import Client
from app.models.customer_feedback import CustomerFeedback
from app.models.diagnostic import Diagnostic
from app.models.kpi_indicator import KpiIndicator
from app.models.management_review import ManagementReview
from app.models.iso_improvement import IsoImprovement
from app.models.iso_nonconformity import IsoNonconformity
from app.models.risk_opportunity import RiskOpportunity
from app.models.supplier import Supplier
from app.schemas.iso_flow import IsoFlowSummaryRead

router = APIRouter(tags=["iso_flow"])
logger = logging.getLogger(__name__)
_PUBLIC_TABLES_CACHE: set[str] | None = None


def _load_public_tables(db: Session) -> set[str]:
    global _PUBLIC_TABLES_CACHE
    if _PUBLIC_TABLES_CACHE is not None:
        return _PUBLIC_TABLES_CACHE
    inspector = inspect(db.get_bind())
    _PUBLIC_TABLES_CACHE = set(inspector.get_table_names(schema="public"))
    return _PUBLIC_TABLES_CACHE


def _diagnostic_scope_filter(auth: AuthContext):
    client_ids_subquery = select(Client.id).where(
        Client.consultancy_id == auth.consultancy.id
    )
    return or_(
        Diagnostic.client_id.in_(client_ids_subquery),
        and_(
            Diagnostic.client_id.is_(None),
            Diagnostic.created_by_user_id == auth.user.id,
        ),
    )


@router.get("/iso-flow/summary", response_model=IsoFlowSummaryRead)
def get_iso_flow_summary(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoFlowSummaryRead:
    try:
        consultancy_id = auth.consultancy.id
        tables = _load_public_tables(db)
        missing_tables: list[str] = []

        context_clients_total = 0
        objectives_total_kpis = 0
        objectives_ok_kpis = 0
        objectives_alert_kpis = 0
        objectives_critical_kpis = 0
        risks_total = 0
        risks_open = 0
        opportunities_total = 0
        operation_suppliers_total = 0
        operation_suppliers_critical = 0
        audits_total = 0
        audits_open = 0
        audits_closed = 0
        nonconformities_total = 0
        corrective_actions_total = 0
        corrective_actions_open = 0
        customer_feedback_total = 0
        customer_feedback_average: float | None = None
        management_reviews_total = 0
        management_reviews_pending = 0
        management_reviews_in_progress = 0
        management_reviews_completed = 0
        last_management_review_date: date | None = None
        improvement_opportunities_total = 0

        if "clients" in tables:
            context_clients_total = int(
                db.scalar(
                    select(func.count(Client.id)).where(Client.consultancy_id == consultancy_id)
                )
                or 0
            )
        else:
            missing_tables.append("clients")

        if "kpi_indicators" in tables:
            kpi_row = db.execute(
                select(
                    func.count(KpiIndicator.id),
                    func.count(KpiIndicator.id).filter(KpiIndicator.status == "ok"),
                    func.count(KpiIndicator.id).filter(KpiIndicator.status == "alerta"),
                    func.count(KpiIndicator.id).filter(KpiIndicator.status == "critico"),
                ).where(KpiIndicator.consultancy_id == consultancy_id)
            ).one()
            objectives_total_kpis = int(kpi_row[0] or 0)
            objectives_ok_kpis = int(kpi_row[1] or 0)
            objectives_alert_kpis = int(kpi_row[2] or 0)
            objectives_critical_kpis = int(kpi_row[3] or 0)
        else:
            missing_tables.append("kpi_indicators")

        if "risk_opportunities" in tables:
            risk_row = db.execute(
                select(
                    func.count(RiskOpportunity.id).filter(
                        RiskOpportunity.item_type == "risk"
                    ),
                    func.count(RiskOpportunity.id).filter(
                        and_(
                            RiskOpportunity.item_type == "risk",
                            RiskOpportunity.status != "completed",
                        )
                    ),
                    func.count(RiskOpportunity.id).filter(
                        RiskOpportunity.item_type == "opportunity"
                    ),
                ).where(RiskOpportunity.consultancy_id == consultancy_id)
            ).one()
            risks_total = int(risk_row[0] or 0)
            risks_open = int(risk_row[1] or 0)
            opportunities_total = int(risk_row[2] or 0)
        else:
            missing_tables.append("risk_opportunities")

        if "suppliers" in tables:
            suppliers_row = db.execute(
                select(
                    func.count(Supplier.id),
                    func.count(Supplier.id).filter(Supplier.final_rating == "critical"),
                ).where(Supplier.consultancy_id == consultancy_id)
            ).one()
            operation_suppliers_total = int(suppliers_row[0] or 0)
            operation_suppliers_critical = int(suppliers_row[1] or 0)
        else:
            missing_tables.append("suppliers")

        if "audit_reports" in tables:
            audit_status_text = cast(AuditReport.status, String)
            audits_row = db.execute(
                select(
                    func.count(AuditReport.id),
                    func.count(AuditReport.id).filter(
                        audit_status_text.in_(["draft", "in_progress"])
                    ),
                    func.count(AuditReport.id).filter(
                        audit_status_text.in_(["completed", "approved", "closed"])
                    ),
                ).where(AuditReport.consultancy_id == consultancy_id)
            ).one()
            audits_total = int(audits_row[0] or 0)
            audits_open = int(audits_row[1] or 0)
            audits_closed = int(audits_row[2] or 0)
        else:
            missing_tables.append("audit_reports")

        if "iso_nonconformities" in tables:
            nc_row = db.execute(
                select(
                    func.count(IsoNonconformity.id),
                    func.count(IsoNonconformity.id).filter(
                        IsoNonconformity.corrective_action.is_not(None)
                    ),
                    func.count(IsoNonconformity.id).filter(
                        IsoNonconformity.status != "closed"
                    ),
                ).where(IsoNonconformity.consultancy_id == consultancy_id)
            ).one()
            nonconformities_total = int(nc_row[0] or 0)
            corrective_actions_total = int(nc_row[1] or 0)
            corrective_actions_open = int(nc_row[2] or 0)
        elif "audit_report_recommendations" in tables:
            nonconformities_total = int(
                db.scalar(
                    select(func.count(AuditReportRecommendation.id)).where(
                        AuditReportRecommendation.consultancy_id == consultancy_id,
                        AuditReportRecommendation.recommendation_type == "non_conformity",
                    )
                )
                or 0
            )
        else:
            missing_tables.extend(["iso_nonconformities", "audit_report_recommendations"])

        if "iso_improvements" in tables:
            improvement_opportunities_total = int(
                db.scalar(
                    select(func.count(IsoImprovement.id)).where(
                        IsoImprovement.consultancy_id == consultancy_id
                    )
                )
                or 0
            )
        elif "audit_report_recommendations" in tables:
            improvement_opportunities_total = int(
                db.scalar(
                    select(func.count(AuditReportRecommendation.id)).where(
                        AuditReportRecommendation.consultancy_id == consultancy_id,
                        AuditReportRecommendation.recommendation_type.in_(
                            ["recommendation", "observation", "improvement_opportunity"]
                        ),
                    )
                )
                or 0
            )
        else:
            missing_tables.extend(["iso_improvements", "audit_report_recommendations"])

        if corrective_actions_total == 0 and "action_tasks" in tables and "diagnostics" in tables and "clients" in tables:
            tasks_row = db.execute(
                select(
                    func.count(ActionTask.id),
                    func.count(ActionTask.id).filter(
                        ActionTask.status.in_(["pending", "in_progress", "not_started"])
                    ),
                )
                .select_from(ActionTask)
                .join(Diagnostic, Diagnostic.id == ActionTask.diagnostic_id)
                .where(_diagnostic_scope_filter(auth))
            ).one()
            corrective_actions_total = int(tasks_row[0] or 0)
            corrective_actions_open = int(tasks_row[1] or 0)

        if "customer_feedback" in tables:
            feedback_row = db.execute(
                select(
                    func.count(CustomerFeedback.id),
                    func.avg(CustomerFeedback.score),
                ).where(CustomerFeedback.consultancy_id == consultancy_id)
            ).one()
            customer_feedback_total = int(feedback_row[0] or 0)
            customer_feedback_average = float(feedback_row[1]) if feedback_row[1] is not None else None
        else:
            missing_tables.append("customer_feedback")

        if "management_reviews" in tables:
            reviews_row = db.execute(
                select(
                    func.count(ManagementReview.id),
                    func.count(ManagementReview.id).filter(
                        ManagementReview.followup_status == "pending"
                    ),
                    func.count(ManagementReview.id).filter(
                        ManagementReview.followup_status == "in_progress"
                    ),
                    func.count(ManagementReview.id).filter(
                        ManagementReview.followup_status == "completed"
                    ),
                    func.max(ManagementReview.review_date),
                ).where(ManagementReview.consultancy_id == consultancy_id)
            ).one()
            management_reviews_total = int(reviews_row[0] or 0)
            management_reviews_pending = int(reviews_row[1] or 0)
            management_reviews_in_progress = int(reviews_row[2] or 0)
            management_reviews_completed = int(reviews_row[3] or 0)
            last_management_review_date = reviews_row[4]
        else:
            missing_tables.append("management_reviews")

        return IsoFlowSummaryRead(
            context_clients_total=context_clients_total,
            objectives_total_kpis=objectives_total_kpis,
            objectives_ok_kpis=objectives_ok_kpis,
            objectives_alert_kpis=objectives_alert_kpis,
            objectives_critical_kpis=objectives_critical_kpis,
            risks_total=risks_total,
            risks_open=risks_open,
            opportunities_total=opportunities_total,
            operation_suppliers_total=operation_suppliers_total,
            operation_suppliers_critical=operation_suppliers_critical,
            audits_total=audits_total,
            audits_open=audits_open,
            audits_closed=audits_closed,
            nonconformities_total=nonconformities_total,
            corrective_actions_total=corrective_actions_total,
            corrective_actions_open=corrective_actions_open,
            customer_feedback_total=customer_feedback_total,
            customer_feedback_average=customer_feedback_average,
            management_reviews_total=management_reviews_total,
            management_reviews_pending=management_reviews_pending,
            management_reviews_in_progress=management_reviews_in_progress,
            management_reviews_completed=management_reviews_completed,
            last_management_review_date=last_management_review_date,
            improvement_opportunities_total=improvement_opportunities_total,
            missing_tables=sorted(set(missing_tables)),
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading iso flow summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el flujo ISO.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while loading iso flow summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el flujo ISO") from exc
