from __future__ import annotations

import json
import logging
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime
from importlib import import_module
from io import BytesIO
from typing import Any, Mapping, Sequence

from app.models.audit_report import AuditReport
from app.models.audit_report_annex import AuditReportAnnex
from app.models.audit_report_clause_check import AuditReportClauseCheck
from app.models.audit_report_interviewee import AuditReportInterviewee
from app.models.audit_report_item import AuditReportItem
from app.models.audit_report_recommendation import AuditReportRecommendation
from app.models.audit_report_section import AuditReportSection
from app.models.client import Client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Actua como auditor interno ISO 9001 redactando un informe en espanol tecnico y profesional. "
    "Reglas obligatorias: no inventar hechos, no inventar codigos/documentos/fechas/personas, "
    "no emitir asesoramiento legal ni afirmar certificacion de cumplimiento automatico. "
    "Usa solo la evidencia recibida. Si la evidencia es insuficiente, indicalo explicitamente "
    "con lenguaje de auditoria (por ejemplo: 'No se evidencia ...'). "
    "Redacta en tercera persona, sin saludos, y respetando el formato estructurado solicitado."
)

AI_ASSISTED_NOTICE = (
    "Nota metodológica: el texto narrativo puede estar asistido por IA y requiere validación "
    "final del auditor responsable antes de su uso formal."
)

FIXED_FINAL_DISPOSITIONS_LINES = [
    "1.- La Gerencia de la empresa se quedará copia de este informe.",
    "2.- Las no conformidades, en caso de haberlas, se comunican a los afectados, son aclaradas y entendidas.",
    (
        "3.- Los responsables afectados, junto con el responsable de Calidad se comprometen al estudio de las "
        "causas de las recomendaciones / no-conformidades detectadas, a la propuesta de la acción para "
        "eliminarlas, designar un responsable de su implantación y plazo, y realizar un seguimiento hasta su "
        "resolución y cierre."
    ),
    (
        "4.- El auditor comunica que esta auditoría se ha realizado a través de un muestreo por lo que pueden "
        "existir otras No Conformidades no identificadas en este informe."
    ),
    (
        "5.- Las No Conformidades se refieren a incumplimientos de los requisitos de la norma de referencia "
        "aplicables, de los documentos del Sistema de Gestión, o incumplimientos en los procesos auditados."
    ),
]

DEFAULT_SECTION_POINTS: dict[str, list[tuple[str, str]]] = {
    "4": [
        ("4.1", "Comprensión de la organización y su contexto"),
        ("4.2", "Partes interesadas"),
        ("4.3", "Alcance"),
        ("4.4", "SGC y procesos"),
    ],
    "5": [
        ("5.1", "Liderazgo y Compromiso"),
        ("5.2", "Política de Calidad"),
        ("5.3", "Roles y Responsabilidades"),
    ],
    "6": [
        ("6.1", "Riesgos y oportunidades"),
        ("6.2", "Objetivos"),
        ("6.3", "Planificación cambios"),
    ],
    "7": [
        ("7.1", "Recursos"),
        ("7.1.2", "Personas"),
        ("7.1.3", "Infraestructura"),
        ("7.1.4", "Ambiente"),
        ("7.1.5", "Seguimiento y Medición"),
        ("7.1.6", "Conocimiento"),
        ("7.2", "Competencia"),
        ("7.3", "Conciencia"),
        ("7.4", "Comunicación"),
        ("7.5", "Información documentada"),
    ],
    "8": [
        ("8.1", "Planificación operacional"),
        ("8.2", "Requisitos servicio"),
        ("8.4", "Control proveedores"),
        ("8.5", "Producción/provisión"),
        ("8.6", "Liberación"),
        ("8.7", "No conformes"),
    ],
    "9": [
        ("9.1.1", "Seguimiento y medición"),
        ("9.1.2", "Satisfacción cliente"),
        ("9.2", "Auditoría interna"),
        ("9.3", "Revisión dirección"),
    ],
    "10": [
        ("10.1", "Generalidades"),
        ("10.2", "No Conformidades y AC"),
        ("10.3", "Mejora Continua"),
    ],
}

SECTION_HEADING_MAP = {
    "4": "4.- CONTEXTO DE LA ORGANIZACIÓN",
    "5": "5.- LIDERAZGO",
    "6": "6.- PLANIFICACIÓN",
    "7": "7.- APOYO",
    "8": "8.- OPERACIÓN",
    "9": "9.- EVALUACIÓN DEL DESEMPEÑO",
    "10": "10.- MEJORA",
}

AUDIT_TYPE_TEXT_MAP = {
    "inicial": "inicial",
    "revision_1": "revisión I",
    "revision_2": "revisión II",
    "recertificacion": "recertificación",
}

ALLOWED_AUDIT_MODALITIES = {"presencialmente", "de forma remota", "de forma mixta"}

