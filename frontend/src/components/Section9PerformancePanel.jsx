import { useMemo, useState } from "react";
import AuditGuidedFields from "./AuditGuidedFields";
import { getSectionFieldGroups } from "../features/audits/sectionFieldDefinitions";

const SECTION9_P09_GROUPS = getSectionFieldGroups("9").filter(
  (group) => group.field_group === "indicadores_desempeno"
);

const CLAUSE_STATUS_LABEL = {
  compliant: "Cumple",
  partial: "Parcial",
  non_compliant: "No cumple",
};

const STATUS_CLASS = {
  compliant: "s5-status-compliant",
  partial: "s5-status-partial",
  non_compliant: "s5-status-noncompliant",
};

const ANSWER_OPTIONS = [
  { value: "yes", label: "Si", color: "s5-ans-yes" },
  { value: "partial", label: "Parcial", color: "s5-ans-partial" },
  { value: "no", label: "No", color: "s5-ans-no" },
  { value: "na", label: "N/A", color: "s5-ans-na" },
];

const SECTION9_QUESTIONS = [
  {
    clause: "9.1",
    title: "Seguimiento, medicion, analisis y evaluacion",
    questions: [
      "La organizacion realiza seguimiento y medicion de los procesos clave?",
      "Los indicadores tienen objetivos o criterios definidos?",
      "Se analizan los resultados y tendencias?",
      "Se toman acciones cuando los resultados no son satisfactorios?",
    ],
  },
  {
    clause: "9.1.2",
    title: "Satisfaccion del cliente",
    questions: [
      "Se realiza seguimiento de la satisfaccion del cliente?",
      "Existe evidencia de encuestas, feedback o reclamaciones?",
      "Los resultados se analizan y documentan?",
      "Se definen acciones cuando hay resultados negativos?",
    ],
  },
  {
    clause: "9.2",
    title: "Auditoria interna",
    questions: [
      "Existe programa o plan de auditoria interna?",
      "La auditoria interna se ha realizado segun lo planificado?",
      "Los hallazgos se documentan y comunican?",
      "Se realiza seguimiento de acciones derivadas?",
    ],
  },
  {
    clause: "9.3",
    title: "Revision por la direccion",
    questions: [
      "La revision por direccion se realiza a intervalos planificados?",
      "Incluye entradas relevantes: indicadores, satisfaccion, auditorias, NCs, riesgos y oportunidades?",
      "Genera decisiones o salidas documentadas?",
      "Se realiza seguimiento de las acciones acordadas?",
    ],
  },
];

