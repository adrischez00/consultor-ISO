import logging
from contextlib import contextmanager
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.crud.supplier import (
    MAX_SCORE,
    MIN_SCORE,
    SUPPLIER_FINAL_RATING_VALUES,
    SUPPLIER_ORDER_BY_VALUES,
    SUPPLIER_ORDER_DIR_VALUES,
    create_supplier,
    delete_supplier,
    get_supplier_or_none,
    get_supplier_summary,
    list_suppliers,
    update_supplier,
)
from app.db.session import get_db
from app.models.supplier import Supplier
from app.schemas.supplier import (
    SupplierCreateRequest,
    SupplierListItem,
    SupplierRead,
    SupplierSummaryRead,
    SupplierUpdateRequest,
)

router = APIRouter(tags=["suppliers"])
logger = logging.getLogger(__name__)


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _normalize_rating_filter(rating_filter: str | None) -> str | None:
    if rating_filter is None:
        return None
    normalized = rating_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in SUPPLIER_FINAL_RATING_VALUES:
        allowed = ", ".join(sorted(SUPPLIER_FINAL_RATING_VALUES))
        raise HTTPException(status_code=400, detail=f"rating inválido. Valores permitidos: {allowed}")
    return normalized


def _normalize_order_by(order_by_filter: str | None) -> str | None:
    if order_by_filter is None:
        return None
    normalized = order_by_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in SUPPLIER_ORDER_BY_VALUES:
        allowed = ", ".join(sorted(SUPPLIER_ORDER_BY_VALUES))
        raise HTTPException(status_code=400, detail=f"order_by inválido. Valores permitidos: {allowed}")
    return normalized


def _normalize_order_dir(order_dir_filter: str | None) -> str | None:
    if order_dir_filter is None:
        return None
    normalized = order_dir_filter.strip().lower()
    if not normalized:
        return None
    if normalized not in SUPPLIER_ORDER_DIR_VALUES:
        allowed = ", ".join(sorted(SUPPLIER_ORDER_DIR_VALUES))
        raise HTTPException(status_code=400, detail=f"order_dir inválido. Valores permitidos: {allowed}")
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


def _validate_score_range(*, score_min: float | None, score_max: float | None) -> None:
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


def _raise_if_suppliers_table_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and "suppliers" in message:
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migración de Proveedores y Evaluación. "
                "Ejecuta docs/sql/phase9_suppliers_evaluations.sql."
            ),
        ) from exc


def _get_supplier_or_404(db: Session, *, consultancy_id: UUID, supplier_id: UUID) -> Supplier:
    supplier = get_supplier_or_none(db, consultancy_id=consultancy_id, supplier_id=supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return supplier


@router.get("/suppliers/summary", response_model=SupplierSummaryRead)
def get_suppliers_summary(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> SupplierSummaryRead:
    try:
        summary = get_supplier_summary(db, consultancy_id=auth.consultancy.id)
        return SupplierSummaryRead(
            total_suppliers=summary.total_suppliers,
            average_global_score=summary.average_global_score,
            excellent_count=summary.excellent_count,
            approved_count=summary.approved_count,
            conditional_count=summary.conditional_count,
            critical_count=summary.critical_count,
            latest_evaluation_date=summary.latest_evaluation_date,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading suppliers summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el resumen.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_suppliers_table_missing(exc)
        logger.exception("Database error while loading suppliers summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resumen") from exc


@router.get("/suppliers", response_model=list[SupplierListItem])
def get_suppliers(
    service_category: str | None = Query(default=None),
    rating_filter: str | None = Query(default=None, alias="rating"),
    evaluation_date_from: date | None = Query(default=None),
    evaluation_date_to: date | None = Query(default=None),
    score_min: float | None = Query(default=None),
    score_max: float | None = Query(default=None),
    order_by: str | None = Query(default=None),
    order_dir: str | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[Supplier]:
    try:
        normalized_rating = _normalize_rating_filter(rating_filter)
        normalized_order_by = _normalize_order_by(order_by)
        normalized_order_dir = _normalize_order_dir(order_dir)
        _validate_date_range(
            from_value=evaluation_date_from,
            to_value=evaluation_date_to,
            from_field="evaluation_date_from",
            to_field="evaluation_date_to",
        )
        _validate_score_range(score_min=score_min, score_max=score_max)
        return list_suppliers(
            db,
            consultancy_id=auth.consultancy.id,
            service_category=service_category,
            final_rating=normalized_rating,
            evaluation_date_from=evaluation_date_from,
            evaluation_date_to=evaluation_date_to,
            score_min=score_min,
            score_max=score_max,
            order_by=normalized_order_by,
            order_dir=normalized_order_dir,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing suppliers")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar proveedores.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_suppliers_table_missing(exc)
        logger.exception("Database error while listing suppliers")
        raise HTTPException(status_code=500, detail="No se pudieron listar los proveedores") from exc


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def post_supplier(
    payload: SupplierCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Supplier:
    try:
        with _transaction_scope(db):
            supplier = create_supplier(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                name=payload.name,
                service_category=payload.service_category,
                contact_name=payload.contact_name,
                contact_email=payload.contact_email,
                contact_phone=payload.contact_phone,
                quality_score=payload.quality_score,
                delivery_score=payload.delivery_score,
                incidents_score=payload.incidents_score,
                certifications_score=payload.certifications_score,
                additional_score=payload.additional_score,
                incidents_count=payload.incidents_count,
                evaluation_date=payload.evaluation_date,
                evaluation_notes=payload.evaluation_notes,
            )
        db.refresh(supplier)
        return supplier
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating supplier")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el proveedor.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_suppliers_table_missing(exc)
        logger.exception("Database error while creating supplier")
        raise HTTPException(status_code=500, detail="No se pudo crear el proveedor") from exc


@router.get("/suppliers/{supplier_id}", response_model=SupplierRead)
def get_supplier(
    supplier_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Supplier:
    try:
        return _get_supplier_or_404(db, consultancy_id=auth.consultancy.id, supplier_id=supplier_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading supplier")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el proveedor.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_suppliers_table_missing(exc)
        logger.exception("Database error while loading supplier")
        raise HTTPException(status_code=500, detail="No se pudo cargar el proveedor") from exc


@router.patch("/suppliers/{supplier_id}", response_model=SupplierRead)
def patch_supplier(
    supplier_id: UUID,
    payload: SupplierUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Supplier:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            supplier = _get_supplier_or_404(db, consultancy_id=auth.consultancy.id, supplier_id=supplier_id)
            if data:
                update_supplier(
                    db,
                    supplier=supplier,
                    updated_by_user_id=auth.user.id,
                    data=data,
                )
        db.refresh(supplier)
        return supplier
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating supplier")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el proveedor.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_suppliers_table_missing(exc)
        logger.exception("Database error while updating supplier")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el proveedor") from exc


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_supplier(
    supplier_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            supplier = _get_supplier_or_404(db, consultancy_id=auth.consultancy.id, supplier_id=supplier_id)
            delete_supplier(db, supplier=supplier)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting supplier")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el proveedor.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_suppliers_table_missing(exc)
        logger.exception("Database error while deleting supplier")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el proveedor") from exc

