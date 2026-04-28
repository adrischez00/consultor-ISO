import logging
from contextlib import contextmanager
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.crud.iso_management import (
    ACTIVE_STATUS_VALUES,
    CHANGE_PLAN_STATUS_VALUES,
    IMPROVEMENT_SOURCE_TYPE_VALUES,
    IMPROVEMENT_STATUS_VALUES,
    INTERESTED_PARTY_TYPE_VALUES,
    NONCONFORMITY_ORIGIN_TYPE_VALUES,
    NONCONFORMITY_STATUS_VALUES,
    OBJECTIVE_STATUS_VALUES,
    PRIORITY_VALUES,
    PROCESS_TYPE_VALUES,
    create_iso_change_plan,
    create_iso_improvement,
    create_iso_interested_party,
    create_iso_nonconformity,
    create_iso_process_map_item,
    create_iso_quality_objective,
    create_iso_role_assignment,
    create_quality_policy,
    delete_iso_change_plan,
    delete_iso_improvement,
    delete_iso_interested_party,
    delete_iso_nonconformity,
    delete_iso_process_map_item,
    delete_iso_quality_objective,
    delete_iso_role_assignment,
    delete_quality_policy,
    get_iso_change_plan_or_none,
    get_iso_context_profile_or_none,
    get_iso_improvement_or_none,
    get_iso_improvement_summary,
    get_iso_interested_party_or_none,
    get_iso_nonconformity_or_none,
    get_iso_nonconformity_summary,
    get_iso_process_map_item_or_none,
    get_iso_quality_objective_or_none,
    get_iso_quality_objective_summary,
    get_iso_role_assignment_or_none,
    get_quality_policy_or_none,
    list_iso_change_plans,
    list_iso_improvements,
    list_iso_interested_parties,
    list_iso_nonconformities,
    list_iso_process_map_items,
    list_iso_quality_objectives,
    list_iso_role_assignments,
    list_quality_policies,
    update_iso_change_plan,
    update_iso_improvement,
    update_iso_interested_party,
    update_iso_nonconformity,
    update_iso_process_map_item,
    update_iso_quality_objective,
    update_iso_role_assignment,
    update_quality_policy,
    upsert_iso_context_profile,
)
from app.db.session import get_db
from app.models.iso_change_plan import IsoChangePlan
from app.models.iso_context_profile import IsoContextProfile
from app.models.iso_improvement import IsoImprovement
from app.models.iso_interested_party import IsoInterestedParty
from app.models.iso_nonconformity import IsoNonconformity
from app.models.iso_process_map_item import IsoProcessMapItem
from app.models.iso_quality_objective import IsoQualityObjective
from app.models.iso_role_assignment import IsoRoleAssignment
from app.models.quality_policy import QualityPolicy
from app.schemas.iso_management import (
    IsoChangePlanCreateRequest,
    IsoChangePlanRead,
    IsoChangePlanUpdateRequest,
    IsoContextProfileRead,
    IsoContextProfileUpsertRequest,
    IsoImprovementCreateRequest,
    IsoImprovementRead,
    IsoImprovementSummaryRead,
    IsoImprovementUpdateRequest,
    IsoInterestedPartyCreateRequest,
    IsoInterestedPartyRead,
    IsoInterestedPartyUpdateRequest,
    IsoNonconformityCreateRequest,
    IsoNonconformityRead,
    IsoNonconformitySummaryRead,
    IsoNonconformityUpdateRequest,
    IsoProcessMapItemCreateRequest,
    IsoProcessMapItemRead,
    IsoProcessMapItemUpdateRequest,
    IsoQualityObjectiveCreateRequest,
    IsoQualityObjectiveRead,
    IsoQualityObjectiveSummaryRead,
    IsoQualityObjectiveUpdateRequest,
    IsoRoleAssignmentCreateRequest,
    IsoRoleAssignmentRead,
    IsoRoleAssignmentUpdateRequest,
    QualityPolicyCreateRequest,
    QualityPolicyRead,
    QualityPolicyUpdateRequest,
)

router = APIRouter(tags=["iso_management"])
logger = logging.getLogger(__name__)

ISO_MANAGEMENT_TABLES = {
    "iso_context_profiles",
    "iso_interested_parties",
    "quality_policies",
    "iso_role_assignments",
    "iso_process_map_items",
    "iso_quality_objectives",
    "iso_change_plans",
    "iso_nonconformities",
    "iso_improvements",
}


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _raise_if_iso_management_tables_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and any(table in message for table in ISO_MANAGEMENT_TABLES):
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migracion de Gestion ISO (fase 11). "
                "Ejecuta docs/sql/phase11_iso_core_completion.sql."
            ),
        ) from exc


