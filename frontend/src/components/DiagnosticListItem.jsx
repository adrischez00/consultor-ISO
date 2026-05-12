import { Link } from "react-router-dom";

import StatusBadge from "./StatusBadge";
import { formatNumber } from "../utils/diagnostic";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function DiagnosticListItem({ diagnostic, clientName }) {
  const score =
    diagnostic.total_score == null ? "-" : `${formatNumber(diagnostic.total_score)}%`;
  const resultPath = `/diagnosticos/${diagnostic.id}/resultado`;
  const wizardPath = `/diagnosticos/${diagnostic.id}`;
  const clientText = diagnostic.client_id ? clientName || diagnostic.client_id : "Sin cliente";

  return (
    <article className="diagnostic-list-item">
      <div className="diagnostic-list-main">
        <p className="diagnostic-list-id">{diagnostic.id}</p>
        <div className="diagnostic-list-meta">
          <StatusBadge value={diagnostic.status} />
          <span>Inicio: {formatDate(diagnostic.started_at || diagnostic.created_at)}</span>
          <span>Score: {score}</span>
          <span>Cliente: {clientText}</span>
        </div>
      </div>
      <div className="diagnostic-list-actions">
        <Link className="btn-secondary link-btn" to={wizardPath}>
          Continuar
        </Link>
        <Link className="btn-ghost link-btn" to={resultPath}>
          Ver resultado
        </Link>
      </div>
    </article>
  );
}

export default DiagnosticListItem;
