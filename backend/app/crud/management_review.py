from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.audit_report import AuditReport
from app.models.audit_report_recommendation import AuditReportRecommendation
from app.models.client import Client
from app.models.customer_feedback import CustomerFeedback
from app.models.iso_improvement import IsoImprovement
from app.models.iso_nonconformity import IsoNonconformity
from app.models.kpi_indicator import KpiIndicator
from app.models.management_review import ManagementReview
from app.models.management_review_reference import ManagementReviewReference
from app.models.risk_opportunity import RiskOpportunity
from app.models.supplier import Supplier

MANAGEMENT_REVIEW_STATUS_PENDING = "pending"
MANAGEMENT_REVIEW_STATUS_IN_PROGRESS = "in_progress"
MANAGEMENT_REVIEW_STATUS_COMPLETED = "completed"
MANAGEMENT_REVIEW_STATUS_VALUES = {
    MANAGEMENT_REVIEW_STATUS_PENDING,
    MANAGEMENT_REVIEW_STATUS_IN_PROGRESS,
    MANAGEMENT_REVIEW_STATUS_COMPLETED,
}

REFERENCE_TYPE_AUDIT_REPORT = "audit_report"
REFERENCE_TYPE_KPI_INDICATOR = "kpi_indicator"
REFERENCE_TYPE_NON_CONFORMITY = "non_conformity"
REFERENCE_TYPE_IMPROVEMENT_OPPORTUNITY = "improvement_opportunity"
REFERENCE_TYPE_RISK_OPPORTUNITY = "risk_opportunity"
REFERENCE_TYPE_CUSTOMER_FEEDBACK = "customer_feedback"
REFERENCE_TYPE_SUPPLIER = "supplier"
MANAGEMENT_REVIEW_REFERENCE_TYPES = {
    REFERENCE_TYPE_AUDIT_REPORT,
    REFERENCE_TYPE_KPI_INDICATOR,
    REFERENCE_TYPE_NON_CONFORMITY,
    REFERENCE_TYPE_IMPROVEMENT_OPPORTUNITY,
    REFERENCE_TYPE_RISK_OPPORTUNITY,
    REFERENCE_TYPE_CUSTOMER_FEEDBACK,
    REFERENCE_TYPE_SUPPLIER,
}


@dataclass(frozen=True)
class ReviewReferenceCounters:
    audits: int
    kpis: int
    nonconformities: int
    improvements: int
    risks: int
    customer_feedback: int
    suppliers: int


@dataclass(frozen=True)
class ReviewSummaryCounters:
    total_reviews: int
    pending_reviews: int
    in_progress_reviews: int
    completed_reviews: int
    latest_review_date: date | None


