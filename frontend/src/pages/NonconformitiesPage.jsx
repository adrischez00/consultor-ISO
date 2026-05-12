import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { normalizeUuidOrNull } from "../utils/uuid";
import { fetchClients } from "../api/clientsApi";
import {
  ISO_MANAGEMENT_OPTIONS,
  createImprovement,
  createNonconformity,
  deleteImprovement,
  deleteNonconformity,
  fetchImprovementSummary,
  fetchImprovements,
  fetchNonconformities,
  fetchNonconformitySummary,
  patchImprovement,
  patchNonconformity,
} from "../api/isoManagementApi";

const EMPTY_NONCONFORMITY = {
  client_id: "",
  source_recommendation_id: "",
  linked_action_task_id: "",
  origin_type: "audit",
  title: "",
  description: "",
  cause_analysis: "",
  immediate_correction: "",
  corrective_action: "",
  responsible_name: "",
  due_date: "",
  effectiveness_verification: "",
  verification_date: "",
  status: "open",
  closure_notes: "",
};

const EMPTY_IMPROVEMENT = {
  linked_nonconformity_id: "",
  source_type: "nonconformity",
  source_id: "",
  title: "",
  description: "",
  action_plan: "",
  responsible_name: "",
  status: "proposed",
  due_date: "",
  followup_notes: "",
  benefit_observed: "",
  review_date: "",
};

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function mapStatusToBadge(status) {
  if (status === "closed" || status === "completed" || status === "validated") return "completed";
  if (status === "in_progress" || status === "pending_verification" || status === "implemented") return "in_progress";
  if (status === "cancelled" || status === "on_hold") return "draft";
  return "pending";
}

function NonconformitiesPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [clients, setClients] = useState([]);
  const [nonconformitySummary, setNonconformitySummary] = useState(null);
  const [nonconformities, setNonconformities] = useState([]);
  const [nonconformityForm, setNonconformityForm] = useState(EMPTY_NONCONFORMITY);
  const [editingNonconformityId, setEditingNonconformityId] = useState("");

  const [improvementSummary, setImprovementSummary] = useState(null);
  const [improvements, setImprovements] = useState([]);
  const [improvementForm, setImprovementForm] = useState(EMPTY_IMPROVEMENT);
  const [editingImprovementId, setEditingImprovementId] = useState("");

  const clientOptions = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const contextReportId = normalizeUuidOrNull(searchParams.get("report_id"));
  const contextClientId = normalizeUuidOrNull(searchParams.get("client_id"));
  const contextRecommendationId = normalizeUuidOrNull(searchParams.get("source_recommendation_id"));
  const contextOriginTypeRaw = String(searchParams.get("origin_type") || "").trim().toLowerCase();
  const contextOriginType = ISO_MANAGEMENT_OPTIONS.nonconformityOrigin.includes(contextOriginTypeRaw)
    ? contextOriginTypeRaw
    : "";
  const contextTitle = String(searchParams.get("title") || "").trim();
  const contextDescription = String(searchParams.get("description") || "").trim();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [clientsData, ncSummaryData, ncData, impSummaryData, impData] = await Promise.all([
        fetchClients(),
        fetchNonconformitySummary(),
        fetchNonconformities(),
        fetchImprovementSummary(),
        fetchImprovements(),
      ]);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setNonconformitySummary(ncSummaryData && typeof ncSummaryData === "object" ? ncSummaryData : null);
      setNonconformities(Array.isArray(ncData) ? ncData : []);
      setImprovementSummary(impSummaryData && typeof impSummaryData === "object" ? impSummaryData : null);
      setImprovements(Array.isArray(impData) ? impData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar no conformidades y mejoras.");
      setClients([]);
      setNonconformitySummary(null);
      setNonconformities([]);
      setImprovementSummary(null);
      setImprovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (editingNonconformityId) return;
    setNonconformityForm((prev) => ({
      ...prev,
      client_id: contextClientId || prev.client_id || "",
      source_recommendation_id: contextRecommendationId || prev.source_recommendation_id || "",
      origin_type: contextOriginType || prev.origin_type || "audit",
      title: contextTitle || prev.title || "",
      description: contextDescription || prev.description || "",
    }));
  }, [
    contextClientId,
    contextDescription,
    contextOriginType,
    contextRecommendationId,
    contextTitle,
    editingNonconformityId,
  ]);

  function setMessage(message) {
    setStatusMessage(message);
    setError("");
  }

  function startEditNonconformity(item) {
    setEditingNonconformityId(item.id);
    setNonconformityForm({
      client_id: item.client_id || "",
      source_recommendation_id: item.source_recommendation_id || "",
      linked_action_task_id: item.linked_action_task_id || "",
      origin_type: item.origin_type || "audit",
      title: item.title || "",
      description: item.description || "",
      cause_analysis: item.cause_analysis || "",
      immediate_correction: item.immediate_correction || "",
      corrective_action: item.corrective_action || "",
      responsible_name: item.responsible_name || "",
      due_date: item.due_date || "",
      effectiveness_verification: item.effectiveness_verification || "",
      verification_date: item.verification_date || "",
      status: item.status || "open",
      closure_notes: item.closure_notes || "",
    });
  }

  async function handleSaveNonconformity(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const payload = {
        client_id: normalizeNullableText(nonconformityForm.client_id),
        source_recommendation_id: normalizeNullableText(nonconformityForm.source_recommendation_id),
        linked_action_task_id: normalizeNullableText(nonconformityForm.linked_action_task_id),
        origin_type: nonconformityForm.origin_type,
        title: nonconformityForm.title,
        description: nonconformityForm.description,
        cause_analysis: normalizeNullableText(nonconformityForm.cause_analysis),
        immediate_correction: normalizeNullableText(nonconformityForm.immediate_correction),
        corrective_action: normalizeNullableText(nonconformityForm.corrective_action),
        responsible_name: nonconformityForm.responsible_name,
        due_date: normalizeNullableText(nonconformityForm.due_date),
        effectiveness_verification: normalizeNullableText(nonconformityForm.effectiveness_verification),
        verification_date: normalizeNullableText(nonconformityForm.verification_date),
        status: nonconformityForm.status,
        closure_notes: normalizeNullableText(nonconformityForm.closure_notes),
      };
      if (editingNonconformityId) {
        await patchNonconformity(editingNonconformityId, payload);
        setMessage("No conformidad actualizada.");
      } else {
        await createNonconformity(payload);
        setMessage("No conformidad creada.");
      }
      setEditingNonconformityId("");
      setNonconformityForm(EMPTY_NONCONFORMITY);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la no conformidad.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNonconformity(itemId) {
    if (!window.confirm("Se eliminara la no conformidad. Continuar?")) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      await deleteNonconformity(itemId);
      if (editingNonconformityId === itemId) {
        setEditingNonconformityId("");
        setNonconformityForm(EMPTY_NONCONFORMITY);
      }
      setMessage("No conformidad eliminada.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la no conformidad.");
    } finally {
      setSaving(false);
    }
  }

  function startEditImprovement(item) {
    setEditingImprovementId(item.id);
    setImprovementForm({
      linked_nonconformity_id: item.linked_nonconformity_id || "",
      source_type: item.source_type || "nonconformity",
      source_id: item.source_id || "",
      title: item.title || "",
      description: item.description || "",
      action_plan: item.action_plan || "",
      responsible_name: item.responsible_name || "",
      status: item.status || "proposed",
      due_date: item.due_date || "",
      followup_notes: item.followup_notes || "",
      benefit_observed: item.benefit_observed || "",
      review_date: item.review_date || "",
    });
  }

  async function handleSaveImprovement(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const payload = {
        linked_nonconformity_id: normalizeNullableText(improvementForm.linked_nonconformity_id),
        source_type: improvementForm.source_type,
        source_id: normalizeNullableText(improvementForm.source_id),
        title: improvementForm.title,
        description: improvementForm.description,
        action_plan: improvementForm.action_plan,
        responsible_name: improvementForm.responsible_name,
        status: improvementForm.status,
        due_date: normalizeNullableText(improvementForm.due_date),
        followup_notes: normalizeNullableText(improvementForm.followup_notes),
        benefit_observed: normalizeNullableText(improvementForm.benefit_observed),
        review_date: normalizeNullableText(improvementForm.review_date),
      };
      if (editingImprovementId) {
        await patchImprovement(editingImprovementId, payload);
        setMessage("Mejora actualizada.");
      } else {
        await createImprovement(payload);
        setMessage("Mejora creada.");
      }
      setEditingImprovementId("");
      setImprovementForm(EMPTY_IMPROVEMENT);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la mejora.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteImprovement(itemId) {
    if (!window.confirm("Se eliminara la mejora. Continuar?")) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      await deleteImprovement(itemId);
      if (editingImprovementId === itemId) {
        setEditingImprovementId("");
        setImprovementForm(EMPTY_IMPROVEMENT);
      }
      setMessage("Mejora eliminada.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la mejora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="ISO 9001"
        title="No conformidades y mejora"
        description="Flujo CAPA: deteccion, accion correctiva, verificacion y mejora continua."
        actions={
          contextReportId ? (
            <Link className="btn-ghost link-btn" to={`/auditorias/${contextReportId}/editar`}>
              Volver a auditoría
            </Link>
          ) : null
        }
      />
      {contextReportId ? (
        <p className="status">
          Flujo CAPA contextual desde auditoría {contextReportId}. Las nuevas no conformidades pueden vincularse
          directamente a hallazgos del informe.
        </p>
      ) : null}

      {statusMessage ? <p className="status">{statusMessage}</p> : null}
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="status">Cargando flujo CAPA...</p> : null}

      {!loading ? (
        <>
          <div className="layout-grid two-columns">
            <SectionCard
              title={editingNonconformityId ? "Editar no conformidad" : "No conformidades"}
              description="Origen, causa, accion correctiva, verificacion y cierre."
            >
              <div className="inline-actions">
                <StatusBadge value="pending" label={`Total: ${nonconformitySummary?.total ?? 0}`} />
                <StatusBadge value="in_progress" label={`En progreso: ${nonconformitySummary?.in_progress ?? 0}`} />
                <StatusBadge value="completed" label={`Cerradas: ${nonconformitySummary?.closed ?? 0}`} />
              </div>
              <form className="form-grid" onSubmit={handleSaveNonconformity}>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Cliente</span>
                    <select
                      className="input-select"
                      value={nonconformityForm.client_id}
                      onChange={(event) =>
                        setNonconformityForm((prev) => ({ ...prev, client_id: event.target.value }))
                      }
                    >
                      <option value="">Sin cliente</option>
                      {clientOptions.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Origen</span>
                    <select
                      className="input-select"
                      value={nonconformityForm.origin_type}
                      onChange={(event) =>
                        setNonconformityForm((prev) => ({ ...prev, origin_type: event.target.value }))
                      }
                    >
                      {ISO_MANAGEMENT_OPTIONS.nonconformityOrigin.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Estado</span>
                    <select
                      className="input-select"
                      value={nonconformityForm.status}
                      onChange={(event) =>
                        setNonconformityForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                    >
                      {ISO_MANAGEMENT_OPTIONS.nonconformityStatus.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field-stack">
                  <span>Titulo *</span>
                  <input
                    className="input-text"
                    value={nonconformityForm.title}
                    onChange={(event) => setNonconformityForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Descripcion *</span>
                  <textarea
                    className="input-textarea"
                    value={nonconformityForm.description}
                    onChange={(event) =>
                      setNonconformityForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    required
                    disabled={saving}
                  />
                </label>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Recomendacion origen (UUID)</span>
                    <input
                      className="input-text"
                      value={nonconformityForm.source_recommendation_id}
                      onChange={(event) =>
                        setNonconformityForm((prev) => ({
                          ...prev,
                          source_recommendation_id: event.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </label>
                  <label className="field-inline">
                    <span>Accion vinculada (UUID)</span>
                    <input
                      className="input-text"
                      value={nonconformityForm.linked_action_task_id}
                      onChange={(event) =>
                        setNonconformityForm((prev) => ({
                          ...prev,
                          linked_action_task_id: event.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </label>
                </div>
                <label className="field-stack">
                  <span>Analisis de causa</span>
                  <textarea
                    className="input-textarea"
                    value={nonconformityForm.cause_analysis}
                    onChange={(event) =>
                      setNonconformityForm((prev) => ({ ...prev, cause_analysis: event.target.value }))
                    }
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Accion correctiva</span>
                  <textarea
                    className="input-textarea"
                    value={nonconformityForm.corrective_action}
                    onChange={(event) =>
                      setNonconformityForm((prev) => ({ ...prev, corrective_action: event.target.value }))
                    }
                    disabled={saving}
                  />
                </label>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Responsable</span>
                    <input
                      className="input-text"
                      value={nonconformityForm.responsible_name}
                      onChange={(event) =>
                        setNonconformityForm((prev) => ({ ...prev, responsible_name: event.target.value }))
                      }
                      required
                      disabled={saving}
                    />
                  </label>
                  <label className="field-inline">
                    <span>Plazo</span>
                    <input
                      className="input-text"
                      type="date"
                      value={nonconformityForm.due_date}
                      onChange={(event) => setNonconformityForm((prev) => ({ ...prev, due_date: event.target.value }))}
                      disabled={saving}
                    />
                  </label>
                  <label className="field-inline">
                    <span>Fecha verificacion</span>
                    <input
                      className="input-text"
                      type="date"
                      value={nonconformityForm.verification_date}
                      onChange={(event) =>
                        setNonconformityForm((prev) => ({ ...prev, verification_date: event.target.value }))
                      }
                      disabled={saving}
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {editingNonconformityId ? "Actualizar no conformidad" : "Crear no conformidad"}
                  </button>
                  {editingNonconformityId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingNonconformityId("");
                        setNonconformityForm(EMPTY_NONCONFORMITY);
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="stack-list">
                {nonconformities.map((item) => (
                  <article key={item.id} className="diagnostic-list-item">
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{item.title}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={mapStatusToBadge(item.status)} label={item.status} />
                        <span>Origen: {item.origin_type}</span>
                        <span>Plazo: {formatDate(item.due_date)}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <button type="button" className="btn-secondary" onClick={() => startEditNonconformity(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleDeleteNonconformity(item.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title={editingImprovementId ? "Editar mejora" : "Mejora continua"}
              description="Oportunidades, acciones y beneficios observados."
            >
              <div className="inline-actions">
                <StatusBadge value="pending" label={`Total: ${improvementSummary?.total ?? 0}`} />
                <StatusBadge value="in_progress" label={`En progreso: ${improvementSummary?.in_progress ?? 0}`} />
                <StatusBadge value="completed" label={`Cerradas: ${improvementSummary?.closed ?? 0}`} />
              </div>
              <form className="form-grid" onSubmit={handleSaveImprovement}>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>No conformidad vinculada</span>
                    <select
                      className="input-select"
                      value={improvementForm.linked_nonconformity_id}
                      onChange={(event) =>
                        setImprovementForm((prev) => ({ ...prev, linked_nonconformity_id: event.target.value }))
                      }
                    >
                      <option value="">Sin vinculo</option>
                      {nonconformities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Fuente</span>
                    <select
                      className="input-select"
                      value={improvementForm.source_type}
                      onChange={(event) => setImprovementForm((prev) => ({ ...prev, source_type: event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.improvementSource.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Estado</span>
                    <select
                      className="input-select"
                      value={improvementForm.status}
                      onChange={(event) => setImprovementForm((prev) => ({ ...prev, status: event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.improvementStatus.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field-stack">
                  <span>Titulo *</span>
                  <input
                    className="input-text"
                    value={improvementForm.title}
                    onChange={(event) => setImprovementForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Descripcion *</span>
                  <textarea
                    className="input-textarea"
                    value={improvementForm.description}
                    onChange={(event) => setImprovementForm((prev) => ({ ...prev, description: event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Plan de accion *</span>
                  <textarea
                    className="input-textarea"
                    value={improvementForm.action_plan}
                    onChange={(event) => setImprovementForm((prev) => ({ ...prev, action_plan: event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Responsable</span>
                    <input
                      className="input-text"
                      value={improvementForm.responsible_name}
                      onChange={(event) =>
                        setImprovementForm((prev) => ({ ...prev, responsible_name: event.target.value }))
                      }
                      required
                      disabled={saving}
                    />
                  </label>
                  <label className="field-inline">
                    <span>Fecha objetivo</span>
                    <input
                      className="input-text"
                      type="date"
                      value={improvementForm.due_date}
                      onChange={(event) => setImprovementForm((prev) => ({ ...prev, due_date: event.target.value }))}
                      disabled={saving}
                    />
                  </label>
                  <label className="field-inline">
                    <span>Fecha revision</span>
                    <input
                      className="input-text"
                      type="date"
                      value={improvementForm.review_date}
                      onChange={(event) => setImprovementForm((prev) => ({ ...prev, review_date: event.target.value }))}
                      disabled={saving}
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {editingImprovementId ? "Actualizar mejora" : "Crear mejora"}
                  </button>
                  {editingImprovementId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingImprovementId("");
                        setImprovementForm(EMPTY_IMPROVEMENT);
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="stack-list">
                {improvements.map((item) => (
                  <article key={item.id} className="diagnostic-list-item">
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{item.title}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={mapStatusToBadge(item.status)} label={item.status} />
                        <span>Fuente: {item.source_type}</span>
                        <span>Revision: {formatDate(item.review_date)}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <button type="button" className="btn-secondary" onClick={() => startEditImprovement(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleDeleteImprovement(item.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default NonconformitiesPage;
