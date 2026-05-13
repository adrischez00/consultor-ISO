from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from html import unescape
from collections import defaultdict
from datetime import date, datetime
from importlib import import_module
from io import BytesIO
from pathlib import Path
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

WATERMARK_LOGO_ENV_VAR = "AUDIT_DOCX_WATERMARK_LOGO"
WATERMARK_DEFAULT_RELATIVE_PATH = Path("assets") / "docx" / "logoH.png"
_WATERMARK_ANCHOR_REGISTERED = False
WATERMARK_ALPHA_AMT = 4500
WATERMARK_USE_GRAYSCALE = False
WATERMARK_MINIMAL_SURFACES_MODE = True
WATERMARK_ROTATION_DEGREES = -14.0

SYSTEM_PROMPT = (
    "Actúa como auditor interno ISO 9001 redactando un informe en español técnico y profesional. "
    "Reglas obligatorias: no inventar hechos, no inventar códigos/documentos/fechas/personas, "
    "no emitir asesoramiento legal ni afirmar certificación de cumplimiento automático. "
    "Usa solo la evidencia recibida. Si la evidencia es insuficiente, indícalo explícitamente "
    "con lenguaje de auditoría (por ejemplo: 'No se evidencia ...'). "
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
        "aplicables, de los documentos del Sistema de Gestión, y a incumplimientos en los procesos auditados."
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
        ("5.1", "Liderazgo y Compromiso de la Alta Dirección"),
        ("5.1.2", "Enfoque al Cliente"),
        ("5.2", "Política de Calidad"),
        ("5.3", "Roles, Responsabilidades y Autoridades"),
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
    "gaps": "Desviaciones y carencias",
    "conclusion": "Conclusión de cumplimiento",
    "risk": "Riesgo para el sistema",
    "action": "Acción recomendada",
}
_NARRATIVE_HEADING_ALIASES = {
    "evidence": ("evidencias observadas",),
    "gaps": (
        "desviaciones y carencias",
        "desviaciones/carencias",
        "desviaciones y carencias",
    ),
    "conclusion": (
        "conclusión de cumplimiento",
        "conclusion de cumplimiento",
        "conclusión",
        "conclusion",
    ),
    "risk": ("riesgo para el sistema", "riesgo"),
    "action": ("acción recomendada", "accion recomendada", "acción", "accion"),
}
_GENERIC_NARRATIVE_MARKERS = (
    "en lineas generales",
    "de manera general",
    "como modelo de lenguaje",
    "no dispongo de",
    "no puedo verificar",
    "sin información adicional",
    "se recomienda seguir mejorando",
    "cumple en terminos generales",
)

_SECTION_FALLBACK_VARIANTS: dict[str, Any] = {
    "evidence_intro": [
        "En la sección revisada se ha contrastado la evidencia disponible con los criterios aplicables.",
        "La revisión documental y de registros permite trazar el estado real de la sección evaluada.",
        "El análisis de la sección integra resultados de verificación y soporte objetivo registrado.",
    ],
    "no_evidence_sample": [
        "sin muestra puntual documentada",
        "sin evidencias específicas disponibles en esta extracción",
        "sin registros concretos aportados en el corte revisado",
    ],
    "gaps_intro": [
        "Se observan aspectos que requieren cierre antes de considerar la sección estabilizada.",
        "La evidencia disponible muestra brechas que deben tratarse en el siguiente ciclo de seguimiento.",
        "Quedan elementos abiertos cuya resolución condiciona la madurez alcanzada en la sección.",
    ],
    "gaps_none": [
        "No se registran desviaciones abiertas en checks aplicables para esta sección. No se observan carencias explícitamente marcadas en el registro.",
        "Con la evidencia disponible no se detectan brechas abiertas en checks aplicables ni carencias documentadas de forma explícita.",
        "No se han consignado desviaciones activas en los checks aplicables, y el registro no refleja carencias pendientes.",
    ],
    "gaps_not_applicable": [
        "No se evidencian checks aplicables marcados en esta sección; la evaluación de desviaciones queda incompleta.",
        "La sección no presenta checks aplicables en el registro actual, por lo que no es posible concluir desviaciones con robustez.",
        "Al no existir checks aplicables consignados, la lectura de brechas queda limitada y requiere validación adicional.",
    ],
    "conclusion": {
        "no_applicable": [
            "Cumplimiento no evaluable con robustez porque no hay checks aplicables registrados. Se requiere validación del auditor responsable.",
            "No procede declarar conformidad ni no conformidad: no constan checks aplicables suficientes para una conclusión sólida.",
            "La sección queda en estado de evaluación insuficiente por ausencia de checks aplicables formalmente registrados.",
        ],
        "non_compliant": [
            "Cumplimiento no conforme para la sección revisada por existencia de hallazgos abiertos. No procede declarar conformidad hasta cierre y verificación de acciones.",
            "La sección presenta incumplimientos abiertos; la conformidad queda condicionada al cierre eficaz de acciones correctivas.",
            "Se concluye no conformidad en el estado actual, al mantenerse desviaciones sin cierre verificable.",
        ],
        "partial": [
            "El cumplimiento es parcial: se aprecia avance, aunque permanecen puntos por cerrar para consolidar la conformidad.",
            "La sección presenta implantación operativa, con brechas activas que todavía exigen seguimiento y cierre.",
            "Existe conformidad parcial en el alcance revisado; el cierre eficaz de pendientes es necesario para elevar la madurez.",
        ],
        "in_progress": [
            "Evaluación en curso: existen checks marcados como sin evaluar, por lo que no procede declarar cumplimiento total con la evidencia actual.",
            "La sección permanece en estado de evaluación parcial por checks sin resolver; no corresponde cerrar conformidad en este corte.",
            "No es viable afirmar cumplimiento definitivo mientras persistan checks en estado sin evaluar.",
        ],
        "compliant": [
            "Cumplimiento conforme con la evidencia disponible y checks aplicables registrados.",
            "Con la información verificada, la sección mantiene conformidad en los requisitos evaluados.",
            "La evidencia disponible respalda un cumplimiento consistente en el alcance auditado.",
        ],
    },
    "risk": {
        "non_compliant_or_no_evidence": [
            "Riesgo medio/alto de incumplimiento efectivo y de debilidad de trazabilidad si no se completa evidencia y cierre de hallazgos.",
            "Riesgo relevante de desviación operativa por insuficiencia de soporte objetivo y hallazgos abiertos.",
            "Riesgo alto de cierre no robusto mientras no se complete la evidencia y la verificación de acciones.",
        ],
        "partial": [
            "Riesgo moderado por desviaciones parciales que pueden afectar consistencia operativa si no se consolidan controles.",
            "Riesgo medio asociado a brechas parciales con impacto potencial en estabilidad del sistema.",
            "Riesgo controlable, condicionado al cierre de desviaciones parciales y verificación de eficacia.",
        ],
        "in_progress": [
            "Riesgo moderado por evaluación incompleta; es necesario cerrar los checks sin evaluar para confirmar el estado real de cumplimiento.",
            "Riesgo de interpretación sesgada por cobertura incompleta de checks; se requiere finalizar la evaluación.",
            "Riesgo medio por falta de cierre evaluativo en todos los requisitos aplicables.",
        ],
        "compliant": [
            "Riesgo controlado con la evidencia actual, condicionado a mantener seguimiento y actualización documental.",
            "Riesgo bajo en el alcance revisado, sujeto a continuidad de controles y trazabilidad documental.",
            "Riesgo residual acotado, con necesidad de sostener disciplina de seguimiento periódico.",
        ],
    },
    "action": [
        "Completar la evidencia pendiente, validar cada check aplicable con soporte objetivo y registrar responsable y fecha de cierre en los hallazgos abiertos.",
        "Formalizar un plan de cierre con responsables y plazos, consolidando la trazabilidad de las evidencias antes de emitir la versión final.",
        "Asegurar un cierre verificable de los hallazgos, incluyendo seguimiento de eficacia y respaldo documental suficiente para revisiones posteriores.",
    ],
}

_CLAUSE_CHECK_VARIANTS: dict[str, Any] = {
    "no_evidence": [
        "Evidencia: No se ha registrado evidencia suficiente.",
        "Evidencia: No consta soporte objetivo suficiente en el registro revisado.",
        "Evidencia: La cláusula no dispone de respaldo documental suficiente en este corte.",
    ],
    "no_observation": [
        "Observación: Sin observaciones documentadas.",
        "Observación: No se registran observaciones específicas para esta cláusula.",
        "Observación: No consta comentario adicional formalizado.",
    ],
    "status": {
        "non_compliant": {
            "finding": [
                "Hallazgo: Existe desviación que requiere acción correctiva y verificación de cierre.",
                "Hallazgo: Se confirma incumplimiento con necesidad de cierre formal y validación de eficacia.",
                "Hallazgo: La cláusula presenta no conformidad abierta que exige tratamiento inmediato.",
            ],
            "action": [
                "Recomendación: Definir plan de acción con responsable, plazo y seguimiento de eficacia.",
                "Recomendación: Implantar acción correctiva con trazabilidad de responsable, fecha y verificación de cierre.",
                "Recomendación: Priorizar cierre de la desviación con evidencia objetiva y control de eficacia.",
            ],
        },
        "partial": {
            "finding": [
                "Hallazgo: La cláusula mantiene conformidad parcial y requiere consolidar acciones pendientes.",
                "Hallazgo: Existe avance en cumplimiento, con brechas abiertas que aún deben cerrarse.",
                "Hallazgo: El requisito muestra implantación parcial y necesita mayor robustez de evidencia.",
            ],
            "action": [
                "Recomendación: Completar la evidencia faltante y verificar eficacia en la próxima revisión.",
                "Recomendación: Cerrar brechas parciales con responsables definidos y validación posterior.",
                "Recomendación: Fortalecer la trazabilidad de implantación antes del siguiente ciclo de auditoría.",
            ],
        },
        "in_progress": {
            "finding": [
                "Hallazgo: Cláusula sin evaluar; no procede declarar cumplimiento.",
                "Hallazgo: Evaluación pendiente para esta cláusula, sin base suficiente para concluir conformidad.",
                "Hallazgo: El estado actual es de revisión en curso y requiere cierre evaluativo.",
            ],
            "action": [
                "Recomendación: Completar evaluación y soporte objetivo antes de cierre de informe.",
                "Recomendación: Finalizar revisión de la cláusula y documentar evidencia verificable.",
                "Recomendación: Registrar resultado evaluativo y respaldo documental para emitir conclusión robusta.",
            ],
        },
        "not_applicable": {
            "finding": [
                "Hallazgo: Cláusula no aplicable según el alcance auditado.",
                "Hallazgo: Requisito declarado no aplicable conforme al alcance definido.",
                "Hallazgo: La cláusula queda fuera de aplicabilidad para el contexto auditado.",
            ],
        },
        "compliant": {
            "finding": [
                "Hallazgo: La cláusula mantiene conformidad en el alcance evaluado.",
                "Hallazgo: Se verifica cumplimiento con soporte objetivo suficiente para esta revisión.",
                "Hallazgo: El requisito presenta evidencia consistente de cumplimiento.",
            ],
        },
    },
}

CLAUSE_STATUS_DISPLAY = {
    "compliant": {"label": "Cumple", "icon": "✓", "color": "1B5E20", "fill": "E8F5E9"},
    "partial": {"label": "Parcial", "icon": "◐", "color": "8A4B00", "fill": "FFF3E0"},
    "non_compliant": {"label": "No cumple", "icon": "✕", "color": "9B1C1C", "fill": "FEE2E2"},
    "in_progress": {"label": "Sin evaluar", "icon": "○", "color": "334155", "fill": "E2E8F0"},
    "not_applicable": {"label": "No aplica", "icon": "—", "color": "475569", "fill": "E5E7EB"},
}

SIGNAL_STATE_DISPLAY = {
    "ok": {"icon": "✓", "color": "166534", "fill": "DCFCE7"},
    "warning": {"icon": "!", "color": "92400E", "fill": "FEF3C7"},
    "critical": {"icon": "✕", "color": "991B1B", "fill": "FEE2E2"},
    "neutral": {"icon": "○", "color": "334155", "fill": "E2E8F0"},
}

RECOMMENDATION_TYPE_LABELS = {
    "recommendation": "Recomendación",
    "non_conformity": "No conformidad",
    "observation": "Observación",
}

RECOMMENDATION_PRIORITY_LABELS = {
    "low": "Baja",
    "medium": "Media",
    "high": "Alta",
}

RECOMMENDATION_STATUS_LABELS = {
    "new": "Nueva",
    "pending": "Pendiente",
    "in_progress": "En curso",
    "done": "Cerrada",
}

S10_ACTION_STATUS_LABELS = {
    "open": "Abierta",
    "in_progress": "En curso",
    "completed": "Completada",
    "overdue": "Vencida",
}

S10_EFFECTIVENESS_LABELS = {
    "effective": "Efectiva",
    "partial": "Parcial",
    "ineffective": "Ineficaz",
    "pending": "Pendiente",
}

S10_TYPE_LABELS = {
    "nc_internal": "NC interna",
    "nc_supplier": "NC proveedor",
    "opportunity": "Oportunidad",
    "observation": "Observación",
    "improvement": "Mejora",
}

