import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RichTextarea from "../components/RichTextarea";
import RichTextContent from "../components/RichTextContent";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { normalizeUuidOrNull } from "../utils/uuid";
import {
  createManagementReview,
  deleteManagementReview,
  fetchManagementReviewDetail,
  fetchManagementReviews,
  fetchManagementReviewSummary,
  patchManagementReview,
} from "../api/managementReviewsApi";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En progreso" },
  { value: "completed", label: "Completada" },
];

const REFERENCE_TYPE_OPTIONS = [
  { value: "audit_report", label: "Auditoria" },
  { value: "kpi_indicator", label: "Indicador KPI" },
  { value: "non_conformity", label: "No conformidad" },
  { value: "improvement_opportunity", label: "Oportunidad de mejora" },
  { value: "risk_opportunity", label: "Riesgo u oportunidad" },
  { value: "customer_feedback", label: "Satisfacción cliente" },
  { value: "supplier", label: "Proveedor" },
];

const INITIAL_FILTERS = {
  status: "",
  review_date_from: "",
  review_date_to: "",
};

function createEmptyReference() {
  return {
    reference_type: "audit_report",
    source_id: "",
    source_label: "",
  };
}

function createEmptyForm() {
  return {
    review_date: "",
    reviewed_period: "",
    summary: "",
    conclusions: "",
    decisions: "",
    derived_actions: "",
    responsible_name: "",
    followup_status: "pending",
    followup_notes: "",
    references: [],
  };
}

