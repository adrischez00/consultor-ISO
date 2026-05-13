import { useState, useMemo } from "react";
import EditableAuditMatrix from "./EditableAuditMatrix";

// ── Preguntas por cláusula ────────────────────────────────────────────────────

const AUDIT_QUESTIONS_S6 = [
  {
    clause: "6.1",
    title: "Riesgos y oportunidades",
    questions: [
      "¿El documento P09 de riesgos y oportunidades está completo y actualizado?",
      "¿Se han definido acciones concretas para los riesgos más relevantes identificados?",
      "¿Existe evidencia de que las acciones se han implementado y se evalúa su eficacia?",
      "¿El análisis DAFO refleja el contexto actual de la organización?",
      "¿Las oportunidades identificadas generan acciones reales de mejora?",
    ],
  },
  {
    clause: "6.2",
    title: "Objetivos de la calidad",
    questions: [
      "¿Todos los objetivos tienen indicador cuantificado y meta definida?",
      "¿Existe seguimiento documentado de los resultados obtenidos?",
      "¿Los objetivos no alcanzados tienen acciones correctivas asociadas?",
      "¿Los objetivos son coherentes con la política de calidad y el contexto actual?",
    ],
  },
  {
    clause: "6.3",
    title: "Planificación de los cambios",
    questions: [
      "¿Los cambios en el SGC se planifican antes de implementarse?",
      "¿Se evalúa el impacto de los cambios en la integridad del sistema?",
      "¿Se asignan responsables y recursos para cada cambio planificado?",
      "¿Los cambios completados están documentados, comunicados y con evidencia?",
    ],
  },
];

const ANSWER_OPTIONS = [
  { value: "yes",     label: "Sí",      color: "s5-ans-yes"     },
  { value: "partial", label: "Parcial", color: "s5-ans-partial"  },
  { value: "no",      label: "No",      color: "s5-ans-no"      },
  { value: "na",      label: "N/A",     color: "s5-ans-na"      },
];

// ── Status constants ──────────────────────────────────────────────────────────

const STATUS_LABEL = {
  compliant:     "Cumple",
  partial:       "Parcial",
  non_compliant: "No cumple",
};

const STATUS_CLASS = {
  compliant:     "s5-status-compliant",
  partial:       "s5-status-partial",
  non_compliant: "s5-status-noncompliant",
};

// ── Matrix schemas ────────────────────────────────────────────────────────────

const OBJECTIVE_STATUS_OPTIONS = [
  { value: "achieved",     label: "Alcanzado"              },
  { value: "partial",      label: "Parcialmente alcanzado" },
  { value: "not_achieved", label: "No alcanzado"           },
  { value: "in_progress",  label: "En seguimiento"         },
  { value: "cancelled",    label: "Cancelado"              },
];

const OBJECTIVE_STATUS_CONFIG = {
  achieved:     { label: "Alcanzado",              colorClass: "mat-badge-achieved"     },
  partial:      { label: "Parcialmente alcanzado", colorClass: "mat-badge-partial"      },
  not_achieved: { label: "No alcanzado",           colorClass: "mat-badge-not-achieved" },
  in_progress:  { label: "En seguimiento",         colorClass: "mat-badge-progress"     },
  cancelled:    { label: "Cancelado",              colorClass: "mat-badge-cancelled"    },
};

