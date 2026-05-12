import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import RichTextContent from "../components/RichTextContent";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { fetchAuditReports } from "../api/auditsApi";
import { fetchClientDetail } from "../api/clientsApi";
import { formatNumber } from "../utils/diagnostic";
import { normalizeUuidOrNull } from "../utils/uuid";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function ClientDetailPage() {
  const { id } = useParams();
  const clientId = normalizeUuidOrNull(id);
  const [clientDetail, setClientDetail] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadClient() {
      if (!clientId) {
        setError("ID de cliente inválido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [data, loadedAudits] = await Promise.all([
          fetchClientDetail(clientId),
          fetchAuditReports({ client_id: clientId }),
        ]);
        if (active) {
          setClientDetail(data);
          setAudits(Array.isArray(loadedAudits) ? loadedAudits : []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar cliente.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadClient();
    return () => {
      active = false;
    };
  }, [clientId]);

  const client = clientDetail.client;
  const diagnostics = Array.isArray(clientDetail.diagnostics) ? clientDetail.diagnostics : [];

  return (
    <section className="page">
      <PageHeader
        eyebrow="Cliente"
        title={client.name || "Detalle de cliente"}
        description="Contexto de empresa e histórico de auditorías P03 y diagnósticos legacy."
        actions={
          <div className="inline-actions">
            <Link className="btn-primary link-btn" to={`/auditorias/nuevaclient_id=${clientId || ""}`}>
              Nueva auditoría
            </Link>
            <Link className="btn-secondary link-btn" to="/clientes">
              Volver a clientes
            </Link>
          </div>
        }
      />

      {loading ? <p className="status">Cargando cliente...</p> : null}
{error ? <p className="status error">{error}</p> : null}

      {!loading && !error && client ? (
        <>
          <SectionCard title="Información general" description="Datos base del cliente.">
            <ul className="kv-list">
              <li>
                <span>Estado</span>
                <StatusBadge value={client.status} label={client.status} />
              </li>
              <li>
                <span>Sector</span>
                <strong>{client.sector || "-"}</strong>
              </li>
              <li>
                <span>Empleados</span>
                <strong>{client.employee_count ?? "-"}</strong>
              </li>
              <li>
                <span>Fecha de alta</span>
                <strong>{formatDate(client.created_at)}</strong>
              </li>
              <li>
                <span>Descripción</span>
                <RichTextContent value={client.description} />
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={`Auditorías P03 asociadas (${audits.length})`}
            description="Histórico principal del informe de auditoría interna."
          >
            {audits.length === 0 ? (
              <p className="empty-state">Este cliente aún no tiene auditorías creadas.</p>
            ) : (
              <div className="stack-list">
                {audits.map((audit) => (
                  <article className="diagnostic-list-item" key={audit.id}>
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{audit.report_code || audit.id}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={audit.status} />
                        <span>Año: {audit.report_year}</span>
                        <span>Fecha de auditoría: {formatDate(audit.audit_date)}</span>
                        <span>Actualizado: {formatDate(audit.updated_at)}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <Link className="btn-secondary link-btn" to={`/auditorias/${audit.id}`}>
                        Abrir
                      </Link>
                      <Link className="btn-ghost link-btn" to={`/auditorias/${audit.id}/editar`}>
                        Editar
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={`Diagnósticos legacy (${diagnostics.length})`}
            description="Herramienta secundaria mantenida por compatibilidad."
          >
            {diagnostics.length === 0 ? (
              <p className="empty-state">Este cliente aún no tiene diagnósticos asociados.</p>
            ) : (
              <div className="stack-list">
                {diagnostics.map((diagnostic) => (
                  <article className="diagnostic-list-item" key={diagnostic.id}>
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{diagnostic.id}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={diagnostic.status} />
                        <span>Creado: {formatDate(diagnostic.created_at)}</span>
                        <span>Completado: {formatDate(diagnostic.completed_at)}</span>
                        <span>
                          Score:{" "}
                          {diagnostic.total_score == null ? "-" : `${formatNumber(diagnostic.total_score)}%`}
                        </span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <Link className="btn-secondary link-btn" to={`/diagnosticos/${diagnostic.id}`}>
                        Continuar
                      </Link>
                      <Link
                        className="btn-ghost link-btn"
                        to={`/diagnosticos/${diagnostic.id}/resultado`}
                      >
                        Resultado
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}

export default ClientDetailPage;

