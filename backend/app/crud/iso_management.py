from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.action_task import ActionTask
from app.models.audit_report_recommendation import AuditReportRecommendation
from app.models.client import Client
from app.models.iso_change_plan import IsoChangePlan
from app.models.iso_context_profile import IsoContextProfile
from app.models.iso_improvement import IsoImprovement
from app.models.iso_interested_party import IsoInterestedParty
from app.models.iso_nonconformity import IsoNonconformity
from app.models.iso_process_map_item import IsoProcessMapItem
from app.models.iso_quality_objective import IsoQualityObjective
from app.models.iso_role_assignment import IsoRoleAssignment
from app.models.kpi_indicator import KpiIndicator
from app.models.quality_policy import QualityPolicy

INTERESTED_PARTY_TYPE_VALUES = {
    "internal",
    "external",
    "customer",
    "supplier",
    "regulator",
    "other",
}
PRIORITY_VALUES = {"low", "medium", "high"}
ACTIVE_STATUS_VALUES = {"active", "inactive"}
PROCESS_TYPE_VALUES = {"strategic", "operational", "support"}
OBJECTIVE_STATUS_VALUES = {"planned", "in_progress", "completed", "on_hold"}
CHANGE_PLAN_STATUS_VALUES = {"planned", "in_progress", "completed", "cancelled"}
NONCONFORMITY_ORIGIN_TYPE_VALUES = {"audit", "complaint", "process", "supplier", "kpi", "other"}
NONCONFORMITY_STATUS_VALUES = {"open", "in_progress", "pending_verification", "closed"}
IMPROVEMENT_SOURCE_TYPE_VALUES = {
    "risk_opportunity",
    "audit_recommendation",
    "nonconformity",
    "management_review",
    "other",
}
IMPROVEMENT_STATUS_VALUES = {"proposed", "in_progress", "implemented", "validated", "closed"}


@dataclass(frozen=True)
class IsoQualityObjectiveSummary:
    total: int
    planned: int
    in_progress: int
    completed: int
    on_hold: int
    linked_to_kpi: int


@dataclass(frozen=True)
class IsoNonconformitySummary:
    total: int
    open_count: int
    in_progress_count: int
    pending_verification_count: int
    closed_count: int


@dataclass(frozen=True)
class IsoImprovementSummary:
    total: int
    proposed: int
    in_progress: int
    implemented: int
    validated: int
    closed: int


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


def _normalize_choice(value: str | None, field_name: str, valid_values: set[str]) -> str:
    normalized = _normalize_required_text(value, field_name).lower()
    if normalized not in valid_values:
        allowed = ", ".join(sorted(valid_values))
        raise ValueError(f"{field_name} inválido. Valores permitidos: {allowed}")
    return normalized


def _validate_date_order(*, from_value: date | None, to_value: date | None, from_field: str, to_field: str) -> None:
    if from_value is not None and to_value is not None and from_value > to_value:
        raise ValueError(f"{from_field} no puede ser mayor que {to_field}")


def _ensure_client_belongs_consultancy(db: Session, *, consultancy_id: UUID, client_id: UUID) -> None:
    exists = db.scalar(
        select(func.count(Client.id)).where(
            Client.id == client_id,
            Client.consultancy_id == consultancy_id,
        )
    )
    if int(exists or 0) == 0:
        raise ValueError("El client_id no pertenece a la consultoria autenticada")


def _ensure_kpi_belongs_consultancy(db: Session, *, consultancy_id: UUID, kpi_id: UUID) -> None:
    exists = db.scalar(
        select(func.count(KpiIndicator.id)).where(
            KpiIndicator.id == kpi_id,
            KpiIndicator.consultancy_id == consultancy_id,
        )
    )
    if int(exists or 0) == 0:
        raise ValueError("El linked_kpi_id no pertenece a la consultoria autenticada")


def _ensure_recommendation_belongs_consultancy(db: Session, *, consultancy_id: UUID, recommendation_id: UUID) -> None:
    exists = db.scalar(
        select(func.count(AuditReportRecommendation.id)).where(
            AuditReportRecommendation.id == recommendation_id,
            AuditReportRecommendation.consultancy_id == consultancy_id,
        )
    )
    if int(exists or 0) == 0:
        raise ValueError("La recomendacion origen no existe para la consultoria autenticada")


def _ensure_action_task_exists(db: Session, *, task_id: UUID) -> None:
    exists = db.scalar(select(func.count(ActionTask.id)).where(ActionTask.id == task_id))
    if int(exists or 0) == 0:
        raise ValueError("La accion vinculada no existe")


def _ensure_nonconformity_belongs_consultancy(db: Session, *, consultancy_id: UUID, nonconformity_id: UUID) -> None:
    exists = db.scalar(
        select(func.count(IsoNonconformity.id)).where(
            IsoNonconformity.id == nonconformity_id,
            IsoNonconformity.consultancy_id == consultancy_id,
        )
    )
    if int(exists or 0) == 0:
        raise ValueError("La no conformidad vinculada no pertenece a la consultoria autenticada")


