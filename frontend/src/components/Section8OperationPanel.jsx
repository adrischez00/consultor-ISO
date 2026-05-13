import { useState, useMemo } from "react";
import EditableAuditMatrix from "./EditableAuditMatrix";

// ── Cláusulas ─────────────────────────────────────────────────────────────────

const AUDIT_QUESTIONS_S8 = [
  {
    clause: "8.1",
    title: "Planificación y control operacional",
    relatedClauses: ["8.1"],
    questions: [
      "¿La organización planifica, implementa y controla los procesos necesarios para la prestación del servicio?",
      "¿Existen criterios documentados para la ejecución controlada de los procesos operacionales?",
      "¿Se mantienen registros que evidencien el control de los procesos?",
      "¿Los cambios planificados se gestionan y su impacto se evalúa antes de implementarlos?",
    ],
  },
  {
    clause: "8.2",
    title: "Requisitos para los servicios",
    relatedClauses: ["8.2"],
    questions: [
      "¿Los requisitos del cliente están definidos y documentados antes de iniciar el servicio?",
      "¿Se utilizan contratos o acuerdos formales para formalizar el encargo con el cliente?",
      "¿Los requisitos legales y reglamentarios aplicables al servicio están identificados?",
      "¿Existe evidencia de revisión de requisitos previa al compromiso con el cliente?",
    ],
  },
  {
    clause: "8.4",
    title: "Control de proveedores externos",
    relatedClauses: ["8.4"],
    questions: [
      "¿Se evalúa y selecciona a proveedores en función de su capacidad para cumplir los requisitos?",
      "¿Existe un registro actualizado de evaluación de proveedores con criterios definidos?",
      "¿Se solicitan certificaciones o evidencias de calidad a los proveedores críticos?",
      "¿Se controla y supervisa el desempeño de los proveedores de forma documentada?",
    ],
  },
  {
    clause: "8.6",
    title: "Liberación de los servicios",
    relatedClauses: ["8.6"],
    questions: [
      "¿Existe un proceso documentado para la liberación y entrega del servicio al cliente?",
      "¿Se verifica el cumplimiento de los requisitos del servicio antes de la liberación?",
      "¿Se mantiene evidencia de la autorización de la liberación?",
      "¿Las no conformidades detectadas en la liberación se gestionan formalmente?",
    ],
  },
  {
    clause: "8.7",
    title: "Control de salidas no conformes",
    relatedClauses: ["8.7"],
    questions: [
      "¿Existe un registro de no conformidades detectadas durante el período auditado?",
      "¿Las salidas no conformes se identifican y controlan para prevenir su entrega al cliente?",
      "¿Las no conformidades tienen acciones correctivas asociadas y con seguimiento?",
      "¿Se analizan las causas raíz de las no conformidades recurrentes?",
    ],
  },
];

// ── Opciones de respuesta ─────────────────────────────────────────────────────

const ANSWER_OPTIONS = [
  { value: "yes",     label: "Sí",      color: "s5-ans-yes"     },
  { value: "partial", label: "Parcial", color: "s5-ans-partial"  },
  { value: "no",      label: "No",      color: "s5-ans-no"      },
  { value: "na",      label: "N/A",     color: "s5-ans-na"      },
];

const STATUS_LABEL = {
  in_progress:   "Sin evaluar",
  compliant:     "Cumple",
  partial:       "Parcial",
  non_compliant: "No cumple",
};

const STATUS_CLASS = {
  in_progress:   "s5-status-empty",
  compliant:     "s5-status-compliant",
  partial:       "s5-status-partial",
  non_compliant: "s5-status-noncompliant",
};

// ── Matriz de trazabilidad documental ─────────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  { value: "presupuesto", label: "Presupuesto" },
  { value: "contrato",    label: "Contrato"    },
  { value: "factura",     label: "Factura"     },
  { value: "albaran",     label: "Albarán"     },
  { value: "pago",        label: "Pago"        },
  { value: "entrega",     label: "Entrega"     },
  { value: "otro",        label: "Otro"        },
];

const DOC_STATUS_OPTIONS = [
  { value: "complete", label: "Verificado"    },
  { value: "partial",  label: "Parcial"       },
  { value: "missing",  label: "No encontrado" },
];

const DOC_STATUS_CONFIG = {
  complete: { label: "Verificado",    colorClass: "mat-badge-achieved"  },
  partial:  { label: "Parcial",       colorClass: "mat-badge-partial"   },
  missing:  { label: "No encontrado", colorClass: "mat-badge-cancelled" },
};

const DOC_TYPE_LABEL = Object.fromEntries(DOC_TYPE_OPTIONS.map((o) => [o.value, o.label]));

const TRACEABILITY_SCHEMA = {
  primaryField: "reference",
  statusField:  "status",
  statusConfig: DOC_STATUS_CONFIG,
  compactCols: [
    { key: "document_type" },
    { key: "date", type: "date" },
  ],
  defaultRow: () => ({
    document_type: "presupuesto",
    reference:     "",
    date:          "",
    status:        "complete",
    notes:         "",
  }),
  expandFields: [
    { key: "document_type", label: "Tipo de documento",             type: "select",   options: DOC_TYPE_OPTIONS  },
    { key: "reference",     label: "Referencia / código",           type: "text"                                 },
    { key: "date",          label: "Fecha del documento",           type: "date"                                 },
    { key: "status",        label: "Estado documental",             type: "select",   options: DOC_STATUS_OPTIONS },
    { key: "notes",         label: "Observaciones / desviaciones",  type: "textarea"                             },
  ],
};

