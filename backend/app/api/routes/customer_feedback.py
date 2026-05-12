import logging
from contextlib import contextmanager
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.crud.customer_feedback import (
    CUSTOMER_FEEDBACK_TYPE_VALUES,
    MAX_SCORE,
    MIN_SCORE,
    create_customer_feedback,
    delete_customer_feedback,
    get_customer_feedback_or_none,
    get_customer_feedback_summary,
    list_customer_feedback,
    update_customer_feedback,
)
from app.db.session import get_db
from app.models.client import Client
from app.models.customer_feedback import CustomerFeedback
from app.schemas.customer_feedback import (
    CustomerFeedbackCreateRequest,
    CustomerFeedbackListItem,
    CustomerFeedbackRead,
    CustomerFeedbackSummaryRead,
    CustomerFeedbackUpdateRequest,
)

router = APIRouter(tags=["customer_feedback"])
logger = logging.getLogger(__name__)


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _normalize_feedback_type_filter(feedback_type_filter: str | None) -> str | None:
    if feedback_type_filter is None:
        return None
    normalized = feedback_type_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in CUSTOMER_FEEDBACK_TYPE_VALUES:
        allowed = ", ".join(sorted(CUSTOMER_FEEDBACK_TYPE_VALUES))
        raise HTTPException(status_code=400, detail=f"type inválido. Valores permitidos: {allowed}")
    return normalized


def _validate_date_range(
    *,
    from_value: date | None,
    to_value: date | None,
    from_field: str,
    to_field: str,
) -> None:
    if from_value is not None and to_value is not None and from_value > to_value:
        raise HTTPException(status_code=400, detail=f"{from_field} no puede ser mayor que {to_field}")


def _validate_score_range(*, score_min: int | None, score_max: int | None) -> None:
    if score_min is not None and (score_min < MIN_SCORE or score_min > MAX_SCORE):
        raise HTTPException(
            status_code=400,
            detail=f"score_min debe estar entre {MIN_SCORE} y {MAX_SCORE}",
        )
    if score_max is not None and (score_max < MIN_SCORE or score_max > MAX_SCORE):
        raise HTTPException(
            status_code=400,
            detail=f"score_max debe estar entre {MIN_SCORE} y {MAX_SCORE}",
        )
    if score_min is not None and score_max is not None and score_min > score_max:
        raise HTTPException(status_code=400, detail="score_min no puede ser mayor que score_max")


def _raise_if_customer_feedback_table_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and "customer_feedback" in message:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migración de Satisfacción del Cliente. "
                "Ejecuta docs/sql/phase8_customer_satisfaction.sql."
            ),
        ) from exc


def _ensure_client_belongs_to_consultancy(
    db: Session,
    *,
    consultancy_id: UUID,
    client_id: UUID,
) -> None:
    client_exists = db.scalar(
        select(Client.id).where(
            Client.id == client_id,
            Client.consultancy_id == consultancy_id,
        )
    )
    if client_exists is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado para esta consultoria")


def _get_feedback_or_404(
    db: Session,
    *,
    consultancy_id: UUID,
    feedback_id: UUID,
) -> CustomerFeedback:
    feedback = get_customer_feedback_or_none(
        db,
        consultancy_id=consultancy_id,
        feedback_id=feedback_id,
    )
    if feedback is None:
        raise HTTPException(status_code=404, detail="Registro de satisfacción no encontrado")
    return feedback