def _toggle_policy_activation(
    db: Session,
    *,
    consultancy_id: UUID,
    client_id: UUID | None,
    exclude_policy_id: UUID | None = None,
) -> None:
    if client_id is None:
        condition = QualityPolicy.client_id.is_(None)
    else:
        condition = QualityPolicy.client_id == client_id

    stmt = (
        update(QualityPolicy)
        .where(
            QualityPolicy.consultancy_id == consultancy_id,
            condition,
        )
        .values(is_active=False)
    )
    if exclude_policy_id is not None:
        stmt = stmt.where(QualityPolicy.id != exclude_policy_id)
    db.execute(stmt)


def _validate_nonconformity_lifecycle(nc: IsoNonconformity) -> None:
    _validate_date_order(
        from_value=nc.due_date,
        to_value=nc.verification_date,
        from_field="due_date",
        to_field="verification_date",
    )
    if nc.status == "pending_verification" and _normalize_optional_text(nc.corrective_action) is None:
        raise ValueError("corrective_action es requerido para estado pending_verification")

    if nc.status == "closed":
        if _normalize_optional_text(nc.corrective_action) is None:
            raise ValueError("No puedes cerrar la no conformidad sin accion correctiva")
        if _normalize_optional_text(nc.effectiveness_verification) is None:
            raise ValueError("No puedes cerrar la no conformidad sin verificación de eficacia")
        if nc.verification_date is None:
            raise ValueError("No puedes cerrar la no conformidad sin verification_date")
        if nc.closed_at is None:
            nc.closed_at = datetime.now(timezone.utc)
    else:
        nc.closed_at = None


def _validate_change_plan_dates(plan: IsoChangePlan) -> None:
    _validate_date_order(
        from_value=plan.planned_date,
        to_value=plan.completion_date,
        from_field="planned_date",
        to_field="completion_date",
    )
    if plan.status == "completed" and plan.completion_date is None:
        raise ValueError("completion_date es requerido cuando status es completed")


def get_iso_context_profile_or_none(db: Session, *, consultancy_id: UUID) -> IsoContextProfile | None:
    return db.scalar(
        select(IsoContextProfile).where(IsoContextProfile.consultancy_id == consultancy_id)
    )


def upsert_iso_context_profile(
    db: Session,
    *,
    consultancy_id: UUID,
    updated_by_user_id: UUID,
    internal_context: str,
    external_context: str,
    system_scope: str,
    exclusions: str | None,
    review_date: date,
    next_review_date: date | None,
) -> IsoContextProfile:
    _validate_date_order(
        from_value=review_date,
        to_value=next_review_date,
        from_field="review_date",
        to_field="next_review_date",
    )
    profile = get_iso_context_profile_or_none(db, consultancy_id=consultancy_id)
    if profile is None:
        profile = IsoContextProfile(
            consultancy_id=consultancy_id,
            updated_by_user_id=updated_by_user_id,
            internal_context=_normalize_required_text(internal_context, "internal_context"),
            external_context=_normalize_required_text(external_context, "external_context"),
            system_scope=_normalize_required_text(system_scope, "system_scope"),
            exclusions=_normalize_optional_text(exclusions),
            review_date=review_date,
            next_review_date=next_review_date,
        )
        db.add(profile)
    else:
        profile.updated_by_user_id = updated_by_user_id
        profile.internal_context = _normalize_required_text(internal_context, "internal_context")
        profile.external_context = _normalize_required_text(external_context, "external_context")
        profile.system_scope = _normalize_required_text(system_scope, "system_scope")
        profile.exclusions = _normalize_optional_text(exclusions)
        profile.review_date = review_date
        profile.next_review_date = next_review_date
    db.flush()
    return profile


def list_iso_interested_parties(
    db: Session,
    *,
    consultancy_id: UUID,
    party_type: str | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> list[IsoInterestedParty]:
    query = select(IsoInterestedParty).where(IsoInterestedParty.consultancy_id == consultancy_id)
    if party_type:
        query = query.where(IsoInterestedParty.party_type == party_type)
    if priority:
        query = query.where(IsoInterestedParty.priority == priority)
    if status:
        query = query.where(IsoInterestedParty.status == status)
    return list(
        db.scalars(
            query.order_by(
                IsoInterestedParty.priority.desc(),
                IsoInterestedParty.name.asc(),
                IsoInterestedParty.created_at.desc(),
            )
        ).all()
    )


def get_iso_interested_party_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    party_id: UUID,
) -> IsoInterestedParty | None:
    return db.scalar(
        select(IsoInterestedParty).where(
            IsoInterestedParty.id == party_id,
            IsoInterestedParty.consultancy_id == consultancy_id,
        )
    )


def create_iso_interested_party(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    name: str,
    party_type: str,
    needs_expectations: str,
    monitoring_method: str | None,
    priority: str,
    status: str,
    review_date: date | None,
) -> IsoInterestedParty:
    item = IsoInterestedParty(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        name=_normalize_required_text(name, "name"),
        party_type=_normalize_choice(party_type, "party_type", INTERESTED_PARTY_TYPE_VALUES),
        needs_expectations=_normalize_required_text(needs_expectations, "needs_expectations"),
        monitoring_method=_normalize_optional_text(monitoring_method),
        priority=_normalize_choice(priority, "priority", PRIORITY_VALUES),
        status=_normalize_choice(status, "status", ACTIVE_STATUS_VALUES),
        review_date=review_date,
    )
    db.add(item)
    db.flush()
    return item


