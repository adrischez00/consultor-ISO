import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import RichTextarea from "../components/RichTextarea";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import { createAuditReport } from "../api/auditsApi";
import { fetchClients } from "../api/clientsApi";
import { normalizeUuidOrNull } from "../utils/uuid";

const INITIAL_PLANNING = {
  auditor_organization: "",
  audited_area: "",
  audit_date: "",
  tipo_auditoria: "inicial",
  modalidad: "presencialmente",
  quality_responsible_name: "",
  manager_name: "",
  system_scope: "",
  audited_facilities: "",
  reference_standard_revision: "",
  audit_budget_code: "",
};

const TIPO_AUDITORIA_OPTIONS = [
  { value: "inicial", label: "Inicial" },
  { value: "revision_1", label: "RevisiÃ³n I" },
  { value: "revision_2", label: "RevisiÃ³n II" },
  { value: "recertificacion", label: "RecertificaciÃ³n" },
];

const MODALIDAD_OPTIONS = [
  { value: "presencialmente", label: "Presencialmente" },
  { value: "de forma remota", label: "De forma remota" },
  { value: "de forma mixta", label: "De forma mixta" },
];

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function AuditCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [planning, setPlanning] = useState(INITIAL_PLANNING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadClients() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchClients();
        if (!active) return;
        const safeClients = Array.isArray(data) ? data : [];
        setClients(safeClients);

        const fromQuery = normalizeUuidOrNull(searchParams.get("client_id"));
        if (fromQuery && safeClients.some((item) => item.id === fromQuery)) {
          setClientId(fromQuery);
        } else if (safeClients[0]?.id) {
          setClientId(safeClients[0].id);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar clientes.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadClients();
    return () => {
      active = false;
    };
  }, [searchParams]);

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === clientId) || null,
    [clientId, clients]
  );

  const yearValue = toNumberOrNull(reportYear);
  const yearValid = Boolean(yearValue && yearValue >= 2000 && yearValue <= 2200);

  const canSubmit = useMemo(
    () => Boolean(clientId) && yearValid && !saving && !loading,
    [clientId, yearValid, saving, loading]
  );

  function setPlanningField(field, value) {
    setPlanning((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError("");
    try {
      const created = await createAuditReport({
        client_id: clientId,
        report_year: yearValue,
        template_code: "P03",
        entity_name: selectedClient?.name || null,
        auditor_organization: planning.auditor_organization,
        audited_area: planning.audited_area,
        audit_date: planning.audit_date,
        tipo_auditoria: planning.tipo_auditoria,
        modalidad: planning.modalidad,
        quality_responsible_name: planning.quality_responsible_name,
        manager_name: planning.manager_name,
        system_scope: planning.system_scope,
        audited_facilities: planning.audited_facilities,
        reference_standard_revision: planning.reference_standard_revision,
        audit_budget_code: planning.audit_budget_code,
      });
      navigate(`/auditorias/${created.id}/editar`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la auditorÃ­a.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page audit-create-page">
      <PageHeader
        eyebrow="P03"
        title="Nueva auditorÃ­a"
        description="Abre un expediente de auditorÃ­a ISO 9001 con los datos mÃ­nimos para empezar y continuar el trabajo en el editor."
        actions={
          <Link className="btn-ghost link-btn" to="/auditorias">
            Volver a auditorÃ­as
          </Link>
        }
      />

      {loading ? <p className="status">Cargando clientes...</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading ? (
        <form className="form-grid audit-create-form" onSubmit={handleSubmit}>
          <SectionCard
            className="audit-create-step-card"
            title="1. Apertura del expediente"
            description="Define la entidad y el aÃ±o para crear el expediente y activar su centro de trabajo."
          >
            <div className="audit-form-grid">
              <label className="field-stack">
                <span>Cliente / Entidad auditada *</span>
                <select
                  className="input-select"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  required
                >
                  <option value="">Selecciona cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>AÃ±o del informe *</span>
                <input
                  className="input-text"
                  type="number"
                  min="2000"
                  max="2200"
                  value={reportYear}
                  onChange={(event) => setReportYear(event.target.value)}
                  required
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            className="audit-create-step-card"
            title="2. PlanificaciÃ³n inicial (recomendada)"
            description="AÃ±ade contexto operativo para entrar al editor con una base clara y consistente."
          >
            <div className="audit-create-groups">
              <section className="audit-create-group">
                <header className="audit-create-group-head">
                  <h4>A. IdentificaciÃ³n</h4>
                  <p>Datos de referencia inicial para abrir correctamente el expediente.</p>
                </header>
                <div className="audit-form-grid audit-create-group-grid">
                  <label className="field-stack">
                    <span>Auditor / OrganizaciÃ³n</span>
                    <input
                      className="input-text"
                      value={planning.auditor_organization}
                      onChange={(event) => setPlanningField("auditor_organization", event.target.value)}
                    />
                  </label>
                  <label className="field-stack">
                    <span>Fecha de auditorÃ­a</span>
                    <input
                      className="input-text"
                      type="date"
                      value={planning.audit_date}
                      onChange={(event) => setPlanningField("audit_date", event.target.value)}
                    />
                  </label>
                  <label className="field-stack">
                    <span>Ãrea auditada</span>
                    <input
                      className="input-text"
                      value={planning.audited_area}
                      onChange={(event) => setPlanningField("audited_area", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="audit-create-group">
                <header className="audit-create-group-head">
                  <h4>B. ConfiguraciÃ³n de auditorÃ­a</h4>
                  <p>ParÃ¡metros que determinan el enfoque de revisiÃ³n desde el inicio.</p>
                </header>
                <div className="audit-form-grid audit-create-group-grid">
                  <label className="field-stack">
                    <span>Tipo de auditorÃ­a</span>
                    <select
                      className="input-select"
                      value={planning.tipo_auditoria}
                      onChange={(event) => setPlanningField("tipo_auditoria", event.target.value)}
                    >
                      {TIPO_AUDITORIA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-stack">
                    <span>Modalidad</span>
                    <select
                      className="input-select"
                      value={planning.modalidad}
                      onChange={(event) => setPlanningField("modalidad", event.target.value)}
                    >
                      {MODALIDAD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-stack">
                    <span>RevisiÃ³n de norma</span>
                    <input
                      className="input-text"
                      value={planning.reference_standard_revision}
                      onChange={(event) => setPlanningField("reference_standard_revision", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="audit-create-group">
                <header className="audit-create-group-head">
                  <h4>C. Contexto operativo inicial</h4>
                  <p>InformaciÃ³n Ãºtil para arrancar el trabajo de ediciÃ³n con contexto real.</p>
                </header>
                <div className="audit-form-grid audit-create-group-grid">
                  <label className="field-stack">
                    <span>Responsable del sistema</span>
                    <input
                      className="input-text"
                      value={planning.quality_responsible_name}
                      onChange={(event) => setPlanningField("quality_responsible_name", event.target.value)}
                    />
                  </label>
                  <label className="field-stack">
                    <span>Gerente</span>
                    <input
                      className="input-text"
                      value={planning.manager_name}
                      onChange={(event) => setPlanningField("manager_name", event.target.value)}
                    />
                  </label>
                  <label className="field-stack">
                    <span>CÃ³digo de presupuesto</span>
                    <input
                      className="input-text"
                      value={planning.audit_budget_code}
                      onChange={(event) => setPlanningField("audit_budget_code", event.target.value)}
                    />
                  </label>
                  <label className="field-stack audit-full-width">
                    <span>Instalaciones auditadas</span>
                    <RichTextarea
                      className="input-textarea"
                      value={planning.audited_facilities}
                      onChange={(event) => setPlanningField("audited_facilities", event.target.value)}
                    />
                  </label>
                  <label className="field-stack audit-full-width">
                    <span>Alcance del sistema</span>
                    <RichTextarea
                      className="input-textarea"
                      value={planning.system_scope}
                      onChange={(event) => setPlanningField("system_scope", event.target.value)}
                    />
                  </label>
                </div>
              </section>
            </div>
            <p className="soft-label audit-create-helper">
              Las notas adicionales para la introducciÃ³n del informe se completan en el editor del expediente.
            </p>
          </SectionCard>

          <div className="form-actions audit-create-actions">
            <button type="submit" className="btn-primary audit-create-submit-btn" disabled={!canSubmit}>
              {saving ? "Creando expediente..." : "Crear y continuar"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default AuditCreatePage;




