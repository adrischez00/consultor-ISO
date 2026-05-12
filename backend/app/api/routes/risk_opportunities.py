import logging
from contextlib import contextmanager
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.crud.risk_opportunity import (
    RISK_OPPORTUNITY_LEVEL_VALUES,
    RISK_OPPORTUNITY_STATUS_VALUES,
    RISK_OPPORTUNITY_TYPE_VALUES,
    create_risk_opportunity,
    delete_risk_opportunity,
    get_risk_opportunity_or_none,
    get_risk_opportunity_summary,
    list_risk_opportunities,
    update_risk_opportunity,
)
from app.db.session import get_db
from app.models.risk_opportunity import RiskOpportunity
from app.schemas.risk_opportunity import (
    RiskOpportunityCreateRequest,
    RiskOpportunityListItem,
    RiskOpportunityRead,
    RiskOpportunitySummaryRead,
    RiskOpportunityUpdateRequest,
)

router = APIRouter(tags=["risk_opportunities"])
logger = logging.getLogger(__name__)


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _raise_if_risk_table_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and "risk_opportunities" in message:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migración de Riesgos y Oportunidades. "
                "Ejecuta docs/sql/phase7_risk_opportunities.sql."
            ),
        ) from exc


def _normalize_item_type_filter(item_type: str | None) -> str | None:
    if item_type is None:
        return None
    normalized = item_type.strip().lower()
    if not normalized:
        return None
    if normalized not in RISK_OPPORTUNITY_TYPE_VALUES:
        allowed = ", ".join(sorted(RISK_OPPORTUNITY_TYPE_VALUES))
        raise HTTPException(status_code=400, detail=f"type inválido. Valores permitidos: {allowed}")
    return normalized


def _normalize_status_filter(status_filter: str | None) -> str | None:
    if status_filter is None:
        return None
    normalized = status_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in RISK_OPPORTUNITY_STATUS_VALUES:
        allowed = ", ".join(sorted(RISK_OPPORTUNITY_STATUS_VALUES))
        raise HTTPException(status_code=400, detail=f"status inválido. Valores permitidos: {allowed}")
    return normalized


def _normalize_level_filter(level_filter: str | None) -> str | None:
    if level_filter is None:
        return None
    normalized = level_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in RISK_OPPORTUNITY_LEVEL_VALUES:
        allowed = ", ".join(sorted(RISK_OPPORTUNITY_LEVEL_VALUES))
        raise HTTPException(status_code=400, detail=f"level inválido. Valores permitidos: {allowed}")
    return normalized


def _get_item_or_404(db: Session, *, consultancy_id: UUID, item_id: UUID) -> RiskOpportunity:
    item = get_risk_opportunity_or_none(db, consultancy_id=consultancy_id, item_id=item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Riesgo u oportunidad no encontrado")
    return item


@router.get("/risk-opportunities/summary", response_model=RiskOpportunitySummaryRead)
def get_risk_opportunities_summary(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> RiskOpportunitySummaryRead:
    try:
        summary = get_risk_opportunity_summary(db, consultancy_id=auth.consultancy.id)
        return RiskOpportunitySummaryRead(
            total_items=summary.total_items,
            open_items=summary.open_items,
            completed_items=summary.completed_items,
            risks_count=summary.risks_count,
            opportunities_count=summary.opportunities_count,
            critical_count=summary.critical_count,
            high_count=summary.high_count,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading risk/opportunity summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el resumen.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_table_missing(exc)
        logger.exception("Database error while loading risk/opportunity summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resumen") from exc


@router.get("/risk-opportunities", response_model=list[RiskOpportunityListItem])
def get_risk_opportunities(
    item_type: str | None = Query(default=None, alias="type"),
    status_filter: str | None = Query(default=None, alias="status"),
    level_filter: str | None = Query(default=None, alias="level"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[RiskOpportunity]:
    try:
        normalized_type = _normalize_item_type_filter(item_type)
        normalized_status = _normalize_status_filter(status_filter)
        normalized_level = _normalize_level_filter(level_filter)
        return list_risk_opportunities(
            db,
            consultancy_id=auth.consultancy.id,
            item_type=normalized_type,
            status=normalized_status,
            level=normalized_level,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing risk/opportunities")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar riesgos y oportunidades.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_table_missing(exc)
        logger.exception("Database error while listing risk/opportunities")
        raise HTTPException(status_code=500, detail="No se pudieron listar riesgos y oportunidades") from exc


@router.post(
    "/risk-opportunities",
    response_model=RiskOpportunityRead,
    status_code=status.HTTP_201_CREATED,
)
def post_risk_opportunity(
    payload: RiskOpportunityCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> RiskOpportunity:
    try:
        with _transaction_scope(db):
            item = create_risk_opportunity(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                name=payload.name,
                description=payload.description,
                item_type=payload.item_type,
                probability=payload.probability,
                impact=payload.impact,
                action_plan=payload.action_plan,
                responsible_name=payload.responsible_name,
                status=payload.status,
                review_date=payload.review_date,
            )
        db.refresh(item)
        return item
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating risk/opportunity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_table_missing(exc)
        logger.exception("Database error while creating risk/opportunity")
        raise HTTPException(status_code=500, detail="No se pudo crear el registro") from exc


@router.get("/risk-opportunities/{item_id}", response_model=RiskOpportunityRead)
def get_risk_opportunity(
    item_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> RiskOpportunity:
    try:
        return _get_item_or_404(db, consultancy_id=auth.consultancy.id, item_id=item_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading risk/opportunity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_table_missing(exc)
        logger.exception("Database error while loading risk/opportunity")
        raise HTTPException(status_code=500, detail="No se pudo cargar el registro") from exc


@router.patch("/risk-opportunities/{item_id}", response_model=RiskOpportunityRead)
def patch_risk_opportunity(
    item_id: UUID,
    payload: RiskOpportunityUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> RiskOpportunity:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            item = _get_item_or_404(db, consultancy_id=auth.consultancy.id, item_id=item_id)
            if data:
                update_risk_opportunity(
                    db,
                    item=item,
                    updated_by_user_id=auth.user.id,
                    data=data,
                )
        db.refresh(item)
        return item
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating risk/opportunity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_table_missing(exc)
        logger.exception("Database error while updating risk/opportunity")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el registro") from exc


@router.delete("/risk-opportunities/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_risk_opportunity(
    item_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            item = _get_item_or_404(db, consultancy_id=auth.consultancy.id, item_id=item_id)
            delete_risk_opportunity(db, item=item)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting risk/opportunity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el registro.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_table_missing(exc)
        logger.exception("Database error while deleting risk/opportunity")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el registro") from exc

