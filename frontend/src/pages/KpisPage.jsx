import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RichTextarea from "../components/RichTextarea";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { normalizeUuidOrNull } from "../utils/uuid";
import { createKpi, deleteKpi, fetchKpis, patchKpi } from "../api/kpisApi";

const INITIAL_FILTERS = {
  status: "",
  start_date_from: "",
  start_date_to: "",
  end_date_from: "",
  end_date_to: "",
};

const INITIAL_FORM = {
  name: "",
  description: "",
  target_value: "",
  current_value: "",
  unit: "",
  start_date: "",
  end_date: "",
  period_label: "",
  responsible_name: "",
};

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNumber(value, fractionDigits = 2) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return "-";
  return asNumber.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

function mapStatusToBadge(status) {
  if (status === "ok") return "compliant";
  if (status === "alerta") return "partial";
  if (status === "critico") return "non_compliant";
  return "draft";
}

function statusLabel(status) {
  if (status === "ok") return "OK";
  if (status === "alerta") return "ALERTA";
  if (status === "critico") return "CRÍTICO";
  return String(status || "-").toUpperCase();
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function KpisPage() {
  const [searchParams] = useSearchParams();
  const contextReportId = normalizeUuidOrNull(searchParams.get("report_id"));
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);

  const summary = useMemo(() => {
    const counts = { ok: 0, alerta: 0, critico: 0 };
    kpis.forEach((item) => {
      if (item.status === "ok") counts.ok += 1;
      else if (item.status === "alerta") counts.alerta += 1;
      else if (item.status === "critico") counts.critico += 1;
    });
    return counts;
  }, [kpis]);

  const loadKpis = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchKpis(filters);
      setKpis(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los indicadores.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  function setFilterField(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function setFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEditing(kpi) {
    setEditingId(kpi.id);
    setForm({
      name: kpi.name || "",
      description: kpi.description || "",
      target_value: String(kpi.target_value ?? ""),
      current_value: String(kpi.current_value ?? ""),
      unit: kpi.unit || "",
      start_date: kpi.start_date || "",
      end_date: kpi.end_date || "",
      period_label: kpi.period_label || "",
      responsible_name: kpi.responsible_name || "",
    });
    setError("");
    setStatusMessage("");
  }

  function resetForm() {
    setEditingId("");
    setForm(INITIAL_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setStatusMessage("");

    const payload = {
      name: form.name,
      description: normalizeNullableText(form.description),
      target_value: form.target_value,
      current_value: form.current_value,
      unit: form.unit,
      start_date: form.start_date,
      end_date: form.end_date,
      period_label: normalizeNullableText(form.period_label),
      responsible_name: form.responsible_name,
    };

    try {
      if (editingId) {
        await patchKpi(editingId, payload);
        setStatusMessage("Indicador actualizado.");
      } else {
        await createKpi(payload);
        setStatusMessage("Indicador creado.");
      }
      resetForm();
      await loadKpis();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el indicador.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(kpiId) {
    if (deletingId) return;
    const confirmed = window.confirm("Se eliminara el indicador seleccionado. Continuar");
    if (!confirmed) return;

    setDeletingId(kpiId);
    setError("");
    setStatusMessage("");
    try {
      await deleteKpi(kpiId);
      if (editingId === kpiId) {
        resetForm();
      }
      setStatusMessage("Indicador eliminado.");
      await loadKpis();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el indicador.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="Seguimiento"
        title="Indicadores KPI"
        description="Gestión de indicadores con estado calculado automáticamente para seguimiento del sistema."
        actions={contextReportId ? (
            <Link className="btn-ghost link-btn" to={`/auditorias/${contextReportId}/editar`}>
              Volver a auditoría
            </Link>
          ) : null
        }
      />
      {contextReportId ? (
        <p className="status">
          Vista contextual desde auditoría {contextReportId}. Usa este bloque como evidencia de desempeño y objetivos.
        </p>
      ) : null}
{statusMessage ? <p className="status">{statusMessage}</p> : null}
{error ? <p className="status error">{error}</p> : null}
{loading ? <p className="status">Cargando indicadores...</p> : null}

      <SectionCard title="Resumen KPI" description="Preparado para dashboard con estado global de indicadores.">
        <div className="inline-actions">
          <StatusBadge value="compliant" label={`OK: ${summary.ok}`} />
          <StatusBadge value="partial" label={`ALERTA: ${summary.alerta}`} />
          <StatusBadge value="non_compliant" label={`CRÍTICO: ${summary.critico}`} />
          <span className="soft-label">Total: {kpis.length}</span>
        </div>
      </SectionCard>

      <SectionCard title="Filtros" description="Filtra por estado y rango de fechas.">
        <div className="inline-actions">
          <label className="field-inline">
            <span>Estado</span>
            <select
              className="input-select"
              value={filters.status}
              onChange={(event) => setFilterField("status", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="ok">OK</option>
              <option value="alerta">ALERTA</option>
              <option value="critico">CRÍTICO</option>
            </select>
          </label>

          <label className="field-inline">
            <span>Inicio desde</span>
            <input
              className="input-text"
              type="date"
              value={filters.start_date_from}
              onChange={(event) => setFilterField("start_date_from", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Inicio hasta</span>
            <input
              className="input-text"
              type="date"
              value={filters.start_date_to}
              onChange={(event) => setFilterField("start_date_to", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Fin desde</span>
            <input
              className="input-text"
              type="date"
              value={filters.end_date_from}
              onChange={(event) => setFilterField("end_date_from", event.target.value)}
            />
          </label>

          <label className="field-inline">
            <span>Fin hasta</span>
            <input
              className="input-text"
              type="date"
              value={filters.end_date_to}
              onChange={(event) => setFilterField("end_date_to", event.target.value)}
            />
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
        <SectionCard title={editingId ? "Editar indicador" : "Nuevo indicador"}
          description="Alta y edición de indicadores con cálculo automatico de estado."
          actions={editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm} disabled={saving}>
                Cancelar edición
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
              <span>Responsable *</span>
              <input
                className="input-text"
                value={form.responsible_name}
                onChange={(event) => setFormField("responsible_name", event.target.value)}
                required
                disabled={saving}
              />
            </label>

            <div className="inline-actions">
              <label className="field-inline">
                <span>Objetivo *</span>
                <input
                  className="input-text"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.target_value}
                  onChange={(event) => setFormField("target_value", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Valor actual *</span>
                <input
                  className="input-text"
                  type="number"
                  step="0.01"
                  value={form.current_value}
                  onChange={(event) => setFormField("current_value", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Unidad *</span>
                <input
                  className="input-text"
                  value={form.unit}
                  onChange={(event) => setFormField("unit", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>
            </div>

            <div className="inline-actions">
              <label className="field-inline">
                <span>Fecha inicio *</span>
                <input
                  className="input-text"
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setFormField("start_date", event.target.value)}
                  required
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Fecha fin</span>
                <input
                  className="input-text"
                  type="date"
                  value={form.end_date}
                  onChange={(event) => setFormField("end_date", event.target.value)}
                  disabled={saving}
                />
              </label>

              <label className="field-inline">
                <span>Periodo</span>
                <input
                  className="input-text"
                  value={form.period_label}
                  onChange={(event) => setFormField("period_label", event.target.value)}
                  placeholder="Ej. Q1 2026"
                  disabled={saving}
                />
              </label>
            </div>

            <label className="field-stack">
              <span>Descripcion</span>
              <RichTextarea
                className="input-textarea"
                value={form.description}
                onChange={(event) => setFormField("description", event.target.value)}
                disabled={saving}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Actualizar indicador" : "Crear indicador"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Listado de indicadores" description="Estado calculado y cumplimiento del objetivo.">
          {!loading && kpis.length === 0 ? (
            <p className="empty-state">No hay indicadores registrados con los filtros actuales.</p>
          ) : (
            <div className="stack-list">
              {kpis.map((kpi) => {
                const targetValue = Number(kpi.target_value);
                const currentValue = Number(kpi.current_value);
                const achievement =
                  Number.isFinite(targetValue) && targetValue > 0 && Number.isFinite(currentValue) ? (currentValue / targetValue) * 100 : 0;
                return (
                  <article className="diagnostic-list-item" key={kpi.id}>
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{kpi.name}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge
                          value={mapStatusToBadge(kpi.status)}
                          label={statusLabel(kpi.status)}
                        />
                        <span>
                          Objetivo: {formatNumber(kpi.target_value)} {kpi.unit}
                        </span>
                        <span>
                          Actual: {formatNumber(kpi.current_value)} {kpi.unit}
                        </span>
                        <span>Cumplimiento: {formatNumber(achievement, 1)}%</span>
                        <span>Inicio: {formatDate(kpi.start_date)}</span>
                        <span>Fin: {formatDate(kpi.end_date)}</span>
                        <span>Periodo: {kpi.period_label || "-"}</span>
                        <span>Responsable: {kpi.responsible_name || "-"}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => startEditing(kpi)}
                        disabled={saving || deletingId === kpi.id}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => handleDelete(kpi.id)}
                        disabled={saving || deletingId === kpi.id}
                      >
                        {deletingId === kpi.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </section>
  );
}

export default KpisPage;





