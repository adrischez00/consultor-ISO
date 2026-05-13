import { useMemo, useState } from "react";
import EditableAuditMatrix from "./EditableAuditMatrix";

const AUDIT_QUESTIONS_S10 = [
  {
    clause: "10.1",
    title: "Generalidades",
    questions: [
      "Se identifican oportunidades de mejora del SGC de forma sistematica?",
      "La organizacion analiza el desempeno para priorizar mejoras?",
      "Las mejoras se integran en la planificacion operativa?",
      "Se mantiene evidencia documentada del enfoque de mejora?",
    ],
  },
  {
    clause: "10.2",
    title: "No conformidades y acciones correctivas",
    questions: [
      "Las no conformidades se registran y gestionan con trazabilidad?",
      "Se determina la causa raiz antes de definir acciones?",
      "Las acciones correctivas tienen responsable y plazo definidos?",
      "Se verifica la eficacia de las acciones implementadas?",
    ],
  },
  {
    clause: "10.3",
    title: "Mejora continua",
    questions: [
      "Existe evidencia de mejora continua en procesos o resultados?",
      "Las oportunidades de mejora se convierten en acciones concretas?",
      "Se revisa el resultado de las mejoras implantadas?",
      "La direccion impulsa y da seguimiento a la mejora continua?",
    ],
  },
];

const ANSWER_OPTIONS = [
  { value: "yes", label: "Si", color: "s5-ans-yes" },
  { value: "partial", label: "Parcial", color: "s5-ans-partial" },
  { value: "no", label: "No", color: "s5-ans-no" },
  { value: "na", label: "N/A", color: "s5-ans-na" },
];

const STATUS_LABEL = {
  in_progress: "Sin evaluar",
  compliant: "Cumple",
  partial: "Parcial",
  non_compliant: "No cumple",
};

const STATUS_CLASS = {
  in_progress: "s5-status-empty",
  compliant: "s5-status-compliant",
  partial: "s5-status-partial",
  non_compliant: "s5-status-noncompliant",
};

const ACTION_TYPE_OPTIONS = [
  { value: "nc_internal", label: "NC interna" },
  { value: "nc_supplier", label: "NC proveedor" },
  { value: "opportunity", label: "Oportunidad" },
  { value: "observation", label: "Observacion" },
  { value: "improvement", label: "Mejora" },
];

const ACTION_STATUS_OPTIONS = [
  { value: "open", label: "Abierta" },
  { value: "in_progress", label: "En progreso" },
  { value: "completed", label: "Completada" },
  { value: "overdue", label: "Vencida" },
];

const ACTION_EFFECTIVENESS_OPTIONS = [
  { value: "effective", label: "Efectiva" },
  { value: "partial", label: "Parcial" },
  { value: "ineffective", label: "Ineficaz" },
  { value: "pending", label: "Pendiente" },
];

const ACTION_EFFECTIVENESS_LABEL_BY_VALUE = Object.fromEntries(
  ACTION_EFFECTIVENESS_OPTIONS.map((option) => [option.value, option.label])
);

const RECURRENCE_OPTIONS = [
  { value: "yes", label: "Si" },
  { value: "no", label: "No" },
];

const ACTION_TYPE_CONFIG = {
  nc_internal: { label: "NC interna", colorClass: "mat-badge-type" },
  nc_supplier: { label: "NC proveedor", colorClass: "mat-badge-type" },
  opportunity: { label: "Oportunidad", colorClass: "mat-badge-type" },
  observation: { label: "Observacion", colorClass: "mat-badge-type" },
  improvement: { label: "Mejora", colorClass: "mat-badge-type" },
};

const ACTION_STATUS_CONFIG = {
  open: { label: "Abierta", colorClass: "mat-badge-partial" },
  in_progress: { label: "En progreso", colorClass: "mat-badge-cancelled" },
  completed: { label: "Completada", colorClass: "mat-badge-achieved" },
  overdue: { label: "Vencida", colorClass: "mat-badge-not-achieved" },
};

const ACTION_EFFECTIVENESS_CONFIG = {
  effective: { label: "Efectiva", colorClass: "mat-badge-achieved" },
  partial: { label: "Parcial", colorClass: "mat-badge-progress" },
  ineffective: { label: "Ineficaz", colorClass: "mat-badge-not-achieved" },
  pending: { label: "Pendiente", colorClass: "mat-badge-cancelled" },
};

const CORRECTIVE_ACTION_SCHEMA = {
  primaryField: "finding",
  statusField: "status",
  statusConfig: ACTION_STATUS_CONFIG,
  typeField: "type",
  typeConfig: ACTION_TYPE_CONFIG,
  compactCols: [
    { key: "owner", label: "Responsable" },
    {
      key: "effectiveness",
      label: "Eficacia",
      optionsMap: ACTION_EFFECTIVENESS_LABEL_BY_VALUE,
    },
  ],
  defaultRow: () => ({
    id: "",
    type: "nc_internal",
    finding: "",
    root_cause: "",
    action: "",
    owner: "",
    due_date: "",
    status: "open",
    effectiveness: "pending",
    recurrence: "no",
    notes: "",
  }),
  expandFields: [
    { key: "type", label: "Tipo", type: "select", options: ACTION_TYPE_OPTIONS },
    { key: "finding", label: "Hallazgo", type: "textarea", wide: true },
    { key: "root_cause", label: "Causa raiz", type: "textarea", wide: true },
    { key: "action", label: "Accion correctiva", type: "textarea", wide: true },
    { key: "owner", label: "Responsable", type: "text" },
    { key: "due_date", label: "Fecha compromiso", type: "date" },
    { key: "status", label: "Estado", type: "select", options: ACTION_STATUS_OPTIONS },
    { key: "effectiveness", label: "Eficacia", type: "select", options: ACTION_EFFECTIVENESS_OPTIONS },
    { key: "recurrence", label: "Reincidencia", type: "select", options: RECURRENCE_OPTIONS },
    { key: "notes", label: "Notas de seguimiento", type: "textarea", wide: true },
  ],
};

