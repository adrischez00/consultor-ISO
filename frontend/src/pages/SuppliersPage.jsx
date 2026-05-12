import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { normalizeUuidOrNull } from "../utils/uuid";
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  fetchSuppliersSummary,
  patchSupplier,
} from "../api/suppliersApi";

const RATING_OPTIONS = [
  { value: "excellent", label: "Excelente" },
  { value: "approved", label: "Aprobado" },
  { value: "conditional", label: "Condicional" },
  { value: "critical", label: "Critico" },
];

const ORDER_BY_OPTIONS = [
  { value: "evaluation_date", label: "Fecha evaluacion" },
  { value: "global_score", label: "Puntuacion global" },
  { value: "name", label: "Nombre" },
  { value: "incidents_count", label: "Incidencias" },
  { value: "created_at", label: "Fecha alta" },
];

const ORDER_DIR_OPTIONS = [
  { value: "desc", label: "Desc" },
  { value: "asc", label: "Asc" },
];

const INITIAL_FILTERS = {
  service_category: "",
  rating: "",
  evaluation_date_from: "",
  evaluation_date_to: "",
  score_min: "",
  score_max: "",
  order_by: "evaluation_date",
  order_dir: "desc",
};

function createEmptyForm() {
  return {
    name: "",
    service_category: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    quality_score: "4",
    delivery_score: "4",
    incidents_score: "4",
    certifications_score: "4",
    additional_score: "",
    incidents_count: "0",
    evaluation_date: "",
    evaluation_notes: "",
  };
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatScore(value) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return "-";
  return asNumber.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mapRatingToBadge(rating) {
  if (rating === "excellent" || rating === "approved") return "compliant";
  if (rating === "conditional") return "partial";
  if (rating === "critical") return "non_compliant";
  return "draft";
}

function ratingLabel(rating) {
  if (rating === "excellent") return "Excelente";
  if (rating === "approved") return "Aprobado";
  if (rating === "conditional") return "Condicional";
  if (rating === "critical") return "Critico";
  return "-";
}

function SuppliersPage() {
  const [searchParams] = useSearchParams();
  const contextReportId = normalizeUuidOrNull(searchParams.get("report_id"));
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [suppliers, setSuppliers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [editingId, setEditingId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [suppliersData, summaryData] = await Promise.all([
        fetchSuppliers(filters),
        fetchSuppliersSummary(),
      ]);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      setSummary(summaryData && typeof summaryData === "object" ? summaryData : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los proveedores.");
      setSuppliers([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const averageScoreLabel = useMemo(() => {
    const value = Number(summary?.average_global_score);
    if (!Number.isFinite(value)) return "-";
    return value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [summary]);

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
      service_category: item.service_category || "",
      contact_name: item.contact_name || "",
      contact_email: item.contact_email || "",
      contact_phone: item.contact_phone || "",
      quality_score: String(item.quality_score ?? 4),
      delivery_score: String(item.delivery_score ?? 4),
      incidents_score: String(item.incidents_score ?? 4),
      certifications_score: String(item.certifications_score ?? 4),
      additional_score: item.additional_score == null ? "" : String(item.additional_score),
      incidents_count: String(item.incidents_count ?? 0),
      evaluation_date: item.evaluation_date || "",
      evaluation_notes: item.evaluation_notes || "",
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
      name: form.name,
      service_category: form.service_category,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      quality_score: form.quality_score,
      delivery_score: form.delivery_score,
      incidents_score: form.incidents_score,
      certifications_score: form.certifications_score,
      additional_score: form.additional_score,
      incidents_count: form.incidents_count,
      evaluation_date: form.evaluation_date,
      evaluation_notes: form.evaluation_notes,
    };

    try {
      if (editingId) {
        await patchSupplier(editingId, payload);
        setStatusMessage("Proveedor actualizado.");
      } else {
        await createSupplier(payload);
        setStatusMessage("Proveedor creado.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supplierId) {
    if (!supplierId || deletingId) return;
    const confirmed = window.confirm("Se eliminara el proveedor seleccionado. Continuar?");
    if (!confirmed) return;

    setDeletingId(supplierId);
    setError("");
    setStatusMessage("");
    try {
      await deleteSupplier(supplierId);
      if (editingId === supplierId) {
        resetForm();
      }
      setStatusMessage("Proveedor eliminado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el proveedor.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="ISO 9001"
        title="Proveedores"
        description="Gestion profesional de proveedores y evaluacion por criterios para seguimiento operativo."
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
          Vista contextual desde auditoría {contextReportId}. Revisa la evaluación de proveedores como evidencia de
          operación y control externo.
        </p>
      ) : null}

      {statusMessage ? <p className="status">{statusMessage}</p> : null}
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="status">Cargando proveedores...</p> : null}

      <SectionCard title="Resumen de evaluacion" description="Puntuacion media y distribucion por valoracion final.">
        <div className="inline-actions">
          <StatusBadge value="compliant" label={`Excelente: ${summary?.excellent_count ?? 0}`} />
          <StatusBadge value="compliant" label={`Aprobado: ${summary?.approved_count ?? 0}`} />
          <StatusBadge value="partial" label={`Condicional: ${summary?.conditional_count ?? 0}`} />
          <StatusBadge value="non_compliant" label={`Critico: ${summary?.critical_count ?? 0}`} />
          <span className="soft-label">Media: {averageScoreLabel} / 5</span>
          <span className="soft-label">Total: {summary?.total_suppliers ?? 0}</span>
          <span className="soft-label">Ultima evaluacion: {formatDate(summary?.latest_evaluation_date)}</span>
        </div>
      </SectionCard>

      <SectionCard title="Filtros y orden" description="Filtra y ordena por categoria, valoracion, fecha y puntuacion.">
        <div className="inline-actions">
          <label className="field-inline">
            <span>Categoria</span>
            <input
              className="input-text"
              value={filters.service_category}
              onChange={(event) => setFilterField("service_category", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Valoracion</span>
            <select
              className="input-select"
              value={filters.rating}
              onChange={(event) => setFilterField("rating", event.target.value)}
            >
              <option value="">Todas</option>
              {RATING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-inline">
            <span>Fecha desde</span>
            <input
              className="input-text"
              type="date"
              value={filters.evaluation_date_from}
              onChange={(event) => setFilterField("evaluation_date_from", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Fecha hasta</span>
            <input
              className="input-text"
              type="date"
              value={filters.evaluation_date_to}
              onChange={(event) => setFilterField("evaluation_date_to", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Score min</span>
            <input
              className="input-text"
              type="number"
              min="1"
              max="5"
              step="0.01"
              value={filters.score_min}
              onChange={(event) => setFilterField("score_min", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Score max</span>
            <input
              className="input-text"
              type="number"
              min="1"
              max="5"
              step="0.01"
              value={filters.score_max}
              onChange={(event) => setFilterField("score_max", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Ordenar por</span>
            <select
              className="input-select"
              value={filters.order_by}
              onChange={(event) => setFilterField("order_by", event.target.value)}
            >
              {ORDER_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-inline">
            <span>Direccion</span>
            <select
              className="input-select"
              value={filters.order_dir}
              onChange={(event) => setFilterField("order_dir", event.target.value)}
            >
              {ORDER_DIR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="btn-ghost" onClick={() => setFilters(INITIAL_FILTERS)} disabled={loading}>
            Limpiar
          </button>
        </div>
      </SectionCard>

      <div className="layout-grid two-columns">
        <SectionCard
          title={editingId ? "Editar proveedor" : "Nuevo proveedor"}
          description="Datos base y evaluacion por criterios (calidad, plazo, incidencias, certificaciones)."
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
              <span>Servicio / Categoria *</span>
              <input
                className="input-text"
                value={form.service_category}
                onChange={(event) => setFormField("service_category", event.target.value)}
                required
                disabled={saving}
              />
            </label>

            <div className="inline-actions">
              <label className="field-inline">
                <span>Contacto</span>
                <input
                  className="input-text"
                  value={form.contact_name}
                  onChange={(event) => setFormField("contact_name", event.target.value)}
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Email</span>
                <input
                  className="input-text"
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => setFormField("contact_email", event.target.value)}
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Telefono</span>
                <input
                  className="input-text"
                  value={form.contact_phone}
                  onChange={(event) => setFormField("contact_phone", event.target.value)}
                  disabled={saving}
                />
              </label>
            </div>

            <div className="inline-actions">
              <label className="field-inline">
                <span>Calidad (1-5) *</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  value={form.quality_score}
                  onChange={(event) => setFormField("quality_score", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-inline">
                <span>Plazo (1-5) *</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  value={form.delivery_score}
                  onChange={(event) => setFormField("delivery_score", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-inline">
                <span>Incidencias (1-5) *</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  value={form.incidents_score}
                  onChange={(event) => setFormField("incidents_score", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-inline">
                <span>Certificaciones (1-5) *</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  value={form.certifications_score}
                  onChange={(event) => setFormField("certifications_score", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-inline">
                <span>Otro criterio (1-5)</span>
                <input
                  className="input-text"
                  type="number"
                  min="1"
                  max="5"
                  value={form.additional_score}
                  onChange={(event) => setFormField("additional_score", event.target.value)}
                  disabled={saving}
                />
              </label>
            </div>

            <div className="inline-actions">
              <label className="field-inline">
                <span>N. incidencias *</span>
                <input
                  className="input-text"
                  type="number"
                  min="0"
                  step="1"
                  value={form.incidents_count}
                  onChange={(event) => setFormField("incidents_count", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-inline">
                <span>Fecha evaluacion *</span>
                <input
                  className="input-text"
                  type="date"
                  value={form.evaluation_date}
                  onChange={(event) => setFormField("evaluation_date", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
            </div>

            <label className="field-stack">
              <span>Notas de evaluacion</span>
              <textarea
                className="input-textarea"
                value={form.evaluation_notes}
                onChange={(event) => setFormField("evaluation_notes", event.target.value)}
                disabled={saving}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Actualizar proveedor" : "Crear proveedor"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Listado de proveedores" description="Seguimiento por puntuacion global, incidencias y valoracion final.">
          {!loading && suppliers.length === 0 ? (
            <p className="empty-state">No hay proveedores con los filtros seleccionados.</p>
          ) : (
            <div className="stack-list">
              {suppliers.map((supplier) => (
                <article className="finding-item" key={supplier.id}>
                  <div className="finding-head">
                    <p className="finding-title">{supplier.name}</p>
                    <div className="finding-badges">
                      <StatusBadge
                        value={mapRatingToBadge(supplier.final_rating)}
                        label={ratingLabel(supplier.final_rating)}
                      />
                    </div>
                  </div>
                  <p className="finding-meta">
                    Categoria: {supplier.service_category || "-"} · Score global: {formatScore(supplier.global_score)} / 5
                  </p>
                  <p className="finding-meta">
                    Evaluacion: {formatDate(supplier.evaluation_date)} · Incidencias: {supplier.incidents_count}
                  </p>
                  <p className="finding-meta">
                    Contacto: {supplier.contact_name || "-"} · {supplier.contact_email || "-"} · {supplier.contact_phone || "-"}
                  </p>
                  {supplier.evaluation_notes ? <p>{supplier.evaluation_notes}</p> : null}
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => startEdit(supplier)}
                      disabled={saving || deletingId === supplier.id}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleDelete(supplier.id)}
                      disabled={saving || deletingId === supplier.id}
                    >
                      {deletingId === supplier.id ? "Eliminando..." : "Eliminar"}
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

export default SuppliersPage;