def _normalize_required_text(value: str | None, field_name: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise ValueError(f"{field_name} es requerido")
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_followup_status(value: str | None) -> str:
    normalized = _normalize_required_text(value, "followup_status").lower()
    if normalized not in MANAGEMENT_REVIEW_STATUS_VALUES:
        allowed = ", ".join(sorted(MANAGEMENT_REVIEW_STATUS_VALUES))
        raise ValueError(f"followup_status invalido. Valores permitidos: {allowed}")
    return normalized


def _normalize_reference_type(value: str | None) -> str:
    normalized = _normalize_required_text(value, "reference_type").lower()
    if normalized not in MANAGEMENT_REVIEW_REFERENCE_TYPES:
        allowed = ", ".join(sorted(MANAGEMENT_REVIEW_REFERENCE_TYPES))
        raise ValueError(f"reference_type invalido. Valores permitidos: {allowed}")
    return normalized


def _truncate_text(value: str | None, max_length: int = 140) -> str | None:
    normalized = _normalize_optional_text(value)
    if normalized is None:
        return None
    if len(normalized) <= max_length:
        return normalized
    if max_length <= 3:
        return normalized[:max_length]
    return f"{normalized[: max_length - 3].rstrip()}..."


def _resolve_reference_source_label(
    db: Session,
    *,
    consultancy_id: UUID,
    reference_type: str,
    source_id: UUID,
) -> str:
    if reference_type == REFERENCE_TYPE_AUDIT_REPORT:
        row = db.execute(
            select(AuditReport.report_code, AuditReport.entity_name).where(
                AuditReport.id == source_id,
                AuditReport.consultancy_id == consultancy_id,
            )
        ).first()
        if row is None:
            raise ValueError("Referencia de auditoria no encontrada")
        report_code, entity_name = row
        return (report_code or entity_name or str(source_id)).strip()

    if reference_type == REFERENCE_TYPE_KPI_INDICATOR:
        kpi_name = db.scalar(
            select(KpiIndicator.name).where(
                KpiIndicator.id == source_id,
                KpiIndicator.consultancy_id == consultancy_id,
            )
        )
        if kpi_name is None:
            raise ValueError("Referencia de indicador no encontrada")
        return str(kpi_name).strip()

    if reference_type == REFERENCE_TYPE_RISK_OPPORTUNITY:
        risk_name = db.scalar(
            select(RiskOpportunity.name).where(
                RiskOpportunity.id == source_id,
                RiskOpportunity.consultancy_id == consultancy_id,
            )
        )
        if risk_name is None:
            raise ValueError("Referencia de riesgo/oportunidad no encontrada")
        return str(risk_name).strip()

    if reference_type == REFERENCE_TYPE_CUSTOMER_FEEDBACK:
        row = db.execute(
            select(
                Client.name,
                CustomerFeedback.feedback_date,
                CustomerFeedback.score,
            )
            .join(Client, Client.id == CustomerFeedback.client_id)
            .where(
                CustomerFeedback.id == source_id,
                CustomerFeedback.consultancy_id == consultancy_id,
            )
        ).first()
        if row is None:
            raise ValueError("Referencia de satisfaccion del cliente no encontrada")
        client_name, feedback_date, score = row
        date_label = feedback_date.isoformat() if feedback_date is not None else ""
        return f"{(client_name or 'Cliente').strip()} ({date_label}) score {score}/5".strip()

    if reference_type == REFERENCE_TYPE_SUPPLIER:
        row = db.execute(
            select(Supplier.name, Supplier.service_category).where(
                Supplier.id == source_id,
                Supplier.consultancy_id == consultancy_id,
            )
        ).first()
        if row is None:
            raise ValueError("Referencia de proveedor no encontrada")
        supplier_name, service_category = row
        if service_category:
            return f"{supplier_name} - {service_category}".strip()
        return str(supplier_name or source_id).strip()

    if reference_type in {REFERENCE_TYPE_NON_CONFORMITY, REFERENCE_TYPE_IMPROVEMENT_OPPORTUNITY}:
        try:
            if reference_type == REFERENCE_TYPE_NON_CONFORMITY:
                nc_title = db.scalar(
                    select(IsoNonconformity.title).where(
                        IsoNonconformity.id == source_id,
                        IsoNonconformity.consultancy_id == consultancy_id,
                    )
                )
                if nc_title is not None:
                    return str(nc_title).strip()
            else:
                improvement_title = db.scalar(
                    select(IsoImprovement.title).where(
                        IsoImprovement.id == source_id,
                        IsoImprovement.consultancy_id == consultancy_id,
                    )
                )
                if improvement_title is not None:
                    return str(improvement_title).strip()
        except SQLAlchemyError:
            # Si la fase 11 no esta aplicada aun, se mantiene fallback legacy.
            pass

    row = db.execute(
        select(
            AuditReportRecommendation.recommendation_type,
            AuditReportRecommendation.body_text,
        ).where(
            AuditReportRecommendation.id == source_id,
            AuditReportRecommendation.consultancy_id == consultancy_id,
        )
    ).first()
    if row is None:
        raise ValueError("Referencia de recomendacion/no conformidad no encontrada")

    recommendation_type, body_text = row
    normalized_type = str(recommendation_type or "").strip().lower()
    if reference_type == REFERENCE_TYPE_NON_CONFORMITY and normalized_type != "non_conformity":
        raise ValueError("La referencia no corresponde a una no conformidad")
    if reference_type == REFERENCE_TYPE_IMPROVEMENT_OPPORTUNITY and normalized_type not in {
        "recommendation",
        "observation",
        "improvement_opportunity",
    }:
        raise ValueError("La referencia no corresponde a una oportunidad de mejora")

    return _truncate_text(body_text, max_length=140) or str(source_id)


def _build_reference_counters(references: list[ManagementReviewReference]) -> ReviewReferenceCounters:
    audits = 0
    kpis = 0
    nonconformities = 0
    improvements = 0
    risks = 0
    customer_feedback = 0
    suppliers = 0
    for ref in references:
        if ref.reference_type == REFERENCE_TYPE_AUDIT_REPORT:
            audits += 1
        elif ref.reference_type == REFERENCE_TYPE_KPI_INDICATOR:
            kpis += 1
        elif ref.reference_type == REFERENCE_TYPE_NON_CONFORMITY:
            nonconformities += 1
        elif ref.reference_type == REFERENCE_TYPE_IMPROVEMENT_OPPORTUNITY:
            improvements += 1
        elif ref.reference_type == REFERENCE_TYPE_RISK_OPPORTUNITY:
            risks += 1
        elif ref.reference_type == REFERENCE_TYPE_CUSTOMER_FEEDBACK:
            customer_feedback += 1
        elif ref.reference_type == REFERENCE_TYPE_SUPPLIER:
            suppliers += 1
    return ReviewReferenceCounters(
        audits=audits,
        kpis=kpis,
        nonconformities=nonconformities,
        improvements=improvements,
        risks=risks,
        customer_feedback=customer_feedback,
        suppliers=suppliers,
    )


def list_management_reviews(
    db: Session,
    *,
    consultancy_id: UUID,
    followup_status: str | None = None,
    review_date_from: date | None = None,
    review_date_to: date | None = None,
) -> list[ManagementReview]:
    query = select(ManagementReview).where(ManagementReview.consultancy_id == consultancy_id)
    if followup_status:
        query = query.where(ManagementReview.followup_status == followup_status)
    if review_date_from is not None:
        query = query.where(ManagementReview.review_date >= review_date_from)
    if review_date_to is not None:
        query = query.where(ManagementReview.review_date <= review_date_to)
    return list(
        db.scalars(
            query.order_by(ManagementReview.review_date.desc(), ManagementReview.created_at.desc())
        ).all()
    )


def get_management_review_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    review_id: UUID,
) -> ManagementReview | None:
    return db.scalar(
        select(ManagementReview).where(
            ManagementReview.id == review_id,
            ManagementReview.consultancy_id == consultancy_id,
        )
    )