const OBJECTIVES_SCHEMA = {
  primaryField: "objective",
  statusField: "status",
  statusConfig: OBJECTIVE_STATUS_CONFIG,
  compactCols: [
    { key: "responsible", label: "Responsable" },
    { key: "deadline",    label: "Plazo", type: "date" },
  ],
  defaultRow: () => ({
    objective: "", indicator: "", target: "", result: "",
    status: "in_progress", responsible: "", deadline: "", evidence: "", corrective: "",
  }),
  expandFields: [
    { key: "objective",  label: "Objetivo",               type: "text",     wide: true, placeholder: "Descripción del objetivo de calidad..." },
    { key: "indicator",  label: "Indicador",              type: "text",     placeholder: "Indicador de medición..."   },
    { key: "target",     label: "Meta",                   type: "text",     placeholder: "Valor objetivo..."          },
    { key: "result",     label: "Resultado",              type: "text",     placeholder: "Valor obtenido..."          },
    { key: "status",     label: "Estado",                 type: "select",   options: OBJECTIVE_STATUS_OPTIONS         },
    { key: "responsible",label: "Responsable",            type: "text",     placeholder: "Responsable del objetivo..."},
    { key: "deadline",   label: "Plazo",                  type: "date"                                                },
    { key: "evidence",   label: "Evidencia",              type: "text",     wide: true, placeholder: "Documento o referencia de seguimiento..." },
    {
      key: "corrective", label: "Acción correctiva",     type: "textarea", wide: true,
      placeholder: "Acción definida para alcanzar o mejorar el objetivo...",
      showIf: (row) => !["achieved", "cancelled"].includes(row.status),
    },
  ],
};

const CHANGE_TYPE_OPTIONS = [
  { value: "process",   label: "Proceso"     },
  { value: "document",  label: "Documento"   },
  { value: "structure", label: "Estructura"  },
  { value: "resource",  label: "Recurso"     },
  { value: "scope",     label: "Alcance"     },
  { value: "other",     label: "Otro"        },
];

const CHANGE_TYPE_CONFIG = {
  process:   { label: "Proceso",    colorClass: "mat-badge-type" },
  document:  { label: "Documento",  colorClass: "mat-badge-type" },
  structure: { label: "Estructura", colorClass: "mat-badge-type" },
  resource:  { label: "Recurso",    colorClass: "mat-badge-type" },
  scope:     { label: "Alcance",    colorClass: "mat-badge-type" },
  other:     { label: "Otro",       colorClass: "mat-badge-type" },
};

const CHANGE_STATUS_OPTIONS = [
  { value: "planned",     label: "Planificado"  },
  { value: "in_progress", label: "En ejecución" },
  { value: "completed",   label: "Implementado" },
  { value: "cancelled",   label: "Cancelado"    },
];

const CHANGE_STATUS_CONFIG = {
  planned:     { label: "Planificado",  colorClass: "mat-badge-progress"  },
  in_progress: { label: "En ejecución", colorClass: "mat-badge-partial"   },
  completed:   { label: "Implementado", colorClass: "mat-badge-achieved"  },
  cancelled:   { label: "Cancelado",    colorClass: "mat-badge-cancelled" },
};

