export function normalizeOptions(options) {
  if (!options) return [];

  if (Array.isArray(options)) {
    return options
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          const value = String(item);
          return { label: value, value };
        }

        if (item && typeof item === "object") {
          const rawLabel = item.label ?? item.value;
          const rawValue = item.value ?? item.label;
          if (rawLabel == null || rawValue == null) return null;

          return {
            label: String(rawLabel),
            value: String(rawValue),
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  if (typeof options === "object" && Array.isArray(options.options)) {
    return normalizeOptions(options.options);
  }

  return [];
}

function clauseSortValue(clause) {
  const match = String(clause).match(/\d+(\.\d+)/);
  return match ? Number.parseFloat(match[0]) : Number.POSITIVE_INFINITY;
}

export function compareClauses(a, b) {
  const aSort = clauseSortValue(a);
  const bSort = clauseSortValue(b);

  if (aSort !== bSort) {
    return aSort - bSort;
  }

  return String(a).localeCompare(String(b), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

export function groupByClause(questions) {
  return questions.reduce((acc, question) => {
    const clause = question.clause || "Sin cláusula";
    if (!acc[clause]) {
      acc[clause] = [];
    }
    acc[clause].push(question);
    return acc;
  }, {});
}

export function buildAnswerMap(answers) {
  const map = {};
  answers.forEach((answer) => {
    map[String(answer.question_id)] = String(answer.answer_value);
  });
  return map;
}

export function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }
  return numeric.toFixed(2);
}

export function formatMaturityLevel(value) {
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  if (value === "low") return "Baja";
  return value ?? "-";
}

export function formatDiagnosticStatus(value) {
  if (value === "draft") return "Borrador";
  if (value === "in_progress") return "En progreso";
  if (value === "completed") return "Completado";
  return value ?? "-";
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function prioritySortValue(priority) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  if (priority === "low") return 2;
  return 3;
}

export function findingSeverity(status) {
  if (status === "non_compliant") return "high";
  if (status === "partial") return "medium";
  return "low";
}