const STATUS_SEVERITY = {
  non_compliant: 3,
  partial: 2,
  compliant: 1,
};

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function normalizeChoice(value) {
  return String(value || "").trim().toLowerCase();
}

function worstStatus(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return (STATUS_SEVERITY[a] || 0) >= (STATUS_SEVERITY[b] || 0) ? a : b;
}

function getClauseStatusLabel(value) {
  if (!value) return "Sin evaluar";
  return STATUS_LABEL[value] || "Sin evaluar";
}

function hasGuidedAnswerForClause(clauseAnswers) {
  return Object.entries(clauseAnswers || {}).some(
    ([key, value]) => /^q\d+$/.test(key) && hasText(value)
  );
}

function resolveClauseUiStatus(check, clauseAnswers) {
  if (!check || check.applicable === false) return "in_progress";

  const normalized = normalizeChoice(check.clause_status);
  const hasGuidedEvidence = hasGuidedAnswerForClause(clauseAnswers || {});
  const hasManualEvidence = hasText(check.evidence_summary) || hasText(check.observation_text);

  if (normalized === "partial" || normalized === "non_compliant") return normalized;
  if (normalized === "compliant" && (hasGuidedEvidence || hasManualEvidence)) return "compliant";
  return "in_progress";
}

function computeSuggestedStatusFromAnswers(clauseAnswers) {
  const values = Object.entries(clauseAnswers || {})
    .filter(([key]) => /^q\d+$/.test(key))
    .map(([, value]) => normalizeChoice(value))
    .filter(Boolean);

  if (values.length === 0) return null;
  if (values.every((value) => value === "na")) return null;
  if (values.some((value) => value === "no")) return "non_compliant";
  if (values.some((value) => value === "partial")) return "partial";
  if (values.every((value) => value === "yes" || value === "na")) return "compliant";
  return "partial";
}

function normalizeMatrixRows(rawMatrix) {
  if (!Array.isArray(rawMatrix)) return [];
  return rawMatrix.map((row, index) => ({
    id: String(row?.id || `ca-${index + 1}`),
    type: String(row?.type || "nc_internal"),
    finding: String(row?.finding || ""),
    root_cause: String(row?.root_cause || ""),
    action: String(row?.action || ""),
    owner: String(row?.owner || ""),
    due_date: String(row?.due_date || ""),
    status: String(row?.status || "open"),
    effectiveness: String(row?.effectiveness || "pending"),
    recurrence: String(row?.recurrence || ""),
    notes: String(row?.notes || ""),
  }));
}

function isOpenLikeStatus(status) {
  const normalized = normalizeChoice(status);
  return normalized === "open" || normalized === "in_progress";
}

function isOverdueStatus(status) {
  return normalizeChoice(status) === "overdue";
}

function isNcType(type) {
  const normalized = normalizeChoice(type);
  return normalized === "nc_internal" || normalized === "nc_supplier";
}

function computeSuggestedStatus101(clauseAnswers, valuesByFieldCode) {
  const questionStatus = computeSuggestedStatusFromAnswers(clauseAnswers);
  const hasSystem = hasText(valuesByFieldCode?.improvement_system_summary);
  const hasMechanism = hasText(valuesByFieldCode?.continuous_improvement_mechanism_summary);
  const usesManagementOutputs = valuesByFieldCode?.management_review_outputs_used_for_improvement;
  const hasMeetings = hasText(valuesByFieldCode?.improvement_meetings_summary);
  const hasData = hasSystem || hasMechanism || typeof usesManagementOutputs === "boolean" || hasMeetings;
  if (!hasData && !questionStatus) return null;

  let dataStatus = null;
  if (hasSystem && hasMechanism && usesManagementOutputs === true) {
    dataStatus = "compliant";
  } else if (hasData) {
    dataStatus = "partial";
  }
  return worstStatus(questionStatus, dataStatus);
}

function computeSuggestedStatus102(clauseAnswers, matrixRows) {
  const questionStatus = computeSuggestedStatusFromAnswers(clauseAnswers);
  if (matrixRows.length === 0 && !questionStatus) return null;

  let dataStatus = null;
  const hasOverdue = matrixRows.some((row) => isOverdueStatus(row.status));
  const hasRecurrence = matrixRows.some((row) => normalizeChoice(row.recurrence) === "yes");
  const hasNoEffectiveness = matrixRows.some(
    (row) => !hasText(row.effectiveness) || normalizeChoice(row.effectiveness) === "pending"
  );
  const hasIneffective = matrixRows.some((row) => normalizeChoice(row.effectiveness) === "ineffective");
  const hasPartialEffectiveness = matrixRows.some((row) => normalizeChoice(row.effectiveness) === "partial");
  const hasMissingOwner = matrixRows.some((row) => !hasText(row.owner));
  const hasMissingDate = matrixRows.some((row) => !hasText(row.due_date));
  const hasOpen = matrixRows.some((row) => isOpenLikeStatus(row.status));

  if (hasOverdue) {
    dataStatus = "non_compliant";
  } else if (
    hasRecurrence ||
    hasNoEffectiveness ||
    hasIneffective ||
    hasPartialEffectiveness ||
    hasMissingOwner ||
    hasMissingDate ||
    hasOpen
  ) {
    dataStatus = "partial";
  } else if (matrixRows.length > 0) {
    const allCompleted = matrixRows.every((row) => normalizeChoice(row.status) === "completed");
    const allEffective = matrixRows.every((row) => normalizeChoice(row.effectiveness) === "effective");
    const allNoRecurrence = matrixRows.every((row) => normalizeChoice(row.recurrence) === "no");
    const allAssigned = matrixRows.every((row) => hasText(row.owner) && hasText(row.due_date));
    if (allCompleted && allEffective && allNoRecurrence && allAssigned) {
      dataStatus = "compliant";
    } else {
      dataStatus = "partial";
    }
  }

  return worstStatus(questionStatus, dataStatus);
}

