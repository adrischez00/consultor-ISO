from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.customer_feedback import CustomerFeedback

TYPE_SURVEY = "survey"
TYPE_MEETING = "meeting"
TYPE_CALL = "call"
TYPE_EMAIL = "email"
TYPE_COMPLAINT = "complaint"
TYPE_OTHER = "other"
CUSTOMER_FEEDBACK_TYPE_VALUES = {
    TYPE_SURVEY,
    TYPE_MEETING,
    TYPE_CALL,
    TYPE_EMAIL,
    TYPE_COMPLAINT,
    TYPE_OTHER,
}

MIN_SCORE = 1
MAX_SCORE = 5


@dataclass(frozen=True)
class CustomerFeedbackSummary:
    total_feedback: int
    average_score: float | None
    satisfied_count: int
    neutral_count: int
    unsatisfied_count: int
    score_5_count: int
    score_4_count: int
    score_3_count: int
    score_2_count: int
    score_1_count: int
    latest_feedback_date: date | None


def _normalize_required_text(value: str | None, field_name: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise ValueError(f"{field_name} es requerido")
    return normalized


def _normalize_feedback_type(value: str | None) -> str:
    normalized = _normalize_required_text(value, "feedback_type").lower()
    if normalized not in CUSTOMER_FEEDBACK_TYPE_VALUES:
        allowed = ", ".join(sorted(CUSTOMER_FEEDBACK_TYPE_VALUES))
        raise ValueError(f"feedback_type inválido. Valores permitidos: {allowed}")
    return normalized


def _validate_score(value: Any) -> int:
    if not isinstance(value, int):
        raise ValueError("score debe ser entero")
    if value < MIN_SCORE or value > MAX_SCORE:
        raise ValueError(f"score debe estar entre {MIN_SCORE} y {MAX_SCORE}")
    return value


def list_customer_feedback(
    db: Session,
    *,
    consultancy_id: UUID,
    client_id: UUID | None = None,
    feedback_type: str | None = None,
    feedback_date_from: date | None = None,
    feedback_date_to: date | None = None,
    score_min: int | None = None,
    score_max: int | None = None,
) -> list[CustomerFeedback]:
    query = select(CustomerFeedback).where(CustomerFeedback.consultancy_id == consultancy_id)
    if client_id is not None:
        query = query.where(CustomerFeedback.client_id == client_id)
    if feedback_type:
        query = query.where(CustomerFeedback.feedback_type == feedback_type)
    if feedback_date_from is not None:
        query = query.where(CustomerFeedback.feedback_date >= feedback_date_from)
    if feedback_date_to is not None:
        query = query.where(CustomerFeedback.feedback_date <= feedback_date_to)
    if score_min is not None:
        query = query.where(CustomerFeedback.score >= score_min)
    if score_max is not None:
        query = query.where(CustomerFeedback.score <= score_max)
    return list(
        db.scalars(
            query.order_by(
                CustomerFeedback.feedback_date.desc(),
                CustomerFeedback.created_at.desc(),
                CustomerFeedback.id.desc(),
            )
        ).all()
    )


def get_customer_feedback_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    feedback_id: UUID,
) -> CustomerFeedback | None:
    return db.scalar(
        select(CustomerFeedback).where(
            CustomerFeedback.id == feedback_id,
            CustomerFeedback.consultancy_id == consultancy_id,
        )
    )


def create_customer_feedback(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    client_id: UUID,
    feedback_date: date,
    score: int,
    comment: str,
    feedback_type: str,
) -> CustomerFeedback:
    feedback = CustomerFeedback(
        consultancy_id=consultancy_id,
        client_id=client_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        feedback_date=feedback_date,
        score=_validate_score(score),
        comment=_normalize_required_text(comment, "comment"),
        feedback_type=_normalize_feedback_type(feedback_type),
    )
    db.add(feedback)
    db.flush()
    return feedback


def update_customer_feedback(
    db: Session,
    *,
    feedback: CustomerFeedback,
    updated_by_user_id: UUID,
    data: dict,
) -> CustomerFeedback:
    if "client_id" in data:
        feedback.client_id = data["client_id"]
    if "feedback_date" in data:
        feedback.feedback_date = data["feedback_date"]
    if "score" in data:
        feedback.score = _validate_score(data["score"])
    if "comment" in data:
        feedback.comment = _normalize_required_text(data["comment"], "comment")
    if "feedback_type" in data:
        feedback.feedback_type = _normalize_feedback_type(data["feedback_type"])

    feedback.updated_by_user_id = updated_by_user_id
    db.flush()
    return feedback


def delete_customer_feedback(db: Session, *, feedback: CustomerFeedback) -> None:
    db.delete(feedback)
    db.flush()


def get_customer_feedback_summary(db: Session, *, consultancy_id: UUID) -> CustomerFeedbackSummary:
    rows = db.execute(
        select(CustomerFeedback.score, func.count(CustomerFeedback.id))
        .where(CustomerFeedback.consultancy_id == consultancy_id)
        .group_by(CustomerFeedback.score)
    ).all()

    counts = {score: 0 for score in range(MIN_SCORE, MAX_SCORE + 1)}
    total_feedback = 0
    for score, count in rows:
        score_value = int(score)
        counts[score_value] = int(count)
        total_feedback += int(count)

    average_raw = db.scalar(
        select(func.avg(CustomerFeedback.score)).where(CustomerFeedback.consultancy_id == consultancy_id)
    )
    latest_feedback_date = db.scalar(
        select(func.max(CustomerFeedback.feedback_date)).where(
            CustomerFeedback.consultancy_id == consultancy_id
        )
    )

    return CustomerFeedbackSummary(
        total_feedback=total_feedback,
        average_score=float(average_raw) if average_raw is not None else None,
        satisfied_count=counts[4] + counts[5],
        neutral_count=counts[3],
        unsatisfied_count=counts[1] + counts[2],
        score_5_count=counts[5],
        score_4_count=counts[4],
        score_3_count=counts[3],
        score_2_count=counts[2],
        score_1_count=counts[1],
        latest_feedback_date=latest_feedback_date,
    )

