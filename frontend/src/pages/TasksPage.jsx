import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import TaskItem from "../components/TaskItem";
import { fetchTasks } from "../api/diagnosticsApi";
import { prioritySortValue } from "../utils/diagnostic";

function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTasksData() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchTasks();
        if (active) {
          const sortedTasks = (Array.isArray(data) ? data : []).sort((a, b) => {
            const byPriority = prioritySortValue(a.priority) - prioritySortValue(b.priority);
            if (byPriority !== 0) return byPriority;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          setTasks(sortedTasks);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar tareas.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTasksData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="page">
      <PageHeader
        eyebrow="Ejecución"
        title="Tareas"
        description="Seguimiento operativo generado desde evaluaciones y diagnósticos legacy."
      />

      {loading ? <p className="status">Cargando tareas...</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error ? (
        <SectionCard title="Lista de tareas" description="Ordenadas por prioridad y fecha.">
          {tasks.length === 0 ? (
            <div className="empty-state-block">
              <p className="empty-state">
                No hay tareas generadas aún. Finaliza al menos un diagnóstico para verlas aquí.
              </p>
              <div className="inline-actions">
                <Link className="btn-secondary link-btn" to="/auditorias">
                  Ir a auditorías
                </Link>
                <Link className="btn-primary link-btn" to="/diagnosticos">
                  Ir a diagnósticos legacy
                </Link>
              </div>
            </div>
          ) : (
            <div className="stack-list">
              {tasks.map((task) => (
                <div key={task.id} className="task-with-link">
                  <TaskItem task={task} />
                  <Link className="inline-link" to={`/diagnosticos/${task.diagnostic_id}/resultado`}>
                    Ver diagnóstico
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </section>
  );
}

export default TasksPage;
