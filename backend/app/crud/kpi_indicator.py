from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.kpi_indicator import KpiIndicator

KPI_STATUS_OK = "ok"
KPI_STATUS_ALERTA = "alerta"
KPI_STATUS_CRITICO = "critico"
ALERT_THRESHOLD_RATIO = Decimal("0.90")


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


def _as_decimal(value: float | int | Decimal, field_name: str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"{field_name} es invalido") from exc


def _validate_period(
    *,
    start_date: date,
    end_date: date | None,
    period_label: str | None,
) -> str | None:
    normalized_period_label = _normalize_optional_text(period_label)
    if end_date is None and normalized_period_label is None:
        raise ValueError("Debes informar end_date o period_label")
    if end_date is not None and end_date < start_date:
        raise ValueError("end_date no puede ser anterior a start_date")
    return normalized_period_label


def calculate_kpi_status(*, target_value: float | int | Decimal, current_value: float | int | Decimal) -> str:
    target = _as_decimal(target_value, "target_value")
    current = _as_decimal(current_value, "current_value")
    if target <= Decimal("0"):
        raise ValueError("target_value debe ser mayor que 0")

    if current >= target:
        return KPI_STATUS_OK

    ratio = current / target
    if ratio >= ALERT_THRESHOLD_RATIO:
        return KPI_STATUS_ALERTA
    return KPI_STATUS_CRITICO


def list_kpis(
    db: Session,
    *,
    consultancy_id: UUID,
    status: str | None = None,
    start_date_from: date | None = None,
    start_date_to: date | None = None,
    end_date_from: date | None = None,
    end_date_to: date | None = None,
) -> list[KpiIndicator]:
    query = select(KpiIndicator).where(KpiIndicator.consultancy_id == consultancy_id)

    if status is not None:
        query = query.where(KpiIndicator.status == status)
    if start_date_from is not None:
        query = query.where(KpiIndicator.start_date >= start_date_from)
    if start_date_to is not None:
        query = query.where(KpiIndicator.start_date <= start_date_to)
    if end_date_from is not None:
        query = query.where(KpiIndicator.end_date.is_not(None), KpiIndicator.end_date >= end_date_from)
    if end_date_to is not None:
        query = query.where(KpiIndicator.end_date.is_not(None), KpiIndicator.end_date <= end_date_to)

    rows = db.scalars(
        query.order_by(KpiIndicator.start_date.desc(), KpiIndicator.created_at.desc(), KpiIndicator.id.desc())
    ).all()
    return list(rows)


def get_kpi_or_none(db: Session, *, consultancy_id: UUID, kpi_id: UUID) -> KpiIndicator | None:
    return db.scalar(
        select(KpiIndicator).where(
            KpiIndicator.id == kpi_id,
            KpiIndicator.consultancy_id == consultancy_id,
        )
    )


def create_kpi(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    name: str,
    description: str | None,
    target_value: float,
    current_value: float,
    unit: str,
    start_date: date,
    end_date: date | None,
    period_label: str | None,
    responsible_name: str,
) -> KpiIndicator:
    normalized_name = _normalize_required_text(name, "name")
    normalized_description = _normalize_optional_text(description)
    normalized_unit = _normalize_required_text(unit, "unit")
    normalized_period_label = _validate_period(
        start_date=start_date,
        end_date=end_date,
        period_label=period_label,
    )
    normalized_responsible_name = _normalize_required_text(responsible_name, "responsible_name")
    status = calculate_kpi_status(target_value=target_value, current_value=current_value)

    kpi = KpiIndicator(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        name=normalized_name,
        description=normalized_description,
        target_value=target_value,
        current_value=current_value,
        unit=normalized_unit,
        start_date=start_date,
        end_date=end_date,
        period_label=normalized_period_label,
        responsible_name=normalized_responsible_name,
        status=status,
    )
    db.add(kpi)
    db.flush()
    return kpi


def update_kpi(
    db: Session,
    *,
    kpi: KpiIndicator,
    updated_by_user_id: UUID,
    data: dict,
) -> KpiIndicator:
    if "name" in data:
        kpi.name = _normalize_required_text(data["name"], "name")
    if "description" in data:
        kpi.description = _normalize_optional_text(data["description"])
    if "target_value" in data:
        kpi.target_value = data["target_value"]
    if "current_value" in data:
        kpi.current_value = data["current_value"]
    if "unit" in data:
        kpi.unit = _normalize_required_text(data["unit"], "unit")
    if "start_date" in data:
        kpi.start_date = data["start_date"]
    if "end_date" in data:
        kpi.end_date = data["end_date"]
    if "period_label" in data:
        kpi.period_label = data["period_label"]
    if "responsible_name" in data:
        kpi.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")

    kpi.period_label = _validate_period(
        start_date=kpi.start_date,
        end_date=kpi.end_date,
        period_label=kpi.period_label,
    )
    kpi.status = calculate_kpi_status(target_value=kpi.target_value, current_value=kpi.current_value)
    kpi.updated_by_user_id = updated_by_user_id
    db.flush()
    return kpi


def delete_kpi(db: Session, *, kpi: KpiIndicator) -> None:
    db.delete(kpi)
    db.flush()
