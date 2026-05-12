import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RichTextarea from "../components/RichTextarea";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { normalizeUuidOrNull } from "../utils/uuid";
import {
  createRiskOpportunity,
  deleteRiskOpportunity,
  fetchRiskOpportunities,
  fetchRiskOpportunitiesSummary,
  patchRiskOpportunity,
} from "../api/riskOpportunitiesApi";

const TYPE_OPTIONS = [
  { value: "risk", label: "Riesgo" },
  { value: "opportunity", label: "Oportunidad" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En progreso" },
  { value: "completed", label: "Completado" },
];

const LEVEL_OPTIONS = [
  { value: "low", label: "Bajo" },
  { value: "medium", label: "Medio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "CrÃ­tico" },
];

const INITIAL_FILTERS = {
  type: "",
  status: "",
  level: "",
};

function createEmptyForm() {
  return {
    name: "",
    description: "",
    item_type: "risk",
    probability: "3",
    impact: "3",
    action_plan: "",
    responsible_name: "",
    status: "pending",
    review_date: "",
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function mapTypeToBadge(type) {
  if (type === "risk") return "non_compliant";
  if (type === "opportunity") return "compliant";
  return "draft";
}

function mapTypeLabel(type) {
  if (type === "risk") return "Riesgo";
  if (type === "opportunity") return "Oportunidad";
  return "-";
}

function mapLevelToBadge(level) {
  if (level === "low") return "low";
  if (level === "medium") return "medium";
  if (level === "high") return "high";
  if (level === "critical") return "non_compliant";
  return "draft";
}

function mapLevelLabel(level) {
  if (level === "low") return "Bajo";
  if (level === "medium") return "Medio";
  if (level === "high") return "Alto";
  if (level === "critical") return "CrÃ­tico";
  return "-";
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function RiskOpportunitiesPage() {
  const [searchParams] = useSearchParams();
  const contextReportId = normalizeUuidOrNull(searchParams.get("report_id"));
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [editingId, setEditingId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const scoreDiff = Number(b.level_score || 0) - Number(a.level_score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }, [items]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [itemsData, summaryData] = await Promise.all([
        fetchRiskOpportunities(filters),
        fetchRiskOpportunitiesSummary(),
      ]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setSummary(summaryData && typeof summaryData === "object" ? summaryData : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function setFilterField(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function setFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm(createEmptyForm());
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      item_type: item.item_type || "risk",
      probability: String(item.probability ?? 3),
      impact: String(item.impact ?? 3),
      action_plan: item.action_plan || "",
      responsible_name: item.responsible_name || "",
      status: item.status || "pending",
      review_date: item.review_date || "",
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
    try {
      const payload = {
        name: form.name,
        description: normalizeNullableText(form.description),
        item_type: form.item_type,
        probability: form.probability,
        impact: form.impact,
        action_plan: form.action_plan,
        responsible_name: form.responsible_name,
        status: form.status,
        review_date: form.review_date,
      };
      if (editingId) {
        await patchRiskOpportunity(editingId, payload);
        setStatusMessage("Registro actualizado.");
      } else {
        await createRiskOpportunity(payload);
        setStatusMessage("Registro creado.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    if (deletingId) return;
    const confirmed = window.confirm("Se eliminara el registro seleccionado. Continuar?");
    if (!confirmed) return;
    setDeletingId(itemId);
    setError("");
    setStatusMessage("");
    try {
      await deleteRiskOpportunity(itemId);
      if (editingId === itemId) {
        resetForm();
      }
      setStatusMessage("Registro eliminado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el registro.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="ISO 9001"
        title="Riesgos y Oportunidades"
        description="GestiÃ³n estructurada de riesgos y oportunidades con nivel calculado automÃ¡ticamente."
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
          Vista contextual desde auditorÃ­a {contextReportId}. Revisa aquÃ­ riesgos abiertos y oportunidades ligadas al
          informe.
        </p>
      ) : null}

      {statusMessage ? <p className="status">{statusMessage}</p> : null}
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="status">Cargando riesgos y oportunidades...</p> : null}

      <SectionCard
        title="Resumen"
        description="Preparado para seguimiento del sistema y futuras revisiones por la direcciÃ³n."
      >
        <div className="inline-actions">
          <StatusBadge value="non_compliant" label={`CrÃ­ticos: ${summary?.critical_count ?? 0}`} />
          <StatusBadge value="high" label={`Altos: ${summary?.high_count ?? 0}`} />
          <StatusBadge value="pending" label={`Abiertos: ${summary?.open_items ?? 0}`} />
          <StatusBadge value="completed" label={`Completados: ${summary?.completed_items ?? 0}`} />
          <span className="soft-label">Riesgos: {summary?.risks_count ?? 0}</span>
          <span className="soft-label">Oportunidades: {summary?.opportunities_count ?? 0}</span>
          <span className="soft-label">Total: {summary?.total_items ?? 0}</span>
        </div>
      </SectionCard>

      <SectionCard title="Filtros" description="Filtra por tipo, estado y nivel calculado.">
        <div className="inline-actions">
          <label className="field-inline">
            <span>Tipo</span>
            <select
              className="input-select"
              value={filters.type}
              onChange={(event) => setFilterField("type", event.target.value)}
            >
              <option value="">Todos</option>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-inline">
            <span>Estado</span>
            <select
              className="input-select"
              value={filters.status}
              onChange={(event) => setFilterField("status", event.target.value)}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-inline">
            <span>Nivel</span>
            <select
              className="input-select"
              value={filters.level}
              onChange={(event) => setFilterField("level", event.target.value)}
            >
              <option value="">Todos</option>
              {LEVEL_OPTIONS.map((option) => (
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
          title={editingId ? "Editar registro" : "Nuevo registro"}
          description="Formulario de alta/ediciÃ³n con cÃ¡lculo automÃ¡tico del nivel."
          actions={
            editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm} disabled={saving}>
                Cancelar ediciÃ³n
              </button>
            ) : null
          }
        >
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="field-stack">
              <span>Nombre *</span>
              <input
                className="input-text"
                value={form.name}
                onChange={(event) => setFormField("name", event.target.value)}
                required
                disabled={saving}
              />
            </label>

            <label className="field-stack">
              <span>DescripciÃ³n</span>
              <RichTextarea
                className="input-textarea"
                value={form.description}
                onChange={(event) => setFormField("description", event.target.value)}
                disabled={saving}
              />
            </label>

            <div className="inline-actions">
              <label className="field-inline">
                <span>Tipo *</span>
                <select
                  className="input-select"
                  value={form.item_type}
                  onChange={(event) => setFormField("item_type", event.target.value)}
                  disabled={saving}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-inline">
                <span>Estado *</span>
                <select
                  className="input-select"
                  value={form.status}
                  onChange={(event) => setFormField("status", event.target.value)}
                  disabled={saving}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="inline-actions">
              <label className="field-inline">
                <span>Probabilidad (1-5) *</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  value={form.probability}
                  onChange={(event) => setFormField("probability", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Impacto (1-5) *</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  value={form.impact}
                  onChange={(event) => setFormField("impact", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Fecha revisiÃ³n *</span>
                <input
                  className="input-text"
                  type="date"
                  value={form.review_date}
                  onChange={(event) => setFormField("review_date", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
            </div>

            <label className="field-stack">
              <span>AcciÃ³n *</span>
              <RichTextarea
                className="input-textarea"
                value={form.action_plan}
                onChange={(event) => setFormField("action_plan", event.target.value)}
                required
                disabled={saving}
              />
            </label>

            <label className="field-stack">
              <span>Responsable *</span>
              <input
                className="input-text"
                value={form.responsible_name}
                onChange={(event) => setFormField("responsible_name", event.target.value)}
                required
                disabled={saving}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Actualizar registro" : "Crear registro"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Listado" description="Vista profesional de riesgos y oportunidades por criticidad.">
          {!loading && sortedItems.length === 0 ? (
            <p className="empty-state">No hay registros para los filtros seleccionados.</p>
          ) : (
            <div className="stack-list">
              {sortedItems.map((item) => (
                <article className="finding-item" key={item.id}>
                  <div className="finding-head">
                    <p className="finding-title">{item.name}</p>
                    <div className="finding-badges">
                      <StatusBadge value={mapTypeToBadge(item.item_type)} label={mapTypeLabel(item.item_type)} />
                      <StatusBadge value={mapLevelToBadge(item.level)} label={mapLevelLabel(item.level)} />
                      <StatusBadge value={item.status || "pending"} />
                    </div>
                  </div>
                  <p className="finding-meta">
                    Probabilidad: {item.probability} Â· Impacto: {item.impact} Â· Nivel: {item.level_score}
                  </p>
                  <p className="finding-meta">
                    Responsable: {item.responsible_name || "-"} Â· RevisiÃ³n: {formatDate(item.review_date)}
                  </p>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={saving || deletingId === item.id}
                      onClick={() => startEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={saving || deletingId === item.id}
                      onClick={() => handleDelete(item.id)}
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

export default RiskOpportunitiesPage;



