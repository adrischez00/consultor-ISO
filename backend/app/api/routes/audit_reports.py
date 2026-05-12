import logging
import re
from contextlib import contextmanager
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Integer, cast, delete, func, inspect, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.core.config import clear_settings_cache, get_settings
from app.db.session import get_db
from app.models.audit_context_document import AuditContextDocument
from app.models.audit_context_document_row import AuditContextDocumentRow
from app.models.audit_report import AuditReport
from app.models.audit_report_annex import AuditReportAnnex
from app.models.audit_report_clause_check import AuditReportClauseCheck
from app.models.audit_report_interviewee import AuditReportInterviewee
from app.models.audit_report_item import AuditReportItem
from app.models.audit_risk_opportunity_document import AuditRiskOpportunityDocument
from app.models.audit_risk_opportunity_document_row import AuditRiskOpportunityDocumentRow
from app.models.audit_interested_parties_document import AuditInterestedPartiesDocument
from app.models.audit_interested_parties_document_row import AuditInterestedPartiesDocumentRow
from app.models.audit_report_recommendation import AuditReportRecommendation
from app.models.audit_report_section import AuditReportSection
from app.models.audit_template import AuditTemplate
from app.models.audit_template_clause import AuditTemplateClause
from app.models.audit_template_section import AuditTemplateSection
from app.models.client import Client
from app.models.customer_feedback import CustomerFeedback
from app.models.iso_change_plan import IsoChangePlan
from app.models.iso_context_profile import IsoContextProfile
from app.models.iso_improvement import IsoImprovement
from app.models.iso_interested_party import IsoInterestedParty
from app.models.iso_nonconformity import IsoNonconformity
from app.models.iso_process_map_item import IsoProcessMapItem
from app.models.iso_quality_objective import IsoQualityObjective
from app.models.iso_role_assignment import IsoRoleAssignment
from app.models.kpi_indicator import KpiIndicator
from app.models.management_review import ManagementReview
from app.models.management_review_reference import ManagementReviewReference
from app.models.quality_policy import QualityPolicy
from app.models.risk_opportunity import RiskOpportunity
from app.models.supplier import Supplier
from app.models.user import User
from app.services.audit_compliance import (
    ReportComplianceResult,
    get_pending_blocks_for_report_close,
    get_section_missing_requirements,
    load_report_compliance,
)
from app.services.audit_docx_export import (
    AuditDocxGenerationError,
    build_audit_report_docx,
    build_document_integrity_notes,
    extract_critical_integrity_notes,
    generate_section_narratives,
)
from app.schemas.audit_report import (
    AuditComplianceBlockRead,
    AuditClientBasic,
    AuditContextDocumentRead,
    AuditContextDocumentRowInput,
    AuditContextDocumentRowRead,
    AuditContextDocumentUpsertRequest,
    AuditRiskOpportunityDocumentRead,
    AuditRiskOpportunityDocumentRowInput,
    AuditRiskOpportunityDocumentRowRead,
    AuditRiskOpportunityDocumentUpsertRequest,
    AuditInterestedPartiesDocumentRead,
    AuditInterestedPartiesDocumentRowInput,
    AuditInterestedPartiesDocumentRowRead,
    AuditInterestedPartiesDocumentUpsertRequest,
    AuditRecommendationHistoryItem,
    AuditReportAnnexCreateRequest,
    AuditReportAnnexRead,
    AuditReportAnnexUpdateRequest,
    AuditReportClauseCheckInput,
    AuditReportClauseCheckRead,
    AuditReportClauseChecksUpsertRequest,
    AuditReportComplianceRead,
    AuditReportCreateRequest,
    AuditReportDetailResponse,
    AuditReportIntervieweeCreateRequest,
    AuditReportIntervieweeRead,
    AuditReportItemInput,
    AuditReportItemRead,
    AuditReportListItem,
    AuditReportRead,
    AuditReportRecommendationCreateRequest,
    AuditReportRecommendationRead,
    AuditReportRecommendationUpdateRequest,
    AuditReportSectionItemsUpsertRequest,
    AuditReportSectionRead,
    AuditReportSectionUpdateRequest,
    AuditReportUpdateRequest,
    AuditIsoWorkbenchSummaryRead,
    AuditUserBasic,
)

router = APIRouter(tags=["audit_reports"])
logger = logging.getLogger(__name__)
_CREATE_REPORT_MAX_RETRIES = 3
_ALLOWED_AUDIT_TYPES = {"inicial", "revision_1", "revision_2", "recertificacion"}
_ALLOWED_AUDIT_MODALITIES = {"presencialmente", "de forma remota", "de forma mixta"}
_INTERESTED_PARTIES_DOCUMENT_TABLES = {
    "audit_interested_parties_documents",
    "audit_interested_parties_document_rows",
}
_INTERESTED_PARTIES_DOCUMENT_PHASE14_COLUMNS = {
    "needs",
    "expectations",
    "requirements",
    "risks",
    "opportunities",
    "actions",
}
_CONTEXT_DOCUMENT_TABLES = {
    "audit_context_documents",
    "audit_context_document_rows",
}
_CONTEXT_DOCUMENT_GROUP_VALUES = {"externo", "interno"}
_RISK_OPPORTUNITY_DOCUMENT_TABLES = {
    "audit_risk_opportunity_documents",
    "audit_risk_opportunity_document_rows",
}
_RISK_OPPORTUNITY_DOCUMENT_PHASE17_COLUMNS = {
    "process_name",
    "severity",
    "viability",
    "attractiveness",
    "source_key",
    "reference_kind",
    "reference_row_id",
    "action_type",
    "indicator",
    "due_date",
    "action_result",
    "is_auto_generated",
}
_RISK_OPPORTUNITY_ROW_TYPES = {"swot", "risk", "opportunity", "action", "follow_up"}
_RISK_OPPORTUNITY_SWOT_CATEGORIES = {"weakness", "threat", "strength", "opportunity"}
_RISK_OPPORTUNITY_IMPACT_VALUES = {"low", "medium", "high"}
_RISK_OPPORTUNITY_PROBABILITY_VALUES = {"low", "medium", "high"}
_RISK_OPPORTUNITY_SEVERITY_VALUES = {"slight", "harm", "extreme"}
_RISK_OPPORTUNITY_VIABILITY_VALUES = {1, 3, 5}
_RISK_OPPORTUNITY_REFERENCE_KINDS = {"risk", "opportunity"}
_PERFORMANCE_INDICATORS_ITEM_CODE = "performance_indicators_matrix"
_SECTION6_ALLOWED_ITEM_CODES = {
    "objectives_reference_document",
    "objectives_are_measurable",
    "previous_objectives",
    "current_objectives",
    "management_review_planned_date",
    "change_planning_method_summary",
    "extraordinary_changes_exist",
    "extraordinary_changes_summary",
}


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _load_public_tables(db: Session) -> set[str]:
    inspector = inspect(db.get_bind())
    return set(inspector.get_table_names(schema="public"))


def _raise_if_interested_parties_document_tables_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and any(
        table_name in message for table_name in _INTERESTED_PARTIES_DOCUMENT_TABLES
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migracion del documento de partes interesadas (fase 13). "
                "Ejecuta docs/sql/phase13_audit_interested_parties_document.sql."
            ),
        ) from exc
    if "column" in message and "does not exist" in message and any(
        column_name in message for column_name in _INTERESTED_PARTIES_DOCUMENT_PHASE14_COLUMNS
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migracion de columnas extendidas del documento P09 (fase 14). "
                "Ejecuta docs/sql/phase14_audit_interested_parties_document_rows_extension.sql."
            ),
        ) from exc


def _raise_if_context_document_tables_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and any(
        table_name in message for table_name in _CONTEXT_DOCUMENT_TABLES
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migracion del documento de contexto (fase 15). "
                "Ejecuta docs/sql/phase15_audit_context_document.sql."
            ),
        ) from exc


def _raise_if_risk_opportunity_document_tables_missing(exc: SQLAlchemyError) -> None:
    message = str(getattr(exc, "orig", exc)).lower()
    if "does not exist" in message and any(
        table_name in message for table_name in _RISK_OPPORTUNITY_DOCUMENT_TABLES
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migracion del documento de riesgos y oportunidades (fase 16). "
                "Ejecuta docs/sql/phase16_audit_risk_opportunity_document.sql."
            ),
        ) from exc
    if "column" in message and "does not exist" in message and any(
        column_name in message for column_name in _RISK_OPPORTUNITY_DOCUMENT_PHASE17_COLUMNS
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Falta migracion extendida del documento de riesgos y oportunidades (fase 17). "
                "Ejecuta docs/sql/phase17_audit_risk_opportunity_document_rows_v2.sql."
            ),
        ) from exc


def _normalize_required_text(value: str | None, field_name: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{field_name} es requerido")
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_choice_text(
    value: str | None,
    *,
    field_name: str,
    allowed_values: set[str],
    required: bool = False,
) -> str | None:
    if value is None:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} es requerido")
        return None
    normalized = value.strip().lower()
    if not normalized:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} es requerido")
        return None
    if normalized not in allowed_values:
        allowed_label = ", ".join(sorted(allowed_values))
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} inválido. Valores permitidos: {allowed_label}.",
        )
    return normalized


def _get_scoped_client_or_404(db: Session, client_id: UUID, consultancy_id: UUID) -> Client:
    client = db.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.consultancy_id == consultancy_id,
        )
    )
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


def _get_active_template_or_404(db: Session, template_code: str) -> AuditTemplate:
    template = db.scalar(
        select(AuditTemplate).where(
            func.lower(AuditTemplate.code) == template_code.strip().lower(),
            AuditTemplate.is_active.is_(True),
        )
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template de auditoría no encontrado")
    return template


def _get_report_or_404(db: Session, report_id: UUID, consultancy_id: UUID) -> AuditReport:
    report = db.scalar(
        select(AuditReport).where(
            AuditReport.id == report_id,
            AuditReport.consultancy_id == consultancy_id,
        )
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Auditoría no encontrada")
    return report


def _ensure_section_exists(db: Session, report_id: UUID, section_code: str) -> AuditReportSection:
    section = db.scalar(
        select(AuditReportSection).where(
            AuditReportSection.audit_report_id == report_id,
            func.lower(AuditReportSection.section_code) == section_code.strip().lower(),
        )
    )
    if section is None:
        raise HTTPException(status_code=404, detail="Sección no encontrada")
    return section


def _get_annex_or_404(db: Session, report_id: UUID, annex_id: UUID) -> AuditReportAnnex:
    annex = db.scalar(
        select(AuditReportAnnex).where(
            AuditReportAnnex.id == annex_id,
            AuditReportAnnex.audit_report_id == report_id,
        )
    )
    if annex is None:
        raise HTTPException(status_code=404, detail="Anexo no encontrado")
    return annex


def _build_report_code(
    db: Session,
    consultancy_id: UUID,
    template_code: str,
    report_year: int,
) -> str:
    normalized_template = template_code.strip().upper()
    prefix = f"{normalized_template}-{report_year}-"
    pattern = rf"^{re.escape(prefix)}[0-9]{{4}}$"
    max_sequence = db.scalar(
        select(func.max(cast(func.right(AuditReport.report_code, 4), Integer))).where(
            AuditReport.consultancy_id == consultancy_id,
            AuditReport.report_year == report_year,
            AuditReport.report_code.is_not(None),
            AuditReport.report_code.like(f"{prefix}%"),
            AuditReport.report_code.op("~")(pattern),
        )
    )
    next_sequence = int(max_sequence or 0) + 1
    return f"{prefix}{next_sequence:04d}"


def _initialize_report_sections(
    db: Session,
    report_id: UUID,
    template_id: UUID,
) -> None:
    template_sections = db.scalars(
        select(AuditTemplateSection)
        .where(AuditTemplateSection.template_id == template_id)
        .order_by(AuditTemplateSection.sort_order.asc(), AuditTemplateSection.section_code.asc())
    ).all()

    for section in template_sections:
        db.add(
            AuditReportSection(
                audit_report_id=report_id,
                section_code=section.section_code,
                title=section.title,
                sort_order=section.sort_order,
                status="not_started",
            )
        )


def _initialize_report_clause_checks(
    db: Session,
    report_id: UUID,
    template_id: UUID,
) -> None:
    template_clauses = db.scalars(
        select(AuditTemplateClause)
        .where(AuditTemplateClause.template_id == template_id)
        .order_by(AuditTemplateClause.sort_order.asc(), AuditTemplateClause.clause_code.asc())
    ).all()

    for clause in template_clauses:
        db.add(
            AuditReportClauseCheck(
                audit_report_id=report_id,
                section_code=clause.section_code,
                clause_code=clause.clause_code,
                clause_title=clause.clause_title,
                applicable=clause.is_applicable_default,
                clause_status="compliant",
                sort_order=clause.sort_order,
            )
        )


def _map_integrity_error(exc: IntegrityError) -> HTTPException:
    message = str(exc.orig).lower()
    if "unique" in message and "audit_reports_consultancy_id_client_id_template_id_report_y" in message:
        return HTTPException(
            status_code=409,
            detail="Ya existe una auditoría para ese cliente, template y año.",
        )
    if "foreign key" in message and "client" in message:
        return HTTPException(status_code=404, detail="Cliente no encontrado")
    if "foreign key" in message and "template" in message:
        return HTTPException(status_code=404, detail="Template de auditoría no encontrado")
    return HTTPException(status_code=400, detail="No se pudo persistir la auditoría")


def _is_audit_report_code_collision(exc: IntegrityError) -> bool:
    message = str(exc.orig).lower()
    return (
        "duplicate key value violates unique constraint" in message
        and "audit_reports_consultancy_id_client_id_template_id_report_y" in message
        and "report_code" in message
    )


def _load_report_children(db: Session, report_id: UUID) -> dict:
    interviewees = db.scalars(
        select(AuditReportInterviewee)
        .where(AuditReportInterviewee.audit_report_id == report_id)
        .order_by(AuditReportInterviewee.sort_order.asc(), AuditReportInterviewee.created_at.asc())
    ).all()
    sections = db.scalars(
        select(AuditReportSection)
        .where(AuditReportSection.audit_report_id == report_id)
        .order_by(AuditReportSection.sort_order.asc(), AuditReportSection.section_code.asc())
    ).all()
    items = db.scalars(
        select(AuditReportItem)
        .where(AuditReportItem.audit_report_id == report_id)
        .order_by(
            AuditReportItem.section_code.asc(),
            AuditReportItem.sort_order.asc(),
            AuditReportItem.item_code.asc(),
        )
    ).all()
    clause_checks = db.scalars(
        select(AuditReportClauseCheck)
        .where(AuditReportClauseCheck.audit_report_id == report_id)
        .order_by(
            AuditReportClauseCheck.section_code.asc(),
            AuditReportClauseCheck.sort_order.asc(),
            AuditReportClauseCheck.clause_code.asc(),
        )
    ).all()
    recommendations = db.scalars(
        select(AuditReportRecommendation)
        .where(AuditReportRecommendation.audit_report_id == report_id)
        .order_by(AuditReportRecommendation.created_at.desc(), AuditReportRecommendation.id.desc())
    ).all()
    annexes = db.scalars(
        select(AuditReportAnnex)
        .where(AuditReportAnnex.audit_report_id == report_id)
        .order_by(AuditReportAnnex.sort_order.asc(), AuditReportAnnex.created_at.asc())
    ).all()

    return {
        "interviewees": interviewees,
        "sections": sections,
        "items": items,
        "clause_checks": clause_checks,
        "recommendations": recommendations,
        "annexes": annexes,
    }


def _short_text(value: str | None, *, max_len: int = 180) -> str:
    normalized = re.sub(r"\s+", " ", (value or "").strip())
    if not normalized:
        return "-"
    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[: max_len - 1].rstrip()}…"


def _normalize_yes_no_text(value: object) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"yes", "si", "sÃ­", "true", "1"}:
        return "yes"
    if normalized in {"no", "false", "0"}:
        return "no"
    return "no"


