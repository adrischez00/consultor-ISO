import StatusBadge from "./StatusBadge";

function FindingItem({ finding }) {
  return (
    <article className="finding-item">
      <div className="finding-head">
        <p className="finding-title">{finding.title}</p>
        <div className="finding-badges">
          <StatusBadge value={finding.status} />
          <StatusBadge value={finding.priority} />
        </div>
      </div>
      <p className="finding-meta">Cláusula {finding.clause}</p>
      {finding.description ? <p>{finding.description}</p> : null}
{finding.recommendation ? <p>Recomendación : {finding.recommendation}</p> : null}
    </article>
  );
}

export default FindingItem;