@router.get("/customer-feedback/summary", response_model=CustomerFeedbackSummaryRead)
def get_customer_feedback_summary_endpoint(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> CustomerFeedbackSummaryRead:
    try:
        summary = get_customer_feedback_summary(db, consultancy_id=auth.consultancy.id)
        return CustomerFeedbackSummaryRead(
            total_feedback=summary.total_feedback,
            average_score=summary.average_score,
            satisfied_count=summary.satisfied_count,
            neutral_count=summary.neutral_count,
            unsatisfied_count=summary.unsatisfied_count,
            score_5_count=summary.score_5_count,
            score_4_count=summary.score_4_count,
            score_3_count=summary.score_3_count,
            score_2_count=summary.score_2_count,
            score_1_count=summary.score_1_count,
            latest_feedback_date=summary.latest_feedback_date,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading customer feedback summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el resumen.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_customer_feedback_table_missing(exc)
        logger.exception("Database error while loading customer feedback summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resumen") from exc


@router.get("/customer-feedback", response_model=list[CustomerFeedbackListItem])
def get_customer_feedback_endpoint(
    client_id: UUID | None = Query(default=None),
    feedback_type_filter: str | None = Query(default=None, alias="type"),
    feedback_date_from: date | None = Query(default=None),
    feedback_date_to: date | None = Query(default=None),
    score_min: int | None = Query(default=None),
    score_max: int | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[CustomerFeedback]:
    try:
        normalized_type = _normalize_feedback_type_filter(feedback_type_filter)
        _validate_date_range(
            from_value=feedback_date_from,
            to_value=feedback_date_to,
            from_field="feedback_date_from",
            to_field="feedback_date_to",
        )
        _validate_score_range(score_min=score_min, score_max=score_max)
        return list_customer_feedback(
            db,
            consultancy_id=auth.consultancy.id,
            client_id=client_id,
            feedback_type=normalized_type,
            feedback_date_from=feedback_date_from,
            feedback_date_to=feedback_date_to,
            score_min=score_min,
            score_max=score_max,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing customer feedback")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar feedback.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_customer_feedback_table_missing(exc)
        logger.exception("Database error while listing customer feedback")
        raise HTTPException(status_code=500, detail="No se pudo listar el feedback") from exc


@router.post(
    "/customer-feedback",
    response_model=CustomerFeedbackRead,
    status_code=status.HTTP_201_CREATED,
)
def post_customer_feedback(
    payload: CustomerFeedbackCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> CustomerFeedback:
    try:
        _ensure_client_belongs_to_consultancy(
            db,
            consultancy_id=auth.consultancy.id,
            client_id=payload.client_id,
        )
        with _transaction_scope(db):
            feedback = create_customer_feedback(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                client_id=payload.client_id,
                feedback_date=payload.feedback_date,
                score=payload.score,
                comment=payload.comment,
                feedback_type=payload.feedback_type,
            )
        db.refresh(feedback)
        return feedback
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating customer feedback")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_customer_feedback_table_missing(exc)
        logger.exception("Database error while creating customer feedback")
        raise HTTPException(status_code=500, detail="No se pudo crear el registro") from exc


@router.get("/customer-feedback/{feedback_id}", response_model=CustomerFeedbackRead)
def get_customer_feedback_item(
    feedback_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> CustomerFeedback:
    try:
        return _get_feedback_or_404(
            db,
            consultancy_id=auth.consultancy.id,
            feedback_id=feedback_id,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading customer feedback")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_customer_feedback_table_missing(exc)
        logger.exception("Database error while loading customer feedback")
        raise HTTPException(status_code=500, detail="No se pudo cargar el registro") from exc


@router.patch("/customer-feedback/{feedback_id}", response_model=CustomerFeedbackRead)
def patch_customer_feedback(
    feedback_id: UUID,
    payload: CustomerFeedbackUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> CustomerFeedback:
    try:
        data = payload.model_dump(exclude_unset=True)
        if "client_id" in data:
            _ensure_client_belongs_to_consultancy(
                db,
                consultancy_id=auth.consultancy.id,
                client_id=data["client_id"],
            )

        with _transaction_scope(db):
            feedback = _get_feedback_or_404(
                db,
                consultancy_id=auth.consultancy.id,
                feedback_id=feedback_id,
            )
            if data:
                update_customer_feedback(
                    db,
                    feedback=feedback,
                    updated_by_user_id=auth.user.id,
                    data=data,
                )
        db.refresh(feedback)
        return feedback
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating customer feedback")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_customer_feedback_table_missing(exc)
        logger.exception("Database error while updating customer feedback")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el registro") from exc


@router.delete("/customer-feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_customer_feedback(
    feedback_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            feedback = _get_feedback_or_404(
                db,
                consultancy_id=auth.consultancy.id,
                feedback_id=feedback_id,
            )
            delete_customer_feedback(db, feedback=feedback)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting customer feedback")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_customer_feedback_table_missing(exc)
        logger.exception("Database error while deleting customer feedback")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el registro") from exc

