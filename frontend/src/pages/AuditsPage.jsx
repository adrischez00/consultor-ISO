import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { deleteAuditReport, fetchAuditReports } from "../api/auditsApi";
import { fetchClients } from "../api/clientsApi";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatUserName(createdBy) {
  if (!createdBy) return "-";
  return createdBy.full_name || createdBy.email || "-";
}

function isAuditDeletable(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return !["completed", "approved", "closed"].includes(normalized);
}

function AuditsPage() {
  const [audits, setAudits] = useState([]);
  const [clients, setClients] = useState([]);
  const [filters, setFilters] = useState({
    client_id: "",
    report_year: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingAuditId, setDeletingAuditId] = useState("");
  const [pendingDeleteAudit, setPendingDeleteAudit] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadBaseData() {
      try {
        const loadedClients = await fetchClients();
        if (!active) return;
        setClients(Array.isArray(loadedClients) ? loadedClients : []);
      } catch {
        if (!active) return;
        setClients([]);
      }
    }

    loadBaseData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAudits() {
      setLoading(true);
      setError("");
      try {
        const query = {
          client_id: filters.client_id || null,
          report_year: filters.report_year || null,
          status: filters.status || null,
        };
        const data = await fetchAuditReports(query);
        if (active) {
          setAudits(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las auditorías.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAudits();
    return () => {
      active = false;
    };
  }, [filters.client_id, filters.report_year, filters.status]);

  const years = useMemo(() => {
    const set = new Set();
    audits.forEach((item) => {
      if (item?.report_year) {
        set.add(item.report_year);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [audits]);

  function handleFilterChange(field) {
    return (event) => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  function requestDeleteAudit(audit) {
    if (!audit?.id || deletingAuditId) return;
    if (!isAuditDeletable(audit.status)) return;
    setPendingDeleteAudit(audit);
  }

  function closeDeleteModal() {
    if (deletingAuditId) return;
    setPendingDeleteAudit(null);
  }

  async function confirmDeleteAudit() {
    if (!pendingDeleteAudit?.id || deletingAuditId) return;
    setDeletingAuditId(pendingDeleteAudit.id);
    setError("");
    try {
      await deleteAuditReport(pendingDeleteAudit.id);
      setAudits((prev) => prev.filter((item) => item.id !== pendingDeleteAudit.id));
      setPendingDeleteAudit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la auditoria.");
    } finally {
      setDeletingAuditId("");
    }
  }

  return (
    <section className="page audits-page">
      <PageHeader
        eyebrow="Principal"
        title="Auditorías"
        description="Gestiona informes de auditoría interna ISO 9001 (P03) por cliente y año."
        actions={
          <Link className="btn-primary link-btn" to="/auditorias/nueva">
            Nueva auditoría
          </Link>
        }
      />

      <SectionCard
        className="audits-filters-card"
        title="Filtros"
        description="Refina por cliente, año y estado."
      >
        <div className="inline-actions audits-filter-grid">
          <label className="field-inline">
            <span>Cliente</span>
            <select
              className="input-select"
              value={filters.client_id}
              onChange={handleFilterChange("client_id")}
            >
              <option value="">Todos</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-inline">
            <span>Año</span>
            <select
              className="input-select"
              value={filters.report_year}
              onChange={handleFilterChange("report_year")}
            >
              <option value="">Todos</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="field-inline">
            <span>Estado</span>
            <select
              className="input-select"
              value={filters.status}
              onChange={handleFilterChange("status")}
            >
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="in_progress">En progreso</option>
              <option value="completed">Completado</option>
              <option value="approved">Aprobado</option>
            </select>
          </label>
        </div>
      </SectionCard>

      {loading ? <p className="status">Cargando auditorías...</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error ? (
        <SectionCard
          className="audits-list-card"
          title="Listado de auditorías"
          description="Ordenadas por fecha de creación."
        >
          {audits.length === 0 ? (
            <div className="empty-state-block">
              <p className="empty-state">No hay auditorías creadas todavía.</p>
              <div className="inline-actions">
                <Link className="btn-primary link-btn" to="/auditorias/nueva">
                  Crear primera auditoría
                </Link>
              </div>
            </div>
          ) : (
            <div className="stack-list">
              {audits.map((audit) => (
                <article className="diagnostic-list-item" key={audit.id}>
                  <div className="diagnostic-list-main">
                    <p className="diagnostic-list-id">
                      {audit.report_code || `AUD-${audit.report_year}`} -{" "}
                      {audit.entity_name || audit.client?.name || "-"}
                    </p>
                    <div className="diagnostic-list-meta">
                      <StatusBadge value={audit.status} />
                      <span>Cliente: {audit.client?.name || "-"}</span>
                      <span>Año: {audit.report_year}</span>
                      <span>Fecha de auditoría: {formatDate(audit.audit_date)}</span>
                      <span>Creado por: {formatUserName(audit.created_by)}</span>
                    </div>
                  </div>
                  <div className="diagnostic-list-actions audits-item-actions">
                    <Link className="btn-secondary link-btn" to={`/auditorias/${audit.id}`}>
                      Abrir
                    </Link>
                    <Link className="btn-ghost link-btn" to={`/auditorias/${audit.id}/editar`}>
                      Editar
                    </Link>
                    {isAuditDeletable(audit.status) ? (
                      <button
                        type="button"
                        className="audit-delete-icon-btn"
                        aria-label={`Eliminar auditoria ${audit.report_code || audit.id}`}
                        title="Eliminar auditoría"
                        disabled={Boolean(deletingAuditId)}
                        onClick={() => requestDeleteAudit(audit)}
                      >
                        {deletingAuditId === audit.id ? "⏳" : "🗑️"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      <ConfirmDeleteModal
        open={Boolean(pendingDeleteAudit)}
        loading={Boolean(deletingAuditId)}
        title="Eliminar auditoría"
        description="Se eliminará el expediente completo (cabecera, secciones, checks, anexos, entrevistados y recomendaciones). Esta acción no se puede deshacer."
        entityLabel={pendingDeleteAudit?.report_code || pendingDeleteAudit?.id || ""}
        confirmLabel="Eliminar definitivamente"
        cancelLabel="Cancelar"
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteAudit}
      />
    </section>
  );
}

export default AuditsPage;
