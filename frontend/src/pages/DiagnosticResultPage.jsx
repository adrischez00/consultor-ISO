import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import FindingItem from "../components/FindingItem";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import TaskItem from "../components/TaskItem";
import StatusBadge from "../components/StatusBadge";
import { fetchDiagnostic, fetchDiagnosticEvaluation } from "../api/diagnosticsApi";
import { useDiagnostic } from "../context/DiagnosticContext";
import { formatMaturityLevel, formatNumber, normalizeArray } from "../utils/diagnostic";
import { normalizeUuidOrNull } from "../utils/uuid";

function DiagnosticResultPage() {
  const { id } = useParams();
  const diagnosticId = normalizeUuidOrNull(id);
  const { setDiagnosticId } = useDiagnostic();
  const [diagnosticMeta, setDiagnosticMeta] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const wizardPath = diagnosticId ? `/diagnosticos/${diagnosticId}` : "/diagnosticos";

  useEffect(() => {
    if (diagnosticId) {
      setDiagnosticId(diagnosticId);
    }
  }, [diagnosticId, setDiagnosticId]);

  useEffect(() => {
    let active = true;

    async function loadResultData() {
      if (!diagnosticId) {
        setError("ID de diagnóstico inválido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const diagnostic = await fetchDiagnostic(diagnosticId);
        if (!active) return;

        setDiagnosticMeta(diagnostic);
        if (diagnostic.status !== "completed") {
          setEvaluationResult(null);
          return;
        }

        const evaluation = await fetchDiagnosticEvaluation(diagnosticId);
        if (active) {
          setEvaluationResult(evaluation);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el resultado.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadResultData();
    return () => {
      active = false;
    };
  }, [diagnosticId]);

  return (
    <section className="page">
      <PageHeader
        eyebrow="Resultado"
        title="Resultado del diagnóstico"
        description="Analiza score, madurez, hallazgos y tareas generadas."
        actions={
          <div className="inline-actions">
            {diagnosticMeta?.client_id ? (
              <Link className="btn-ghost link-btn" to={`/clientes/${diagnosticMeta.client_id}`}>
                Ir a cliente
              </Link>
            ) : null}
            <Link className="btn-secondary link-btn" to={wizardPath}>
              Volver al wizard
            </Link>
          </div>
        }
      />

      {loading ? <p className="status">Cargando resultado...</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error && diagnosticMeta?.status !== "completed" ? (
        <SectionCard
          title="Resultado no disponible"
          description="El diagnóstico tiene cambios pendientes y debe evaluarse nuevamente."
        >
          <div className="inline-actions">
            <StatusBadge value={diagnosticMeta?.status || "draft"} />
            <Link className="btn-primary link-btn" to={wizardPath}>
              Ir al diagnóstico
            </Link>
          </div>
        </SectionCard>
      ) : null}

      {!loading && !error && evaluationResult ? (
        <>
          <div className="stats-grid">
            <StatCard
              label="Puntuacion total"
              value={`${formatNumber(evaluationResult.total_percentage)}%`}
            />
            <StatCard
              label="Madurez"
              value={formatMaturityLevel(evaluationResult.maturity_level)}
            />
            <StatCard label="Score bruto" value={evaluationResult.total_raw_score} />
            <StatCard
              label="Score ponderado"
              value={formatNumber(evaluationResult.total_weighted_score)}
            />
          </div>

          <SectionCard
            title="Resumen por cláusula"
            description="Porcentaje, score bruto y score ponderado por cada cláusula."
          >
            <div className="clause-summary-list">
              {normalizeArray(evaluationResult.clause_scores).map((item) => (
                <div className="clause-summary-row" key={item.clause}>
                  <span>Cláusula {item.clause}</span>
                  <span>{formatNumber(item.percentage)}%</span>
                  <span>Bruto: {item.raw_score}</span>
                  <span>Ponderado: {formatNumber(item.weighted_score)}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="layout-grid two-columns">
            <SectionCard
              title={`Hallazgos (${evaluationResult.findings_generated || 0})`}
              description="Resultado de cumplimiento por pregunta."
            >
              {normalizeArray(evaluationResult.findings).length === 0 ? (
                <p className="empty-state">Sin hallazgos registrados.</p>
              ) : (
                <div className="stack-list">
                  {normalizeArray(evaluationResult.findings).map((finding) => (
                    <FindingItem key={finding.id} finding={finding} />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title={`Tareas iniciales (${evaluationResult.tasks_generated || 0})`}
              description="Acciones para brechas parciales o no conformes."
            >
              {normalizeArray(evaluationResult.tasks).length === 0 ? (
                <p className="empty-state">Sin tareas generadas.</p>
              ) : (
                <div className="stack-list">
                  {normalizeArray(evaluationResult.tasks).map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default DiagnosticResultPage;
