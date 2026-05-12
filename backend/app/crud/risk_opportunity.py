from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.risk_opportunity import RiskOpportunity

TYPE_RISK = "risk"
TYPE_OPPORTUNITY = "opportunity"
RISK_OPPORTUNITY_TYPE_VALUES = {TYPE_RISK, TYPE_OPPORTUNITY}

STATUS_PENDING = "pending"
STATUS_IN_PROGRESS = "in_progress"
STATUS_COMPLETED = "completed"
RISK_OPPORTUNITY_STATUS_VALUES = {
    STATUS_PENDING,
    STATUS_IN_PROGRESS,
    STATUS_COMPLETED,
}

LEVEL_LOW = "low"
LEVEL_MEDIUM = "medium"
LEVEL_HIGH = "high"
LEVEL_CRITICAL = "critical"
RISK_OPPORTUNITY_LEVEL_VALUES = {LEVEL_LOW, LEVEL_MEDIUM, LEVEL_HIGH, LEVEL_CRITICAL}


@dataclass(frozen=True)
class RiskOpportunitySummary:
    total_items: int
    open_items: int
    completed_items: int
    risks_count: int
    opportunities_count: int
    critical_count: int
    high_count: int


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


def _normalize_item_type(value: str | None) -> str:
    normalized = _normalize_required_text(value, "item_type").lower()
    if normalized not in RISK_OPPORTUNITY_TYPE_VALUES:
        allowed = ", ".join(sorted(RISK_OPPORTUNITY_TYPE_VALUES))
        raise ValueError(f"item_type inválido. Valores permitidos: {allowed}")
    return normalized


def _normalize_status(value: str | None) -> str:
    normalized = _normalize_required_text(value, "status").lower()
    if normalized not in RISK_OPPORTUNITY_STATUS_VALUES:
        allowed = ", ".join(sorted(RISK_OPPORTUNITY_STATUS_VALUES))
        raise ValueError(f"status inválido. Valores permitidos: {allowed}")
    return normalized


def _validate_probability_impact(value: int, field_name: str) -> int:
    if not isinstance(value, int):
        raise ValueError(f"{field_name} debe ser entero")
    if value < 1 or value > 5:
        raise ValueError(f"{field_name} debe estar entre 1 y 5")
    return value


def calculate_level(*, probability: int, impact: int) -> tuple[int, str]:
    normalized_probability = _validate_probability_impact(probability, "probability")
    normalized_impact = _validate_probability_impact(impact, "impact")
    score = normalized_probability * normalized_impact
    if score >= 16:
        return score, LEVEL_CRITICAL
    if score >= 9:
        return score, LEVEL_HIGH
    if score >= 4:
        return score, LEVEL_MEDIUM
    return score, LEVEL_LOW


def list_risk_opportunities(
    db: Session,
    *,
    consultancy_id: UUID,
    item_type: str | None = None,
    status: str | None = None,
    level: str | None = None,
) -> list[RiskOpportunity]:
    query = select(RiskOpportunity).where(RiskOpportunity.consultancy_id == consultancy_id)
    if item_type:
        query = query.where(RiskOpportunity.item_type == item_type)
    if status:
        query = query.where(RiskOpportunity.status == status)
    if level:
        query = query.where(RiskOpportunity.level == level)
    rows = db.scalars(
        query.order_by(RiskOpportunity.level_score.desc(), RiskOpportunity.review_date.asc(), RiskOpportunity.id.asc())
    ).all()
    return list(rows)


def get_risk_opportunity_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    item_id: UUID,
) -> RiskOpportunity | None:
    return db.scalar(
        select(RiskOpportunity).where(
            RiskOpportunity.id == item_id,
            RiskOpportunity.consultancy_id == consultancy_id,
        )
    )


def create_risk_opportunity(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    name: str,
    description: str | None,
    item_type: str,
    probability: int,
    impact: int,
    action_plan: str,
    responsible_name: str,
    status: str,
    review_date: date,
) -> RiskOpportunity:
    score, level = calculate_level(probability=probability, impact=impact)
    item = RiskOpportunity(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        name=_normalize_required_text(name, "name"),
        description=_normalize_optional_text(description),
        item_type=_normalize_item_type(item_type),
        probability=_validate_probability_impact(probability, "probability"),
        impact=_validate_probability_impact(impact, "impact"),
        level_score=score,
        level=level,
        action_plan=_normalize_required_text(action_plan, "action_plan"),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        status=_normalize_status(status),
        review_date=review_date,
    )
    db.add(item)
    db.flush()
    return item


def update_risk_opportunity(
    db: Session,
    *,
    item: RiskOpportunity,
    updated_by_user_id: UUID,
    data: dict,
) -> RiskOpportunity:
    if "name" in data:
        item.name = _normalize_required_text(data["name"], "name")
    if "description" in data:
        item.description = _normalize_optional_text(data["description"])
    if "item_type" in data:
        item.item_type = _normalize_item_type(data["item_type"])
    if "probability" in data:
        item.probability = _validate_probability_impact(data["probability"], "probability")
    if "impact" in data:
        item.impact = _validate_probability_impact(data["impact"], "impact")
    if "action_plan" in data:
        item.action_plan = _normalize_required_text(data["action_plan"], "action_plan")
    if "responsible_name" in data:
        item.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")
    if "status" in data:
        item.status = _normalize_status(data["status"])
    if "review_date" in data:
        item.review_date = data["review_date"]

    score, level = calculate_level(probability=item.probability, impact=item.impact)
    item.level_score = score
    item.level = level
    item.updated_by_user_id = updated_by_user_id
    db.flush()
    return item


def delete_risk_opportunity(db: Session, *, item: RiskOpportunity) -> None:
    db.delete(item)
    db.flush()


def get_risk_opportunity_summary(db: Session, *, consultancy_id: UUID) -> RiskOpportunitySummary:
    total_items = (
        db.scalar(
            select(func.count(RiskOpportunity.id)).where(
                RiskOpportunity.consultancy_id == consultancy_id
            )
        )
        or 0
    )
    completed_items = (
        db.scalar(
            select(func.count(RiskOpportunity.id)).where(
                RiskOpportunity.consultancy_id == consultancy_id,
                RiskOpportunity.status == STATUS_COMPLETED,
            )
        )
        or 0
    )
    risks_count = (
        db.scalar(
            select(func.count(RiskOpportunity.id)).where(
                RiskOpportunity.consultancy_id == consultancy_id,
                RiskOpportunity.item_type == TYPE_RISK,
            )
        )
        or 0
    )
    opportunities_count = (
        db.scalar(
            select(func.count(RiskOpportunity.id)).where(
                RiskOpportunity.consultancy_id == consultancy_id,
                RiskOpportunity.item_type == TYPE_OPPORTUNITY,
            )
        )
        or 0
    )
    critical_count = (
        db.scalar(
            select(func.count(RiskOpportunity.id)).where(
                RiskOpportunity.consultancy_id == consultancy_id,
                RiskOpportunity.level == LEVEL_CRITICAL,
            )
        )
        or 0
    )
    high_count = (
        db.scalar(
            select(func.count(RiskOpportunity.id)).where(
                RiskOpportunity.consultancy_id == consultancy_id,
                RiskOpportunity.level == LEVEL_HIGH,
            )
        )
        or 0
    )
    return RiskOpportunitySummary(
        total_items=int(total_items),
        open_items=int(total_items) - int(completed_items),
        completed_items=int(completed_items),
        risks_count=int(risks_count),
        opportunities_count=int(opportunities_count),
        critical_count=int(critical_count),
        high_count=int(high_count),
    )

