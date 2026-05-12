from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.audit_context_document import AuditContextDocument
from app.models.audit_interested_parties_document import AuditInterestedPartiesDocument
from app.models.audit_risk_opportunity_document import AuditRiskOpportunityDocument
from app.models.audit_report_item import AuditReportItem


@dataclass(frozen=True)
class BlockRule:
    block_code: str
    block_title: str
    section_code: str
    required_fields: tuple[str, ...]


@dataclass(frozen=True)
class BlockComplianceResult:
    block_code: str
    block_title: str
    section_code: str
    status: str
    required_fields: list[str]
    completed_fields: list[str]
    missing_fields: list[str]


@dataclass(frozen=True)
class ReportComplianceResult:
    report_id: UUID
    overall_status: str
    completed_blocks: int
    total_blocks: int
    blocks: list[BlockComplianceResult]


# These rules target previously partial ISO 9001 blocks using the existing P03 data model.
YELLOW_BLOCK_RULES: tuple[BlockRule, ...] = (
    BlockRule(
        block_code="contexto_organizacion",
        block_title="Contexto de la organizacion",
        section_code="4",
        required_fields=(
            "context_document_completed",
            "scope_current_text",
            "process_map_updated",
            "sgc_processes_defined",
            "process_inputs_outputs_defined",
        ),
    ),
    BlockRule(
        block_code="partes_interesadas",
        block_title="Partes interesadas",
        section_code="4",
        required_fields=(
            "interested_parties_document_completed",
        ),
    ),
    BlockRule(
        block_code="politica_calidad",
        block_title="Politica de calidad",
        section_code="5",
        required_fields=(
            "quality_policy_revision",
            "quality_policy_updated",
            "quality_system_responsible_name",
        ),
    ),
    BlockRule(
        block_code="roles_responsabilidades",
        block_title="Roles y responsabilidades",
        section_code="5",
        required_fields=(
            "roles_defined",
            "roles_document_reference",
        ),
    ),
    BlockRule(
        block_code="riesgos_oportunidades",
        block_title="Riesgos y oportunidades",
        section_code="6",
        required_fields=(
            "risk_opportunity_document_completed",
        ),
    ),
    BlockRule(
        block_code="objetivos",
        block_title="Objetivos",
        section_code="6",
        required_fields=(
            "objectives_reference_document",
            "objectives_are_measurable",
            "current_objectives",
        ),
    ),
    BlockRule(
        block_code="planificacion_cambios",
        block_title="Planificacion de cambios",
        section_code="6",
        required_fields=(
            "change_planning_method_summary",
            "management_review_planned_date",
        ),
    ),
    BlockRule(
        block_code="recursos",
        block_title="Recursos",
        section_code="7",
        required_fields=(
            "employee_count",
            "resources_sufficient",
            "staff_structure_summary",
        ),
    ),
    BlockRule(
        block_code="competencias",
        block_title="Competencias",
        section_code="7",
        required_fields=(
            "personnel_competent",
            "job_profiles_reference",
            "training_2024_summary",
        ),
    ),
    BlockRule(
        block_code="comunicacion_info_documentada",
        block_title="Comunicacion e informacion documentada",
        section_code="7",
        required_fields=(
            "external_communication_channels",
            "internal_communication_channels",
            "document_control_reference",
            "document_control_revision",
            "documents_accessible",
        ),
    ),
    BlockRule(
        block_code="control_procesos_servicio",
        block_title="Control de procesos y servicio",
        section_code="8",
        required_fields=(
            "operational_control_summary",
            "planned_work_control_exists",
            "customer_requirements_defined",
            "service_release_control_exists",
            "release_evidence_summary",
        ),
    ),
    BlockRule(
        block_code="no_conformidades",
        block_title="No conformidades",
        section_code="8",
        required_fields=(
            "nonconformities_document_reference",
            "nonconformities_count",
            "nonconformities_summary",
        ),
    ),
    BlockRule(
        block_code="indicadores_desempeno",
        block_title="Indicadores de desempeno",
        section_code="9",
        required_fields=(
            "performance_indicators_matrix",
        ),
    ),
    BlockRule(
        block_code="mejora_continua",
        block_title="Mejora continua",
        section_code="10",
        required_fields=(
            "improvement_system_summary",
            "improvement_opportunities_summary",
            "continuous_improvement_mechanism_summary",
        ),
    ),
    BlockRule(
        block_code="acciones_correctivas",
        block_title="Acciones correctivas",
        section_code="10",
        required_fields=(
            "nonconformities_procedure_reference",
            "corrective_actions_followed",
            "management_review_outputs_used_for_improvement",
        ),
    ),
)


def _normalize_code(value: str) -> str:
    return value.strip().lower()


def _has_item_value(item: AuditReportItem | None) -> bool:
    if item is None:
        return False

    if item.value_json is not None:
        if isinstance(item.value_json, list):
            return len(item.value_json) > 0
        if isinstance(item.value_json, dict):
            return len(item.value_json.keys()) > 0
        return True

    if item.value_text is None:
        return False

    return bool(str(item.value_text).strip())


def _status_from_field_counts(required_count: int, completed_count: int) -> str:
    if required_count <= 0:
        return "green"
    if completed_count <= 0:
        return "red"
    if completed_count >= required_count:
        return "green"
    return "yellow"


