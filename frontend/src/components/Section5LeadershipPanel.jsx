import { useState } from "react";

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

const EVIDENCE_OPTIONS = [
  { id: "rev_direccion", label: "Acta de revisión por la dirección" },
  { id: "politica_calidad", label: "Política de calidad vigente" },
  { id: "organigrama", label: "Organigrama actualizado" },
  { id: "p05_puestos", label: "P05 Descripción de puestos de trabajo" },
  { id: "encuestas_satisfaccion", label: "Encuestas de satisfacción del cliente" },
  { id: "reclamaciones", label: "Registro de reclamaciones de clientes" },
  { id: "indicadores_comerciales", label: "Indicadores comerciales / KPI de cliente" },
  { id: "actas_reunion", label: "Actas de reunión interna (con participación dirección)" },
  { id: "objetivos_calidad", label: "Objetivos de calidad establecidos" },
  { id: "comunicaciones_internas", label: "Comunicaciones internas de dirección" },
  { id: "manual_calidad", label: "Manual de calidad" },
  { id: "plan_auditoria", label: "Plan de auditoría interna" },
  { id: "feedback_cliente", label: "Registros de feedback / seguimiento de contratos" },
  { id: "fichas_puesto", label: "Fichas de puesto / perfiles de competencia" },
];

function buildSection5DraftText(values, clauseChecks) {
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

  const policyRev = (values.quality_policy_revision || "").trim();
  const policyDate = (values.quality_policy_date || "").trim();
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

  const noncompliantClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "non_compliant")
    .map((c) => c.clause_code);
  const partialClauses = (clauseChecks || [])
    .filter((c) => c.applicable && c.clause_status === "partial")
    .map((c) => c.clause_code);

  // 5.1 Liderazgo
  {
    let block51 =
      "Evidencias observadas: Se evidencia";
    if (involvement) {
      block51 += ` ${involvement.charAt(0).toLowerCase()}${involvement.slice(1)}`;
    } else {
      block51 +=
        " la participación de la alta dirección en el mantenimiento y mejora del Sistema de Gestión de la Calidad";
    }
    if (resourcesOk === true) {
      block51 +=
        ", con asignación adecuada de recursos para la operación eficaz del sistema";
    }
    if (integrated === true) {
      block51 +=
        ", y con el SGC integrado en los procesos de negocio de la organización";
    }
    block51 += ".";
    if (evidenceLead) {
      block51 += ` Evidencias revisadas: ${evidenceLead}.`;
    }
    parts.push(block51);
  }

  // 5.1.2 Enfoque al cliente
  {
    const hasClientData =
      s512Satisfaction || s512Complaints || reqMet != null || feedbackTracked != null || commsNotes;
    if (hasClientData) {
      let block512 = "Enfoque al cliente (5.1.2):";
      if (reqMet === true) {
        block512 += " Se verifica el cumplimiento de los requisitos del cliente";
      } else if (reqMet === false) {
        block512 += " No se ha podido verificar el cumplimiento completo de los requisitos del cliente";
      }
      if (feedbackTracked === true) {
        block512 += ", con seguimiento activo de la satisfacción";
      }
      if (s512Satisfaction) {
        block512 += `. ${s512Satisfaction}`;
      }
      if (s512Complaints) {
        block512 += ` Reclamaciones: ${s512Complaints}.`;
      }
      if (commsNotes) {
        block512 += ` Comunicación con el cliente: ${commsNotes}.`;
      }
      if (customerRisks) {
        block512 += ` Riesgos identificados: ${customerRisks}.`;
      }
      parts.push(block512);
    }
  }

  // 5.2 Política de calidad
  {
    let block52 = "Política de calidad (5.2):";
    const policyRef =
      policyRev && policyDate
        ? ` Rev. ${policyRev} de fecha ${policyDate}`
        : policyRev
          ? ` Rev. ${policyRev}`
          : "";
    if (policyUpdated === true) {
      block52 += ` La política de calidad${policyRef} se encuentra actualizada`;
    } else if (policyUpdated === false) {
      block52 += ` La política de calidad${policyRef} presenta pendientes de actualización`;
    } else {
      block52 += ` La política de calidad${policyRef} ha sido revisada`;
    }
    if (policyAvailable === true) {
      block52 += ", está disponible y comunicada al personal";
    }
    if (policyCoherent === true) {
      block52 += ", y es coherente con el contexto y la dirección estratégica de la organización";
    }
    if (policyClimate === true) {
      block52 +=
        ". Incluye referencia explícita al cambio climático, en línea con la enmienda ISO 9001:2024";
    } else if (policyClimate === false) {
      block52 +=
        ". No incluye referencias al cambio climático (se recomienda evaluar su pertinencia conforme a ISO 9001:2024)";
    }
    block52 += ".";
    if (policyChanges) {
      block52 += ` Cambios respecto a versión anterior: ${policyChanges}.`;
    }
    parts.push(block52);
  }

  // 5.3 Roles
  {
    let block53 = "Roles, responsabilidades y autoridades (5.3):";
    if (responsible) {
      block53 += ` La figura de Responsable del SGC recae en ${responsible}.`;
    }
    if (rolesDefined === true) {
      block53 += " Los roles y responsabilidades están definidos";
      if (rolesDoc) {
        block53 += ` y documentados en ${rolesDoc}`;
      }
      block53 += ".";
    } else if (rolesDefined === false) {
      block53 +=
        " Se detecta ausencia o insuficiencia en la definición formal de roles y responsabilidades.";
    }
    if (orgChart) {
      const chartStatus = orgChartUpdated === true ? "actualizado" : "disponible";
      block53 += ` Organigrama ${chartStatus}: ${orgChart}.`;
    } else if (orgChartUpdated === true) {
      block53 += " El organigrama está actualizado.";
    }
    if (staffAware === true) {
      block53 += " El personal entrevistado demuestra conocimiento de sus funciones y autoridades.";
    } else if (staffAware === false) {
      block53 +=
        " Se detecta conocimiento insuficiente de funciones y autoridades por parte del personal.";
    }
    if (rolesChanges) {
      block53 += ` Cambios recientes: ${rolesChanges}.`;
    }
    parts.push(block53);
  }

  // Evidencias seleccionadas
  if (selectedEvidence.length > 0) {
    const evidenceLabels = selectedEvidence
      .map((id) => EVIDENCE_OPTIONS.find((e) => e.id === id)?.label || id)
      .join(", ");
    parts.push(`Documentación revisada: ${evidenceLabels}.`);
  }

  // Estado de clausulas
  if (noncompliantClauses.length > 0) {
    parts.push(
      `Desviaciones / no conformidades detectadas: Se han identificado incumplimientos en las cláusulas ${noncompliantClauses.join(", ")}. Se requieren acciones correctivas antes del cierre del expediente.`
    );
  } else if (partialClauses.length > 0) {
    parts.push(
      `Observaciones: Las cláusulas ${partialClauses.join(", ")} presentan cumplimiento parcial. Se recomienda reforzar las evidencias y el seguimiento en los puntos indicados.`
    );
  } else {
    parts.push(
      "Conclusión de cumplimiento: La sección 5 presenta un nivel de cumplimiento conforme con los requisitos de la norma ISO 9001, con la evidencia disponible y los checks de cláusula revisados."
    );
  }

  return parts.join("\n\n");
}