def update_iso_interested_party(
    db: Session,
    *,
    party: IsoInterestedParty,
    updated_by_user_id: UUID,
    data: dict,
) -> IsoInterestedParty:
    if "name" in data:
        party.name = _normalize_required_text(data["name"], "name")
    if "party_type" in data:
        party.party_type = _normalize_choice(data["party_type"], "party_type", INTERESTED_PARTY_TYPE_VALUES)
    if "needs_expectations" in data:
        party.needs_expectations = _normalize_required_text(data["needs_expectations"], "needs_expectations")
    if "monitoring_method" in data:
        party.monitoring_method = _normalize_optional_text(data["monitoring_method"])
    if "priority" in data:
        party.priority = _normalize_choice(data["priority"], "priority", PRIORITY_VALUES)
    if "status" in data:
        party.status = _normalize_choice(data["status"], "status", ACTIVE_STATUS_VALUES)
    if "review_date" in data:
        party.review_date = data["review_date"]

    party.updated_by_user_id = updated_by_user_id
    db.flush()
    return party


def delete_iso_interested_party(db: Session, *, party: IsoInterestedParty) -> None:
    db.delete(party)
    db.flush()


def list_quality_policies(
    db: Session,
    *,
    consultancy_id: UUID,
    client_id: UUID | None = None,
    is_active: bool | None = None,
) -> list[QualityPolicy]:
    query = select(QualityPolicy).where(QualityPolicy.consultancy_id == consultancy_id)
    if client_id is not None:
        query = query.where(QualityPolicy.client_id == client_id)
    if is_active is not None:
        query = query.where(QualityPolicy.is_active == is_active)
    return list(
        db.scalars(
            query.order_by(
                QualityPolicy.is_active.desc(),
                QualityPolicy.approved_date.desc().nullslast(),
                QualityPolicy.created_at.desc(),
            )
        ).all()
    )


def get_quality_policy_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    policy_id: UUID,
) -> QualityPolicy | None:
    return db.scalar(
        select(QualityPolicy).where(
            QualityPolicy.id == policy_id,
            QualityPolicy.consultancy_id == consultancy_id,
        )
    )


def create_quality_policy(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    client_id: UUID | None,
    version_label: str,
    policy_text: str,
    approved_by_name: str | None,
    approved_date: date | None,
    review_date: date | None,
    is_active: bool,
) -> QualityPolicy:
    if client_id is not None:
        _ensure_client_belongs_consultancy(db, consultancy_id=consultancy_id, client_id=client_id)

    if is_active:
        _toggle_policy_activation(
            db,
            consultancy_id=consultancy_id,
            client_id=client_id,
            exclude_policy_id=None,
        )

    policy = QualityPolicy(
        consultancy_id=consultancy_id,
        client_id=client_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        version_label=_normalize_required_text(version_label, "version_label"),
        policy_text=_normalize_required_text(policy_text, "policy_text"),
        approved_by_name=_normalize_optional_text(approved_by_name),
        approved_date=approved_date,
        review_date=review_date,
        is_active=bool(is_active),
    )
    db.add(policy)
    db.flush()
    return policy


def update_quality_policy(
    db: Session,
    *,
    policy: QualityPolicy,
    updated_by_user_id: UUID,
    data: dict,
) -> QualityPolicy:
    next_client_id = policy.client_id
    if "client_id" in data:
        next_client_id = data["client_id"]
        if next_client_id is not None:
            _ensure_client_belongs_consultancy(
                db,
                consultancy_id=policy.consultancy_id,
                client_id=next_client_id,
            )
        policy.client_id = next_client_id

    if "version_label" in data:
        policy.version_label = _normalize_required_text(data["version_label"], "version_label")
    if "policy_text" in data:
        policy.policy_text = _normalize_required_text(data["policy_text"], "policy_text")
    if "approved_by_name" in data:
        policy.approved_by_name = _normalize_optional_text(data["approved_by_name"])
    if "approved_date" in data:
        policy.approved_date = data["approved_date"]
    if "review_date" in data:
        policy.review_date = data["review_date"]
    if "is_active" in data:
        policy.is_active = bool(data["is_active"])

    if policy.is_active:
        _toggle_policy_activation(
            db,
            consultancy_id=policy.consultancy_id,
            client_id=policy.client_id,
            exclude_policy_id=policy.id,
        )

    policy.updated_by_user_id = updated_by_user_id
    db.flush()
    return policy


def delete_quality_policy(db: Session, *, policy: QualityPolicy) -> None:
    db.delete(policy)
    db.flush()


def list_iso_role_assignments(
    db: Session,
    *,
    consultancy_id: UUID,
    status: str | None = None,
) -> list[IsoRoleAssignment]:
    query = select(IsoRoleAssignment).where(IsoRoleAssignment.consultancy_id == consultancy_id)
    if status:
        query = query.where(IsoRoleAssignment.status == status)
    return list(
        db.scalars(
            query.order_by(
                IsoRoleAssignment.role_name.asc(),
                IsoRoleAssignment.responsible_name.asc(),
            )
        ).all()
    )


