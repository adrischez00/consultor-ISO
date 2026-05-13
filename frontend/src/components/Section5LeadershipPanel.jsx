import { useState, useMemo } from "react";

// ── Preguntas por cláusula ────────────────────────────────────────────────────

const AUDIT_QUESTIONS = [
  {
    clause: "5.1",
    title: "Liderazgo y compromiso",
    questions: [
      "¿La alta dirección demuestra liderazgo y compromiso activo con el SGC?",
      "¿Se asegura la integración del SGC en los procesos de negocio de la organización?",
      "¿Se promueve la mejora continua y el enfoque basado en procesos?",
      "¿Se asignan los recursos necesarios para la operación eficaz del sistema?",
      "¿La dirección comunica la importancia de la gestión de la calidad al personal?",
      "¿Participa la dirección en la revisión del SGC y en el establecimiento de objetivos?",
    ],
  },
  {
    clause: "5.1.2",
    title: "Enfoque al cliente",
    questions: [
      "¿Se determinan y cumplen los requisitos del cliente y los legales aplicables?",
      "¿Se realiza seguimiento y medición de la satisfacción del cliente?",
      "¿Se gestionan adecuadamente las reclamaciones o incidencias de clientes?",
      "¿Se mantienen canales de comunicación activos y adecuados con el cliente?",
      "¿Los riesgos relacionados con el cliente están identificados y tratados?",
      "¿Existe evidencia documental del seguimiento del feedback del cliente?",
    ],
  },
  {
    clause: "5.2",
    title: "Política de calidad",
    questions: [
      "¿La política de calidad está actualizada y es adecuada al contexto de la organización?",
      "¿Es coherente con la dirección estratégica e incluye el compromiso de mejora continua?",
      "¿Está disponible como información documentada y comunicada a todo el personal?",
      "¿Incluye referencia al cambio climático cuando sea relevante para la organización?",
      "¿Proporciona el marco para el establecimiento de los objetivos de calidad?",
      "¿El personal conoce la política y puede explicar su implicación en ella?",
    ],
  },
  {
    clause: "5.3",
    title: "Roles, responsabilidades y autoridades",
    questions: [
      "¿Están definidos, documentados y comunicados los roles, responsabilidades y autoridades?",
      "¿Existe un organigrama actualizado que refleje la estructura real de la organización?",
      "¿El personal conoce sus funciones y la forma en que contribuye al SGC?",
      "¿Está designado el responsable del sistema con autoridad y recursos suficientes?",
      "¿Las fichas de puesto o documentos de roles están actualizadas y son accesibles?",
      "¿Se han comunicado los cambios organizativos con impacto en el SGC?",
    ],
  },
];

const ANSWER_OPTIONS = [
  { value: "yes", label: "Sí", color: "s5-ans-yes" },
  { value: "partial", label: "Parcial", color: "s5-ans-partial" },
  { value: "no", label: "No", color: "s5-ans-no" },
  { value: "na", label: "N/A", color: "s5-ans-na" },
];

// ── Campos contextuales por cláusula (integrados en cada acordeón) ───────────

const CLAUSE_CONTEXT_FIELDS = {
  "5.1": [
    {
      field_code: "top_management_involvement_summary",
      label: "Implicación de la alta dirección",
      type: "textarea",
      placeholder: "Participación y compromiso observados durante la auditoría...",
    },
  ],
  "5.1.2": [
    {
      field_code: "s512_satisfaction_summary",
      label: "Satisfacción del cliente",
      type: "textarea",
      placeholder: "Resultados de encuestas, NPS, valoraciones globales...",
    },
    {
      field_code: "s512_complaints_summary",
      label: "Reclamaciones e incidencias",
      type: "textarea",
      placeholder: "Volumen, tipología, estado de resolución...",
    },
  ],
  "5.2": [
    {
      field_code: "quality_policy_revision",
      label: "Revisión nº",
      type: "text",
      placeholder: "p.ej. 3",
      inline: true,
    },
    {
      field_code: "quality_policy_date",
      label: "Fecha de la política",
      type: "date",
      inline: true,
    },
    {
      field_code: "quality_policy_change_summary",
      label: "Cambios respecto a versión anterior",
      type: "textarea",
      placeholder: "Principales modificaciones desde la última revisión...",
    },
  ],
  "5.3": [
    {
      field_code: "quality_system_responsible_name",
      label: "Responsable del SGC",
      type: "text",
      placeholder: "Nombre y cargo",
      inline: true,
    },
    {
      field_code: "roles_document_reference",
      label: "Ref. documento de roles",
      type: "text",
      placeholder: "p.ej. P05 v2",
      inline: true,
    },
    {
      field_code: "org_chart_reference",
      label: "Referencia organigrama",
      type: "text",
      placeholder: "p.ej. Organigrama 2024",
      inline: true,
    },
  ],
};