function computeSuggestedStatus103(clauseAnswers, valuesByFieldCode, matrixRows) {
  const questionStatus = computeSuggestedStatusFromAnswers(clauseAnswers);
  const opportunitiesSummary = hasText(valuesByFieldCode?.improvement_opportunities_summary);
  const systemSummary = hasText(valuesByFieldCode?.improvement_system_summary);
  const mechanismSummary = hasText(valuesByFieldCode?.continuous_improvement_mechanism_summary);
  const meetingsSummary = hasText(valuesByFieldCode?.improvement_meetings_summary);
  const usesManagementOutputs = valuesByFieldCode?.management_review_outputs_used_for_improvement === true;
  const hasOpportunityRows = matrixRows.some((row) => {
    const type = normalizeChoice(row.type);
    return type === "opportunity" || type === "improvement";
  });
  const hasAnyData =
    opportunitiesSummary ||
    systemSummary ||
    mechanismSummary ||
    meetingsSummary ||
    hasOpportunityRows ||
    matrixRows.length > 0;
  if (!hasAnyData && !questionStatus) return null;

  let dataStatus = null;
  if (!opportunitiesSummary && !hasOpportunityRows) {
    dataStatus = hasAnyData ? "partial" : null;
  } else if (systemSummary || mechanismSummary || meetingsSummary || usesManagementOutputs) {
    dataStatus = "compliant";
  } else {
    dataStatus = "partial";
  }

  return worstStatus(questionStatus, dataStatus);
}

function buildSection10DraftText({
  valuesByFieldCode,
  matrixRows,
  suggestedStatusByClause,
  guidedAnswers,
  clauseChecks,
  improvementRisks,
}) {
  const parts = [];
  parts.push("Evaluacion de la seccion 10 del SGC: mejora, acciones correctivas y eficacia.");

  if (matrixRows.length === 0) {
    parts.push("No se ha registrado evidencia suficiente sobre acciones correctivas en la matriz de seguimiento.");
  } else {
    const overdue = matrixRows.filter((row) => isOverdueStatus(row.status)).length;
    const openLike = matrixRows.filter((row) => isOpenLikeStatus(row.status)).length;
    const completed = matrixRows.filter((row) => normalizeChoice(row.status) === "completed").length;
    const ineffective = matrixRows.filter((row) => normalizeChoice(row.effectiveness) === "ineffective").length;
    const pendingEffectiveness = matrixRows.filter(
      (row) => !hasText(row.effectiveness) || normalizeChoice(row.effectiveness) === "pending"
    ).length;
    const recurrences = matrixRows.filter((row) => normalizeChoice(row.recurrence) === "yes").length;

    let block =
      `Se revisaron ${matrixRows.length} registros de acciones en la matriz correctiva: ` +
      `${completed} completadas, ${openLike} abiertas/en progreso y ${overdue} vencidas.`;
    if (ineffective > 0) {
      block += ` Se identifican ${ineffective} acciones con eficacia ineficaz.`;
    }
    if (pendingEffectiveness > 0) {
      block += ` Existen ${pendingEffectiveness} acciones sin evaluacion de eficacia concluyente.`;
    }
    if (recurrences > 0) {
      block += ` Se registran ${recurrences} casos con reincidencia.`;
    }
    parts.push(block);
  }

  if (!hasText(valuesByFieldCode?.improvement_system_summary)) {
    parts.push("No se ha registrado evidencia suficiente sobre el sistema general de mejora continua.");
  } else {
    parts.push(`Sistema de mejora: ${String(valuesByFieldCode.improvement_system_summary).trim()}`);
  }

  if (!hasText(valuesByFieldCode?.improvement_opportunities_summary)) {
    parts.push("No se ha registrado evidencia suficiente sobre oportunidades de mejora identificadas.");
  } else {
    parts.push(
      `Oportunidades de mejora: ${String(valuesByFieldCode.improvement_opportunities_summary).trim()}`
    );
  }

  if (hasText(valuesByFieldCode?.continuous_improvement_mechanism_summary)) {
    parts.push(
      `Mecanismo de mejora continua: ${String(valuesByFieldCode.continuous_improvement_mechanism_summary).trim()}`
    );
  }
  if (hasText(valuesByFieldCode?.improvement_meetings_summary)) {
    parts.push(`Seguimiento: ${String(valuesByFieldCode.improvement_meetings_summary).trim()}`);
  }

  const guidedSummary = ["10.1", "10.2", "10.3"]
    .map((clauseCode) => `${clauseCode}: ${getClauseStatusLabel(suggestedStatusByClause[clauseCode])}`)
    .join(" | ");
  parts.push(`Resultado de preguntas guiadas: ${guidedSummary}.`);

  const normalizedChecks = (clauseChecks || [])
    .filter((check) => check?.applicable)
    .map((check) => ({
      clauseCode: check.clause_code,
      status: resolveClauseUiStatus(check, guidedAnswers?.[check.clause_code] || {}),
    }));

  const nonCompliantClauses = normalizedChecks
    .filter((check) => check.status === "non_compliant")
    .map((check) => check.clauseCode);
  const partialClauses = normalizedChecks
    .filter((check) => check.status === "partial")
    .map((check) => check.clauseCode);
  const compliantClauses = normalizedChecks
    .filter((check) => check.status === "compliant")
    .map((check) => check.clauseCode);

  parts.push(
    `Estado bloque C: ${compliantClauses.length} cumple, ${partialClauses.length} parcial y ${nonCompliantClauses.length} no cumple.`
  );
  if (nonCompliantClauses.length > 0) {
    parts.push(`Clausulas con no conformidad: ${nonCompliantClauses.join(", ")}.`);
  } else if (partialClauses.length > 0) {
    parts.push(`Clausulas con cumplimiento parcial: ${partialClauses.join(", ")}.`);
  }

  if (improvementRisks.length > 0) {
    parts.push(
      `Riesgos detectados en mejora: ${improvementRisks
        .map((risk) => String(risk.label || "").trim())
        .filter(Boolean)
        .join("; ")}.`
    );
  }

  return parts.join("\n\n");
}

