import logging
from contextlib import contextmanager
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.crud.management_review import (
    MANAGEMENT_REVIEW_STATUS_VALUES,
    ReviewReferenceCounters,
    create_management_review,
    delete_management_review,
    get_management_review_or_none,
    get_management_review_summary,
    list_management_review_references,
    list_management_reviews,
    replace_management_review_references,
    update_management_review,
)
from app.db.session import get_db
from app.models.management_review import ManagementReview
from app.models.management_review_reference import ManagementReviewReference
from app.schemas.management_review import (
    ManagementReviewCreateRequest,
    ManagementReviewDetailResponse,
    ManagementReviewListItem,
    ManagementReviewRead,
    ManagementReviewReferenceRead,
    ManagementReviewSummaryRead,
    ManagementReviewUpdateRequest,
)

router = APIRouter(tags=["management_reviews"])
logger = logging.getLogger(__name__)


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _normalize_followup_status_filter(status_filter: str | None) -> str | None:
    if status_filter is None:
        return None
    normalized = status_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in MANAGEMENT_REVIEW_STATUS_VALUES:
        allowed = ", ".join(sorted(MANAGEMENT_REVIEW_STATUS_VALUES))
        raise HTTPException(
            status_code=400,
            detail=f"status inválido. Valores permitidos: {allowed}",
        )
    return normalized


def _validate_date_range(
    *,
    from_value: date | None,
    to_value: date | None,
    from_field: str,
    to_field: str,
) -> None:
    if from_value is not None and to_value is not None and from_value > to_value:
        raise HTTPException(
            status_code=400,
            detail=f"{from_field} no puede ser mayor que {to_field}",
        )


def _raise_if_management_review_tables_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and (
        "management_reviews" in message or "management_review_references" in message
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migración de Revisión por la Dirección. "
                "Ejecuta docs/sql/phase6_management_reviews.sql."
            ),
        ) from exc
    if (
        "management_review_references" in message
        and "ck_management_review_references_reference_type" in message
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "La base de datos no tiene tipos de referencia ampliados para Revision por la Direccion. "
                "Ejecuta docs/sql/phase10_iso_integration.sql."
            ),
        ) from exc