_NARRATIVE_SECTION_KEYS = ("evidence", "gaps", "conclusion", "risk", "action")
_NARRATIVE_SECTION_HEADINGS = {
    "evidence": "Evidencias observadas",
    "gaps": "Desviaciones o carencias",
    "conclusion": "Conclusion de cumplimiento",
    "risk": "Riesgo para el sistema",
    "action": "Accion recomendada",
}
_NARRATIVE_HEADING_ALIASES = {
    "evidence": ("evidencias observadas",),
    "gaps": (
        "desviaciones o carencias",
        "desviaciones/carencias",
        "desviaciones y carencias",
    ),
    "conclusion": (
        "conclusion de cumplimiento",
        "conclusion",
    ),
    "risk": ("riesgo para el sistema", "riesgo"),
    "action": ("accion recomendada", "accion"),
}
_GENERIC_NARRATIVE_MARKERS = (
    "en lineas generales",
    "de manera general",
    "como modelo de lenguaje",
    "no dispongo de",
    "no puedo verificar",
    "sin informacion adicional",
    "se recomienda seguir mejorando",
    "cumple en terminos generales",
)


class AuditDocxGenerationError(RuntimeError):
    pass


def _to_display(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, (date, datetime)):
        return value.strftime("%d/%m/%Y")
    normalized = str(value).strip()
    return normalized or "-"


def _short_text(value: Any, *, max_len: int = 140) -> str:
    normalized = re.sub(r"\s+", " ", str(value or "").strip())
    if not normalized:
        return "-"
    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[: max_len - 3].rstrip()}..."


def _normalize_text_for_match(value: str | None) -> str:
    collapsed = re.sub(r"\s+", " ", str(value or "").strip().lower())
    if not collapsed:
        return ""
    decomposed = unicodedata.normalize("NFD", collapsed)
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn")


def _match_narrative_heading(line: str) -> str | None:
    normalized_line = _normalize_text_for_match(line)
    if not normalized_line:
        return None
    for key, aliases in _NARRATIVE_HEADING_ALIASES.items():
        for alias in aliases:
            if normalized_line.startswith(alias):
                return key
    return None


def _extract_narrative_blocks(narrative: str | None) -> dict[str, str]:
    raw_text = str(narrative or "").replace("\r\n", "\n")
    buffers: dict[str, list[str]] = {key: [] for key in _NARRATIVE_SECTION_KEYS}
    current_key: str | None = None

    for raw_line in raw_text.split("\n"):
        stripped = raw_line.strip()
        if not stripped:
            continue
        heading_key = _match_narrative_heading(stripped)
        if heading_key is not None:
            current_key = heading_key
            if ":" in stripped:
                inline_text = stripped.split(":", 1)[1].strip()
                if inline_text:
                    buffers[heading_key].append(inline_text)
            continue
        if current_key is not None:
            buffers[current_key].append(stripped)

    blocks: dict[str, str] = {}
    for key, lines in buffers.items():
        normalized = re.sub(r"\s+", " ", " ".join(lines).strip())
        if normalized:
            blocks[key] = normalized
    return blocks


def _looks_generic_narrative(narrative: str | None) -> bool:
    normalized = _normalize_text_for_match(narrative)
    if not normalized:
        return True
    return any(marker in normalized for marker in _GENERIC_NARRATIVE_MARKERS)


def _is_valid_section_narrative(narrative: str | None) -> bool:
    text = str(narrative or "").strip()
    if len(text) < 180:
        return False
    if _looks_generic_narrative(text):
        return False
    blocks = _extract_narrative_blocks(text)
    for key in _NARRATIVE_SECTION_KEYS:
        block = blocks.get(key, "")
        if len(block) < 20:
            return False
    return True


