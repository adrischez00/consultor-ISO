import { useState, useMemo } from "react";
import EditableAuditMatrix from "./EditableAuditMatrix";

// ── Preguntas por cláusula ────────────────────────────────────────────────────

const AUDIT_QUESTIONS_S7 = [
  {
    clause: "7.1",
    title: "Recursos e infraestructura",
    relatedClauses: ["7.1", "7.1.2", "7.1.3", "7.1.4", "7.1.5"],
    questions: [
      "¿La organización dispone de recursos humanos suficientes para operar el SGC?",
      "¿La infraestructura y equipos se encuentran mantenidos y operativos?",
      "¿El ambiente de trabajo es adecuado para la operación de los procesos?",
      "¿Los equipos de seguimiento y medición están identificados y controlados?",
      "¿Existe evidencia de mantenimiento y control periódico de los medios de producción?",
    ],
  },
  {
    clause: "7.2",
    title: "Competencia y formación",
    relatedClauses: ["7.2"],
    questions: [
      "¿Las competencias necesarias para cada puesto están definidas y documentadas?",
      "¿Existe evidencia objetiva de formación y capacitación del personal?",
      "¿La organización evalúa la eficacia de las acciones formativas?",
      "¿Las competencias actuales son suficientes para operar los procesos auditados?",
    ],
  },
  {
    clause: "7.3",
    title: "Toma de conciencia",
    relatedClauses: ["7.3"],
    questions: [
      "¿El personal conoce y puede describir la política de calidad?",
      "¿El personal conoce los objetivos de calidad aplicables a su actividad?",
      "¿El personal conoce su contribución a la eficacia del SGC?",
      "¿El personal conoce las consecuencias de no cumplir los requisitos del sistema?",
    ],
  },
  {
    clause: "7.4",
    title: "Comunicación",
    relatedClauses: ["7.4"],
    questions: [
      "¿La organización tiene definido qué comunica, cuándo y a quién?",
      "¿Existen canales de comunicación interna eficaces y verificables?",
      "¿La comunicación externa relevante para el SGC está identificada y controlada?",
      "¿Quedan evidencias documentales de las comunicaciones relevantes?",
    ],
  },
  {
    clause: "7.5",
    title: "Información documentada",
    relatedClauses: ["7.5"],
    questions: [
      "¿La documentación del SGC está identificada, versionada y controlada?",
      "¿Los documentos vigentes son accesibles en los puntos de uso?",
      "¿Existe un sistema de control de revisiones y aprobación de cambios?",
      "¿Los registros se conservan de forma segura y recuperable?",
      "¿Se evita activamente el uso de documentación obsoleta en los puntos de uso?",
      "¿Los registros conservados son legibles, identificables y recuperables?",
    ],
  },
];

const ANSWER_OPTIONS = [
  { value: "yes",     label: "Sí",      color: "s5-ans-yes"    },
  { value: "partial", label: "Parcial", color: "s5-ans-partial" },
  { value: "no",      label: "No",      color: "s5-ans-no"     },
  { value: "na",      label: "N/A",     color: "s5-ans-na"     },
];

// ── Chips de medios de sensibilización (7.3) ──────────────────────────────────