def get_iso_role_assignment_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    role_id: UUID,
) -> IsoRoleAssignment | None:
    return db.scalar(
        select(IsoRoleAssignment).where(
            IsoRoleAssignment.id == role_id,
            IsoRoleAssignment.consultancy_id == consultancy_id,
        )
    )


def create_iso_role_assignment(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    role_name: str,
    responsible_name: str,
    responsibility_details: str,
    related_process: str | None,
    status: str,
) -> IsoRoleAssignment:
    item = IsoRoleAssignment(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        role_name=_normalize_required_text(role_name, "role_name"),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        responsibility_details=_normalize_required_text(responsibility_details, "responsibility_details"),
        related_process=_normalize_optional_text(related_process),
        status=_normalize_choice(status, "status", ACTIVE_STATUS_VALUES),
    )
    db.add(item)
    db.flush()
    return item


def update_iso_role_assignment(
    db: Session,
    *,
    role: IsoRoleAssignment,
    updated_by_user_id: UUID,
    data: dict,
) -> IsoRoleAssignment:
    if "role_name" in data:
        role.role_name = _normalize_required_text(data["role_name"], "role_name")
    if "responsible_name" in data:
        role.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")
    if "responsibility_details" in data:
        role.responsibility_details = _normalize_required_text(
            data["responsibility_details"],
            "responsibility_details",
        )
    if "related_process" in data:
        role.related_process = _normalize_optional_text(data["related_process"])
    if "status" in data:
        role.status = _normalize_choice(data["status"], "status", ACTIVE_STATUS_VALUES)
    role.updated_by_user_id = updated_by_user_id
    db.flush()
    return role


def delete_iso_role_assignment(db: Session, *, role: IsoRoleAssignment) -> None:
    db.delete(role)
    db.flush()


def list_iso_process_map_items(
    db: Session,
    *,
    consultancy_id: UUID,
    process_type: str | None = None,
    status: str | None = None,
) -> list[IsoProcessMapItem]:
    query = select(IsoProcessMapItem).where(IsoProcessMapItem.consultancy_id == consultancy_id)
    if process_type:
        query = query.where(IsoProcessMapItem.process_type == process_type)
    if status:
        query = query.where(IsoProcessMapItem.status == status)
    return list(
        db.scalars(
            query.order_by(
                IsoProcessMapItem.position_order.asc(),
                IsoProcessMapItem.process_type.asc(),
                IsoProcessMapItem.name.asc(),
            )
        ).all()
    )


def get_iso_process_map_item_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    process_id: UUID,
) -> IsoProcessMapItem | None:
    return db.scalar(
        select(IsoProcessMapItem).where(
            IsoProcessMapItem.id == process_id,
            IsoProcessMapItem.consultancy_id == consultancy_id,
        )
    )


def create_iso_process_map_item(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    name: str,
    process_type: str,
    description: str,
    process_inputs: str | None,
    process_outputs: str | None,
    responsible_name: str,
    position_order: int,
    status: str,
) -> IsoProcessMapItem:
    if position_order < 0:
        raise ValueError("position_order debe ser mayor año igual a 0")
    item = IsoProcessMapItem(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        name=_normalize_required_text(name, "name"),
        process_type=_normalize_choice(process_type, "process_type", PROCESS_TYPE_VALUES),
        description=_normalize_required_text(description, "description"),
        process_inputs=_normalize_optional_text(process_inputs),
        process_outputs=_normalize_optional_text(process_outputs),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        position_order=position_order,
        status=_normalize_choice(status, "status", ACTIVE_STATUS_VALUES),
    )
    db.add(item)
    db.flush()
    return item


def update_iso_process_map_item(
    db: Session,
    *,
    process: IsoProcessMapItem,
    updated_by_user_id: UUID,
    data: dict,
) -> IsoProcessMapItem:
    if "name" in data:
        process.name = _normalize_required_text(data["name"], "name")
    if "process_type" in data:
        process.process_type = _normalize_choice(data["process_type"], "process_type", PROCESS_TYPE_VALUES)
    if "description" in data:
        process.description = _normalize_required_text(data["description"], "description")
    if "process_inputs" in data:
        process.process_inputs = _normalize_optional_text(data["process_inputs"])
    if "process_outputs" in data:
        process.process_outputs = _normalize_optional_text(data["process_outputs"])
    if "responsible_name" in data:
        process.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")
    if "position_order" in data:
        position_order = int(data["position_order"])
        if position_order < 0:
            raise ValueError("position_order debe ser mayor año igual a 0")
        process.position_order = position_order
    if "status" in data:
        process.status = _normalize_choice(data["status"], "status", ACTIVE_STATUS_VALUES)
    process.updated_by_user_id = updated_by_user_id
    db.flush()
    return process


def delete_iso_process_map_item(db: Session, *, process: IsoProcessMapItem) -> None:
    db.delete(process)
    db.flush()