def _is_final_report_status(value: str | None) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"completed", "approved", "closed", "final", "finalized"}


def _summarize_performance_matrix(value_json: object) -> str | None:
    if isinstance(value_json, list):
        safe_rows = [row for row in value_json if isinstance(row, dict)]
        if not safe_rows:
            return None
        sample = ", ".join(
            str(row.get("indicator") or "").strip() for row in safe_rows[:3] if str(row.get("indicator") or "").strip()
        )
        return (
            f"Matriz P09 de indicadores (formato legado): {len(safe_rows)} indicadores. "
            f"Muestra: {sample or '-'}."
        )

    if not isinstance(value_json, dict):
        return None
    indicators = value_json.get("indicators")
    tracking = value_json.get("tracking")
    annual_mode = str(value_json.get("annual_mode") or "").strip().lower()

    safe_indicators = indicators if isinstance(indicators, list) else []
    safe_tracking = tracking if isinstance(tracking, list) else []
    if not safe_indicators and not safe_tracking:
        return None

    objective_yes = 0
    with_target = 0
    indicator_labels: list[str] = []
    for row in safe_indicators:
        if not isinstance(row, dict):
            continue
        if _normalize_yes_no_text(row.get("objective_associated")) == "yes":
            objective_yes += 1
        if str(row.get("target") or "").strip():
            with_target += 1
        label = str(row.get("indicator") or "").strip()
        if label:
            indicator_labels.append(label)

    sample = ", ".join(indicator_labels[:3]) if indicator_labels else "-"
    annual_label = annual_mode if annual_mode in {"average", "sum"} else "-"
    return (
        f"Matriz P09 de indicadores: {len(safe_indicators)} indicadores, "
        f"{len(safe_tracking)} filas de seguimiento, modo anual={annual_label}, "
        f"con objetivo asociado='si': {objective_yes}, con meta definida: {with_target}. "
        f"Muestra: {sample}."
    )