export default function Section10ImprovementPanel({
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

  const matrixRows = useMemo(
    () => normalizeMatrixRows(valuesByFieldCode?.corrective_actions_matrix),
    [valuesByFieldCode]
  );

  const guidedAnswers = useMemo(() => {
    const raw = valuesByFieldCode?.s10_guided_answers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }, [valuesByFieldCode]);

  const suggestedStatusByClause = useMemo(
    () => ({
      "10.1": computeSuggestedStatus101(guidedAnswers["10.1"], valuesByFieldCode || {}),
      "10.2": computeSuggestedStatus102(guidedAnswers["10.2"], matrixRows),
      "10.3": computeSuggestedStatus103(guidedAnswers["10.3"], valuesByFieldCode || {}, matrixRows),
    }),
    [guidedAnswers, matrixRows, valuesByFieldCode]
  );

  const matrixSummary = useMemo(() => {
    const total = matrixRows.length;
    const ncRows = matrixRows.filter((row) => isNcType(row.type));
    const overdue = matrixRows.filter((row) => isOverdueStatus(row.status)).length;
    const openLike = matrixRows.filter((row) => isOpenLikeStatus(row.status)).length;
    const completed = matrixRows.filter((row) => normalizeChoice(row.status) === "completed").length;
    const ineffective = matrixRows.filter((row) => normalizeChoice(row.effectiveness) === "ineffective").length;
    const partialEffectiveness = matrixRows.filter(
      (row) => normalizeChoice(row.effectiveness) === "partial"
    ).length;
    const pendingEffectiveness = matrixRows.filter(
      (row) => !hasText(row.effectiveness) || normalizeChoice(row.effectiveness) === "pending"
    ).length;
    const effective = matrixRows.filter((row) => normalizeChoice(row.effectiveness) === "effective").length;
    const recurrenceYes = matrixRows.filter((row) => normalizeChoice(row.recurrence) === "yes").length;
    const recurrenceNo = matrixRows.filter((row) => normalizeChoice(row.recurrence) === "no").length;
    const withoutOwner = matrixRows.filter((row) => !hasText(row.owner)).length;
    const withoutDueDate = matrixRows.filter((row) => !hasText(row.due_date)).length;
    const opportunityRows = matrixRows.filter((row) => {
      const type = normalizeChoice(row.type);
      return type === "opportunity" || type === "improvement";
    }).length;

    return {
      total,
      ncRows: ncRows.length,
      overdue,
      openLike,
      completed,
      ineffective,
      partialEffectiveness,
      pendingEffectiveness,
      effective,
      recurrenceYes,
      recurrenceNo,
      withoutOwner,
      withoutDueDate,
      opportunityRows,
    };
  }, [matrixRows]);

  const executiveSignals = useMemo(() => {
    const ncSignal = (() => {
      if (matrixSummary.ncRows === 0) {
        return { id: "ncs", label: "NCs abiertas", status: "neutral", detail: "Sin datos" };
      }
      const ncOverdue = matrixRows.filter(
        (row) => isNcType(row.type) && isOverdueStatus(row.status)
      ).length;
      const ncOpen = matrixRows.filter(
        (row) => isNcType(row.type) && isOpenLikeStatus(row.status)
      ).length;
      if (ncOverdue > 0) {
        return {
          id: "ncs",
          label: "NCs abiertas",
          status: "critical",
          detail: `${ncOverdue} vencidas`,
        };
      }
      if (ncOpen > 0) {
        return {
          id: "ncs",
          label: "NCs abiertas",
          status: "warning",
          detail: `${ncOpen} activas`,
        };
      }
      return {
        id: "ncs",
        label: "NCs abiertas",
        status: "ok",
        detail: `${matrixSummary.ncRows} cerradas`,
      };
    })();

    const actionSignal = (() => {
      if (matrixSummary.total === 0) {
        return { id: "actions", label: "Acciones correctivas", status: "neutral", detail: "Sin datos" };
      }
      if (matrixSummary.overdue > 0) {
        return {
          id: "actions",
          label: "Acciones correctivas",
          status: "critical",
          detail: `${matrixSummary.overdue} vencidas`,
        };
      }
      if (matrixSummary.openLike > 0) {
        return {
          id: "actions",
          label: "Acciones correctivas",
          status: "warning",
          detail: `${matrixSummary.openLike} en curso`,
        };
      }
      return {
        id: "actions",
        label: "Acciones correctivas",
        status: "ok",
        detail: `${matrixSummary.completed} completadas`,
      };
    })();

    const effectivenessSignal = (() => {
      if (matrixSummary.total === 0) {
        return { id: "effectiveness", label: "Eficacia acciones", status: "neutral", detail: "Sin datos" };
      }
      if (matrixSummary.ineffective > 0) {
        return {
          id: "effectiveness",
          label: "Eficacia acciones",
          status: "critical",
          detail: `${matrixSummary.ineffective} ineficaces`,
        };
      }
      if (matrixSummary.partialEffectiveness > 0 || matrixSummary.pendingEffectiveness > 0) {
        return {
          id: "effectiveness",
          label: "Eficacia acciones",
          status: "warning",
          detail: `${matrixSummary.partialEffectiveness + matrixSummary.pendingEffectiveness} parciales/pte`,
        };
      }
      if (matrixSummary.effective > 0) {
        return {
          id: "effectiveness",
          label: "Eficacia acciones",
          status: "ok",
          detail: `${matrixSummary.effective} efectivas`,
        };
      }
      return { id: "effectiveness", label: "Eficacia acciones", status: "neutral", detail: "Sin datos" };
    })();

    const improvementSignal = (() => {
      const hasSystem = hasText(valuesByFieldCode?.improvement_system_summary);
      const hasMechanism = hasText(valuesByFieldCode?.continuous_improvement_mechanism_summary);
      const hasOpportunities = hasText(valuesByFieldCode?.improvement_opportunities_summary);
      const hasMeetings = hasText(valuesByFieldCode?.improvement_meetings_summary);
      const usesOutputs = valuesByFieldCode?.management_review_outputs_used_for_improvement;
      const hasAnyData =
        hasSystem || hasMechanism || hasOpportunities || hasMeetings || matrixSummary.opportunityRows > 0;
      if (!hasAnyData && typeof usesOutputs !== "boolean") {
        return { id: "continuous", label: "Mejora continua", status: "neutral", detail: "Sin datos" };
      }
      if (!hasOpportunities && matrixSummary.opportunityRows === 0) {
        return { id: "continuous", label: "Mejora continua", status: "warning", detail: "Sin oportunidades" };
      }
      if ((hasSystem || hasMechanism) && (usesOutputs === true || hasMeetings)) {
        return { id: "continuous", label: "Mejora continua", status: "ok", detail: "Evidencia disponible" };
      }
      return { id: "continuous", label: "Mejora continua", status: "warning", detail: "Evidencia parcial" };
    })();

    const recurrenceSignal = (() => {
      if (matrixSummary.total === 0) {
        return { id: "recurrence", label: "Reincidencias", status: "neutral", detail: "Sin datos" };
      }
      if (matrixSummary.recurrenceYes > 0) {
        return {
          id: "recurrence",
          label: "Reincidencias",
          status: "critical",
          detail: `${matrixSummary.recurrenceYes} detectadas`,
        };
      }
      if (matrixSummary.recurrenceNo > 0) {
        return { id: "recurrence", label: "Reincidencias", status: "ok", detail: "No detectadas" };
      }
      return { id: "recurrence", label: "Reincidencias", status: "neutral", detail: "Sin evaluar" };
    })();

    return [ncSignal, actionSignal, effectivenessSignal, improvementSignal, recurrenceSignal];
  }, [matrixRows, matrixSummary, valuesByFieldCode]);

  const improvementRisks = useMemo(() => {
    if (matrixSummary.total === 0) return [];
    const risks = [];
    if (matrixSummary.overdue > 0) {
      risks.push({
        id: "overdue",
        label: `${matrixSummary.overdue} acciones vencidas requieren cierre inmediato.`,
        severity: "critical",
      });
    }
    if (matrixSummary.recurrenceYes > 0) {
      risks.push({
        id: "recurrence",
        label: `Se detectan ${matrixSummary.recurrenceYes} casos con reincidencia.`,
        severity: "critical",
      });
    }
    if (matrixSummary.ineffective > 0) {
      risks.push({
        id: "ineffective",
        label: `${matrixSummary.ineffective} acciones registradas como ineficaces.`,
        severity: "critical",
      });
    }
    if (matrixSummary.withoutOwner > 0) {
      risks.push({
        id: "no_owner",
        label: `${matrixSummary.withoutOwner} acciones sin responsable asignado.`,
        severity: "warning",
      });
    }
    if (matrixSummary.withoutDueDate > 0) {
      risks.push({
        id: "no_due_date",
        label: `${matrixSummary.withoutDueDate} acciones sin fecha compromiso.`,
        severity: "warning",
      });
    }
    return risks;
  }, [matrixSummary]);

  const hasExistingText = hasText(currentFinalText);

  function getAnswer(clauseCode, questionIndex) {
    return String((guidedAnswers[clauseCode] || {})[`q${questionIndex}`] || "");
  }

  function getComment(clauseCode, questionIndex) {
    return String((guidedAnswers[clauseCode] || {})[`q${questionIndex}_comment`] || "");
  }

  function setAnswer(clauseCode, questionIndex, value) {
    if (disabled) return;
    onFieldChange("s10_guided_answers", {
      ...guidedAnswers,
      [clauseCode]: {
        ...(guidedAnswers[clauseCode] || {}),
        [`q${questionIndex}`]: value,
      },
    });
  }

  function setComment(clauseCode, questionIndex, value) {
    if (disabled) return;
    onFieldChange("s10_guided_answers", {
      ...guidedAnswers,
      [clauseCode]: {
        ...(guidedAnswers[clauseCode] || {}),
        [`q${questionIndex}_comment`]: value,
      },
    });
  }

  function getCurrentClauseStatus(clauseCode) {
    const check = (clauseChecks || []).find((entry) => entry.clause_code === clauseCode);
    return resolveClauseUiStatus(check, guidedAnswers[clauseCode] || {});
  }

  function handleApplyToC(clauseCode, suggestedStatus) {
    if (!suggestedStatus) return;
    const currentStatus = getCurrentClauseStatus(clauseCode);
    if (currentStatus === suggestedStatus) return;
    const shouldConfirm = Boolean(currentStatus) && currentStatus !== "in_progress";
    if (shouldConfirm) {
      setApplyConfirm({ clauseCode, suggestedStatus, currentStatus });
    } else {
      onApplySuggestedClauseCheck(clauseCode, suggestedStatus);
    }
  }

  function confirmApplySuggestedStatus() {
    if (!applyConfirm) return;
    onApplySuggestedClauseCheck(applyConfirm.clauseCode, applyConfirm.suggestedStatus);
    setApplyConfirm(null);
  }

  function applyGeneratedNarrative(mode) {
    const generatedText = buildSection10DraftText({
      valuesByFieldCode: valuesByFieldCode || {},
      matrixRows,
      suggestedStatusByClause,
      guidedAnswers,
      clauseChecks: clauseChecks || [],
      improvementRisks,
    });

    if (mode === "append") {
      const base = String(currentFinalText || "").trimEnd();
      onApplyDraftText(base ? `${base}\n\n${generatedText}` : generatedText);
    } else {
      onApplyDraftText(generatedText);
    }
    setConfirmState(null);
  }

  function handleGenerateNarrativeClick() {
    if (hasExistingText) {
      setConfirmState("confirming");
    } else {
      applyGeneratedNarrative("replace");
    }
  }

  const answeredCount = useMemo(() => {
    let count = 0;
    AUDIT_QUESTIONS_S10.forEach(({ clause, questions }) => {
      questions.forEach((_, index) => {
        if (hasText((guidedAnswers[clause] || {})[`q${index}`])) count += 1;
      });
    });
    return count;
  }, [guidedAnswers]);

  const totalQuestions = AUDIT_QUESTIONS_S10.reduce((acc, entry) => acc + entry.questions.length, 0);

  function signalIcon(status) {
    if (status === "ok") return "OK";
    if (status === "warning") return "!";
    if (status === "critical") return "X";
    return "-";
  }

  return (
    <div className="s5-panel s10-panel">
      <div className="s8-summary-bar">
        {executiveSignals.map((signal) => (
          <div key={signal.id} className={`s8-signal s8-signal-${signal.status}`}>
            <span className="s8-signal-icon" aria-hidden="true">
              {signalIcon(signal.status)}
            </span>
            <div className="s8-signal-body">
              <span className="s8-signal-label">{signal.label}</span>
              <span className="s8-signal-detail">{signal.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {improvementRisks.length > 0 && (
        <div className="s8-risks-block">
          <div className="s8-risks-header">
            <span className="s8-risks-title">Riesgos de mejora y acciones correctivas</span>
            <span className="s8-risks-subtitle">Calculado automaticamente con base en la matriz</span>
          </div>
          <div className="s8-risks-list">
            {improvementRisks.map((risk) => (
              <div key={risk.id} className={`s8-risk-item s8-risk-${risk.severity}`}>
                <span className="s8-risk-icon" aria-hidden="true">
                  {risk.severity === "critical" ? "X" : "!"}
                </span>
                <span className="s8-risk-label">{risk.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="s10-context-grid" aria-label="Contexto de mejora y no conformidades">
        <article className="s10-context-card">
          <h4>Sistema de mejora continua</h4>
          <div className="s10-context-fields">
            <label className="field-stack s10-field-wide">
              <span>Sistema de mejora</span>
              <textarea
                className="input-textarea"
                rows={2}
                value={valuesByFieldCode?.improvement_system_summary || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("improvement_system_summary", event.target.value)}
              />
            </label>
            <label className="field-stack s10-field-wide">
              <span>Mecanismo de mejora continua</span>
              <textarea
                className="input-textarea"
                rows={2}
                value={valuesByFieldCode?.continuous_improvement_mechanism_summary || ""}
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange("continuous_improvement_mechanism_summary", event.target.value)
                }
              />
            </label>
            <label className="field-stack">
              <span>Salidas de revision usadas para mejorar</span>
              <select
                className="input-select"
                value={
                  valuesByFieldCode?.management_review_outputs_used_for_improvement === true
                    ? "yes"
                    : valuesByFieldCode?.management_review_outputs_used_for_improvement === false
                      ? "no"
                      : ""
                }
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange(
                    "management_review_outputs_used_for_improvement",
                    event.target.value === "yes" ? true : event.target.value === "no" ? false : null
                  )
                }
              >
                <option value="">Sin dato</option>
                <option value="yes">Si</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="field-stack s10-field-wide">
              <span>Seguimiento de reuniones de mejora</span>
              <textarea
                className="input-textarea"
                rows={2}
                value={valuesByFieldCode?.improvement_meetings_summary || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("improvement_meetings_summary", event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="s10-context-card">
          <h4>No conformidades y trazabilidad base</h4>
          <div className="s10-context-fields">
            <label className="field-stack">
              <span>Referencia de procedimiento NC</span>
              <input
                className="input-text"
                value={valuesByFieldCode?.nonconformities_procedure_reference || ""}
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange("nonconformities_procedure_reference", event.target.value)
                }
              />
            </label>
            <label className="field-stack">
              <span>Existen NC de proveedor</span>
              <select
                className="input-select"
                value={
                  valuesByFieldCode?.supplier_nc_exists === true
                    ? "yes"
                    : valuesByFieldCode?.supplier_nc_exists === false
                      ? "no"
                      : ""
                }
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange(
                    "supplier_nc_exists",
                    event.target.value === "yes" ? true : event.target.value === "no" ? false : null
                  )
                }
              >
                <option value="">Sin dato</option>
                <option value="yes">Si</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="field-stack">
              <span>Existen NC internas</span>
              <select
                className="input-select"
                value={
                  valuesByFieldCode?.internal_nc_exists === true
                    ? "yes"
                    : valuesByFieldCode?.internal_nc_exists === false
                      ? "no"
                      : ""
                }
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange(
                    "internal_nc_exists",
                    event.target.value === "yes" ? true : event.target.value === "no" ? false : null
                  )
                }
              >
                <option value="">Sin dato</option>
                <option value="yes">Si</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="field-stack">
              <span>Acciones correctivas con seguimiento</span>
              <select
                className="input-select"
                value={
                  valuesByFieldCode?.corrective_actions_followed === true
                    ? "yes"
                    : valuesByFieldCode?.corrective_actions_followed === false
                      ? "no"
                      : ""
                }
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange(
                    "corrective_actions_followed",
                    event.target.value === "yes" ? true : event.target.value === "no" ? false : null
                  )
                }
              >
                <option value="">Sin dato</option>
                <option value="yes">Si</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="field-stack s10-field-wide">
              <span>Resumen NC proveedor</span>
              <textarea
                className="input-textarea"
                rows={2}
                value={valuesByFieldCode?.supplier_nc_summary || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("supplier_nc_summary", event.target.value)}
              />
            </label>
            <label className="field-stack s10-field-wide">
              <span>Resumen NC internas</span>
              <textarea
                className="input-textarea"
                rows={2}
                value={valuesByFieldCode?.internal_nc_summary || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("internal_nc_summary", event.target.value)}
              />
            </label>
            <label className="field-stack s10-field-wide">
              <span>Oportunidades de mejora</span>
              <textarea
                className="input-textarea"
                rows={2}
                value={valuesByFieldCode?.improvement_opportunities_summary || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("improvement_opportunities_summary", event.target.value)}
              />
            </label>
          </div>
        </article>
      </section>

      <section className="s5-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Matriz central de acciones correctivas</h4>
          <p className="s5-block-desc">
            Registro ejecutivo de hallazgos, causa raiz, acciones, responsables, plazos, estado y eficacia.
          </p>
        </div>

        {matrixSummary.total > 0 && (
          <div className="s10-matrix-summary">
            {[
              {
                id: "open",
                label: "Abiertas/en progreso",
                value: matrixSummary.openLike,
                className: "s10-chip-warning",
              },
              {
                id: "overdue",
                label: "Vencidas",
                value: matrixSummary.overdue,
                className: "s10-chip-critical",
              },
              {
                id: "effective",
                label: "Efectivas",
                value: matrixSummary.effective,
                className: "s10-chip-ok",
              },
              {
                id: "ineffective",
                label: "Ineficaces",
                value: matrixSummary.ineffective,
                className: "s10-chip-critical",
              },
            ]
              .filter((item) => item.value > 0)
              .map((item) => (
                <span key={item.id} className={`s10-matrix-chip ${item.className}`}>
                  {item.value} {item.label}
                </span>
              ))}
          </div>
        )}

        <EditableAuditMatrix
          value={matrixRows}
          onChange={(rows) => !disabled && onFieldChange("corrective_actions_matrix", rows)}
          schema={CORRECTIVE_ACTION_SCHEMA}
          addLabel="Anadir accion"
          emptyText="Sin acciones registradas. Anade acciones correctivas, oportunidades o mejoras."
          disabled={disabled}
        />
      </section>

      <section className="s5-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Preguntas guiadas por clausula</h4>
          <p className="s5-block-desc">
            Responde por clausula ISO 10. El estado sugerido se calcula sin asumir cumplimiento por defecto.
          </p>
        </div>

        <div className="s5-summary-bar">
          <span className="s5-summary-label">
            Preguntas respondidas: <strong>{answeredCount}/{totalQuestions}</strong>
          </span>
          <div className="s5-summary-clauses">
            {AUDIT_QUESTIONS_S10.map((entry) => {
              const suggested = suggestedStatusByClause[entry.clause];
              const current = getCurrentClauseStatus(entry.clause);
              return (
                <span
                  key={entry.clause}
                  className={`s5-clause-pill ${suggested ? STATUS_CLASS[suggested] : "s5-status-empty"}`}
                  title={`${entry.clause}: sugerido ${getClauseStatusLabel(suggested)} | C actual ${getClauseStatusLabel(current)}`}
                >
                  {entry.clause}
                </span>
              );
            })}
          </div>
        </div>

        <div className="s5-clauses">
          {AUDIT_QUESTIONS_S10.map((entry) => {
            const isOpen = openClause === entry.clause;
            const clauseAnswers = guidedAnswers[entry.clause] || {};
            const answeredInClause = entry.questions.filter((_, index) =>
              hasText(clauseAnswers[`q${index}`])
            ).length;
            const suggested = suggestedStatusByClause[entry.clause];
            const current = getCurrentClauseStatus(entry.clause);

            return (
              <div key={entry.clause} className={`s5-clause-block${isOpen ? " s5-clause-open" : ""}`}>
                <button
                  type="button"
                  className="s5-clause-toggle"
                  onClick={() => setOpenClause(isOpen ? null : entry.clause)}
                >
                  <span className="s5-clause-code">{entry.clause}</span>
                  <span className="s5-clause-name">{entry.title}</span>
                  {answeredInClause > 0 && (
                    <span className="s5-clause-progress">
                      {answeredInClause}/{entry.questions.length}
                    </span>
                  )}
                  {suggested && (
                    <span className={`s5-clause-badge ${STATUS_CLASS[suggested]}`}>
                      {getClauseStatusLabel(suggested)}
                    </span>
                  )}
                  <span className="s5-clause-arrow" aria-hidden="true">
                    {isOpen ? "^" : "v"}
                  </span>
                </button>

                {isOpen && (
                  <div className="s5-clause-body">
                    <ul className="s5-question-list">
                      {entry.questions.map((question, index) => {
                        const answer = getAnswer(entry.clause, index);
                        const comment = getComment(entry.clause, index);
                        const commentKey = `${entry.clause}:q${index}`;
                        const commentOpen = openCommentFor === commentKey;

                        return (
                          <li
                            key={`${entry.clause}-q-${index}`}
                            className={`s5-question-item${answer ? ` s5-q-answered-${answer}` : ""}`}
                          >
                            <div className="s5-question-row">
                              <span className="s5-question-text">{question}</span>
                              <div className="s5-answer-group" role="group" aria-label={`Respuesta: ${question}`}>
                                {ANSWER_OPTIONS.map((option) => (
                                  <button
                                    key={`${entry.clause}-${index}-${option.value}`}
                                    type="button"
                                    className={`s5-answer-btn ${option.color}${answer === option.value ? " s5-answer-active" : ""}`}
                                    disabled={disabled}
                                    onClick={() =>
                                      setAnswer(
                                        entry.clause,
                                        index,
                                        answer === option.value ? "" : option.value
                                      )
                                    }
                                    aria-pressed={answer === option.value}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  className={`s5-comment-toggle${comment || commentOpen ? " s5-comment-has-text" : ""}`}
                                  disabled={disabled}
                                  onClick={() => setOpenCommentFor(commentOpen ? null : commentKey)}
                                  aria-expanded={commentOpen}
                                  title="Anadir comentario"
                                >
                                  {comment ? "E" : "+"}
                                </button>
                              </div>
                            </div>
                            {(commentOpen || comment) && (
                              <textarea
                                className="s5-question-comment"
                                value={comment}
                                rows={2}
                                disabled={disabled}
                                placeholder="Evidencia revisada u observacion concreta..."
                                onChange={(event) => setComment(entry.clause, index, event.target.value)}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="s5-clause-footer">
                      {suggested ? (
                        <>
                          <span className={`s5-suggested-badge ${STATUS_CLASS[suggested]}`}>
                            Sugerido: {getClauseStatusLabel(suggested)}
                          </span>
                          <span className="s5-current-badge soft-label">
                            C actual: {getClauseStatusLabel(current)}
                          </span>
                          {suggested !== current ? (
                            <button
                              type="button"
                              className="btn-secondary s5-apply-btn"
                              onClick={() => handleApplyToC(entry.clause, suggested)}
                              disabled={disabled}
                            >
                              Aplicar a bloque C
                            </button>
                          ) : (
                            <span className="soft-label s5-synced-label">Sincronizado con C</span>
                          )}
                        </>
                      ) : (
                        <span className="soft-label">Sin sugerencia automatica para esta clausula.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {applyConfirm && (
        <div className="s5-confirm-box">
          <p className="s5-confirm-msg">
            La clausula <strong>{applyConfirm.clauseCode}</strong> ya tiene estado{" "}
            <strong>{getClauseStatusLabel(applyConfirm.currentStatus)}</strong> en el bloque C. Reemplazar por{" "}
            <strong>{getClauseStatusLabel(applyConfirm.suggestedStatus)}</strong>?
          </p>
          <div className="s5-confirm-actions">
            <button type="button" className="btn-primary" onClick={confirmApplySuggestedStatus}>
              Si, aplicar
            </button>
            <button type="button" className="btn-ghost" onClick={() => setApplyConfirm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <section className="s5-block s10-draft-tools">
        <div className="s5-draft-row">
          <div className="s5-block-intro">
            <h4 className="s5-block-title">Generador narrativo de mejora</h4>
            <p className="s5-block-desc">
              Genera un texto profesional con base en acciones correctivas, eficacia, reincidencias, respuestas guiadas y estado de clausulas.
            </p>
          </div>
          {confirmState !== "confirming" && (
            <button
              type="button"
              className="btn-primary s5-generate-btn"
              disabled={disabled}
              onClick={handleGenerateNarrativeClick}
            >
              Generar borrador
            </button>
          )}
        </div>

        {confirmState === "confirming" && (
          <div className="s5-confirm-box">
            <p className="s5-confirm-msg">
              El bloque D ya contiene texto. Deseas reemplazarlo o anadir el nuevo texto al final?
            </p>
            <div className="s5-confirm-actions">
              <button type="button" className="btn-primary" onClick={() => applyGeneratedNarrative("replace")}>
                Reemplazar texto
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyGeneratedNarrative("append")}>
                Anadir al final
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