def list_iso_quality_objectives(
    db: Session,
    *,
    consultancy_id: UUID,
    status: str | None = None,
    target_date_from: date | None = None,
    target_date_to: date | None = None,
) -> list[IsoQualityObjective]:
    query = select(IsoQualityObjective).where(IsoQualityObjective.consultancy_id == consultancy_id)
    if status:
        query = query.where(IsoQualityObjective.status == status)
    if target_date_from is not None:
        query = query.where(
            IsoQualityObjective.target_date.is_not(None),
            IsoQualityObjective.target_date >= target_date_from,
        )
    if target_date_to is not None:
        query = query.where(
            IsoQualityObjective.target_date.is_not(None),
            IsoQualityObjective.target_date <= target_date_to,
        )
    return list(
        db.scalars(
            query.order_by(
                IsoQualityObjective.target_date.asc().nullslast(),
                IsoQualityObjective.created_at.desc(),
            )
        ).all()
    )


def get_iso_quality_objective_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    objective_id: UUID,
) -> IsoQualityObjective | None:
    return db.scalar(
        select(IsoQualityObjective).where(
            IsoQualityObjective.id == objective_id,
            IsoQualityObjective.consultancy_id == consultancy_id,
        )
    )


def create_iso_quality_objective(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    linked_kpi_id: UUID | None,
    title: str,
    description: str,
    period_label: str,
    responsible_name: str,
    status: str,
    tracking_notes: str | None,
    target_date: date | None,
    review_date: date | None,
) -> IsoQualityObjective:
    if linked_kpi_id is not None:
        _ensure_kpi_belongs_consultancy(db, consultancy_id=consultancy_id, kpi_id=linked_kpi_id)
    _validate_date_order(
        from_value=target_date,
        to_value=review_date,
        from_field="target_date",
        to_field="review_date",
    )
    item = IsoQualityObjective(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        linked_kpi_id=linked_kpi_id,
        title=_normalize_required_text(title, "title"),
        description=_normalize_required_text(description, "description"),
        period_label=_normalize_required_text(period_label, "period_label"),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        status=_normalize_choice(status, "status", OBJECTIVE_STATUS_VALUES),
        tracking_notes=_normalize_optional_text(tracking_notes),
        target_date=target_date,
        review_date=review_date,
    )
    db.add(item)
    db.flush()
    return item


def update_iso_quality_objective(
    db: Session,
    *,
    objective: IsoQualityObjective,
    updated_by_user_id: UUID,
    data: dict,
) -> IsoQualityObjective:
    if "linked_kpi_id" in data:
        linked_kpi_id = data["linked_kpi_id"]
        if linked_kpi_id is not None:
            _ensure_kpi_belongs_consultancy(
                db,
                consultancy_id=objective.consultancy_id,
                kpi_id=linked_kpi_id,
            )
        objective.linked_kpi_id = linked_kpi_id
    if "title" in data:
        objective.title = _normalize_required_text(data["title"], "title")
    if "description" in data:
        objective.description = _normalize_required_text(data["description"], "description")
    if "period_label" in data:
        objective.period_label = _normalize_required_text(data["period_label"], "period_label")
    if "responsible_name" in data:
        objective.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")
    if "status" in data:
        objective.status = _normalize_choice(data["status"], "status", OBJECTIVE_STATUS_VALUES)
    if "tracking_notes" in data:
        objective.tracking_notes = _normalize_optional_text(data["tracking_notes"])
    if "target_date" in data:
        objective.target_date = data["target_date"]
    if "review_date" in data:
        objective.review_date = data["review_date"]

    _validate_date_order(
        from_value=objective.target_date,
        to_value=objective.review_date,
        from_field="target_date",
        to_field="review_date",
    )
    objective.updated_by_user_id = updated_by_user_id
    db.flush()
    return objective


def delete_iso_quality_objective(db: Session, *, objective: IsoQualityObjective) -> None:
    db.delete(objective)
    db.flush()


def get_iso_quality_objective_summary(
    db: Session,
    *,
    consultancy_id: UUID,
) -> IsoQualityObjectiveSummary:
    rows = db.execute(
        select(IsoQualityObjective.status, func.count(IsoQualityObjective.id))
        .where(IsoQualityObjective.consultancy_id == consultancy_id)
        .group_by(IsoQualityObjective.status)
    ).all()
    counts = {status: 0 for status in OBJECTIVE_STATUS_VALUES}
    total = 0
    for status, count in rows:
        key = str(status or "").strip().lower()
        if key in counts:
            counts[key] = int(count)
            total += int(count)
    linked_to_kpi = int(
        db.scalar(
            select(func.count(IsoQualityObjective.id)).where(
                IsoQualityObjective.consultancy_id == consultancy_id,
                IsoQualityObjective.linked_kpi_id.is_not(None),
            )
        )
        or 0
    )
    return IsoQualityObjectiveSummary(
        total=total,
        planned=counts["planned"],
        in_progress=counts["in_progress"],
        completed=counts["completed"],
        on_hold=counts["on_hold"],
        linked_to_kpi=linked_to_kpi,
    )