def _build_export_context_by_section(
    *,
    db: Session,
    report: AuditReport,
    consultancy_id: UUID,
) -> dict[str, str]:
    tables = _load_public_tables(db)
    context: dict[str, list[str]] = {code: [] for code in ("4", "5", "6", "7", "8", "9", "10")}

    context["4"].append(
        f"Entidad: {_short_text(report.entity_name)}. Alcance declarado: {_short_text(report.system_scope)}."
    )
    context["5"].append(f"Responsable del sistema declarado: {_short_text(report.quality_responsible_name)}.")
    context["8"].append(f"Area auditada: {_short_text(report.audited_area)}.")

    if _CONTEXT_DOCUMENT_TABLES.issubset(tables):
        context_document = db.scalar(
            select(AuditContextDocument)
            .where(AuditContextDocument.audit_report_id == report.id)
            .limit(1)
        )
        if context_document is not None:
            context_rows = db.scalars(
                select(AuditContextDocumentRow)
                .where(AuditContextDocumentRow.document_id == context_document.id)
                .order_by(AuditContextDocumentRow.sort_order.asc(), AuditContextDocumentRow.created_at.asc())
            ).all()
            external_count = sum(
                1 for row in context_rows if str(row.context_group or "").strip().lower() == "externo"
            )
            internal_count = sum(
                1 for row in context_rows if str(row.context_group or "").strip().lower() == "interno"
            )
            context_sample = "; ".join(
                (
                    f"{_short_text(row.context_group, max_len=12)}:"
                    f"{_short_text(row.environment, max_len=34)}"
                    f" | R:{_short_text(row.risks, max_len=32)}"
                    f" | O:{_short_text(row.opportunities, max_len=32)}"
                    f" | A:{_short_text(row.actions, max_len=32)}"
                )
                for row in context_rows[:3]
            )
            context["4"].append(
                "Documento P09 de contexto "
                f"({_short_text(context_document.code, max_len=20)} rev {context_document.revision_number}, "
                f"estado={_short_text(context_document.status, max_len=20)}): "
                f"filas totales={len(context_rows)}, externas={external_count}, internas={internal_count}. "
                f"Muestra: {context_sample or '-'}."
            )
        else:
            context["4"].append("Documento P09 de contexto no registrado para esta auditoria.")
    else:
        context["4"].append("Tablas del documento P09 de contexto no disponibles en BD.")

    if "iso_context_profiles" in tables:
        profile = db.scalar(
            select(IsoContextProfile)
            .where(IsoContextProfile.consultancy_id == consultancy_id)
            .order_by(IsoContextProfile.updated_at.desc())
            .limit(1)
        )
        if profile is not None:
            context["4"].append(
                "Contexto interno/externo registrado. "
                f"Interno: {_short_text(profile.internal_context)}. "
                f"Externo: {_short_text(profile.external_context)}."
            )
            context["4"].append(
                f"Alcance del SGC: {_short_text(profile.system_scope)}. "
                f"Exclusiones: {_short_text(profile.exclusions)}."
            )
        else:
            context["4"].append("No hay perfil de contexto ISO registrado.")
    else:
        context["4"].append("Tabla de contexto ISO no disponible en BD.")

    if "iso_interested_parties" in tables:
        parties = db.scalars(
            select(IsoInterestedParty)
            .where(
                IsoInterestedParty.consultancy_id == consultancy_id,
                IsoInterestedParty.status == "active",
            )
            .order_by(IsoInterestedParty.updated_at.desc())
            .limit(3)
        ).all()
        if parties:
            parties_text = "; ".join(
                f"{party.name} ({party.party_type}): {_short_text(party.needs_expectations, max_len=90)}"
                for party in parties
            )
            context["4"].append(f"Partes interesadas activas (muestra): {parties_text}.")
        else:
            context["4"].append("No hay partes interesadas activas registradas.")
    else:
        context["4"].append("Tabla de partes interesadas no disponible en BD.")

    if _INTERESTED_PARTIES_DOCUMENT_TABLES.issubset(tables):
        interested_document = db.scalar(
            select(AuditInterestedPartiesDocument)
            .where(AuditInterestedPartiesDocument.audit_report_id == report.id)
            .limit(1)
        )
        if interested_document is not None:
            interested_rows = db.scalars(
                select(AuditInterestedPartiesDocumentRow)
                .where(AuditInterestedPartiesDocumentRow.document_id == interested_document.id)
                .order_by(
                    AuditInterestedPartiesDocumentRow.sort_order.asc(),
                    AuditInterestedPartiesDocumentRow.created_at.asc(),
                )
            ).all()
            applies_count = sum(1 for row in interested_rows if bool(row.applies))
            parties_sample = "; ".join(
                (
                    f"{_short_text(row.stakeholder_name, max_len=28)}"
                    f" | Req:{_short_text(row.requirements, max_len=24)}"
                    f" | R:{_short_text(row.risks, max_len=24)}"
                    f" | O:{_short_text(row.opportunities, max_len=24)}"
                    f" | Acc:{_short_text(row.actions, max_len=24)}"
                )
                for row in interested_rows[:3]
            )
            context["4"].append(
                "Documento P09 de partes interesadas "
                f"({_short_text(interested_document.code, max_len=20)} rev {interested_document.revision_number}, "
                f"estado={_short_text(interested_document.status, max_len=20)}): "
                f"partes registradas={len(interested_rows)}, aplicables={applies_count}. "
                f"Muestra: {parties_sample or '-'}."
            )
        else:
            context["4"].append("Documento P09 de partes interesadas no registrado para esta auditoria.")
    else:
        context["4"].append("Tablas del documento P09 de partes interesadas no disponibles en BD.")

    if "quality_policies" in tables:
        policy = db.scalar(
            select(QualityPolicy)
            .where(
                QualityPolicy.consultancy_id == consultancy_id,
                or_(QualityPolicy.client_id.is_(None), QualityPolicy.client_id == report.client_id),
            )
            .order_by(
                QualityPolicy.is_active.desc(),
                QualityPolicy.approved_date.desc().nullslast(),
                QualityPolicy.updated_at.desc(),
            )
            .limit(1)
        )
        if policy is not None:
            context["5"].append(
                f"Politica de calidad version {policy.version_label} "
                f"(activa: {'si' if policy.is_active else 'no'}). "
                f"Texto: {_short_text(policy.policy_text)}."
            )
        else:
            context["5"].append("No hay politica de calidad registrada para este contexto.")
    else:
        context["5"].append("Tabla de politica de calidad no disponible en BD.")

    if "iso_role_assignments" in tables:
        roles = db.scalars(
            select(IsoRoleAssignment)
            .where(
                IsoRoleAssignment.consultancy_id == consultancy_id,
                IsoRoleAssignment.status == "active",
            )
            .order_by(IsoRoleAssignment.updated_at.desc())
            .limit(4)
        ).all()
        if roles:
            roles_text = "; ".join(
                f"{row.role_name}: {row.responsible_name} ({_short_text(row.responsibility_details, max_len=80)})"
                for row in roles
            )
            context["5"].append(f"Roles/responsabilidades activas (muestra): {roles_text}.")
        else:
            context["5"].append("No hay roles y responsabilidades activos registrados.")
    else:
        context["5"].append("Tabla de roles y responsabilidades no disponible en BD.")

    if "iso_process_map_items" in tables:
        process_counts = db.execute(
            select(IsoProcessMapItem.process_type, func.count(IsoProcessMapItem.id))
            .where(
                IsoProcessMapItem.consultancy_id == consultancy_id,
                IsoProcessMapItem.status == "active",
            )
            .group_by(IsoProcessMapItem.process_type)
        ).all()
        if process_counts:
            mapped = ", ".join(f"{ptype}:{count}" for ptype, count in process_counts)
            context["4"].append(f"Mapa de procesos activo por tipo: {mapped}.")
        else:
            context["4"].append("No hay procesos activos en el mapa de procesos.")
    else:
        context["4"].append("Tabla de mapa de procesos no disponible en BD.")

    if "iso_quality_objectives" in tables:
        objectives_total = int(
            db.scalar(
                select(func.count(IsoQualityObjective.id)).where(
                    IsoQualityObjective.consultancy_id == consultancy_id
                )
            )
            or 0
        )
        linked_kpi = int(
            db.scalar(
                select(func.count(IsoQualityObjective.id)).where(
                    IsoQualityObjective.consultancy_id == consultancy_id,
                    IsoQualityObjective.linked_kpi_id.is_not(None),
                )
            )
            or 0
        )
        context["6"].append(
            f"Objetivos de calidad registrados: {objectives_total}. Vinculados a KPI: {linked_kpi}."
        )
    else:
        context["6"].append("Tabla de objetivos de calidad no disponible en BD.")

    if "iso_change_plans" in tables:
        change_open = int(
            db.scalar(
                select(func.count(IsoChangePlan.id)).where(
                    IsoChangePlan.consultancy_id == consultancy_id,
                    IsoChangePlan.status.in_(["planned", "in_progress"]),
                )
            )
            or 0
        )
        next_change = db.scalar(
            select(IsoChangePlan)
            .where(
                IsoChangePlan.consultancy_id == consultancy_id,
                IsoChangePlan.status.in_(["planned", "in_progress"]),
            )
            .order_by(IsoChangePlan.planned_date.asc())
            .limit(1)
        )
        if next_change is not None:
            context["6"].append(
                f"Cambios planificados abiertos: {change_open}. "
                f"Proximo: {next_change.change_title} ({next_change.planned_date})."
            )
        else:
            context["6"].append(f"Cambios planificados abiertos: {change_open}.")
    else:
        context["6"].append("Tabla de planificacion de cambios no disponible en BD.")

    if "risk_opportunities" in tables:
        risks_open = int(
            db.scalar(
                select(func.count(RiskOpportunity.id)).where(
                    RiskOpportunity.consultancy_id == consultancy_id,
                    RiskOpportunity.item_type == "risk",
                    ~RiskOpportunity.status.in_(["closed", "completed"]),
                )
            )
            or 0
        )
        opportunities_open = int(
            db.scalar(
                select(func.count(RiskOpportunity.id)).where(
                    RiskOpportunity.consultancy_id == consultancy_id,
                    RiskOpportunity.item_type == "opportunity",
                    ~RiskOpportunity.status.in_(["closed", "completed"]),
                )
            )
            or 0
        )
        context["6"].append(
            f"Riesgos abiertos: {risks_open}. Oportunidades abiertas: {opportunities_open}."
        )
    else:
        context["6"].append("Tabla de riesgos y oportunidades no disponible en BD.")

    if _RISK_OPPORTUNITY_DOCUMENT_TABLES.issubset(tables):
        risk_document = db.scalar(
            select(AuditRiskOpportunityDocument)
            .where(AuditRiskOpportunityDocument.audit_report_id == report.id)
            .limit(1)
        )
        if risk_document is not None:
            risk_rows = db.scalars(
                select(AuditRiskOpportunityDocumentRow)
                .where(AuditRiskOpportunityDocumentRow.document_id == risk_document.id)
                .order_by(
                    AuditRiskOpportunityDocumentRow.sort_order.asc(),
                    AuditRiskOpportunityDocumentRow.created_at.asc(),
                )
            ).all()
            risk_count = 0
            opportunity_count = 0
            swot_count = 0
            action_count = 0
            action_indicator_yes = 0
            action_objective_yes = 0
            risk_sample_labels: list[str] = []
            opportunity_sample_labels: list[str] = []
            action_sample_labels: list[str] = []
            for row in risk_rows:
                row_type = str(row.row_type or "").strip().lower()
                if row_type == "risk":
                    risk_count += 1
                    if len(risk_sample_labels) < 2 and str(row.description or "").strip():
                        risk_sample_labels.append(_short_text(row.description, max_len=45))
                elif row_type == "opportunity":
                    opportunity_count += 1
                    if len(opportunity_sample_labels) < 2 and str(row.description or "").strip():
                        opportunity_sample_labels.append(_short_text(row.description, max_len=45))
                elif row_type == "swot":
                    swot_count += 1
                elif row_type in {"follow_up", "action"}:
                    action_count += 1
                    if _normalize_yes_no_text(row.indicator) == "yes":
                        action_indicator_yes += 1
                    if _normalize_yes_no_text(row.follow_up_status) == "yes":
                        action_objective_yes += 1
                    if len(action_sample_labels) < 2 and str(row.action or "").strip():
                        action_sample_labels.append(_short_text(row.action, max_len=45))
            context["6"].append(
                "Documento P09 de riesgos y oportunidades "
                f"({_short_text(risk_document.code, max_len=20)} rev {risk_document.revision_number}, "
                f"estado={_short_text(risk_document.status, max_len=20)}): "
                f"DAFO={swot_count}, riesgos={risk_count}, oportunidades={opportunity_count}, "
                f"acciones={action_count}, acciones con indicador='si'={action_indicator_yes}, "
                f"acciones con objetivo asociado='si'={action_objective_yes}. "
                f"Muestra riesgos={'; '.join(risk_sample_labels) or '-'}; "
                f"oportunidades={'; '.join(opportunity_sample_labels) or '-'}; "
                f"acciones={'; '.join(action_sample_labels) or '-'}."
            )
        else:
            context["6"].append("Documento P09 de riesgos y oportunidades no registrado para esta auditoria.")
    else:
        context["6"].append("Tablas del documento P09 de riesgos y oportunidades no disponibles en BD.")

    if "suppliers" in tables:
        suppliers_critical = int(
            db.scalar(
                select(func.count(Supplier.id)).where(
                    Supplier.consultancy_id == consultancy_id,
                    Supplier.final_rating == "critical",
                )
            )
            or 0
        )
        context["8"].append(f"Proveedores evaluados en estado critico: {suppliers_critical}.")
    else:
        context["8"].append("Tabla de proveedores no disponible en BD.")

    if "kpi_indicators" in tables:
        kpis_total = int(
            db.scalar(select(func.count(KpiIndicator.id)).where(KpiIndicator.consultancy_id == consultancy_id))
            or 0
        )
        kpis_alert = int(
            db.scalar(
                select(func.count(KpiIndicator.id)).where(
                    KpiIndicator.consultancy_id == consultancy_id,
                    KpiIndicator.status.in_(["alerta", "critico"]),
                )
            )
            or 0
        )
        context["9"].append(f"KPIs registrados: {kpis_total}. En alerta/critico: {kpis_alert}.")
    else:
        context["9"].append("Tabla de indicadores KPI no disponible en BD.")

    performance_item = db.scalar(
        select(AuditReportItem)
        .where(
            AuditReportItem.audit_report_id == report.id,
            func.lower(AuditReportItem.item_code) == _PERFORMANCE_INDICATORS_ITEM_CODE,
        )
        .order_by(AuditReportItem.updated_at.desc())
        .limit(1)
    )
    if performance_item is not None:
        matrix_summary = _summarize_performance_matrix(performance_item.value_json)
        if matrix_summary:
            context["9"].append(matrix_summary)
        else:
            context["9"].append(
                "Matriz P09 de indicadores sin estructura valida en value_json; revisar guardado en seccion 9."
            )
    else:
        context["9"].append("Matriz P09 de indicadores no registrada para esta auditoria.")

    if "customer_feedback" in tables:
        feedback_total = int(
            db.scalar(
                select(func.count(CustomerFeedback.id)).where(
                    CustomerFeedback.consultancy_id == consultancy_id,
                    CustomerFeedback.client_id == report.client_id,
                )
            )
            or 0
        )
        feedback_avg = db.scalar(
            select(func.avg(CustomerFeedback.score)).where(
                CustomerFeedback.consultancy_id == consultancy_id,
                CustomerFeedback.client_id == report.client_id,
            )
        )
        avg_label = f"{float(feedback_avg):.2f}/5" if feedback_avg is not None else "-"
        context["9"].append(
            f"Feedback cliente para entidad auditada: total={feedback_total}, media={avg_label}."
        )
    else:
        context["9"].append("Tabla de satisfaccion del cliente no disponible en BD.")

    recommendation_ids_subquery = select(AuditReportRecommendation.id).where(
        AuditReportRecommendation.audit_report_id == report.id
    )
    recommendations_total = int(
        db.scalar(
            select(func.count(AuditReportRecommendation.id)).where(
                AuditReportRecommendation.audit_report_id == report.id
            )
        )
        or 0
    )
    context["10"].append(f"Recomendaciones registradas en esta auditoria: {recommendations_total}.")

    if "iso_nonconformities" in tables:
        nc_total = int(
            db.scalar(
                select(func.count(IsoNonconformity.id)).where(
                    IsoNonconformity.consultancy_id == consultancy_id,
                    IsoNonconformity.source_recommendation_id.in_(recommendation_ids_subquery),
                )
            )
            or 0
        )
        nc_open = int(
            db.scalar(
                select(func.count(IsoNonconformity.id)).where(
                    IsoNonconformity.consultancy_id == consultancy_id,
                    IsoNonconformity.source_recommendation_id.in_(recommendation_ids_subquery),
                    IsoNonconformity.status != "closed",
                )
            )
            or 0
        )
        context["10"].append(
            f"No conformidades vinculadas a esta auditoria: {nc_total}. Abiertas: {nc_open}."
        )
        context["8"].append(
            f"Control de salidas no conformes: NC vinculadas={nc_total}, abiertas={nc_open}."
        )
    else:
        context["10"].append("Tabla de no conformidades no disponible en BD.")

    if "iso_improvements" in tables and "iso_nonconformities" in tables:
        improvements_total = int(
            db.scalar(
                select(func.count(IsoImprovement.id))
                .select_from(IsoImprovement)
                .join(IsoNonconformity, IsoNonconformity.id == IsoImprovement.linked_nonconformity_id)
                .where(
                    IsoImprovement.consultancy_id == consultancy_id,
                    IsoNonconformity.source_recommendation_id.in_(recommendation_ids_subquery),
                )
            )
            or 0
        )
        context["10"].append(f"Mejoras vinculadas a NC de esta auditoria: {improvements_total}.")
    elif "iso_improvements" not in tables:
        context["10"].append("Tabla de mejora continua no disponible en BD.")

    if "management_review_references" in tables and "management_reviews" in tables:
        linked_reviews = db.scalars(
            select(ManagementReview)
            .join(
                ManagementReviewReference,
                ManagementReviewReference.management_review_id == ManagementReview.id,
            )
            .where(
                ManagementReviewReference.consultancy_id == consultancy_id,
                ManagementReviewReference.reference_type == "audit_report",
                ManagementReviewReference.source_id == report.id,
            )
            .order_by(ManagementReview.review_date.desc())
            .limit(2)
        ).all()
        if linked_reviews:
            reviews_text = "; ".join(
                f"{item.review_date} ({item.followup_status})" for item in linked_reviews
            )
            context["9"].append(f"Revisiones por la direccion vinculadas: {reviews_text}.")
        else:
            context["9"].append("No hay revisiones por la direccion vinculadas a esta auditoria.")
    else:
        context["9"].append("Tabla de revision por la direccion no disponible en BD.")

    return {
        section: " ".join(chunk.strip() for chunk in chunks if chunk and chunk.strip())
        for section, chunks in context.items()
    }


def _query_recommendation_history_rows(
    db: Session,
    *,
    report: AuditReport,
    consultancy_id: UUID,
):
    return db.execute(
        select(AuditReportRecommendation, AuditReport.report_year, AuditReport.report_code)
        .join(AuditReport, AuditReport.id == AuditReportRecommendation.audit_report_id)
        .where(
            AuditReportRecommendation.consultancy_id == consultancy_id,
            AuditReportRecommendation.client_id == report.client_id,
            AuditReportRecommendation.audit_report_id != report.id,
        )
        .order_by(
            AuditReport.report_year.desc(),
            AuditReportRecommendation.created_at.desc(),
            AuditReportRecommendation.id.desc(),
        )
    ).all()


def _serialize_recommendation_history_rows(
    rows,
) -> list[AuditRecommendationHistoryItem]:
    result: list[AuditRecommendationHistoryItem] = []
    for recommendation, history_report_year, history_report_code in rows:
        result.append(
            AuditRecommendationHistoryItem(
                id=recommendation.id,
                audit_report_id=recommendation.audit_report_id,
                source_audit_report_id=recommendation.source_audit_report_id,
                report_year=history_report_year,
                report_code=history_report_code,
                recommendation_year=recommendation.recommendation_year,
                recommendation_type=recommendation.recommendation_type,
                priority=recommendation.priority,
                section_code=recommendation.section_code,
                body_text=recommendation.body_text,
                followup_comment=recommendation.followup_comment,
                recommendation_status=recommendation.recommendation_status,
                carried_from_previous=recommendation.carried_from_previous,
                created_at=recommendation.created_at,
                updated_at=recommendation.updated_at,
            )
        )
    return result