def list_management_review_references(
    db: Session,
    *,
    consultancy_id: UUID,
    review_id: UUID,
) -> list[ManagementReviewReference]:
    return list(
        db.scalars(
            select(ManagementReviewReference)
            .where(
                ManagementReviewReference.consultancy_id == consultancy_id,
                ManagementReviewReference.management_review_id == review_id,
            )
            .order_by(
                ManagementReviewReference.reference_type.asc(),
                ManagementReviewReference.created_at.asc(),
            )
        ).all()
    )


def replace_management_review_references(
    db: Session,
    *,
    consultancy_id: UUID,
    review_id: UUID,
    references: list[dict],
) -> list[ManagementReviewReference]:
    seen: set[tuple[str, UUID]] = set()
    normalized_references: list[dict] = []
    for item in references:
        reference_type = _normalize_reference_type(item.get("reference_type"))
        source_id = item.get("source_id")
        if source_id is None:
            raise ValueError("source_id es requerido en cada referencia")
        key = (reference_type, source_id)
        if key in seen:
            raise ValueError(
                f"Referencia duplicada detectada: {reference_type}:{source_id}"
            )
        seen.add(key)
        source_label = _normalize_optional_text(item.get("source_label"))
        if source_label is None:
            source_label = _resolve_reference_source_label(
                db,
                consultancy_id=consultancy_id,
                reference_type=reference_type,
                source_id=source_id,
            )
        normalized_references.append(
            {
                "reference_type": reference_type,
                "source_id": source_id,
                "source_label": source_label,
            }
        )

    db.execute(
        delete(ManagementReviewReference).where(
            ManagementReviewReference.management_review_id == review_id,
            ManagementReviewReference.consultancy_id == consultancy_id,
        )
    )

    created: list[ManagementReviewReference] = []
    for item in normalized_references:
        ref = ManagementReviewReference(
            management_review_id=review_id,
            consultancy_id=consultancy_id,
            reference_type=item["reference_type"],
            source_id=item["source_id"],
            source_label=item["source_label"],
        )
        db.add(ref)
        created.append(ref)

    db.flush()
    return created