def _build_item_index(
    items: list[AuditReportItem],
) -> dict[tuple[str, str], AuditReportItem]:
    index: dict[tuple[str, str], AuditReportItem] = {}
    for item in items:
        section_code = str(item.section_code or "").strip()
        item_code = _normalize_code(str(item.item_code or ""))
        if not section_code or not item_code:
            continue
        index[(section_code, item_code)] = item
    return index


def _safe_scalar(db: Session, statement):
    try:
        with db.begin_nested():
            return db.scalar(statement)
    except SQLAlchemyError:
        return None


def _is_completed_status(value: str | None) -> bool:
    return str(value or "").strip().lower() == "completed"


def build_report_compliance(
    *,
    report_id: UUID,
    items: list[AuditReportItem],
    document_flags: dict[str, bool] | None = None,
) -> ReportComplianceResult:
    item_index = _build_item_index(items)
    normalized_document_flags = document_flags or {}
    blocks: list[BlockComplianceResult] = []

    for rule in YELLOW_BLOCK_RULES:
        completed_fields: list[str] = []
        missing_fields: list[str] = []

        for field_code in rule.required_fields:
            key = (rule.section_code, _normalize_code(field_code))
            field_item = item_index.get(key)
            has_item_value = _has_item_value(field_item)
            if field_code in normalized_document_flags:
                if normalized_document_flags[field_code] or has_item_value:
                    completed_fields.append(field_code)
                else:
                    missing_fields.append(field_code)
                continue
            if has_item_value:
                completed_fields.append(field_code)
            else:
                missing_fields.append(field_code)

        status = _status_from_field_counts(
            required_count=len(rule.required_fields),
            completed_count=len(completed_fields),
        )
        blocks.append(
            BlockComplianceResult(
                block_code=rule.block_code,
                block_title=rule.block_title,
                section_code=rule.section_code,
                status=status,
                required_fields=list(rule.required_fields),
                completed_fields=completed_fields,
                missing_fields=missing_fields,
            )
        )

    total_blocks = len(blocks)
    completed_blocks = len([block for block in blocks if block.status == "green"])
    has_red = any(block.status == "red" for block in blocks)
    has_yellow = any(block.status == "yellow" for block in blocks)
    overall_status = "red" if has_red else "yellow" if has_yellow else "green"

    return ReportComplianceResult(
        report_id=report_id,
        overall_status=overall_status,
        completed_blocks=completed_blocks,
        total_blocks=total_blocks,
        blocks=blocks,
    )


def load_report_compliance(db: Session, report_id: UUID) -> ReportComplianceResult:
    try:
        items: list[AuditReportItem] = list(
            db.scalars(
                select(AuditReportItem).where(AuditReportItem.audit_report_id == report_id)
            ).all()
        )
    except SQLAlchemyError:
        items = []

    context_document_id = _safe_scalar(
        db,
        select(AuditContextDocument.id).where(AuditContextDocument.audit_report_id == report_id),
    )
    context_document_status = _safe_scalar(
        db,
        select(AuditContextDocument.status).where(AuditContextDocument.audit_report_id == report_id),
    )

    interested_document_id = _safe_scalar(
        db,
        select(AuditInterestedPartiesDocument.id).where(
            AuditInterestedPartiesDocument.audit_report_id == report_id
        ),
    )
    interested_document_status = _safe_scalar(
        db,
        select(AuditInterestedPartiesDocument.status).where(
            AuditInterestedPartiesDocument.audit_report_id == report_id
        ),
    )

    risk_document_id = _safe_scalar(
        db,
        select(AuditRiskOpportunityDocument.id).where(
            AuditRiskOpportunityDocument.audit_report_id == report_id
        ),
    )
    risk_document_status = _safe_scalar(
        db,
        select(AuditRiskOpportunityDocument.status).where(
            AuditRiskOpportunityDocument.audit_report_id == report_id
        ),
    )

    context_document_completed = bool(
        context_document_id is not None or _is_completed_status(context_document_status)
    )
    interested_parties_document_completed = bool(
        interested_document_id is not None or _is_completed_status(interested_document_status)
    )
    risk_opportunity_document_completed = bool(
        risk_document_id is not None or _is_completed_status(risk_document_status)
    )

    document_flags = {
        "context_document_completed": context_document_completed,
        "interested_parties_document_completed": interested_parties_document_completed,
        "risk_opportunity_document_completed": risk_opportunity_document_completed,
    }
    return build_report_compliance(
        report_id=report_id,
        items=list(items),
        document_flags=document_flags,
    )


def get_section_missing_requirements(
    compliance: ReportComplianceResult,
    section_code: str,
) -> list[str]:
    normalized_section = str(section_code or "").strip()
    if not normalized_section:
        return []

    missing: list[str] = []
    for block in compliance.blocks:
        if block.section_code != normalized_section:
            continue
        for field_code in block.missing_fields:
            missing.append(f"{block.block_code}:{field_code}")
    return missing


def get_pending_blocks_for_report_close(
    compliance: ReportComplianceResult,
) -> list[BlockComplianceResult]:
    return [block for block in compliance.blocks if block.status != "green"]