def _normalize_enum_filter(value: str | None, *, field_name: str, valid_values: set[str]) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    if normalized not in valid_values:
        allowed = ", ".join(sorted(valid_values))
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} invalido. Valores permitidos: {allowed}",
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
        raise HTTPException(status_code=400, detail=f"{from_field} no puede ser mayor que {to_field}")


def _get_interested_party_or_404(db: Session, *, consultancy_id: UUID, party_id: UUID) -> IsoInterestedParty:
    party = get_iso_interested_party_or_none(db, consultancy_id=consultancy_id, party_id=party_id)
    if party is None:
        raise HTTPException(status_code=404, detail="Parte interesada no encontrada")
    return party


def _get_policy_or_404(db: Session, *, consultancy_id: UUID, policy_id: UUID) -> QualityPolicy:
    policy = get_quality_policy_or_none(db, consultancy_id=consultancy_id, policy_id=policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Politica de calidad no encontrada")
    return policy


def _get_role_or_404(db: Session, *, consultancy_id: UUID, role_id: UUID) -> IsoRoleAssignment:
    role = get_iso_role_assignment_or_none(db, consultancy_id=consultancy_id, role_id=role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return role


def _get_process_or_404(db: Session, *, consultancy_id: UUID, process_id: UUID) -> IsoProcessMapItem:
    process = get_iso_process_map_item_or_none(db, consultancy_id=consultancy_id, process_id=process_id)
    if process is None:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")
    return process


def _get_objective_or_404(db: Session, *, consultancy_id: UUID, objective_id: UUID) -> IsoQualityObjective:
    objective = get_iso_quality_objective_or_none(
        db,
        consultancy_id=consultancy_id,
        objective_id=objective_id,
    )
    if objective is None:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
    return objective


def _get_change_plan_or_404(db: Session, *, consultancy_id: UUID, change_id: UUID) -> IsoChangePlan:
    change = get_iso_change_plan_or_none(db, consultancy_id=consultancy_id, change_id=change_id)
    if change is None:
        raise HTTPException(status_code=404, detail="Cambio planificado no encontrado")
    return change


def _get_nonconformity_or_404(db: Session, *, consultancy_id: UUID, nc_id: UUID) -> IsoNonconformity:
    nc = get_iso_nonconformity_or_none(db, consultancy_id=consultancy_id, nc_id=nc_id)
    if nc is None:
        raise HTTPException(status_code=404, detail="No conformidad no encontrada")
    return nc


def _get_improvement_or_404(db: Session, *, consultancy_id: UUID, improvement_id: UUID) -> IsoImprovement:
    improvement = get_iso_improvement_or_none(
        db,
        consultancy_id=consultancy_id,
        improvement_id=improvement_id,
    )
    if improvement is None:
        raise HTTPException(status_code=404, detail="Mejora no encontrada")
    return improvement


@router.get("/iso-context-profile", response_model=IsoContextProfileRead | None)
def get_iso_context_profile(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoContextProfile | None:
    try:
        return get_iso_context_profile_or_none(db, consultancy_id=auth.consultancy.id)
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading iso context profile")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el contexto ISO.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading iso context profile")
        raise HTTPException(status_code=500, detail="No se pudo cargar el contexto ISO") from exc


@router.put("/iso-context-profile", response_model=IsoContextProfileRead)
def put_iso_context_profile(
    payload: IsoContextProfileUpsertRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoContextProfile:
    try:
        with _transaction_scope(db):
            profile = upsert_iso_context_profile(
                db,
                consultancy_id=auth.consultancy.id,
                updated_by_user_id=auth.user.id,
                internal_context=payload.internal_context,
                external_context=payload.external_context,
                system_scope=payload.system_scope,
                exclusions=payload.exclusions,
                review_date=payload.review_date,
                next_review_date=payload.next_review_date,
            )
        db.refresh(profile)
        return profile
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while upserting iso context profile")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para guardar el contexto ISO.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while upserting iso context profile")
        raise HTTPException(status_code=500, detail="No se pudo guardar el contexto ISO") from exc


@router.get("/iso-interested-parties", response_model=list[IsoInterestedPartyRead])
def get_iso_interested_parties(
    party_type: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[IsoInterestedParty]:
    try:
        normalized_type = _normalize_enum_filter(
            party_type,
            field_name="party_type",
            valid_values=INTERESTED_PARTY_TYPE_VALUES,
        )
        normalized_priority = _normalize_enum_filter(
            priority,
            field_name="priority",
            valid_values=PRIORITY_VALUES,
        )
        normalized_status = _normalize_enum_filter(
            status_filter,
            field_name="status",
            valid_values=ACTIVE_STATUS_VALUES,
        )
        return list_iso_interested_parties(
            db,
            consultancy_id=auth.consultancy.id,
            party_type=normalized_type,
            priority=normalized_priority,
            status=normalized_status,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing interested parties")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar partes interesadas.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing interested parties")
        raise HTTPException(status_code=500, detail="No se pudieron listar las partes interesadas") from exc


@router.post("/iso-interested-parties", response_model=IsoInterestedPartyRead, status_code=status.HTTP_201_CREATED)
def post_iso_interested_party(
    payload: IsoInterestedPartyCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoInterestedParty:
    try:
        with _transaction_scope(db):
            party = create_iso_interested_party(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                name=payload.name,
                party_type=payload.party_type,
                needs_expectations=payload.needs_expectations,
                monitoring_method=payload.monitoring_method,
                priority=payload.priority,
                status=payload.status,
                review_date=payload.review_date,
            )
        db.refresh(party)
        return party
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating interested party")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear la parte interesada.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating interested party")
        raise HTTPException(status_code=500, detail="No se pudo crear la parte interesada") from exc


@router.get("/iso-interested-parties/{party_id}", response_model=IsoInterestedPartyRead)
def get_iso_interested_party(
    party_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoInterestedParty:
    try:
        return _get_interested_party_or_404(db, consultancy_id=auth.consultancy.id, party_id=party_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading interested party")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar la parte interesada.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading interested party")
        raise HTTPException(status_code=500, detail="No se pudo cargar la parte interesada") from exc


@router.patch("/iso-interested-parties/{party_id}", response_model=IsoInterestedPartyRead)
def patch_iso_interested_party(
    party_id: UUID,
    payload: IsoInterestedPartyUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoInterestedParty:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            party = _get_interested_party_or_404(db, consultancy_id=auth.consultancy.id, party_id=party_id)
            if data:
                update_iso_interested_party(db, party=party, updated_by_user_id=auth.user.id, data=data)
        db.refresh(party)
        return party
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating interested party")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar la parte interesada.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating interested party")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la parte interesada") from exc


@router.delete("/iso-interested-parties/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_iso_interested_party(
    party_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            party = _get_interested_party_or_404(db, consultancy_id=auth.consultancy.id, party_id=party_id)
            delete_iso_interested_party(db, party=party)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting interested party")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar la parte interesada.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting interested party")
        raise HTTPException(status_code=500, detail="No se pudo eliminar la parte interesada") from exc


@router.get("/quality-policies", response_model=list[QualityPolicyRead])
def get_quality_policies(
    client_id: UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[QualityPolicy]:
    try:
        return list_quality_policies(
            db,
            consultancy_id=auth.consultancy.id,
            client_id=client_id,
            is_active=is_active,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing quality policies")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar politicas de calidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing quality policies")
        raise HTTPException(status_code=500, detail="No se pudieron listar las politicas de calidad") from exc


@router.post("/quality-policies", response_model=QualityPolicyRead, status_code=status.HTTP_201_CREATED)
def post_quality_policy(
    payload: QualityPolicyCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> QualityPolicy:
    try:
        with _transaction_scope(db):
            policy = create_quality_policy(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                client_id=payload.client_id,
                version_label=payload.version_label,
                policy_text=payload.policy_text,
                approved_by_name=payload.approved_by_name,
                approved_date=payload.approved_date,
                review_date=payload.review_date,
                is_active=payload.is_active,
            )
        db.refresh(policy)
        return policy
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating quality policy")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear la politica de calidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating quality policy")
        raise HTTPException(status_code=500, detail="No se pudo crear la politica de calidad") from exc


@router.get("/quality-policies/{policy_id}", response_model=QualityPolicyRead)
def get_quality_policy(
    policy_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> QualityPolicy:
    try:
        return _get_policy_or_404(db, consultancy_id=auth.consultancy.id, policy_id=policy_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading quality policy")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar la politica de calidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading quality policy")
        raise HTTPException(status_code=500, detail="No se pudo cargar la politica de calidad") from exc


@router.patch("/quality-policies/{policy_id}", response_model=QualityPolicyRead)
def patch_quality_policy(
    policy_id: UUID,
    payload: QualityPolicyUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> QualityPolicy:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            policy = _get_policy_or_404(db, consultancy_id=auth.consultancy.id, policy_id=policy_id)
            if data:
                update_quality_policy(db, policy=policy, updated_by_user_id=auth.user.id, data=data)
        db.refresh(policy)
        return policy
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating quality policy")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar la politica de calidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating quality policy")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la politica de calidad") from exc


@router.delete("/quality-policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_quality_policy(
    policy_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            policy = _get_policy_or_404(db, consultancy_id=auth.consultancy.id, policy_id=policy_id)
            delete_quality_policy(db, policy=policy)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting quality policy")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar la politica de calidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting quality policy")
        raise HTTPException(status_code=500, detail="No se pudo eliminar la politica de calidad") from exc


@router.get("/iso-role-assignments", response_model=list[IsoRoleAssignmentRead])
def get_iso_role_assignments(
    status_filter: str | None = Query(default=None, alias="status"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[IsoRoleAssignment]:
    try:
        normalized_status = _normalize_enum_filter(
            status_filter,
            field_name="status",
            valid_values=ACTIVE_STATUS_VALUES,
        )
        return list_iso_role_assignments(
            db,
            consultancy_id=auth.consultancy.id,
            status=normalized_status,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing role assignments")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar roles.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing role assignments")
        raise HTTPException(status_code=500, detail="No se pudieron listar los roles") from exc


@router.post("/iso-role-assignments", response_model=IsoRoleAssignmentRead, status_code=status.HTTP_201_CREATED)
def post_iso_role_assignment(
    payload: IsoRoleAssignmentCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoRoleAssignment:
    try:
        with _transaction_scope(db):
            role = create_iso_role_assignment(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                role_name=payload.role_name,
                responsible_name=payload.responsible_name,
                responsibility_details=payload.responsibility_details,
                related_process=payload.related_process,
                status=payload.status,
            )
        db.refresh(role)
        return role
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating role assignment")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el rol.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating role assignment")
        raise HTTPException(status_code=500, detail="No se pudo crear el rol") from exc


@router.get("/iso-role-assignments/{role_id}", response_model=IsoRoleAssignmentRead)
def get_iso_role_assignment(
    role_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoRoleAssignment:
    try:
        return _get_role_or_404(db, consultancy_id=auth.consultancy.id, role_id=role_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading role assignment")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el rol.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading role assignment")
        raise HTTPException(status_code=500, detail="No se pudo cargar el rol") from exc


@router.patch("/iso-role-assignments/{role_id}", response_model=IsoRoleAssignmentRead)
def patch_iso_role_assignment(
    role_id: UUID,
    payload: IsoRoleAssignmentUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoRoleAssignment:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            role = _get_role_or_404(db, consultancy_id=auth.consultancy.id, role_id=role_id)
            if data:
                update_iso_role_assignment(db, role=role, updated_by_user_id=auth.user.id, data=data)
        db.refresh(role)
        return role
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating role assignment")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el rol.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating role assignment")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el rol") from exc


@router.delete("/iso-role-assignments/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_iso_role_assignment(
    role_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            role = _get_role_or_404(db, consultancy_id=auth.consultancy.id, role_id=role_id)
            delete_iso_role_assignment(db, role=role)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting role assignment")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el rol.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting role assignment")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el rol") from exc


@router.get("/iso-process-map", response_model=list[IsoProcessMapItemRead])
def get_iso_process_map_items(
    process_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[IsoProcessMapItem]:
    try:
        normalized_type = _normalize_enum_filter(
            process_type,
            field_name="process_type",
            valid_values=PROCESS_TYPE_VALUES,
        )
        normalized_status = _normalize_enum_filter(
            status_filter,
            field_name="status",
            valid_values=ACTIVE_STATUS_VALUES,
        )
        return list_iso_process_map_items(
            db,
            consultancy_id=auth.consultancy.id,
            process_type=normalized_type,
            status=normalized_status,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing process map")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar procesos.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing process map")
        raise HTTPException(status_code=500, detail="No se pudieron listar los procesos") from exc


@router.post("/iso-process-map", response_model=IsoProcessMapItemRead, status_code=status.HTTP_201_CREATED)
def post_iso_process_map_item(
    payload: IsoProcessMapItemCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoProcessMapItem:
    try:
        with _transaction_scope(db):
            process = create_iso_process_map_item(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                name=payload.name,
                process_type=payload.process_type,
                description=payload.description,
                process_inputs=payload.process_inputs,
                process_outputs=payload.process_outputs,
                responsible_name=payload.responsible_name,
                position_order=payload.position_order,
                status=payload.status,
            )
        db.refresh(process)
        return process
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating process map item")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el proceso.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating process map item")
        raise HTTPException(status_code=500, detail="No se pudo crear el proceso") from exc


@router.get("/iso-process-map/{process_id}", response_model=IsoProcessMapItemRead)
def get_iso_process_map_item(
    process_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoProcessMapItem:
    try:
        return _get_process_or_404(db, consultancy_id=auth.consultancy.id, process_id=process_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading process map item")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el proceso.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading process map item")
        raise HTTPException(status_code=500, detail="No se pudo cargar el proceso") from exc


@router.patch("/iso-process-map/{process_id}", response_model=IsoProcessMapItemRead)
def patch_iso_process_map_item(
    process_id: UUID,
    payload: IsoProcessMapItemUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoProcessMapItem:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            process = _get_process_or_404(db, consultancy_id=auth.consultancy.id, process_id=process_id)
            if data:
                update_iso_process_map_item(
                    db,
                    process=process,
                    updated_by_user_id=auth.user.id,
                    data=data,
                )
        db.refresh(process)
        return process
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating process map item")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el proceso.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating process map item")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el proceso") from exc


@router.delete("/iso-process-map/{process_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_iso_process_map_item(
    process_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            process = _get_process_or_404(db, consultancy_id=auth.consultancy.id, process_id=process_id)
            delete_iso_process_map_item(db, process=process)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting process map item")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el proceso.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting process map item")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el proceso") from exc


@router.get("/iso-quality-objectives/summary", response_model=IsoQualityObjectiveSummaryRead)
def get_iso_quality_objectives_summary(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoQualityObjectiveSummaryRead:
    try:
        summary = get_iso_quality_objective_summary(db, consultancy_id=auth.consultancy.id)
        return IsoQualityObjectiveSummaryRead(
            total=summary.total,
            planned=summary.planned,
            in_progress=summary.in_progress,
            completed=summary.completed,
            on_hold=summary.on_hold,
            linked_to_kpi=summary.linked_to_kpi,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading objective summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el resumen de objetivos.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading objective summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resumen de objetivos") from exc


@router.get("/iso-quality-objectives", response_model=list[IsoQualityObjectiveRead])
def get_iso_quality_objectives(
    status_filter: str | None = Query(default=None, alias="status"),
    target_date_from: date | None = Query(default=None),
    target_date_to: date | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[IsoQualityObjective]:
    try:
        normalized_status = _normalize_enum_filter(
            status_filter,
            field_name="status",
            valid_values=OBJECTIVE_STATUS_VALUES,
        )
        _validate_date_range(
            from_value=target_date_from,
            to_value=target_date_to,
            from_field="target_date_from",
            to_field="target_date_to",
        )
        return list_iso_quality_objectives(
            db,
            consultancy_id=auth.consultancy.id,
            status=normalized_status,
            target_date_from=target_date_from,
            target_date_to=target_date_to,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing objectives")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar objetivos.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing objectives")
        raise HTTPException(status_code=500, detail="No se pudieron listar los objetivos") from exc


@router.post("/iso-quality-objectives", response_model=IsoQualityObjectiveRead, status_code=status.HTTP_201_CREATED)
def post_iso_quality_objective(
    payload: IsoQualityObjectiveCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoQualityObjective:
    try:
        with _transaction_scope(db):
            objective = create_iso_quality_objective(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                linked_kpi_id=payload.linked_kpi_id,
                title=payload.title,
                description=payload.description,
                period_label=payload.period_label,
                responsible_name=payload.responsible_name,
                status=payload.status,
                tracking_notes=payload.tracking_notes,
                target_date=payload.target_date,
                review_date=payload.review_date,
            )
        db.refresh(objective)
        return objective
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating objective")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el objetivo.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating objective")
        raise HTTPException(status_code=500, detail="No se pudo crear el objetivo") from exc


@router.get("/iso-quality-objectives/{objective_id}", response_model=IsoQualityObjectiveRead)
def get_iso_quality_objective(
    objective_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoQualityObjective:
    try:
        return _get_objective_or_404(db, consultancy_id=auth.consultancy.id, objective_id=objective_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading objective")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el objetivo.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading objective")
        raise HTTPException(status_code=500, detail="No se pudo cargar el objetivo") from exc


@router.patch("/iso-quality-objectives/{objective_id}", response_model=IsoQualityObjectiveRead)
def patch_iso_quality_objective(
    objective_id: UUID,
    payload: IsoQualityObjectiveUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoQualityObjective:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            objective = _get_objective_or_404(db, consultancy_id=auth.consultancy.id, objective_id=objective_id)
            if data:
                update_iso_quality_objective(
                    db,
                    objective=objective,
                    updated_by_user_id=auth.user.id,
                    data=data,
                )
        db.refresh(objective)
        return objective
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating objective")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el objetivo.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating objective")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el objetivo") from exc


@router.delete("/iso-quality-objectives/{objective_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_iso_quality_objective(
    objective_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            objective = _get_objective_or_404(db, consultancy_id=auth.consultancy.id, objective_id=objective_id)
            delete_iso_quality_objective(db, objective=objective)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting objective")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el objetivo.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting objective")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el objetivo") from exc


@router.get("/iso-change-plans", response_model=list[IsoChangePlanRead])
def get_iso_change_plans(
    status_filter: str | None = Query(default=None, alias="status"),
    planned_date_from: date | None = Query(default=None),
    planned_date_to: date | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[IsoChangePlan]:
    try:
        normalized_status = _normalize_enum_filter(
            status_filter,
            field_name="status",
            valid_values=CHANGE_PLAN_STATUS_VALUES,
        )
        _validate_date_range(
            from_value=planned_date_from,
            to_value=planned_date_to,
            from_field="planned_date_from",
            to_field="planned_date_to",
        )
        return list_iso_change_plans(
            db,
            consultancy_id=auth.consultancy.id,
            status=normalized_status,
            planned_date_from=planned_date_from,
            planned_date_to=planned_date_to,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing change plans")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar cambios planificados.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing change plans")
        raise HTTPException(status_code=500, detail="No se pudieron listar los cambios planificados") from exc


@router.post("/iso-change-plans", response_model=IsoChangePlanRead, status_code=status.HTTP_201_CREATED)
def post_iso_change_plan(
    payload: IsoChangePlanCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoChangePlan:
    try:
        with _transaction_scope(db):
            plan = create_iso_change_plan(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                change_title=payload.change_title,
                reason=payload.reason,
                impact=payload.impact,
                responsible_name=payload.responsible_name,
                planned_date=payload.planned_date,
                status=payload.status,
                followup_notes=payload.followup_notes,
                completion_date=payload.completion_date,
            )
        db.refresh(plan)
        return plan
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating change plan")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el cambio planificado.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating change plan")
        raise HTTPException(status_code=500, detail="No se pudo crear el cambio planificado") from exc


@router.get("/iso-change-plans/{change_id}", response_model=IsoChangePlanRead)
def get_iso_change_plan(
    change_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoChangePlan:
    try:
        return _get_change_plan_or_404(db, consultancy_id=auth.consultancy.id, change_id=change_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading change plan")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el cambio planificado.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading change plan")
        raise HTTPException(status_code=500, detail="No se pudo cargar el cambio planificado") from exc


@router.patch("/iso-change-plans/{change_id}", response_model=IsoChangePlanRead)
def patch_iso_change_plan(
    change_id: UUID,
    payload: IsoChangePlanUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoChangePlan:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            plan = _get_change_plan_or_404(db, consultancy_id=auth.consultancy.id, change_id=change_id)
            if data:
                update_iso_change_plan(db, plan=plan, updated_by_user_id=auth.user.id, data=data)
        db.refresh(plan)
        return plan
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating change plan")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar el cambio planificado.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating change plan")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el cambio planificado") from exc


@router.delete("/iso-change-plans/{change_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_iso_change_plan(
    change_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            plan = _get_change_plan_or_404(db, consultancy_id=auth.consultancy.id, change_id=change_id)
            delete_iso_change_plan(db, plan=plan)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting change plan")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar el cambio planificado.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting change plan")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el cambio planificado") from exc


@router.get("/iso-nonconformities/summary", response_model=IsoNonconformitySummaryRead)
def get_iso_nonconformities_summary(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoNonconformitySummaryRead:
    try:
        summary = get_iso_nonconformity_summary(db, consultancy_id=auth.consultancy.id)
        return IsoNonconformitySummaryRead(
            total=summary.total,
            open=summary.open_count,
            in_progress=summary.in_progress_count,
            pending_verification=summary.pending_verification_count,
            closed=summary.closed_count,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading nonconformity summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el resumen de no conformidades.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading nonconformity summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resumen de no conformidades") from exc


@router.get("/iso-nonconformities", response_model=list[IsoNonconformityRead])
def get_iso_nonconformities(
    status_filter: str | None = Query(default=None, alias="status"),
    origin_type: str | None = Query(default=None),
    due_date_from: date | None = Query(default=None),
    due_date_to: date | None = Query(default=None),
    client_id: UUID | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[IsoNonconformity]:
    try:
        normalized_status = _normalize_enum_filter(
            status_filter,
            field_name="status",
            valid_values=NONCONFORMITY_STATUS_VALUES,
        )
        normalized_origin = _normalize_enum_filter(
            origin_type,
            field_name="origin_type",
            valid_values=NONCONFORMITY_ORIGIN_TYPE_VALUES,
        )
        _validate_date_range(
            from_value=due_date_from,
            to_value=due_date_to,
            from_field="due_date_from",
            to_field="due_date_to",
        )
        return list_iso_nonconformities(
            db,
            consultancy_id=auth.consultancy.id,
            status=normalized_status,
            origin_type=normalized_origin,
            due_date_from=due_date_from,
            due_date_to=due_date_to,
            client_id=client_id,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing nonconformities")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar no conformidades.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing nonconformities")
        raise HTTPException(status_code=500, detail="No se pudieron listar las no conformidades") from exc


@router.post("/iso-nonconformities", response_model=IsoNonconformityRead, status_code=status.HTTP_201_CREATED)
def post_iso_nonconformity(
    payload: IsoNonconformityCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoNonconformity:
    try:
        with _transaction_scope(db):
            nc = create_iso_nonconformity(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                client_id=payload.client_id,
                source_recommendation_id=payload.source_recommendation_id,
                linked_action_task_id=payload.linked_action_task_id,
                origin_type=payload.origin_type,
                title=payload.title,
                description=payload.description,
                cause_analysis=payload.cause_analysis,
                immediate_correction=payload.immediate_correction,
                corrective_action=payload.corrective_action,
                responsible_name=payload.responsible_name,
                due_date=payload.due_date,
                effectiveness_verification=payload.effectiveness_verification,
                verification_date=payload.verification_date,
                status=payload.status,
                closure_notes=payload.closure_notes,
            )
        db.refresh(nc)
        return nc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating nonconformity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear la no conformidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating nonconformity")
        raise HTTPException(status_code=500, detail="No se pudo crear la no conformidad") from exc


@router.get("/iso-nonconformities/{nc_id}", response_model=IsoNonconformityRead)
def get_iso_nonconformity(
    nc_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoNonconformity:
    try:
        return _get_nonconformity_or_404(db, consultancy_id=auth.consultancy.id, nc_id=nc_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading nonconformity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar la no conformidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading nonconformity")
        raise HTTPException(status_code=500, detail="No se pudo cargar la no conformidad") from exc


@router.patch("/iso-nonconformities/{nc_id}", response_model=IsoNonconformityRead)
def patch_iso_nonconformity(
    nc_id: UUID,
    payload: IsoNonconformityUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoNonconformity:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            nc = _get_nonconformity_or_404(db, consultancy_id=auth.consultancy.id, nc_id=nc_id)
            if data:
                update_iso_nonconformity(db, nc=nc, updated_by_user_id=auth.user.id, data=data)
        db.refresh(nc)
        return nc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating nonconformity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar la no conformidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating nonconformity")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la no conformidad") from exc


@router.delete("/iso-nonconformities/{nc_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_iso_nonconformity(
    nc_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            nc = _get_nonconformity_or_404(db, consultancy_id=auth.consultancy.id, nc_id=nc_id)
            delete_iso_nonconformity(db, nc=nc)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting nonconformity")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar la no conformidad.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting nonconformity")
        raise HTTPException(status_code=500, detail="No se pudo eliminar la no conformidad") from exc


@router.get("/iso-improvements/summary", response_model=IsoImprovementSummaryRead)
def get_iso_improvements_summary(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoImprovementSummaryRead:
    try:
        summary = get_iso_improvement_summary(db, consultancy_id=auth.consultancy.id)
        return IsoImprovementSummaryRead(
            total=summary.total,
            proposed=summary.proposed,
            in_progress=summary.in_progress,
            implemented=summary.implemented,
            validated=summary.validated,
            closed=summary.closed,
        )
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading improvement summary")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el resumen de mejoras.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading improvement summary")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resumen de mejoras") from exc


@router.get("/iso-improvements", response_model=list[IsoImprovementRead])
def get_iso_improvements(
    status_filter: str | None = Query(default=None, alias="status"),
    source_type: str | None = Query(default=None),
    due_date_from: date | None = Query(default=None),
    due_date_to: date | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[IsoImprovement]:
    try:
        normalized_status = _normalize_enum_filter(
            status_filter,
            field_name="status",
            valid_values=IMPROVEMENT_STATUS_VALUES,
        )
        normalized_source = _normalize_enum_filter(
            source_type,
            field_name="source_type",
            valid_values=IMPROVEMENT_SOURCE_TYPE_VALUES,
        )
        _validate_date_range(
            from_value=due_date_from,
            to_value=due_date_to,
            from_field="due_date_from",
            to_field="due_date_to",
        )
        return list_iso_improvements(
            db,
            consultancy_id=auth.consultancy.id,
            status=normalized_status,
            source_type=normalized_source,
            due_date_from=due_date_from,
            due_date_to=due_date_to,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing improvements")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar mejoras.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while listing improvements")
        raise HTTPException(status_code=500, detail="No se pudieron listar las mejoras") from exc


@router.post("/iso-improvements", response_model=IsoImprovementRead, status_code=status.HTTP_201_CREATED)
def post_iso_improvement(
    payload: IsoImprovementCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoImprovement:
    try:
        with _transaction_scope(db):
            improvement = create_iso_improvement(
                db,
                consultancy_id=auth.consultancy.id,
                created_by_user_id=auth.user.id,
                linked_nonconformity_id=payload.linked_nonconformity_id,
                source_type=payload.source_type,
                source_id=payload.source_id,
                title=payload.title,
                description=payload.description,
                action_plan=payload.action_plan,
                responsible_name=payload.responsible_name,
                status=payload.status,
                due_date=payload.due_date,
                followup_notes=payload.followup_notes,
                benefit_observed=payload.benefit_observed,
                review_date=payload.review_date,
            )
        db.refresh(improvement)
        return improvement
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating improvement")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear la mejora.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while creating improvement")
        raise HTTPException(status_code=500, detail="No se pudo crear la mejora") from exc


@router.get("/iso-improvements/{improvement_id}", response_model=IsoImprovementRead)
def get_iso_improvement(
    improvement_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoImprovement:
    try:
        return _get_improvement_or_404(
            db,
            consultancy_id=auth.consultancy.id,
            improvement_id=improvement_id,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading improvement")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar la mejora.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while loading improvement")
        raise HTTPException(status_code=500, detail="No se pudo cargar la mejora") from exc


@router.patch("/iso-improvements/{improvement_id}", response_model=IsoImprovementRead)
def patch_iso_improvement(
    improvement_id: UUID,
    payload: IsoImprovementUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> IsoImprovement:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            improvement = _get_improvement_or_404(
                db,
                consultancy_id=auth.consultancy.id,
                improvement_id=improvement_id,
            )
            if data:
                update_iso_improvement(
                    db,
                    improvement=improvement,
                    updated_by_user_id=auth.user.id,
                    data=data,
                )
        db.refresh(improvement)
        return improvement
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating improvement")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar la mejora.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while updating improvement")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la mejora") from exc


@router.delete("/iso-improvements/{improvement_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_iso_improvement(
    improvement_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            improvement = _get_improvement_or_404(
                db,
                consultancy_id=auth.consultancy.id,
                improvement_id=improvement_id,
            )
            delete_iso_improvement(db, improvement=improvement)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting improvement")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar la mejora.",
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_iso_management_tables_missing(exc)
        logger.exception("Database error while deleting improvement")
        raise HTTPException(status_code=500, detail="No se pudo eliminar la mejora") from exc