export default function Section5LeadershipPanel({
  valuesByFieldCode,
  clauseChecks,
  onFieldChange,
  onApplyDraftText,
  disabled,
}) {
  const [openClause, setOpenClause] = useState(null);

  const selectedEvidence = Array.isArray(valuesByFieldCode?.s5_objective_evidence)
    ? valuesByFieldCode.s5_objective_evidence
    : [];

  function toggleEvidence(id) {
    if (disabled) return;
    const next = selectedEvidence.includes(id)
      ? selectedEvidence.filter((e) => e !== id)
      : [...selectedEvidence, id];
    onFieldChange("s5_objective_evidence", next);
  }

  function handleGenerateDraft() {
    const text = buildSection5DraftText(valuesByFieldCode || {}, clauseChecks || []);
    onApplyDraftText(text);
  }

  return (
    <div className="s5-panel">
      {/* Preguntas auditoras */}
      <section className="s5-block">
        <header className="s5-block-head">
          <h4 className="s5-block-title">Preguntas guiadas del auditor</h4>
          <p className="s5-block-desc">
            Referencia de verificación por cláusula. Marca las respuestas en el bloque de verificación
            ISO.
          </p>
        </header>

        <div className="s5-clauses">
          {AUDIT_QUESTIONS.map((item) => {
            const isOpen = openClause === item.clause;
            return (
              <div key={item.clause} className={`s5-clause-block${isOpen ? " s5-clause-open" : ""}`}>
                <button
                  type="button"
                  className="s5-clause-toggle"
                  onClick={() => setOpenClause(isOpen ? null : item.clause)}
                >
                  <span className="s5-clause-code">{item.clause}</span>
                  <span className="s5-clause-name">{item.title}</span>
                  <span className="s5-clause-arrow">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <ul className="s5-question-list">
                    {item.questions.map((q, idx) => (
                      <li key={idx} className="s5-question-item">
                        {q}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Selector de evidencias */}
      <section className="s5-block">
        <header className="s5-block-head">
          <h4 className="s5-block-title">Evidencias objetivas revisadas</h4>
          <p className="s5-block-desc">
            Marca los documentos revisados. Se incorporarán automáticamente al texto del informe.
          </p>
        </header>
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
              >
                <span className="s5-chip-check">{checked ? "✓" : "+"}</span>
                {opt.label}
              </button>
            );
          })}
        </div>
        {selectedEvidence.length > 0 && (
          <p className="s5-evidence-count soft-label">
            {selectedEvidence.length} evidencia{selectedEvidence.length !== 1 ? "s" : ""} seleccionada
            {selectedEvidence.length !== 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* Generador de texto */}
      <section className="s5-block s5-draft-block">
        <header className="s5-block-head">
          <div>
            <h4 className="s5-block-title">Generar texto narrativo del informe</h4>
            <p className="s5-block-desc">
              Genera un borrador profesional a partir de los datos introducidos. Puedes editarlo
              libremente en el bloque D antes de guardar.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary s5-generate-btn"
            onClick={handleGenerateDraft}
            disabled={disabled}
          >
            Generar borrador
          </button>
        </header>
      </section>
    </div>
  );
}