def _normalize_audit_type(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in AUDIT_TYPE_TEXT_MAP:
        return normalized
    return "inicial"


def _normalize_audit_modality(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in ALLOWED_AUDIT_MODALITIES:
        return normalized
    return "presencialmente"


def _audit_type_to_text(value: str | None) -> str:
    return AUDIT_TYPE_TEXT_MAP.get(_normalize_audit_type(value), "inicial")


def _normalize_section_root(section_code: str) -> str:
    match = re.match(r"^\s*(\d+)", section_code or "")
    return match.group(1) if match else ""


def _is_iso_section(section_code: str) -> bool:
    root = _normalize_section_root(section_code)
    if not root.isdigit():
        return False
    return 4 <= int(root) <= 10


def _section_sort_key(section: AuditReportSection) -> tuple[int, int, str]:
    root = _normalize_section_root(section.section_code)
    numeric = int(root) if root.isdigit() else 99
    return (numeric, section.sort_order or 0, section.section_code)


def _sort_section_code_for_display(section_code: str) -> tuple[int, str]:
    root = _normalize_section_root(section_code)
    numeric = int(root) if root.isdigit() else 99
    return (numeric, section_code)


def _serialize_item_for_prompt(item: AuditReportItem) -> str:
    payload: dict[str, Any] = {
        "item_code": item.item_code,
        "item_label": item.item_label,
        "value_text": item.value_text,
        "value_json": item.value_json,
    }
    return json.dumps(payload, ensure_ascii=False)


def _serialize_clause_for_prompt(clause: AuditReportClauseCheck) -> str:
    payload: dict[str, Any] = {
        "clause_code": clause.clause_code,
        "clause_title": clause.clause_title,
        "applicable": clause.applicable,
        "status": clause.clause_status,
        "evidence_summary": clause.evidence_summary,
        "observation_text": clause.observation_text,
    }
    return json.dumps(payload, ensure_ascii=False)


def _extract_response_text(completion: Any) -> str:
    choices = getattr(completion, "choices", None)
    if not choices:
        raise AuditDocxGenerationError("OpenAI devolvió una respuesta vacía.")
    first_choice = choices[0]
    message = getattr(first_choice, "message", None)
    if message is None:
        raise AuditDocxGenerationError("OpenAI no devolvió mensaje de contenido.")

    content = getattr(message, "content", None)
    if isinstance(content, str):
        normalized = content.strip()
        if normalized:
            return normalized

    if isinstance(content, list):
        chunks: list[str] = []
        for part in content:
            if isinstance(part, str):
                chunks.append(part)
                continue
            if isinstance(part, dict):
                text_value = part.get("text")
                if isinstance(text_value, str):
                    chunks.append(text_value)
        normalized = "\n".join(chunks).strip()
        if normalized:
            return normalized

    raise AuditDocxGenerationError("OpenAI devolvió contenido sin texto útil.")


def _create_openai_client(api_key: str, timeout_seconds: int) -> Any:
    try:
        openai_module = import_module("openai")
    except ModuleNotFoundError as exc:
        raise AuditDocxGenerationError(
            "Dependencia 'openai' no instalada en backend. Añade 'openai' a requirements."
        ) from exc
    return openai_module.OpenAI(api_key=api_key, timeout=timeout_seconds)


def _create_docx_document() -> Any:
    try:
        docx_module = import_module("docx")
    except ModuleNotFoundError as exc:
        raise AuditDocxGenerationError(
            "Dependencia 'python-docx' no instalada en backend. Añade 'python-docx' a requirements."
        ) from exc
    return docx_module.Document()


def _build_section_prompt(
    *,
    company_name: str,
    section_code: str,
    section_title: str,
    points: Sequence[str],
    checks: Sequence[AuditReportClauseCheck],
    items: Sequence[AuditReportItem],
    notes: str | None,
    project_context: str | None = None,
) -> str:
    points_payload = ", ".join(points) if points else "-"
    checks_payload = "\n".join(_serialize_clause_for_prompt(check) for check in checks) or "[]"
    items_payload = "\n".join(_serialize_item_for_prompt(item) for item in items) or "[]"
    notes_payload = (notes or "").strip() or "Sin notas adicionales."
    allowed_references: list[str] = []
    for item in items:
        if _has_text(item.item_code):
            allowed_references.append(str(item.item_code).strip())
    for check in checks:
        if _has_text(check.clause_code):
            allowed_references.append(str(check.clause_code).strip())
    allowed_references = sorted(set(ref for ref in allowed_references if ref))
    allowed_references_payload = ", ".join(allowed_references) if allowed_references else "Sin codigos"
    root = _normalize_section_root(section_code)
    climate_hint = ""
    if root == "4":
        climate_hint = (
            "En seccion 4, verificar explicitamente si hay evidencia sobre cambio climatico "
            "(relevancia en 4.1 y requisitos de partes interesadas en 4.2). "
            "Si no hay evidencia, indicarlo sin inferencias.\n"
        )
    return (
        f"Empresa: {company_name}\n"
        f"Sección: {section_code} - {section_title}\n"
        f"Puntos de norma: {points_payload}\n"
        f"Contexto ISO del proyecto: {(project_context or 'Sin contexto complementario.').strip()}\n"
        f"Referencias permitidas: {allowed_references_payload}\n"
        f"Datos de la sección: {items_payload}\n"
        f"Checks de cláusulas: {checks_payload}\n"
        f"Notas del auditor: {notes_payload}\n\n"
        "Redacta el texto narrativo de esta seccion.\n"
        f"{climate_hint}"
        "Devuelve SOLO estos 5 bloques y en este orden exacto (sin markdown ni texto adicional):\n"
        "Evidencias observadas: ...\n"
        "Desviaciones o carencias: ...\n"
        "Conclusion de cumplimiento: ...\n"
        "Riesgo para el sistema: ...\n"
        "Accion recomendada: ...\n"
        "Cada bloque debe contener 1-3 frases tecnicas, concretas y auditables, apoyadas en la evidencia recibida. "
        "No inventes datos no presentes en el contexto. "
        "Si citas codigos o referencias, usa solo las referencias permitidas."
    )


def _default_points_for_section(section_code: str) -> list[str]:
    root = _normalize_section_root(section_code)
    defaults = DEFAULT_SECTION_POINTS.get(root, [])
    return [point_code for point_code, _ in defaults]


def _has_text(value: str | None) -> bool:
    return bool((value or "").strip())


def _is_noncompliant_status(raw_status: str | None) -> bool:
    normalized = (raw_status or "").strip().lower()
    return normalized in {"non_compliant", "nonconform", "nonconforme", "nc", "failed", "ko"}


def _is_partial_status(raw_status: str | None) -> bool:
    normalized = (raw_status or "").strip().lower()
    return normalized in {"partial", "partially", "in_progress", "parcial"}


def _is_final_export_status(raw_status: str | None) -> bool:
    normalized = (raw_status or "").strip().lower()
    return normalized in {"completed", "approved", "closed", "final", "finalized"}


def _resolve_export_status_label(raw_status: str | None) -> str:
    if _is_final_export_status(raw_status):
        return "VERSION FINAL"
    return "BORRADOR CONTROLADO"


def _format_export_datetime(value: datetime | None) -> str:
    reference = value or datetime.now()
    return reference.strftime("%d/%m/%Y %H:%M")


def _format_issued_by(*, issued_by_name: str | None, issued_by_email: str | None) -> str:
    name = (issued_by_name or "").strip()
    email = (issued_by_email or "").strip()
    if name and email:
        return f"{name} <{email}>"
    if name:
        return name
    if email:
        return email
    return "No identificado"


def _build_structured_narrative_from_evidence(
    *,
    section: AuditReportSection,
    checks: Sequence[AuditReportClauseCheck],
    items: Sequence[AuditReportItem],
    project_context: str | None = None,
) -> str:
    applicable_checks = [check for check in checks if check.applicable]
    noncompliant = [check for check in applicable_checks if _is_noncompliant_status(check.clause_status)]
    partial = [check for check in applicable_checks if _is_partial_status(check.clause_status)]
    evidenced_items = [
        item for item in items if _has_text(item.value_text) or item.value_json not in (None, {}, [])
    ]

    evidence_samples: list[str] = []
    for item in evidenced_items:
        field_name = (item.item_label or item.item_code or "campo").strip()
        if _has_text(item.value_text):
            evidence_value = _short_text(item.value_text, max_len=90)
        elif item.value_json not in (None, {}, []):
            evidence_value = "estructura JSON registrada"
        else:
            continue
        evidence_samples.append(f"{field_name}: {evidence_value}")
        if len(evidence_samples) >= 3:
            break

    gap_samples: list[str] = []
    for check in noncompliant + partial:
        clause_ref = _short_text(check.clause_code or check.clause_title or "clausula", max_len=24)
        finding_text = _short_text(
            check.observation_text or check.evidence_summary or "sin detalle adicional registrado",
            max_len=80,
        )
        gap_samples.append(f"{clause_ref}: {finding_text}")
        if len(gap_samples) >= 3:
            break

    evidence_text = (
        f"Seccion {section.section_code} ({_short_text(section.title, max_len=48)}). "
        f"Checks aplicables revisados: {len(applicable_checks)}. "
        f"Campos con evidencia capturada: {len(evidenced_items)}. "
        f"Muestra de evidencia: {'; '.join(evidence_samples) if evidence_samples else 'sin muestra disponible'}."
    )
    if _has_text(project_context):
        evidence_text = f"{evidence_text} Contexto ISO complementario: {_short_text(project_context, max_len=140)}."

    if noncompliant or partial:
        gaps_text = (
            f"No conformidades detectadas: {len(noncompliant)}. "
            f"Desviaciones parciales/en progreso: {len(partial)}. "
            f"Muestra: {'; '.join(gap_samples) if gap_samples else 'sin detalle adicional'}."
        )
    else:
        gaps_text = (
            "No se registran desviaciones abiertas en checks aplicables para esta seccion. "
            "No se observan carencias explicitamente marcadas en el registro."
        )
        if len(applicable_checks) == 0:
            gaps_text = (
                "No se evidencian checks aplicables marcados en esta seccion; "
                "la evaluacion de desviaciones queda incompleta."
            )

    if len(applicable_checks) == 0:
        conclusion_text = (
            "Cumplimiento no evaluable con robustez porque no hay checks aplicables registrados. "
            "Se requiere validacion del auditor responsable."
        )
    elif noncompliant:
        conclusion_text = (
            "Cumplimiento no conforme para la seccion revisada por existencia de hallazgos abiertos. "
            "No procede declarar conformidad hasta cierre y verificacion de acciones."
        )
    elif partial:
        conclusion_text = (
            "Cumplimiento parcial: la seccion muestra avance, pero persisten puntos pendientes de cierre."
        )
    else:
        conclusion_text = "Cumplimiento conforme con la evidencia disponible y checks aplicables registrados."

    if noncompliant or len(evidenced_items) == 0:
        risk_text = (
            "Riesgo medio/alto de incumplimiento efectivo y de debilidad de trazabilidad "
            "si no se completa evidencia y cierre de hallazgos."
        )
    elif partial:
        risk_text = (
            "Riesgo moderado por desviaciones parciales que pueden afectar consistencia operativa "
            "si no se consolidan controles."
        )
    else:
        risk_text = (
            "Riesgo controlado con la evidencia actual, condicionado a mantener seguimiento y actualizacion documental."
        )

    action_text = (
        "Completar evidencias faltantes, validar cada check aplicable con soporte objetivo "
        "y registrar fecha/responsable de cierre para los hallazgos abiertos antes de emision final."
    )
    if _has_text(section.auditor_notes):
        action_text = f"{action_text} Nota del auditor: {_short_text(section.auditor_notes, max_len=140)}."

    lines = []
    for key, content in (
        ("evidence", evidence_text),
        ("gaps", gaps_text),
        ("conclusion", conclusion_text),
        ("risk", risk_text),
        ("action", action_text),
    ):
        lines.append(f"{_NARRATIVE_SECTION_HEADINGS[key]}: {content}")
    return "\n\n".join(lines)


def _build_fallback_section_narrative(
    *,
    section: AuditReportSection,
    checks: Sequence[AuditReportClauseCheck],
    items: Sequence[AuditReportItem],
    project_context: str | None = None,
) -> str:
    return _build_structured_narrative_from_evidence(
        section=section,
        checks=checks,
        items=items,
        project_context=project_context,
    )


def build_document_integrity_notes(
    *,
    report: AuditReport,
    interviewees: Sequence[AuditReportInterviewee],
    sections: Sequence[AuditReportSection],
    items: Sequence[AuditReportItem],
    clause_checks: Sequence[AuditReportClauseCheck],
    annexes: Sequence[AuditReportAnnex],
    recommendations: Sequence[AuditReportRecommendation],
    section_narratives: Mapping[str, str],
) -> list[str]:
    notes: list[str] = []

    if not _has_text(report.entity_name):
        notes.append("Falta entidad auditada en cabecera.")
    if report.audit_date is None:
        notes.append("Falta fecha de realizacion de auditoria.")
    if not _has_text(report.system_scope):
        notes.append("Falta alcance del sistema.")
    if not _has_text(report.tipo_auditoria):
        notes.append("Falta tipo de auditoria en cabecera.")
    if not _has_text(report.modalidad):
        notes.append("Falta modalidad de auditoria en cabecera.")
    if not _has_text(report.quality_responsible_name):
        notes.append("Falta responsable del sistema en cabecera.")
    if len(interviewees) == 0:
        notes.append("No hay personal entrevistado registrado.")
    if len(annexes) == 0:
        notes.append("No hay anexos/evidencias documentales cargados.")
    if len(recommendations) == 0:
        notes.append("No hay recomendaciones/hallazgos registrados en resultados.")

    items_by_section: dict[str, int] = defaultdict(int)
    for item in items:
        if _has_text(item.value_text) or item.value_json not in (None, {}, []):
            items_by_section[item.section_code] += 1

    applicable_checks_by_section: dict[str, int] = defaultdict(int)
    for check in clause_checks:
        if check.applicable:
            applicable_checks_by_section[check.section_code] += 1

    iso_sections = [section for section in sections if _is_iso_section(section.section_code)]
    for section in iso_sections:
        narrative_available = any(
            [
                _has_text(section.final_text),
                _has_text(section.ai_draft_text),
                _has_text(section.auditor_notes),
                _has_text(section_narratives.get(section.section_code)),
            ]
        )
        if not narrative_available:
            notes.append(f"Seccion {section.section_code}: sin narrativa registrada.")
        if items_by_section.get(section.section_code, 0) == 0:
            notes.append(f"Seccion {section.section_code}: sin datos de campos guiados con evidencia.")
        if applicable_checks_by_section.get(section.section_code, 0) == 0:
            notes.append(f"Seccion {section.section_code}: sin checks de clausula aplicables.")

    return notes


def extract_critical_integrity_notes(notes: Sequence[str]) -> list[str]:
    critical_prefixes = (
        "Falta entidad auditada en cabecera.",
        "Falta fecha de realizacion de auditoria.",
        "Falta alcance del sistema.",
        "Falta tipo de auditoria en cabecera.",
        "Falta modalidad de auditoria en cabecera.",
        "Falta responsable del sistema en cabecera.",
        "No hay personal entrevistado registrado.",
        "No hay anexos/evidencias documentales cargados.",
    )
    critical: list[str] = []
    for note in notes:
        if note.startswith(critical_prefixes):
            critical.append(note)
            continue
        if note.startswith("Seccion ") and (
            "sin datos de campos guiados con evidencia" in note
            or "sin checks de clausula aplicables" in note
        ):
            critical.append(note)
    return critical


def generate_section_narratives(
    *,
    openai_api_key: str | None,
    model: str,
    timeout_seconds: int,
    company_name: str,
    sections: Sequence[AuditReportSection],
    items: Sequence[AuditReportItem],
    clause_checks: Sequence[AuditReportClauseCheck],
    context_by_section: Mapping[str, str] | None = None,
) -> dict[str, str]:
    normalized_api_key = (openai_api_key or "").strip()
    client = _create_openai_client(normalized_api_key, timeout_seconds) if normalized_api_key else None
    items_by_section: dict[str, list[AuditReportItem]] = defaultdict(list)
    for item in items:
        items_by_section[item.section_code].append(item)
    for section_items in items_by_section.values():
        section_items.sort(key=lambda row: (row.sort_order or 0, row.item_code))

    checks_by_section: dict[str, list[AuditReportClauseCheck]] = defaultdict(list)
    for clause in clause_checks:
        checks_by_section[clause.section_code].append(clause)
    for section_checks in checks_by_section.values():
        section_checks.sort(key=lambda row: (row.sort_order or 0, row.clause_code))

    narratives: dict[str, str] = {}
    iso_sections = [section for section in sections if _is_iso_section(section.section_code)]
    iso_sections.sort(key=_section_sort_key)

    for section in iso_sections:
        if _has_text(section.final_text):
            # Priorizar texto validado por auditor y evitar sobreescritura con IA.
            continue

        section_checks = checks_by_section.get(section.section_code, [])
        section_items = items_by_section.get(section.section_code, [])
        section_root = _normalize_section_root(section.section_code)
        project_context = (
            (context_by_section or {}).get(section.section_code)
            or (context_by_section or {}).get(section_root)
            or None
        )

        if client is None:
            narratives[section.section_code] = _build_fallback_section_narrative(
                section=section,
                checks=section_checks,
                items=section_items,
                project_context=project_context,
            )
            continue

        prompt = _build_section_prompt(
            company_name=company_name,
            section_code=section.section_code,
            section_title=section.title,
            points=_default_points_for_section(section.section_code),
            checks=section_checks,
            items=section_items,
            notes=section.auditor_notes,
            project_context=project_context,
        )
        try:
            completion = client.chat.completions.create(
                model=model,
                temperature=0.2,
                max_tokens=1200,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )
            ai_narrative = _extract_response_text(completion)
            if _is_valid_section_narrative(ai_narrative):
                narratives[section.section_code] = ai_narrative
            else:
                logger.warning(
                    "Narrativa IA no valida para seccion %s; se usa fallback estructurado.",
                    section.section_code,
                )
                narratives[section.section_code] = _build_fallback_section_narrative(
                    section=section,
                    checks=section_checks,
                    items=section_items,
                    project_context=project_context,
                )
        except Exception:
            logger.exception(
                "Fallo de generacion IA para seccion %s; se usa fallback de evidencia.",
                section.section_code,
            )
            narratives[section.section_code] = _build_fallback_section_narrative(
                section=section,
                checks=section_checks,
                items=section_items,
                project_context=project_context,
            )

    return narratives


def _status_to_followup_label(raw_status: str | None) -> str:
    normalized = (raw_status or "").strip().lower()
    if normalized in {"completed", "compliant", "cumplida", "closed", "cerrada"}:
        return "cumplida"
    if normalized in {"partial", "partially", "in_progress", "parcial"}:
        return "parcialmente"
    return "no cumplida"


def _build_points_rows(
    *,
    section_code: str,
    section_checks: Sequence[AuditReportClauseCheck],
    reference_standard: str,
) -> list[tuple[str, str, str, str]]:
    root = _normalize_section_root(section_code)
    defaults = DEFAULT_SECTION_POINTS.get(root, [])
    rows: list[tuple[str, str, str, str]] = []

    checks_by_code = {
        (check.clause_code or "").strip().lower(): check for check in section_checks if check.clause_code
    }

    for default_code, default_title in defaults:
        check = checks_by_code.pop(default_code.strip().lower(), None)
        title = check.clause_title if check and check.clause_title else default_title
        marker = "X" if check and check.applicable else ""
        rows.append((title, reference_standard, default_code, marker))

    extra_checks = list(checks_by_code.values())
    extra_checks.sort(key=lambda row: (row.sort_order or 0, row.clause_code))
    for check in extra_checks:
        rows.append(
            (
                check.clause_title or "-",
                reference_standard,
                check.clause_code or "-",
                "X" if check.applicable else "",
            )
        )

    if rows:
        return rows

    return [("-", reference_standard, "-", "")]


def _add_kv_table(document: Any, rows: Sequence[tuple[str, str]]) -> None:
    table = document.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for label, value in rows:
        cells = table.add_row().cells
        cells[0].text = label
        cells[1].text = value


def _add_single_text_table(document: Any, value: str) -> None:
    table = document.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    table.rows[0].cells[0].text = value


def build_audit_report_docx(
    *,
    report: AuditReport,
    client: Client,
    interviewees: Sequence[AuditReportInterviewee],
    sections: Sequence[AuditReportSection],
    items: Sequence[AuditReportItem],
    clause_checks: Sequence[AuditReportClauseCheck],
    annexes: Sequence[AuditReportAnnex],
    recommendations: Sequence[AuditReportRecommendation],
    recommendation_history: Sequence[Mapping[str, Any]],
    section_narratives: Mapping[str, str],
    context_by_section: Mapping[str, str] | None = None,
    ai_generation_used: bool = True,
    issued_by_name: str | None = None,
    issued_by_email: str | None = None,
    issued_at: datetime | None = None,
) -> BytesIO:
    document = _create_docx_document()
    export_status_label = _resolve_export_status_label(report.status)
    is_final_export = _is_final_export_status(report.status)
    integrity_notes = build_document_integrity_notes(
        report=report,
        interviewees=interviewees,
        sections=sections,
        items=items,
        clause_checks=clause_checks,
        annexes=annexes,
        recommendations=recommendations,
        section_narratives=section_narratives,
    )
    critical_integrity_notes = extract_critical_integrity_notes(integrity_notes)
    document.add_heading(
        "INFORME DE AUDITORÍA INTERNA DE SISTEMA DE GESTIÓN BASADO EN LA NORMA ISO 9001:2015",
        level=1,
    )
    document.add_paragraph(
        f"Código: {_to_display(report.report_code)} · Año: {_to_display(report.report_year)}"
    )
    document.add_paragraph(f"Estado de exportacion: {export_status_label}")
    document.add_paragraph(f"Fecha/hora de emision: {_format_export_datetime(issued_at)}")
    document.add_paragraph(
        f"Emitido por: {_format_issued_by(issued_by_name=issued_by_name, issued_by_email=issued_by_email)}"
    )
    if ai_generation_used:
        document.add_paragraph(AI_ASSISTED_NOTICE)
    else:
        document.add_paragraph(
            "Nota metodológica: exportación generada en modo respaldo sin IA; "
            "la redacción debe revisarse y completarse por el auditor responsable."
        )
    if is_final_export and critical_integrity_notes:
        document.add_paragraph(
            "Advertencia: esta version final contiene faltantes criticos de integridad documental. "
            "Revise las observaciones antes de uso formal externo."
        )

    document.add_heading("1. Cabecera", level=2)
    interviewees_text = "\n".join(
        f"{person.full_name} - {_to_display(person.role_name)}"
        for person in sorted(interviewees, key=lambda row: (row.sort_order or 0, row.full_name))
    ) or "-"
    _add_kv_table(
        document,
        [
            ("Entidad", _to_display(report.entity_name or client.name)),
            ("Sector", _to_display(client.sector)),
            ("Nº de empleados", _to_display(client.employee_count)),
            ("Auditor/es (organización)", _to_display(report.auditor_organization)),
            ("Departamento/Área auditada", _to_display(report.audited_area)),
            ("Fecha de realización", _to_display(report.audit_date)),
            ("Tipo de auditoría", _to_display(_audit_type_to_text(report.tipo_auditoria))),
            ("Modalidad", _to_display(_normalize_audit_modality(report.modalidad))),
            ("Instalaciones auditadas", _to_display(report.audited_facilities)),
            ("Responsable del sistema", _to_display(report.quality_responsible_name)),
            (
                "Norma de referencia",
                (
                    f"{_to_display(report.reference_standard)} "
                    f"({_to_display(report.reference_standard_revision)})"
                    if _has_text(report.reference_standard_revision)
                    else _to_display(report.reference_standard)
                ),
            ),
            ("Presupuesto de auditoría", _to_display(report.audit_budget_code)),
            ("Personal entrevistado", interviewees_text),
        ],
    )

    document.add_heading("2. Alcance del sistema", level=2)
    _add_single_text_table(document, _to_display(report.system_scope))

    tipo_auditoria_texto = _audit_type_to_text(report.tipo_auditoria)
    modalidad_texto = _normalize_audit_modality(report.modalidad)

    document.add_heading("3. DESCRIPCIÓN Y CRITERIOS DE LA AUDITORÍA", level=2)
    document.add_paragraph(
        f"La auditoría de {tipo_auditoria_texto} se ha realizado {modalidad_texto} en las instalaciones del cliente."
    )
    document.add_paragraph(
        "Se ha auditado el Sistema de Gestión de Calidad al completo mediante la comprobación de las actividades "
        "incluidas en el alcance, así como mediante la revisión e investigación de los registros del sistema."
    )
    document.add_paragraph(
        "El muestreo realizado ha permitido verificar el funcionamiento de la organización, así como la validez "
        "de los métodos de seguimiento y medición, incluyendo la gestión de la información documentada."
    )

    document.add_paragraph("Criterios de auditoría")
    for clause in (
        "Cláusula 4. Contexto de la organización",
        "Cláusula 5. Liderazgo",
        "Cláusula 6. Planificación",
        "Cláusula 7. Apoyo",
        "Cláusula 8. Operación",
        "Cláusula 9. Evaluación del desempeño",
        "Cláusula 10. Mejora",
    ):
        document.add_paragraph(clause, style="List Bullet")

    document.add_paragraph("Otros criterios de auditoría")
    for criterion in ("evidencia objetiva", "cumplimiento normativo", "resultados esperados"):
        document.add_paragraph(criterion, style="List Bullet")

    document.add_paragraph(
        "El proceso de auditoría se da por concluido con la comunicación formal de los resultados, "
        "la validación de hallazgos y la definición de acciones de seguimiento por la organización auditada."
    )

    document.add_heading("3.1 Evidencia contextual del sistema utilizada", level=3)
    if context_by_section:
        for section_code in sorted(context_by_section.keys(), key=_sort_section_code_for_display):
            context_text = _to_display(context_by_section.get(section_code))
            document.add_paragraph(
                f"Seccion {section_code}: {context_text}",
                style="List Bullet",
            )
    else:
        document.add_paragraph("No hay evidencia contextual complementaria disponible para esta exportacion.")

    checks_by_section: dict[str, list[AuditReportClauseCheck]] = defaultdict(list)
    for check in clause_checks:
        checks_by_section[check.section_code].append(check)
    for section_checks in checks_by_section.values():
        section_checks.sort(key=lambda row: (row.sort_order or 0, row.clause_code))

    iso_sections = [section for section in sections if _is_iso_section(section.section_code)]
    iso_sections.sort(key=_section_sort_key)

    for section in iso_sections:
        root = _normalize_section_root(section.section_code)
        section_heading = SECTION_HEADING_MAP.get(
            root,
            f"{section.section_code}.- {(section.title or '').upper()}".strip(),
        )
        document.add_heading(section_heading, level=2)

        points_rows = _build_points_rows(
            section_code=section.section_code,
            section_checks=checks_by_section.get(section.section_code, []),
            reference_standard=_to_display(report.reference_standard),
        )
        points_table = document.add_table(rows=1, cols=4)
        points_table.style = "Table Grid"
        header_cells = points_table.rows[0].cells
        header_cells[0].text = "Título"
        header_cells[1].text = "Normas de Referencia"
        header_cells[2].text = "Puntos aplicables"
        header_cells[3].text = "X"
        for title, norm, point_code, marker in points_rows:
            row_cells = points_table.add_row().cells
            row_cells[0].text = _to_display(title)
            row_cells[1].text = _to_display(norm)
            row_cells[2].text = _to_display(point_code)
            row_cells[3].text = _to_display(marker)

        narrative = (
            section.final_text
            or section_narratives.get(section.section_code)
            or section.ai_draft_text
            or section.auditor_notes
            or "Sin contenido narrativo disponible para esta sección."
        )
        for paragraph in [part.strip() for part in str(narrative).split("\n\n") if part.strip()]:
            document.add_paragraph(paragraph)

    document.add_heading("RESULTADOS", level=2)
    document.add_heading("Anexos", level=3)
    if annexes:
        ordered_annexes = sorted(annexes, key=lambda row: (row.sort_order or 0, row.created_at))
        for annex in ordered_annexes:
            annex_prefix = f"{annex.annex_code}: " if _has_text(annex.annex_code) else ""
            annex_line = f"{annex_prefix}{_to_display(annex.title)}"
            if _has_text(annex.notes):
                annex_line = f"{annex_line}. {_to_display(annex.notes)}"
            document.add_paragraph(annex_line, style="List Bullet")
    else:
        document.add_paragraph("No hay anexos documentales registrados para esta auditoría.")

    document.add_heading("Recomendaciones de esta auditoría", level=3)
    if recommendations:
        recommendation_table = document.add_table(rows=1, cols=6)
        recommendation_table.style = "Table Grid"
        recommendation_header = recommendation_table.rows[0].cells
        recommendation_header[0].text = "Sección"
        recommendation_header[1].text = "Tipo"
        recommendation_header[2].text = "Prioridad"
        recommendation_header[3].text = "Estado"
        recommendation_header[4].text = "Recomendación"
        recommendation_header[5].text = "Seguimiento"

        ordered_recommendations = sorted(
            recommendations,
            key=lambda row: (row.created_at or datetime.min),
        )
        for recommendation in ordered_recommendations:
            row_cells = recommendation_table.add_row().cells
            row_cells[0].text = _to_display(recommendation.section_code)
            row_cells[1].text = _to_display(recommendation.recommendation_type)
            row_cells[2].text = _to_display(recommendation.priority)
            row_cells[3].text = _status_to_followup_label(recommendation.recommendation_status)
            row_cells[4].text = _to_display(recommendation.body_text)
            row_cells[5].text = _to_display(recommendation.followup_comment)
    else:
        document.add_paragraph("No hay recomendaciones registradas para esta auditoría.")

    document.add_heading("Seguimiento de recomendaciones anteriores", level=3)
    if recommendation_history:
        history_table = document.add_table(rows=1, cols=6)
        history_table.style = "Table Grid"
        history_header = history_table.rows[0].cells
        history_header[0].text = "Informe"
        history_header[1].text = "Año"
        history_header[2].text = "Sección"
        history_header[3].text = "Estado"
        history_header[4].text = "Recomendación"
        history_header[5].text = "Seguimiento"
        for item in recommendation_history:
            row_cells = history_table.add_row().cells
            row_cells[0].text = _to_display(item.get("report_code"))
            row_cells[1].text = _to_display(item.get("report_year"))
            row_cells[2].text = _to_display(item.get("section_code"))
            row_cells[3].text = _status_to_followup_label(
                item.get("recommendation_status")
            )
            row_cells[4].text = _to_display(item.get("body_text"))
            row_cells[5].text = _to_display(item.get("followup_comment"))
    else:
        document.add_paragraph("No existe histórico de recomendaciones previas para este cliente.")

    document.add_heading("Observaciones de integridad documental", level=3)
    if integrity_notes:
        for note in integrity_notes:
            document.add_paragraph(note, style="List Bullet")
    else:
        document.add_paragraph(
            "No se detectan ausencias criticas de informacion para la redaccion del informe."
        )
    if is_final_export and critical_integrity_notes:
        document.add_heading("Advertencia de integridad para version final", level=3)
        document.add_paragraph(
            "La auditoria esta en estado final, pero se mantienen faltantes criticos que pueden "
            "afectar la suficiencia documental del expediente."
        )
        for note in critical_integrity_notes:
            document.add_paragraph(note, style="List Bullet")

    document.add_heading("CONCLUSIONES", level=2)
    document.add_paragraph(_to_display(report.conclusions_text))

    document.add_heading("DISPOSICIONES FINALES", level=2)
    if report.final_dispositions_text and report.final_dispositions_text.strip():
        document.add_paragraph(report.final_dispositions_text.strip())
    for line in FIXED_FINAL_DISPOSITIONS_LINES:
        document.add_paragraph(line)

    output = BytesIO()
    document.save(output)
    output.seek(0)
    return output
