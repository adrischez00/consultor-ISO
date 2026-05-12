import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RichTextarea from "../components/RichTextarea";
import RichTextContent from "../components/RichTextContent";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { normalizeUuidOrNull } from "../utils/uuid";
import { fetchClients } from "../api/clientsApi";
import {
  createCustomerFeedback,
  deleteCustomerFeedback,
  fetchCustomerFeedback,
  fetchCustomerFeedbackSummary,
  patchCustomerFeedback,
} from "../api/customerFeedbackApi";

const FEEDBACK_TYPE_OPTIONS = [
  { value: "survey", label: "Encuesta" },
  { value: "meeting", label: "Reunion" },
  { value: "call", label: "Llamada" },
  { value: "email", label: "Email" },
  { value: "complaint", label: "Reclamacion" },
  { value: "other", label: "Otro" },
];

const INITIAL_FILTERS = {
  client_id: "",
  type: "",
  feedback_date_from: "",
  feedback_date_to: "",
  score_min: "",
  score_max: "",
};

function createEmptyForm() {
  return {
    client_id: "",
    feedback_date: "",
    score: "5",
    feedback_type: "survey",
    comment: "",
  };
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAverage(value) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return "-";
  return asNumber.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function mapScoreToBadge(score) {
  const asNumber = Number(score);
  if (!Number.isFinite(asNumber)) return "draft";
  if (asNumber >= 4) return "compliant";
  if (asNumber === 3) return "partial";
  return "non_compliant";
}

function feedbackTypeLabel(value) {
  return FEEDBACK_TYPE_OPTIONS.find((option) => option.value === value)?.label || value || "-";
}

function normalizeFilters(filters) {
  return {
    client_id: String(filters.client_id || "").trim(),
    type: String(filters.type || "").trim(),
    feedback_date_from: String(filters.feedback_date_from || "").trim(),
    feedback_date_to: String(filters.feedback_date_to || "").trim(),
    score_min: String(filters.score_min || "").trim(),
    score_max: String(filters.score_max || "").trim(),
  };
}

function CustomerSatisfactionPage() {
  const [searchParams] = useSearchParams();
  const contextReportId = normalizeUuidOrNull(searchParams.get("report_id"));
  const contextClientId = normalizeUuidOrNull(searchParams.get("client_id"));
  const [clients, setClients] = useState([]);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState(() => ({
    ...INITIAL_FILTERS,
    client_id: contextClientId || "",
  }));
  const [form, setForm] = useState(createEmptyForm);
  const [editingId, setEditingId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const clientMap = useMemo(() => {
    const map = new Map();
    clients.forEach((client) => {
      map.set(client.id, client.name || "Cliente");
    });
    return map;
  }, [clients]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"));
  }, [clients]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const normalizedFilters = normalizeFilters(filters);
      const [clientsData, itemsData, summaryData] = await Promise.all([
        fetchClients(),
        fetchCustomerFeedback(normalizedFilters),
        fetchCustomerFeedbackSummary(),
      ]);
      const safeClients = Array.isArray(clientsData) ? clientsData : [];
      setClients(safeClients);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setSummary(summaryData && typeof summaryData === "object" ? summaryData : null);
      setForm((prev) => {
        if (prev.client_id) return prev;
        return { ...prev, client_id: safeClients[0]?.id || "" };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
      setClients([]);
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!contextClientId) return;
    setFilters((prev) => ({ ...prev, client_id: prev.client_id || contextClientId }));
    setForm((prev) => ({ ...prev, client_id: prev.client_id || contextClientId }));
  }, [contextClientId]);

  function setFilterField(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function setFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm((prev) => ({ ...createEmptyForm(), client_id: prev.client_id || clients[0]?.id || "" }));
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      client_id: item.client_id || "",
      feedback_date: item.feedback_date || "",
      score: String(item.score ?? 5),
      feedback_type: item.feedback_type || "survey",
      comment: item.comment || "",
    });
    setError("");
    setStatusMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setStatusMessage("");

    const payload = {
      client_id: form.client_id,
      feedback_date: form.feedback_date,
      score: form.score,
      feedback_type: form.feedback_type,
      comment: form.comment,
    };

    try {
      if (editingId) {
        await patchCustomerFeedback(editingId, payload);
        setStatusMessage("Feedback actualizado.");
      } else {
        await createCustomerFeedback(payload);
        setStatusMessage("Feedback registrado.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el feedback.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    if (!itemId || deletingId) return;
    const confirmed = window.confirm("Se eliminara el feedback seleccionado. Continuar?");
    if (!confirmed) return;

    setDeletingId(itemId);
    setError("");
    setStatusMessage("");
    try {
      await deleteCustomerFeedback(itemId);
      if (editingId === itemId) {
        resetForm();
      }
      setStatusMessage("Feedback eliminado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el feedback.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="ISO 9001"
        title="Satisfaccion del Cliente"
        description="Registro y seguimiento de feedback de clientes para analisis operativo y direccion."
        actions={
          contextReportId ? (
            <Link className="btn-ghost link-btn" to={`/auditorias/${contextReportId}/editar`}>
              Volver a auditorÃ­a
            </Link>
          ) : null
        }
      />
      {contextReportId ? (
        <p className="status">
          Vista contextual desde auditorÃ­a {contextReportId}. El cliente del informe se aplica como filtro inicial.
        </p>
      ) : null}

      {statusMessage ? <p className="status">{statusMessage}</p> : null}
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="status">Cargando satisfaccion del cliente...</p> : null}

      <SectionCard title="Resumen" description="Media general y distribucion simple de puntuaciones.">
        <div className="inline-actions">
          <StatusBadge value="compliant" label={`Satisfechos: ${summary?.satisfied_count ?? 0}`} />
          <StatusBadge value="partial" label={`Neutros: ${summary?.neutral_count ?? 0}`} />
          <StatusBadge value="non_compliant" label={`Insatisfechos: ${summary?.unsatisfied_count ?? 0}`} />
          <span className="soft-label">Media: {formatAverage(summary?.average_score)} / 5</span>
          <span className="soft-label">Total: {summary?.total_feedback ?? 0}</span>
          <span className="soft-label">Ultimo: {formatDate(summary?.latest_feedback_date)}</span>
        </div>
      </SectionCard>

      <SectionCard title="Filtros" description="Filtra por rango de fecha, puntuacion y origen.">
        <div className="inline-actions">
          <label className="field-inline">
            <span>Cliente</span>
            <select
              className="input-select"
              value={filters.client_id}
              onChange={(event) => setFilterField("client_id", event.target.value)}
            >
              <option value="">Todos</option>
              {sortedClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <span>Desde</span>
            <input
              className="input-text"
              type="date"
              value={filters.feedback_date_from}
              onChange={(event) => setFilterField("feedback_date_from", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Hasta</span>
            <input
              className="input-text"
              type="date"
              value={filters.feedback_date_to}
              onChange={(event) => setFilterField("feedback_date_to", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Puntuacion min</span>
            <input
              className="input-text"
              type="number"
              min="1"
              max="5"
              value={filters.score_min}
              onChange={(event) => setFilterField("score_min", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Puntuacion max</span>
            <input
              className="input-text"
              type="number"
              min="1"
              max="5"
              value={filters.score_max}
              onChange={(event) => setFilterField("score_max", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Origen</span>
            <select
              className="input-select"
              value={filters.type}
              onChange={(event) => setFilterField("type", event.target.value)}
            >
              <option value="">Todos</option>
              {FEEDBACK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => setFilters(INITIAL_FILTERS)}
            disabled={loading}
          >
            Limpiar
          </button>
        </div>
      </SectionCard>

      <div className="layout-grid two-columns">
        <SectionCard
          title={editingId ? "Editar feedback" : "Nuevo feedback"}
          description="Registro manual de feedback de clientes con puntuacion."
          actions={
            editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm} disabled={saving}>
                Cancelar edicion
              </button>
            ) : null
          }
        >
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="field-stack">
              <span>Cliente *</span>
              <select
                className="input-select"
                value={form.client_id}
                onChange={(event) => setFormField("client_id", event.target.value)}
                required
                disabled={saving}
              >
                <option value="">Selecciona cliente</option>
                {sortedClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-actions">
              <label className="field-inline">
                <span>Fecha *</span>
                <input
                  className="input-text"
                  type="date"
                  value={form.feedback_date}
                  onChange={(event) => setFormField("feedback_date", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Puntuacion *</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  value={form.score}
                  onChange={(event) => setFormField("score", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Origen *</span>
                <select
                  className="input-select"
                  value={form.feedback_type}
                  onChange={(event) => setFormField("feedback_type", event.target.value)}
                  disabled={saving}
                >
                  {FEEDBACK_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field-stack">
              <span>Comentario *</span>
              <RichTextarea
                className="input-textarea"
                value={form.comment}
                onChange={(event) => setFormField("comment", event.target.value)}
                required
                disabled={saving}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Actualizar feedback" : "Registrar feedback"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Listado de feedback" description="Comentarios y puntuaciones por cliente.">
          {!loading && items.length === 0 ? (
            <p className="empty-state">No hay feedback para los filtros seleccionados.</p>
          ) : (
            <div className="stack-list">
              {items.map((item) => (
                <article className="finding-item" key={item.id}>
                  <div className="finding-head">
                    <p className="finding-title">{clientMap.get(item.client_id) || item.client_id}</p>
                    <div className="finding-badges">
                      <StatusBadge value={mapScoreToBadge(item.score)} label={`Puntuacion: ${item.score}/5`} />
                      <StatusBadge value="draft" label={feedbackTypeLabel(item.feedback_type)} />
                    </div>
                  </div>
                  <p className="finding-meta">Fecha: {formatDate(item.feedback_date)}</p>
                  <RichTextContent value={item.comment} />
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => startEdit(item)}
                      disabled={saving || deletingId === item.id}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleDelete(item.id)}
                      disabled={saving || deletingId === item.id}
                    >
                      {deletingId === item.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </section>
  );
}

export default CustomerSatisfactionPage;