def _sanitize_docx_filename(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-.")
    return normalized or "informe-auditoria"


def _serialize_report_compliance(
    compliance: ReportComplianceResult,
) -> AuditReportComplianceRead:
    return AuditReportComplianceRead(
        report_id=compliance.report_id,
        overall_status=compliance.overall_status,
        completed_blocks=compliance.completed_blocks,
        total_blocks=compliance.total_blocks,
        blocks=[
            AuditComplianceBlockRead(
                block_code=block.block_code,
                block_title=block.block_title,
                section_code=block.section_code,
                status=block.status,
                required_fields=block.required_fields,
                completed_fields=block.completed_fields,
                missing_fields=block.missing_fields,
            )
            for block in compliance.blocks
        ],
    )


@router.get("/audit-reports", response_model=list[AuditReportListItem])
def list_audit_reports(
    client_id: UUID | None = Query(default=None),
    report_year: int | None = Query(default=None, ge=2000, le=2200),
    status_filter: str | None = Query(default=None, alias="status"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportListItem]:
    try:
        query = (
            select(AuditReport, Client, User)
            .join(Client, Client.id == AuditReport.client_id)
            .outerjoin(User, User.id == AuditReport.created_by_user_id)
            .where(AuditReport.consultancy_id == auth.consultancy.id)
        )

        if client_id is not None:
            query = query.where(AuditReport.client_id == client_id)
        if report_year is not None:
            query = query.where(AuditReport.report_year == report_year)
        if status_filter:
            query = query.where(func.lower(AuditReport.status) == status_filter.strip().lower())

        rows = db.execute(
            query.order_by(AuditReport.created_at.desc(), AuditReport.id.desc())
        ).all()

        result: list[AuditReportListItem] = []
        for report, client, created_by in rows:
            result.append(
                AuditReportListItem(
                    id=report.id,
                    client_id=report.client_id,
                    template_id=report.template_id,
                    report_year=report.report_year,
                    report_code=report.report_code,
                    status=report.status,
                    entity_name=report.entity_name,
                    audit_date=report.audit_date,
                    created_at=report.created_at,
                    updated_at=report.updated_at,
                    client=AuditClientBasic.model_validate(client),
                    created_by=AuditUserBasic.model_validate(created_by) if created_by else None,
                )
            )
        return result
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing audit reports")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar auditorías.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing audit reports")
        raise HTTPException(status_code=500, detail="No se pudieron listar las auditorías") from exc


@router.post("/audit-reports", response_model=AuditReportRead, status_code=status.HTTP_201_CREATED)
def create_audit_report(
    payload: AuditReportCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReport:
    try:
        for attempt in range(1, _CREATE_REPORT_MAX_RETRIES + 1):
            try:
                with _transaction_scope(db):
                    client = _get_scoped_client_or_404(db, payload.client_id, auth.consultancy.id)
                    template = _get_active_template_or_404(db, payload.template_code)
                    report_code = _build_report_code(
                        db,
                        consultancy_id=auth.consultancy.id,
                        template_code=template.code,
                        report_year=payload.report_year,
                    )

                    report = AuditReport(
                        consultancy_id=auth.consultancy.id,
                        client_id=client.id,
                        template_id=template.id,
                        created_by_user_id=auth.user.id,
                        report_year=payload.report_year,
                        report_code=report_code,
                        status="draft",
                        entity_name=_normalize_required_text(payload.entity_name, "entity_name")
                        if payload.entity_name
                        else client.name,
                        auditor_organization=_normalize_optional_text(payload.auditor_organization),
                        audited_area=_normalize_optional_text(payload.audited_area),
                        audit_date=payload.audit_date,
                        tipo_auditoria=(
                            _normalize_choice_text(
                                payload.tipo_auditoria,
                                field_name="tipo_auditoria",
                                allowed_values=_ALLOWED_AUDIT_TYPES,
                            )
                            or "inicial"
                        ),
                        modalidad=(
                            _normalize_choice_text(
                                payload.modalidad,
                                field_name="modalidad",
                                allowed_values=_ALLOWED_AUDIT_MODALITIES,
                            )
                            or "presencialmente"
                        ),
                        audited_facilities=_normalize_optional_text(payload.audited_facilities),
                        quality_responsible_name=_normalize_optional_text(
                            payload.quality_responsible_name
                        ),
                        reference_standard_revision=_normalize_optional_text(
                            payload.reference_standard_revision
                        ),
                        audit_budget_code=_normalize_optional_text(payload.audit_budget_code),
                        system_scope=_normalize_optional_text(payload.system_scope),
                        audit_description=_normalize_optional_text(payload.audit_description),
                    )
                    db.add(report)
                    db.flush()

                    _initialize_report_sections(db, report.id, template.id)
                    _initialize_report_clause_checks(db, report.id, template.id)

                db.refresh(report)
                logger.info(
                    "Audit report created: report_id=%s consultancy_id=%s client_id=%s template=%s",
                    report.id,
                    auth.consultancy.id,
                    report.client_id,
                    payload.template_code,
                )
                return report
            except IntegrityError as exc:
                if _is_audit_report_code_collision(exc) and attempt < _CREATE_REPORT_MAX_RETRIES:
                    logger.warning(
                        "Report code collision detected while creating audit report. "
                        "Retrying with a new code (attempt %s/%s).",
                        attempt,
                        _CREATE_REPORT_MAX_RETRIES,
                    )
                    continue
                raise
    except HTTPException:
        raise
    except IntegrityError as exc:
        logger.exception("Integrity error while creating audit report")
        raise _map_integrity_error(exc) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating audit report")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear la auditoría.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while creating audit report")
        raise HTTPException(status_code=500, detail="No se pudo crear la auditoría") from exc


@router.delete("/audit-reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audit_report(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            report = _get_report_or_404(db, report_id, auth.consultancy.id)
            normalized_status = str(report.status or "").strip().lower()
            if normalized_status in {"completed", "approved", "closed"}:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Solo se pueden eliminar auditorías en borrador o en progreso. "
                        "Esta auditoría ya está cerrada/completada."
                    ),
                )
            db.delete(report)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting audit report")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar la auditoría.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while deleting audit report")
        raise HTTPException(status_code=500, detail="No se pudo eliminar la auditoría") from exc


@router.get("/audit-reports/{report_id}", response_model=AuditReportDetailResponse)
def get_audit_report_detail(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportDetailResponse:
    try:
        report = _get_report_or_404(db, report_id, auth.consultancy.id)
        client = _get_scoped_client_or_404(db, report.client_id, auth.consultancy.id)
        children = _load_report_children(db, report.id)
        return AuditReportDetailResponse(
            report=AuditReportRead.model_validate(report),
            client=AuditClientBasic.model_validate(client),
            interviewees=[
                AuditReportIntervieweeRead.model_validate(item) for item in children["interviewees"]
            ],
            sections=[AuditReportSectionRead.model_validate(item) for item in children["sections"]],
            items=[AuditReportItemRead.model_validate(item) for item in children["items"]],
            clause_checks=[
                AuditReportClauseCheckRead.model_validate(item) for item in children["clause_checks"]
            ],
            recommendations=[
                AuditReportRecommendationRead.model_validate(item)
                for item in children["recommendations"]
            ],
            annexes=[AuditReportAnnexRead.model_validate(item) for item in children["annexes"]],
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading audit report detail")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar la auditoría.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while loading audit report detail")
        raise HTTPException(status_code=500, detail="No se pudo cargar la auditoría") from exc

@router.get("/audit-reports/{report_id}/compliance", response_model=AuditReportComplianceRead)
def get_audit_report_compliance(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportComplianceRead:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        compliance = load_report_compliance(db, report_id)
        return _serialize_report_compliance(compliance)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading audit compliance")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar compliance.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while loading audit compliance")
        raise HTTPException(status_code=500, detail="No se pudo cargar compliance de auditoria") from exc


@router.get(
    "/audit-reports/{report_id}/iso-workbench",
    response_model=AuditIsoWorkbenchSummaryRead,
)
def get_audit_report_iso_workbench(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditIsoWorkbenchSummaryRead:
    try:
        report = _get_report_or_404(db, report_id, auth.consultancy.id)
        tables = _load_public_tables(db)
        missing_tables: list[str] = []

        context_profile_completed = False
        interested_parties_active = 0
        quality_policies_active = 0
        role_assignments_active = 0
        process_map_items_active = 0
        objectives_total = 0
        objectives_linked_to_kpi = 0
        kpis_total = 0
        kpis_alert_or_critical = 0
        risks_open = 0
        suppliers_critical = 0
        customer_feedback_total = 0
        customer_feedback_average: float | None = None
        recommendations_total = 0
        nonconformities_from_audit_total = 0
        nonconformities_from_audit_open = 0
        improvements_from_audit_total = 0
        management_reviews_linked_total = 0

        if "iso_context_profiles" in tables:
            context_profile_completed = bool(
                int(
                    db.scalar(
                        select(func.count(IsoContextProfile.id)).where(
                            IsoContextProfile.consultancy_id == auth.consultancy.id
                        )
                    )
                    or 0
                )
            )
        else:
            missing_tables.append("iso_context_profiles")

        if "iso_interested_parties" in tables:
            interested_parties_active = int(
                db.scalar(
                    select(func.count(IsoInterestedParty.id)).where(
                        IsoInterestedParty.consultancy_id == auth.consultancy.id,
                        IsoInterestedParty.status == "active",
                    )
                )
                or 0
            )
        else:
            missing_tables.append("iso_interested_parties")

        if "quality_policies" in tables:
            quality_policies_active = int(
                db.scalar(
                    select(func.count(QualityPolicy.id)).where(
                        QualityPolicy.consultancy_id == auth.consultancy.id,
                        QualityPolicy.is_active.is_(True),
                        or_(
                            QualityPolicy.client_id.is_(None),
                            QualityPolicy.client_id == report.client_id,
                        ),
                    )
                )
                or 0
            )
        else:
            missing_tables.append("quality_policies")

        if "iso_role_assignments" in tables:
            role_assignments_active = int(
                db.scalar(
                    select(func.count(IsoRoleAssignment.id)).where(
                        IsoRoleAssignment.consultancy_id == auth.consultancy.id,
                        IsoRoleAssignment.status == "active",
                    )
                )
                or 0
            )
        else:
            missing_tables.append("iso_role_assignments")

        if "iso_process_map_items" in tables:
            process_map_items_active = int(
                db.scalar(
                    select(func.count(IsoProcessMapItem.id)).where(
                        IsoProcessMapItem.consultancy_id == auth.consultancy.id,
                        IsoProcessMapItem.status == "active",
                    )
                )
                or 0
            )
        else:
            missing_tables.append("iso_process_map_items")

        if "iso_quality_objectives" in tables:
            objectives_total = int(
                db.scalar(
                    select(func.count(IsoQualityObjective.id)).where(
                        IsoQualityObjective.consultancy_id == auth.consultancy.id
                    )
                )
                or 0
            )
            objectives_linked_to_kpi = int(
                db.scalar(
                    select(func.count(IsoQualityObjective.id)).where(
                        IsoQualityObjective.consultancy_id == auth.consultancy.id,
                        IsoQualityObjective.linked_kpi_id.is_not(None),
                    )
                )
                or 0
            )
        else:
            missing_tables.append("iso_quality_objectives")

        if "kpi_indicators" in tables:
            kpis_total = int(
                db.scalar(
                    select(func.count(KpiIndicator.id)).where(
                        KpiIndicator.consultancy_id == auth.consultancy.id
                    )
                )
                or 0
            )
            kpis_alert_or_critical = int(
                db.scalar(
                    select(func.count(KpiIndicator.id)).where(
                        KpiIndicator.consultancy_id == auth.consultancy.id,
                        KpiIndicator.status.in_(["alerta", "critico"]),
                    )
                )
                or 0
            )
        else:
            missing_tables.append("kpi_indicators")

        if "risk_opportunities" in tables:
            risks_open = int(
                db.scalar(
                    select(func.count(RiskOpportunity.id)).where(
                        RiskOpportunity.consultancy_id == auth.consultancy.id,
                        RiskOpportunity.item_type == "risk",
                        RiskOpportunity.status != "completed",
                    )
                )
                or 0
            )
        else:
            missing_tables.append("risk_opportunities")

        if "suppliers" in tables:
            suppliers_critical = int(
                db.scalar(
                    select(func.count(Supplier.id)).where(
                        Supplier.consultancy_id == auth.consultancy.id,
                        Supplier.final_rating == "critical",
                    )
                )
                or 0
            )
        else:
            missing_tables.append("suppliers")

        if "customer_feedback" in tables:
            customer_feedback_total = int(
                db.scalar(
                    select(func.count(CustomerFeedback.id)).where(
                        CustomerFeedback.consultancy_id == auth.consultancy.id,
                        CustomerFeedback.client_id == report.client_id,
                    )
                )
                or 0
            )
            feedback_avg = db.scalar(
                select(func.avg(CustomerFeedback.score)).where(
                    CustomerFeedback.consultancy_id == auth.consultancy.id,
                    CustomerFeedback.client_id == report.client_id,
                )
            )
            customer_feedback_average = float(feedback_avg) if feedback_avg is not None else None
        else:
            missing_tables.append("customer_feedback")

        recommendations_total = int(
            db.scalar(
                select(func.count(AuditReportRecommendation.id)).where(
                    AuditReportRecommendation.audit_report_id == report.id
                )
            )
            or 0
        )

        recommendation_ids_subquery = select(AuditReportRecommendation.id).where(
            AuditReportRecommendation.audit_report_id == report.id
        )
        if "iso_nonconformities" in tables:
            nonconformities_from_audit_total = int(
                db.scalar(
                    select(func.count(IsoNonconformity.id)).where(
                        IsoNonconformity.consultancy_id == auth.consultancy.id,
                        IsoNonconformity.source_recommendation_id.in_(recommendation_ids_subquery),
                    )
                )
                or 0
            )
            nonconformities_from_audit_open = int(
                db.scalar(
                    select(func.count(IsoNonconformity.id)).where(
                        IsoNonconformity.consultancy_id == auth.consultancy.id,
                        IsoNonconformity.source_recommendation_id.in_(recommendation_ids_subquery),
                        IsoNonconformity.status != "closed",
                    )
                )
                or 0
            )
        else:
            missing_tables.append("iso_nonconformities")

        if "iso_improvements" in tables and "iso_nonconformities" in tables:
            improvements_from_audit_total = int(
                db.scalar(
                    select(func.count(IsoImprovement.id))
                    .select_from(IsoImprovement)
                    .join(
                        IsoNonconformity,
                        IsoNonconformity.id == IsoImprovement.linked_nonconformity_id,
                    )
                    .where(
                        IsoImprovement.consultancy_id == auth.consultancy.id,
                        IsoNonconformity.source_recommendation_id.in_(recommendation_ids_subquery),
                    )
                )
                or 0
            )
        else:
            if "iso_improvements" not in tables:
                missing_tables.append("iso_improvements")

        if "management_review_references" in tables:
            management_reviews_linked_total = int(
                db.scalar(
                    select(func.count(ManagementReviewReference.id)).where(
                        ManagementReviewReference.consultancy_id == auth.consultancy.id,
                        ManagementReviewReference.reference_type == "audit_report",
                        ManagementReviewReference.source_id == report.id,
                    )
                )
                or 0
            )
        else:
            missing_tables.append("management_review_references")

        return AuditIsoWorkbenchSummaryRead(
            report_id=report.id,
            client_id=report.client_id,
            report_year=report.report_year,
            context_profile_completed=context_profile_completed,
            interested_parties_active=interested_parties_active,
            quality_policies_active=quality_policies_active,
            role_assignments_active=role_assignments_active,
            process_map_items_active=process_map_items_active,
            objectives_total=objectives_total,
            objectives_linked_to_kpi=objectives_linked_to_kpi,
            kpis_total=kpis_total,
            kpis_alert_or_critical=kpis_alert_or_critical,
            risks_open=risks_open,
            suppliers_critical=suppliers_critical,
            customer_feedback_total=customer_feedback_total,
            customer_feedback_average=customer_feedback_average,
            recommendations_total=recommendations_total,
            nonconformities_from_audit_total=nonconformities_from_audit_total,
            nonconformities_from_audit_open=nonconformities_from_audit_open,
            improvements_from_audit_total=improvements_from_audit_total,
            management_reviews_linked_total=management_reviews_linked_total,
            missing_tables=sorted(set(missing_tables)),
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading audit iso workbench")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el flujo ISO de auditoria.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while loading audit iso workbench")
        raise HTTPException(status_code=500, detail="No se pudo cargar el flujo ISO de auditoria") from exc


@router.patch("/audit-reports/{report_id}", response_model=AuditReportRead)
def patch_audit_report(
    report_id: UUID,
    payload: AuditReportUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReport:
    try:
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return _get_report_or_404(db, report_id, auth.consultancy.id)

        status_value = data.get("status")
        if status_value is not None:
            normalized_status_check = _normalize_required_text(status_value, "status")
            if normalized_status_check in {"completed", "approved"}:
                _get_report_or_404(db, report_id, auth.consultancy.id)
                compliance = load_report_compliance(db, report_id)
                pending_blocks = get_pending_blocks_for_report_close(compliance)
                db.rollback()
                if pending_blocks:
                    pending_labels = ", ".join(
                        f"{block.section_code}:{block.block_code}" for block in pending_blocks
                    )
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "No se puede cerrar la auditoria: bloques ISO incompletos -> "
                            f"{pending_labels}"
                        ),
                    )

        with _transaction_scope(db):
            report = _get_report_or_404(db, report_id, auth.consultancy.id)
            status_value = data.get("status")
            if status_value is not None:
                normalized_status = _normalize_required_text(status_value, "status")
                data["status"] = normalized_status

            for field, value in data.items():
                if field == "entity_name":
                    setattr(report, field, _normalize_required_text(value, "entity_name"))
                    continue
                if field in {
                    "auditor_organization",
                    "audited_area",
                    "audited_facilities",
                    "quality_responsible_name",
                    "reference_standard_revision",
                    "audit_budget_code",
                    "system_scope",
                    "audit_description",
                    "conclusions_text",
                    "final_dispositions_text",
                }:
                    setattr(report, field, _normalize_optional_text(value))
                    continue
                if field in {"tipo_auditoria", "modalidad"}:
                    allowed_values = (
                        _ALLOWED_AUDIT_TYPES if field == "tipo_auditoria" else _ALLOWED_AUDIT_MODALITIES
                    )
                    normalized_choice = _normalize_choice_text(
                        value,
                        field_name=field,
                        allowed_values=allowed_values,
                        required=True,
                    )
                    setattr(report, field, normalized_choice)
                    continue
                if field in {"reference_standard", "status"}:
                    normalized_required = _normalize_required_text(value, field)
                    setattr(report, field, normalized_required)
                    if field == "status":
                        if normalized_required == "approved":
                            report.approved_by_user_id = auth.user.id
                        elif normalized_required != "approved":
                            report.approved_by_user_id = None
                    continue
                setattr(report, field, value)
            db.flush()

        db.refresh(report)
        return report
    except HTTPException:
        raise
    except IntegrityError as exc:
        logger.exception("Integrity error while updating audit report")
        raise _map_integrity_error(exc) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating audit report")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar la auditoría.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while updating audit report")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la auditoría") from exc