// ── Cálculo de estado sugerido ────────────────────────────────────────────────

function severityOf(status) {
  if (status === "non_compliant") return 3;
  if (status === "partial")       return 2;
  if (status === "compliant")     return 1;
  return 0;
}

function worstStatus(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return severityOf(a) >= severityOf(b) ? a : b;
}

function computeSuggestedStatus(clauseAnswers) {
  const answers = Object.entries(clauseAnswers || {})
    .filter(([key, val]) => !key.endsWith("_comment") && !key.startsWith("_") && val)
    .map(([, val]) => val);
  if (answers.length === 0) return null;
  if (answers.some((v) => v === "no"))      return "non_compliant";
  if (answers.some((v) => v === "partial")) return "partial";
  // Todas N/A → sin conclusión aplicable (no se infiere Cumple)
  if (answers.every((v) => v === "na"))     return null;
  if (answers.every((v) => v === "yes" || v === "na")) return "compliant";
  return "partial";
}

function computeSuggestedStatus84(clauseAnswers, supplierCount, supplierScore) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  // Solo aplicar señal de proveedor cuando el campo está explícitamente relleno
  if (supplierCount == null || supplierCount === "") return questionStatus;
  const count = Number(supplierCount);
  if (!Number.isFinite(count)) return questionStatus;
  let supplierStatus = null;
  if (count === 0) supplierStatus = "non_compliant";
  else if (supplierScore != null && supplierScore !== "" && Number(supplierScore) < 5) supplierStatus = "partial";
  else supplierStatus = "compliant";
  return worstStatus(questionStatus, supplierStatus);
}

function computeSuggestedStatus86(clauseAnswers, serviceReleaseExists) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  if (serviceReleaseExists === false) return worstStatus(questionStatus, "non_compliant");
  return questionStatus;
}

function computeSuggestedStatus87(clauseAnswers, ncCount) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  const count = Number(ncCount) || 0;
  if (count > 0) {
    // q2 = "¿Las no conformidades tienen acciones correctivas asociadas y con seguimiento?"
    const actionsAnswer = (clauseAnswers || {}).q2;
    if (!actionsAnswer || actionsAnswer === "no") return worstStatus(questionStatus, "partial");
  }
  return questionStatus;
}

// ── Narrativa auditora ────────────────────────────────────────────────────────

function pl(n, singular, plural) {
  return n === 1 ? singular : plural;
}

