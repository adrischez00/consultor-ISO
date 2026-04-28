import StatusBadge from "./StatusBadge";

function TaskItem({ task }) {
  return (
    <article className="task-item">
      <div className="task-head">
        <p className="task-title">{task.title}</p>
        <div className="task-badges">
          <StatusBadge value={task.priority} />
          <StatusBadge value={task.status} />
        </div>
      </div>
      <p className="task-meta">Cláusula {task.clause ?? "-"}</p>
      {task.description ? <p>{task.description}</p> : null}
    </article>
  );
}

export default TaskItem;