function createEmptyFormWithAuditReference(reportId) {
  const base = createEmptyForm();
  if (!reportId) return base;
  return {
    ...base,
    references: [
      {
        reference_type: "audit_report",
        source_id: reportId,
        source_label: "",
      },
    ],
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function mapReferenceTypeLabel(type) {
  if (type === "audit_report") return "Auditoria";
  if (type === "kpi_indicator") return "Indicador KPI";
  if (type === "non_conformity") return "No conformidad";
  if (type === "improvement_opportunity") return "Oportunidad de mejora";
  if (type === "risk_opportunity") return "Riesgo/Oportunidad";
  if (type === "customer_feedback") return "Satisfacción cliente";
  if (type === "supplier") return "Proveedor";
  return type || "-";
}

function ManagementReviewsPage() {
  const [searchParams] = useSearchParams();
  const contextReportId = normalizeUuidOrNull(searchParams.get("report_id"));
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [form, setForm] = useState(() => createEmptyFormWithAuditReference(contextReportId));
  const [editingId, setEditingId] = useState("");

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const selectedListItem = useMemo(
    () => reviews.find((item) => item.id === selectedReviewId) || null,
    [reviews, selectedReviewId]
  );

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError("");
    try {
      const [reviewsData, summaryData] = await Promise.all([
        fetchManagementReviews(filters),
        fetchManagementReviewSummary(),
      ]);
      const safeReviews = Array.isArray(reviewsData) ? reviewsData : [];
      setReviews(safeReviews);
      setSummary(summaryData && typeof summaryData === "object" ? summaryData : null);
      setSelectedReviewId((prev) => {
        if (prev && safeReviews.some((item) => item.id === prev)) return prev;
        return safeReviews[0].id || "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las revisiones.");
      setReviews([]);
      setSummary(null);
      setSelectedReviewId("");
      setSelectedDetail(null);
    } finally {
      setLoadingList(false);
    }
  }, [filters]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback(async () => {
    if (!selectedReviewId) {
      setSelectedDetail(null);
      return;
    }
    setLoadingDetail(true);
    setError("");
    try {
      const detail = await fetchManagementReviewDetail(selectedReviewId);
      setSelectedDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el detalle de la revisión.");
      setSelectedDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedReviewId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!contextReportId || editingId) return;
    setForm((prev) => {
      const references = Array.isArray(prev.references) ? prev.references : [];
      const alreadyLinked = references.some(
        (item) => item.reference_type === "audit_report" && item.source_id === contextReportId
      );
      if (alreadyLinked) return prev;
      if (references.length > 0) return prev;
      return createEmptyFormWithAuditReference(contextReportId);
    });
  }, [contextReportId, editingId]);

  function setFilterField(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function setFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm(createEmptyFormWithAuditReference(contextReportId));
  }

  function startNewReview() {
    resetForm();
    setStatusMessage("");
    setError("");
  }

  function startEditFromDetail() {
    const review = selectedDetail.review;
    if (!review) return;
    setEditingId(review.id);
    setForm({
      review_date: review.review_date || "",
      reviewed_period: review.reviewed_period || "",
      summary: review.summary || "",
      conclusions: review.conclusions || "",
      decisions: review.decisions || "",
      derived_actions: review.derived_actions || "",
      responsible_name: review.responsible_name || "",
      followup_status: review.followup_status || "pending",
      followup_notes: review.followup_notes || "",
      references: (selectedDetail.references || []).map((ref) => ({
        reference_type: ref.reference_type || "audit_report",
        source_id: ref.source_id || "",
        source_label: ref.source_label || "",
      })),
    });
    setStatusMessage("");
    setError("");
  }

  function addReference() {
    setForm((prev) => ({
      ...prev,
      references: [...(Array.isArray(prev.references) ? prev.references : []), createEmptyReference()],
    }));
  }

  function removeReference(index) {
    setForm((prev) => ({
      ...prev,
      references: (Array.isArray(prev.references) ? prev.references : []).filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  }

  function updateReference(index, patch) {
    setForm((prev) => ({
      ...prev,
      references: (Array.isArray(prev.references) ? prev.references : []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");

    try {
      const payload = {
        review_date: form.review_date,
        reviewed_period: form.reviewed_period,
        summary: form.summary,
        conclusions: form.conclusions,
        decisions: form.decisions,
        derived_actions: form.derived_actions,
        responsible_name: form.responsible_name,
        followup_status: form.followup_status,
        followup_notes: normalizeNullableText(form.followup_notes),
        references: (Array.isArray(form.references) ? form.references : []).map((ref) => ({
          reference_type: ref.reference_type,
          source_id: ref.source_id,
          source_label: normalizeNullableText(ref.source_label),
        })),
      };

      let response;
      if (editingId) {
        response = await patchManagementReview(editingId, payload);
        setStatusMessage("Revisión actualizada.");
      } else {
        response = await createManagementReview(payload);
        setStatusMessage("Revisión creada.");
      }

      const nextId = response.review.id || editingId || "";
      resetForm();
      await loadList();
      if (nextId) setSelectedReviewId(nextId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la revisión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reviewId) {
    if (!reviewId || deletingId) return;
    const confirmed = window.confirm("Se eliminara la revisión seleccionada. Continuar");
    if (!confirmed) return;

    setDeletingId(reviewId);
    setStatusMessage("");
    setError("");
    try {
      await deleteManagementReview(reviewId);
      if (editingId === reviewId) {
        resetForm();
      }
      setStatusMessage("Revisión eliminada.");
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la revisión.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="ISO 9001"
        title="Revisión por la Dirección"
        description="Registro formal de revisiones, decisiones y seguimiento directivo."
        actions={
          <>
            <button type="button" className="btn-primary" onClick={startNewReview} disabled={saving}>
              Nueva revisión
            </button>
            {contextReportId ? (
              <Link className="btn-ghost link-btn" to={`/auditorias/${contextReportId}/editar`}>
                Volver a auditoría
              </Link>
            ) : null}
          </>
        }
      />
      {contextReportId ? (
        <p className="status">
          Modo contextual desde auditoría {contextReportId}. El formulario precarga la referencia al informe.
        </p>
      ) : null}
{statusMessage ? <p className="status">{statusMessage}</p> : null}
{error ? <p className="status error">{error}</p> : null}
{loadingList ? <p className="status">Cargando revisiones...</p> : null}

      <SectionCard title="Resumen ejecutivo" description="Estado global del seguimiento de revisiones.">
        <div className="inline-actions">
          <StatusBadge value="pending" label={`Pendientes: ${summary.pending_reviews ?? 0}`} />
          <StatusBadge value="in_progress" label={`En progreso: ${summary.in_progress_reviews ?? 0}`} />
          <StatusBadge value="completed" label={`Completadas: ${summary.completed_reviews ?? 0}`} />
          <span className="soft-label">Total: {summary.total_reviews ?? 0}</span>
          <span className="soft-label">Última: {formatDate(summary.latest_review_date)}</span>
        </div>
      </SectionCard>

      <SectionCard title="Filtros" description="Filtra el historial por estado y fecha de revisión.">
        <div className="inline-actions">
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
            <span>Fecha desde</span>
            <input
              className="input-text"
              type="date"
              value={filters.review_date_from}
              onChange={(event) => setFilterField("review_date_from", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Fecha hasta</span>
            <input
              className="input-text"
              type="date"
              value={filters.review_date_to}
              onChange={(event) => setFilterField("review_date_to", event.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => setFilters(INITIAL_FILTERS)}
            disabled={loadingList}
          >
            Limpiar
          </button>
        </div>
      </SectionCard>

      <div className="layout-grid two-columns">
        <SectionCard title="Listado de revisiones" description="Histórico de revisiones por la dirección.">
          {!loadingList && reviews.length === 0 ? (
            <p className="empty-state">No hay revisiones registradas con los filtros actuales.</p>
          ) : (
            <div className="stack-list">
              {reviews.map((review) => (
                <article className="diagnostic-list-item" key={review.id}>
                  <div className="diagnostic-list-main">
                    <p className="diagnostic-list-id">{review.reviewed_period || "-"}</p>
                    <div className="diagnostic-list-meta">
                      <StatusBadge value={review.followup_status || "pending"} />
                      <span>Fecha: {formatDate(review.review_date)}</span>
                      <span>Responsable: {review.responsible_name || "-"}</span>
                      <span>Auditorias: {review.linked_audit_reports_count || 0}</span>
                      <span>KPIs: {review.linked_kpis_count || 0}</span>
                      <span>No conformidades: {review.linked_nonconformities_count || 0}</span>
                      <span>Mejoras: {review.linked_improvement_opportunities_count || 0}</span>
                      <span>Riesgos: {review.linked_risks_count || 0}</span>
                      <span>Satisfacción: {review.linked_customer_feedback_count || 0}</span>
                      <span>Proveedores: {review.linked_suppliers_count || 0}</span>
                    </div>
                  </div>
                  <div className="diagnostic-list-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedReviewId(review.id)}
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleDelete(review.id)}
                      disabled={deletingId === review.id || saving}
                    >
                      {deletingId === review.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="stack-list">
          <SectionCard
            title="Detalle de revisión"
            description="Conclusiones, decisiones y referencias integradas del registro seleccionado."
            actions={
              <button
                type="button"
                className="btn-secondary"
                onClick={startEditFromDetail}
                disabled={!selectedDetail.review || saving}
              >
                Editar
              </button>
            }
          >
            {loadingDetail ? (
              <p className="status">Cargando detalle...</p>
            ) : !selectedDetail.review ? (
              <p className="empty-state">Selecciona una revisión para ver su detalle.</p>
            ) : (
              <div className="stack-list">
                <div className="inline-actions">
                  <StatusBadge value={selectedDetail.review.followup_status || "pending"} />
                  <span className="soft-label">Fecha: {formatDate(selectedDetail.review.review_date)}</span>
                  <span className="soft-label">
                    Responsable: {selectedDetail.review.responsible_name || "-"}
                  </span>
                </div>
                <ul className="kv-list">
                  <li>
                    <span>Periodo revisado</span>
                    <strong>{selectedDetail.review.reviewed_period || "-"}</strong>
                  </li>
                  <li>
                    <span>Auditorias enlazadas</span>
                    <strong>{selectedDetail.linked_audit_reports_count || 0}</strong>
                  </li>
                  <li>
                    <span>KPIs enlazados</span>
                    <strong>{selectedDetail.linked_kpis_count || 0}</strong>
                  </li>
                  <li>
                    <span>No conformidades enlazadas</span>
                    <strong>{selectedDetail.linked_nonconformities_count || 0}</strong>
                  </li>
                  <li>
                    <span>Oportunidades enlazadas</span>
                    <strong>{selectedDetail.linked_improvement_opportunities_count || 0}</strong>
                  </li>
                  <li>
                    <span>Riesgos enlazados</span>
                    <strong>{selectedDetail.linked_risks_count || 0}</strong>
                  </li>
                  <li>
                    <span>Satisfacción cliente enlazada</span>
                    <strong>{selectedDetail.linked_customer_feedback_count || 0}</strong>
                  </li>
                  <li>
                    <span>Proveedores enlazados</span>
                    <strong>{selectedDetail.linked_suppliers_count || 0}</strong>
                  </li>
                </ul>
                <article className="finding-item">
                  <p className="finding-title">Resumen</p>
                  <RichTextContent value={selectedDetail.review.summary} />
                </article>
                <article className="finding-item">
                  <p className="finding-title">Conclusiones</p>
                  <RichTextContent value={selectedDetail.review.conclusions} />
                </article>
                <article className="finding-item">
                  <p className="finding-title">Decisiones</p>
                  <RichTextContent value={selectedDetail.review.decisions} />
                </article>
                <article className="finding-item">
                  <p className="finding-title">Acciónes derivadas</p>
                  <RichTextContent value={selectedDetail.review.derived_actions} />
                </article>
                <article className="finding-item">
                  <p className="finding-title">Seguimiento</p>
                  <RichTextContent
                    value={selectedDetail.review.followup_notes}
                    emptyLabel="Sin notas de seguimiento."
                  />
                </article>

                <div className="stack-list">
                  <p className="soft-label">Referencias vinculadas</p>
                  {(selectedDetail.references || []).length === 0 ? (
                    <p className="empty-state">Sin referencias vinculadas.</p>
                  ) : (
                    (selectedDetail.references || []).map((ref) => (
                      <article className="finding-item" key={ref.id}>
                        <div className="finding-head">
                          <p className="finding-title">{mapReferenceTypeLabel(ref.reference_type)}</p>
                          <small className="soft-label">{ref.source_id}</small>
                        </div>
                        <p className="finding-meta">{ref.source_label || "Sin etiqueta"}</p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title={editingId ? "Editar revisión" : "Nueva revisión"}
            description="Formulario estructurado para registro formal de revisión por la dirección."
            actions={editingId ? (
                <button type="button" className="btn-ghost" onClick={resetForm} disabled={saving}>
                  Cancelar edición
                </button>
              ) : null
            }
          >
            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="inline-actions">
                <label className="field-inline">
                  <span>Fecha *</span>
                  <input
                    className="input-text"
                    type="date"
                    value={form.review_date}
                    onChange={(event) => setFormField("review_date", event.target.value)}
                    required
                    disabled={saving}
                  />
                </label>

                <label className="field-inline">
                  <span>Estado *</span>
                  <select
                    className="input-select"
                    value={form.followup_status}
                    onChange={(event) => setFormField("followup_status", event.target.value)}
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

              <label className="field-stack">
                <span>Periodo revisado *</span>
                <input
                  className="input-text"
                  value={form.reviewed_period}
                  onChange={(event) => setFormField("reviewed_period", event.target.value)}
                  placeholder="Ej. 2026 Q1"
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

              <label className="field-stack">
                <span>Resumen *</span>
                <RichTextarea
                  className="input-textarea"
                  value={form.summary}
                  onChange={(event) => setFormField("summary", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-stack">
                <span>Conclusiones *</span>
                <RichTextarea
                  className="input-textarea"
                  value={form.conclusions}
                  onChange={(event) => setFormField("conclusions", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-stack">
                <span>Decisiones *</span>
                <RichTextarea
                  className="input-textarea"
                  value={form.decisions}
                  onChange={(event) => setFormField("decisions", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-stack">
                <span>Acciónes derivadas *</span>
                <RichTextarea
                  className="input-textarea"
                  value={form.derived_actions}
                  onChange={(event) => setFormField("derived_actions", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-stack">
                <span>Notas de seguimiento</span>
                <RichTextarea
                  className="input-textarea"
                  value={form.followup_notes}
                  onChange={(event) => setFormField("followup_notes", event.target.value)}
                  disabled={saving}
                />
              </label>

              <div className="stack-list">
                <div className="inline-actions">
                  <span className="soft-label">Referencias vinculadas</span>
                  <button type="button" className="btn-ghost" onClick={addReference} disabled={saving}>
                    Añadir referencia
                  </button>
                </div>

                {(Array.isArray(form.references) ? form.references : []).length === 0 ? (
                  <p className="empty-state">Sin referencias en este formulario.</p>
                ) : (
                  (Array.isArray(form.references) ? form.references : []).map((ref, index) => (
                    <article className="finding-item" key={`${index}-${ref.source_id || "new"}`}>
                      <div className="form-grid">
                        <label className="field-stack">
                          <span>Tipo</span>
                          <select
                            className="input-select"
                            value={ref.reference_type}
                            onChange={(event) =>
                              updateReference(index, { reference_type: event.target.value })
                            }
                            disabled={saving}
                          >
                            {REFERENCE_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field-stack">
                          <span>ID origen (UUID)</span>
                          <input
                            className="input-text"
                            value={ref.source_id} onChange={(event) => updateReference(index, { source_id : event.target.value })}
                            disabled={saving}
                          />
                        </label>

                        <label className="field-stack">
                          <span>Etiqueta opcional</span>
                          <input
                            className="input-text"
                            value={ref.source_label}
                            onChange={(event) =>
                              updateReference(index, { source_label: event.target.value })
                            }
                            disabled={saving}
                          />
                        </label>
                      </div>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => removeReference(index)}
                          disabled={saving}
                        >
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Guardando..." : editingId ? "Actualizar revisión" : "Crear revisión"}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      </div>

      {selectedListItem && !selectedDetail ? (
        <p className="soft-label">No se pudo cargar el detalle de la revisión seleccionada.</p>
      ) : null}
    </section>
  );
}

export default ManagementReviewsPage;






