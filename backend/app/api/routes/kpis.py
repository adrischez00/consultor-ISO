import logging
from contextlib import contextmanager
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.crud.kpi_indicator import (
    KPI_STATUS_ALERTA,
    KPI_STATUS_CRITICO,
    KPI_STATUS_OK,
    create_kpi,
    delete_kpi,
    get_kpi_or_none,
    list_kpis,
    update_kpi,
)
from app.db.session import get_db
from app.models.kpi_indicator import KpiIndicator
from app.schemas.kpi import KpiIndicatorCreateRequest, KpiIndicatorRead, KpiIndicatorUpdateRequest

router = APIRouter(tags=["kpis"])
logger = logging.getLogger(__name__)

VALID_KPI_STATUS = {KPI_STATUS_OK, KPI_STATUS_ALERTA, KPI_STATUS_CRITICO}


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _normalize_status_filter(status_filter: str | None) -> str | None:
    if status_filter is None:
        return None
    normalized = status_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in VALID_KPI_STATUS:
        raise HTTPException(
            status_code=400,
            detail="status inválido. Valores permitidos: ok, alerta, critico",
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


def _raise_if_kpi_table_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and "kpi_indicators" in message:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migración de KPIs. "
                "Ejecuta docs/sql/phase5_kpis_indicators.sql."
            ),
        ) from exc


def _get_kpi_or_404(db: Session, *, consultancy_id: UUID, kpi_id: UUID) -> KpiIndicator:
    kpi = get_kpi_or_none(db, consultancy_id=consultancy_id, kpi_id=kpi_id)
    if kpi is None:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    return kpi


@router.get("/kpis", response_model=list[KpiIndicatorRead])
def get_kpis(
    status_filter: str | None = Query(default=None, alias="status"),
    start_date_from: date | None = Query(default=None),
    start_date_to: date | None = Query(default=None),
    end_date_from: date | None = Query(default=None),
    end_date_to: date | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[KpiIndicator]:
    try:
        normalized_status = _normalize_status_filter(status_filter)
        _validate_date_range(
            from_value=start_date_from,
            to_value=start_date_to,
            from_field="start_date_from",
            to_field="start_date_to",
        )
        _validate_date_range(
            from_value=end_date_from,
            to_value=end_date_to,
            from_field="end_date_from",
            to_field="end_date_to",
        )
        return list_kpis(
            db,
            consultancy_id=auth.consultancy.id,
            status=normalized_status,
            start_date_from=start_date_from,
            start_date_to=start_date_to,
            end_date_from=end_date_from,
            end_date_to=end_date_to,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing kpis")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar indicadores.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_kpi_table_missing(exc)
        logger.exception("Database error while listing kpis")
        raise HTTPException(status_code=500, detail="No se pudieron listar los indicadores") from exc


@router.post("/kpis", response_model=KpiIndicatorRead, status_code=status.HTTP_201_CREATED)
def post_kpi(
    payload: KpiIndicatorCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> KpiIndicator:
    try:
        with _transaction_scope(db):
            kpi = create_kpi(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                name=payload.name,
                description=payload.description,
                target_value=payload.target_value,
                current_value=payload.current_value,
                unit=payload.unit,
                start_date=payload.start_date,
                end_date=payload.end_date,
                period_label=payload.period_label,
                responsible_name=payload.responsible_name,
            )
        db.refresh(kpi)
        return kpi
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating kpi")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el indicador.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_kpi_table_missing(exc)
        logger.exception("Database error while creating kpi")
        raise HTTPException(status_code=500, detail="No se pudo crear el indicador") from exc


@router.get("/kpis/{kpi_id}", response_model=KpiIndicatorRead)
def get_kpi(
    kpi_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> KpiIndicator:
    try:
        return _get_kpi_or_404(db, consultancy_id=auth.consultancy.id, kpi_id=kpi_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading kpi")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el indicador.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_kpi_table_missing(exc)
        logger.exception("Database error while loading kpi")
        raise HTTPException(status_code=500, detail="No se pudo cargar el indicador") from exc


@router.patch("/kpis/{kpi_id}", response_model=KpiIndicatorRead)
def patch_kpi(
    kpi_id: UUID,
    payload: KpiIndicatorUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> KpiIndicator:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            kpi = _get_kpi_or_404(db, consultancy_id=auth.consultancy.id, kpi_id=kpi_id)
            if data:
                update_kpi(db, kpi=kpi, updated_by_user_id=auth.user.id, data=data)
        db.refresh(kpi)
        return kpi
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating kpi")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el indicador.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_kpi_table_missing(exc)
        logger.exception("Database error while updating kpi")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el indicador") from exc


@router.delete("/kpis/{kpi_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_kpi(
    kpi_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            kpi = _get_kpi_or_404(db, consultancy_id=auth.consultancy.id, kpi_id=kpi_id)
            delete_kpi(db, kpi=kpi)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting kpi")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el indicador.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_kpi_table_missing(exc)
        logger.exception("Database error while deleting kpi")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el indicador") from exc

