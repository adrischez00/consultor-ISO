from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.supplier import Supplier

RATING_EXCELLENT = "excellent"
RATING_APPROVED = "approved"
RATING_CONDITIONAL = "conditional"
RATING_CRITICAL = "critical"
SUPPLIER_FINAL_RATING_VALUES = {
    RATING_EXCELLENT,
    RATING_APPROVED,
    RATING_CONDITIONAL,
    RATING_CRITICAL,
}

MIN_SCORE = 1
MAX_SCORE = 5

ORDER_BY_NAME = "name"
ORDER_BY_GLOBAL_SCORE = "global_score"
ORDER_BY_EVALUATION_DATE = "evaluation_date"
ORDER_BY_INCIDENTS_COUNT = "incidents_count"
ORDER_BY_CREATED_AT = "created_at"
SUPPLIER_ORDER_BY_VALUES = {
    ORDER_BY_NAME,
    ORDER_BY_GLOBAL_SCORE,
    ORDER_BY_EVALUATION_DATE,
    ORDER_BY_INCIDENTS_COUNT,
    ORDER_BY_CREATED_AT,
}

ORDER_DIR_ASC = "asc"
ORDER_DIR_DESC = "desc"
SUPPLIER_ORDER_DIR_VALUES = {ORDER_DIR_ASC, ORDER_DIR_DESC}


@dataclass(frozen=True)
class SupplierSummary:
    total_suppliers: int
    average_global_score: float | None
    excellent_count: int
    approved_count: int
    conditional_count: int
    critical_count: int
    latest_evaluation_date: date | None


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


def _validate_email(value: str | None) -> str | None:
    normalized = _normalize_optional_text(value)
    if normalized is None:
        return None
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise ValueError("contact_email invalido")
    return normalized


def _validate_score(value: Any, field_name: str) -> int:
    if not isinstance(value, int):
        raise ValueError(f"{field_name} debe ser entero")
    if value < MIN_SCORE or value > MAX_SCORE:
        raise ValueError(f"{field_name} debe estar entre {MIN_SCORE} y {MAX_SCORE}")
    return value


def _validate_incidents_count(value: Any) -> int:
    if not isinstance(value, int):
        raise ValueError("incidents_count debe ser entero")
    if value < 0:
        raise ValueError("incidents_count no puede ser negativo")
    return value


def _normalize_rating(value: str | None) -> str:
    normalized = _normalize_required_text(value, "final_rating").lower()
    if normalized not in SUPPLIER_FINAL_RATING_VALUES:
        allowed = ", ".join(sorted(SUPPLIER_FINAL_RATING_VALUES))
        raise ValueError(f"final_rating invalido. Valores permitidos: {allowed}")
    return normalized


def _normalize_order_by(value: str | None) -> str:
    normalized = (value or ORDER_BY_EVALUATION_DATE).strip().lower()
    if normalized not in SUPPLIER_ORDER_BY_VALUES:
        allowed = ", ".join(sorted(SUPPLIER_ORDER_BY_VALUES))
        raise ValueError(f"order_by invalido. Valores permitidos: {allowed}")
    return normalized


def _normalize_order_dir(value: str | None) -> str:
    normalized = (value or ORDER_DIR_DESC).strip().lower()
    if normalized not in SUPPLIER_ORDER_DIR_VALUES:
        allowed = ", ".join(sorted(SUPPLIER_ORDER_DIR_VALUES))
        raise ValueError(f"order_dir invalido. Valores permitidos: {allowed}")
    return normalized