def _get_review_or_404(db: Session, *, consultancy_id: UUID, review_id: UUID) -> ManagementReview:
    review = get_management_review_or_none(db, consultancy_id=consultancy_id, review_id=review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Revision por la dirección no encontrada")
    return review


def _build_reference_counters(references: list[ManagementReviewReference]) -> ReviewReferenceCounters:
    audits = 0
    kpis = 0
    nonconformities = 0
    improvements = 0
    risks = 0
    customer_feedback = 0
    suppliers = 0
    for ref in references:
        if ref.reference_type == "audit_report":
            audits += 1
        elif ref.reference_type == "kpi_indicator":
            kpis += 1
        elif ref.reference_type == "non_conformity":
            nonconformities += 1
        elif ref.reference_type == "improvement_opportunity":
            improvements += 1
        elif ref.reference_type == "risk_opportunity":
            risks += 1
        elif ref.reference_type == "customer_feedback":
            customer_feedback += 1
        elif ref.reference_type == "supplier":
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


def _serialize_review_detail(
    *,
    review: ManagementReview,
    references: list[ManagementReviewReference],
) -> ManagementReviewDetailResponse:
    counters = _build_reference_counters(references)
    return ManagementReviewDetailResponse(
        review=ManagementReviewRead.model_validate(review),
        references=[ManagementReviewReferenceRead.model_validate(ref) for ref in references],
        linked_audit_reports_count=counters.audits,
        linked_kpis_count=counters.kpis,
        linked_nonconformities_count=counters.nonconformities,
        linked_improvement_opportunities_count=counters.improvements,
        linked_risks_count=counters.risks,
        linked_customer_feedback_count=counters.customer_feedback,
        linked_suppliers_count=counters.suppliers,
    )


def _load_list_counters(
    db: Session,
    *,
    consultancy_id: UUID,
    review_ids: list[UUID],
) -> dict[UUID, ReviewReferenceCounters]:
    counters_map: dict[UUID, ReviewReferenceCounters] = {}
    if not review_ids:
        return counters_map

    rows = db.execute(
        select(
            ManagementReviewReference.management_review_id,
            ManagementReviewReference.reference_type,
            func.count(ManagementReviewReference.id),
        )
        .where(
            ManagementReviewReference.consultancy_id == consultancy_id,
            ManagementReviewReference.management_review_id.in_(review_ids),
        )
        .group_by(
            ManagementReviewReference.management_review_id,
            ManagementReviewReference.reference_type,
        )
    ).all()
    bucket: dict[UUID, dict[str, int]] = {}
    for review_id, reference_type, count in rows:
        if review_id not in bucket:
            bucket[review_id] = {
                "audit_report": 0,
                "kpi_indicator": 0,
                "non_conformity": 0,
                "improvement_opportunity": 0,
                "risk_opportunity": 0,
                "customer_feedback": 0,
                "supplier": 0,
            }
        bucket[review_id][str(reference_type)] = int(count)

    for review_id in review_ids:
        values = bucket.get(
            review_id,
            {
                "audit_report": 0,
                "kpi_indicator": 0,
                "non_conformity": 0,
                "improvement_opportunity": 0,
                "risk_opportunity": 0,
                "customer_feedback": 0,
                "supplier": 0,
            },
        )
        counters_map[review_id] = ReviewReferenceCounters(
            audits=values["audit_report"],
            kpis=values["kpi_indicator"],
            nonconformities=values["non_conformity"],
            improvements=values["improvement_opportunity"],
            risks=values["risk_opportunity"],
            customer_feedback=values["customer_feedback"],
            suppliers=values["supplier"],
        )
    return counters_map


@router.get("/management-reviews/summary", response_model=ManagementReviewSummaryRead)
def get_management_reviews_summary(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> ManagementReviewSummaryRead:
    try:
        summary = get_management_review_summary(db, consultancy_id=auth.consultancy.id)
        return ManagementReviewSummaryRead(
            total_reviews=summary.total_reviews,
            pending_reviews=summary.pending_reviews,
            in_progress_reviews=summary.in_progress_reviews,
            completed_reviews=summary.completed_reviews,
            latest_review_date=summary.latest_review_date,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading management reviews summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar resumen de revisiones.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_management_review_tables_missing(exc)
        logger.exception("Database error while loading management reviews summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resumen de revisiones") from exc


@router.get("/management-reviews", response_model=list[ManagementReviewListItem])
def get_management_reviews(
    status_filter: str | None = Query(default=None, alias="status"),
    review_date_from: date | None = Query(default=None),
    review_date_to: date | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[ManagementReviewListItem]:
    try:
        normalized_status = _normalize_followup_status_filter(status_filter)
        _validate_date_range(
            from_value=review_date_from,
            to_value=review_date_to,
            from_field="review_date_from",
            to_field="review_date_to",
        )
        reviews = list_management_reviews(
            db,
            consultancy_id=auth.consultancy.id,
            followup_status=normalized_status,
            review_date_from=review_date_from,
            review_date_to=review_date_to,
        )
        review_ids = [review.id for review in reviews]
        counters_map = _load_list_counters(
            db,
            consultancy_id=auth.consultancy.id,
            review_ids=review_ids,
        )

        result: list[ManagementReviewListItem] = []
        for review in reviews:
            counters = counters_map.get(
                review.id,
                ReviewReferenceCounters(
                    audits=0,
                    kpis=0,
                    nonconformities=0,
                    improvements=0,
                    risks=0,
                    customer_feedback=0,
                    suppliers=0,
                ),
            )
            result.append(
                ManagementReviewListItem(
                    id=review.id,
                    review_date=review.review_date,
                    reviewed_period=review.reviewed_period,
                    responsible_name=review.responsible_name,
                    followup_status=review.followup_status,
                    created_at=review.created_at,
                    updated_at=review.updated_at,
                    linked_audit_reports_count=counters.audits,
                    linked_kpis_count=counters.kpis,
                    linked_nonconformities_count=counters.nonconformities,
                    linked_improvement_opportunities_count=counters.improvements,
                    linked_risks_count=counters.risks,
                    linked_customer_feedback_count=counters.customer_feedback,
                    linked_suppliers_count=counters.suppliers,
                )
            )
        return result
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing management reviews")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar revisiones.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_management_review_tables_missing(exc)
        logger.exception("Database error while listing management reviews")
        raise HTTPException(status_code=500, detail="No se pudieron listar las revisiones") from exc


@router.get("/management-reviews/{review_id}", response_model=ManagementReviewDetailResponse)
def get_management_review_detail(
    review_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> ManagementReviewDetailResponse:
    try:
        review = _get_review_or_404(db, consultancy_id=auth.consultancy.id, review_id=review_id)
        references = list_management_review_references(
            db,
            consultancy_id=auth.consultancy.id,
            review_id=review.id,
        )
        return _serialize_review_detail(review=review, references=references)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading management review detail")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar la revision.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_management_review_tables_missing(exc)
        logger.exception("Database error while loading management review detail")
        raise HTTPException(status_code=500, detail="No se pudo cargar la revision") from exc


@router.post(
    "/management-reviews",
    response_model=ManagementReviewDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_management_review(
    payload: ManagementReviewCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> ManagementReviewDetailResponse:
    try:
        references_payload = [item.model_dump() for item in payload.references]
        with _transaction_scope(db):
            review = create_management_review(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                review_date=payload.review_date,
                reviewed_period=payload.reviewed_period,
                summary=payload.summary,
                conclusions=payload.conclusions,
                decisions=payload.decisions,
                derived_actions=payload.derived_actions,
                responsible_name=payload.responsible_name,
                followup_status=payload.followup_status,
                followup_notes=payload.followup_notes,
                references=references_payload,
            )
        db.refresh(review)
        references = list_management_review_references(
            db,
            consultancy_id=auth.consultancy.id,
            review_id=review.id,
        )
        return _serialize_review_detail(review=review, references=references)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating management review")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear la revision.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_management_review_tables_missing(exc)
        logger.exception("Database error while creating management review")
        raise HTTPException(status_code=500, detail="No se pudo crear la revision") from exc


@router.patch("/management-reviews/{review_id}", response_model=ManagementReviewDetailResponse)
def patch_management_review(
    review_id: UUID,
    payload: ManagementReviewUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> ManagementReviewDetailResponse:
    try:
        data = payload.model_dump(exclude_unset=True)
        references_payload = data.pop("references", None)
        with _transaction_scope(db):
            review = _get_review_or_404(db, consultancy_id=auth.consultancy.id, review_id=review_id)
            if data:
                update_management_review(
                    db,
                    review=review,
                    updated_by_user_id=auth.user.id,
                    data=data,
                )
            if references_payload is not None:
                replace_management_review_references(
                    db,
                    consultancy_id=auth.consultancy.id,
                    review_id=review.id,
                    references=references_payload,
                )
        db.refresh(review)
        references = list_management_review_references(
            db,
            consultancy_id=auth.consultancy.id,
            review_id=review.id,
        )
        return _serialize_review_detail(review=review, references=references)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating management review")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar la revision.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_management_review_tables_missing(exc)
        logger.exception("Database error while updating management review")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la revision") from exc


@router.delete("/management-reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_management_review(
    review_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            review = _get_review_or_404(db, consultancy_id=auth.consultancy.id, review_id=review_id)
            delete_management_review(db, review=review)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting management review")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar la revision.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_management_review_tables_missing(exc)
        logger.exception("Database error while deleting management review")
        raise HTTPException(status_code=500, detail="No se pudo eliminar la revision") from exc