const STATUS_SEVERITY = {
  non_compliant: 3,
  partial: 2,
  compliant: 1,
};

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function normalizeNumber(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function calculateAnnualValue(q1, q2, q3, annualMode = "average") {
  const values = [q1, q2, q3].filter((value) => Number.isFinite(value));
  if (values.length === 0) return null;
  const total = values.reduce((acc, value) => acc + value, 0);
  if (annualMode === "sum") return total;
  return total / values.length;
}

function hasTrackingEvidence(q1, q2, q3, target) {
  const values = [q1, q2, q3].filter((value) => Number.isFinite(value));
  if (values.length === 0) return false;
  const allZero = values.every((value) => value === 0);
  if (allZero && !Number.isFinite(target)) return false;
  return true;
}

function evaluateIndicatorStatus({ q1, q2, q3, target, annualValue }) {
  const hasData = hasTrackingEvidence(q1, q2, q3, target);
  if (!hasData) return "no_data";
  if (!Number.isFinite(target)) return "in_progress";
  if (!Number.isFinite(annualValue)) return "no_data";
  return annualValue >= target ? "compliant" : "non_compliant";
}

function normalizePerformanceRows(rawMatrix) {
  if (Array.isArray(rawMatrix)) {
    return rawMatrix.map((row, index) => {
      const q1 = normalizeNumber(row?.result);
      const q2 = null;
      const q3 = null;
      const target = normalizeNumber(row?.objective);
      const annualValue = calculateAnnualValue(q1, q2, q3, "average");
      return {
        id: String(row?.id || `legacy-${index + 1}`),
        area: String(row?.process || ""),
        indicator: String(row?.indicator || ""),
        target,
        q1,
        q2,
        q3,
        annualValue,
        statusCode: evaluateIndicatorStatus({ q1, q2, q3, target, annualValue }),
      };
    });
  }

  if (rawMatrix && typeof rawMatrix === "object") {
    const indicators = Array.isArray(rawMatrix.indicators) ? rawMatrix.indicators : [];
    const tracking = Array.isArray(rawMatrix.tracking) ? rawMatrix.tracking : [];
    const annualMode = String(rawMatrix.annual_mode || "").toLowerCase() === "sum" ? "sum" : "average";
    const trackingByIndicator = new Map(
      tracking.map((entry) => [String(entry?.indicator_id || ""), entry || {}])
    );

    return indicators.map((indicator, index) => {
      const indicatorId = String(indicator?.id || `indicator-${index + 1}`);
      const trackingRow = trackingByIndicator.get(indicatorId) || {};
      const q1 = normalizeNumber(trackingRow?.q1);
      const q2 = normalizeNumber(trackingRow?.q2);
      const q3 = normalizeNumber(trackingRow?.q3);
      const target = normalizeNumber(indicator?.target);
      const annualValue = calculateAnnualValue(q1, q2, q3, annualMode);

      return {
        id: indicatorId,
        area: String(indicator?.area || ""),
        indicator: String(indicator?.indicator || ""),
        target,
        q1,
        q2,
        q3,
        annualValue,
        statusCode: evaluateIndicatorStatus({ q1, q2, q3, target, annualValue }),
      };
    });
  }

  return [];
}

function formatMetric(value) {
  if (!Number.isFinite(value)) return "-";
  const hasDecimals = Math.abs(value % 1) > 0;
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function worstStatus(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return (STATUS_SEVERITY[a] || 0) >= (STATUS_SEVERITY[b] || 0) ? a : b;
}

function computeSuggestedStatusFromAnswers(clauseAnswers) {
  const values = Object.entries(clauseAnswers || {})
    .filter(([key]) => /^q\d+$/.test(key))
    .map(([, value]) => String(value || "").trim())
    .filter(Boolean);

  if (values.length === 0) return null;
  if (values.every((value) => value === "na")) return null;
  if (values.some((value) => value === "no")) return "non_compliant";
  if (values.some((value) => value === "partial")) return "partial";
  if (values.every((value) => value === "yes" || value === "na")) return "compliant";
  return "partial";
}

function hasGuidedAnswerForClause(clauseAnswers) {
  return Object.entries(clauseAnswers || {}).some(
    ([key, value]) => /^q\d+$/.test(key) && String(value || "").trim()
  );
}

function normalizeClauseStatusForSignals(check, clauseAnswers) {
  if (!check || check.applicable === false) return null;
  const status = String(check.clause_status || "").trim();
  if (status !== "compliant" && status !== "partial" && status !== "non_compliant") return null;

  if (status === "compliant") {
    const hasEvidence = hasText(check.evidence_summary) || hasText(check.observation_text);
    const hasGuided = hasGuidedAnswerForClause(clauseAnswers);
    if (!hasEvidence && !hasGuided) return null;
  }
  return status;
}

function mapClauseStatusToSignalState(status) {
  if (status === "compliant") return "ok";
  if (status === "partial") return "warning";
  if (status === "non_compliant") return "critical";
  return "neutral";
}

function buildSignalStateFromRate(rate) {
  if (!Number.isFinite(rate)) return "neutral";
  if (rate >= 0.85) return "ok";
  if (rate >= 0.6) return "warning";
  return "critical";
}

function getStatusLabel(status) {
  if (!status) return "Sin datos";
  return CLAUSE_STATUS_LABEL[status] || "Sin datos";
}

function buildSection9DraftText({
  valuesByFieldCode,
  performanceMetrics,
  answerStatusByClause,
  suggestedStatusByClause,
  normalizedClauseStatusByCode,
}) {
  const parts = [];
  const totalIndicators = performanceMetrics.totalIndicators;
  const trackedIndicators = performanceMetrics.trackedIndicators;
  const evaluatedIndicators = performanceMetrics.evaluatedIndicators;
  const compliantIndicators = performanceMetrics.compliantIndicators;
  const deviatedIndicators = performanceMetrics.deviatedIndicators;
  const withoutDataIndicators = performanceMetrics.withoutDataIndicators;

  parts.push("Evaluacion del desempeno del SGC en la seccion 9.");

  if (totalIndicators === 0) {
    parts.push("No se han registrado indicadores en el documento P09 de desempeno.");
  } else {
    let kpiBlock =
      `Se revisaron ${totalIndicators} indicadores del documento P09. ` +
      `${trackedIndicators} tienen seguimiento registrado y ${evaluatedIndicators} pudieron evaluarse contra su meta. ` +
      `${compliantIndicators} cumplen, ${deviatedIndicators} presentan desviacion y ${withoutDataIndicators} quedan sin datos suficientes.`;
    if (withoutDataIndicators > 0) {
      kpiBlock += " No se ha registrado evidencia suficiente sobre parte del seguimiento de indicadores.";
    }
    if (deviatedIndicators > 0) {
      kpiBlock +=
        " Se recomienda analizar causas, definir acciones correctivas y verificar su eficacia en el siguiente ciclo.";
    }
    parts.push(kpiBlock);
  }

  const surveysCount = normalizeNumber(valuesByFieldCode?.customer_satisfaction_surveys_count);
  const responseRate = normalizeNumber(valuesByFieldCode?.customer_satisfaction_response_rate);
  const globalScore = normalizeNumber(valuesByFieldCode?.customer_satisfaction_global_score);
  const recommendation = String(valuesByFieldCode?.customer_satisfaction_recommendation || "").trim();
  const hasCustomerEvidence =
    Number.isFinite(surveysCount) ||
    Number.isFinite(responseRate) ||
    Number.isFinite(globalScore) ||
    Boolean(recommendation);

  if (!hasCustomerEvidence) {
    parts.push("No se ha registrado evidencia suficiente sobre el seguimiento de satisfaccion del cliente (9.1.2).");
  } else {
    let block = "Satisfaccion del cliente (9.1.2):";
    if (Number.isFinite(surveysCount)) block += ` encuestas registradas ${formatMetric(surveysCount)}.`;
    if (Number.isFinite(responseRate)) block += ` tasa de respuesta ${formatMetric(responseRate)}%.`;
    if (Number.isFinite(globalScore)) block += ` valoracion global ${formatMetric(globalScore)} sobre 10.`;
    if (recommendation) block += ` recomendacion declarada: ${recommendation}.`;
    parts.push(block);
  }

  const internalAuditProgram = String(valuesByFieldCode?.internal_audit_program_exists || "").trim();
  const internalAuditPlanDate = String(valuesByFieldCode?.internal_audit_plan_date || "").trim();
  const internalAuditSummary = String(valuesByFieldCode?.internal_audit_summary || "").trim();
  const hasInternalAuditEvidence =
    Boolean(internalAuditProgram) || Boolean(internalAuditPlanDate) || Boolean(internalAuditSummary);

  if (!hasInternalAuditEvidence) {
    parts.push("No se ha registrado evidencia suficiente sobre auditoria interna (9.2).");
  } else {
    const programText =
      internalAuditProgram === "yes"
        ? "Existe programa de auditoria interna."
        : internalAuditProgram === "no"
          ? "No existe programa de auditoria interna."
          : "No se registro explicitamente el estado del programa de auditoria interna.";
    let block = `Auditoria interna (9.2): ${programText}`;
    if (internalAuditPlanDate) block += ` Fecha planificada registrada: ${internalAuditPlanDate}.`;
    if (internalAuditSummary) block += ` Resumen: ${internalAuditSummary}`;
    parts.push(block);
  }

  const managementReviewDate = String(valuesByFieldCode?.management_review_date || "").trim();
  const managementReviewSummary = String(valuesByFieldCode?.management_review_summary || "").trim();
  const hasManagementReviewEvidence = Boolean(managementReviewDate) || Boolean(managementReviewSummary);

  if (!hasManagementReviewEvidence) {
    parts.push("No se ha registrado evidencia suficiente sobre revision por la direccion (9.3).");
  } else {
    let block = "Revision por la direccion (9.3):";
    if (managementReviewDate) block += ` ultima fecha registrada ${managementReviewDate}.`;
    if (managementReviewSummary) block += ` Resumen: ${managementReviewSummary}`;
    parts.push(block);
  }

  const guidedSummary = SECTION9_QUESTIONS.map((entry) => {
    const answerStatus = answerStatusByClause[entry.clause];
    const suggestedStatus = suggestedStatusByClause[entry.clause];
    return `${entry.clause}: respuestas ${getStatusLabel(answerStatus)}, evaluacion sugerida ${getStatusLabel(
      suggestedStatus
    )}`;
  }).join(" | ");
  parts.push(`Resultado de preguntas guiadas: ${guidedSummary}.`);

  const checks = Object.entries(normalizedClauseStatusByCode)
    .filter(([, status]) => Boolean(status))
    .map(([clauseCode, status]) => ({ clauseCode, status }));

  if (checks.length === 0) {
    parts.push("No hay verificacion consolidada en el bloque C para las clausulas aplicables de la seccion 9.");
  } else {
    const nonCompliant = checks.filter((entry) => entry.status === "non_compliant").map((entry) => entry.clauseCode);
    const partial = checks.filter((entry) => entry.status === "partial").map((entry) => entry.clauseCode);
    const compliant = checks.filter((entry) => entry.status === "compliant").map((entry) => entry.clauseCode);
    let block =
      `Verificacion de clausulas en bloque C: ${compliant.length} cumple, ${partial.length} parcial y ${nonCompliant.length} no cumple.`;
    if (nonCompliant.length > 0) {
      block += ` Clausulas con no conformidad: ${nonCompliant.join(", ")}.`;
    }
    if (partial.length > 0) {
      block += ` Clausulas con cumplimiento parcial: ${partial.join(", ")}.`;
    }
    parts.push(block);
  }

  const conclusionsSummary = String(valuesByFieldCode?.performance_conclusions_summary || "").trim();
  const trendsSummary = String(valuesByFieldCode?.performance_trends_summary || "").trim();
  const deviationsSummary = String(valuesByFieldCode?.performance_deviations_summary || "").trim();

  if (conclusionsSummary) {
    parts.push(`Conclusiones del auditor: ${conclusionsSummary}`);
  }
  if (trendsSummary) {
    parts.push(`Tendencias observadas: ${trendsSummary}`);
  }
  if (deviationsSummary) {
    parts.push(`Desviaciones registradas: ${deviationsSummary}`);
  }

  return parts.join("\n\n");
}

export default function Section9PerformancePanel({
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
  const [applyConfirm, setApplyConfirm] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const guidedAnswers = useMemo(() => {
    const raw = valuesByFieldCode?.s9_guided_answers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }, [valuesByFieldCode]);

  const performanceRows = useMemo(
    () => normalizePerformanceRows(valuesByFieldCode?.performance_indicators_matrix),
    [valuesByFieldCode]
  );

  const performanceMetrics = useMemo(() => {
    const totalIndicators = performanceRows.length;
    const trackedIndicators = performanceRows.filter((row) =>
      hasTrackingEvidence(row.q1, row.q2, row.q3, row.target)
    ).length;
    const compliantIndicators = performanceRows.filter((row) => row.statusCode === "compliant").length;
    const deviatedIndicators = performanceRows.filter((row) => row.statusCode === "non_compliant").length;
    const withoutDataIndicators = performanceRows.filter((row) => row.statusCode === "no_data").length;
    const evaluatedIndicators = performanceRows.filter(
      (row) => row.statusCode === "compliant" || row.statusCode === "non_compliant"
    ).length;
    const complianceRate =
      evaluatedIndicators > 0 ? compliantIndicators / Math.max(evaluatedIndicators, 1) : null;
    return {
      totalIndicators,
      trackedIndicators,
      compliantIndicators,
      deviatedIndicators,
      withoutDataIndicators,
      evaluatedIndicators,
      complianceRate,
    };
  }, [performanceRows]);

  const answerStatusByClause = useMemo(() => {
    const next = {};
    SECTION9_QUESTIONS.forEach(({ clause }) => {
      next[clause] = computeSuggestedStatusFromAnswers(guidedAnswers[clause]);
    });
    return next;
  }, [guidedAnswers]);

  const dataStatusByClause = useMemo(() => {
    const clause91DataStatus = (() => {
      if (performanceMetrics.totalIndicators === 0 || performanceMetrics.trackedIndicators === 0) {
        return null;
      }
      if (performanceMetrics.deviatedIndicators > 0) {
        if (
          performanceMetrics.evaluatedIndicators > 0 &&
          performanceMetrics.deviatedIndicators / performanceMetrics.evaluatedIndicators >= 0.4
        ) {
          return "non_compliant";
        }
        return "partial";
      }
      if (performanceMetrics.evaluatedIndicators === 0) return null;
      return performanceMetrics.compliantIndicators === performanceMetrics.evaluatedIndicators
        ? "compliant"
        : "partial";
    })();

    const clause912DataStatus = (() => {
      const surveysCount = normalizeNumber(valuesByFieldCode?.customer_satisfaction_surveys_count);
      const responseRate = normalizeNumber(valuesByFieldCode?.customer_satisfaction_response_rate);
      const globalScore = normalizeNumber(valuesByFieldCode?.customer_satisfaction_global_score);
      const recommendation = String(valuesByFieldCode?.customer_satisfaction_recommendation || "").trim();
      const hasData =
        Number.isFinite(surveysCount) ||
        Number.isFinite(responseRate) ||
        Number.isFinite(globalScore) ||
        Boolean(recommendation);

      if (!hasData) return null;

      let status = "partial";
      if (Number.isFinite(globalScore)) {
        if (globalScore < 5) status = "non_compliant";
        else if (globalScore < 7) status = "partial";
        else status = "compliant";
      }

      if (Number.isFinite(responseRate)) {
        if (responseRate < 10) status = worstStatus(status, "non_compliant");
        else if (responseRate < 25) status = worstStatus(status, "partial");
      }

      if (Number.isFinite(surveysCount) && surveysCount === 0 && status === "compliant") {
        status = "partial";
      }

      return status;
    })();

    const clause92DataStatus = (() => {
      const programExists = String(valuesByFieldCode?.internal_audit_program_exists || "").trim();
      const auditDate = String(valuesByFieldCode?.internal_audit_plan_date || "").trim();
      const summary = String(valuesByFieldCode?.internal_audit_summary || "").trim();
      const hasData = Boolean(programExists) || Boolean(auditDate) || Boolean(summary);
      if (!hasData) return null;
      if (programExists === "no") return "non_compliant";
      if (programExists !== "yes" || !auditDate || !summary) return "partial";
      return "compliant";
    })();

    const clause93DataStatus = (() => {
      const reviewDate = String(valuesByFieldCode?.management_review_date || "").trim();
      const reviewSummary = String(valuesByFieldCode?.management_review_summary || "").trim();
      const hasData = Boolean(reviewDate) || Boolean(reviewSummary);
      if (!hasData) return null;
      if (reviewDate && reviewSummary) return "compliant";
      return "partial";
    })();

    return {
      "9.1": clause91DataStatus,
      "9.1.2": clause912DataStatus,
      "9.2": clause92DataStatus,
      "9.3": clause93DataStatus,
    };
  }, [performanceMetrics, valuesByFieldCode]);

  const normalizedClauseStatusByCode = useMemo(() => {
    const next = {};
    SECTION9_QUESTIONS.forEach(({ clause }) => {
      const check = (clauseChecks || []).find((entry) => entry.clause_code === clause);
      next[clause] = normalizeClauseStatusForSignals(check, guidedAnswers[clause] || {});
    });
    return next;
  }, [clauseChecks, guidedAnswers]);

  const suggestedStatusByClause = useMemo(() => {
    const next = {};
    SECTION9_QUESTIONS.forEach(({ clause }) => {
      next[clause] = worstStatus(answerStatusByClause[clause], dataStatusByClause[clause]);
    });
    return next;
  }, [answerStatusByClause, dataStatusByClause]);

  const answeredCount = useMemo(() => {
    let count = 0;
    SECTION9_QUESTIONS.forEach(({ clause, questions }) => {
      questions.forEach((_, index) => {
        if (String((guidedAnswers[clause] || {})[`q${index}`] || "").trim()) count += 1;
      });
    });
    return count;
  }, [guidedAnswers]);

  const totalQuestions = SECTION9_QUESTIONS.reduce((acc, entry) => acc + entry.questions.length, 0);

  const executiveSignals = useMemo(() => {
    const clause912Status = worstStatus(
      normalizedClauseStatusByCode["9.1.2"],
      suggestedStatusByClause["9.1.2"]
    );
    const clause92Status = worstStatus(normalizedClauseStatusByCode["9.2"], suggestedStatusByClause["9.2"]);
    const clause93Status = worstStatus(normalizedClauseStatusByCode["9.3"], suggestedStatusByClause["9.3"]);

    const indicatorsEvaluatedSignal = (() => {
      if (performanceMetrics.totalIndicators === 0 || performanceMetrics.trackedIndicators === 0) {
        return {
          key: "evaluated",
          label: "Indicadores evaluados",
          state: "neutral",
          detail: "Sin datos",
        };
      }

      if (
        performanceMetrics.evaluatedIndicators > 0 &&
        performanceMetrics.deviatedIndicators / performanceMetrics.evaluatedIndicators >= 0.4
      ) {
        return {
          key: "evaluated",
          label: "Indicadores evaluados",
          state: "critical",
          detail: `${performanceMetrics.evaluatedIndicators} evaluados, ${performanceMetrics.deviatedIndicators} desviados`,
        };
      }

      if (performanceMetrics.withoutDataIndicators > 0 || performanceMetrics.deviatedIndicators > 0) {
        return {
          key: "evaluated",
          label: "Indicadores evaluados",
          state: "warning",
          detail: `${performanceMetrics.trackedIndicators} con seguimiento`,
        };
      }

      return {
        key: "evaluated",
        label: "Indicadores evaluados",
        state: "ok",
        detail: `${performanceMetrics.trackedIndicators} con seguimiento`,
      };
    })();

    return [
      indicatorsEvaluatedSignal,
      {
        key: "kpi",
        label: "Cumplimiento de KPIs",
        state:
          performanceMetrics.evaluatedIndicators === 0
            ? "neutral"
            : buildSignalStateFromRate(performanceMetrics.complianceRate),
        detail:
          performanceMetrics.evaluatedIndicators === 0
            ? "Sin datos"
            : `${formatPercent(performanceMetrics.complianceRate)} de objetivos`,
      },
      {
        key: "customer",
        label: "Satisfaccion cliente",
        state: mapClauseStatusToSignalState(clause912Status),
        detail: getStatusLabel(clause912Status),
      },
      {
        key: "internal_audit",
        label: "Auditoria interna",
        state: mapClauseStatusToSignalState(clause92Status),
        detail: getStatusLabel(clause92Status),
      },
      {
        key: "management_review",
        label: "Revision por direccion",
        state: mapClauseStatusToSignalState(clause93Status),
        detail: getStatusLabel(clause93Status),
      },
    ];
  }, [normalizedClauseStatusByCode, performanceMetrics, suggestedStatusByClause]);

  const hasExistingText = hasText(currentFinalText);

  function setAnswer(clauseCode, questionIndex, value) {
    if (disabled) return;
    const next = {
      ...guidedAnswers,
      [clauseCode]: {
        ...(guidedAnswers[clauseCode] || {}),
        [`q${questionIndex}`]: value,
      },
    };
    onFieldChange("s9_guided_answers", next);
  }

  function setComment(clauseCode, questionIndex, text) {
    if (disabled) return;
    const next = {
      ...guidedAnswers,
      [clauseCode]: {
        ...(guidedAnswers[clauseCode] || {}),
        [`q${questionIndex}_comment`]: text,
      },
    };
    onFieldChange("s9_guided_answers", next);
  }

  function getCurrentClauseStatus(clauseCode) {
    return normalizedClauseStatusByCode[clauseCode] || null;
  }

  function handleApplyToC(clauseCode, suggestedStatus) {
    if (!suggestedStatus) return;
    const currentStatus = getCurrentClauseStatus(clauseCode);
    if (currentStatus === suggestedStatus) return;

    const shouldConfirm = currentStatus && currentStatus !== "compliant";
    if (shouldConfirm) {
      setApplyConfirm({ clauseCode, suggestedStatus, currentStatus });
      return;
    }

    onApplySuggestedClauseCheck(clauseCode, suggestedStatus);
  }

  function confirmApplySuggestedStatus() {
    if (!applyConfirm) return;
    onApplySuggestedClauseCheck(applyConfirm.clauseCode, applyConfirm.suggestedStatus);
    setApplyConfirm(null);
  }

  function applyGeneratedNarrative(mode) {
    const generatedText = buildSection9DraftText({
      valuesByFieldCode: valuesByFieldCode || {},
      performanceMetrics,
      answerStatusByClause,
      suggestedStatusByClause,
      normalizedClauseStatusByCode,
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

  return (
    <div className="s9-panel">
      <div className="s9-summary-grid">
        <article className="s9-summary-card">
          <span>Indicadores totales</span>
          <strong>{performanceMetrics.totalIndicators}</strong>
        </article>
        <article className="s9-summary-card">
          <span>Con seguimiento</span>
          <strong>{performanceMetrics.trackedIndicators}</strong>
        </article>
        <article className="s9-summary-card">
          <span>Cumplen</span>
          <strong>{performanceMetrics.compliantIndicators}</strong>
        </article>
        <article className="s9-summary-card">
          <span>Sin datos</span>
          <strong>{performanceMetrics.withoutDataIndicators}</strong>
        </article>
        <article className="s9-summary-card">
          <span>Criticos / desviados</span>
          <strong>{performanceMetrics.deviatedIndicators}</strong>
        </article>
      </div>

      <div className="s9-signal-bar">
        {executiveSignals.map((signal) => (
          <article key={signal.key} className={`s9-signal-card s9-signal-${signal.state}`}>
            <p className="s9-signal-title">{signal.label}</p>
            <p className="s9-signal-value">{signal.detail}</p>
          </article>
        ))}
      </div>

      <section className="s9-p09-host" aria-label="Workspace P09 de indicadores">
        {SECTION9_P09_GROUPS.length === 0 ? (
          <p className="empty-state">No se encontro la configuracion del documento P09 de indicadores.</p>
        ) : (
          <AuditGuidedFields
            auditReportId={null}
            sectionTitle="Evaluacion del desempeno"
            groups={SECTION9_P09_GROUPS}
            valuesByFieldCode={valuesByFieldCode}
            onFieldChange={onFieldChange}
            disabled={disabled}
          />
        )}
      </section>

      <section className="s9-context-grid" aria-label="Datos de seguimiento de clausulas 9.1.2, 9.2 y 9.3">
        <article className="s9-context-card">
          <h4>9.1.2 Satisfaccion del cliente</h4>
          <div className="s9-context-fields">
            <label className="field-stack">
              <span>Numero de encuestas</span>
              <input
                type="number"
                className="input-text"
                value={valuesByFieldCode?.customer_satisfaction_surveys_count ?? ""}
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange("customer_satisfaction_surveys_count", event.target.value)
                }
              />
            </label>
            <label className="field-stack">
              <span>Tasa de respuesta (%)</span>
              <input
                type="number"
                className="input-text"
                value={valuesByFieldCode?.customer_satisfaction_response_rate ?? ""}
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange("customer_satisfaction_response_rate", event.target.value)
                }
              />
            </label>
            <label className="field-stack">
              <span>Valoracion global (0-10)</span>
              <input
                type="number"
                step="any"
                className="input-text"
                value={valuesByFieldCode?.customer_satisfaction_global_score ?? ""}
                disabled={disabled}
                onChange={(event) =>
                  onFieldChange("customer_satisfaction_global_score", event.target.value)
                }
              />
            </label>
            <label className="field-stack s9-field-wide">
              <span>Feedback y recomendaciones</span>
              <textarea
                className="input-textarea"
                value={valuesByFieldCode?.customer_satisfaction_recommendation || ""}
                disabled={disabled}
                rows={2}
                onChange={(event) =>
                  onFieldChange("customer_satisfaction_recommendation", event.target.value)
                }
              />
            </label>
          </div>
        </article>

        <article className="s9-context-card">
          <h4>9.2 Auditoria interna</h4>
          <div className="s9-context-fields">
            <label className="field-stack">
              <span>Programa anual de auditoria interna</span>
              <select
                className="input-select"
                value={valuesByFieldCode?.internal_audit_program_exists || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("internal_audit_program_exists", event.target.value)}
              >
                <option value="">Sin dato</option>
                <option value="yes">Si</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="field-stack">
              <span>Fecha del plan / ejecucion</span>
              <input
                type="date"
                className="input-text"
                value={valuesByFieldCode?.internal_audit_plan_date || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("internal_audit_plan_date", event.target.value)}
              />
            </label>
            <label className="field-stack s9-field-wide">
              <span>Resumen de hallazgos y seguimiento</span>
              <textarea
                className="input-textarea"
                value={valuesByFieldCode?.internal_audit_summary || ""}
                disabled={disabled}
                rows={3}
                onChange={(event) => onFieldChange("internal_audit_summary", event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="s9-context-card">
          <h4>9.3 Revision por la direccion</h4>
          <div className="s9-context-fields">
            <label className="field-stack">
              <span>Fecha de la revision</span>
              <input
                type="date"
                className="input-text"
                value={valuesByFieldCode?.management_review_date || ""}
                disabled={disabled}
                onChange={(event) => onFieldChange("management_review_date", event.target.value)}
              />
            </label>
            <label className="field-stack s9-field-wide">
              <span>Resumen de entradas, decisiones y acciones</span>
              <textarea
                className="input-textarea"
                value={valuesByFieldCode?.management_review_summary || ""}
                disabled={disabled}
                rows={3}
                onChange={(event) => onFieldChange("management_review_summary", event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="s9-context-card">
          <h4>Analisis del auditor</h4>
          <div className="s9-context-fields">
            <label className="field-stack s9-field-wide">
              <span>Conclusiones del desempeno</span>
              <textarea
                className="input-textarea"
                value={valuesByFieldCode?.performance_conclusions_summary || ""}
                disabled={disabled}
                rows={2}
                onChange={(event) =>
                  onFieldChange("performance_conclusions_summary", event.target.value)
                }
              />
            </label>
            <label className="field-stack s9-field-wide">
              <span>Tendencias observadas</span>
              <textarea
                className="input-textarea"
                value={valuesByFieldCode?.performance_trends_summary || ""}
                disabled={disabled}
                rows={2}
                onChange={(event) => onFieldChange("performance_trends_summary", event.target.value)}
              />
            </label>
            <label className="field-stack s9-field-wide">
              <span>Desviaciones detectadas</span>
              <textarea
                className="input-textarea"
                value={valuesByFieldCode?.performance_deviations_summary || ""}
                disabled={disabled}
                rows={2}
                onChange={(event) =>
                  onFieldChange("performance_deviations_summary", event.target.value)
                }
              />
            </label>
          </div>
        </article>
      </section>

      <section className="s5-block s9-guided-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Preguntas guiadas de evaluacion del desempeno</h4>
          <p className="s5-block-desc">
            Responde por clausula. El estado sugerido combina respuestas guiadas y evidencia registrada.
          </p>
        </div>

        <div className="s5-summary-bar">
          <span className="s5-summary-label">
            Preguntas respondidas: <strong>{answeredCount}/{totalQuestions}</strong>
          </span>
          <div className="s5-summary-clauses">
            {SECTION9_QUESTIONS.map((entry) => {
              const suggestedStatus = suggestedStatusByClause[entry.clause];
              const currentStatus = getCurrentClauseStatus(entry.clause);
              return (
                <span
                  key={entry.clause}
                  className={`s5-clause-pill ${
                    suggestedStatus ? STATUS_CLASS[suggestedStatus] : "s5-status-empty"
                  }`}
                  title={`${entry.clause}: sugerido ${getStatusLabel(suggestedStatus)} | C actual ${getStatusLabel(
                    currentStatus
                  )}`}
                >
                  {entry.clause}
                </span>
              );
            })}
          </div>
        </div>

        <div className="s5-clauses">
          {SECTION9_QUESTIONS.map((entry) => {
            const isOpen = openClause === entry.clause;
            const clauseAnswers = guidedAnswers[entry.clause] || {};
            const answeredInClause = entry.questions.filter((_, index) =>
              hasText(clauseAnswers[`q${index}`])
            ).length;
            const suggestedStatus = suggestedStatusByClause[entry.clause];
            const currentStatus = getCurrentClauseStatus(entry.clause);

            return (
              <div key={entry.clause} className={`s5-clause-block${isOpen ? " s5-clause-open" : ""}`}>
                <button
                  type="button"
                  className="s5-clause-toggle"
                  onClick={() => setOpenClause(isOpen ? null : entry.clause)}
                >
                  <span className="s5-clause-code">{entry.clause}</span>
                  <span className="s5-clause-name">{entry.title}</span>
                  {answeredInClause > 0 ? (
                    <span className="s5-clause-progress">
                      {answeredInClause}/{entry.questions.length}
                    </span>
                  ) : null}
                  {suggestedStatus ? (
                    <span className={`s5-clause-badge ${STATUS_CLASS[suggestedStatus]}`}>
                      {CLAUSE_STATUS_LABEL[suggestedStatus]}
                    </span>
                  ) : null}
                  <span className="s5-clause-arrow" aria-hidden="true">
                    {isOpen ? "^" : "v"}
                  </span>
                </button>

                {isOpen ? (
                  <div className="s5-clause-body">
                    <ul className="s5-question-list">
                      {entry.questions.map((question, index) => {
                        const answer = String(clauseAnswers[`q${index}`] || "");
                        const comment = String(clauseAnswers[`q${index}_comment`] || "");
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
                                    className={`s5-answer-btn ${option.color}${
                                      answer === option.value ? " s5-answer-active" : ""
                                    }`}
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
                                  className={`s5-comment-toggle${
                                    comment || commentOpen ? " s5-comment-has-text" : ""
                                  }`}
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
                                placeholder="Observacion o evidencia concreta..."
                                onChange={(event) => setComment(entry.clause, index, event.target.value)}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="s5-clause-footer">
                      {suggestedStatus ? (
                        <>
                          <span className={`s5-suggested-badge ${STATUS_CLASS[suggestedStatus]}`}>
                            Sugerido: {CLAUSE_STATUS_LABEL[suggestedStatus]}
                          </span>
                          <span className="s5-current-badge soft-label">
                            C actual: {getStatusLabel(currentStatus)}
                          </span>
                          {suggestedStatus !== currentStatus ? (
                            <button
                              type="button"
                              className="btn-secondary s5-apply-btn"
                              onClick={() => handleApplyToC(entry.clause, suggestedStatus)}
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
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {applyConfirm ? (
        <div className="s5-confirm-box">
          <p className="s5-confirm-msg">
            La clausula <strong>{applyConfirm.clauseCode}</strong> ya tiene estado{" "}
            <strong>{getStatusLabel(applyConfirm.currentStatus)}</strong> en el bloque C. Reemplazar por{" "}
            <strong>{getStatusLabel(applyConfirm.suggestedStatus)}</strong>?
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
      ) : null}

      <section className="s9-narrative-tools">
        <header className="s9-narrative-header">
          <h4>Generador narrativo del bloque D</h4>
          <p className="soft-label">
            Genera texto profesional usando P09, seguimiento, satisfaccion cliente, auditoria interna,
            revision por direccion, respuestas guiadas y estado de clausulas.
          </p>
        </header>
        <div className="inline-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            onClick={handleGenerateNarrativeClick}
          >
            Generar texto de evaluacion
          </button>
        </div>

        {confirmState === "confirming" ? (
          <div className="s5-confirm-box">
            <p className="s5-confirm-msg">
              Ya existe texto en el bloque D. Quieres reemplazarlo o anadir el nuevo texto al final?
            </p>
            <div className="s5-confirm-actions">
              <button type="button" className="btn-primary" onClick={() => applyGeneratedNarrative("replace")}>
                Reemplazar
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyGeneratedNarrative("append")}>
                Anadir al final
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmState(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