def calculate_global_score(
    *,
    quality_score: int,
    delivery_score: int,
    incidents_score: int,
    certifications_score: int,
    additional_score: int | None,
) -> float:
    scores = [
        _validate_score(quality_score, "quality_score"),
        _validate_score(delivery_score, "delivery_score"),
        _validate_score(incidents_score, "incidents_score"),
        _validate_score(certifications_score, "certifications_score"),
    ]
    if additional_score is not None:
        scores.append(_validate_score(additional_score, "additional_score"))
    decimal_total = sum(Decimal(str(score)) for score in scores)
    average = decimal_total / Decimal(str(len(scores)))
    return float(average.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculate_final_rating(*, global_score: float) -> str:
    score = Decimal(str(global_score))
    if score >= Decimal("4.50"):
        return RATING_EXCELLENT
    if score >= Decimal("3.50"):
        return RATING_APPROVED
    if score >= Decimal("2.50"):
        return RATING_CONDITIONAL
    return RATING_CRITICAL


def list_suppliers(
    db: Session,
    *,
    consultancy_id: UUID,
    service_category: str | None = None,
    final_rating: str | None = None,
    evaluation_date_from: date | None = None,
    evaluation_date_to: date | None = None,
    score_min: float | None = None,
    score_max: float | None = None,
    order_by: str | None = None,
    order_dir: str | None = None,
) -> list[Supplier]:
    normalized_order_by = _normalize_order_by(order_by)
    normalized_order_dir = _normalize_order_dir(order_dir)

    query = select(Supplier).where(Supplier.consultancy_id == consultancy_id)

    normalized_category = _normalize_optional_text(service_category)
    if normalized_category:
        query = query.where(func.lower(Supplier.service_category) == normalized_category.lower())

    if final_rating:
        query = query.where(Supplier.final_rating == _normalize_rating(final_rating))
    if evaluation_date_from is not None:
        query = query.where(Supplier.evaluation_date >= evaluation_date_from)
    if evaluation_date_to is not None:
        query = query.where(Supplier.evaluation_date <= evaluation_date_to)
    if score_min is not None:
        query = query.where(Supplier.global_score >= score_min)
    if score_max is not None:
        query = query.where(Supplier.global_score <= score_max)

    order_map = {
        ORDER_BY_NAME: Supplier.name,
        ORDER_BY_GLOBAL_SCORE: Supplier.global_score,
        ORDER_BY_EVALUATION_DATE: Supplier.evaluation_date,
        ORDER_BY_INCIDENTS_COUNT: Supplier.incidents_count,
        ORDER_BY_CREATED_AT: Supplier.created_at,
    }
    order_col = order_map[normalized_order_by]
    if normalized_order_dir == ORDER_DIR_ASC:
        query = query.order_by(order_col.asc(), Supplier.id.asc())
    else:
        query = query.order_by(order_col.desc(), Supplier.id.desc())

    return list(db.scalars(query).all())


def get_supplier_or_none(db: Session, *, consultancy_id: UUID, supplier_id: UUID) -> Supplier | None:
    return db.scalar(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.consultancy_id == consultancy_id,
        )
    )


def create_supplier(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    name: str,
    service_category: str,
    contact_name: str | None,
    contact_email: str | None,
    contact_phone: str | None,
    quality_score: int,
    delivery_score: int,
    incidents_score: int,
    certifications_score: int,
    additional_score: int | None,
    incidents_count: int,
    evaluation_date: date,
    evaluation_notes: str | None,
) -> Supplier:
    global_score = calculate_global_score(
        quality_score=quality_score,
        delivery_score=delivery_score,
        incidents_score=incidents_score,
        certifications_score=certifications_score,
        additional_score=additional_score,
    )
    supplier = Supplier(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        name=_normalize_required_text(name, "name"),
        service_category=_normalize_required_text(service_category, "service_category"),
        contact_name=_normalize_optional_text(contact_name),
        contact_email=_validate_email(contact_email),
        contact_phone=_normalize_optional_text(contact_phone),
        quality_score=_validate_score(quality_score, "quality_score"),
        delivery_score=_validate_score(delivery_score, "delivery_score"),
        incidents_score=_validate_score(incidents_score, "incidents_score"),
        certifications_score=_validate_score(certifications_score, "certifications_score"),
        additional_score=None
        if additional_score is None
        else _validate_score(additional_score, "additional_score"),
        global_score=global_score,
        incidents_count=_validate_incidents_count(incidents_count),
        evaluation_date=evaluation_date,
        final_rating=calculate_final_rating(global_score=global_score),
        evaluation_notes=_normalize_optional_text(evaluation_notes),
    )
    db.add(supplier)
    db.flush()
    return supplier