@router.get("/audit-reports/{report_id}/sections", response_model=list[AuditReportSectionRead])
def list_audit_report_sections(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportSection]:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        sections = db.scalars(
            select(AuditReportSection)
            .where(AuditReportSection.audit_report_id == report_id)
            .order_by(AuditReportSection.sort_order.asc(), AuditReportSection.section_code.asc())
        ).all()
        return list(sections)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing sections")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar secciones.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing sections")
        raise HTTPException(status_code=500, detail="No se pudieron listar las secciones") from exc


@router.patch(
    "/audit-reports/{report_id}/sections/{section_code}",
    response_model=AuditReportSectionRead,
)
def patch_audit_report_section(
    report_id: UUID,
    section_code: str,
    payload: AuditReportSectionUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportSection:
    try:
        data = payload.model_dump(exclude_unset=True)
        if not data:
            _get_report_or_404(db, report_id, auth.consultancy.id)
            return _ensure_section_exists(db, report_id, section_code)

        status_value = data.get("status")
        if status_value is not None:
            normalized_status = _normalize_required_text(status_value, "status")
            data["status"] = normalized_status
            if normalized_status == "completed":
                _get_report_or_404(db, report_id, auth.consultancy.id)
                pre_section = _ensure_section_exists(db, report_id, section_code)
                compliance = load_report_compliance(db, report_id)
                missing_requirements = get_section_missing_requirements(
                    compliance,
                    pre_section.section_code.strip(),
                )
                db.rollback()
                if missing_requirements:
                    missing_text = ", ".join(missing_requirements)
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "No se puede completar la seccion: faltan evidencias requeridas -> "
                            f"{missing_text}"
                        ),
                    )

        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            section = _ensure_section_exists(db, report_id, section_code)
            for field, value in data.items():
                if field in {"auditor_notes", "ai_draft_text", "final_text"}:
                    setattr(section, field, _normalize_optional_text(value))
                elif field == "status":
                    setattr(section, field, _normalize_required_text(value, "status"))
                else:
                    setattr(section, field, value)
            db.flush()

        db.refresh(section)
        return section
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating section")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar la sección.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while updating section")
        raise HTTPException(status_code=500, detail=f"No se pudo actualizar la sección [{type(exc).__name__}: {exc}]") from exc


def _validate_items_payload(items: list[AuditReportItemInput]) -> None:
    seen_codes: set[str] = set()
    for item in items:
        normalized_code = item.item_code.strip().lower()
        if normalized_code in seen_codes:
            raise HTTPException(
                status_code=400,
                detail=f"item_code duplicado en payload: {item.item_code}",
            )
        seen_codes.add(normalized_code)


def _filter_items_for_section(
    section_code: str,
    items: list[AuditReportItemInput],
) -> list[AuditReportItemInput]:
    normalized_section_code = section_code.strip().lower()
    if normalized_section_code != "6":
        return list(items)

    filtered: list[AuditReportItemInput] = []
    for item in items:
        normalized_code = item.item_code.strip().lower()
        if normalized_code in _SECTION6_ALLOWED_ITEM_CODES:
            filtered.append(item)
    return filtered


def _normalize_interested_parties_document_status(value: str | None) -> str:
    normalized = _normalize_required_text(value, "status").lower()
    if normalized not in {"draft", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="status invalido. Valores permitidos: draft, completed.",
        )
    return normalized


def _normalize_interested_parties_document_rows(
    rows: list[AuditInterestedPartiesDocumentRowInput],
) -> list[dict[str, str | bool | None]]:
    normalized_rows: list[dict[str, str | bool | None]] = []
    for row in rows:
        stakeholder_name = _normalize_optional_text(row.stakeholder_name)
        needs = _normalize_optional_text(row.needs)
        expectations = _normalize_optional_text(row.expectations)
        requirements = _normalize_optional_text(row.requirements)
        risks = _normalize_optional_text(row.risks)
        opportunities = _normalize_optional_text(row.opportunities)
        actions = _normalize_optional_text(row.actions)
        legacy_needs_expectations = _normalize_optional_text(row.needs_expectations)
        observations = _normalize_optional_text(row.observations)

        if needs is None and expectations is None and legacy_needs_expectations is not None:
            # Backward compatibility with previous payloads.
            needs = legacy_needs_expectations

        if (
            stakeholder_name is None
            and needs is None
            and expectations is None
            and requirements is None
            and risks is None
            and opportunities is None
            and actions is None
            and observations is None
        ):
            continue

        if stakeholder_name is None:
            raise HTTPException(
                status_code=400,
                detail="stakeholder_name es requerido en filas no vacias.",
            )

        normalized_rows.append(
            {
                "stakeholder_name": stakeholder_name,
                "needs": needs,
                "expectations": expectations,
                "requirements": requirements,
                "risks": risks,
                "opportunities": opportunities,
                "actions": actions,
                "needs_expectations": legacy_needs_expectations,
                "applies": bool(row.applies),
                "observations": observations,
            }
        )

    if not normalized_rows:
        raise HTTPException(
            status_code=400,
            detail="Debe existir al menos una fila con stakeholder_name informado.",
        )

    return normalized_rows


def _format_interested_parties_revision_label(revision_number: int) -> str:
    normalized = max(int(revision_number or 0), 0)
    return f"Rev.{normalized:02d}"


def _compose_legacy_needs_expectations(
    *,
    needs: str | None,
    expectations: str | None,
    legacy: str | None,
) -> str | None:
    if legacy:
        return legacy
    if needs and expectations:
        return f"{needs} | {expectations}"
    if needs:
        return needs
    if expectations:
        return expectations
    return None