_MOJIBAKE_MARKERS = ("Ã", "Â", "â", "ð", "�")
_LOSSY_ISO_TERM_FIXUPS: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (
        re.compile(pattern, re.IGNORECASE),
        replacement,
    )
    for pattern, replacement in [
        (r"\bdirecci[oó\?]n\b", "dirección"),
        (r"\bsatisfacci[oó\?]n\b", "satisfacción"),
        (r"\brevisi[oó\?]n\b", "revisión"),
        (r"\bdise[nñ\?]o\b", "diseño"),
        (r"\bplanificaci[oó\?]n\b", "planificación"),
        (r"\borganizaci[oó\?]n\b", "organización"),
        (r"\bgesti[oó\?]n\b", "gestión"),
        (r"\bacci[oó\?]n\b", "acción"),
        (r"\bevaluaci[oó\?]n\b", "evaluación"),
        (r"\binformaci[oó\?]n\b", "información"),
        (r"\bcomunicaci[oó\?]n\b", "comunicación"),
        (r"\bauditor[ií\?]a\b", "auditoría"),
        (r"\bconclusi[oó\?]n\b", "conclusión"),
        (r"\bemisi[oó\?]n\b", "emisión"),
        (r"\brealizaci[oó\?]n\b", "realización"),
        (r"\bsecci[oó\?]n\b", "sección"),
        (r"\bpol[ií\?]tica\b", "política"),
        (r"\bcl[aá\?]usula\b", "cláusula"),
        (r"\bcl[aá\?]usulas\b", "cláusulas"),
        (r"\bc[oó\?]digo\b", "código"),
        (r"\bc[oó\?]digos\b", "códigos"),
        (r"\bautom[aá\?]tico\b", "automático"),
        (r"\bimplicaci[oó\?]n\b", "implicación"),
        (r"\bexpl[ií\?]citamente\b", "explícitamente"),
        (r"\bt[eé\?]cnico\b", "técnico"),
        (r"\bt[eé\?]cnicas\b", "técnicas"),
        (r"\bestrat[eé\?]gica\b", "estratégica"),
        (r"\bactualizaci[oó\?]n\b", "actualización"),
        (r"\bvalidaci[oó\?]n\b", "validación"),
        (r"\bgeneraci[oó\?]n\b", "generación"),
        (r"\bfabricaci[oó\?]n\b", "fabricación"),
        (r"\bpriorizaci[oó\?]n\b", "priorización"),
        (r"\bvaloraci[oó\?]n\b", "valoración"),
        (r"\bformaci[oó\?]n\b", "formación"),
        (r"\brenovaci[oó\?]n\b", "renovación"),
        (r"\bconversi[oó\?]n\b", "conversión"),
        (r"\bmedici[oó\?]n\b", "medición"),
        (r"\bversi[oó\?]n\b", "versión"),
        (r"\balmac[eé\?]n\b", "almacén"),
        (r"\blog[ií\?]stico\b", "logístico"),
        (r"\blog[ií\?]stica\b", "logística"),
        (r"\blog[ií\?]sticos\b", "logísticos"),
        (r"\blog[ií\?]sticas\b", "logísticas"),
        (r"\bv[aá\?]lida\b", "válida"),
        (r"\bcr[ií\?]tico\b", "crítico"),
        (r"\bcr[ií\?]tica\b", "crítica"),
        (r"\bcr[ií\?]ticos\b", "críticos"),
        (r"\bcr[ií\?]ticas\b", "críticas"),
        (r"\bs[oó\?]lida\b", "sólida"),
        (r"\bg[oó\?]mez\b", "gómez"),
    ]
)


class AuditDocxGenerationError(RuntimeError):
    pass


def _preserve_match_case(source: str, target: str) -> str:
    if source.isupper():
        return target.upper()
    if source[:1].isupper():
        return target.capitalize()
    return target


def _repair_mojibake(value: str) -> str:
    text = str(value or "")
    if not text:
        return ""
    candidate = text
    if any(marker in candidate for marker in _MOJIBAKE_MARKERS):
        for source_encoding in ("latin-1", "cp1252"):
            try:
                repaired = candidate.encode(source_encoding).decode("utf-8")
            except Exception:
                continue
            if repaired and repaired != candidate:
                candidate = repaired
                break
    candidate = (
        candidate.replace("â€™", "’")
        .replace("â€œ", "“")
        .replace("â€", "”")
        .replace("â€“", "–")
        .replace("â€”", "—")
        .replace("â€¦", "…")
        .replace("\xa0", " ")
    )
    return candidate


def _repair_lossy_iso_terms(value: str) -> str:
    text = str(value or "")
    if not text:
        return ""
    repaired = text
    for pattern, replacement in _LOSSY_ISO_TERM_FIXUPS:
        repaired = pattern.sub(
            lambda match, repl=replacement: _preserve_match_case(match.group(0), repl),
            repaired,
        )
    return repaired


def _normalize_export_text(value: Any) -> str:
    text = str(value or "")
    if not text:
        return ""
    repaired = _repair_mojibake(text)
    repaired = _repair_lossy_iso_terms(repaired)
    return unicodedata.normalize("NFC", repaired)


def _strip_rich_text(value: Any) -> str:
    raw = _normalize_export_text(value)
    if "<" not in raw or ">" not in raw:
        return raw

    normalized_breaks = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    normalized_breaks = re.sub(
        r"(?i)</(p|div|h1|h2|h3|h4|h5|h6|li|tr|blockquote)>",
        "\n",
        normalized_breaks,
    )
    stripped = re.sub(r"<[^>]+>", "", normalized_breaks)
    unescaped = _normalize_export_text(unescape(stripped))
    compacted = re.sub(r"[\t\f\v]+", " ", unescaped)
    compacted = re.sub(r"\r\n|\n{3,}", "\n\n", compacted)
    return compacted.strip()


def _to_display(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, (date, datetime)):
        return value.strftime("%d/%m/%Y")
    normalized = _strip_rich_text(value).strip()
    return normalized or "-"


def _short_text(value: Any, *, max_len: int = 140) -> str:
    normalized = re.sub(r"\s+", " ", _strip_rich_text(value))
    if not normalized:
        return "-"
    if len(normalized) <= max_len:
        return normalized
    return f"{normalized[: max_len - 3].rstrip()}..."


def _normalize_text_for_match(value: str | None) -> str:
    normalized_value = _normalize_export_text(value)
    collapsed = re.sub(r"\s+", " ", normalized_value.strip().lower())
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


def _pick_narrative_variant(
    variants: Sequence[str],
    *,
    key: str,
    seed: str | None = None,
    usage_counter: dict[str, int] | None = None,
) -> str:
    if not variants:
        return ""
    if usage_counter is not None:
        current = usage_counter.get(key, 0)
        usage_counter[key] = current + 1
        return str(variants[current % len(variants)])
    if seed:
        index = sum(ord(char) for char in seed) % len(variants)
        return str(variants[index])
    return str(variants[0])


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
        "item_code": _normalize_export_text(item.item_code),
        "item_label": _normalize_export_text(item.item_label),
        "value_text": _normalize_export_text(item.value_text),
        "value_json": item.value_json,
    }
    return json.dumps(payload, ensure_ascii=False)