def create_management_review(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    review_date: date,
    reviewed_period: str,
    summary: str,
    conclusions: str,
    decisions: str,
    derived_actions: str,
    responsible_name: str,
    followup_status: str,
    followup_notes: str | None,
    references: list[dict],
) -> ManagementReview:
    review = ManagementReview(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        review_date=review_date,
        reviewed_period=_normalize_required_text(reviewed_period, "reviewed_period"),
        summary=_normalize_required_text(summary, "summary"),
        conclusions=_normalize_required_text(conclusions, "conclusions"),
        decisions=_normalize_required_text(decisions, "decisions"),
        derived_actions=_normalize_required_text(derived_actions, "derived_actions"),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        followup_status=_normalize_followup_status(followup_status),
        followup_notes=_normalize_optional_text(followup_notes),
    )
    db.add(review)
    db.flush()

    replace_management_review_references(
        db,
        consultancy_id=consultancy_id,
        review_id=review.id,
        references=references,
    )
    return review


def update_management_review(
    db: Session,
    *,
    review: ManagementReview,
    updated_by_user_id: UUID,
    data: dict,
) -> ManagementReview:
    if "review_date" in data:
        review.review_date = data["review_date"]
    if "reviewed_period" in data:
        review.reviewed_period = _normalize_required_text(data["reviewed_period"], "reviewed_period")
    if "summary" in data:
        review.summary = _normalize_required_text(data["summary"], "summary")
    if "conclusions" in data:
        review.conclusions = _normalize_required_text(data["conclusions"], "conclusions")
    if "decisions" in data:
        review.decisions = _normalize_required_text(data["decisions"], "decisions")
    if "derived_actions" in data:
        review.derived_actions = _normalize_required_text(data["derived_actions"], "derived_actions")
    if "responsible_name" in data:
        review.responsible_name = _normalize_required_text(
            data["responsible_name"],
            "responsible_name",
        )
    if "followup_status" in data:
        review.followup_status = _normalize_followup_status(data["followup_status"])
    if "followup_notes" in data:
        review.followup_notes = _normalize_optional_text(data["followup_notes"])

    review.updated_by_user_id = updated_by_user_id
    db.flush()
    return review


def delete_management_review(db: Session, *, review: ManagementReview) -> None:
    db.delete(review)
    db.flush()


def get_management_review_summary(
    db: Session,
    *,
    consultancy_id: UUID,
) -> ReviewSummaryCounters:
    rows = db.execute(
        select(ManagementReview.followup_status, func.count(ManagementReview.id))
        .where(ManagementReview.consultancy_id == consultancy_id)
        .group_by(ManagementReview.followup_status)
    ).all()
    counts: dict[str, int] = {status: 0 for status in MANAGEMENT_REVIEW_STATUS_VALUES}
    total = 0
    for status, count in rows:
        status_key = str(status or "").strip().lower()
        if status_key in counts:
            counts[status_key] = int(count)
            total += int(count)

    latest_review_date = db.scalar(
        select(func.max(ManagementReview.review_date)).where(
            ManagementReview.consultancy_id == consultancy_id
        )
    )
    return ReviewSummaryCounters(
        total_reviews=total,
        pending_reviews=counts[MANAGEMENT_REVIEW_STATUS_PENDING],
        in_progress_reviews=counts[MANAGEMENT_REVIEW_STATUS_IN_PROGRESS],
        completed_reviews=counts[MANAGEMENT_REVIEW_STATUS_COMPLETED],
        latest_review_date=latest_review_date,
    )


def get_review_reference_counters(
    db: Session,
    *,
    consultancy_id: UUID,
    review_id: UUID,
) -> ReviewReferenceCounters:
    references = list_management_review_references(
        db,
        consultancy_id=consultancy_id,
        review_id=review_id,
    )
    return _build_reference_counters(references)