def _serialize_interested_parties_document(
    document: AuditInterestedPartiesDocument,
    rows: list[AuditInterestedPartiesDocumentRow],
) -> AuditInterestedPartiesDocumentRead:
    return AuditInterestedPartiesDocumentRead(
        id=document.id,
        audit_report_id=document.audit_report_id,
        code=document.code,
        revision_number=document.revision_number,
        revision_label=_format_interested_parties_revision_label(document.revision_number),
        document_date=document.document_date,
        status=document.status,
        rows=[
            AuditInterestedPartiesDocumentRowRead(
                id=row.id,
                document_id=row.document_id,
                stakeholder_name=row.stakeholder_name,
                needs=row.needs,
                expectations=row.expectations,
                requirements=row.requirements,
                risks=row.risks,
                opportunities=row.opportunities,
                actions=row.actions,
                needs_expectations=_compose_legacy_needs_expectations(
                    needs=row.needs,
                    expectations=row.expectations,
                    legacy=row.needs_expectations,
                ),
                applies=row.applies,
                observations=row.observations,
                sort_order=row.sort_order,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _normalize_context_document_status(value: str | None) -> str:
    normalized = _normalize_required_text(value, "status").lower()
    if normalized not in {"draft", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="status invalido. Valores permitidos: draft, completed.",
        )
    return normalized


def _normalize_context_group(value: str | None) -> str:
    normalized = _normalize_required_text(value, "context_group").lower()
    if normalized not in _CONTEXT_DOCUMENT_GROUP_VALUES:
        raise HTTPException(
            status_code=400,
            detail="context_group invalido. Valores permitidos: externo, interno.",
        )
    return normalized


def _normalize_context_document_rows(
    rows: list[AuditContextDocumentRowInput],
) -> list[dict[str, str | None]]:
    normalized_rows: list[dict[str, str | None]] = []
    for row in rows:
        context_group = _normalize_optional_text(row.context_group)
        environment = _normalize_optional_text(row.environment)
        risks = _normalize_optional_text(row.risks)
        opportunities = _normalize_optional_text(row.opportunities)
        actions = _normalize_optional_text(row.actions)
        observations = _normalize_optional_text(row.observations)

        if (
            context_group is None
            and environment is None
            and risks is None
            and opportunities is None
            and actions is None
            and observations is None
        ):
            continue

        if context_group is None:
            raise HTTPException(
                status_code=400,
                detail="context_group es requerido en filas no vacias.",
            )
        if environment is None:
            raise HTTPException(
                status_code=400,
                detail="environment es requerido en filas no vacias.",
            )

        normalized_rows.append(
            {
                "context_group": _normalize_context_group(context_group),
                "environment": environment,
                "risks": risks,
                "opportunities": opportunities,
                "actions": actions,
                "observations": observations,
            }
        )

    if not normalized_rows:
        raise HTTPException(
            status_code=400,
            detail="Debe existir al menos una fila con environment informado.",
        )

    return normalized_rows


def _format_context_revision_label(revision_number: int) -> str:
    normalized = max(int(revision_number or 0), 0)
    return f"Rev.{normalized:02d}"


def _serialize_context_document(
    document: AuditContextDocument,
    rows: list[AuditContextDocumentRow],
) -> AuditContextDocumentRead:
    return AuditContextDocumentRead(
        id=document.id,
        audit_report_id=document.audit_report_id,
        code=document.code,
        revision_number=document.revision_number,
        revision_label=_format_context_revision_label(document.revision_number),
        document_date=document.document_date,
        reviewed_by=document.reviewed_by,
        approved_by=document.approved_by,
        status=document.status,
        rows=[
            AuditContextDocumentRowRead(
                id=row.id,
                document_id=row.document_id,
                context_group=row.context_group,
                environment=row.environment,
                risks=row.risks,
                opportunities=row.opportunities,
                actions=row.actions,
                observations=row.observations,
                sort_order=row.sort_order,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _normalize_risk_opportunity_document_status(value: str | None) -> str:
    normalized = _normalize_required_text(value, "status").lower()
    if normalized not in {"draft", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="status invalido. Valores permitidos: draft, completed.",
        )
    return normalized


def _normalize_risk_opportunity_row_type(value: str | None) -> str:
    normalized = _normalize_required_text(value, "row_type").lower()
    if normalized not in _RISK_OPPORTUNITY_ROW_TYPES:
        raise HTTPException(
            status_code=400,
            detail="row_type invalido. Valores permitidos: swot, risk, opportunity, action.",
        )
    return normalized


def _normalize_risk_opportunity_swot_category(value: str | None) -> str:
    normalized = _normalize_required_text(value, "swot_category").lower()
    if normalized not in _RISK_OPPORTUNITY_SWOT_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=(
                "swot_category invalido. Valores permitidos: "
                "weakness, threat, strength, opportunity."
            ),
        )
    return normalized


def _normalize_risk_opportunity_impact(value: str | None) -> str | None:
    normalized = _normalize_optional_text(value)
    if normalized is None:
        return None
    lowered = normalized.lower()
    if lowered not in _RISK_OPPORTUNITY_IMPACT_VALUES:
        raise HTTPException(
            status_code=400,
            detail="impact invalido. Valores permitidos: low, medium, high.",
        )
    return lowered


def _normalize_risk_opportunity_probability(value: str | None) -> str | None:
    normalized = _normalize_optional_text(value)
    if normalized is None:
        return None
    lowered = normalized.lower()
    if lowered not in _RISK_OPPORTUNITY_PROBABILITY_VALUES:
        raise HTTPException(
            status_code=400,
            detail="probability invalido. Valores permitidos: low, medium, high.",
        )
    return lowered


def _normalize_risk_opportunity_severity(value: str | None) -> str | None:
    normalized = _normalize_optional_text(value)
    if normalized is None:
        return None
    lowered = normalized.lower()
    if lowered not in _RISK_OPPORTUNITY_SEVERITY_VALUES:
        raise HTTPException(
            status_code=400,
            detail="severity invalido. Valores permitidos: slight, harm, extreme.",
        )
    return lowered


def _normalize_risk_opportunity_viability(value: int | None, field_name: str) -> int | None:
    if value is None:
        return None
    normalized = int(value)
    if normalized not in _RISK_OPPORTUNITY_VIABILITY_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} invalido. Valores permitidos: 1, 3, 5.",
        )
    return normalized


def _normalize_risk_opportunity_reference_kind(value: str | None) -> str | None:
    normalized = _normalize_optional_text(value)
    if normalized is None:
        return None
    lowered = normalized.lower()
    if lowered not in _RISK_OPPORTUNITY_REFERENCE_KINDS:
        raise HTTPException(
            status_code=400,
            detail="reference_kind invalido. Valores permitidos: risk, opportunity.",
        )
    return lowered


def _normalize_risk_opportunity_document_rows(
    rows: list[AuditRiskOpportunityDocumentRowInput],
) -> list[
    dict[str, str | int | bool | UUID | date | None]
]:
    normalized_rows: list[dict[str, str | int | bool | UUID | date | None]] = []
    for row in rows:
        row_type = _normalize_optional_text(row.row_type)
        row_id = row.row_id
        swot_category = _normalize_optional_text(row.swot_category)
        description = _normalize_optional_text(row.description)
        process_name = _normalize_optional_text(row.process_name)
        impact = _normalize_risk_opportunity_impact(row.impact)
        probability = _normalize_risk_opportunity_probability(row.probability)
        severity = _normalize_risk_opportunity_severity(row.severity)
        viability = _normalize_risk_opportunity_viability(row.viability, "viability")
        attractiveness = _normalize_risk_opportunity_viability(row.attractiveness, "attractiveness")
        benefit = _normalize_optional_text(row.benefit)
        action = _normalize_optional_text(row.action)
        responsible = _normalize_optional_text(row.responsible)
        follow_up_status = _normalize_optional_text(row.follow_up_status)
        follow_up_date = row.follow_up_date
        source_key = _normalize_optional_text(row.source_key)
        reference_kind = _normalize_risk_opportunity_reference_kind(row.reference_kind)
        reference_row_id = row.reference_row_id
        action_type = _normalize_optional_text(row.action_type)
        indicator = _normalize_optional_text(row.indicator)
        due_date = row.due_date
        action_result = _normalize_optional_text(row.action_result)
        is_auto_generated = bool(row.is_auto_generated)

        if (
            row_type is None
            and row_id is None
            and swot_category is None
            and description is None
            and process_name is None
            and impact is None
            and probability is None
            and severity is None
            and viability is None
            and attractiveness is None
            and benefit is None
            and action is None
            and responsible is None
            and follow_up_status is None
            and follow_up_date is None
            and source_key is None
            and reference_kind is None
            and reference_row_id is None
            and action_type is None
            and indicator is None
            and due_date is None
            and action_result is None
        ):
            continue

        if row_type is None:
            raise HTTPException(
                status_code=400,
                detail="row_type es requerido en filas no vacias.",
            )

        normalized_row_type = _normalize_risk_opportunity_row_type(row_type)
        normalized_swot_category: str | None = None

        if normalized_row_type == "swot":
            normalized_swot_category = _normalize_risk_opportunity_swot_category(swot_category)
            if description is None:
                raise HTTPException(
                    status_code=400,
                    detail="description es requerido para filas swot.",
                )
            process_name = None
            probability = None
            severity = None
            viability = None
            attractiveness = None
            reference_kind = None
            reference_row_id = None
            action_type = None
            indicator = None
            due_date = None
            action_result = None

        if normalized_row_type == "risk":
            if description is None:
                raise HTTPException(
                    status_code=400,
                    detail="description es requerido para filas risk.",
                )
            probability = probability or "medium"
            severity = severity or "harm"
            viability = None
            attractiveness = None
            reference_kind = None
            reference_row_id = None
            action_type = None
            indicator = None
            due_date = None
            action_result = None
            impact = probability

        if normalized_row_type == "opportunity":
            if description is None:
                raise HTTPException(
                    status_code=400,
                    detail="description es requerido para filas opportunity.",
                )
            viability = viability or 3
            attractiveness = attractiveness or 3
            probability = "low" if viability == 1 else "medium" if viability == 3 else "high"
            impact = "low" if attractiveness == 1 else "medium" if attractiveness == 3 else "high"
            severity = None
            reference_kind = None
            reference_row_id = None
            action_type = None
            indicator = None
            due_date = None
            action_result = None

        if normalized_row_type in {"action", "follow_up"}:
            if action is None:
                raise HTTPException(
                    status_code=400,
                    detail="action es requerido para filas action.",
                )
            process_name = None
            swot_category = None
            probability = None
            severity = None
            viability = None
            attractiveness = None
            benefit = None
            responsible = None
            follow_up_date = due_date
            description = description or f"{reference_kind}:{reference_row_id}"

        normalized_rows.append(
            {
                "row_type": "action" if normalized_row_type == "follow_up" else normalized_row_type,
                "row_id": row_id,
                "swot_category": normalized_swot_category,
                "description": description,
                "process_name": process_name,
                "impact": impact,
                "probability": probability,
                "severity": severity,
                "viability": viability,
                "attractiveness": attractiveness,
                "benefit": benefit,
                "action": action,
                "responsible": responsible,
                "follow_up_status": follow_up_status,
                "follow_up_date": follow_up_date,
                "source_key": source_key,
                "reference_kind": reference_kind,
                "reference_row_id": reference_row_id,
                "action_type": action_type,
                "indicator": indicator,
                "due_date": due_date,
                "action_result": action_result,
                "is_auto_generated": is_auto_generated,
            }
        )

    if not normalized_rows:
        raise HTTPException(
            status_code=400,
            detail="Debe existir al menos una fila informada en el documento de riesgos y oportunidades.",
        )

    return normalized_rows


def _format_risk_opportunity_revision_label(revision_number: int) -> str:
    normalized = max(int(revision_number or 0), 0)
    return f"Rev.{normalized:02d}"


def _serialize_risk_opportunity_document(
    document: AuditRiskOpportunityDocument,
    rows: list[AuditRiskOpportunityDocumentRow],
) -> AuditRiskOpportunityDocumentRead:
    return AuditRiskOpportunityDocumentRead(
        id=document.id,
        audit_report_id=document.audit_report_id,
        code=document.code,
        revision_number=document.revision_number,
        revision_label=_format_risk_opportunity_revision_label(document.revision_number),
        document_date=document.document_date,
        status=document.status,
        rows=[
            AuditRiskOpportunityDocumentRowRead(
                id=row.id,
                document_id=row.document_id,
                row_type=row.row_type,
                swot_category=row.swot_category,
                description=row.description,
                process_name=row.process_name,
                impact=row.impact,
                probability=row.probability,
                severity=row.severity,
                viability=row.viability,
                attractiveness=row.attractiveness,
                benefit=row.benefit,
                action=row.action,
                responsible=row.responsible,
                follow_up_status=row.follow_up_status,
                follow_up_date=row.follow_up_date,
                source_key=row.source_key,
                reference_kind=row.reference_kind,
                reference_row_id=row.reference_row_id,
                action_type=row.action_type,
                indicator=row.indicator,
                due_date=row.due_date,
                action_result=row.action_result,
                is_auto_generated=row.is_auto_generated,
                sort_order=row.sort_order,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.put(
    "/audit-reports/{report_id}/sections/{section_code}/items",
    response_model=list[AuditReportItemRead],
)
def put_audit_report_section_items(
    report_id: UUID,
    section_code: str,
    payload: AuditReportSectionItemsUpsertRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportItem]:
    try:
        normalized_section_code = section_code.strip()
        if not normalized_section_code:
            raise HTTPException(status_code=400, detail="section_code es requerido")
        normalized_items = _filter_items_for_section(normalized_section_code, payload.items)
        _validate_items_payload(normalized_items)

        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            _ensure_section_exists(db, report_id, normalized_section_code)
            db.execute(
                delete(AuditReportItem).where(
                    AuditReportItem.audit_report_id == report_id,
                    func.lower(AuditReportItem.section_code) == normalized_section_code.lower(),
                )
            )
            for item in normalized_items:
                db.add(
                    AuditReportItem(
                        audit_report_id=report_id,
                        section_code=normalized_section_code,
                        item_code=item.item_code.strip(),
                        item_label=item.item_label.strip(),
                        value_text=_normalize_optional_text(item.value_text),
                        value_json=item.value_json,
                        sort_order=item.sort_order or 0,
                    )
                )
            db.flush()

        items = db.scalars(
            select(AuditReportItem)
            .where(
                AuditReportItem.audit_report_id == report_id,
                func.lower(AuditReportItem.section_code) == normalized_section_code.lower(),
            )
            .order_by(AuditReportItem.sort_order.asc(), AuditReportItem.item_code.asc())
        ).all()
        return list(items)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while putting section items")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para guardar items.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while putting section items")
        raise HTTPException(status_code=500, detail="No se pudieron guardar los items") from exc


@router.get(
    "/audit-reports/{report_id}/interested-parties-document",
    response_model=AuditInterestedPartiesDocumentRead | None,
)
def get_audit_report_interested_parties_document(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditInterestedPartiesDocumentRead | None:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        document = db.scalar(
            select(AuditInterestedPartiesDocument).where(
                AuditInterestedPartiesDocument.audit_report_id == report_id
            )
        )
        if document is None:
            return None

        rows = db.scalars(
            select(AuditInterestedPartiesDocumentRow)
            .where(AuditInterestedPartiesDocumentRow.document_id == document.id)
            .order_by(
                AuditInterestedPartiesDocumentRow.sort_order.asc(),
                AuditInterestedPartiesDocumentRow.created_at.asc(),
            )
        ).all()
        return _serialize_interested_parties_document(document, list(rows))
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading interested parties document")
        raise map_operational_error(
            exc,
            default_detail=(
                "No se pudo conectar a la base de datos para cargar documento de partes interesadas."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_interested_parties_document_tables_missing(exc)
        logger.exception("Database error while loading interested parties document")
        raise HTTPException(
            status_code=500,
            detail="No se pudo cargar documento de partes interesadas.",
        ) from exc


@router.put(
    "/audit-reports/{report_id}/interested-parties-document",
    response_model=AuditInterestedPartiesDocumentRead,
)
def put_audit_report_interested_parties_document(
    report_id: UUID,
    payload: AuditInterestedPartiesDocumentUpsertRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditInterestedPartiesDocumentRead:
    try:
        normalized_rows = _normalize_interested_parties_document_rows(payload.rows)
        normalized_status = _normalize_interested_parties_document_status(payload.status)
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            document = db.scalar(
                select(AuditInterestedPartiesDocument).where(
                    AuditInterestedPartiesDocument.audit_report_id == report_id
                )
            )
            next_date = date.today()
            if document is None:
                document = AuditInterestedPartiesDocument(
                    audit_report_id=report_id,
                    code="P09",
                    revision_number=0,
                    document_date=next_date,
                    status=normalized_status,
                )
                db.add(document)
                db.flush()
            else:
                document.code = "P09"
                document.revision_number = int(document.revision_number or 0) + 1
                document.document_date = next_date
                document.status = normalized_status
                db.flush()
                db.execute(
                    delete(AuditInterestedPartiesDocumentRow).where(
                        AuditInterestedPartiesDocumentRow.document_id == document.id
                    )
                )

            for sort_order, row in enumerate(normalized_rows):
                db.add(
                    AuditInterestedPartiesDocumentRow(
                        document_id=document.id,
                        stakeholder_name=str(row["stakeholder_name"]),
                        needs=row["needs"],
                        expectations=row["expectations"],
                        requirements=row["requirements"],
                        risks=row["risks"],
                        opportunities=row["opportunities"],
                        actions=row["actions"],
                        needs_expectations=row["needs_expectations"],
                        applies=bool(row["applies"]),
                        observations=row["observations"],
                        sort_order=sort_order,
                    )
                )
            db.flush()

        db.refresh(document)
        rows = db.scalars(
            select(AuditInterestedPartiesDocumentRow)
            .where(AuditInterestedPartiesDocumentRow.document_id == document.id)
            .order_by(
                AuditInterestedPartiesDocumentRow.sort_order.asc(),
                AuditInterestedPartiesDocumentRow.created_at.asc(),
            )
        ).all()
        return _serialize_interested_parties_document(document, list(rows))
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while saving interested parties document")
        raise map_operational_error(
            exc,
            default_detail=(
                "No se pudo conectar a la base de datos para guardar documento de partes interesadas."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_interested_parties_document_tables_missing(exc)
        logger.exception("Database error while saving interested parties document")
        raise HTTPException(
            status_code=500,
            detail="No se pudo guardar documento de partes interesadas.",
        ) from exc


@router.get(
    "/audit-reports/{report_id}/context-document",
    response_model=AuditContextDocumentRead | None,
)
def get_audit_report_context_document(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditContextDocumentRead | None:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        document = db.scalar(
            select(AuditContextDocument).where(AuditContextDocument.audit_report_id == report_id)
        )
        if document is None:
            return None

        rows = db.scalars(
            select(AuditContextDocumentRow)
            .where(AuditContextDocumentRow.document_id == document.id)
            .order_by(
                AuditContextDocumentRow.sort_order.asc(),
                AuditContextDocumentRow.created_at.asc(),
            )
        ).all()
        return _serialize_context_document(document, list(rows))
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading context document")
        raise map_operational_error(
            exc,
            default_detail=(
                "No se pudo conectar a la base de datos para cargar documento de contexto."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_context_document_tables_missing(exc)
        logger.exception("Database error while loading context document")
        raise HTTPException(
            status_code=500,
            detail="No se pudo cargar documento de contexto.",
        ) from exc


@router.put(
    "/audit-reports/{report_id}/context-document",
    response_model=AuditContextDocumentRead,
)
def put_audit_report_context_document(
    report_id: UUID,
    payload: AuditContextDocumentUpsertRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditContextDocumentRead:
    try:
        normalized_rows = _normalize_context_document_rows(payload.rows)
        normalized_status = _normalize_context_document_status(payload.status)
        normalized_code = _normalize_optional_text(payload.code) or "P09"
        normalized_reviewed_by = _normalize_optional_text(payload.reviewed_by)
        normalized_approved_by = _normalize_optional_text(payload.approved_by)

        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            document = db.scalar(
                select(AuditContextDocument).where(AuditContextDocument.audit_report_id == report_id)
            )
            next_date = date.today()
            if document is None:
                document = AuditContextDocument(
                    audit_report_id=report_id,
                    code=normalized_code,
                    revision_number=0,
                    document_date=next_date,
                    reviewed_by=normalized_reviewed_by,
                    approved_by=normalized_approved_by,
                    status=normalized_status,
                )
                db.add(document)
                db.flush()
            else:
                document.code = normalized_code
                document.revision_number = int(document.revision_number or 0) + 1
                document.document_date = next_date
                document.reviewed_by = normalized_reviewed_by
                document.approved_by = normalized_approved_by
                document.status = normalized_status
                db.flush()
                db.execute(
                    delete(AuditContextDocumentRow).where(
                        AuditContextDocumentRow.document_id == document.id
                    )
                )

            for sort_order, row in enumerate(normalized_rows):
                db.add(
                    AuditContextDocumentRow(
                        document_id=document.id,
                        context_group=str(row["context_group"]),
                        environment=str(row["environment"]),
                        risks=row["risks"],
                        opportunities=row["opportunities"],
                        actions=row["actions"],
                        observations=row["observations"],
                        sort_order=sort_order,
                    )
                )
            db.flush()

        db.refresh(document)
        rows = db.scalars(
            select(AuditContextDocumentRow)
            .where(AuditContextDocumentRow.document_id == document.id)
            .order_by(
                AuditContextDocumentRow.sort_order.asc(),
                AuditContextDocumentRow.created_at.asc(),
            )
        ).all()
        return _serialize_context_document(document, list(rows))
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while saving context document")
        raise map_operational_error(
            exc,
            default_detail=(
                "No se pudo conectar a la base de datos para guardar documento de contexto."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_context_document_tables_missing(exc)
        logger.exception("Database error while saving context document")
        raise HTTPException(
            status_code=500,
            detail="No se pudo guardar documento de contexto.",
        ) from exc


@router.get(
    "/audit-reports/{report_id}/risk-opportunity-document",
    response_model=AuditRiskOpportunityDocumentRead | None,
)
def get_audit_report_risk_opportunity_document(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditRiskOpportunityDocumentRead | None:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        document = db.scalar(
            select(AuditRiskOpportunityDocument).where(
                AuditRiskOpportunityDocument.audit_report_id == report_id
            )
        )
        if document is None:
            return None

        rows = db.scalars(
            select(AuditRiskOpportunityDocumentRow)
            .where(AuditRiskOpportunityDocumentRow.document_id == document.id)
            .order_by(
                AuditRiskOpportunityDocumentRow.sort_order.asc(),
                AuditRiskOpportunityDocumentRow.created_at.asc(),
            )
        ).all()
        return _serialize_risk_opportunity_document(document, list(rows))
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading risk/opportunity document")
        raise map_operational_error(
            exc,
            default_detail=(
                "No se pudo conectar a la base de datos para cargar documento de riesgos y oportunidades."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_opportunity_document_tables_missing(exc)
        logger.exception("Database error while loading risk/opportunity document")
        raise HTTPException(
            status_code=500,
            detail="No se pudo cargar documento de riesgos y oportunidades.",
        ) from exc


@router.put(
    "/audit-reports/{report_id}/risk-opportunity-document",
    response_model=AuditRiskOpportunityDocumentRead,
)
def put_audit_report_risk_opportunity_document(
    report_id: UUID,
    payload: AuditRiskOpportunityDocumentUpsertRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditRiskOpportunityDocumentRead:
    try:
        normalized_rows = _normalize_risk_opportunity_document_rows(payload.rows)
        normalized_status = _normalize_risk_opportunity_document_status(payload.status)
        normalized_code = _normalize_optional_text(payload.code) or "P09"

        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            document = db.scalar(
                select(AuditRiskOpportunityDocument).where(
                    AuditRiskOpportunityDocument.audit_report_id == report_id
                )
            )
            next_date = date.today()
            if document is None:
                document = AuditRiskOpportunityDocument(
                    audit_report_id=report_id,
                    code=normalized_code,
                    revision_number=0,
                    document_date=next_date,
                    status=normalized_status,
                )
                db.add(document)
                db.flush()
            else:
                document.code = normalized_code
                document.revision_number = int(document.revision_number or 0) + 1
                document.document_date = next_date
                document.status = normalized_status
                db.flush()
                db.execute(
                    delete(AuditRiskOpportunityDocumentRow).where(
                        AuditRiskOpportunityDocumentRow.document_id == document.id
                    )
                )

            for sort_order, row in enumerate(normalized_rows):
                row_kwargs = {
                    "document_id": document.id,
                    "row_type": str(row["row_type"]),
                    "swot_category": row["swot_category"],
                    "description": row["description"],
                    "process_name": row["process_name"],
                    "impact": row["impact"],
                    "probability": row["probability"],
                    "severity": row["severity"],
                    "viability": row["viability"],
                    "attractiveness": row["attractiveness"],
                    "benefit": row["benefit"],
                    "action": row["action"],
                    "responsible": row["responsible"],
                    "follow_up_status": row["follow_up_status"],
                    "follow_up_date": row["follow_up_date"],
                    "source_key": row["source_key"],
                    "reference_kind": row["reference_kind"],
                    "reference_row_id": row["reference_row_id"],
                    "action_type": row["action_type"],
                    "indicator": row["indicator"],
                    "due_date": row["due_date"],
                    "action_result": row["action_result"],
                    "is_auto_generated": bool(row["is_auto_generated"]),
                    "sort_order": sort_order,
                }
                if row["row_id"] is not None:
                    row_kwargs["id"] = row["row_id"]
                db.add(AuditRiskOpportunityDocumentRow(**row_kwargs))
            db.flush()

        db.refresh(document)
        rows = db.scalars(
            select(AuditRiskOpportunityDocumentRow)
            .where(AuditRiskOpportunityDocumentRow.document_id == document.id)
            .order_by(
                AuditRiskOpportunityDocumentRow.sort_order.asc(),
                AuditRiskOpportunityDocumentRow.created_at.asc(),
            )
        ).all()
        return _serialize_risk_opportunity_document(document, list(rows))
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while saving risk/opportunity document")
        raise map_operational_error(
            exc,
            default_detail=(
                "No se pudo conectar a la base de datos para guardar documento de riesgos y oportunidades."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        _raise_if_risk_opportunity_document_tables_missing(exc)
        logger.exception("Database error while saving risk/opportunity document")
        raise HTTPException(
            status_code=500,
            detail="No se pudo guardar documento de riesgos y oportunidades.",
        ) from exc


@router.get(
    "/audit-reports/{report_id}/clause-checks",
    response_model=list[AuditReportClauseCheckRead],
)
def list_audit_report_clause_checks(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportClauseCheck]:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        checks = db.scalars(
            select(AuditReportClauseCheck)
            .where(AuditReportClauseCheck.audit_report_id == report_id)
            .order_by(
                AuditReportClauseCheck.section_code.asc(),
                AuditReportClauseCheck.sort_order.asc(),
                AuditReportClauseCheck.clause_code.asc(),
            )
        ).all()
        return list(checks)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing clause checks")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar cláusulas.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing clause checks")
        raise HTTPException(status_code=500, detail="No se pudieron listar las cláusulas") from exc


def _resolve_clause_base_data(
    clause_payload: AuditReportClauseCheckInput,
    existing_map: dict[str, AuditReportClauseCheck],
    template_map: dict[str, AuditTemplateClause],
) -> tuple[str, str]:
    key = clause_payload.clause_code.strip().lower()
    existing = existing_map.get(key)
    if existing:
        return existing.section_code, existing.clause_title

    template_clause = template_map.get(key)
    if template_clause:
        return template_clause.section_code, template_clause.clause_title

    raise HTTPException(
        status_code=400,
        detail=f"clause_code no existe en template de auditoría: {clause_payload.clause_code}",
    )


@router.put(
    "/audit-reports/{report_id}/clause-checks",
    response_model=list[AuditReportClauseCheckRead],
)
def put_audit_report_clause_checks(
    report_id: UUID,
    payload: AuditReportClauseChecksUpsertRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportClauseCheck]:
    try:
        with _transaction_scope(db):
            report = _get_report_or_404(db, report_id, auth.consultancy.id)
            existing_checks = db.scalars(
                select(AuditReportClauseCheck).where(AuditReportClauseCheck.audit_report_id == report_id)
            ).all()
            template_clauses = db.scalars(
                select(AuditTemplateClause).where(AuditTemplateClause.template_id == report.template_id)
            ).all()

            existing_map = {item.clause_code.strip().lower(): item for item in existing_checks}
            template_map = {item.clause_code.strip().lower(): item for item in template_clauses}
            seen_codes: set[str] = set()

            for clause in payload.clause_checks:
                normalized_clause_code = clause.clause_code.strip()
                if not normalized_clause_code:
                    raise HTTPException(status_code=400, detail="clause_code es requerido")
                lower_code = normalized_clause_code.lower()
                if lower_code in seen_codes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"clause_code duplicado en payload: {normalized_clause_code}",
                    )
                seen_codes.add(lower_code)

                section_code, clause_title = _resolve_clause_base_data(
                    clause,
                    existing_map,
                    template_map,
                )

                statement = (
                    pg_insert(AuditReportClauseCheck)
                    .values(
                        audit_report_id=report_id,
                        section_code=section_code,
                        clause_code=normalized_clause_code,
                        clause_title=clause_title,
                        applicable=clause.applicable,
                        clause_status=clause.clause_status.strip(),
                        evidence_summary=_normalize_optional_text(clause.evidence_summary),
                        observation_text=_normalize_optional_text(clause.observation_text),
                        sort_order=clause.sort_order or 0,
                    )
                    .on_conflict_do_update(
                        index_elements=[
                            AuditReportClauseCheck.audit_report_id,
                            AuditReportClauseCheck.clause_code,
                        ],
                        set_={
                            "applicable": clause.applicable,
                            "clause_status": clause.clause_status.strip(),
                            "evidence_summary": _normalize_optional_text(clause.evidence_summary),
                            "observation_text": _normalize_optional_text(clause.observation_text),
                            "sort_order": clause.sort_order or 0,
                            "updated_at": func.now(),
                        },
                    )
                )
                db.execute(statement)

            db.flush()

        checks = db.scalars(
            select(AuditReportClauseCheck)
            .where(AuditReportClauseCheck.audit_report_id == report_id)
            .order_by(
                AuditReportClauseCheck.section_code.asc(),
                AuditReportClauseCheck.sort_order.asc(),
                AuditReportClauseCheck.clause_code.asc(),
            )
        ).all()
        return list(checks)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while upserting clause checks")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para guardar cláusulas.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while upserting clause checks")
        raise HTTPException(status_code=500, detail="No se pudieron guardar las cláusulas") from exc


@router.get(
    "/audit-reports/{report_id}/interviewees",
    response_model=list[AuditReportIntervieweeRead],
)
def list_audit_report_interviewees(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportInterviewee]:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        interviewees = db.scalars(
            select(AuditReportInterviewee)
            .where(AuditReportInterviewee.audit_report_id == report_id)
            .order_by(AuditReportInterviewee.sort_order.asc(), AuditReportInterviewee.created_at.asc())
        ).all()
        return list(interviewees)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing interviewees")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar entrevistados.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing interviewees")
        raise HTTPException(status_code=500, detail="No se pudieron listar los entrevistados") from exc


@router.post(
    "/audit-reports/{report_id}/interviewees",
    response_model=AuditReportIntervieweeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_audit_report_interviewee(
    report_id: UUID,
    payload: AuditReportIntervieweeCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportInterviewee:
    try:
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            interviewee = AuditReportInterviewee(
                audit_report_id=report_id,
                full_name=_normalize_required_text(payload.full_name, "full_name"),
                role_name=_normalize_optional_text(payload.role_name),
                sort_order=payload.sort_order or 0,
            )
            db.add(interviewee)
            db.flush()
        db.refresh(interviewee)
        return interviewee
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating interviewee")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear entrevistado.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while creating interviewee")
        raise HTTPException(status_code=500, detail="No se pudo crear el entrevistado") from exc


@router.delete(
    "/audit-reports/{report_id}/interviewees/{interviewee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_audit_report_interviewee(
    report_id: UUID,
    interviewee_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            interviewee = db.scalar(
                select(AuditReportInterviewee).where(
                    AuditReportInterviewee.id == interviewee_id,
                    AuditReportInterviewee.audit_report_id == report_id,
                )
            )
            if interviewee is None:
                raise HTTPException(status_code=404, detail="Entrevistado no encontrado")
            db.delete(interviewee)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting interviewee")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar entrevistado.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while deleting interviewee")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el entrevistado") from exc


@router.get(
    "/audit-reports/{report_id}/recommendations",
    response_model=list[AuditReportRecommendationRead],
)
def list_audit_report_recommendations(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportRecommendation]:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        recommendations = db.scalars(
            select(AuditReportRecommendation)
            .where(AuditReportRecommendation.audit_report_id == report_id)
            .order_by(AuditReportRecommendation.created_at.desc(), AuditReportRecommendation.id.desc())
        ).all()
        return list(recommendations)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing recommendations")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar recomendaciones.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing recommendations")
        raise HTTPException(status_code=500, detail="No se pudieron listar las recomendaciones") from exc


@router.post(
    "/audit-reports/{report_id}/recommendations",
    response_model=AuditReportRecommendationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_audit_report_recommendation(
    report_id: UUID,
    payload: AuditReportRecommendationCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportRecommendation:
    try:
        with _transaction_scope(db):
            report = _get_report_or_404(db, report_id, auth.consultancy.id)
            recommendation = AuditReportRecommendation(
                audit_report_id=report_id,
                client_id=report.client_id,
                consultancy_id=report.consultancy_id,
                section_code=_normalize_optional_text(payload.section_code),
                recommendation_year=report.report_year,
                recommendation_type=_normalize_required_text(
                    payload.recommendation_type, "recommendation_type"
                ),
                priority=_normalize_required_text(payload.priority, "priority"),
                body_text=_normalize_required_text(payload.body_text, "body_text"),
                followup_comment=_normalize_optional_text(payload.followup_comment),
                recommendation_status=_normalize_required_text(
                    payload.recommendation_status, "recommendation_status"
                ),
                carried_from_previous=payload.carried_from_previous,
                generated_by_ai=False,
            )
            db.add(recommendation)
            db.flush()
        db.refresh(recommendation)
        return recommendation
    except HTTPException:
        raise
    except IntegrityError as exc:
        logger.exception("Integrity error while creating recommendation")
        raise _map_integrity_error(exc) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating recommendation")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear recomendación.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while creating recommendation")
        raise HTTPException(status_code=500, detail="No se pudo crear la recomendación") from exc


@router.patch(
    "/audit-reports/{report_id}/recommendations/{recommendation_id}",
    response_model=AuditReportRecommendationRead,
)
def patch_audit_report_recommendation(
    report_id: UUID,
    recommendation_id: UUID,
    payload: AuditReportRecommendationUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportRecommendation:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            recommendation = db.scalar(
                select(AuditReportRecommendation).where(
                    AuditReportRecommendation.id == recommendation_id,
                    AuditReportRecommendation.audit_report_id == report_id,
                )
            )
            if recommendation is None:
                raise HTTPException(status_code=404, detail="Recomendación no encontrada")

            for field, value in data.items():
                if field == "body_text":
                    setattr(recommendation, field, _normalize_required_text(value, "body_text"))
                elif field in {"section_code", "followup_comment"}:
                    setattr(recommendation, field, _normalize_optional_text(value))
                elif field in {"recommendation_type", "priority", "recommendation_status"}:
                    setattr(recommendation, field, _normalize_required_text(value, field))
                else:
                    setattr(recommendation, field, value)
            db.flush()

        db.refresh(recommendation)
        return recommendation
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating recommendation")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar recomendación.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while updating recommendation")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la recomendación") from exc


@router.delete(
    "/audit-reports/{report_id}/recommendations/{recommendation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_audit_report_recommendation(
    report_id: UUID,
    recommendation_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            recommendation = db.scalar(
                select(AuditReportRecommendation).where(
                    AuditReportRecommendation.id == recommendation_id,
                    AuditReportRecommendation.audit_report_id == report_id,
                )
            )
            if recommendation is None:
                raise HTTPException(status_code=404, detail="Recomendación no encontrada")
            db.delete(recommendation)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting recommendation")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar recomendación.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while deleting recommendation")
        raise HTTPException(status_code=500, detail="No se pudo eliminar la recomendación") from exc


@router.get("/audit-reports/{report_id}/annexes", response_model=list[AuditReportAnnexRead])
def list_audit_report_annexes(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditReportAnnex]:
    try:
        _get_report_or_404(db, report_id, auth.consultancy.id)
        annexes = db.scalars(
            select(AuditReportAnnex)
            .where(AuditReportAnnex.audit_report_id == report_id)
            .order_by(AuditReportAnnex.sort_order.asc(), AuditReportAnnex.created_at.asc())
        ).all()
        return list(annexes)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing annexes")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar anexos.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing annexes")
        raise HTTPException(status_code=500, detail="No se pudieron listar los anexos") from exc


@router.post(
    "/audit-reports/{report_id}/annexes",
    response_model=AuditReportAnnexRead,
    status_code=status.HTTP_201_CREATED,
)
def create_audit_report_annex(
    report_id: UUID,
    payload: AuditReportAnnexCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportAnnex:
    try:
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            annex = AuditReportAnnex(
                audit_report_id=report_id,
                annex_code=_normalize_optional_text(payload.annex_code),
                title=_normalize_required_text(payload.title, "title"),
                file_url=_normalize_optional_text(payload.file_url),
                notes=_normalize_optional_text(payload.notes),
                sort_order=payload.sort_order or 0,
            )
            db.add(annex)
            db.flush()
        db.refresh(annex)
        return annex
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating annex")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear anexo.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while creating annex")
        raise HTTPException(status_code=500, detail="No se pudo crear el anexo") from exc


@router.patch(
    "/audit-reports/{report_id}/annexes/{annex_id}",
    response_model=AuditReportAnnexRead,
)
def patch_audit_report_annex(
    report_id: UUID,
    annex_id: UUID,
    payload: AuditReportAnnexUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuditReportAnnex:
    try:
        data = payload.model_dump(exclude_unset=True)
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            annex = _get_annex_or_404(db, report_id, annex_id)
            for field, value in data.items():
                if field == "title":
                    setattr(annex, field, _normalize_required_text(value, "title"))
                elif field in {"annex_code", "file_url", "notes"}:
                    setattr(annex, field, _normalize_optional_text(value))
                else:
                    setattr(annex, field, value)
            db.flush()
        db.refresh(annex)
        return annex
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while updating annex")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para actualizar anexo.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while updating annex")
        raise HTTPException(status_code=500, detail="No se pudo actualizar el anexo") from exc


@router.delete(
    "/audit-reports/{report_id}/annexes/{annex_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_audit_report_annex(
    report_id: UUID,
    annex_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Response:
    try:
        with _transaction_scope(db):
            _get_report_or_404(db, report_id, auth.consultancy.id)
            annex = _get_annex_or_404(db, report_id, annex_id)
            db.delete(annex)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while deleting annex")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para eliminar anexo.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while deleting annex")
        raise HTTPException(status_code=500, detail="No se pudo eliminar el anexo") from exc


@router.post("/audit-reports/{report_id}/exportar")
def export_audit_report_docx(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if not settings.openai_api_key and settings.app_env != "production":
        # In development, .env may change while process is alive; refresh once.
        clear_settings_cache()
        settings = get_settings()

    try:
        report = _get_report_or_404(db, report_id, auth.consultancy.id)
        client = _get_scoped_client_or_404(db, report.client_id, auth.consultancy.id)
        ai_generation_enabled = bool((settings.openai_api_key or "").strip())
        logger.info(
            "Starting DOCX export report_id=%s consultancy_id=%s user_id=%s ai_enabled=%s",
            report.id,
            auth.consultancy.id,
            auth.user.id,
            ai_generation_enabled,
        )
        children = _load_report_children(db, report.id)
        try:
            context_by_section = _build_export_context_by_section(
                db=db,
                report=report,
                consultancy_id=auth.consultancy.id,
            )
        except SQLAlchemyError:
            logger.exception(
                "No se pudo cargar el contexto ISO complementario para exportacion report_id=%s",
                report.id,
            )
            context_by_section = {}
        history_rows = _query_recommendation_history_rows(
            db,
            report=report,
            consultancy_id=auth.consultancy.id,
        )

        section_narratives = generate_section_narratives(
            openai_api_key=settings.openai_api_key,
            model=settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
            company_name=client.name,
            sections=children["sections"],
            items=children["items"],
            clause_checks=children["clause_checks"],
            context_by_section=context_by_section,
        )
        integrity_notes = build_document_integrity_notes(
            report=report,
            interviewees=children["interviewees"],
            sections=children["sections"],
            items=children["items"],
            clause_checks=children["clause_checks"],
            annexes=children["annexes"],
            recommendations=children["recommendations"],
            section_narratives=section_narratives,
        )
        critical_integrity_notes = extract_critical_integrity_notes(integrity_notes)
        if _is_final_report_status(report.status) and critical_integrity_notes:
            pending_notes = " | ".join(critical_integrity_notes[:8])
            logger.warning(
                "Bloqueo de export final por integridad report_id=%s pending=%s",
                report.id,
                pending_notes,
            )
            raise HTTPException(
                status_code=409,
                detail=(
                    "No se puede exportar la auditoria en estado final porque faltan "
                    "elementos criticos de integridad documental. "
                    f"Pendientes: {pending_notes}"
                ),
            )

        history_payload = [
            {
                "report_code": history_report_code,
                "report_year": history_report_year,
                "section_code": recommendation.section_code,
                "recommendation_status": recommendation.recommendation_status,
                "body_text": recommendation.body_text,
                "followup_comment": recommendation.followup_comment,
            }
            for recommendation, history_report_year, history_report_code in history_rows
        ]
        issued_by_name: str | None = None
        issued_by_email: str | None = None
        if isinstance(auth.user, User):
            issued_by_name = auth.user.full_name
            issued_by_email = auth.user.email
        else:
            exporting_user = db.scalar(select(User).where(User.id == auth.user.id))
            if exporting_user is not None:
                issued_by_name = exporting_user.full_name
                issued_by_email = exporting_user.email

        output_stream = build_audit_report_docx(
            report=report,
            client=client,
            interviewees=children["interviewees"],
            sections=children["sections"],
            items=children["items"],
            clause_checks=children["clause_checks"],
            annexes=children["annexes"],
            recommendations=children["recommendations"],
            recommendation_history=history_payload,
            section_narratives=section_narratives,
            context_by_section=context_by_section,
            ai_generation_used=ai_generation_enabled,
            issued_by_name=issued_by_name,
            issued_by_email=issued_by_email,
            issued_at=datetime.now(timezone.utc),
        )

        base_code = report.report_code or f"P03-{report.report_year}-{report.id}"
        filename = _sanitize_docx_filename(base_code)
        if not filename.lower().endswith(".docx"):
            filename = f"{filename}.docx"
        logger.info(
            "DOCX export ready report_id=%s filename=%s sections=%s recommendations=%s history=%s",
            report.id,
            filename,
            len(children["sections"]),
            len(children["recommendations"]),
            len(history_payload),
        )

        return StreamingResponse(
            output_stream,
            media_type=(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except AuditDocxGenerationError as exc:
        logger.exception("DOCX export generation error for report_id=%s", report_id)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while exporting DOCX")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para exportar auditoría.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while exporting DOCX")
        raise HTTPException(status_code=500, detail="No se pudo exportar la auditoría") from exc


@router.get(
    "/audit-reports/{report_id}/history/recommendations",
    response_model=list[AuditRecommendationHistoryItem],
)
def list_audit_report_recommendation_history(
    report_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[AuditRecommendationHistoryItem]:
    try:
        report = _get_report_or_404(db, report_id, auth.consultancy.id)
        rows = _query_recommendation_history_rows(
            db,
            report=report,
            consultancy_id=auth.consultancy.id,
        )
        return _serialize_recommendation_history_rows(rows)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing recommendation history")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar histórico.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing recommendation history")
        raise HTTPException(status_code=500, detail="No se pudo cargar el histórico") from exc