def _serialize_clause_for_prompt(clause: AuditReportClauseCheck) -> str:
    payload: dict[str, Any] = {
        "clause_code": _normalize_export_text(clause.clause_code),
        "clause_title": _normalize_export_text(clause.clause_title),
        "applicable": clause.applicable,
        "status": clause.clause_status,
        "evidence_summary": _normalize_export_text(clause.evidence_summary),
        "observation_text": _normalize_export_text(clause.observation_text),
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
    allowed_references_payload = ", ".join(allowed_references) if allowed_references else "Sin códigos"
    root = _normalize_section_root(section_code)
    section_specific_instructions: list[str] = []
    if root == "4":
        section_specific_instructions.append(
            "En sección 4, verificar explícitamente si hay evidencia sobre cambio climático (4.1 y 4.2). "
            "Si no hay evidencia suficiente, indicarlo sin inferencias."
        )
    if root == "5":
        section_specific_instructions.extend(
            [
                "Sección 5: cubrir liderazgo, enfoque al cliente, política de calidad y roles/responsabilidades.",
                "Si hay no conformidades en checks, menciónalas de forma explícita con cláusula afectada.",
                "Cuando exista evidencia de s5_objective_evidence, intégrala de forma concreta en el análisis.",
            ]
        )
    instructions_block = [
        "Redacta como auditor ISO 9001 senior, con tono ejecutivo, técnico y natural.",
        "Evita redacción robótica y fórmulas repetitivas; usa variación lingüística profesional.",
        "No inventes hechos, fechas, códigos, documentos, responsables ni resultados.",
        "No uses información externa: limita el análisis al payload suministrado.",
        "Si falta evidencia, indícalo de forma explícita con lenguaje auditor.",
        "Redacta en tercera persona, sin saludos ni conclusiones genéricas.",
    ]
    instructions_block.extend(section_specific_instructions)

    format_block = [
        "Devuelve SOLO estos 5 bloques y en este orden exacto, sin markdown:",
        "Evidencias observadas: ...",
        "Desviaciones y carencias: ...",
        "Conclusión de cumplimiento: ...",
        "Riesgo para el sistema: ...",
        "Acción recomendada: ...",
        "Cada bloque debe contener entre 1 y 3 frases concretas, auditables y trazables a la evidencia.",
        "Si citas referencias, utiliza únicamente las referencias permitidas.",
    ]

    return (
        "[INSTRUCCIONES]\n"
        + "\n".join(f"- {line}" for line in instructions_block)
        + "\n\n[FORMATO DE SALIDA OBLIGATORIO]\n"
        + "\n".join(f"- {line}" for line in format_block)
        + "\n\n[PAYLOAD DE EVIDENCIA]\n"
        + f"Empresa: {company_name}\n"
        + f"Sección: {section_code} - {section_title}\n"
        + f"Puntos de norma: {points_payload}\n"
        + f"Contexto ISO del proyecto: {(project_context or 'Sin contexto complementario.').strip()}\n"
        + f"Referencias permitidas: {allowed_references_payload}\n"
        + "Items (JSON por línea):\n"
        + f"{items_payload}\n"
        + "Checks (JSON por línea):\n"
        + f"{checks_payload}\n"
        + f"Notas del auditor: {notes_payload}"
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


def _is_compliant_status(raw_status: str | None) -> bool:
    normalized = (raw_status or "").strip().lower()
    return normalized in {"compliant", "cumple", "conforme", "ok", "passed"}


def _is_partial_status(raw_status: str | None) -> bool:
    normalized = (raw_status or "").strip().lower()
    return normalized in {"partial", "partially", "parcial"}


def _is_in_progress_status(raw_status: str | None) -> bool:
    normalized = (raw_status or "").strip().lower()
    return normalized in {
        "in_progress",
        "en_progreso",
        "en progreso",
        "sin_evaluar",
        "sin evaluar",
        "no_evaluado",
        "no evaluado",
    }


def _is_not_applicable_status(raw_status: str | None) -> bool:
    normalized = (raw_status or "").strip().lower()
    return normalized in {
        "not_applicable",
        "not applicable",
        "no_aplica",
        "no aplica",
        "na",
        "n/a",
    }


def _is_clause_check_applicable(check: AuditReportClauseCheck) -> bool:
    if not check.applicable:
        return False
    return not _is_not_applicable_status(check.clause_status)


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
    phrase_usage: dict[str, int] | None = None,
) -> str:
    variation_counter = phrase_usage if phrase_usage is not None else None
    applicable_checks = [check for check in checks if _is_clause_check_applicable(check)]
    not_applicable_checks = [check for check in checks if not _is_clause_check_applicable(check)]
    noncompliant = [check for check in applicable_checks if _is_noncompliant_status(check.clause_status)]
    partial = [check for check in applicable_checks if _is_partial_status(check.clause_status)]
    in_progress = [check for check in applicable_checks if _is_in_progress_status(check.clause_status)]
    compliant = [check for check in applicable_checks if _is_compliant_status(check.clause_status)]
    evaluated_checks_count = len(noncompliant) + len(partial) + len(compliant)
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
    for check in noncompliant + partial + in_progress:
        clause_ref = _short_text(check.clause_code or check.clause_title or "cláusula", max_len=24)
        finding_text = _short_text(
            check.observation_text or check.evidence_summary or "sin detalle adicional registrado",
            max_len=80,
        )
        gap_samples.append(f"{clause_ref}: {finding_text}")
        if len(gap_samples) >= 3:
            break

    evidence_intro = _pick_narrative_variant(
        _SECTION_FALLBACK_VARIANTS["evidence_intro"],
        key="fallback.evidence_intro",
        seed=f"evidence-{section.section_code}",
        usage_counter=variation_counter,
    )
    evidence_sample = "; ".join(evidence_samples)
    if not evidence_sample:
        evidence_sample = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["no_evidence_sample"],
            key="fallback.no_evidence_sample",
            seed=f"no-evidence-{section.section_code}",
            usage_counter=variation_counter,
        )
    evidence_text = (
        f"{evidence_intro} "
        f"Sección {section.section_code} ({_short_text(section.title, max_len=48)}). "
        f"Checks que aplican: {len(applicable_checks)}. "
        f"Evaluados: {evaluated_checks_count}. "
        f"Sin evaluar: {len(in_progress)}. "
        f"No aplica: {len(not_applicable_checks)}. "
        f"Campos con evidencia capturada: {len(evidenced_items)}. "
        f"Muestra de evidencia: {evidence_sample}."
    )
    if _has_text(project_context):
        evidence_text = f"{evidence_text} Contexto ISO complementario: {_short_text(project_context, max_len=140)}."

    if noncompliant or partial or in_progress:
        gap_intro = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["gaps_intro"],
            key="fallback.gaps_intro",
            seed=f"gaps-{section.section_code}",
            usage_counter=variation_counter,
        )
        gaps_text = (
            f"{gap_intro} "
            f"No conformidades detectadas: {len(noncompliant)}. "
            f"Desviaciones parciales: {len(partial)}. "
            f"Checks sin evaluar: {len(in_progress)}. "
            f"Muestra: {'; '.join(gap_samples) if gap_samples else 'sin detalle adicional'}."
        )
    else:
        gaps_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["gaps_none"],
            key="fallback.gaps_none",
            seed=f"gaps-none-{section.section_code}",
            usage_counter=variation_counter,
        )
        if len(applicable_checks) == 0:
            gaps_text = _pick_narrative_variant(
                _SECTION_FALLBACK_VARIANTS["gaps_not_applicable"],
                key="fallback.gaps.not_applicable",
                seed=f"gaps-na-{section.section_code}",
                usage_counter=variation_counter,
            )

    if len(applicable_checks) == 0:
        conclusion_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["conclusion"]["no_applicable"],
            key="fallback.conclusion.no_applicable",
            seed=f"conclusion-na-{section.section_code}",
            usage_counter=variation_counter,
        )
    elif noncompliant:
        conclusion_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["conclusion"]["non_compliant"],
            key="fallback.conclusion.non_compliant",
            seed=f"conclusion-nc-{section.section_code}",
            usage_counter=variation_counter,
        )
    elif partial:
        conclusion_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["conclusion"]["partial"],
            key="fallback.conclusion.partial",
            seed=f"conclusion-partial-{section.section_code}",
            usage_counter=variation_counter,
        )
    elif in_progress:
        conclusion_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["conclusion"]["in_progress"],
            key="fallback.conclusion.in_progress",
            seed=f"conclusion-progress-{section.section_code}",
            usage_counter=variation_counter,
        )
    else:
        conclusion_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["conclusion"]["compliant"],
            key="fallback.conclusion.compliant",
            seed=f"conclusion-ok-{section.section_code}",
            usage_counter=variation_counter,
        )

    if noncompliant or len(evidenced_items) == 0:
        risk_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["risk"]["non_compliant_or_no_evidence"],
            key="fallback.risk.non_compliant_or_no_evidence",
            seed=f"risk-high-{section.section_code}",
            usage_counter=variation_counter,
        )
    elif partial:
        risk_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["risk"]["partial"],
            key="fallback.risk.partial",
            seed=f"risk-partial-{section.section_code}",
            usage_counter=variation_counter,
        )
    elif in_progress:
        risk_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["risk"]["in_progress"],
            key="fallback.risk.in_progress",
            seed=f"risk-progress-{section.section_code}",
            usage_counter=variation_counter,
        )
    else:
        risk_text = _pick_narrative_variant(
            _SECTION_FALLBACK_VARIANTS["risk"]["compliant"],
            key="fallback.risk.compliant",
            seed=f"risk-ok-{section.section_code}",
            usage_counter=variation_counter,
        )

    action_text = _pick_narrative_variant(
        _SECTION_FALLBACK_VARIANTS["action"],
        key="fallback.action",
        seed=f"action-{section.section_code}",
        usage_counter=variation_counter,
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
    phrase_usage: dict[str, int] | None = None,
) -> str:
    return _build_structured_narrative_from_evidence(
        section=section,
        checks=checks,
        items=items,
        project_context=project_context,
        phrase_usage=phrase_usage,
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
        notes.append("Falta fecha de realización de auditoría.")
    if not _has_text(report.system_scope):
        notes.append("Falta alcance del sistema.")
    if not _has_text(report.tipo_auditoria):
        notes.append("Falta tipo de auditoría en cabecera.")
    if not _has_text(report.modalidad):
        notes.append("Falta modalidad de auditoría en cabecera.")
    if not _has_text(report.quality_responsible_name):
        notes.append("Falta responsable del sistema en cabecera.")
    if len(interviewees) == 0:
        notes.append("No hay personal entrevistado registrado.")
    if len(recommendations) == 0:
        notes.append("No hay recomendaciones/hallazgos registrados en resultados.")

    items_by_section: dict[str, int] = defaultdict(int)
    for item in items:
        if _has_text(item.value_text) or item.value_json not in (None, {}, []):
            items_by_section[item.section_code] += 1

    applicable_checks_by_section: dict[str, int] = defaultdict(int)
    for check in clause_checks:
        if _is_clause_check_applicable(check):
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
            notes.append(f"Sección {section.section_code}: sin narrativa registrada.")
        if items_by_section.get(section.section_code, 0) == 0:
            notes.append(f"Sección {section.section_code}: sin datos de campos guiados con evidencia.")
        if applicable_checks_by_section.get(section.section_code, 0) == 0:
            notes.append(f"Sección {section.section_code}: sin checks de cláusula aplicables.")

    return notes


def extract_critical_integrity_notes(notes: Sequence[str]) -> list[str]:
    critical_prefixes = (
        "Falta entidad auditada en cabecera.",
        "Falta fecha de realización de auditoría.",
        "Falta alcance del sistema.",
        "Falta tipo de auditoría en cabecera.",
        "Falta modalidad de auditoría en cabecera.",
        "Falta responsable del sistema en cabecera.",
        "No hay personal entrevistado registrado.",
    )
    critical: list[str] = []
    for note in notes:
        if note.startswith(critical_prefixes):
            critical.append(note)
            continue
        if note.startswith("Sección ") and (
            "sin datos de campos guiados con evidencia" in note
            or "sin checks de cláusula aplicables" in note
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
    fallback_phrase_usage: dict[str, int] = defaultdict(int)
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
                phrase_usage=fallback_phrase_usage,
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
                    "Narrativa IA no válida para sección %s; se usa fallback estructurado.",
                    section.section_code,
                )
                narratives[section.section_code] = _build_fallback_section_narrative(
                    section=section,
                    checks=section_checks,
                    items=section_items,
                    project_context=project_context,
                    phrase_usage=fallback_phrase_usage,
                )
        except Exception:
            logger.exception(
                "Fallo de generación IA para sección %s; se usa fallback de evidencia.",
                section.section_code,
            )
            narratives[section.section_code] = _build_fallback_section_narrative(
                section=section,
                checks=section_checks,
                items=section_items,
                project_context=project_context,
                phrase_usage=fallback_phrase_usage,
            )

    return narratives


def _status_to_followup_label(raw_status: str | None) -> str:
    normalized = (raw_status or "").strip().lower()
    if normalized in {"completed", "compliant", "cumplida", "closed", "cerrada"}:
        return "cumplida"
    if normalized in {"partial", "partially", "parcial"}:
        return "parcialmente"
    if normalized in {"in_progress", "en_progreso", "en progreso"}:
        return "en curso"
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
        marker = "X" if check and _is_clause_check_applicable(check) else ""
        rows.append((title, reference_standard, default_code, marker))

    extra_checks = list(checks_by_code.values())
    extra_checks.sort(key=lambda row: (row.sort_order or 0, row.clause_code))
    for check in extra_checks:
        rows.append(
            (
                check.clause_title or "-",
                reference_standard,
                check.clause_code or "-",
                "X" if _is_clause_check_applicable(check) else "",
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


_DOCX_TOOLKIT: dict[str, Any] | None = None


def _get_docx_toolkit() -> dict[str, Any]:
    global _DOCX_TOOLKIT
    if _DOCX_TOOLKIT is not None:
        return _DOCX_TOOLKIT
    try:
        shared = import_module("docx.shared")
        enum_text = import_module("docx.enum.text")
        enum_table = import_module("docx.enum.table")
        oxml = import_module("docx.oxml")
        oxml_ns = import_module("docx.oxml.ns")
        oxml_shape = import_module("docx.oxml.shape")
        oxml_xmlchemy = import_module("docx.oxml.xmlchemy")
        _DOCX_TOOLKIT = {
            "Pt": getattr(shared, "Pt", None),
            "RGBColor": getattr(shared, "RGBColor", None),
            "WD_ALIGN_PARAGRAPH": getattr(enum_text, "WD_ALIGN_PARAGRAPH", None),
            "WD_TABLE_ALIGNMENT": getattr(enum_table, "WD_TABLE_ALIGNMENT", None),
            "OxmlElement": getattr(oxml, "OxmlElement", None),
            "parse_xml": getattr(oxml, "parse_xml", None),
            "register_element_cls": getattr(oxml, "register_element_cls", None),
            "qn": getattr(oxml_ns, "qn", None),
            "nsdecls": getattr(oxml_ns, "nsdecls", None),
            "CT_Picture": getattr(oxml_shape, "CT_Picture", None),
            "BaseOxmlElement": getattr(oxml_xmlchemy, "BaseOxmlElement", None),
            "OneAndOnlyOne": getattr(oxml_xmlchemy, "OneAndOnlyOne", None),
        }
    except Exception:
        _DOCX_TOOLKIT = {}
    return _DOCX_TOOLKIT


def _pt(value: float) -> Any:
    toolkit = _get_docx_toolkit()
    Pt = toolkit.get("Pt")
    return Pt(value) if Pt is not None else None


def _rgb_from_hex(color_hex: str) -> Any:
    toolkit = _get_docx_toolkit()
    RGBColor = toolkit.get("RGBColor")
    if RGBColor is None:
        return None
    normalized = (color_hex or "").strip().lstrip("#")
    if len(normalized) != 6:
        return None
    try:
        return RGBColor(
            int(normalized[0:2], 16),
            int(normalized[2:4], 16),
            int(normalized[4:6], 16),
        )
    except Exception:
        return None


def _set_cell_shading(cell: Any, fill_hex: str) -> None:
    toolkit = _get_docx_toolkit()
    OxmlElement = toolkit.get("OxmlElement")
    qn = toolkit.get("qn")
    if OxmlElement is None or qn is None or not fill_hex:
        return
    try:
        tc_pr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), fill_hex.strip().lstrip("#"))
        tc_pr.append(shd)
    except Exception:
        return


def _set_table_borders(table: Any, *, color_hex: str = "D1D9E6", size: str = "6") -> None:
    toolkit = _get_docx_toolkit()
    OxmlElement = toolkit.get("OxmlElement")
    qn = toolkit.get("qn")
    if OxmlElement is None or qn is None:
        return
    try:
        tbl_pr = table._tbl.tblPr
        if tbl_pr is None:
            return
        tbl_borders = tbl_pr.find(qn("w:tblBorders"))
        if tbl_borders is None:
            tbl_borders = OxmlElement("w:tblBorders")
            tbl_pr.append(tbl_borders)
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            border = tbl_borders.find(qn(f"w:{edge}"))
            if border is None:
                border = OxmlElement(f"w:{edge}")
                tbl_borders.append(border)
            border.set(qn("w:val"), "single")
            border.set(qn("w:sz"), size)
            border.set(qn("w:color"), color_hex.strip().lstrip("#"))
            border.set(qn("w:space"), "0")
    except Exception:
        return


def _append_word_field(
    paragraph: Any,
    *,
    field_code: str,
    fallback_text: str,
    size_pt: float = 8.4,
    color_hex: str = "64748B",
) -> None:
    toolkit = _get_docx_toolkit()
    OxmlElement = toolkit.get("OxmlElement")
    qn = toolkit.get("qn")
    if OxmlElement is None or qn is None:
        fallback_run = paragraph.add_run(fallback_text)
        _style_run(fallback_run, size_pt=size_pt, color_hex=color_hex)
        return
    try:
        field_run = paragraph.add_run()
        fld_begin = OxmlElement("w:fldChar")
        fld_begin.set(qn("w:fldCharType"), "begin")

        instr = OxmlElement("w:instrText")
        instr.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        instr.text = f" {field_code.strip()} "

        fld_separate = OxmlElement("w:fldChar")
        fld_separate.set(qn("w:fldCharType"), "separate")
        fld_text = OxmlElement("w:t")
        fld_text.text = fallback_text

        fld_end = OxmlElement("w:fldChar")
        fld_end.set(qn("w:fldCharType"), "end")

        field_run._r.append(fld_begin)
        field_run._r.append(instr)
        field_run._r.append(fld_separate)
        field_run._r.append(fld_text)
        field_run._r.append(fld_end)
        _style_run(field_run, size_pt=size_pt, color_hex=color_hex)
    except Exception:
        fallback_run = paragraph.add_run(fallback_text)
        _style_run(fallback_run, size_pt=size_pt, color_hex=color_hex)


def _backend_root_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve_watermark_logo_path() -> Path | None:
    raw_env = (os.getenv(WATERMARK_LOGO_ENV_VAR) or "").strip()
    candidates: list[Path] = []
    if raw_env:
        env_path = Path(raw_env).expanduser()
        if not env_path.is_absolute():
            env_path = _backend_root_dir() / env_path
        candidates.append(env_path)
    candidates.append(_backend_root_dir() / WATERMARK_DEFAULT_RELATIVE_PATH)

    for candidate in candidates:
        try:
            if candidate.is_file():
                return candidate
        except Exception:
            continue
    return None


def _watermark_active_for_visuals() -> bool:
    if not WATERMARK_MINIMAL_SURFACES_MODE:
        return False
    return _resolve_watermark_logo_path() is not None


def _register_watermark_anchor_class() -> bool:
    global _WATERMARK_ANCHOR_REGISTERED
    if _WATERMARK_ANCHOR_REGISTERED:
        return True

    toolkit = _get_docx_toolkit()
    parse_xml = toolkit.get("parse_xml")
    register_element_cls = toolkit.get("register_element_cls")
    nsdecls = toolkit.get("nsdecls")
    CT_Picture = toolkit.get("CT_Picture")
    BaseOxmlElement = toolkit.get("BaseOxmlElement")
    OneAndOnlyOne = toolkit.get("OneAndOnlyOne")
    if not all([parse_xml, register_element_cls, nsdecls, CT_Picture, BaseOxmlElement, OneAndOnlyOne]):
        return False

    class CT_Anchor(BaseOxmlElement):  # type: ignore[misc]
        extent = OneAndOnlyOne("wp:extent")
        docPr = OneAndOnlyOne("wp:docPr")
        graphic = OneAndOnlyOne("a:graphic")

        @classmethod
        def new(cls, cx: int, cy: int, shape_id: int, pic: Any, pos_x: int, pos_y: int) -> Any:
            anchor = parse_xml(cls._anchor_xml(pos_x, pos_y))
            anchor.extent.cx = cx
            anchor.extent.cy = cy
            anchor.docPr.id = shape_id
            anchor.docPr.name = f"Watermark {shape_id}"
            anchor.graphic.graphicData.uri = "http://schemas.openxmlformats.org/drawingml/2006/picture"
            anchor.graphic.graphicData._insert_pic(pic)
            return anchor

        @classmethod
        def new_pic_anchor(
            cls,
            shape_id: int,
            r_id: str,
            filename: str,
            cx: int,
            cy: int,
            pos_x: int,
            pos_y: int,
        ) -> Any:
            pic_id = 0
            pic = CT_Picture.new(pic_id, filename, r_id, cx, cy)
            _apply_watermark_blip_effect(
                pic,
                alpha_amt=WATERMARK_ALPHA_AMT,
                grayscale=WATERMARK_USE_GRAYSCALE,
            )
            return cls.new(cx, cy, shape_id, pic, pos_x, pos_y)

        @classmethod
        def _anchor_xml(cls, pos_x: int, pos_y: int) -> str:
            return (
                '<wp:anchor distT="0" distB="0" distL="0" distR="0" '
                'simplePos="0" relativeHeight="251659264" behindDoc="1" locked="0" '
                'layoutInCell="1" allowOverlap="1" %s>'
                '  <wp:simplePos x="0" y="0"/>'
                '  <wp:positionH relativeFrom="page"><wp:posOffset>%d</wp:posOffset></wp:positionH>'
                '  <wp:positionV relativeFrom="page"><wp:posOffset>%d</wp:posOffset></wp:positionV>'
                '  <wp:extent cx="0" cy="0"/>'
                '  <wp:effectExtent l="0" t="0" r="0" b="0"/>'
                '  <wp:wrapNone/>'
                '  <wp:docPr id="1" name="Watermark"/>'
                '  <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
                '  <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"/>'
                "  </a:graphic>"
                "</wp:anchor>"
                % (nsdecls("wp", "a", "pic", "r"), int(pos_x), int(pos_y))
            )

    register_element_cls("wp:anchor", CT_Anchor)
    toolkit["CT_Anchor"] = CT_Anchor
    _WATERMARK_ANCHOR_REGISTERED = True
    return True


def _apply_watermark_blip_effect(
    pic: Any,
    *,
    alpha_amt: int = 9000,
    grayscale: bool = True,
) -> None:
    toolkit = _get_docx_toolkit()
    OxmlElement = toolkit.get("OxmlElement")
    if OxmlElement is None:
        return
    try:
        blips = pic.xpath(".//a:blip")
        if not blips:
            return
        blip = blips[0]
        for child in list(blip):
            local_name = str(child.tag).rsplit("}", 1)[-1]
            if local_name in {"alphaModFix", "grayscl"}:
                blip.remove(child)
        if grayscale:
            blip.append(OxmlElement("a:grayscl"))
        alpha_node = OxmlElement("a:alphaModFix")
        alpha_value = max(1000, min(100000, int(alpha_amt)))
        alpha_node.set("amt", str(alpha_value))
        blip.append(alpha_node)
    except Exception:
        return


def _apply_watermark_rotation(pic: Any, *, rotation_degrees: float) -> None:
    try:
        xfrm_nodes = pic.xpath(".//pic:spPr/a:xfrm")
        if not xfrm_nodes:
            return
        # DrawingML rotation uses 1/60000 degree units.
        rot_units = int(rotation_degrees * 60000)
        xfrm_nodes[0].set("rot", str(rot_units))
    except Exception:
        return


def _add_float_picture(
    paragraph: Any,
    image_path: Path,
    *,
    width_emu: int,
    pos_x_emu: int,
    pos_y_emu: int,
) -> bool:
    toolkit = _get_docx_toolkit()
    CT_Anchor = toolkit.get("CT_Anchor")
    if CT_Anchor is None:
        return False
    try:
        run = paragraph.add_run()
        r_id, image = run.part.get_or_add_image(str(image_path))
        cx, cy = image.scaled_dimensions(width_emu, None)
        shape_id, filename = run.part.next_id, image.filename
        anchor = CT_Anchor.new_pic_anchor(shape_id, r_id, filename, int(cx), int(cy), int(pos_x_emu), int(pos_y_emu))
        pic_nodes = anchor.xpath(".//pic:pic")
        if pic_nodes:
            _apply_watermark_rotation(pic_nodes[0], rotation_degrees=WATERMARK_ROTATION_DEGREES)
        run._r.add_drawing(anchor)
        return True
    except Exception:
        return False


def _add_logo_watermark(document: Any) -> None:
    logo_path = _resolve_watermark_logo_path()
    if logo_path is None:
        logger.info(
            "Marca de agua DOCX desactivada: no se encontró logo en %s (ni en variable %s).",
            str(_backend_root_dir() / WATERMARK_DEFAULT_RELATIVE_PATH),
            WATERMARK_LOGO_ENV_VAR,
        )
        return
    if not _register_watermark_anchor_class():
        logger.warning("No se pudo registrar soporte de anclaje DOCX para marca de agua.")
        return

    seen_header_elements: set[int] = set()
    for section in document.sections:
        page_width = int(section.page_width or 0)
        page_height = int(section.page_height or 0)
        if page_width <= 0 or page_height <= 0:
            continue
        target_width = int(page_width * 0.78)
        pos_x = int((page_width - target_width) / 2)
        pos_y = int(page_height * 0.18)

        headers: list[Any] = [section.header]
        try:
            headers.append(section.first_page_header)
            headers.append(section.even_page_header)
        except Exception:
            pass

        for header in headers:
            header_id = id(getattr(header, "_element", header))
            if header_id in seen_header_elements:
                continue
            seen_header_elements.add(header_id)
            try:
                header.is_linked_to_previous = False
            except Exception:
                pass
            for existing_paragraph in list(getattr(header, "paragraphs", [])):
                _clear_paragraph(existing_paragraph)
            paragraph = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
            _clear_paragraph(paragraph)
            _style_paragraph(paragraph, before_pt=0, after_pt=0, line_spacing=1.0)
            if not _add_float_picture(
                paragraph,
                logo_path,
                width_emu=target_width,
                pos_x_emu=pos_x,
                pos_y_emu=pos_y,
            ):
                logger.warning("No se pudo insertar marca de agua con logo en cabecera.")


def _add_footer_branding(document: Any) -> None:
    align_enum = _get_docx_toolkit().get("WD_ALIGN_PARAGRAPH")
    for section in document.sections:
        footer = section.footer
        footer.is_linked_to_previous = False
        paragraph = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        _clear_paragraph(paragraph)
        left_run = paragraph.add_run("Informe ISO 9001:2015 · Uso controlado  |  Página ")
        _style_run(left_run, size_pt=8.4, color_hex="64748B")
        _append_word_field(paragraph, field_code="PAGE", fallback_text="1")
        total_prefix = paragraph.add_run(" de ")
        _style_run(total_prefix, size_pt=8.4, color_hex="64748B")
        _append_word_field(paragraph, field_code="NUMPAGES", fallback_text="1")
        if align_enum is not None:
            paragraph.alignment = align_enum.CENTER
        _style_paragraph(paragraph, before_pt=0, after_pt=0, line_spacing=1.0)
        footer_gap = _pt(24)
        if footer_gap is not None:
            section.footer_distance = footer_gap


def _clear_paragraph(paragraph: Any) -> None:
    if hasattr(paragraph, "clear"):
        try:
            paragraph.clear()
            return
        except Exception:
            pass
    element = getattr(paragraph, "_p", None)
    if element is None:
        return
    for child in list(element):
        element.remove(child)


def _style_run(
    run: Any,
    *,
    bold: bool | None = None,
    size_pt: float | None = None,
    color_hex: str | None = None,
) -> None:
    if bold is not None:
        run.bold = bold
    if size_pt is not None:
        pt_value = _pt(size_pt)
        if pt_value is not None:
            run.font.size = pt_value
    if color_hex:
        rgb = _rgb_from_hex(color_hex)
        if rgb is not None:
            run.font.color.rgb = rgb


def _style_font(
    font: Any,
    *,
    bold: bool | None = None,
    size_pt: float | None = None,
    color_hex: str | None = None,
) -> None:
    if bold is not None:
        font.bold = bold
    if size_pt is not None:
        pt_value = _pt(size_pt)
        if pt_value is not None:
            font.size = pt_value
    if color_hex:
        rgb = _rgb_from_hex(color_hex)
        if rgb is not None:
            font.color.rgb = rgb


def _style_paragraph(
    paragraph: Any,
    *,
    before_pt: float = 0,
    after_pt: float = 6,
    line_spacing: float = 1.2,
    alignment: str | None = None,
) -> None:
    fmt = paragraph.paragraph_format
    before_value = _pt(before_pt)
    after_value = _pt(after_pt)
    if before_value is not None:
        fmt.space_before = before_value
    if after_value is not None:
        fmt.space_after = after_value
    fmt.line_spacing = line_spacing
    if alignment:
        align_enum = _get_docx_toolkit().get("WD_ALIGN_PARAGRAPH")
        if align_enum is not None:
            if alignment == "center":
                paragraph.alignment = align_enum.CENTER
            elif alignment == "right":
                paragraph.alignment = align_enum.RIGHT
            else:
                paragraph.alignment = align_enum.LEFT


def _apply_base_document_theme(document: Any) -> None:
    normal_style = document.styles["Normal"]
    normal_style.font.name = "Calibri"
    pt_value = _pt(10.5)
    if pt_value is not None:
        normal_style.font.size = pt_value

    heading1 = document.styles["Heading 1"]
    heading1.font.name = "Calibri"
    _style_font(heading1.font, bold=True, size_pt=16, color_hex="0F172A")

    heading2 = document.styles["Heading 2"]
    heading2.font.name = "Calibri"
    _style_font(heading2.font, bold=True, size_pt=13, color_hex="1E3A5F")

    heading3 = document.styles["Heading 3"]
    heading3.font.name = "Calibri"
    _style_font(heading3.font, bold=True, size_pt=11, color_hex="334155")

    for section in document.sections:
        margin = _pt(42)
        if margin is not None:
            section.top_margin = margin
            section.bottom_margin = margin
            section.left_margin = margin
            section.right_margin = margin
    _add_logo_watermark(document)
    _add_footer_branding(document)


def _add_visual_divider(document: Any, *, color_hex: str = "CBD5E1") -> None:
    table = document.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    align_enum = _get_docx_toolkit().get("WD_TABLE_ALIGNMENT")
    if align_enum is not None:
        table.alignment = align_enum.LEFT
    cell = table.rows[0].cells[0]
    _set_cell_shading(cell, color_hex)
    cell.text = ""


def _format_table_visual(
    table: Any,
    *,
    header_fill: str = "E9EFF7",
    zebra_fill: str = "FBFCFE",
    align: str = "left",
) -> None:
    minimal_surfaces = _watermark_active_for_visuals()
    table.style = "Table Grid"
    align_enum = _get_docx_toolkit().get("WD_TABLE_ALIGNMENT")
    if align_enum is not None:
        table.alignment = align_enum.LEFT if align == "left" else align_enum.CENTER
    _set_table_borders(table, color_hex="CBD5E1", size="3")

    for row_index, row in enumerate(table.rows):
        for cell in row.cells:
            if row_index == 0:
                if not minimal_surfaces:
                    _set_cell_shading(cell, header_fill)
                for paragraph in cell.paragraphs:
                    _style_paragraph(paragraph, before_pt=0, after_pt=3.0, line_spacing=1.14)
                    for run in paragraph.runs:
                        _style_run(run, bold=True, size_pt=9.5, color_hex="0F172A")
            else:
                if row_index % 2 == 0 and not minimal_surfaces:
                    _set_cell_shading(cell, zebra_fill)
                for paragraph in cell.paragraphs:
                    _style_paragraph(paragraph, before_pt=0, after_pt=2.8, line_spacing=1.14)
                    for run in paragraph.runs:
                        _style_run(run, size_pt=9.4, color_hex="1F2937")


def add_section_heading(document: Any, title: str) -> None:
    paragraph = document.add_paragraph()
    run = paragraph.add_run((title or "").strip())
    _style_run(run, bold=True, size_pt=14, color_hex="0F172A")
    _style_paragraph(paragraph, before_pt=8, after_pt=4, line_spacing=1.15)
    _add_visual_divider(document, color_hex="BFDBFE")


def add_subsection_heading(document: Any, title: str) -> None:
    paragraph = document.add_paragraph()
    run = paragraph.add_run((title or "").strip())
    _style_run(run, bold=True, size_pt=11.5, color_hex="1E3A5F")
    _style_paragraph(paragraph, before_pt=6, after_pt=3, line_spacing=1.1)


def _resolve_clause_status_key(check: AuditReportClauseCheck) -> str:
    if not check.applicable or _is_not_applicable_status(check.clause_status):
        return "not_applicable"
    if _is_noncompliant_status(check.clause_status):
        return "non_compliant"
    if _is_partial_status(check.clause_status):
        return "partial"
    if _is_compliant_status(check.clause_status):
        return "compliant"
    if _is_in_progress_status(check.clause_status):
        return "in_progress"
    return "in_progress"


def _status_key_to_label(status_key: str) -> str:
    return CLAUSE_STATUS_DISPLAY.get(status_key, CLAUSE_STATUS_DISPLAY["in_progress"])["label"]


def add_status_badge(paragraph: Any, status_key: str) -> None:
    display = CLAUSE_STATUS_DISPLAY.get(status_key, CLAUSE_STATUS_DISPLAY["in_progress"])
    badge_text = f" {display['icon']} {display['label']} "
    run = paragraph.add_run(badge_text)
    _style_run(run, bold=True, size_pt=9.2, color_hex=display["color"])


def add_info_card(
    document: Any,
    *,
    title: str,
    lines: Sequence[str],
    status_key: str | None = None,
    fill_hex: str = "F8FAFC",
    border_hex: str = "D7E0EB",
) -> None:
    minimal_surfaces = _watermark_active_for_visuals()
    table = document.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    _set_table_borders(table, color_hex=border_hex, size="3")
    cell = table.rows[0].cells[0]
    if fill_hex and not minimal_surfaces:
        _set_cell_shading(cell, fill_hex)

    heading = cell.paragraphs[0]
    _clear_paragraph(heading)
    heading_run = heading.add_run(title.strip())
    _style_run(heading_run, bold=True, size_pt=10.4, color_hex="0F172A")
    if status_key:
        heading.add_run(" ·")
        add_status_badge(heading, status_key)
    _style_paragraph(heading, before_pt=0, after_pt=2.6, line_spacing=1.07)

    for line in lines:
        if not _has_text(line):
            continue
        p = cell.add_paragraph(f"• {_to_display(line)}")
        _style_paragraph(p, before_pt=0, after_pt=2.0, line_spacing=1.12)
        for run in p.runs:
            _style_run(run, size_pt=9.3, color_hex="1F2937")


def add_risk_box(
    document: Any,
    *,
    title: str,
    items: Sequence[str],
    severity: str = "warning",
) -> None:
    clean_items = [item for item in items if _has_text(item)]
    if not clean_items:
        return
    table = document.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    _set_table_borders(table, color_hex="D7C8CF", size="3")
    cell = table.rows[0].cells[0]
    signal = SIGNAL_STATE_DISPLAY.get(severity, SIGNAL_STATE_DISPLAY["warning"])
    if not _watermark_active_for_visuals():
        _set_cell_shading(cell, signal["fill"])
    heading = cell.paragraphs[0]
    _clear_paragraph(heading)
    run = heading.add_run(f"{signal['icon']} {title.strip()}")
    _style_run(run, bold=True, size_pt=10.1, color_hex=signal["color"])
    _style_paragraph(heading, before_pt=0, after_pt=2.6, line_spacing=1.07)
    for item in clean_items:
        p = cell.add_paragraph(f"• {_to_display(item)}")
        _style_paragraph(p, before_pt=0, after_pt=2.0, line_spacing=1.12)
        for line_run in p.runs:
            _style_run(line_run, size_pt=9.3, color_hex="1F2937")


def add_summary_table(
    document: Any,
    *,
    headers: Sequence[str],
    rows: Sequence[Sequence[str]],
    empty_text: str = "Sin datos disponibles.",
) -> None:
    if not rows:
        p = document.add_paragraph(empty_text)
        _style_paragraph(p, before_pt=0, after_pt=4.2, line_spacing=1.12)
        for run in p.runs:
            _style_run(run, size_pt=9.2, color_hex="475569")
        return
    table = document.add_table(rows=1, cols=len(headers))
    header_cells = table.rows[0].cells
    for index, header in enumerate(headers):
        header_cells[index].text = _to_display(header)
    for row in rows:
        row_cells = table.add_row().cells
        for index in range(len(headers)):
            row_cells[index].text = _to_display(row[index] if index < len(row) else "-")
    _format_table_visual(table)


def add_signal_row(document: Any, signals: Sequence[Mapping[str, str]]) -> None:
    clean_signals = [signal for signal in signals if _has_text(signal.get("label"))]
    if not clean_signals:
        return
    table = document.add_table(rows=1, cols=len(clean_signals))
    table.style = "Table Grid"
    _set_table_borders(table, color_hex="CED8E4", size="3")
    align_enum = _get_docx_toolkit().get("WD_TABLE_ALIGNMENT")
    if align_enum is not None:
        table.alignment = align_enum.CENTER

    for index, signal in enumerate(clean_signals):
        state = SIGNAL_STATE_DISPLAY.get(signal.get("status", "neutral"), SIGNAL_STATE_DISPLAY["neutral"])
        cell = table.rows[0].cells[index]
        if not _watermark_active_for_visuals():
            _set_cell_shading(cell, state["fill"])
        paragraph = cell.paragraphs[0]
        _clear_paragraph(paragraph)
        label_run = paragraph.add_run(_to_display(signal.get("label")))
        _style_run(label_run, bold=True, size_pt=9.2, color_hex="0F172A")
        _style_paragraph(paragraph, before_pt=0, after_pt=1.4, line_spacing=1.04)

        detail_paragraph = cell.add_paragraph()
        detail_run = detail_paragraph.add_run(
            f"{state['icon']} {_to_display(signal.get('value') or signal.get('detail') or 'Sin datos')}"
        )
        _style_run(detail_run, bold=True, size_pt=9.5, color_hex=state["color"])
        _style_paragraph(detail_paragraph, before_pt=0, after_pt=1.4, line_spacing=1.04)


def _to_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        normalized = str(value).strip().replace(",", ".")
        if not normalized:
            return None
        numeric = float(normalized)
        return numeric if numeric == numeric else None
    except Exception:
        return None


def _to_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    normalized = str(value or "").strip().lower()
    if normalized in {"true", "1", "yes", "si", "sí"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    return None


def _value_from_item(item: AuditReportItem | None) -> Any:
    if item is None:
        return None
    if item.value_json not in (None, {}, []):
        return item.value_json
    return item.value_text


def _map_items_by_section_and_code(items: Sequence[AuditReportItem]) -> dict[str, dict[str, AuditReportItem]]:
    mapped: dict[str, dict[str, AuditReportItem]] = defaultdict(dict)
    ordered_items = sorted(items, key=lambda row: (row.section_code, row.sort_order or 0, row.item_code))
    for item in ordered_items:
        mapped[item.section_code][item.item_code] = item
    return mapped


def _normalize_s10_actions(raw_value: Any) -> list[dict[str, str]]:
    if not isinstance(raw_value, list):
        return []
    rows: list[dict[str, str]] = []
    for row in raw_value:
        if not isinstance(row, Mapping):
            continue
        status_key = str(row.get("status") or "open").strip().lower()
        effectiveness_key = str(row.get("effectiveness") or "pending").strip().lower()
        type_key = str(row.get("type") or "nc_internal").strip().lower()
        recurrence_key = str(row.get("recurrence") or "").strip().lower()
        rows.append(
            {
                "type": S10_TYPE_LABELS.get(type_key, _to_display(row.get("type"))),
                "finding": _to_display(row.get("finding")),
                "root_cause": _to_display(row.get("root_cause")),
                "action": _to_display(row.get("action")),
                "owner": _to_display(row.get("owner")),
                "due_date": _to_display(row.get("due_date")),
                "status": S10_ACTION_STATUS_LABELS.get(status_key, _to_display(row.get("status"))),
                "status_key": status_key,
                "effectiveness": S10_EFFECTIVENESS_LABELS.get(effectiveness_key, _to_display(row.get("effectiveness"))),
                "effectiveness_key": effectiveness_key,
                "recurrence": "Sí" if recurrence_key == "yes" else "No" if recurrence_key == "no" else "Sin dato",
                "recurrence_key": recurrence_key,
                "notes": _to_display(row.get("notes")),
            }
        )
    return rows


def _section_10_risks(action_rows: Sequence[Mapping[str, str]]) -> list[str]:
    if not action_rows:
        return []
    risks: list[str] = []
    overdue = sum(1 for row in action_rows if row.get("status_key") == "overdue")
    without_owner = sum(1 for row in action_rows if not _has_text(row.get("owner")))
    without_due = sum(1 for row in action_rows if not _has_text(row.get("due_date")))
    recurrence = sum(1 for row in action_rows if row.get("recurrence_key") == "yes")
    ineffective = sum(1 for row in action_rows if row.get("effectiveness_key") == "ineffective")
    if overdue:
        risks.append(f"{overdue} acciones correctivas vencidas sin cierre efectivo.")
    if without_owner:
        risks.append(f"{without_owner} acciones sin responsable asignado.")
    if without_due:
        risks.append(f"{without_due} acciones sin fecha compromiso registrada.")
    if recurrence:
        risks.append(f"{recurrence} casos con reincidencia detectada.")
    if ineffective:
        risks.append(f"{ineffective} acciones marcadas como ineficaces.")
    return risks


def _has_tracking_data(values: Sequence[float | None]) -> bool:
    numeric_values = [value for value in values if value is not None]
    if not numeric_values:
        return False
    if all(value == 0 for value in numeric_values):
        return False
    return True


def _normalize_s9_kpi_rows(raw_value: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if isinstance(raw_value, list):
        for row in raw_value:
            if not isinstance(row, Mapping):
                continue
            q1 = _to_number(row.get("result"))
            target = _to_number(row.get("objective"))
            has_data = _has_tracking_data([q1])
            if not has_data:
                status = "no_data"
            elif target is None:
                status = "in_progress"
            else:
                status = "compliant" if q1 is not None and q1 >= target else "non_compliant"
            rows.append(
                {
                    "area": _to_display(row.get("process")),
                    "indicator": _to_display(row.get("indicator")),
                    "target": target,
                    "annual": q1,
                    "status": status,
                }
            )
        return rows

    if isinstance(raw_value, Mapping):
        indicators = raw_value.get("indicators") if isinstance(raw_value.get("indicators"), list) else []
        tracking = raw_value.get("tracking") if isinstance(raw_value.get("tracking"), list) else []
        annual_mode = "sum" if str(raw_value.get("annual_mode") or "").strip().lower() == "sum" else "average"
        tracking_by_id: dict[str, Mapping[str, Any]] = {}
        for track in tracking:
            if not isinstance(track, Mapping):
                continue
            tracking_by_id[str(track.get("indicator_id") or "")] = track

        for indicator in indicators:
            if not isinstance(indicator, Mapping):
                continue
            indicator_id = str(indicator.get("id") or "")
            tracking_row = tracking_by_id.get(indicator_id, {})
            q1 = _to_number(tracking_row.get("q1"))
            q2 = _to_number(tracking_row.get("q2"))
            q3 = _to_number(tracking_row.get("q3"))
            target = _to_number(indicator.get("target"))
            values = [value for value in [q1, q2, q3] if value is not None]
            has_data = _has_tracking_data([q1, q2, q3])
            annual = None
            if values:
                annual = sum(values) if annual_mode == "sum" else sum(values) / len(values)
            if not has_data:
                status = "no_data"
            elif target is None:
                status = "in_progress"
            elif annual is None:
                status = "no_data"
            else:
                status = "compliant" if annual >= target else "non_compliant"
            rows.append(
                {
                    "area": _to_display(indicator.get("area")),
                    "indicator": _to_display(indicator.get("indicator")),
                    "target": target,
                    "annual": annual,
                    "status": status,
                }
            )
    return rows


def _count_clause_statuses(checks: Sequence[AuditReportClauseCheck]) -> dict[str, int]:
    counts = {
        "compliant": 0,
        "partial": 0,
        "non_compliant": 0,
        "in_progress": 0,
        "not_applicable": 0,
    }
    for check in checks:
        status_key = _resolve_clause_status_key(check)
        counts[status_key] = counts.get(status_key, 0) + 1
    return counts


def _build_section_summary_signals(
    *,
    section: AuditReportSection,
    checks: Sequence[AuditReportClauseCheck],
    item_count: int,
    risk_count: int,
    observation_count: int,
) -> list[dict[str, str]]:
    counts = _count_clause_statuses(checks)
    applicable = counts["compliant"] + counts["partial"] + counts["non_compliant"] + counts["in_progress"]
    evaluated = counts["compliant"] + counts["partial"] + counts["non_compliant"]
    status_key = "neutral"
    if counts["non_compliant"] > 0:
        status_key = "critical"
    elif counts["partial"] > 0:
        status_key = "warning"
    elif evaluated > 0 and counts["in_progress"] == 0:
        status_key = "ok"
    signals = [
        {
            "label": "Estado de sección",
            "value": _normalize_section_status_label(section.status),
            "status": status_key,
        },
        {
            "label": "Cláusulas evaluadas",
            "value": f"{evaluated}/{applicable}" if applicable else "Sin datos",
            "status": "neutral" if applicable == 0 else ("ok" if evaluated == applicable else "warning"),
        },
        {
            "label": "Riesgos detectados",
            "value": str(risk_count) if risk_count else "Sin riesgos",
            "status": "critical" if risk_count > 0 else "neutral",
        },
        {
            "label": "Evidencia disponible",
            "value": str(item_count),
            "status": "ok" if item_count > 0 else "neutral",
        },
        {
            "label": "Observaciones",
            "value": str(observation_count),
            "status": "warning" if observation_count > 0 else "neutral",
        },
    ]
    return signals


def _signal_state_to_clause_status(signal_state: str) -> str:
    return {
        "ok": "compliant",
        "warning": "partial",
        "critical": "non_compliant",
        "neutral": "in_progress",
    }.get(signal_state, "in_progress")


def _section_layout_mode(
    *,
    root: str,
    summary: Mapping[str, int],
    item_count: int,
    risk_count: int,
    observation_count: int,
    has_narrative: bool,
) -> str:
    applicable = int(summary.get("applicable", 0) or 0)
    evaluated = int(summary.get("evaluated", 0) or 0)
    if (
        applicable == 0
        and item_count == 0
        and risk_count == 0
        and observation_count == 0
        and not has_narrative
    ):
        return "compact"

    if (
        root in {"4", "5", "6", "7"}
        and applicable <= 1
        and evaluated == 0
        and item_count <= 1
        and risk_count == 0
        and observation_count == 0
        and not has_narrative
    ):
        return "light"
    return "full"


def _build_compact_section_lines(
    *,
    section: AuditReportSection,
    summary: Mapping[str, int],
    item_count: int,
    risks: Sequence[str],
    has_narrative: bool,
) -> list[str]:
    lines = [
        f"Estado de sección: {_normalize_section_status_label(section.status)}.",
        (
            f"Cobertura evaluada: {summary.get('evaluated', 0)} de "
            f"{summary.get('applicable', 0)} cláusulas aplicables."
        ),
        f"Evidencia documentada en la sección: {item_count} registros con contenido.",
    ]
    if risks:
        lines.append(f"Riesgo principal: {_short_text(risks[0], max_len=160)}")
    else:
        lines.append("Sin riesgos críticos explícitos en este corte de información.")
    if not has_narrative:
        lines.append("No hay narrativa validada; se recomienda completar análisis cualitativo en próxima revisión.")
    return lines


def _normalize_section_status_label(raw_status: str | None) -> str:
    normalized = (raw_status or "").strip().lower()
    if normalized in {"completed", "compliant", "cumplida", "closed", "cerrada"}:
        return "Completada"
    if normalized in {"in_progress", "en_progreso", "en progreso"}:
        return "En curso"
    if normalized in {"sin evaluar", "sin_evaluar", "in review", "no_evaluado", "no evaluado"}:
        return "Sin evaluar"
    if normalized in {"not_started", "draft", "pendiente"}:
        return "Pendiente"
    return "Sin evaluar"


def _normalize_recommendation_type(value: str | None) -> str:
    key = (value or "").strip().lower()
    return RECOMMENDATION_TYPE_LABELS.get(key, _to_display(value))


def _normalize_recommendation_priority(value: str | None) -> str:
    key = (value or "").strip().lower()
    return RECOMMENDATION_PRIORITY_LABELS.get(key, _to_display(value))


def _normalize_recommendation_status(value: str | None) -> str:
    key = (value or "").strip().lower()
    return RECOMMENDATION_STATUS_LABELS.get(key, _to_display(value))


def _risk_state_from_text(risk_count: int, warning_count: int = 0) -> str:
    if risk_count > 0:
        return "critical"
    if warning_count > 0:
        return "warning"
    return "neutral"


def _global_clause_summary(clause_checks: Sequence[AuditReportClauseCheck]) -> dict[str, int]:
    counts = _count_clause_statuses(clause_checks)
    counts["applicable"] = (
        counts["compliant"] + counts["partial"] + counts["non_compliant"] + counts["in_progress"]
    )
    counts["evaluated"] = counts["compliant"] + counts["partial"] + counts["non_compliant"]
    return counts


def _global_status_label(counts: Mapping[str, int]) -> tuple[str, str]:
    if counts.get("non_compliant", 0) > 0:
        return "critical", "Estado general: Riesgo alto de incumplimiento."
    if counts.get("partial", 0) > 0:
        return "warning", "Estado general: conformidad parcial con frentes de cierre todavía abiertos."
    if counts.get("evaluated", 0) == 0:
        return "neutral", "Estado general: sin base evaluativa suficiente para una conclusión robusta."
    if counts.get("in_progress", 0) > 0:
        return "neutral", "Estado general: evaluación en curso, con cláusulas aún pendientes de cierre."
    return "ok", "Estado general: desempeño conforme y sostenido con la evidencia revisada."


def _section_priority_score(
    *,
    counts: Mapping[str, int],
    risk_count: int,
    item_count: int,
) -> int:
    score = (
        int(counts.get("non_compliant", 0) or 0) * 4
        + int(counts.get("partial", 0) or 0) * 2
        + int(counts.get("in_progress", 0) or 0)
        + int(risk_count)
    )
    if int(counts.get("evaluated", 0) or 0) == 0 and int(counts.get("applicable", 0) or 0) > 0:
        score += 1
    if item_count == 0:
        score += 1
    return score


def _render_cover_page(
    document: Any,
    *,
    report: AuditReport,
    client: Client,
    export_status_label: str,
    issued_by_name: str | None,
    issued_by_email: str | None,
    issued_at: datetime | None,
) -> None:
    title = "Informe de Auditoría Interna ISO 9001"
    subtitle = "Sistema de Gestión de la Calidad · Versión ejecutiva"
    company_name = _to_display(report.entity_name or client.name)

    ribbon = document.add_table(rows=1, cols=1)
    ribbon.style = "Table Grid"
    _set_table_borders(ribbon, color_hex="B6C8E0", size="6")
    ribbon_cell = ribbon.rows[0].cells[0]
    _set_cell_shading(ribbon_cell, "EAF1FB")
    ribbon_paragraph = ribbon_cell.paragraphs[0]
    _clear_paragraph(ribbon_paragraph)
    ribbon_run = ribbon_paragraph.add_run("INFORME CORPORATIVO · ISO 9001:2015")
    _style_run(ribbon_run, bold=True, size_pt=9.2, color_hex="1E3A5F")
    _style_paragraph(ribbon_paragraph, before_pt=0, after_pt=0, line_spacing=1.0, alignment="center")

    p_logo = document.add_paragraph()
    p_logo.add_run("P03 · Informe oficial").bold = True
    _style_paragraph(p_logo, before_pt=3, after_pt=3, alignment="left")
    for run in p_logo.runs:
        _style_run(run, size_pt=10, color_hex="334155")

    p_title = document.add_paragraph()
    run_title = p_title.add_run(title)
    _style_run(run_title, bold=True, size_pt=22, color_hex="0F172A")
    _style_paragraph(p_title, before_pt=2, after_pt=3, line_spacing=1.0)

    p_sub = document.add_paragraph()
    run_sub = p_sub.add_run(subtitle)
    _style_run(run_sub, size_pt=11.5, color_hex="475569")
    _style_paragraph(p_sub, before_pt=0, after_pt=5, line_spacing=1.05)

    _add_visual_divider(document, color_hex="A3C6F5")

    add_info_card(
        document,
        title="Ficha ejecutiva de emisión",
        lines=[
            f"Empresa auditada: {company_name}",
            f"Código informe: {_to_display(report.report_code)} · Año: {_to_display(report.report_year)}",
            f"Norma de referencia: {_to_display(report.reference_standard or 'ISO 9001:2015')}",
            f"Fecha de auditoría: {_to_display(report.audit_date)}",
            f"Fecha/hora de emisión: {_format_export_datetime(issued_at)}",
            f"Auditor responsable: {_format_issued_by(issued_by_name=issued_by_name, issued_by_email=issued_by_email)}",
            f"Estado de exportación: {export_status_label}",
        ],
        status_key="compliant" if _is_final_export_status(report.status) else "in_progress",
    )
    add_info_card(
        document,
        title="Síntesis de emisión",
        lines=[
            "Informe preparado con estructura ejecutiva para revisión de dirección y seguimiento del SGC.",
            "Norma aplicable: ISO 9001:2015.",
            "Documento emitido con control documental y trazabilidad de estado.",
        ],
        status_key="in_progress" if not _is_final_export_status(report.status) else "compliant",
    )
    document.add_page_break()


def _build_section_risk_notes(
    *,
    section_code: str,
    checks: Sequence[AuditReportClauseCheck],
    items_by_code: Mapping[str, AuditReportItem],
) -> list[str]:
    risks: list[str] = []
    counts = _count_clause_statuses(checks)
    if counts["non_compliant"] > 0:
        risks.append(f"{counts['non_compliant']} cláusulas en no conformidad.")
    if counts["partial"] > 0:
        risks.append(f"{counts['partial']} cláusulas en cumplimiento parcial.")
    if counts["in_progress"] > 0:
        risks.append(f"{counts['in_progress']} cláusulas sin evaluar.")

    root = _normalize_section_root(section_code)
    if root == "10":
        action_item = items_by_code.get("corrective_actions_matrix")
        risks.extend(_section_10_risks(_normalize_s10_actions(_value_from_item(action_item))))
    if root == "9":
        kpi_item = items_by_code.get("performance_indicators_matrix")
        kpi_rows = _normalize_s9_kpi_rows(_value_from_item(kpi_item))
        no_data = sum(1 for row in kpi_rows if row.get("status") == "no_data")
        deviated = sum(1 for row in kpi_rows if row.get("status") == "non_compliant")
        if deviated:
            risks.append(f"{deviated} indicadores con desviación respecto a la meta.")
        if no_data:
            risks.append(f"{no_data} indicadores sin seguimiento suficiente.")
    if root == "8":
        trace_item = items_by_code.get("document_traceability_matrix")
        trace_rows = _value_from_item(trace_item)
        if isinstance(trace_rows, list):
            missing = sum(
                1
                for row in trace_rows
                if isinstance(row, Mapping) and str(row.get("status") or "").strip().lower() in {"missing", "no_encontrado"}
            )
            if missing:
                risks.append(f"{missing} evidencias de trazabilidad no encontradas en la muestra.")

    return risks


def _render_executive_summary(
    document: Any,
    *,
    sections: Sequence[AuditReportSection],
    clause_checks: Sequence[AuditReportClauseCheck],
    recommendations: Sequence[AuditReportRecommendation],
    items_by_section_code: Mapping[str, Mapping[str, AuditReportItem]],
) -> None:
    add_section_heading(document, "Resumen ejecutivo de auditoría")
    clause_counts = _global_clause_summary(clause_checks)
    global_state, global_state_text = _global_status_label(clause_counts)
    iso_sections = [section for section in sections if _is_iso_section(section.section_code)]
    total_risks = 0
    section_diagnostics: list[dict[str, Any]] = []
    for section in iso_sections:
        section_checks = [check for check in clause_checks if check.section_code == section.section_code]
        section_counts = _global_clause_summary(section_checks)
        section_items = items_by_section_code.get(section.section_code, {})
        section_item_count = sum(
            1
            for item in section_items.values()
            if _has_text(item.value_text) or item.value_json not in (None, {}, [])
        )
        risk_notes = _build_section_risk_notes(
            section_code=section.section_code,
            checks=section_checks,
            items_by_code=section_items,
        )
        section_risk_count = len(risk_notes)
        total_risks += section_risk_count
        section_diagnostics.append(
            {
                "code": section.section_code,
                "risk_count": section_risk_count,
                "counts": section_counts,
                "item_count": section_item_count,
                "score": _section_priority_score(
                    counts=section_counts,
                    risk_count=section_risk_count,
                    item_count=section_item_count,
                ),
            }
        )

    add_signal_row(
        document,
        [
            {
                "label": "Secciones evaluadas",
                "value": str(len(iso_sections)),
                "status": "ok" if len(iso_sections) >= 7 else "warning",
            },
            {
                "label": "Cláusulas conformes",
                "value": str(clause_counts["compliant"]),
                "status": "ok" if clause_counts["compliant"] > 0 else "neutral",
            },
            {
                "label": "Parciales",
                "value": str(clause_counts["partial"]),
                "status": "warning" if clause_counts["partial"] > 0 else "neutral",
            },
            {
                "label": "No conformes",
                "value": str(clause_counts["non_compliant"]),
                "status": "critical" if clause_counts["non_compliant"] > 0 else "neutral",
            },
            {
                "label": "Sin evaluar",
                "value": str(clause_counts["in_progress"]),
                "status": "neutral",
            },
            {
                "label": "No aplica",
                "value": str(clause_counts["not_applicable"]),
                "status": "neutral",
            },
            {
                "label": "Riesgos detectados",
                "value": str(total_risks),
                "status": _risk_state_from_text(total_risks),
            },
        ],
    )
    section_diagnostics.sort(key=lambda item: (item["score"], item["risk_count"]), reverse=True)
    top_area_items = [
        f"Sección {item['code']} (prioridad {item['score']})"
        for item in section_diagnostics
        if item["score"] > 0
    ]
    top_areas = ", ".join(top_area_items[:3]) if top_area_items else "Sin áreas críticas identificadas"

    mature_areas = [
        f"Sección {item['code']}"
        for item in section_diagnostics
        if item["counts"].get("applicable", 0) > 0
        and item["counts"].get("non_compliant", 0) == 0
        and item["counts"].get("partial", 0) == 0
        and item["counts"].get("in_progress", 0) == 0
        and item["risk_count"] == 0
    ]
    mature_areas_text = ", ".join(mature_areas[:3]) if mature_areas else "Sin secciones plenamente maduras en este corte"

    coverage = clause_counts["evaluated"] / clause_counts["applicable"] if clause_counts["applicable"] else 0
    coverage_pct = int(round(coverage * 100))
    risk_level = "Bajo"
    risk_state = "ok"
    if clause_counts["non_compliant"] > 0 or total_risks >= 5:
        risk_level = "Alto"
        risk_state = "critical"
    elif clause_counts["partial"] > 0 or total_risks >= 2:
        risk_level = "Medio"
        risk_state = "warning"
    elif clause_counts["evaluated"] == 0:
        risk_level = "No evaluado"
        risk_state = "neutral"

    recommendation_count = len(recommendations)
    focus_lines: list[str] = []
    if clause_counts["non_compliant"] > 0:
        focus_lines.append("Prioridad inmediata: cierre de no conformidades abiertas con verificación de eficacia.")
    if clause_counts["in_progress"] > 0:
        focus_lines.append("Completar cláusulas sin evaluar para consolidar una lectura robusta del sistema.")
    if clause_counts["partial"] > 0:
        focus_lines.append("Consolidar acciones en cláusulas parciales para reducir riesgo de reincidencia.")
    if not focus_lines:
        focus_lines.append("Mantener disciplina de seguimiento para sostener el desempeño y la trazabilidad.")

    add_info_card(
        document,
        title="Diagnóstico ejecutivo del sistema",
        lines=[
            global_state_text,
            (
                f"Cobertura evaluada: {clause_counts['evaluated']} de {clause_counts['applicable']} "
                f"cláusulas aplicables ({coverage_pct}%)."
            ),
            (
                f"Hallazgos abiertos (no conformes + parciales): "
                f"{clause_counts['non_compliant'] + clause_counts['partial']}."
            ),
            f"Recomendaciones registradas en el informe: {recommendation_count}.",
        ],
        status_key=_signal_state_to_clause_status(global_state),
    )
    add_info_card(
        document,
        title="Prioridades y lectura senior",
        lines=[
            f"Nivel de riesgo global: {risk_level}.",
            f"Áreas prioritarias: {top_areas}.",
            f"Bloques más maduros: {mature_areas_text}.",
            *focus_lines[:2],
        ],
        status_key=_signal_state_to_clause_status(risk_state),
    )
    add_info_card(
        document,
        title="Estado global y trazabilidad de evaluación",
        lines=[
            f"Riesgos detectados en el informe: {total_risks}.",
            (
                f"Cláusulas sin evaluar: {clause_counts['in_progress']}. "
                "Se mantienen en estado neutral hasta cierre evaluativo."
            ),
            (
                f"Cláusulas no aplicables: {clause_counts['not_applicable']}. "
                "Se excluyen del juicio de conformidad."
            ),
        ],
        status_key=_signal_state_to_clause_status(global_state),
    )


def _render_section_special_summary(
    document: Any,
    *,
    section_code: str,
    items_by_code: Mapping[str, AuditReportItem],
) -> None:
    root = _normalize_section_root(section_code)
    if root == "8":
        add_subsection_heading(document, "Síntesis operacional (8)")
        supplier_score = _to_number(_value_from_item(items_by_code.get("supplier_average_score")))
        supplier_count = _to_number(_value_from_item(items_by_code.get("supplier_evaluation_count")))
        nc_count = _to_number(_value_from_item(items_by_code.get("nonconformities_count"))) or 0
        trace_rows = _value_from_item(items_by_code.get("document_traceability_matrix"))
        trace_total = len(trace_rows) if isinstance(trace_rows, list) else 0
        trace_missing = (
            sum(
                1
                for row in trace_rows
                if isinstance(row, Mapping) and str(row.get("status") or "").strip().lower() in {"missing", "no_encontrado"}
            )
            if isinstance(trace_rows, list)
            else 0
        )
        add_signal_row(
            document,
            [
                {
                    "label": "Proveedores evaluados",
                    "value": str(int(supplier_count)) if supplier_count is not None else "Sin datos",
                    "status": "ok" if supplier_count and supplier_count > 0 else "neutral",
                },
                {
                    "label": "Valoración proveedores",
                    "value": f"{supplier_score:.2f}" if supplier_score is not None else "Sin datos",
                    "status": "critical" if supplier_score is not None and supplier_score < 5 else "ok" if supplier_score is not None else "neutral",
                },
                {
                    "label": "Trazabilidad muestra",
                    "value": f"{trace_total} registros",
                    "status": "warning" if trace_total == 0 else "ok",
                },
                {
                    "label": "Documentos faltantes",
                    "value": str(trace_missing),
                    "status": "critical" if trace_missing > 0 else "neutral",
                },
                {
                    "label": "NC operacionales",
                    "value": str(int(nc_count)),
                    "status": "warning" if nc_count > 0 else "neutral",
                },
            ],
        )
        add_info_card(
            document,
            title="Lectura operacional",
            lines=[
                "La sección 8 se centra en control operacional, proveedores, trazabilidad y gestión de no conformidades.",
                f"Registros de trazabilidad analizados: {trace_total}. Documentos faltantes: {trace_missing}.",
            ],
            status_key="non_compliant" if trace_missing > 0 else "partial" if nc_count > 0 else "compliant",
            fill_hex="F6FAFF",
            border_hex="C9DDF4",
        )
    elif root == "9":
        add_subsection_heading(document, "Síntesis de desempeño (9)")
        kpi_rows = _normalize_s9_kpi_rows(_value_from_item(items_by_code.get("performance_indicators_matrix")))
        total = len(kpi_rows)
        compliant = sum(1 for row in kpi_rows if row.get("status") == "compliant")
        deviated = sum(1 for row in kpi_rows if row.get("status") == "non_compliant")
        in_progress = sum(1 for row in kpi_rows if row.get("status") == "in_progress")
        no_data = sum(1 for row in kpi_rows if row.get("status") == "no_data")
        cs_score = _to_number(_value_from_item(items_by_code.get("customer_satisfaction_global_score")))
        add_signal_row(
            document,
            [
                {"label": "KPIs totales", "value": str(total), "status": "ok" if total > 0 else "neutral"},
                {"label": "KPIs cumplen", "value": str(compliant), "status": "ok" if compliant > 0 else "neutral"},
                {"label": "KPIs desviados", "value": str(deviated), "status": "critical" if deviated > 0 else "neutral"},
                {"label": "KPIs sin evaluar", "value": str(in_progress), "status": "neutral"},
                {"label": "KPIs sin datos", "value": str(no_data), "status": "neutral"},
                {
                    "label": "Satisfacción cliente",
                    "value": f"{cs_score:.2f}/10" if cs_score is not None else "Sin datos",
                    "status": "warning" if cs_score is not None and cs_score < 7 else "ok" if cs_score is not None else "neutral",
                },
            ],
        )
        add_info_card(
            document,
            title="Lectura de desempeño",
            lines=[
                "La sección 9 integra resultados de KPIs, satisfacción del cliente y seguimiento de evaluación del desempeño.",
                f"Indicadores con desviación: {deviated}. Indicadores sin datos: {no_data}.",
            ],
            status_key="non_compliant" if deviated > 0 else "partial" if no_data > 0 else "compliant",
            fill_hex="F5FBF9",
            border_hex="CBE9DF",
        )
        kpi_preview_rows = []
        for row in kpi_rows[:10]:
            target = row.get("target")
            annual = row.get("annual")
            status = row.get("status")
            status_label = {
                "compliant": "Cumple",
                "non_compliant": "Desviado",
                "in_progress": "Sin evaluar",
                "no_data": "Sin datos",
            }.get(str(status), "Sin datos")
            kpi_preview_rows.append(
                [
                    str(row.get("area") or "-"),
                    str(row.get("indicator") or "-"),
                    "-" if target is None else f"{target:.2f}",
                    "-" if annual is None else f"{annual:.2f}",
                    status_label,
                ]
            )
        add_summary_table(
            document,
            headers=["Área", "Indicador", "Meta", "Resultado", "Estado"],
            rows=kpi_preview_rows,
            empty_text="No hay indicadores KPI registrados en P09.",
        )
    elif root == "10":
        add_subsection_heading(document, "Síntesis de mejora y acciones correctivas (10)")
        actions = _normalize_s10_actions(_value_from_item(items_by_code.get("corrective_actions_matrix")))
        overdue = sum(1 for row in actions if row.get("status_key") == "overdue")
        open_items = sum(1 for row in actions if row.get("status_key") in {"open", "in_progress"})
        ineffective = sum(1 for row in actions if row.get("effectiveness_key") == "ineffective")
        recurrence = sum(1 for row in actions if row.get("recurrence_key") == "yes")
        add_signal_row(
            document,
            [
                {"label": "Acciones totales", "value": str(len(actions)), "status": "ok" if actions else "neutral"},
                {"label": "Abiertas/en curso", "value": str(open_items), "status": "warning" if open_items > 0 else "neutral"},
                {"label": "Vencidas", "value": str(overdue), "status": "critical" if overdue > 0 else "neutral"},
                {"label": "Ineficaces", "value": str(ineffective), "status": "critical" if ineffective > 0 else "neutral"},
                {"label": "Reincidencias", "value": str(recurrence), "status": "critical" if recurrence > 0 else "neutral"},
            ],
        )
        add_info_card(
            document,
            title="Lectura CAPA y mejora",
            lines=[
                "La sección 10 consolida no conformidades, acciones correctivas, eficacia y reincidencias.",
                f"Acciones vencidas: {overdue}. Ineficaces: {ineffective}. Reincidencias: {recurrence}.",
            ],
            status_key="non_compliant" if overdue > 0 or ineffective > 0 else "partial" if open_items > 0 else "compliant",
            fill_hex="FFF8F5",
            border_hex="F0D7CC",
        )
        matrix_rows: list[list[str]] = []
        for row in actions[:12]:
            matrix_rows.append(
                [
                    row["type"],
                    row["finding"],
                    row["owner"],
                    row["status"],
                    row["effectiveness"],
                    row["recurrence"],
                    row["due_date"],
                ]
            )
        add_summary_table(
            document,
            headers=["Tipo", "Hallazgo", "Responsable", "Estado", "Eficacia", "Reincidencia", "Fecha"],
            rows=matrix_rows,
            empty_text="Sin acciones correctivas registradas en la matriz.",
        )


def _render_clause_checks(
    document: Any,
    *,
    section_checks: Sequence[AuditReportClauseCheck],
    phrase_usage: dict[str, int] | None = None,
    render_empty_placeholder: bool = True,
) -> tuple[int, int]:
    if not section_checks:
        if render_empty_placeholder:
            add_info_card(
                document,
                title="Verificación por cláusulas",
                lines=["No hay checks de cláusulas configurados para esta sección."],
                status_key="in_progress",
            )
        return 0, 0

    risk_count = 0
    observation_count = 0
    line_variation_usage = phrase_usage if phrase_usage is not None else defaultdict(int)
    for check in section_checks:
        status_key = _resolve_clause_status_key(check)
        title = f"Cláusula {check.clause_code} · {_to_display(check.clause_title)}"
        lines = []
        if _has_text(check.evidence_summary):
            lines.append(f"Evidencia: {_to_display(check.evidence_summary)}")
        else:
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["no_evidence"],
                    key="clause.no_evidence",
                    seed=f"clause-no-evidence-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
        if _has_text(check.observation_text):
            observation_count += 1
            lines.append(f"Observación: {_to_display(check.observation_text)}")
        else:
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["no_observation"],
                    key="clause.no_observation",
                    seed=f"clause-no-observation-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )

        if status_key == "non_compliant":
            risk_count += 1
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["non_compliant"]["finding"],
                    key="clause.status.non_compliant.finding",
                    seed=f"clause-nc-finding-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["non_compliant"]["action"],
                    key="clause.status.non_compliant.action",
                    seed=f"clause-nc-action-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
        elif status_key == "partial":
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["partial"]["finding"],
                    key="clause.status.partial.finding",
                    seed=f"clause-partial-finding-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["partial"]["action"],
                    key="clause.status.partial.action",
                    seed=f"clause-partial-action-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
        elif status_key == "in_progress":
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["in_progress"]["finding"],
                    key="clause.status.in_progress.finding",
                    seed=f"clause-progress-finding-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["in_progress"]["action"],
                    key="clause.status.in_progress.action",
                    seed=f"clause-progress-action-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
        elif status_key == "not_applicable":
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["not_applicable"]["finding"],
                    key="clause.status.not_applicable.finding",
                    seed=f"clause-na-finding-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )
        else:
            lines.append(
                _pick_narrative_variant(
                    _CLAUSE_CHECK_VARIANTS["status"]["compliant"]["finding"],
                    key="clause.status.compliant.finding",
                    seed=f"clause-ok-finding-{check.clause_code}",
                    usage_counter=line_variation_usage,
                )
            )

        add_info_card(document, title=title, lines=lines, status_key=status_key)

    return risk_count, observation_count


def _dedupe_narrative_lines(lines: Sequence[str], *, max_items: int = 6) -> list[str]:
    deduped: list[str] = []
    seen_keys: set[str] = set()
    for line in lines:
        text = str(line or "").strip()
        if not text:
            continue
        key = _normalize_text_for_match(text)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(text)
        if len(deduped) >= max_items:
            break
    return deduped


def _render_narrative(
    document: Any,
    narrative: str,
    *,
    render_empty_placeholder: bool = True,
) -> None:
    text = str(narrative or "").strip()
    if not text:
        if render_empty_placeholder:
            add_info_card(
                document,
                title="Narrativa auditora",
                lines=["No se dispone de texto narrativo validado para esta sección."],
                status_key="in_progress",
            )
        return
    blocks = _extract_narrative_blocks(text)
    if blocks:
        ordered_keys = ["evidence", "gaps", "conclusion", "risk", "action"]
        for key in ordered_keys:
            content = blocks.get(key)
            if not content:
                continue
            heading = _NARRATIVE_SECTION_HEADINGS.get(key, "Narrativa")
            refined_lines = _dedupe_narrative_lines([content], max_items=1)
            if refined_lines:
                add_info_card(document, title=heading, lines=refined_lines, status_key=None)
        return

    paragraphs = [part.strip() for part in text.split("\n") if part.strip()]
    refined_paragraphs = _dedupe_narrative_lines(paragraphs if paragraphs else [text], max_items=6)
    add_info_card(
        document,
        title="Narrativa auditora",
        lines=refined_paragraphs,
        status_key=None,
    )


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
    _apply_base_document_theme(document)

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

    items_by_section_code = _map_items_by_section_and_code(items)
    checks_by_section: dict[str, list[AuditReportClauseCheck]] = defaultdict(list)
    for check in clause_checks:
        checks_by_section[check.section_code].append(check)
    for section_checks in checks_by_section.values():
        section_checks.sort(key=lambda row: (row.sort_order or 0, row.clause_code))

    iso_sections = [section for section in sections if _is_iso_section(section.section_code)]
    iso_sections.sort(key=_section_sort_key)
    clause_phrase_usage: dict[str, int] = defaultdict(int)

    _render_cover_page(
        document,
        report=report,
        client=client,
        export_status_label=export_status_label,
        issued_by_name=issued_by_name,
        issued_by_email=issued_by_email,
        issued_at=issued_at,
    )

    _render_executive_summary(
        document,
        sections=sections,
        clause_checks=clause_checks,
        recommendations=recommendations,
        items_by_section_code=items_by_section_code,
    )
    if ai_generation_used:
        add_info_card(
            document,
            title="Nota metodológica",
            lines=[AI_ASSISTED_NOTICE],
            status_key="in_progress",
        )
    else:
        add_info_card(
            document,
            title="Nota metodológica",
            lines=[
                "Exportación generada en modo respaldo sin IA. La redacción debe validarse por el auditor responsable."
            ],
            status_key="partial",
        )

    if is_final_export and critical_integrity_notes:
        add_risk_box(
            document,
            title="Advertencia de integridad documental para versión final",
            items=[
                "Esta versión final contiene faltantes críticos de integridad documental.",
                "Revise y cierre las observaciones antes de uso formal externo.",
            ],
            severity="critical",
        )

    add_section_heading(document, "1. Cabecera y contexto de auditoría")
    interviewees_text = "\n".join(
        f"{person.full_name} - {_to_display(person.role_name)}"
        for person in sorted(interviewees, key=lambda row: (row.sort_order or 0, row.full_name))
    ) or "-"
    add_subsection_heading(document, "Ficha de auditoría")
    add_summary_table(
        document,
        headers=["Campo", "Valor"],
        rows=[
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
            ("Gerente", _to_display(report.manager_name)),
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

    add_subsection_heading(document, "Alcance del sistema")
    add_info_card(
        document,
        title="Alcance declarado",
        lines=[_to_display(report.system_scope)],
        status_key="in_progress" if not _has_text(report.system_scope) else None,
    )

    tipo_auditoria_texto = _audit_type_to_text(report.tipo_auditoria)
    modalidad_texto = _normalize_audit_modality(report.modalidad)

    add_subsection_heading(document, "Descripción y criterios de auditoría")
    add_info_card(
        document,
        title="Enfoque metodológico",
        lines=[
            f"La auditoría de {tipo_auditoria_texto} se ha realizado {modalidad_texto} en las instalaciones del cliente.",
            "Se auditó el Sistema de Gestión de Calidad en su alcance completo mediante revisión de actividades, entrevistas y registros.",
            "El muestreo aplicado permitió verificar operación, seguimiento, medición y control documental con trazabilidad suficiente.",
        ],
    )

    criteria_rows = [
        "Cláusula 4. Contexto de la organización",
        "Cláusula 5. Liderazgo",
        "Cláusula 6. Planificación",
        "Cláusula 7. Apoyo",
        "Cláusula 8. Operación",
        "Cláusula 9. Evaluación del desempeño",
        "Cláusula 10. Mejora",
    ]
    add_summary_table(
        document,
        headers=["Criterios principales"],
        rows=[(criterion,) for criterion in criteria_rows],
    )
    add_info_card(
        document,
        title="Criterios complementarios",
        lines=[
            "Evidencia objetiva",
            "Cumplimiento normativo aplicable",
            "Resultados esperados y desempeño del sistema",
            "Comunicación formal de hallazgos y definición de acciones de seguimiento",
        ],
    )

    add_subsection_heading(document, "Evidencia contextual del sistema utilizada")
    if context_by_section:
        context_rows = []
        for section_code in sorted(context_by_section.keys(), key=_sort_section_code_for_display):
            context_text = _to_display(context_by_section.get(section_code))
            context_rows.append((f"Sección {section_code}", context_text))
        add_summary_table(
            document,
            headers=["Referencia", "Evidencia contextual"],
            rows=context_rows,
        )
    else:
        add_info_card(
            document,
            title="Evidencia contextual",
            lines=["No hay evidencia contextual complementaria disponible para esta exportación."],
            status_key="in_progress",
        )

    for section_index, section in enumerate(iso_sections):
        root = _normalize_section_root(section.section_code)
        section_heading = SECTION_HEADING_MAP.get(
            root,
            f"{section.section_code}.- {(section.title or '').upper()}".strip(),
        )
        add_section_heading(document, section_heading)

        section_checks = checks_by_section.get(section.section_code, [])
        section_items_by_code = items_by_section_code.get(section.section_code, {})
        section_item_count = sum(
            1
            for item in section_items_by_code.values()
            if _has_text(item.value_text) or item.value_json not in (None, {}, [])
        )
        section_has_narrative = any(
            [
                _has_text(section.final_text),
                _has_text(section_narratives.get(section.section_code)),
                _has_text(section.ai_draft_text),
                _has_text(section.auditor_notes),
            ]
        )
        preliminary_risks = _build_section_risk_notes(
            section_code=section.section_code,
            checks=section_checks,
            items_by_code=section_items_by_code,
        )
        observation_count = sum(1 for check in section_checks if _has_text(check.observation_text))
        signals = _build_section_summary_signals(
            section=section,
            checks=section_checks,
            item_count=section_item_count,
            risk_count=len(preliminary_risks),
            observation_count=observation_count,
        )
        add_subsection_heading(document, "Tarjeta ejecutiva de sección")
        add_signal_row(document, signals)
        add_info_card(
            document,
            title=f"Resumen sección {section.section_code}",
            lines=[
                f"Estado de sección: {_normalize_section_status_label(section.status)}",
                f"Cláusulas aplicables: {_global_clause_summary(section_checks).get('applicable', 0)}",
                f"Evidencias registradas en sección: {section_item_count}",
            ],
            status_key=_signal_state_to_clause_status(signals[0]["status"]),
        )

        section_summary = _global_clause_summary(section_checks)
        layout_mode = _section_layout_mode(
            root=root,
            summary=section_summary,
            item_count=section_item_count,
            risk_count=len(preliminary_risks),
            observation_count=observation_count,
            has_narrative=section_has_narrative,
        )
        if layout_mode == "compact":
            add_info_card(
                document,
                title=f"Síntesis compacta sección {section.section_code}",
                lines=_build_compact_section_lines(
                    section=section,
                    summary=section_summary,
                    item_count=section_item_count,
                    risks=preliminary_risks,
                    has_narrative=section_has_narrative,
                ),
                status_key="in_progress",
                fill_hex="F8FAFC",
                border_hex="D7E0EB",
            )
            if section_index < len(iso_sections) - 1:
                document.add_page_break()
            continue

        if preliminary_risks:
            add_risk_box(
                document,
                title="Riesgos y hallazgos relevantes",
                items=preliminary_risks,
                severity="critical",
            )

        show_reference_table = layout_mode == "full" or section_summary.get("applicable", 0) > 0 or root in {"8", "9", "10"}
        if show_reference_table:
            points_rows = _build_points_rows(
                section_code=section.section_code,
                section_checks=section_checks,
                reference_standard=_to_display(report.reference_standard),
            )
            add_subsection_heading(document, "Puntos de referencia y aplicabilidad")
            add_summary_table(
                document,
                headers=["Título", "Norma de referencia", "Punto aplicable", "Aplica"],
                rows=[(title, norm, point_code, marker or "-") for title, norm, point_code, marker in points_rows],
            )

        _render_section_special_summary(
            document,
            section_code=section.section_code,
            items_by_code=section_items_by_code,
        )

        clause_risk_count = 0
        clause_observations = 0
        should_render_clause_checks = bool(section_checks) or layout_mode == "full"
        if should_render_clause_checks:
            add_subsection_heading(document, "Verificación detallada por cláusulas")
            clause_risk_count, clause_observations = _render_clause_checks(
                document,
                section_checks=section_checks,
                phrase_usage=clause_phrase_usage,
                render_empty_placeholder=layout_mode == "full",
            )
        if clause_risk_count > 0 or clause_observations > 0:
            add_risk_box(
                document,
                title="Lectura de riesgo de cláusulas",
                items=[
                    f"Cláusulas en no conformidad: {clause_risk_count}.",
                    f"Cláusulas con observaciones registradas: {clause_observations}.",
                ],
                severity="critical" if clause_risk_count > 0 else "warning",
            )

        narrative = (
            section.final_text
            or section_narratives.get(section.section_code)
            or section.ai_draft_text
            or section.auditor_notes
            or "Sin contenido narrativo disponible para esta sección."
        )
        should_render_narrative = section_has_narrative or layout_mode == "full"
        if should_render_narrative:
            add_subsection_heading(document, "Narrativa de evaluación")
            _render_narrative(
                document,
                narrative,
                render_empty_placeholder=layout_mode == "full",
            )

        if section_index < len(iso_sections) - 1:
            document.add_page_break()

    add_section_heading(document, "Resultados y seguimiento")
    all_tracking_empty = not annexes and not recommendations and not recommendation_history
    if all_tracking_empty:
        add_info_card(
            document,
            title="Seguimiento en formato compacto",
            lines=[
                "No se han registrado anexos, recomendaciones activas ni histórico de seguimiento en este corte.",
                "El bloque se mantiene en estado de preparación hasta incorporar evidencias de seguimiento.",
            ],
            status_key="in_progress",
        )
    elif annexes:
        add_subsection_heading(document, "Anexos documentales")
        ordered_annexes = sorted(annexes, key=lambda row: (row.sort_order or 0, row.created_at))
        annex_rows = []
        for annex in ordered_annexes:
            annex_prefix = f"{annex.annex_code}: " if _has_text(annex.annex_code) else ""
            annex_line = f"{annex_prefix}{_to_display(annex.title)}"
            if _has_text(annex.notes):
                annex_line = f"{annex_line}. {_to_display(annex.notes)}"
            annex_rows.append(
                (
                    _to_display(annex.annex_code),
                    annex_line,
                    _to_display(annex.file_url),
                )
            )
        add_summary_table(
            document,
            headers=["Código", "Anexo", "Referencia"],
            rows=annex_rows,
        )
    else:
        add_info_card(
            document,
            title="Anexos documentales",
            lines=["No hay anexos documentales registrados para esta auditoría."],
            status_key="in_progress",
        )

    if not all_tracking_empty:
        add_subsection_heading(document, "Recomendaciones de esta auditoría")
    if recommendations:
        ordered_recommendations = sorted(
            recommendations,
            key=lambda row: (row.created_at or datetime.min),
        )
        recommendation_rows = []
        for recommendation in ordered_recommendations:
            recommendation_rows.append(
                (
                    _to_display(recommendation.section_code),
                    _normalize_recommendation_type(recommendation.recommendation_type),
                    _normalize_recommendation_priority(recommendation.priority),
                    _normalize_recommendation_status(recommendation.recommendation_status),
                    _to_display(recommendation.body_text),
                    _to_display(recommendation.followup_comment),
                )
            )
        add_summary_table(
            document,
            headers=["Sección", "Tipo", "Prioridad", "Estado", "Recomendación", "Seguimiento"],
            rows=recommendation_rows,
        )
    else:
        add_info_card(
            document,
            title="Recomendaciones de auditoría",
            lines=["No hay recomendaciones registradas para esta auditoría."],
            status_key="in_progress",
        )

    if not all_tracking_empty:
        add_subsection_heading(document, "Seguimiento de recomendaciones anteriores")
    if recommendation_history:
        history_rows = []
        for item in recommendation_history:
            history_rows.append(
                (
                    _to_display(item.get("report_code")),
                    _to_display(item.get("report_year")),
                    _to_display(item.get("section_code")),
                    _normalize_recommendation_status(item.get("recommendation_status")),
                    _to_display(item.get("body_text")),
                    _to_display(item.get("followup_comment")),
                )
            )
        add_summary_table(
            document,
            headers=["Informe", "Año", "Sección", "Estado", "Recomendación", "Seguimiento"],
            rows=history_rows,
        )
    else:
        add_info_card(
            document,
            title="Seguimiento histórico",
            lines=["No existe histórico de recomendaciones previas para este cliente."],
            status_key="in_progress",
        )

    add_subsection_heading(document, "Observaciones de integridad documental")
    if integrity_notes:
        add_risk_box(
            document,
            title="Integridad documental",
            items=integrity_notes,
            severity="warning",
        )
    else:
        add_info_card(
            document,
            title="Integridad documental",
            lines=["No se detectan ausencias críticas de información para la redacción del informe."],
            status_key="compliant",
        )
    if is_final_export and critical_integrity_notes:
        add_risk_box(
            document,
            title="Advertencia de integridad para versión final",
            items=[
                "La auditoría está en estado final y mantiene faltantes críticos que afectan la suficiencia documental.",
                *critical_integrity_notes,
            ],
            severity="critical",
        )

    add_section_heading(document, "Conclusiones")
    add_info_card(
        document,
        title="Conclusión auditora",
        lines=[_to_display(report.conclusions_text)],
        status_key=None,
    )

    add_section_heading(document, "Disposiciones finales")
    final_lines: list[str] = []
    if report.final_dispositions_text and report.final_dispositions_text.strip():
        final_lines.append(report.final_dispositions_text.strip())
    final_lines.extend(FIXED_FINAL_DISPOSITIONS_LINES)
    add_info_card(
        document,
        title="Disposiciones aplicables",
        lines=final_lines,
        status_key=None,
    )

    output = BytesIO()
    document.save(output)
    output.seek(0)
    return output
