import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { deleteAuditReport, fetchAuditReports } from "../api/auditsApi";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function isRecentAuditDeletable(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return !["completed", "approved", "closed"].includes(normalized);
}

function DashboardPage() {
  const [audits, setAudits] = useState([]);
  const [deletingAuditId, setDeletingAuditId] = useState("");
  const [pendingDeleteAudit, setPendingDeleteAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const auditsResult = await fetchAuditReports();
        if (!active) return;
        setAudits(Array.isArray(auditsResult) ? auditsResult : []);
        setLoading(false);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
          setAudits([]);
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const activeAuditsCount = audits.filter(
    (item) => item.status === "draft" || item.status === "in_progress"
  ).length;
  const completedAuditsCount = audits.filter(
    (item) => item.status === "completed" || item.status === "approved"
  ).length;
  const approvedAuditsCount = audits.filter((item) => item.status === "approved").length;

  function requestDeleteRecentAudit(audit) {
    if (!audit?.id || deletingAuditId) return;
    if (!isRecentAuditDeletable(audit.status)) return;
    setPendingDeleteAudit(audit);
  }

  function closeDeleteModal() {
    if (deletingAuditId) return;
    setPendingDeleteAudit(null);
  }

  async function confirmDeleteRecentAudit() {
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
    <section className="page dashboard-page">
      <PageHeader
        eyebrow="Panel Ejecutivo"
        title="Dashboard"
        description="Entrada principal del producto: clientes, auditorías y seguimiento de expedientes."
        actions={
          <>
            <Link className="btn-primary link-btn" to="/clientes">
              Ir a clientes
            </Link>
            <Link className="btn-secondary link-btn" to="/auditorias">
              Ir a auditorías
            </Link>
          </>
        }
      />

      {loading ? <p className="status">Cargando dashboard...</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <SectionCard
            className="dashboard-flow-card"
            title="Flujo principal de trabajo"
            description="Recorrido operativo recomendado para una consultoría ISO 9001."
          >
            <ul className="simple-list">
              <li>
                <Link className="list-link-row" to="/clientes">
                  <span>1) Gestionar clientes</span>
                  <span className="soft-label">Alta, contexto y selección de empresa auditada</span>
                </Link>
              </li>
              <li>
                <Link className="list-link-row" to="/auditorias">
                  <span>2) Crear o continuar auditorías</span>
                  <span className="soft-label">Expediente P03 por cliente y año</span>
                </Link>
              </li>
            </ul>
          </SectionCard>

          <div className="stats-grid dashboard-stats-grid">
            <StatCard label="Auditorías activas" value={activeAuditsCount} hint="Borrador + en progreso" />
            <StatCard label="Auditorías cerradas" value={completedAuditsCount} hint="Completadas + aprobadas" />
            <StatCard label="Auditorías aprobadas" value={approvedAuditsCount} hint="Listas para entrega" />
          </div>

          <div className="layout-grid dashboard-bottom-grid">
            <SectionCard
              className="dashboard-recent-card"
              title="Auditorías recientes"
              description="Accede al expediente y continúa el trabajo de auditoría."
              actions={
                <Link className="btn-ghost link-btn" to="/auditorias">
                  Ver todas
                </Link>
              }
            >
              {audits.length === 0 ? (
                <p className="empty-state">Aún no hay auditorías registradas.</p>
              ) : (
                <ul className="simple-list">
                  {audits.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <div className="list-link-row">
                        <Link to={`/auditorias/${item.id}/editar`} className="recent-audit-link">
                          {item.report_code || item.id}
                        </Link>
                        <span className="inline-actions">
                          <small className="soft-label">{formatDate(item.audit_date)}</small>
                          <StatusBadge value={item.status} />
                          {isRecentAuditDeletable(item.status) ? (
                            <button
                              type="button"
                              className="audit-delete-icon-btn recent-audit-delete-btn"
                              disabled={Boolean(deletingAuditId)}
                              aria-label={`Eliminar auditoria ${item.report_code || item.id}`}
                              title="Eliminar auditoría"
                              onClick={() => requestDeleteRecentAudit(item)}
                            >
                              {deletingAuditId === item.id ? "⏳" : "🗑️"}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

          </div>
        </>
      ) : null}

      <ConfirmDeleteModal
        open={Boolean(pendingDeleteAudit)}
        loading={Boolean(deletingAuditId)}
        title="Eliminar auditoría"
        description="Se eliminará por completo el expediente de auditoría. Esta acción no se puede deshacer."
        entityLabel={pendingDeleteAudit?.report_code || pendingDeleteAudit?.id || ""}
        confirmLabel="Eliminar definitivamente"
        cancelLabel="Cancelar"
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteRecentAudit}
      />
    </section>
  );
}

export default DashboardPage;