def list_iso_change_plans(
    db: Session,
    *,
    consultancy_id: UUID,
    status: str | None = None,
    planned_date_from: date | None = None,
    planned_date_to: date | None = None,
) -> list[IsoChangePlan]:
    query = select(IsoChangePlan).where(IsoChangePlan.consultancy_id == consultancy_id)
    if status:
        query = query.where(IsoChangePlan.status == status)
    if planned_date_from is not None:
        query = query.where(IsoChangePlan.planned_date >= planned_date_from)
    if planned_date_to is not None:
        query = query.where(IsoChangePlan.planned_date <= planned_date_to)
    return list(
        db.scalars(
            query.order_by(
                IsoChangePlan.planned_date.asc(),
                IsoChangePlan.created_at.desc(),
            )
        ).all()
    )


def get_iso_change_plan_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    change_id: UUID,
) -> IsoChangePlan | None:
    return db.scalar(
        select(IsoChangePlan).where(
            IsoChangePlan.id == change_id,
            IsoChangePlan.consultancy_id == consultancy_id,
        )
    )


def create_iso_change_plan(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    change_title: str,
    reason: str,
    impact: str,
    responsible_name: str,
    planned_date: date,
    status: str,
    followup_notes: str | None,
    completion_date: date | None,
) -> IsoChangePlan:
    item = IsoChangePlan(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        change_title=_normalize_required_text(change_title, "change_title"),
        reason=_normalize_required_text(reason, "reason"),
        impact=_normalize_required_text(impact, "impact"),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        planned_date=planned_date,
        status=_normalize_choice(status, "status", CHANGE_PLAN_STATUS_VALUES),
        followup_notes=_normalize_optional_text(followup_notes),
        completion_date=completion_date,
    )
    _validate_change_plan_dates(item)
    db.add(item)
    db.flush()
    return item


def update_iso_change_plan(
    db: Session,
    *,
    plan: IsoChangePlan,
    updated_by_user_id: UUID,
    data: dict,
) -> IsoChangePlan:
    if "change_title" in data:
        plan.change_title = _normalize_required_text(data["change_title"], "change_title")
    if "reason" in data:
        plan.reason = _normalize_required_text(data["reason"], "reason")
    if "impact" in data:
        plan.impact = _normalize_required_text(data["impact"], "impact")
    if "responsible_name" in data:
        plan.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")
    if "planned_date" in data:
        plan.planned_date = data["planned_date"]
    if "status" in data:
        plan.status = _normalize_choice(data["status"], "status", CHANGE_PLAN_STATUS_VALUES)
    if "followup_notes" in data:
        plan.followup_notes = _normalize_optional_text(data["followup_notes"])
    if "completion_date" in data:
        plan.completion_date = data["completion_date"]

    _validate_change_plan_dates(plan)
    plan.updated_by_user_id = updated_by_user_id
    db.flush()
    return plan


def delete_iso_change_plan(db: Session, *, plan: IsoChangePlan) -> None:
    db.delete(plan)
    db.flush()


def list_iso_nonconformities(
    db: Session,
    *,
    consultancy_id: UUID,
    status: str | None = None,
    origin_type: str | None = None,
    due_date_from: date | None = None,
    due_date_to: date | None = None,
    client_id: UUID | None = None,
) -> list[IsoNonconformity]:
    query = select(IsoNonconformity).where(IsoNonconformity.consultancy_id == consultancy_id)
    if status:
        query = query.where(IsoNonconformity.status == status)
    if origin_type:
        query = query.where(IsoNonconformity.origin_type == origin_type)
    if due_date_from is not None:
        query = query.where(
            IsoNonconformity.due_date.is_not(None),
            IsoNonconformity.due_date >= due_date_from,
        )
    if due_date_to is not None:
        query = query.where(
            IsoNonconformity.due_date.is_not(None),
            IsoNonconformity.due_date <= due_date_to,
        )
    if client_id is not None:
        query = query.where(IsoNonconformity.client_id == client_id)
    return list(
        db.scalars(
            query.order_by(
                IsoNonconformity.status.asc(),
                IsoNonconformity.due_date.asc().nullslast(),
                IsoNonconformity.created_at.desc(),
            )
        ).all()
    )


def get_iso_nonconformity_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    nc_id: UUID,
) -> IsoNonconformity | None:
    return db.scalar(
        select(IsoNonconformity).where(
            IsoNonconformity.id == nc_id,
            IsoNonconformity.consultancy_id == consultancy_id,
        )
    )


