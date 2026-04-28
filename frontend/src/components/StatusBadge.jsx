const STATUS_LABELS = {
  draft: "Borrador",
  not_started: "No iniciada",
  in_progress: "En progreso",
  completed: "Completado",
  approved: "Aprobado",
  open: "Abierta",
  closed: "Cerrada",
  pending_verification: "Pendiente de verificación",
  new: "Nueva",
  done: "Finalizada",
  ok: "OK",
  alerta: "Alerta",
  critico: "Crítico",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  critical: "Crítico",
  proposed: "Propuesta",
  implemented: "Implementada",
  validated: "Validada",
  compliant: "Cumple",
  partial: "Parcial",
  non_compliant: "No cumple",
  pending: "Pendiente",
  active: "Activo",
  inactive: "Inactivo",
};

function resolveVariant(value) {
  if (
    value === "completed" ||
    value === "approved" ||
    value === "closed" ||
    value === "done" ||
    value === "ok" ||
    value === "implemented" ||
    value === "validated" ||
    value === "compliant" ||
    value === "low" ||
    value === "excellent" ||
    value === "approved_supplier" ||
    value === "active"
  ) {
    return "good";
  }
  if (
    value === "in_progress" ||
    value === "pending_verification" ||
    value === "alerta" ||
    value === "partial" ||
    value === "medium" ||
    value === "conditional"
  ) {
    return "warn";
  }
  if (
    value === "non_compliant" ||
    value === "high" ||
    value === "critical" ||
    value === "critico"
  ) {
    return "danger";
  }
  return "neutral";
}

function StatusBadge({ value, label }) {
  const variant = resolveVariant(value);
  const text = label || STATUS_LABELS[value] || String(value ?? "-");
  return <span className={`status-badge ${variant}`}>{text}</span>;
}

export default StatusBadge;