function buildSection8DraftText(valuesByFieldCode, guidedAnswers, traceabilityMatrix, clauseChecks) {
  const parts = [];

  const supplierCount   = Number(valuesByFieldCode?.supplier_evaluation_count) || 0;
  const supplierScore   = valuesByFieldCode?.supplier_average_score;
  const supplierCriteria = (valuesByFieldCode?.supplier_evaluation_criteria || "").trim();
  const supplierSummary  = (valuesByFieldCode?.supplier_control_summary    || "").trim();
  const certRequested    = valuesByFieldCode?.suppliers_certifications_requested;

  const customerReqDefined = valuesByFieldCode?.customer_requirements_defined;
  const contractsUsed      = valuesByFieldCode?.contracts_used;
  const operationalSummary = (valuesByFieldCode?.operational_control_summary || "").trim();

  const releaseControl  = valuesByFieldCode?.service_release_control_exists;
  const releaseEvidence = (valuesByFieldCode?.release_evidence_summary || "").trim();

  const ncCount   = Number(valuesByFieldCode?.nonconformities_count) || 0;
  const ncRef     = (valuesByFieldCode?.nonconformities_document_reference || "").trim();
  const ncSummary = (valuesByFieldCode?.nonconformities_summary || "").trim();

  const sampleProject  = (valuesByFieldCode?.sample_project_name || "").trim();
  const legalSources   = (valuesByFieldCode?.legal_requirements_sources || "").trim();
  const maintenanceRef = (valuesByFieldCode?.maintenance_reference || "").trim();
  const extReviewed    = valuesByFieldCode?.extinguishers_reviewed;

  const tMatrix = Array.isArray(traceabilityMatrix) ? traceabilityMatrix : [];
  const ans81 = guidedAnswers?.["8.1"] || {};
  const ans82 = guidedAnswers?.["8.2"] || {};
  const ans84 = guidedAnswers?.["8.4"] || {};
  const ans86 = guidedAnswers?.["8.6"] || {};
  const ans87 = guidedAnswers?.["8.7"] || {};

  // 8.1 Planificación y control operacional
  {
    let block = "";
    if (operationalSummary) {
      block = operationalSummary;
    } else {
      const controlled   = ans81.q1 === "yes";
      const hasCriteria  = ans81.q2 === "yes";
      const hasRecords   = ans81.q3 === "yes";
      const changesManaged = ans81.q4 === "yes";
      const items = [];
      if (controlled)  items.push("procesos planificados y controlados para la prestación del servicio");
      if (hasCriteria) items.push("criterios documentados de ejecución");
      if (hasRecords)  items.push("registros de evidencia del control operacional");
      if (items.length > 0) {
        block = `La organización mantiene ${items.join(", ")}.`;
        if (changesManaged) block += " Los cambios planificados se gestionan evaluando su impacto antes de la implementación.";
      } else if (ans81.q1 === "no" || ans81.q2 === "no") {
        block = "Se detectan deficiencias en la planificación y control de los procesos operacionales. Se recomienda documentar los criterios de ejecución y establecer registros de control sistemático.";
      } else {
        block = "Los procesos operacionales de la organización se desarrollan de acuerdo con los requisitos establecidos del servicio.";
      }
    }
    parts.push(`PLANIFICACIÓN Y CONTROL OPERACIONAL (8.1)\n\n${block}`);
  }

  // 8.2 Requisitos del cliente
  {
    let block = "";
    if (customerReqDefined === true) {
      block = "Los requisitos del cliente están definidos y documentados previo al inicio del servicio.";
      if (contractsUsed === true) block += " Los encargos se formalizan mediante contratos o acuerdos documentados.";
      if (ans82.q3 === "yes") block += " Los requisitos legales y reglamentarios aplicables están identificados.";
    } else if (customerReqDefined === false) {
      block = "OBSERVACIÓN: Los requisitos del cliente no se documentan de forma sistemática antes del inicio del servicio. Se recomienda establecer un proceso formal de revisión y registro de requisitos previo a la aceptación del encargo.";
    } else {
      block = `Los requisitos del cliente se revisan previo a la aceptación del encargo${contractsUsed === true ? ", formalizando el encargo mediante contrato o acuerdo documentado" : ""}.`;
    }
    parts.push(`REQUISITOS PARA LOS SERVICIOS (8.2)\n\n${block}`);
  }

  // 8.4 Control de proveedores externos
  {
    let block = "";
    if (supplierCount > 0) {
      block = `Durante el período auditado se han evaluado ${supplierCount} ${pl(supplierCount, "proveedor", "proveedores")}`;
      if (supplierScore != null) block += `, con una puntuación media de ${supplierScore}/10`;
      if (supplierCriteria)     block += `. Criterios aplicados: ${supplierCriteria}`;
      block += ".";
      if (certRequested === true) block += " Se solicitan certificaciones de calidad a los proveedores de carácter crítico.";
      if (supplierSummary) block += `\n${supplierSummary}`;
      if (supplierScore != null && Number(supplierScore) < 5) {
        block += "\nOBSERVACIÓN: El score medio de proveedores se sitúa por debajo del umbral recomendado. Se recomienda revisar el panel de proveedores críticos y reforzar los criterios de selección y seguimiento.";
      }
    } else if (ans84.q1 === "yes" || ans84.q2 === "yes") {
      block = "La organización aplica criterios de evaluación y selección de proveedores externos. No se han registrado evaluaciones cuantificadas en el período auditado.";
      if (supplierSummary) block += `\n${supplierSummary}`;
    } else {
      block = "No se han registrado evaluaciones de proveedores en el período auditado. Se recomienda establecer o documentar el proceso de evaluación y selección de proveedores externos.";
    }
    parts.push(`CONTROL DE PROVEEDORES EXTERNOS (8.4)\n\n${block}`);
  }

  // Trazabilidad documental
  if (tMatrix.length > 0 || sampleProject) {
    let block = "";
    if (sampleProject) block += `Proyecto de referencia auditado: ${sampleProject}.\n`;
    if (tMatrix.length > 0) {
      const verified = tMatrix.filter((r) => r.status === "complete").length;
      const partial  = tMatrix.filter((r) => r.status === "partial").length;
      const missing  = tMatrix.filter((r) => r.status === "missing").length;
      block += `Se revisaron ${tMatrix.length} ${pl(tMatrix.length, "documento", "documentos")} en la muestra: ${verified} ${pl(verified, "verificado", "verificados")}`;
      if (partial > 0) block += `, ${partial} ${pl(partial, "parcial", "parciales")}`;
      if (missing > 0) block += `, ${missing} no ${pl(missing, "localizado", "localizados")}`;
      block += ".";
      if (missing > 0) {
        const missingNames = tMatrix
          .filter((r) => r.status === "missing")
          .map((r) => `${DOC_TYPE_LABEL[r.document_type] || r.document_type}${r.reference ? ` (${r.reference})` : ""}`);
        block += `\n${pl(missing, "Documento no localizado", "Documentos no localizados")}: ${missingNames.join(", ")}. Se recomienda verificar el archivo documental del proyecto.`;
      }
      if (partial > 0) {
        const partialNames = tMatrix
          .filter((r) => r.status === "partial")
          .map((r) => `${DOC_TYPE_LABEL[r.document_type] || r.document_type}${r.reference ? ` (${r.reference})` : ""}`);
        block += `\n${pl(partial, "Documento con trazabilidad incompleta", "Documentos con trazabilidad incompleta")}: ${partialNames.join(", ")}.`;
      }
    }
    parts.push(`TRAZABILIDAD DOCUMENTAL — MUESTRA AUDITADA\n\n${block.trim()}`);
  }

  // 8.6 Liberación
  {
    let block = "";
    if (releaseControl === true) {
      block = "La organización dispone de un proceso documentado de liberación del servicio.";
      if (releaseEvidence) block += ` ${releaseEvidence}`;
      if (ans86.q3 === "yes") block += " Se mantiene evidencia de la autorización de la liberación.";
    } else if (releaseControl === false) {
      block = "NO CONFORMIDAD POTENCIAL: No se ha evidenciado un proceso documentado de liberación del servicio. La organización debe establecer registros que acrediten que el servicio cumple los requisitos antes de su entrega al cliente.";
    } else {
      block = "El estado del control de liberación del servicio está pendiente de verificación.";
      if (releaseEvidence) block += `\n${releaseEvidence}`;
    }
    parts.push(`LIBERACIÓN DE LOS SERVICIOS (8.6)\n\n${block}`);
  }

  // 8.7 No conformidades
  {
    let block = "";
    if (ncCount === 0) {
      block = "No se han registrado no conformidades durante el período auditado.";
    } else {
      block = `Se han identificado ${ncCount} ${pl(ncCount, "no conformidad", "no conformidades")} en el período auditado`;
      if (ncRef) block += `, ${pl(ncCount, "registrada", "registradas")} en ${ncRef}`;
      block += ".";
      if (ncSummary) block += `\n${ncSummary}`;
      if (ans87.q2 === "yes") block += "\nSe han definido acciones correctivas con seguimiento asociado a las no conformidades.";
      if (ans87.q3 === "yes") block += "\nSe realiza análisis de causas raíz para las no conformidades recurrentes.";
      if (ncCount > 3) block += "\nEl volumen de no conformidades requiere un análisis sistemático de causas raíz y la implementación de acciones correctivas de carácter preventivo.";
    }
    parts.push(`CONTROL DE SALIDAS NO CONFORMES (8.7)\n\n${block}`);
  }

  // Cumplimiento legal / mantenimiento
  if (legalSources || maintenanceRef || extReviewed != null) {
    const lines = [];
    if (legalSources) lines.push(`Fuentes de requisitos legales identificadas: ${legalSources}.`);
    if (maintenanceRef) lines.push(`Sistema de mantenimiento: ${maintenanceRef}.`);
    if (extReviewed === true)  lines.push("Revisión de extintores documentada. Cumplimiento normativo verificado.");
    if (extReviewed === false) lines.push("PENDIENTE: La revisión de extintores no está documentada en el período auditado.");
    parts.push(`CUMPLIMIENTO LEGAL Y MANTENIMIENTO\n\n${lines.join("\n")}`);
  }

  // Conclusión desde cláusulas C
  const ncClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "non_compliant")
    .map((c) => c.clause_code);
  const partialClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "partial")
    .map((c) => c.clause_code);

  if (ncClauses.length > 0) {
    parts.push(
      `Desviaciones significativas detectadas en sección 8: Se han identificado incumplimientos en las cláusulas ${ncClauses.join(", ")}. Estas desviaciones requieren apertura de no conformidad y definición de acciones correctivas antes del cierre del expediente de auditoría.`
    );
  } else if (partialClauses.length > 0) {
    parts.push(
      `Observaciones de mejora en sección 8: Las cláusulas ${partialClauses.join(", ")} presentan cumplimiento parcial. Se recomienda reforzar las evidencias documentales y establecer un seguimiento de los puntos de mejora identificados antes de la próxima auditoría.`
    );
  } else {
    parts.push(
      "Conclusión: La sección 8 del sistema de gestión de la calidad presenta un nivel de cumplimiento conforme con los requisitos de la norma ISO 9001, habiendo verificado el control operacional, la definición de requisitos del cliente, la evaluación de proveedores, la trazabilidad documental de la muestra auditada y el control de la liberación del servicio."
    );
  }

  return parts.join("\n\n");
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Section8OperationPanel({
  valuesByFieldCode,
  clauseChecks,
  currentFinalText,
  onFieldChange,
  onApplyDraftText,
  onApplySuggestedClauseCheck,
  disabled,
}) {
  const [openClause, setOpenClause]       = useState(null);
  const [openCommentFor, setOpenCommentFor] = useState(null);
  const [confirmState, setConfirmState]   = useState(null);
  const [applyConfirm, setApplyConfirm]   = useState(null);

  // ── Datos derivados ────────────────────────────────────────────────────────

  const guidedAnswers = useMemo(() => {
    const raw = valuesByFieldCode?.s8_guided_answers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }, [valuesByFieldCode]);

  const traceabilityMatrix = useMemo(() => {
    const raw = valuesByFieldCode?.document_traceability_matrix;
    return Array.isArray(raw) ? raw : [];
  }, [valuesByFieldCode]);

  const hasExistingText = (currentFinalText || "").trim().length > 0;

  // ── Helpers de respuesta ───────────────────────────────────────────────────

  function getAnswer(clauseCode, qIdx) {
    return (guidedAnswers[clauseCode] || {})[`q${qIdx}`] || "";
  }

  function getComment(clauseCode, qIdx) {
    return (guidedAnswers[clauseCode] || {})[`q${qIdx}_comment`] || "";
  }

  function setAnswer(clauseCode, qIdx, value) {
    if (disabled) return;
    onFieldChange("s8_guided_answers", {
      ...guidedAnswers,
      [clauseCode]: { ...(guidedAnswers[clauseCode] || {}), [`q${qIdx}`]: value },
    });
  }

  function setComment(clauseCode, qIdx, text) {
    if (disabled) return;
    onFieldChange("s8_guided_answers", {
      ...guidedAnswers,
      [clauseCode]: { ...(guidedAnswers[clauseCode] || {}), [`q${qIdx}_comment`]: text },
    });
  }

  // ── Estado sugerido ────────────────────────────────────────────────────────

  const suggestedStatusByClause = useMemo(() => {
    const map = {};
    AUDIT_QUESTIONS_S8.forEach((item) => {
      let status;
      if (item.clause === "8.4") {
        status = computeSuggestedStatus84(
          guidedAnswers["8.4"],
          valuesByFieldCode?.supplier_evaluation_count,
          valuesByFieldCode?.supplier_average_score,
        );
      } else if (item.clause === "8.6") {
        status = computeSuggestedStatus86(
          guidedAnswers["8.6"],
          valuesByFieldCode?.service_release_control_exists,
        );
      } else if (item.clause === "8.7") {
        status = computeSuggestedStatus87(
          guidedAnswers["8.7"],
          valuesByFieldCode?.nonconformities_count,
        );
      } else {
        status = computeSuggestedStatus(guidedAnswers[item.clause]);
      }
      item.relatedClauses.forEach((code) => { map[code] = status; });
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedAnswers, valuesByFieldCode]);

  // ── Clause checks ──────────────────────────────────────────────────────────

  function getCurrentClauseStatus(clauseCode) {
    return (clauseChecks || []).find((c) => c.clause_code === clauseCode)?.clause_status || null;
  }

  function getExistingRelated(item) {
    return item.relatedClauses.filter(
      (c) => (clauseChecks || []).some((ch) => ch.clause_code === c)
    );
  }

  function handleApplyToC(item, suggestedStatus) {
    const related = getExistingRelated(item);
    if (related.length === 0) return;
    if (related.every((c) => getCurrentClauseStatus(c) === suggestedStatus)) return;

    const hasCustom = related.some((c) => {
      const s = getCurrentClauseStatus(c);
      return s && s !== "compliant" && s !== "in_progress" && s !== suggestedStatus;
    });

    if (hasCustom) {
      setApplyConfirm({ item, suggestedStatus });
    } else {
      related.forEach((c) => {
        if (getCurrentClauseStatus(c) !== suggestedStatus) {
          onApplySuggestedClauseCheck(c, suggestedStatus);
        }
      });
    }
  }

  function confirmApply() {
    if (!applyConfirm) return;
    getExistingRelated(applyConfirm.item).forEach((c) => {
      if (getCurrentClauseStatus(c) !== applyConfirm.suggestedStatus) {
        onApplySuggestedClauseCheck(c, applyConfirm.suggestedStatus);
      }
    });
    setApplyConfirm(null);
  }

  // ── Señales operacionales ──────────────────────────────────────────────────

  const operationalSignals = useMemo(() => {
    const rawSupplierCount = valuesByFieldCode?.supplier_evaluation_count;
    const supplierCountSet = rawSupplierCount != null && rawSupplierCount !== "";
    const supplierCount = supplierCountSet ? Number(rawSupplierCount) : null;
    const supplierScore = valuesByFieldCode?.supplier_average_score;
    const releaseControl = valuesByFieldCode?.service_release_control_exists;
    const ncCount = Number(valuesByFieldCode?.nonconformities_count) || 0;
    const tMatrix = traceabilityMatrix;

    const supplierSig = (() => {
      if (!supplierCountSet)
        return { id: "suppliers", label: "Proveedores evaluados", status: "neutral", detail: "Sin datos" };
      if (supplierCount === 0)
        return { id: "suppliers", label: "Proveedores evaluados", status: "critical", detail: "Sin evaluaciones" };
      if (supplierScore != null && supplierScore !== "" && Number(supplierScore) < 5)
        return { id: "suppliers", label: "Proveedores evaluados", status: "warning", detail: `${supplierCount} eval. · Score ${supplierScore}/10` };
      return { id: "suppliers", label: "Proveedores evaluados", status: "ok", detail: `${supplierCount} ${pl(supplierCount, "evaluado", "evaluados")}` };
    })();

    const traceSig = (() => {
      if (tMatrix.length === 0)
        return { id: "traceability", label: "Trazabilidad documental", status: "neutral", detail: "Sin registros" };
      const missing = tMatrix.filter((r) => r.status === "missing").length;
      const partial  = tMatrix.filter((r) => r.status === "partial").length;
      if (missing > 0)
        return { id: "traceability", label: "Trazabilidad documental", status: "warning", detail: `${missing} doc. no ${pl(missing, "localizado", "localizados")}` };
      if (partial > 0)
        return { id: "traceability", label: "Trazabilidad documental", status: "warning", detail: `${partial} ${pl(partial, "parcial", "parciales")}` };
      return { id: "traceability", label: "Trazabilidad documental", status: "ok", detail: `${tMatrix.length} ${pl(tMatrix.length, "verificado", "verificados")}` };
    })();

    const releaseSig = (() => {
      if (releaseControl === true)  return { id: "release", label: "Liberación controlada", status: "ok",       detail: "Documentada"             };
      if (releaseControl === false) return { id: "release", label: "Liberación controlada", status: "critical", detail: "Sin control documentado"  };
      return                               { id: "release", label: "Liberación controlada", status: "neutral",  detail: "Sin datos"                };
    })();

    const ncSig = (() => {
      if (ncCount === 0)  return { id: "nc", label: "No conformidades", status: "ok",       detail: "Sin NCs registradas"            };
      if (ncCount <= 2)   return { id: "nc", label: "No conformidades", status: "warning",  detail: `${ncCount} NC ${pl(ncCount, "registrada", "registradas")}` };
      return                     { id: "nc", label: "No conformidades", status: "critical",  detail: `${ncCount} NCs — revisión requerida` };
    })();

    const statuses = [supplierSig.status, traceSig.status, releaseSig.status, ncSig.status];
    const riskStatus = statuses.includes("critical") ? "critical"
                     : statuses.includes("warning")  ? "warning"
                     : statuses.filter((s) => s === "ok").length >= 3 ? "ok"
                     : "neutral";
    const riskSig = {
      id: "risk", label: "Riesgo operacional",
      status: riskStatus,
      detail: riskStatus === "critical" ? "Crítico — acción requerida"
            : riskStatus === "warning"  ? "Moderado — revisar"
            : riskStatus === "ok"       ? "Controlado"
            :                             "Sin evaluar",
    };

    return [supplierSig, traceSig, releaseSig, ncSig, riskSig];
  }, [valuesByFieldCode, traceabilityMatrix]);

  // ── Riesgos automáticos ────────────────────────────────────────────────────

  const operationalRisks = useMemo(() => {
    const risks = [];
    const rawSupplierCount = valuesByFieldCode?.supplier_evaluation_count;
    const supplierCountSet = rawSupplierCount != null && rawSupplierCount !== "";
    const supplierCount = supplierCountSet ? Number(rawSupplierCount) : null;
    const supplierScore = valuesByFieldCode?.supplier_average_score;
    const releaseControl = valuesByFieldCode?.service_release_control_exists;
    const ncCount = Number(valuesByFieldCode?.nonconformities_count) || 0;

    // Solo alertar de proveedores cuando el campo está explícitamente relleno
    if (supplierCountSet && supplierCount === 0) {
      risks.push({ id: "no_supplier", label: "Proveedor crítico sin evaluación documentada", severity: "critical" });
    } else if (supplierCountSet && supplierScore != null && supplierScore !== "" && Number(supplierScore) < 5) {
      risks.push({ id: "low_score", label: `Score de proveedor bajo (${supplierScore}/10) — revisar panel de proveedores`, severity: "warning" });
    }
    if (releaseControl === false) {
      risks.push({ id: "no_release", label: "Liberación del servicio sin evidencia documental", severity: "critical" });
    }
    if (traceabilityMatrix.length === 0) {
      risks.push({ id: "no_trace", label: "Trazabilidad documental no registrada en la muestra auditada", severity: "warning" });
    } else {
      const missing = traceabilityMatrix.filter((r) => r.status === "missing").length;
      if (missing > 0) {
        risks.push({ id: "missing_docs", label: `${missing} ${pl(missing, "documento no localizado", "documentos no localizados")} en la muestra`, severity: "warning" });
      }
    }
    if (ncCount > 3) {
      risks.push({ id: "high_nc", label: `${ncCount} no conformidades registradas — riesgo de recurrencia`, severity: "critical" });
    } else if (ncCount > 0) {
      risks.push({ id: "some_nc", label: `${ncCount} ${pl(ncCount, "no conformidad pendiente", "no conformidades pendientes")} de seguimiento`, severity: "warning" });
    }
    return risks;
  }, [valuesByFieldCode, traceabilityMatrix]);

  // ── Contadores ─────────────────────────────────────────────────────────────

  const answeredCount = useMemo(() => {
    let count = 0;
    AUDIT_QUESTIONS_S8.forEach(({ clause, questions }) => {
      questions.forEach((_, idx) => { if (getAnswer(clause, idx)) count++; });
    });
    return count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedAnswers]);

  const totalQuestions = AUDIT_QUESTIONS_S8.reduce((acc, { questions }) => acc + questions.length, 0);

  // ── Generador de texto ─────────────────────────────────────────────────────

  function handleGenerateClick() {
    if (hasExistingText) setConfirmState("confirming");
    else applyGenerated("replace");
  }

  function applyGenerated(mode) {
    const generated = buildSection8DraftText(
      valuesByFieldCode || {},
      guidedAnswers,
      traceabilityMatrix,
      clauseChecks || [],
    );
    if (mode === "append") {
      const base = (currentFinalText || "").trimEnd();
      onApplyDraftText(`${base}\n\n${generated}`);
    } else {
      onApplyDraftText(generated);
    }
    setConfirmState(null);
  }

  // ── Icono de señal ─────────────────────────────────────────────────────────

  function signalIcon(status) {
    if (status === "ok")       return "✓";
    if (status === "warning")  return "⚠";
    if (status === "critical") return "✕";
    return "·";
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="s5-panel">

      {/* ── Barra de señales operacionales ── */}
      <div className="s8-summary-bar">
        {operationalSignals.map((sig) => (
          <div key={sig.id} className={`s8-signal s8-signal-${sig.status}`}>
            <span className="s8-signal-icon" aria-hidden="true">{signalIcon(sig.status)}</span>
            <div className="s8-signal-body">
              <span className="s8-signal-label">{sig.label}</span>
              <span className="s8-signal-detail">{sig.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Riesgos operacionales automáticos ── */}
      {operationalRisks.length > 0 && (
        <div className="s8-risks-block">
          <div className="s8-risks-header">
            <span className="s8-risks-title">Señales de riesgo operacional</span>
            <span className="s8-risks-subtitle">Calculado automáticamente desde los datos auditados</span>
          </div>
          <div className="s8-risks-list">
            {operationalRisks.map((risk) => (
              <div key={risk.id} className={`s8-risk-item s8-risk-${risk.severity}`}>
                <span className="s8-risk-icon" aria-hidden="true">
                  {risk.severity === "critical" ? "✕" : "⚠"}
                </span>
                <span className="s8-risk-label">{risk.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Verificación por cláusula ── */}
      <section className="s5-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Verificación por cláusula</h4>
          <p className="s5-block-desc">
            Responde las preguntas guiadas por cláusula. El estado sugerido se calcula
            automáticamente y puede aplicarse al bloque C. Preguntas respondidas:{" "}
            <strong>{answeredCount}/{totalQuestions}</strong>.
          </p>
        </div>

        <div className="s5-clauses">
          {AUDIT_QUESTIONS_S8.map((item) => {
            const isOpen = openClause === item.clause;
            const sug = suggestedStatusByClause[item.clause];
            const related = getExistingRelated(item);
            const clauseAnswers = guidedAnswers[item.clause] || {};
            const answeredInClause = item.questions.filter((_, i) => clauseAnswers[`q${i}`]).length;
            const allSynced = sug && related.length > 0 && related.every(
              (c) => getCurrentClauseStatus(c) === sug
            );

            return (
              <div key={item.clause} className={`s5-clause-block${isOpen ? " s5-clause-open" : ""}`}>
                <button
                  type="button"
                  className="s5-clause-toggle"
                  onClick={() => setOpenClause(isOpen ? null : item.clause)}
                >
                  <span className="s5-clause-code">{item.clause}</span>
                  <span className="s5-clause-name">{item.title}</span>
                  {answeredInClause > 0 && (
                    <span className="s5-clause-progress">
                      {answeredInClause}/{item.questions.length}
                    </span>
                  )}
                  {sug && (
                    <span className={`s5-clause-badge ${STATUS_CLASS[sug]}`}>
                      {STATUS_LABEL[sug]}
                    </span>
                  )}
                  <span className="s5-clause-arrow" aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="s5-clause-body">

                    {/* 8.4: snapshot de proveedores */}
                    {item.clause === "8.4" && (
                      <div className="s5-context-zone">
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Datos de proveedores (contexto)</span>
                          <div className="s8-supplier-snapshot">
                            <span className="s8-snapshot-item">
                              <span className="s8-snapshot-key">Evaluaciones:</span>
                              <span className="s8-snapshot-val">
                                {valuesByFieldCode?.supplier_evaluation_count ?? "—"}
                              </span>
                            </span>
                            <span className="s8-snapshot-item">
                              <span className="s8-snapshot-key">Score medio:</span>
                              <span className="s8-snapshot-val">
                                {valuesByFieldCode?.supplier_average_score != null
                                  ? `${valuesByFieldCode.supplier_average_score}/10`
                                  : "—"}
                              </span>
                            </span>
                            <span className="s8-snapshot-item">
                              <span className="s8-snapshot-key">Certificaciones:</span>
                              <span className="s8-snapshot-val">
                                {valuesByFieldCode?.suppliers_certifications_requested === true  ? "Solicitadas"
                                : valuesByFieldCode?.suppliers_certifications_requested === false ? "No solicitadas"
                                : "—"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 8.6: aviso si no hay control de liberación */}
                    {item.clause === "8.6" && valuesByFieldCode?.service_release_control_exists === false && (
                      <div className="s5-context-zone">
                        <div className="s5-context-wide">
                          <span className="s7-accessible-warning">
                            Desviación — liberación del servicio sin control documentado
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 8.7: snapshot de no conformidades */}
                    {item.clause === "8.7" && Number(valuesByFieldCode?.nonconformities_count) > 0 && (
                      <div className="s5-context-zone">
                        <div className="s5-context-wide">
                          <span className="s5-context-label">No conformidades registradas</span>
                          <div className="s8-supplier-snapshot">
                            <span className="s8-snapshot-item">
                              <span className="s8-snapshot-key">Cantidad:</span>
                              <span className="s8-snapshot-val">{valuesByFieldCode.nonconformities_count}</span>
                            </span>
                            {valuesByFieldCode?.nonconformities_document_reference && (
                              <span className="s8-snapshot-item">
                                <span className="s8-snapshot-key">Referencia:</span>
                                <span className="s8-snapshot-val">{valuesByFieldCode.nonconformities_document_reference}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Preguntas guiadas */}
                    <ul className="s5-question-list">
                      {item.questions.map((q, idx) => {
                        const answer  = getAnswer(item.clause, idx);
                        const comment = getComment(item.clause, idx);
                        const commentKey = `${item.clause}:q${idx}`;
                        const commentOpen = openCommentFor === commentKey;

                        return (
                          <li
                            key={idx}
                            className={`s5-question-item${answer ? ` s5-q-answered-${answer}` : ""}`}
                          >
                            <div className="s5-question-row">
                              <span className="s5-question-text">{q}</span>
                              <div className="s5-answer-group" role="group" aria-label={`Respuesta: ${q}`}>
                                {ANSWER_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    className={`s5-answer-btn ${opt.color}${answer === opt.value ? " s5-answer-active" : ""}`}
                                    onClick={() => setAnswer(item.clause, idx, answer === opt.value ? "" : opt.value)}
                                    disabled={disabled}
                                    aria-pressed={answer === opt.value}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  className={`s5-comment-toggle${comment || commentOpen ? " s5-comment-has-text" : ""}`}
                                  onClick={() => setOpenCommentFor(commentOpen ? null : commentKey)}
                                  disabled={disabled}
                                  title="Añadir comentario"
                                  aria-expanded={commentOpen}
                                >
                                  {comment ? "✎" : "+"}
                                </button>
                              </div>
                            </div>
                            {(commentOpen || comment) && (
                              <textarea
                                className="s5-question-comment"
                                value={comment}
                                placeholder="Evidencia revisada, observación o incidencia concreta..."
                                rows={2}
                                disabled={disabled}
                                onChange={(e) => setComment(item.clause, idx, e.target.value)}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* Footer: estado sugerido + aplicar a C */}
                    <div className="s5-clause-footer">
                      {sug ? (
                        <>
                          <span className={`s5-suggested-badge ${STATUS_CLASS[sug]}`}>
                            Sugerido: {STATUS_LABEL[sug]}
                          </span>
                          {related.length > 0 && (
                            <span className="s5-current-badge soft-label">
                              {related.length > 1
                                ? `Aplica a: ${related.join(", ")}`
                                : `C actual: ${STATUS_LABEL[getCurrentClauseStatus(related[0])] || "—"}`}
                            </span>
                          )}
                          {!allSynced ? (
                            <button
                              type="button"
                              className="btn-secondary s5-apply-btn"
                              onClick={() => handleApplyToC(item, sug)}
                              disabled={disabled}
                            >
                              Aplicar a bloque C
                            </button>
                          ) : (
                            <span className="soft-label s5-synced-label">✓ Sincronizado con C</span>
                          )}
                        </>
                      ) : (
                        <span className="soft-label">Sin respuestas — estado no calculado</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Confirmación apply-to-C ── */}
      {applyConfirm && (
        <div className="s5-confirm-box">
          <p className="s5-confirm-msg">
            {applyConfirm.item.relatedClauses.length > 1
              ? <>Las cláusulas <strong>{applyConfirm.item.relatedClauses.join(", ")}</strong> ya tienen estados establecidos. ¿Aplicar la sugerencia <strong>"{STATUS_LABEL[applyConfirm.suggestedStatus]}"</strong> a todas?</>
              : <>La cláusula <strong>{applyConfirm.item.relatedClauses[0]}</strong> ya tiene un estado establecido. ¿Reemplazarlo con <strong>"{STATUS_LABEL[applyConfirm.suggestedStatus]}"</strong>?</>
            }
          </p>
          <div className="s5-confirm-actions">
            <button type="button" className="btn-primary" onClick={confirmApply}>
              Sí, aplicar sugerencia
            </button>
            <button type="button" className="btn-ghost" onClick={() => setApplyConfirm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Matriz de trazabilidad documental ── */}
      <section className="s5-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Matriz de trazabilidad documental</h4>
          <p className="s5-block-desc">
            Registra los documentos de la muestra auditada: presupuesto, contrato, factura, albarán, pago y entrega.
            Cada fila incluye referencia, fecha y estado de verificación.
          </p>
        </div>

        {traceabilityMatrix.length > 0 && (
          <div className="s7-matrix-summary">
            {[
              { key: "complete", label: pl(traceabilityMatrix.filter(r => r.status === "complete").length, "Verificado", "Verificados"), cls: "s7-ms-valid"    },
              { key: "partial",  label: pl(traceabilityMatrix.filter(r => r.status === "partial").length,  "Parcial",    "Parciales"),   cls: "s7-ms-pending"  },
              { key: "missing",  label: "No localizados",                                                                               cls: "s7-ms-expired"  },
            ].map(({ key, label, cls }) => {
              const count = traceabilityMatrix.filter((r) => r.status === key).length;
              if (!count) return null;
              return (
                <span key={key} className={`s7-ms-chip ${cls}`}>
                  {count} {label}
                </span>
              );
            })}
          </div>
        )}

        <EditableAuditMatrix
          value={traceabilityMatrix}
          onChange={(rows) => !disabled && onFieldChange("document_traceability_matrix", rows)}
          schema={TRACEABILITY_SCHEMA}
          addLabel="Añadir documento"
          emptyText="Sin documentos registrados. Añade los documentos de la muestra auditada."
          disabled={disabled}
        />
      </section>

      {/* ── Generador de texto narrativo ── */}
      <section className="s5-block s5-draft-block">
        <div className="s5-draft-row">
          <div className="s5-block-intro">
            <h4 className="s5-block-title">Generar texto narrativo del informe</h4>
            <p className="s5-block-desc">
              Crea un borrador con lenguaje auditor profesional a partir de los datos de proveedores,
              la trazabilidad documental, las respuestas guiadas y el estado de cláusulas. Edítalo en el bloque D.
            </p>
          </div>
          {confirmState !== "confirming" && (
            <button
              type="button"
              className="btn-primary s5-generate-btn"
              onClick={handleGenerateClick}
              disabled={disabled}
            >
              Generar borrador
            </button>
          )}
        </div>

        {confirmState === "confirming" && (
          <div className="s5-confirm-box">
            <p className="s5-confirm-msg">
              El bloque D ya contiene texto. ¿Qué deseas hacer?
            </p>
            <div className="s5-confirm-actions">
              <button type="button" className="btn-primary" onClick={() => applyGenerated("replace")}>
                Reemplazar texto
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyGenerated("append")}>
                Añadir al final
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmState(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