const CHANGES_SCHEMA = {
  primaryField: "change",
  statusField:  "status",
  typeField:    "type",
  statusConfig: CHANGE_STATUS_CONFIG,
  typeConfig:   CHANGE_TYPE_CONFIG,
  compactCols: [
    { key: "responsible",  label: "Responsable" },
    { key: "planned_date", label: "Fecha", type: "date" },
  ],
  defaultRow: () => ({
    change: "", type: "process", reason: "", impact: "", risks: "",
    resources: "", responsible: "", status: "planned", planned_date: "", evidence: "",
  }),
  expandFields: [
    { key: "change",        label: "Cambio / descripción",   type: "text",     wide: true, placeholder: "Descripción del cambio en el SGC..."    },
    { key: "type",          label: "Tipo de cambio",         type: "select",   options: CHANGE_TYPE_OPTIONS                                      },
    { key: "status",        label: "Estado",                 type: "select",   options: CHANGE_STATUS_OPTIONS                                    },
    { key: "reason",        label: "Motivo",                 type: "textarea", wide: true, placeholder: "Causa o necesidad que origina el cambio..."},
    { key: "impact",        label: "Impacto en el SGC",      type: "textarea", wide: true, placeholder: "Cómo afecta a procesos, roles, documentos..."},
    { key: "risks",         label: "Riesgos asociados",      type: "text",     placeholder: "Riesgos derivados de la implementación..."          },
    { key: "resources",     label: "Recursos necesarios",    type: "text",     placeholder: "Formación, presupuesto, tiempo estimado..."         },
    { key: "responsible",   label: "Responsable",            type: "text",     placeholder: "Persona o área responsable..."                      },
    { key: "planned_date",  label: "Fecha planificada",      type: "date"                                                                        },
    { key: "evidence",      label: "Evidencia",              type: "text",     wide: true, placeholder: "Documento, acta o referencia..."         },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIsoDate(dateStr) {
  if (!dateStr) return "";
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dateStr;
}

function computeSuggestedStatus(clauseAnswers) {
  if (!clauseAnswers || typeof clauseAnswers !== "object") return null;
  const answers = Object.entries(clauseAnswers)
    .filter(([key, val]) => !key.endsWith("_comment") && val)
    .map(([, val]) => val);
  if (answers.length === 0) return null;
  const realAnswers = answers.filter((a) => a !== "na");
  if (realAnswers.length === 0) return null;
  if (realAnswers.some((a) => a === "no")) return "non_compliant";
  if (realAnswers.some((a) => a === "partial")) return "partial";
  return "compliant";
}

function severityOf(status) {
  if (status === "non_compliant") return 3;
  if (status === "partial") return 2;
  if (status === "compliant") return 1;
  return 0;
}

function worstStatus(a, b) {
  if (!a) return b;
  if (!b) return a;
  return severityOf(a) >= severityOf(b) ? a : b;
}

function computeSuggestedStatus62(clauseAnswers, objectivesMatrix) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  let matrixStatus = null;
  const rows = Array.isArray(objectivesMatrix) ? objectivesMatrix : [];
  if (rows.length > 0) {
    const hasBlocker = rows.some(
      (r) => r.status === "not_achieved" && !String(r.corrective || "").trim()
    );
    if (hasBlocker) {
      matrixStatus = "non_compliant";
    } else if (rows.some((r) => ["not_achieved", "partial", "in_progress"].includes(r.status))) {
      // not_achieved with corrective defined → partial (not blocking, but not full compliance)
      matrixStatus = "partial";
    } else if (rows.every((r) => r.status === "achieved")) {
      matrixStatus = "compliant";
    }
  }
  return worstStatus(questionStatus, matrixStatus);
}

function computeSuggestedStatus63(clauseAnswers, changesLog) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  let logStatus = null;
  const rows = Array.isArray(changesLog) ? changesLog : [];
  if (rows.length > 0) {
    const hasInProgressNoEvidence = rows.some(
      (r) => r.status === "in_progress" && !String(r.evidence || "").trim()
    );
    if (hasInProgressNoEvidence) logStatus = "partial";
    else if (rows.every((r) => r.status === "completed")) logStatus = "compliant";
    else if (rows.some((r) => ["planned", "in_progress"].includes(r.status))) logStatus = "partial";
  }
  return worstStatus(questionStatus, logStatus);
}

// ── Narrative builder ─────────────────────────────────────────────────────────

function buildQuestionNarrative(questions, clauseAnswers) {
  const lines = [];
  questions.forEach((q, idx) => {
    const answer = (clauseAnswers || {})[`q${idx}`] || "";
    const comment = ((clauseAnswers || {})[`q${idx}_comment`] || "").trim();
    if (!answer || answer === "na") return;
    if (answer === "yes") {
      lines.push(`✓ ${q}${comment ? ` (${comment})` : ""}`);
    } else if (answer === "partial") {
      lines.push(`~ ${q}${comment ? ` — ${comment}` : " — Cumplimiento parcial."}`);
    } else if (answer === "no") {
      lines.push(`✗ ${q}${comment ? ` — ${comment}` : " — No evidenciado."}`);
    }
  });
  return lines;
}