def update_supplier(
    db: Session,
    *,
    supplier: Supplier,
    updated_by_user_id: UUID,
    data: dict,
) -> Supplier:
    if "name" in data:
        supplier.name = _normalize_required_text(data["name"], "name")
    if "service_category" in data:
        supplier.service_category = _normalize_required_text(data["service_category"], "service_category")
    if "contact_name" in data:
        supplier.contact_name = _normalize_optional_text(data["contact_name"])
    if "contact_email" in data:
        supplier.contact_email = _validate_email(data["contact_email"])
    if "contact_phone" in data:
        supplier.contact_phone = _normalize_optional_text(data["contact_phone"])
    if "quality_score" in data:
        supplier.quality_score = _validate_score(data["quality_score"], "quality_score")
    if "delivery_score" in data:
        supplier.delivery_score = _validate_score(data["delivery_score"], "delivery_score")
    if "incidents_score" in data:
        supplier.incidents_score = _validate_score(data["incidents_score"], "incidents_score")
    if "certifications_score" in data:
        supplier.certifications_score = _validate_score(data["certifications_score"], "certifications_score")
    if "additional_score" in data:
        supplier.additional_score = (
            None
            if data["additional_score"] is None
            else _validate_score(data["additional_score"], "additional_score")
        )
    if "incidents_count" in data:
        supplier.incidents_count = _validate_incidents_count(data["incidents_count"])
    if "evaluation_date" in data:
        supplier.evaluation_date = data["evaluation_date"]
    if "evaluation_notes" in data:
        supplier.evaluation_notes = _normalize_optional_text(data["evaluation_notes"])

    global_score = calculate_global_score(
        quality_score=supplier.quality_score,
        delivery_score=supplier.delivery_score,
        incidents_score=supplier.incidents_score,
        certifications_score=supplier.certifications_score,
        additional_score=supplier.additional_score,
    )
    supplier.global_score = global_score
    supplier.final_rating = calculate_final_rating(global_score=global_score)
    supplier.updated_by_user_id = updated_by_user_id
    db.flush()
    return supplier


def delete_supplier(db: Session, *, supplier: Supplier) -> None:
    db.delete(supplier)
    db.flush()


def get_supplier_summary(db: Session, *, consultancy_id: UUID) -> SupplierSummary:
    rows = db.execute(
        select(Supplier.final_rating, func.count(Supplier.id))
        .where(Supplier.consultancy_id == consultancy_id)
        .group_by(Supplier.final_rating)
    ).all()
    counts = {rating: 0 for rating in SUPPLIER_FINAL_RATING_VALUES}
    total_suppliers = 0
    for final_rating, count in rows:
        rating_key = str(final_rating or "").strip().lower()
        if rating_key in counts:
            counts[rating_key] = int(count)
            total_suppliers += int(count)

    average_score_raw = db.scalar(
        select(func.avg(Supplier.global_score)).where(Supplier.consultancy_id == consultancy_id)
    )
    latest_evaluation_date = db.scalar(
        select(func.max(Supplier.evaluation_date)).where(Supplier.consultancy_id == consultancy_id)
    )

    return SupplierSummary(
        total_suppliers=total_suppliers,
        average_global_score=float(average_score_raw) if average_score_raw is not None else None,
        excellent_count=counts[RATING_EXCELLENT],
        approved_count=counts[RATING_APPROVED],
        conditional_count=counts[RATING_CONDITIONAL],
        critical_count=counts[RATING_CRITICAL],
        latest_evaluation_date=latest_evaluation_date,
    )