const EVIDENCE_OPTIONS = [
  { id: "rev_direccion", label: "Acta de revisión por la dirección" },
  { id: "politica_calidad", label: "Política de calidad vigente" },
  { id: "organigrama", label: "Organigrama actualizado" },
  { id: "p05_puestos", label: "P05 Descripción de puestos de trabajo" },
  { id: "encuestas_satisfaccion", label: "Encuestas de satisfacción del cliente" },
  { id: "reclamaciones", label: "Registro de reclamaciones de clientes" },
  { id: "indicadores_comerciales", label: "Indicadores comerciales / KPI de cliente" },
  { id: "actas_reunion", label: "Actas de reunión interna (dirección)" },
  { id: "objetivos_calidad", label: "Objetivos de calidad establecidos" },
  { id: "comunicaciones_internas", label: "Comunicaciones internas de dirección" },
  { id: "manual_calidad", label: "Manual de calidad" },
  { id: "plan_auditoria", label: "Plan de auditoría interna" },
  { id: "feedback_cliente", label: "Registros de feedback / seguimiento de contratos" },
  { id: "fichas_puesto", label: "Fichas de puesto / perfiles de competencia" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatIsoDate(dateStr) {
  if (!dateStr) return "";
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dateStr;
}

function resolveEvidenceLabel(id) {
  return EVIDENCE_OPTIONS.find((e) => e.id === id)?.label || id;
}

/**
 * Calcula el estado sugerido para una cláusula a partir de sus respuestas.
 * Regla: algún "no" → non_compliant; algún "partial" → partial; resto → compliant.
 * Sin respuestas → null (sin sugerencia).
 */
function computeSuggestedStatus(clauseAnswers) {
  if (!clauseAnswers || typeof clauseAnswers !== "object") return null;
  const answers = Object.entries(clauseAnswers)
    .filter(([key, val]) => !key.endsWith("_comment") && val)
    .map(([, val]) => val);
  if (answers.length === 0) return null;
  // Excluir "na" para determinar el estado real; si todo es N/A no hay sugerencia
  const realAnswers = answers.filter((a) => a !== "na");
  if (realAnswers.length === 0) return null;
  if (realAnswers.some((a) => a === "no")) return "non_compliant";
  if (realAnswers.some((a) => a === "partial")) return "partial";
  return "compliant";
}

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

// ── Generador de texto narrativo ──────────────────────────────────────────────

function buildQuestionNarrative(clauseCode, questions, clauseAnswers) {
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

function buildSection5DraftText(values, clauseChecks, guidedAnswers) {
  const parts = [];

  const involvement = (values.top_management_involvement_summary || "").trim();
  const evidenceLead = (values.leadership_evidence_summary || "").trim();
  const resourcesOk = values.management_resources_adequate;
  const integrated = values.sgc_integrated_in_business;

  const s512Satisfaction = (values.s512_satisfaction_summary || "").trim();
  const s512Complaints = (values.s512_complaints_summary || "").trim();
  const reqMet = values.s512_requirements_met;
  const feedbackTracked = values.s512_feedback_tracked;
  const commsNotes = (values.s512_communication_notes || "").trim();
  const customerRisks = (values.s512_customer_risks_summary || "").trim();
  const clientEvidenceNotes = (values.s512_evidence_notes || "").trim();

  const policyRev = (values.quality_policy_revision || "").trim();
  const policyDate = formatIsoDate(values.quality_policy_date || "");
  const policyUpdated = values.quality_policy_updated;
  const policyAvailable = values.quality_policy_available;
  const policyCoherent = values.quality_policy_coherent;
  const policyClimate = values.quality_policy_includes_climate_change;
  const policyChanges = (values.quality_policy_change_summary || "").trim();

  const responsible = (values.quality_system_responsible_name || "").trim();
  const rolesDefined = values.roles_defined;
  const rolesDoc = (values.roles_document_reference || "").trim();
  const orgChart = (values.org_chart_reference || "").trim();
  const orgChartUpdated = values.org_chart_updated;
  const staffAware = values.staff_aware_of_roles;
  const rolesChanges = (values.roles_changes_summary || "").trim();

  const selectedEvidence = Array.isArray(values.s5_objective_evidence)
    ? values.s5_objective_evidence
    : [];

  const ga = guidedAnswers && typeof guidedAnswers === "object" ? guidedAnswers : {};
  const ga51 = ga["5.1"] || {};
  const ga512 = ga["5.1.2"] || {};
  const ga52 = ga["5.2"] || {};
  const ga53 = ga["5.3"] || {};
  const hasGa51 = Object.keys(ga51).some((k) => !k.endsWith("_comment") && ga51[k]);
  const hasGa512 = Object.keys(ga512).some((k) => !k.endsWith("_comment") && ga512[k]);
  const hasGa52 = Object.keys(ga52).some((k) => !k.endsWith("_comment") && ga52[k]);
  const hasGa53 = Object.keys(ga53).some((k) => !k.endsWith("_comment") && ga53[k]);

  const noncompliantClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "non_compliant")
    .map((c) => c.clause_code);
  const partialClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "partial")
    .map((c) => c.clause_code);

  // ── 5.1 ──────────────────────────────────────────────────────────────────
  {
    let block = "5.1 Liderazgo y compromiso — Evidencias observadas:\n";

    if (hasGa51) {
      const lines51 = buildQuestionNarrative("5.1", AUDIT_QUESTIONS[0].questions, ga51);
      if (lines51.length > 0) block += lines51.join("\n");
      else block += "Se han revisado los requisitos de la cláusula 5.1.";
    } else if (involvement) {
      block += involvement.endsWith(".") ? involvement : `${involvement}.`;
      const extras = [];
      if (resourcesOk === true) extras.push("asignación adecuada de recursos para la operación del sistema");
      if (resourcesOk === false) extras.push("asignación de recursos no verificada o insuficiente");
      if (integrated === true) extras.push("SGC integrado en los procesos de negocio");
      if (integrated === false) extras.push("integración del SGC en procesos de negocio no evidenciada");
      if (extras.length > 0) block += ` Se constata: ${extras.join("; ")}.`;
    } else {
      block +=
        "No se ha registrado información sobre la implicación de la alta dirección en el periodo auditado. Se recomienda completar los campos correspondientes o responder las preguntas guiadas antes de generar el texto final.";
    }

    if (evidenceLead) {
      block += `\nEvidencias revisadas: ${evidenceLead.endsWith(".") ? evidenceLead : `${evidenceLead}.`}`;
    }
    parts.push(block);
  }

  // ── 5.1.2 ────────────────────────────────────────────────────────────────
  {
    let block = "5.1.2 Enfoque al cliente:\n";

    if (hasGa512) {
      const lines512 = buildQuestionNarrative("5.1.2", AUDIT_QUESTIONS[1].questions, ga512);
      if (lines512.length > 0) block += lines512.join("\n");
      else block += "Se han revisado los requisitos de la cláusula 5.1.2.";
    } else {
      const hasAnyClientData =
        reqMet != null || feedbackTracked != null || s512Satisfaction ||
        s512Complaints || commsNotes || customerRisks || clientEvidenceNotes;

      if (!hasAnyClientData) {
        block +=
          "No se ha evidenciado información suficiente sobre el enfoque al cliente en este periodo. Se recomienda completar los campos de la cláusula 5.1.2 o responder las preguntas guiadas.";
      } else {
        if (reqMet === true) block += "Se verifica el cumplimiento de los requisitos del cliente determinados.";
        else if (reqMet === false) block += "No se ha podido confirmar el cumplimiento completo de los requisitos del cliente en el periodo auditado.";
        else block += "El cumplimiento de requisitos del cliente no ha sido registrado explícitamente.";

        if (feedbackTracked === true) block += " Existe seguimiento activo de la satisfacción del cliente.";
        else if (feedbackTracked === false) block += " No se ha evidenciado seguimiento sistemático de la satisfacción del cliente.";

        if (s512Satisfaction) block += `\nSatisfacción: ${s512Satisfaction.endsWith(".") ? s512Satisfaction : `${s512Satisfaction}.`}`;
        if (s512Complaints) block += `\nReclamaciones e incidencias: ${s512Complaints.endsWith(".") ? s512Complaints : `${s512Complaints}.`}`;
        if (commsNotes) block += `\nComunicación con el cliente: ${commsNotes.endsWith(".") ? commsNotes : `${commsNotes}.`}`;
        if (customerRisks) block += `\nRiesgos identificados: ${customerRisks.endsWith(".") ? customerRisks : `${customerRisks}.`}`;
        if (clientEvidenceNotes) block += `\nEvidencias revisadas: ${clientEvidenceNotes.endsWith(".") ? clientEvidenceNotes : `${clientEvidenceNotes}.`}`;
      }
    }

    if (s512Satisfaction && hasGa512) block += `\nSatisfacción: ${s512Satisfaction.endsWith(".") ? s512Satisfaction : `${s512Satisfaction}.`}`;
    if (s512Complaints && hasGa512) block += `\nReclamaciones e incidencias: ${s512Complaints.endsWith(".") ? s512Complaints : `${s512Complaints}.`}`;
    parts.push(block);
  }

  // ── 5.2 ──────────────────────────────────────────────────────────────────
  {
    let block = "5.2 Política de calidad:\n";
    const policyRef = policyRev && policyDate
      ? `Rev. ${policyRev} de fecha ${policyDate}`
      : policyRev ? `Rev. ${policyRev}` : "";

    if (hasGa52) {
      if (policyRef) block += `Política de calidad (${policyRef}) revisada en el marco de la auditoría.\n`;
      const lines52 = buildQuestionNarrative("5.2", AUDIT_QUESTIONS[2].questions, ga52);
      if (lines52.length > 0) block += lines52.join("\n");
      else block += "Se han revisado los requisitos de la cláusula 5.2.";
    } else {
      if (policyUpdated === true) {
        block += `La política de calidad${policyRef ? ` (${policyRef})` : ""} se encuentra actualizada y vigente en el periodo auditado.`;
      } else if (policyUpdated === false) {
        block += `La política de calidad${policyRef ? ` (${policyRef})` : ""} presenta pendientes de actualización que deberán atenderse antes del cierre del expediente.`;
      } else if (policyRef) {
        block += `La política de calidad ${policyRef} ha sido revisada. El estado de actualización no ha sido registrado explícitamente.`;
      } else {
        block += "No se ha registrado información sobre el estado de la política de calidad en este periodo auditado.";
      }

      if (policyAvailable === true) block += " Está disponible como información documentada y ha sido comunicada al personal.";
      else if (policyAvailable === false) block += " No se ha evidenciado su disponibilidad o comunicación efectiva al conjunto del personal.";

      if (policyCoherent === true) block += " Es coherente con el contexto de la organización y su dirección estratégica.";
      else if (policyCoherent === false) block += " Se detecta falta de coherencia entre la política y el contexto o dirección estratégica actual.";

      if (policyClimate === true) block += " Incluye referencia explícita al cambio climático, en línea con la enmienda ISO 9001:2024.";
      else if (policyClimate === false) block += " No incluye referencias al cambio climático. Se recomienda evaluar su pertinencia conforme a ISO 9001:2024.";
    }

    if (policyChanges) block += `\nCambios respecto a versión anterior: ${policyChanges.endsWith(".") ? policyChanges : `${policyChanges}.`}`;
    parts.push(block);
  }

  // ── 5.3 ──────────────────────────────────────────────────────────────────
  {
    let block = "5.3 Roles, responsabilidades y autoridades:\n";

    if (hasGa53) {
      if (responsible) block += `La figura de Responsable del SGC recae en ${responsible}.\n`;
      const lines53 = buildQuestionNarrative("5.3", AUDIT_QUESTIONS[3].questions, ga53);
      if (lines53.length > 0) block += lines53.join("\n");
      else block += "Se han revisado los requisitos de la cláusula 5.3.";
    } else {
      if (responsible) block += `La figura de Responsable del SGC recae en ${responsible}.`;
      else block += "No se ha registrado el nombre del responsable del SGC.";

      if (rolesDefined === true) {
        block += ` Los roles y responsabilidades están definidos${rolesDoc ? ` y documentados en ${rolesDoc}` : ""}.`;
      } else if (rolesDefined === false) {
        block += " Se detecta ausencia o insuficiencia en la definición formal de roles y responsabilidades.";
      } else {
        block += " El estado de definición de roles no ha sido registrado explícitamente.";
      }

      if (orgChart) {
        const chartStatus = orgChartUpdated === true ? "actualizado" : orgChartUpdated === false ? "pendiente de actualización" : "disponible";
        block += ` Organigrama ${chartStatus}: ${orgChart}.`;
      } else if (orgChartUpdated === true) {
        block += " El organigrama está actualizado.";
      } else if (orgChartUpdated === false) {
        block += " El organigrama no está actualizado o no se ha podido verificar su vigencia.";
      }

      if (staffAware === true) block += " El personal entrevistado demuestra conocimiento de sus funciones y autoridades dentro del SGC.";
      else if (staffAware === false) block += " Se detecta conocimiento insuficiente de funciones y autoridades por parte del personal.";
    }

    if (rolesChanges) block += `\nCambios organizativos recientes: ${rolesChanges.endsWith(".") ? rolesChanges : `${rolesChanges}.`}`;
    parts.push(block);
  }

  // ── Evidencias documentales ───────────────────────────────────────────────
  if (selectedEvidence.length > 0) {
    const labels = selectedEvidence.map(resolveEvidenceLabel).join(", ");
    parts.push(`Documentación revisada durante la auditoría: ${labels}.`);
  }

  // ── Resultado de verificación de cláusulas ───────────────────────────────
  if (noncompliantClauses.length > 0) {
    parts.push(
      `Desviaciones / no conformidades detectadas: Se han identificado incumplimientos en las cláusulas ${noncompliantClauses.join(", ")}. Se requieren acciones correctivas antes del cierre del expediente.`
    );
  } else if (partialClauses.length > 0) {
    parts.push(
      `Observaciones: Las cláusulas ${partialClauses.join(", ")} presentan cumplimiento parcial. Se recomienda reforzar las evidencias y el seguimiento en los puntos señalados.`
    );
  } else {
    parts.push(
      "Conclusión de cumplimiento: La sección 5 presenta un nivel de cumplimiento conforme con los requisitos de la norma ISO 9001, con las evidencias disponibles y las cláusulas verificadas."
    );
  }

  return parts.join("\n\n");
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Section5LeadershipPanel({
  valuesByFieldCode,
  clauseChecks,
  currentFinalText,
  onFieldChange,
  onApplyDraftText,
  onApplySuggestedClauseCheck,
  disabled,
}) {
  const [openClause, setOpenClause] = useState(null);
  const [openCommentFor, setOpenCommentFor] = useState(null); // "5.1:q2" format
  const [confirmState, setConfirmState] = useState(null); // null | "confirming"
  const [applyConfirm, setApplyConfirm] = useState(null); // null | { clauseCode, suggestedStatus, currentStatus }

  // Lee/escribe las respuestas guiadas del campo JSON s5_guided_answers
  const guidedAnswers = useMemo(() => {
    const raw = valuesByFieldCode?.s5_guided_answers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }, [valuesByFieldCode]);

  const selectedEvidence = Array.isArray(valuesByFieldCode?.s5_objective_evidence)
    ? valuesByFieldCode.s5_objective_evidence
    : [];

  const hasExistingText = (currentFinalText || "").trim().length > 0;

  // ── Respuestas ──────────────────────────────────────────────────────────

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
      [clauseCode]: {
        ...(guidedAnswers[clauseCode] || {}),
        [`q${qIndex}`]: value,
      },
    };
    onFieldChange("s5_guided_answers", next);
  }

  function setComment(clauseCode, qIndex, text) {
    if (disabled) return;
    const next = {
      ...guidedAnswers,
      [clauseCode]: {
        ...(guidedAnswers[clauseCode] || {}),
        [`q${qIndex}_comment`]: text,
      },
    };
    onFieldChange("s5_guided_answers", next);
  }

  // ── Suggested status ────────────────────────────────────────────────────

  const suggestedStatusByClause = useMemo(() => {
    const result = {};
    AUDIT_QUESTIONS.forEach(({ clause }) => {
      result[clause] = computeSuggestedStatus(guidedAnswers[clause]);
    });
    return result;
  }, [guidedAnswers]);

  function getCurrentClauseStatus(clauseCode) {
    return (clauseChecks || []).find((c) => c.clause_code === clauseCode)?.clause_status || null;
  }

  function handleApplyToC(clauseCode, suggestedStatus) {
    const currentStatus = getCurrentClauseStatus(clauseCode);
    const isDefaultOrEmpty =
      !currentStatus || currentStatus === "compliant" || currentStatus === "in_progress";
    const alreadyMatches = currentStatus === suggestedStatus;

    if (alreadyMatches) return;

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

  // ── Evidence chips ──────────────────────────────────────────────────────

  function toggleEvidence(id) {
    if (disabled) return;
    const next = selectedEvidence.includes(id)
      ? selectedEvidence.filter((e) => e !== id)
      : [...selectedEvidence, id];
    onFieldChange("s5_objective_evidence", next);
  }

  // ── Text generator ──────────────────────────────────────────────────────

  function handleGenerateClick() {
    if (hasExistingText) {
      setConfirmState("confirming");
    } else {
      applyGenerated("replace");
    }
  }

  function applyGenerated(mode) {
    const generated = buildSection5DraftText(
      valuesByFieldCode || {},
      clauseChecks || [],
      guidedAnswers
    );
    if (mode === "append") {
      const base = (currentFinalText || "").trimEnd();
      onApplyDraftText(`${base}\n\n${generated}`);
    } else {
      onApplyDraftText(generated);
    }
    setConfirmState(null);
  }

  // ── Summary bar (top) ───────────────────────────────────────────────────

  const answeredCount = useMemo(() => {
    let count = 0;
    AUDIT_QUESTIONS.forEach(({ clause, questions }) => {
      questions.forEach((_, idx) => {
        if (getAnswer(clause, idx)) count++;
      });
    });
    return count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedAnswers]);

  const totalQuestions = AUDIT_QUESTIONS.reduce((acc, { questions }) => acc + questions.length, 0);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="s5-panel">

      {/* ── Resumen global ── */}
      <div className="s5-summary-bar">
        <span className="s5-summary-label">
          Preguntas respondidas: <strong>{answeredCount}/{totalQuestions}</strong>
        </span>
        <div className="s5-summary-clauses">
          {AUDIT_QUESTIONS.map(({ clause }) => {
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

      {/* ── Preguntas guiadas interactivas ── */}
      <section className="s5-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Preguntas guiadas del auditor</h4>
          <p className="s5-block-desc">
            Responde cada pregunta. El estado sugerido se calcula automáticamente y puedes
            aplicarlo al bloque C con un clic.
          </p>
        </div>

        <div className="s5-clauses">
          {AUDIT_QUESTIONS.map((item) => {
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

                    {/* Campos contextuales de esta cláusula */}
                    {CLAUSE_CONTEXT_FIELDS[item.clause] && (() => {
                      const ctxFields = CLAUSE_CONTEXT_FIELDS[item.clause];
                      const inlineFields = ctxFields.filter((f) => f.inline);
                      const fullFields = ctxFields.filter((f) => !f.inline);
                      return (
                        <div className="s5-context-zone">
                          {inlineFields.length > 0 && (
                            <div className="s5-context-row">
                              {inlineFields.map((f) => (
                                <div key={f.field_code} className="s5-context-field">
                                  <span className="s5-context-label">{f.label}</span>
                                  <input
                                    type={f.type === "date" ? "date" : "text"}
                                    className="s5-context-input"
                                    value={valuesByFieldCode?.[f.field_code] || ""}
                                    placeholder={f.placeholder}
                                    disabled={disabled}
                                    onChange={(e) => onFieldChange(f.field_code, e.target.value)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {fullFields.map((f) => (
                            <div key={f.field_code} className="s5-context-wide">
                              <span className="s5-context-label">{f.label}</span>
                              <textarea
                                className="s5-context-textarea"
                                value={valuesByFieldCode?.[f.field_code] || ""}
                                placeholder={f.placeholder}
                                rows={2}
                                disabled={disabled}
                                onChange={(e) => onFieldChange(f.field_code, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <ul className="s5-question-list">
                      {item.questions.map((q, idx) => {
                        const answer = getAnswer(item.clause, idx);
                        const comment = getComment(item.clause, idx);
                        const commentKey = `${item.clause}:q${idx}`;
                        const commentOpen = openCommentFor === commentKey;

                        return (
                          <li key={idx} className={`s5-question-item${answer ? ` s5-q-answered-${answer}` : ""}`}>
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

                    {/* Suggested status + apply */}
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

      {/* ── Evidencias objetivas ── */}
      <section className="s5-block">
        <div className="s5-block-intro">
          <h4 className="s5-block-title">Evidencias objetivas revisadas</h4>
          <p className="s5-block-desc">
            Marca los documentos revisados durante la auditoría. Se incorporan al texto narrativo al
            generar el borrador.
          </p>
        </div>

        <div className="s5-evidence-grid">
          {EVIDENCE_OPTIONS.map((opt) => {
            const checked = selectedEvidence.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={`s5-evidence-chip${checked ? " s5-evidence-chip-selected" : ""}`}
                onClick={() => toggleEvidence(opt.id)}
                disabled={disabled}
                aria-pressed={checked}
              >
                <span className="s5-chip-check" aria-hidden="true">
                  {checked ? "✓" : "+"}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>

        {selectedEvidence.length > 0 && (
          <p className="s5-evidence-count soft-label">
            {selectedEvidence.length}{" "}
            {selectedEvidence.length === 1 ? "evidencia seleccionada" : "evidencias seleccionadas"}
          </p>
        )}
      </section>

      {/* ── Generador de texto ── */}
      <section className="s5-block s5-draft-block">
        <div className="s5-draft-row">
          <div className="s5-block-intro">
            <h4 className="s5-block-title">Generar texto narrativo del informe</h4>
            <p className="s5-block-desc">
              Crea un borrador profesional usando los campos contextuales, respuestas guiadas,
              evidencias seleccionadas y estado de cláusulas. Edítalo libremente en el bloque D.
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
              El bloque D ya contiene texto. ¿Qué deseas hacer con el texto actual?
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