def create_iso_nonconformity(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    client_id: UUID | None,
    source_recommendation_id: UUID | None,
    linked_action_task_id: UUID | None,
    origin_type: str,
    title: str,
    description: str,
    cause_analysis: str | None,
    immediate_correction: str | None,
    corrective_action: str | None,
    responsible_name: str,
    due_date: date | None,
    effectiveness_verification: str | None,
    verification_date: date | None,
    status: str,
    closure_notes: str | None,
) -> IsoNonconformity:
    if client_id is not None:
        _ensure_client_belongs_consultancy(db, consultancy_id=consultancy_id, client_id=client_id)
    if source_recommendation_id is not None:
        _ensure_recommendation_belongs_consultancy(
            db,
            consultancy_id=consultancy_id,
            recommendation_id=source_recommendation_id,
        )
    if linked_action_task_id is not None:
        _ensure_action_task_exists(db, task_id=linked_action_task_id)

    item = IsoNonconformity(
        consultancy_id=consultancy_id,
        client_id=client_id,
        source_recommendation_id=source_recommendation_id,
        linked_action_task_id=linked_action_task_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        origin_type=_normalize_choice(origin_type, "origin_type", NONCONFORMITY_ORIGIN_TYPE_VALUES),
        title=_normalize_required_text(title, "title"),
        description=_normalize_required_text(description, "description"),
        cause_analysis=_normalize_optional_text(cause_analysis),
        immediate_correction=_normalize_optional_text(immediate_correction),
        corrective_action=_normalize_optional_text(corrective_action),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        due_date=due_date,
        effectiveness_verification=_normalize_optional_text(effectiveness_verification),
        verification_date=verification_date,
        status=_normalize_choice(status, "status", NONCONFORMITY_STATUS_VALUES),
        closure_notes=_normalize_optional_text(closure_notes),
    )
    _validate_nonconformity_lifecycle(item)
    db.add(item)
    db.flush()
    return item


def update_iso_nonconformity(
    db: Session,
    *,
    nc: IsoNonconformity,
    updated_by_user_id: UUID,
    data: dict,
) -> IsoNonconformity:
    if "client_id" in data:
        client_id = data["client_id"]
        if client_id is not None:
            _ensure_client_belongs_consultancy(
                db,
                consultancy_id=nc.consultancy_id,
                client_id=client_id,
            )
        nc.client_id = client_id
    if "source_recommendation_id" in data:
        recommendation_id = data["source_recommendation_id"]
        if recommendation_id is not None:
            _ensure_recommendation_belongs_consultancy(
                db,
                consultancy_id=nc.consultancy_id,
                recommendation_id=recommendation_id,
            )
        nc.source_recommendation_id = recommendation_id
    if "linked_action_task_id" in data:
        task_id = data["linked_action_task_id"]
        if task_id is not None:
            _ensure_action_task_exists(db, task_id=task_id)
        nc.linked_action_task_id = task_id
    if "origin_type" in data:
        nc.origin_type = _normalize_choice(data["origin_type"], "origin_type", NONCONFORMITY_ORIGIN_TYPE_VALUES)
    if "title" in data:
        nc.title = _normalize_required_text(data["title"], "title")
    if "description" in data:
        nc.description = _normalize_required_text(data["description"], "description")
    if "cause_analysis" in data:
        nc.cause_analysis = _normalize_optional_text(data["cause_analysis"])
    if "immediate_correction" in data:
        nc.immediate_correction = _normalize_optional_text(data["immediate_correction"])
    if "corrective_action" in data:
        nc.corrective_action = _normalize_optional_text(data["corrective_action"])
    if "responsible_name" in data:
        nc.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")
    if "due_date" in data:
        nc.due_date = data["due_date"]
    if "effectiveness_verification" in data:
        nc.effectiveness_verification = _normalize_optional_text(data["effectiveness_verification"])
    if "verification_date" in data:
        nc.verification_date = data["verification_date"]
    if "status" in data:
        nc.status = _normalize_choice(data["status"], "status", NONCONFORMITY_STATUS_VALUES)
    if "closure_notes" in data:
        nc.closure_notes = _normalize_optional_text(data["closure_notes"])

    _validate_nonconformity_lifecycle(nc)
    nc.updated_by_user_id = updated_by_user_id
    db.flush()
    return nc


def delete_iso_nonconformity(db: Session, *, nc: IsoNonconformity) -> None:
    db.delete(nc)
    db.flush()


def get_iso_nonconformity_summary(
    db: Session,
    *,
    consultancy_id: UUID,
) -> IsoNonconformitySummary:
    rows = db.execute(
        select(IsoNonconformity.status, func.count(IsoNonconformity.id))
        .where(IsoNonconformity.consultancy_id == consultancy_id)
        .group_by(IsoNonconformity.status)
    ).all()
    counts = {status: 0 for status in NONCONFORMITY_STATUS_VALUES}
    total = 0
    for status, count in rows:
        key = str(status or "").strip().lower()
        if key in counts:
            counts[key] = int(count)
            total += int(count)
    return IsoNonconformitySummary(
        total=total,
        open_count=counts["open"],
        in_progress_count=counts["in_progress"],
        pending_verification_count=counts["pending_verification"],
        closed_count=counts["closed"],
    )


def list_iso_improvements(
    db: Session,
    *,
    consultancy_id: UUID,
    status: str | None = None,
    source_type: str | None = None,
    due_date_from: date | None = None,
    due_date_to: date | None = None,
) -> list[IsoImprovement]:
    query = select(IsoImprovement).where(IsoImprovement.consultancy_id == consultancy_id)
    if status:
        query = query.where(IsoImprovement.status == status)
    if source_type:
        query = query.where(IsoImprovement.source_type == source_type)
    if due_date_from is not None:
        query = query.where(
            IsoImprovement.due_date.is_not(None),
            IsoImprovement.due_date >= due_date_from,
        )
    if due_date_to is not None:
        query = query.where(
            IsoImprovement.due_date.is_not(None),
            IsoImprovement.due_date <= due_date_to,
        )
    return list(
        db.scalars(
            query.order_by(
                IsoImprovement.status.asc(),
                IsoImprovement.due_date.asc().nullslast(),
                IsoImprovement.created_at.desc(),
            )
        ).all()
    )