const CHANGE_TYPE_LABELS = {
  process: "proceso", document: "documento", structure: "estructura",
  resource: "recurso", scope: "alcance", other: "otro",
};

function buildSection6DraftText(values, clauseChecks, guidedAnswers, objectivesMatrix, changesLog) {
  const parts = [];
  const ga = guidedAnswers && typeof guidedAnswers === "object" ? guidedAnswers : {};

  // ── 6.1 ──────────────────────────────────────────────────────────────────
  {
    let block = "6.1 Riesgos y oportunidades — Verificación:\n";
    const ga61 = ga["6.1"] || {};
    const hasGa61 = Object.keys(ga61).some((k) => !k.endsWith("_comment") && ga61[k]);
    if (hasGa61) {
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S6[0].questions, ga61);
      block += lines.length > 0 ? lines.join("\n") : "Se han revisado los requisitos de la cláusula 6.1.";
    } else {
      block += "Se ha verificado el documento P09 de riesgos y oportunidades. Responde las preguntas guiadas para una narrativa más detallada.";
    }
    parts.push(block);
  }

  // ── 6.2 ──────────────────────────────────────────────────────────────────
  {
    let block = "6.2 Objetivos de la calidad — Estado:\n";
    const ga62 = ga["6.2"] || {};
    const hasGa62 = Object.keys(ga62).some((k) => !k.endsWith("_comment") && ga62[k]);
    const matrix = Array.isArray(objectivesMatrix) ? objectivesMatrix : [];
    const refDoc = (values.objectives_reference_document || "").trim();

    if (matrix.length > 0) {
      const total = matrix.length;
      const achieved = matrix.filter((r) => r.status === "achieved").length;
      const notAchieved = matrix.filter((r) => r.status === "not_achieved");
      const partialObjs = matrix.filter((r) => r.status === "partial");
      const inProgress = matrix.filter((r) => r.status === "in_progress");

      if (refDoc) block += `Objetivos recogidos en: ${refDoc}.\n`;
      block += `Se han establecido ${total} objetivo${total !== 1 ? "s" : ""} de calidad para el periodo auditado. `;
      block += `${achieved} ${achieved === 1 ? "ha sido alcanzado" : "han sido alcanzados"}.`;

      if (notAchieved.length > 0) {
        block += "\n\nObjetivos no alcanzados:";
        notAchieved.forEach((r) => {
          block += `\n— ${r.objective || "Sin descripción"}`;
          if (r.indicator) block += ` | Indicador: ${r.indicator}`;
          if (r.target) block += ` | Meta: ${r.target}`;
          if (r.result) block += ` | Resultado: ${r.result}`;
          if (r.corrective) block += `\n  Acción correctiva: ${r.corrective.endsWith(".") ? r.corrective : `${r.corrective}.`}`;
          else block += "\n  Sin acción correctiva definida.";
        });
      }

      if (partialObjs.length > 0) {
        block += `\n\nObjetivo${partialObjs.length !== 1 ? "s" : ""} parcialmente alcanzado${partialObjs.length !== 1 ? "s" : ""}:`;
        partialObjs.forEach((r) => {
          block += `\n— ${r.objective || "Sin descripción"}`;
          if (r.result) block += ` (resultado: ${r.result})`;
          if (r.corrective) block += `\n  Acción correctiva: ${r.corrective.endsWith(".") ? r.corrective : `${r.corrective}.`}`;
        });
      }

      if (inProgress.length > 0) {
        block += `\n\n${inProgress.length} objetivo${inProgress.length !== 1 ? "s" : ""} en seguimiento activo.`;
        inProgress.forEach((r) => {
          if (r.objective) block += `\n— ${r.objective}${r.result ? ` (resultado parcial: ${r.result})` : ""}`;
        });
      }

      if (hasGa62) {
        const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S6[1].questions, ga62);
        if (lines.length > 0) block += "\n\nVerificación adicional:\n" + lines.join("\n");
      }
    } else if (hasGa62) {
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S6[1].questions, ga62);
      block += lines.length > 0 ? lines.join("\n") : "Se han revisado los requisitos de la cláusula 6.2.";
    } else {
      // Fallback legacy
      const current = Array.isArray(values.current_objectives)
        ? values.current_objectives.filter(Boolean)
        : [];
      const isMeasurable = values.objectives_are_measurable;
      if (refDoc) block += `Los objetivos de calidad están recogidos en ${refDoc}.`;
      if (current.length > 0) block += `\nObjetivos del periodo:\n${current.map((o) => `— ${o}`).join("\n")}`;
      if (isMeasurable === true) block += "\nTodos los objetivos tienen indicador y meta definidos.";
      else if (isMeasurable === false) block += "\nSe detectan objetivos sin indicador cuantificado.";
      if (!refDoc && current.length === 0) {
        block += "No se han registrado objetivos de calidad. Se recomienda completar la matriz de objetivos.";
      }
    }
    parts.push(block);
  }

  // ── 6.3 ──────────────────────────────────────────────────────────────────
  {
    let block = "6.3 Planificación de los cambios:\n";
    const ga63 = ga["6.3"] || {};
    const hasGa63 = Object.keys(ga63).some((k) => !k.endsWith("_comment") && ga63[k]);
    const log = Array.isArray(changesLog) ? changesLog : [];
    const reviewDate = values.management_review_planned_date || "";

    if (log.length > 0) {
      const total = log.length;
      const completed = log.filter((r) => r.status === "completed");
      const inProgress = log.filter((r) => r.status === "in_progress");
      const planned = log.filter((r) => r.status === "planned");

      if (reviewDate) block += `Revisión SGC planificada: ${formatIsoDate(reviewDate)}.\n`;
      block += `Se han registrado ${total} cambio${total !== 1 ? "s" : ""} en el SGC durante el periodo auditado.`;

      if (completed.length > 0) {
        block += "\n\nCambios implementados:";
        completed.forEach((r) => {
          const typeLabel = CHANGE_TYPE_LABELS[r.type] || "";
          block += `\n— ${r.change || "Sin descripción"}${typeLabel ? ` (${typeLabel})` : ""}`;
          if (r.reason) block += `: ${r.reason.endsWith(".") ? r.reason : `${r.reason}.`}`;
          if (r.responsible) block += ` Responsable: ${r.responsible}.`;
          if (r.evidence) block += ` Evidencia: ${r.evidence}.`;
        });
      }

      if (inProgress.length > 0) {
        block += `\n\n${inProgress.length} cambio${inProgress.length !== 1 ? "s" : ""} en ejecución.`;
      }
      if (planned.length > 0) {
        block += ` ${planned.length} cambio${planned.length !== 1 ? "s" : ""} planificado${planned.length !== 1 ? "s" : ""} pendiente${planned.length !== 1 ? "s" : ""}.`;
      }

      if (hasGa63) {
        const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S6[2].questions, ga63);
        if (lines.length > 0) block += "\n\nVerificación adicional:\n" + lines.join("\n");
      }
    } else if (hasGa63) {
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S6[2].questions, ga63);
      if (reviewDate) block += `Revisión SGC planificada: ${formatIsoDate(reviewDate)}.\n`;
      block += lines.length > 0 ? lines.join("\n") : "Se han revisado los requisitos de la cláusula 6.3.";
    } else {
      // Fallback legacy
      const extraordinaryExists = values.extraordinary_changes_exist;
      const extraordinarySummary = (values.extraordinary_changes_summary || "").trim();
      const methodSummary = (values.change_planning_method_summary || "").trim();
      if (reviewDate) block += `Revisión SGC planificada: ${formatIsoDate(reviewDate)}.\n`;
      if (extraordinaryExists === true && extraordinarySummary) {
        block += `Se han producido cambios extraordinarios: ${extraordinarySummary.endsWith(".") ? extraordinarySummary : `${extraordinarySummary}.`}`;
      } else if (extraordinaryExists === false) {
        block += "No se han producido cambios extraordinarios en el SGC durante el periodo auditado.";
      } else if (methodSummary) {
        block += methodSummary;
      } else {
        block += "No se han registrado cambios en el SGC. Se recomienda completar el registro de cambios.";
      }
    }
    parts.push(block);
  }

  // ── Resultado de verificación de cláusulas ─────────────────────────────────
  const noncompliantClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "non_compliant")
    .map((c) => c.clause_code);
  const partialClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "partial")
    .map((c) => c.clause_code);

  if (noncompliantClauses.length > 0) {
    parts.push(
      `Desviaciones detectadas en sección 6: Se han identificado incumplimientos en las cláusulas ${noncompliantClauses.join(", ")}. Se requieren acciones correctivas antes del cierre del expediente.`
    );
  } else if (partialClauses.length > 0) {
    parts.push(
      `Observaciones: Las cláusulas ${partialClauses.join(", ")} presentan cumplimiento parcial. Se recomienda reforzar las evidencias y el seguimiento en los puntos indicados.`
    );
  } else {
    parts.push(
      "Conclusión: La sección 6 presenta un nivel de cumplimiento conforme con los requisitos de la norma ISO 9001, con las evidencias disponibles y las cláusulas verificadas."
    );
  }

  return parts.join("\n\n");
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Section6PlanningPanel({
  valuesByFieldCode,
  clauseChecks,
  currentFinalText,
  onFieldChange,
  onApplyDraftText,
  onApplySuggestedClauseCheck,
  disabled,
}) {
  const [openClause, setOpenClause] = useState(null);
  const [openCommentFor, setOpenCommentFor] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [applyConfirm, setApplyConfirm] = useState(null);

  // ── Guided answers (same pattern as s5) ─────────────────────────────────

  const guidedAnswers = useMemo(() => {
    const raw = valuesByFieldCode?.s6_guided_answers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }, [valuesByFieldCode]);

  const objectivesMatrix = useMemo(() => {
    const raw = valuesByFieldCode?.quality_objectives_matrix;
    return Array.isArray(raw) ? raw : [];
  }, [valuesByFieldCode]);

  const changesLog = useMemo(() => {
    const raw = valuesByFieldCode?.planned_changes_log;
    return Array.isArray(raw) ? raw : [];
  }, [valuesByFieldCode]);

  const hasExistingText = (currentFinalText || "").trim().length > 0;

  // ── Answer helpers ────────────────────────────────────────────────────────

  function getAnswer(clauseCode, qIndex) {
    return (guidedAnswers[clauseCode] || {})[`q${qIndex}`] || "";
  }

  function getComment(clauseCode, qIndex) {
    return (guidedAnswers[clauseCode] || {})[`q${qIndex}_comment`] || "";
  }

  function setAnswer(clauseCode, qIndex, value) {
    if (disabled) return;
    const next = {
      ...guidedAnswers,
      [clauseCode]: { ...(guidedAnswers[clauseCode] || {}), [`q${qIndex}`]: value },
    };
    onFieldChange("s6_guided_answers", next);
  }

  function setComment(clauseCode, qIndex, text) {
    if (disabled) return;
    const next = {
      ...guidedAnswers,
      [clauseCode]: { ...(guidedAnswers[clauseCode] || {}), [`q${qIndex}_comment`]: text },
    };
    onFieldChange("s6_guided_answers", next);
  }

  // ── Suggested status ─────────────────────────────────────────────────────

  const suggestedStatusByClause = useMemo(() => ({
    "6.1": computeSuggestedStatus(guidedAnswers["6.1"]),
    "6.2": computeSuggestedStatus62(guidedAnswers["6.2"], objectivesMatrix),
    "6.3": computeSuggestedStatus63(guidedAnswers["6.3"], changesLog),
  }), [guidedAnswers, objectivesMatrix, changesLog]);

  function getCurrentClauseStatus(clauseCode) {
    return (clauseChecks || []).find((c) => c.clause_code === clauseCode)?.clause_status || null;
  }

  function handleApplyToC(clauseCode, suggestedStatus) {
    const currentStatus = getCurrentClauseStatus(clauseCode);
    const isDefaultOrEmpty = !currentStatus || currentStatus === "compliant";
    if (currentStatus === suggestedStatus) return;
    if (!isDefaultOrEmpty) {
      setApplyConfirm({ clauseCode, suggestedStatus, currentStatus });
    } else {
      onApplySuggestedClauseCheck(clauseCode, suggestedStatus);
    }
  }

  function confirmApply() {
    if (!applyConfirm) return;
    onApplySuggestedClauseCheck(applyConfirm.clauseCode, applyConfirm.suggestedStatus);
    setApplyConfirm(null);
  }

  // ── Text generator ────────────────────────────────────────────────────────

  function handleGenerateClick() {
    if (hasExistingText) setConfirmState("confirming");
    else applyGenerated("replace");
  }

  function applyGenerated(mode) {
    const generated = buildSection6DraftText(
      valuesByFieldCode || {},
      clauseChecks || [],
      guidedAnswers,
      objectivesMatrix,
      changesLog
    );
    if (mode === "append") {
      const base = (currentFinalText || "").trimEnd();
      onApplyDraftText(`${base}\n\n${generated}`);
    } else {
      onApplyDraftText(generated);
    }
    setConfirmState(null);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const answeredCount = useMemo(() => {
    let count = 0;
    AUDIT_QUESTIONS_S6.forEach(({ clause, questions }) => {
      questions.forEach((_, idx) => { if (getAnswer(clause, idx)) count++; });
    });
    return count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedAnswers]);

  const totalQuestions = AUDIT_QUESTIONS_S6.reduce((acc, { questions }) => acc + questions.length, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="s5-panel">

      {/* ── Resumen global ── */}
      <div className="s5-summary-bar">
        <span className="s5-summary-label">
          Preguntas respondidas: <strong>{answeredCount}/{totalQuestions}</strong>
        </span>
        <div className="s5-summary-clauses">
          {AUDIT_QUESTIONS_S6.map(({ clause }) => {
            const sug = suggestedStatusByClause[clause];
            const cur = getCurrentClauseStatus(clause);
            return (
              <span
                key={clause}
                className={`s5-clause-pill ${sug ? STATUS_CLASS[sug] : "s5-status-empty"}`}
                title={`${clause}: ${sug ? STATUS_LABEL[sug] : "Sin respuestas"} (C actual: ${cur ? STATUS_LABEL[cur] : "—"})`}
              >
                {clause}
                {sug && <span className="s5-pill-dot" aria-hidden="true" />}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Cláusulas ── */}
      <section className="s5-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Verificación por cláusula</h4>
          <p className="s5-block-desc">
            Completa los datos de cada cláusula y responde las preguntas guiadas. El estado
            sugerido se calcula automáticamente y puede aplicarse al bloque C.
          </p>
        </div>

        <div className="s5-clauses">
          {AUDIT_QUESTIONS_S6.map((item) => {
            const isOpen = openClause === item.clause;
            const sug = suggestedStatusByClause[item.clause];
            const cur = getCurrentClauseStatus(item.clause);
            const clauseAnswers = guidedAnswers[item.clause] || {};
            const answeredInClause = item.questions.filter((_, i) => clauseAnswers[`q${i}`]).length;

            return (
              <div
                key={item.clause}
                className={`s5-clause-block${isOpen ? " s5-clause-open" : ""}`}
              >
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
                  <span className="s5-clause-arrow" aria-hidden="true">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div className="s5-clause-body">

                    {/* ── 6.1 context: nota P09 ── */}
                    {item.clause === "6.1" && (
                      <div className="s5-context-zone s6-p09-note-zone">
                        <p className="s6-p09-note">
                          La cláusula 6.1 se gestiona mediante el documento P09 (DAFO, riesgos,
                          oportunidades y acciones). Usa las preguntas guiadas para verificar
                          su implementación real.
                        </p>
                      </div>
                    )}

                    {/* ── 6.2 context: referencia documental + matriz objetivos ── */}
                    {item.clause === "6.2" && (
                      <div className="s5-context-zone">
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Referencia documental de objetivos</span>
                          <input
                            type="text"
                            className="s5-context-input"
                            value={valuesByFieldCode?.objectives_reference_document || ""}
                            placeholder="Ej: Objetivos de calidad 2024 — Rev. 2"
                            disabled={disabled}
                            onChange={(e) => onFieldChange("objectives_reference_document", e.target.value)}
                          />
                        </div>
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Matriz de objetivos de calidad</span>
                          <EditableAuditMatrix
                            value={objectivesMatrix}
                            onChange={(val) => onFieldChange("quality_objectives_matrix", val)}
                            schema={OBJECTIVES_SCHEMA}
                            addLabel="Añadir objetivo"
                            emptyText="Sin objetivos registrados. Añade uno para comenzar."
                            disabled={disabled}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── 6.3 context: fecha revisión + log de cambios ── */}
                    {item.clause === "6.3" && (
                      <div className="s5-context-zone">
                        <div className="s5-context-row">
                          <div className="s5-context-field">
                            <span className="s5-context-label">Fecha planificada revisión SGC</span>
                            <input
                              type="date"
                              className="s5-context-input"
                              value={valuesByFieldCode?.management_review_planned_date || ""}
                              disabled={disabled}
                              onChange={(e) => onFieldChange("management_review_planned_date", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Registro de cambios del SGC</span>
                          <EditableAuditMatrix
                            value={changesLog}
                            onChange={(val) => onFieldChange("planned_changes_log", val)}
                            schema={CHANGES_SCHEMA}
                            addLabel="Añadir cambio"
                            emptyText="Sin cambios registrados. Añade uno para comenzar."
                            disabled={disabled}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Preguntas guiadas ── */}
                    <ul className="s5-question-list">
                      {item.questions.map((q, idx) => {
                        const answer = getAnswer(item.clause, idx);
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
                                placeholder="Observación o evidencia concreta..."
                                rows={2}
                                disabled={disabled}
                                onChange={(e) => setComment(item.clause, idx, e.target.value)}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* ── Footer: estado sugerido + aplicar a C ── */}
                    <div className="s5-clause-footer">
                      {sug ? (
                        <>
                          <span className={`s5-suggested-badge ${STATUS_CLASS[sug]}`}>
                            Sugerido: {STATUS_LABEL[sug]}
                          </span>
                          {cur && (
                            <span className="s5-current-badge soft-label">
                              C actual: {STATUS_LABEL[cur] || cur}
                            </span>
                          )}
                          {sug !== cur ? (
                            <button
                              type="button"
                              className="btn-secondary s5-apply-btn"
                              onClick={() => handleApplyToC(item.clause, sug)}
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
            La cláusula <strong>{applyConfirm.clauseCode}</strong> ya tiene estado{" "}
            <strong>"{STATUS_LABEL[applyConfirm.currentStatus]}"</strong> en el bloque C.
            ¿Reemplazarlo con la sugerencia{" "}
            <strong>"{STATUS_LABEL[applyConfirm.suggestedStatus]}"</strong>?
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

      {/* ── Generador de texto ── */}
      <section className="s5-block s5-draft-block">
        <div className="s5-draft-row">
          <div className="s5-block-intro">
            <h4 className="s5-block-title">Generar texto narrativo del informe</h4>
            <p className="s5-block-desc">
              Crea un borrador profesional usando la matriz de objetivos, el registro de cambios,
              respuestas guiadas y estado de cláusulas. Edítalo en el bloque D.
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