const AWARENESS_METHODS = [
  { value: "reunion_interna",    label: "Reunión interna"              },
  { value: "formacion_inicial",  label: "Formación inicial / onboarding" },
  { value: "carteleria",         label: "Cartelería"                   },
  { value: "intranet",           label: "Intranet / carpeta compartida" },
  { value: "email",              label: "Comunicación por email"       },
  { value: "charla_prl",         label: "Charla de seguridad / PRL"   },
  { value: "politica_comunicada",label: "Política comunicada al equipo"},
  { value: "boletin_interno",    label: "Boletín / circular interna"   },
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

const TRAINING_STATUS_OPTIONS = [
  { value: "valid",        label: "Válido"       },
  { value: "pending",      label: "Pendiente"    },
  { value: "expired",      label: "Caducado"     },
  { value: "insufficient", label: "Insuficiente" },
];

const TRAINING_STATUS_CONFIG = {
  valid:        { label: "Válido",       colorClass: "mat-badge-achieved"     },
  pending:      { label: "Pendiente",    colorClass: "mat-badge-progress"     },
  expired:      { label: "Caducado",     colorClass: "mat-badge-not-achieved" },
  insufficient: { label: "Insuficiente", colorClass: "mat-badge-not-achieved" },
};

const TRAINING_SCHEMA = {
  primaryField: "person",
  statusField:  "status",
  statusConfig: TRAINING_STATUS_CONFIG,
  compactCols: [
    { key: "role",          label: "Puesto" },
    { key: "training_date", label: "Fecha", type: "date" },
  ],
  defaultRow: () => ({
    person: "", role: "", required_competence: "", training: "",
    evidence: "", training_date: "", status: "valid", observations: "",
  }),
  expandFields: [
    { key: "person",              label: "Persona",               type: "text",     placeholder: "Nombre del trabajador..."                    },
    { key: "role",                label: "Puesto / rol",          type: "text",     placeholder: "Responsable de calidad, operario..."         },
    { key: "required_competence", label: "Competencia requerida", type: "textarea", wide: true, placeholder: "Formación o cualificación necesaria para el puesto..." },
    { key: "training",            label: "Formación recibida",    type: "textarea", wide: true, placeholder: "Cursos, titulaciones, certificaciones..."              },
    { key: "training_date",       label: "Fecha de formación",    type: "date"      },
    { key: "status",              label: "Estado",                type: "select",   options: TRAINING_STATUS_OPTIONS                          },
    { key: "evidence",            label: "Evidencia documental",  type: "text",     wide: true, placeholder: "Certificado, diploma, registro de asistencia..."      },
    { key: "observations",        label: "Observaciones",         type: "textarea", wide: true, placeholder: "Acciones planificadas, próxima renovación..."          },
  ],
};

const COMM_STATUS_OPTIONS = [
  { value: "documented",     label: "Documentado"              },
  { value: "partial",        label: "Parcialmente documentado" },
  { value: "not_documented", label: "Sin evidencia"            },
];

const COMM_STATUS_CONFIG = {
  documented:     { label: "Documentado",   colorClass: "mat-badge-achieved"     },
  partial:        { label: "Parcial",       colorClass: "mat-badge-partial"      },
  not_documented: { label: "Sin evidencia", colorClass: "mat-badge-cancelled"    },
};

const COMMUNICATION_SCHEMA = {
  primaryField: "topic",
  statusField:  "status",
  statusConfig: COMM_STATUS_CONFIG,
  compactCols: [
    { key: "target",    label: "Destinatario" },
    { key: "channel",   label: "Canal"        },
    { key: "frequency", label: "Frecuencia"   },
  ],
  defaultRow: () => ({
    topic: "", target: "", channel: "", frequency: "",
    responsible: "", evidence: "", status: "documented",
  }),
  expandFields: [
    { key: "topic",       label: "Tema / objeto de la comunicación", type: "text", wide: true, placeholder: "¿Qué se comunica?..."                        },
    { key: "target",      label: "Destinatario",                     type: "text", placeholder: "Personal, clientes, proveedores..."                    },
    { key: "channel",     label: "Canal",                            type: "text", placeholder: "Reunión, correo, intranet, tablón..."                  },
    { key: "frequency",   label: "Frecuencia",                       type: "text", placeholder: "Semanal, mensual, puntual..."                         },
    { key: "responsible", label: "Responsable",                      type: "text", placeholder: "Persona o área responsable..."                         },
    { key: "status",      label: "Estado documental",                type: "select", options: COMM_STATUS_OPTIONS                                      },
    { key: "evidence",    label: "Evidencia",                        type: "text", wide: true, placeholder: "Acta, correo, registro de comunicación..." },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIsoDate(dateStr) {
  if (!dateStr) return "";
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dateStr;
}

// Skips _* keys (metadata like _methods) and comment keys
function computeSuggestedStatus(clauseAnswers) {
  if (!clauseAnswers || typeof clauseAnswers !== "object") return null;
  const answers = Object.entries(clauseAnswers)
    .filter(([key, val]) => !key.endsWith("_comment") && !key.startsWith("_") && val)
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

function computeSuggestedStatus72(clauseAnswers, trainingMatrix) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  let matrixStatus = null;
  const rows = Array.isArray(trainingMatrix) ? trainingMatrix : [];
  if (rows.length > 0) {
    if (rows.some((r) => r.status === "insufficient")) {
      matrixStatus = "non_compliant";
    } else if (rows.some((r) => ["pending", "expired"].includes(r.status))) {
      matrixStatus = "partial";
    } else if (rows.every((r) => r.status === "valid")) {
      matrixStatus = "compliant";
    }
  }
  return worstStatus(questionStatus, matrixStatus);
}

function computeSuggestedStatus74(clauseAnswers, commMatrix) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  let matrixStatus = null;
  const rows = Array.isArray(commMatrix) ? commMatrix : [];
  if (rows.length > 0) {
    if (rows.some((r) => r.status === "not_documented")) {
      matrixStatus = "partial";
    } else if (rows.every((r) => r.status === "documented")) {
      matrixStatus = "compliant";
    } else {
      matrixStatus = "partial";
    }
  }
  return worstStatus(questionStatus, matrixStatus);
}

function computeSuggestedStatus75(clauseAnswers, documentsAccessible) {
  const questionStatus = computeSuggestedStatus(clauseAnswers);
  if (documentsAccessible === false) {
    return worstStatus(questionStatus, "non_compliant");
  }
  return questionStatus;
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

function pluralizar(n, singular, plural) {
  return n === 1 ? singular : plural;
}

function buildSection7DraftText(values, clauseChecks, guidedAnswers, trainingMatrix, commMatrix) {
  const parts = [];
  const ga = guidedAnswers && typeof guidedAnswers === "object" ? guidedAnswers : {};

  // ── 7.1 ──────────────────────────────────────────────────────────────────
  {
    let block = "7.1 Recursos e infraestructura\n";
    const ga71 = ga["7.1"] || {};
    const hasGa71 = Object.keys(ga71).some((k) => !k.endsWith("_comment") && !k.startsWith("_") && ga71[k]);

    const empleados = Number(values.employee_count) || 0;
    const socios = Number(values.partner_count) || 0;
    const mantenimiento = (values.maintenance_reference_document || "").trim();
    const prl = (values.prl_provider_name || "").trim();
    const herramienta = (values.time_tracking_tool_name || "").trim();

    // Párrafo introductorio con datos de contexto
    if (empleados || socios) {
      const ctxParts = [];
      if (empleados) ctxParts.push(`${empleados} ${pluralizar(empleados, "empleado", "empleados")}`);
      if (socios) ctxParts.push(`${socios} ${pluralizar(socios, "socio", "socios")}`);
      block += `La organización dispone de una plantilla de ${ctxParts.join(" y ")}.`;
      if (mantenimiento) block += ` La infraestructura y equipos se gestionan mediante ${mantenimiento}.`;
      if (prl) block += ` La prevención de riesgos laborales se encuentra contratada con ${prl}.`;
      if (herramienta) block += ` Los medios de seguimiento y medición se controlan a través de ${herramienta}.`;
      block += "\n";
    }

    if (hasGa71) {
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S7[0].questions, ga71);
      if (lines.length > 0) {
        const hasIssues = lines.some((l) => l.startsWith("✗") || l.startsWith("~"));
        if (!hasIssues) {
          block += "Se ha verificado que la organización dispone de recursos suficientes, infraestructura operativa y medios de seguimiento adecuados para el funcionamiento del sistema de gestión.\n";
        }
        block += lines.join("\n");
      } else {
        block += "Se han revisado los recursos, infraestructura y medios de seguimiento disponibles para la operación del SGC.";
      }
    } else if (!empleados && !mantenimiento) {
      block += "Se ha verificado la disponibilidad de recursos humanos, infraestructura y medios de seguimiento necesarios para la operación del sistema de gestión de la calidad.";
    }
    parts.push(block.trim());
  }

  // ── 7.2 ──────────────────────────────────────────────────────────────────
  {
    let block = "7.2 Competencia y formación\n";
    const ga72 = ga["7.2"] || {};
    const hasGa72 = Object.keys(ga72).some((k) => !k.endsWith("_comment") && !k.startsWith("_") && ga72[k]);
    const matrix = Array.isArray(trainingMatrix) ? trainingMatrix : [];
    const jobProfiles = (values.job_profiles_reference || "").trim();

    if (matrix.length > 0) {
      const total = matrix.length;
      const valid = matrix.filter((r) => r.status === "valid");
      const pending = matrix.filter((r) => r.status === "pending");
      const expired = matrix.filter((r) => r.status === "expired");
      const insufficient = matrix.filter((r) => r.status === "insufficient");

      if (jobProfiles) block += `Las competencias requeridas se encuentran documentadas en ${jobProfiles}. `;

      block += `Se han revisado las competencias y evidencias formativas de ${total} ${pluralizar(total, "perfil", "perfiles")} de personal implicado${total !== 1 ? "s" : ""} en los procesos auditados.`;

      if (valid.length === total) {
        block += " La totalidad de la formación revisada se encuentra al día y resulta adecuada para las funciones requeridas.";
      } else if (valid.length > 0) {
        block += ` ${valid.length} ${pluralizar(valid.length, "perfil cuenta", "perfiles cuentan")} con formación vigente y suficiente.`;
      }

      if (insufficient.length > 0) {
        block += `\n\nSe han identificado ${insufficient.length} ${pluralizar(insufficient.length, "caso", "casos")} de competencia insuficiente para las funciones requeridas:`;
        insufficient.forEach((r) => {
          block += `\n— ${r.person || "Perfil sin identificar"}${r.role ? ` (${r.role})` : ""}`;
          if (r.required_competence) block += `: competencia requerida — ${r.required_competence}`;
          if (r.observations) {
            const obs = r.observations.trim();
            block += `. ${obs.endsWith(".") ? obs : `${obs}.`}`;
          }
        });
        block += "\nSe recomienda establecer un plan de formación para cubrir estas carencias antes del próximo ciclo de auditoría.";
      }

      if (expired.length > 0) {
        block += `\n\n${expired.length} ${pluralizar(expired.length, "acción formativa ha", "acciones formativas han")} caducado y ${pluralizar(expired.length, "requiere", "requieren")} renovación:`;
        expired.forEach((r) => {
          block += `\n— ${r.person || "Perfil sin identificar"}${r.role ? ` (${r.role})` : ""}`;
          if (r.training) block += `: ${r.training}`;
          if (r.training_date) block += ` (fecha de caducidad estimada desde ${formatIsoDate(r.training_date)})`;
        });
      }

      if (pending.length > 0) {
        block += `\n\n${pending.length} ${pluralizar(pending.length, "acción formativa pendiente", "acciones formativas pendientes")} de completar:`;
        pending.forEach((r) => {
          block += `\n— ${r.person || "Perfil sin identificar"}${r.role ? ` (${r.role})` : ""}`;
          if (r.required_competence) block += `: ${r.required_competence}`;
        });
      }

      if (hasGa72) {
        const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S7[1].questions, ga72);
        if (lines.length > 0) block += "\n\nVerificación complementaria:\n" + lines.join("\n");
      }
    } else if (hasGa72) {
      if (jobProfiles) block += `Competencias documentadas en ${jobProfiles}.\n`;
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S7[1].questions, ga72);
      block += lines.length > 0 ? lines.join("\n") : "Se han revisado los requisitos de la cláusula 7.2.";
    } else {
      // Fallback legacy
      const t24 = (values.training_2024_summary || "").trim();
      const t25 = (values.training_2025_planned_summary || "").trim();
      if (jobProfiles) block += `Competencias documentadas en ${jobProfiles}.\n`;
      if (t24) block += `Formación realizada: ${t24}\n`;
      if (t25) block += `Formación planificada: ${t25}\n`;
      if (!t24 && !t25 && !jobProfiles) {
        block += "Se han revisado las competencias y evidencias formativas del personal implicado en los procesos auditados, observándose el mantenimiento de los perfiles y cualificaciones necesarios para la operación del sistema.";
      }
    }
    parts.push(block.trim());
  }

  // ── 7.3 ──────────────────────────────────────────────────────────────────
  {
    let block = "7.3 Toma de conciencia\n";
    const ga73 = ga["7.3"] || {};
    const hasGa73 = Object.keys(ga73).some((k) => !k.endsWith("_comment") && !k.startsWith("_") && ga73[k]);
    const notes = (values.awareness_actions_notes || values.awareness_actions_summary || "").trim();
    const selectedMethods = Array.isArray(ga73._methods) ? ga73._methods : [];
    const methodLabels = selectedMethods
      .map((v) => AWARENESS_METHODS.find((m) => m.value === v)?.label)
      .filter(Boolean);

    if (hasGa73) {
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S7[2].questions, ga73);
      if (lines.length > 0) {
        const hasIssues = lines.some((l) => l.startsWith("✗") || l.startsWith("~"));
        if (!hasIssues) {
          block += "Se ha verificado que el personal implicado en los procesos auditados tiene conciencia de la política de calidad, los objetivos del sistema, su contribución individual y las consecuencias de no cumplir los requisitos.";
          if (methodLabels.length > 0) {
            block += ` Los medios de sensibilización empleados incluyen: ${methodLabels.join(", ")}.`;
          }
          block += "\n";
        }
        block += lines.join("\n");
      } else {
        block += "Se han revisado los requisitos de la cláusula 7.3.";
      }
      if (notes) block += `\n\nAcciones de concienciación documentadas: ${notes.endsWith(".") ? notes : `${notes}.`}`;
    } else if (methodLabels.length > 0 || notes) {
      block += "Se ha verificado la toma de conciencia del personal mediante los siguientes medios de sensibilización:";
      if (methodLabels.length > 0) block += `\n— ${methodLabels.join("\n— ")}`;
      if (notes) block += `\n\n${notes.endsWith(".") ? notes : `${notes}.`}`;
    } else {
      block += "Se ha verificado la toma de conciencia del personal en relación a la política de calidad, los objetivos y la contribución individual al sistema de gestión de la calidad.";
    }
    parts.push(block.trim());
  }

  // ── 7.4 ──────────────────────────────────────────────────────────────────
  {
    let block = "7.4 Comunicación\n";
    const ga74 = ga["7.4"] || {};
    const hasGa74 = Object.keys(ga74).some((k) => !k.endsWith("_comment") && !k.startsWith("_") && ga74[k]);
    const matrix = Array.isArray(commMatrix) ? commMatrix : [];

    if (matrix.length > 0) {
      const total = matrix.length;
      const documented = matrix.filter((r) => r.status === "documented");
      const partial = matrix.filter((r) => r.status === "partial");
      const notDoc = matrix.filter((r) => r.status === "not_documented");

      block += `La organización tiene identificados ${total} ${pluralizar(total, "canal", "canales")} de comunicación${total !== 1 ? ", de los cuales" : ""}`;
      if (documented.length === total) {
        block += " todos cuentan con evidencia documental verificada.";
      } else {
        if (documented.length > 0) block += ` ${documented.length} ${pluralizar(documented.length, "está documentado", "están documentados")}`;
        if (partial.length > 0) block += `${documented.length > 0 ? "," : ""} ${partial.length} con documentación parcial`;
        if (notDoc.length > 0) block += `${documented.length > 0 || partial.length > 0 ? " y" : ""} ${notDoc.length} sin evidencia verificable`;
        block += ".";
      }

      const withTopic = matrix.filter((r) => r.topic);
      if (withTopic.length > 0) {
        block += "\n\nCanales de comunicación registrados:";
        withTopic.forEach((r) => {
          block += `\n— ${r.topic}`;
          if (r.target) block += ` → ${r.target}`;
          if (r.channel) block += ` (${r.channel})`;
          if (r.frequency) block += `, ${r.frequency}`;
          if (r.responsible) block += `. Resp.: ${r.responsible}`;
          if (r.evidence) block += `. Evidencia: ${r.evidence}`;
        });
      }

      if (notDoc.length > 0) {
        block += `\n\nSe recomienda establecer registros verificables para ${notDoc.length > 1 ? "los " + notDoc.length + " canales sin evidencia detectados" : "el canal sin evidencia detectado"}, con el fin de garantizar la trazabilidad de las comunicaciones relevantes del SGC.`;
      }

      if (hasGa74) {
        const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S7[3].questions, ga74);
        if (lines.length > 0) block += "\n\nVerificación adicional:\n" + lines.join("\n");
      }
    } else if (hasGa74) {
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S7[3].questions, ga74);
      block += lines.length > 0 ? lines.join("\n") : "Se han revisado los requisitos de la cláusula 7.4.";
    } else {
      // Fallback legacy
      const extComm = (values.external_communication_channels || "").trim();
      const intComm = (values.internal_communication_channels || "").trim();
      const lastMeeting = values.last_meeting_date || "";
      if (intComm) block += `Canales de comunicación interna: ${intComm}.\n`;
      if (extComm) block += `Comunicación externa controlada mediante: ${extComm}.\n`;
      if (lastMeeting) block += `Última reunión registrada: ${formatIsoDate(lastMeeting)}.\n`;
      if (!extComm && !intComm) {
        block += "La organización dispone de canales de comunicación interna y externa definidos para el funcionamiento del sistema de gestión de la calidad.";
      }
    }
    parts.push(block.trim());
  }

  // ── 7.5 ──────────────────────────────────────────────────────────────────
  {
    let block = "7.5 Información documentada\n";
    const ga75 = ga["7.5"] || {};
    const hasGa75 = Object.keys(ga75).some((k) => !k.endsWith("_comment") && !k.startsWith("_") && ga75[k]);
    const docRef = (values.document_control_reference || "").trim();
    const docRev = (values.document_control_revision || "").trim();
    const docDate = values.document_control_date || "";
    const accessible = values.documents_accessible;

    if (docRef || docRev || docDate) {
      block += "La información documentada del sistema de gestión se encuentra controlada";
      if (docRef) block += ` mediante ${docRef}`;
      if (docRev && docDate) block += ` (${docRev}, ${formatIsoDate(docDate)})`;
      else if (docRev) block += ` (revisión ${docRev})`;
      else if (docDate) block += ` (revisada en ${formatIsoDate(docDate)})`;
      block += ".\n";
    }

    if (accessible === false) {
      block += "DESVIACIÓN DETECTADA: Los documentos del SGC no están accesibles en todos los puntos de uso. Este incumplimiento requiere acción correctiva antes del cierre del informe de auditoría.\n";
    } else if (accessible === true && (docRef || docRev)) {
      block += "Se ha verificado que los documentos son accesibles en los puntos de uso y que el sistema de control documental está operativo.\n";
    }

    if (hasGa75) {
      const lines = buildQuestionNarrative(AUDIT_QUESTIONS_S7[4].questions, ga75);
      if (lines.length > 0) {
        const hasIssues = lines.some((l) => l.startsWith("✗") || l.startsWith("~"));
        if (!hasIssues && !docRef) {
          block += "Se ha verificado que la información documentada se encuentra identificada, controlada, accesible y protegida frente al uso de versiones obsoletas.\n";
        }
        block += lines.join("\n");
      } else {
        block += "Se han revisado los requisitos de la cláusula 7.5.";
      }
    } else if (!docRef && accessible === undefined) {
      block += "Se ha verificado que la información documentada se encuentra identificada, accesible y controlada en sus revisiones vigentes, evitando el uso de versiones obsoletas.";
    }
    parts.push(block.trim());
  }

  // ── Conclusión a partir de cláusulas C ────────────────────────────────────
  const noncompliantClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "non_compliant")
    .map((c) => c.clause_code);
  const partialClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "partial")
    .map((c) => c.clause_code);

  if (noncompliantClauses.length > 0) {
    parts.push(
      `Desviaciones significativas detectadas en sección 7: Se han identificado incumplimientos en las cláusulas ${noncompliantClauses.join(", ")}. Estas desviaciones requieren apertura de no conformidad y definición de acciones correctivas antes del cierre del expediente de auditoría.`
    );
  } else if (partialClauses.length > 0) {
    parts.push(
      `Observaciones de mejora en sección 7: Las cláusulas ${partialClauses.join(", ")} presentan cumplimiento parcial. Se recomienda reforzar las evidencias documentales y establecer un seguimiento de los puntos de mejora identificados antes de la próxima auditoría.`
    );
  } else {
    parts.push(
      "Conclusión: La sección 7 del sistema de gestión de la calidad presenta un nivel de cumplimiento conforme con los requisitos de la norma ISO 9001, habiendo verificado la adecuación de los recursos, la suficiencia de las competencias del personal, la eficacia de los canales de comunicación y el control de la información documentada."
    );
  }

  return parts.join("\n\n");
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Section7SupportPanel({
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

  // ── Data ─────────────────────────────────────────────────────────────────

  const guidedAnswers = useMemo(() => {
    const raw = valuesByFieldCode?.s7_guided_answers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }, [valuesByFieldCode]);

  const trainingMatrix = useMemo(() => {
    const raw = valuesByFieldCode?.competence_training_matrix;
    return Array.isArray(raw) ? raw : [];
  }, [valuesByFieldCode]);

  const commMatrix = useMemo(() => {
    const raw = valuesByFieldCode?.communication_matrix;
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
    onFieldChange("s7_guided_answers", next);
  }

  function setComment(clauseCode, qIndex, text) {
    if (disabled) return;
    const next = {
      ...guidedAnswers,
      [clauseCode]: { ...(guidedAnswers[clauseCode] || {}), [`q${qIndex}_comment`]: text },
    };
    onFieldChange("s7_guided_answers", next);
  }

  // ── Awareness chips (7.3) ─────────────────────────────────────────────────

  function getSelectedMethods() {
    return Array.isArray((guidedAnswers["7.3"] || {})._methods)
      ? guidedAnswers["7.3"]._methods
      : [];
  }

  function toggleMethod(value) {
    if (disabled) return;
    const current = getSelectedMethods();
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFieldChange("s7_guided_answers", {
      ...guidedAnswers,
      "7.3": { ...(guidedAnswers["7.3"] || {}), _methods: next },
    });
  }

  // ── Suggested status ─────────────────────────────────────────────────────

  const suggestedStatusByClause = useMemo(() => {
    const map = {};
    AUDIT_QUESTIONS_S7.forEach((item) => {
      let status;
      if (item.clause === "7.2") {
        status = computeSuggestedStatus72(guidedAnswers["7.2"], trainingMatrix);
      } else if (item.clause === "7.4") {
        status = computeSuggestedStatus74(guidedAnswers["7.4"], commMatrix);
      } else if (item.clause === "7.5") {
        status = computeSuggestedStatus75(guidedAnswers["7.5"], valuesByFieldCode?.documents_accessible);
      } else {
        status = computeSuggestedStatus(guidedAnswers[item.clause]);
      }
      item.relatedClauses.forEach((code) => { map[code] = status; });
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedAnswers, trainingMatrix, commMatrix, valuesByFieldCode]);

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
      return s && s !== "compliant" && s !== suggestedStatus;
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

  // ── Text generator ────────────────────────────────────────────────────────

  function handleGenerateClick() {
    if (hasExistingText) setConfirmState("confirming");
    else applyGenerated("replace");
  }

  function applyGenerated(mode) {
    const generated = buildSection7DraftText(
      valuesByFieldCode || {},
      clauseChecks || [],
      guidedAnswers,
      trainingMatrix,
      commMatrix
    );
    if (mode === "append") {
      const base = (currentFinalText || "").trimEnd();
      onApplyDraftText(`${base}\n\n${generated}`);
    } else {
      onApplyDraftText(generated);
    }
    setConfirmState(null);
  }

  // ── Summary counts ────────────────────────────────────────────────────────

  const answeredCount = useMemo(() => {
    let count = 0;
    AUDIT_QUESTIONS_S7.forEach(({ clause, questions }) => {
      questions.forEach((_, idx) => { if (getAnswer(clause, idx)) count++; });
    });
    return count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedAnswers]);

  const totalQuestions = AUDIT_QUESTIONS_S7.reduce((acc, { questions }) => acc + questions.length, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="s5-panel">

      {/* ── Resumen global ── */}
      <div className="s5-summary-bar">
        <span className="s5-summary-label">
          Preguntas respondidas: <strong>{answeredCount}/{totalQuestions}</strong>
        </span>
        <div className="s5-summary-clauses">
          {AUDIT_QUESTIONS_S7.map((item) => {
            const sug = suggestedStatusByClause[item.clause];
            const related = getExistingRelated(item);
            const cur = related.length > 0 ? getCurrentClauseStatus(related[0]) : null;
            return (
              <span
                key={item.clause}
                className={`s5-clause-pill ${sug ? STATUS_CLASS[sug] : "s5-status-empty"}`}
                title={`${item.clause}: ${sug ? STATUS_LABEL[sug] : "Sin respuestas"} (C actual: ${cur ? STATUS_LABEL[cur] : "—"})`}
              >
                {item.clause}
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
            Completa los campos de contexto y responde las preguntas guiadas. El estado sugerido
            se calcula automáticamente y puede aplicarse al bloque C.
          </p>
        </div>

        <div className="s5-clauses">
          {AUDIT_QUESTIONS_S7.map((item) => {
            const isOpen = openClause === item.clause;
            const sug = suggestedStatusByClause[item.clause];
            const related = getExistingRelated(item);
            const clauseAnswers = guidedAnswers[item.clause] || {};
            const answeredInClause = item.questions.filter((_, i) => clauseAnswers[`q${i}`]).length;
            const allSynced = sug && related.length > 0 && related.every(
              (c) => getCurrentClauseStatus(c) === sug
            );

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

                    {/* ── 7.1: contexto de recursos ── */}
                    {item.clause === "7.1" && (
                      <div className="s5-context-zone">
                        <div className="s7-context-grid">
                          <div className="s5-context-field">
                            <span className="s5-context-label">Nº empleados</span>
                            <input
                              type="number"
                              className="s5-context-input"
                              value={valuesByFieldCode?.employee_count ?? ""}
                              placeholder="0"
                              disabled={disabled}
                              onChange={(e) => onFieldChange("employee_count", e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </div>
                          <div className="s5-context-field">
                            <span className="s5-context-label">Nº socios</span>
                            <input
                              type="number"
                              className="s5-context-input"
                              value={valuesByFieldCode?.partner_count ?? ""}
                              placeholder="0"
                              disabled={disabled}
                              onChange={(e) => onFieldChange("partner_count", e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </div>
                          <div className="s5-context-field">
                            <span className="s5-context-label">Documento de mantenimiento</span>
                            <input
                              type="text"
                              className="s5-context-input"
                              value={valuesByFieldCode?.maintenance_reference_document || ""}
                              placeholder="Ej: Plan de mantenimiento Rev. 2024"
                              disabled={disabled}
                              onChange={(e) => onFieldChange("maintenance_reference_document", e.target.value)}
                            />
                          </div>
                          <div className="s5-context-field">
                            <span className="s5-context-label">Servicio de PRL</span>
                            <input
                              type="text"
                              className="s5-context-input"
                              value={valuesByFieldCode?.prl_provider_name || ""}
                              placeholder="Nombre del servicio de prevención"
                              disabled={disabled}
                              onChange={(e) => onFieldChange("prl_provider_name", e.target.value)}
                            />
                          </div>
                          <div className="s5-context-wide">
                            <span className="s5-context-label">Herramienta de seguimiento y medición</span>
                            <input
                              type="text"
                              className="s5-context-input"
                              value={valuesByFieldCode?.time_tracking_tool_name || ""}
                              placeholder="Ej: ERP, software de gestión, Excel de control..."
                              disabled={disabled}
                              onChange={(e) => onFieldChange("time_tracking_tool_name", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 7.2: perfiles + matriz de formación ── */}
                    {item.clause === "7.2" && (
                      <div className="s5-context-zone">
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Referencia de perfiles de puesto</span>
                          <input
                            type="text"
                            className="s5-context-input"
                            value={valuesByFieldCode?.job_profiles_reference || ""}
                            placeholder="Ej: P05 Descripción de puestos, Rev. 3"
                            disabled={disabled}
                            onChange={(e) => onFieldChange("job_profiles_reference", e.target.value)}
                          />
                        </div>
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Matriz de competencias y formación</span>
                          {trainingMatrix.length > 0 && (
                            <div className="s7-matrix-summary">
                              {[
                                { key: "valid",        label: "Válidos",        cls: "s7-ms-valid"   },
                                { key: "pending",      label: "Pendientes",     cls: "s7-ms-pending" },
                                { key: "expired",      label: "Caducados",      cls: "s7-ms-expired" },
                                { key: "insufficient", label: "Insuficientes",  cls: "s7-ms-insuf"   },
                              ].map(({ key, label, cls }) => {
                                const count = trainingMatrix.filter((r) => r.status === key).length;
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
                            value={trainingMatrix}
                            onChange={(val) => onFieldChange("competence_training_matrix", val)}
                            schema={TRAINING_SCHEMA}
                            addLabel="Añadir persona / perfil"
                            emptyText="Sin registros de formación. Añade una persona para comenzar."
                            disabled={disabled}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── 7.3: chips de medios + observaciones ── */}
                    {item.clause === "7.3" && (
                      <div className="s5-context-zone">
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Medios de sensibilización empleados</span>
                          <div className="s7-chips-group">
                            {AWARENESS_METHODS.map((m) => {
                              const selected = getSelectedMethods().includes(m.value);
                              return (
                                <button
                                  key={m.value}
                                  type="button"
                                  className={`s7-chip${selected ? " s7-chip-active" : ""}`}
                                  onClick={() => toggleMethod(m.value)}
                                  disabled={disabled}
                                  aria-pressed={selected}
                                >
                                  {selected ? "✓ " : ""}{m.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Observaciones adicionales (opcional)</span>
                          <textarea
                            className="s5-context-textarea"
                            value={valuesByFieldCode?.awareness_actions_notes || ""}
                            placeholder="Acciones específicas, incidencias observadas, mejoras sugeridas..."
                            rows={3}
                            disabled={disabled}
                            onChange={(e) => onFieldChange("awareness_actions_notes", e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── 7.4: matriz de comunicación + resumen ── */}
                    {item.clause === "7.4" && (
                      <div className="s5-context-zone">
                        <div className="s5-context-wide">
                          <span className="s5-context-label">Registro de canales de comunicación</span>
                          {commMatrix.length > 0 && (
                            <div className="s7-matrix-summary">
                              {[
                                { key: "documented",     label: "Documentados",   cls: "s7-ms-valid"   },
                                { key: "partial",        label: "Parciales",      cls: "s7-ms-pending" },
                                { key: "not_documented", label: "Sin evidencia",  cls: "s7-ms-expired" },
                              ].map(({ key, label, cls }) => {
                                const count = commMatrix.filter((r) => r.status === key).length;
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
                            value={commMatrix}
                            onChange={(val) => onFieldChange("communication_matrix", val)}
                            schema={COMMUNICATION_SCHEMA}
                            addLabel="Añadir canal"
                            emptyText="Sin canales registrados. Añade uno para comenzar."
                            disabled={disabled}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── 7.5: control documental ── */}
                    {item.clause === "7.5" && (
                      <div className="s5-context-zone">
                        <div className="s7-context-grid">
                          <div className="s5-context-wide">
                            <span className="s5-context-label">Referencia del sistema documental</span>
                            <input
                              type="text"
                              className="s5-context-input"
                              value={valuesByFieldCode?.document_control_reference || ""}
                              placeholder="Ej: Manual de calidad, intranet documental, SharePoint..."
                              disabled={disabled}
                              onChange={(e) => onFieldChange("document_control_reference", e.target.value)}
                            />
                          </div>
                          <div className="s5-context-field">
                            <span className="s5-context-label">Revisión vigente</span>
                            <input
                              type="text"
                              className="s5-context-input"
                              value={valuesByFieldCode?.document_control_revision || ""}
                              placeholder="Ej: Rev. 5"
                              disabled={disabled}
                              onChange={(e) => onFieldChange("document_control_revision", e.target.value)}
                            />
                          </div>
                          <div className="s5-context-field">
                            <span className="s5-context-label">Fecha de revisión</span>
                            <input
                              type="date"
                              className="s5-context-input"
                              value={valuesByFieldCode?.document_control_date || ""}
                              disabled={disabled}
                              onChange={(e) => onFieldChange("document_control_date", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="s7-accessible-row">
                          <label className="s7-accessible-label">
                            <input
                              type="checkbox"
                              checked={valuesByFieldCode?.documents_accessible === true}
                              disabled={disabled}
                              onChange={(e) => onFieldChange("documents_accessible", e.target.checked)}
                            />
                            <span>Los documentos son accesibles en todos los puntos de uso</span>
                          </label>
                          {valuesByFieldCode?.documents_accessible === false && (
                            <span className="s7-accessible-warning">
                              Desviación — documentación no accesible en puntos de uso
                            </span>
                          )}
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

                    {/* ── Footer: estado sugerido + aplicar a C ── */}
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
                                : `C actual: ${STATUS_LABEL[getCurrentClauseStatus(related[0])] || "—"}`
                              }
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
              ? <>Las cláusulas <strong>{applyConfirm.item.relatedClauses.join(", ")}</strong> ya tienen estados establecidos en el bloque C. ¿Aplicar la sugerencia <strong>"{STATUS_LABEL[applyConfirm.suggestedStatus]}"</strong> a todas?</>
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

      {/* ── Generador de texto ── */}
      <section className="s5-block s5-draft-block">
        <div className="s5-draft-row">
          <div className="s5-block-intro">
            <h4 className="s5-block-title">Generar texto narrativo del informe</h4>
            <p className="s5-block-desc">
              Crea un borrador con lenguaje auditor profesional a partir de la matriz de formación,
              los canales de comunicación, las respuestas guiadas y el estado de cláusulas. Edítalo en el bloque D.
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