def get_iso_improvement_or_none(
    db: Session,
    *,
    consultancy_id: UUID,
    improvement_id: UUID,
) -> IsoImprovement | None:
    return db.scalar(
        select(IsoImprovement).where(
            IsoImprovement.id == improvement_id,
            IsoImprovement.consultancy_id == consultancy_id,
        )
    )


def create_iso_improvement(
    db: Session,
    *,
    consultancy_id: UUID,
    created_by_user_id: UUID,
    linked_nonconformity_id: UUID | None,
    source_type: str,
    source_id: UUID | None,
    title: str,
    description: str,
    action_plan: str,
    responsible_name: str,
    status: str,
    due_date: date | None,
    followup_notes: str | None,
    benefit_observed: str | None,
    review_date: date | None,
) -> IsoImprovement:
    if linked_nonconformity_id is not None:
        _ensure_nonconformity_belongs_consultancy(
            db,
            consultancy_id=consultancy_id,
            nonconformity_id=linked_nonconformity_id,
        )
    _validate_date_order(
        from_value=due_date,
        to_value=review_date,
        from_field="due_date",
        to_field="review_date",
    )
    item = IsoImprovement(
        consultancy_id=consultancy_id,
        created_by_user_id=created_by_user_id,
        updated_by_user_id=created_by_user_id,
        linked_nonconformity_id=linked_nonconformity_id,
        source_type=_normalize_choice(source_type, "source_type", IMPROVEMENT_SOURCE_TYPE_VALUES),
        source_id=source_id,
        title=_normalize_required_text(title, "title"),
        description=_normalize_required_text(description, "description"),
        action_plan=_normalize_required_text(action_plan, "action_plan"),
        responsible_name=_normalize_required_text(responsible_name, "responsible_name"),
        status=_normalize_choice(status, "status", IMPROVEMENT_STATUS_VALUES),
        due_date=due_date,
        followup_notes=_normalize_optional_text(followup_notes),
        benefit_observed=_normalize_optional_text(benefit_observed),
        review_date=review_date,
    )
    db.add(item)
    db.flush()
    return item


def update_iso_improvement(
    db: Session,
    *,
    improvement: IsoImprovement,
    updated_by_user_id: UUID,
    data: dict,
) -> IsoImprovement:
    if "linked_nonconformity_id" in data:
        linked_nonconformity_id = data["linked_nonconformity_id"]
        if linked_nonconformity_id is not None:
            _ensure_nonconformity_belongs_consultancy(
                db,
                consultancy_id=improvement.consultancy_id,
                nonconformity_id=linked_nonconformity_id,
            )
        improvement.linked_nonconformity_id = linked_nonconformity_id
    if "source_type" in data:
        improvement.source_type = _normalize_choice(
            data["source_type"],
            "source_type",
            IMPROVEMENT_SOURCE_TYPE_VALUES,
        )
    if "source_id" in data:
        improvement.source_id = data["source_id"]
    if "title" in data:
        improvement.title = _normalize_required_text(data["title"], "title")
    if "description" in data:
        improvement.description = _normalize_required_text(data["description"], "description")
    if "action_plan" in data:
        improvement.action_plan = _normalize_required_text(data["action_plan"], "action_plan")
    if "responsible_name" in data:
        improvement.responsible_name = _normalize_required_text(data["responsible_name"], "responsible_name")
    if "status" in data:
        improvement.status = _normalize_choice(data["status"], "status", IMPROVEMENT_STATUS_VALUES)
    if "due_date" in data:
        improvement.due_date = data["due_date"]
    if "followup_notes" in data:
        improvement.followup_notes = _normalize_optional_text(data["followup_notes"])
    if "benefit_observed" in data:
        improvement.benefit_observed = _normalize_optional_text(data["benefit_observed"])
    if "review_date" in data:
        improvement.review_date = data["review_date"]

    _validate_date_order(
        from_value=improvement.due_date,
        to_value=improvement.review_date,
        from_field="due_date",
        to_field="review_date",
    )
    improvement.updated_by_user_id = updated_by_user_id
    db.flush()
    return improvement


def delete_iso_improvement(db: Session, *, improvement: IsoImprovement) -> None:
    db.delete(improvement)
    db.flush()


def get_iso_improvement_summary(db: Session, *, consultancy_id: UUID) -> IsoImprovementSummary:
    rows = db.execute(
        select(IsoImprovement.status, func.count(IsoImprovement.id))
        .where(IsoImprovement.consultancy_id == consultancy_id)
        .group_by(IsoImprovement.status)
    ).all()
    counts = {status: 0 for status in IMPROVEMENT_STATUS_VALUES}
    total = 0
    for status, count in rows:
        key = str(status or "").strip().lower()
        if key in counts:
            counts[key] = int(count)
            total += int(count)
    return IsoImprovementSummary(
        total=total,
        proposed=counts["proposed"],
        in_progress=counts["in_progress"],
        implemented=counts["implemented"],
        validated=counts["validated"],
        closed=counts["closed"],
    )


