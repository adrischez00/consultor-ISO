import { requestJson } from "./httpClient";
import { ensureUuid } from "../utils/uuid";

export async function createDiagnostic(payload = null) {
  let body;
  if (payload && payload.client_id != null) {
    body = JSON.stringify({
      client_id: ensureUuid(payload.client_id, "client_id"),
    });
  }

  const data = await requestJson("/diagnostics", {
    method: "POST",
    body,
    fallbackMessage: "No se pudo crear el diagnóstico.",
  });

  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta inválida al crear diagnóstico.");
  }
return { ...data, id : ensureUuid(data.id, "id") };
}

export async function fetchDiagnostics({ limit = 20, offset = 0 } = {}) {
  const safeLimit = Number.isFinite(limit) ? Number(limit) : 20;
  const safeOffset = Number.isFinite(offset) ? Number(offset) : 0;

  const data = await requestJson(
    `/diagnosticslimit=${encodeURIComponent(safeLimit)}&offset=${encodeURIComponent(safeOffset)}`,
    {
      method: "GET",
      fallbackMessage: "No se pudieron cargar los diagnósticos.",
    }
  );

  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al listar diagnósticos.");
  }

  return data;
}

export async function fetchTasks({ diagnosticId } = {}) {
  let path = "/tasks";

  if (diagnosticId != null) {
    const normalizedDiagnosticId = ensureUuid(diagnosticId, "diagnostic_id");
    path = `/tasksdiagnostic_id=${encodeURIComponent(normalizedDiagnosticId)}`;
  }

  const data = await requestJson(path, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las tareas.",
  });

  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al listar tareas.");
  }

  return data;
}

export async function fetchDiagnostic(diagnosticId) {
  const normalizedDiagnosticId = ensureUuid(diagnosticId, "diagnostic_id");

  const data = await requestJson(`/diagnostics/${normalizedDiagnosticId}`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar el diagnóstico.",
  });

  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta inválida al cargar diagnóstico.");
  }
return { ...data, id : ensureUuid(data.id, "id") };
}

export async function upsertAnswer(payload) {
  const diagnosticId = ensureUuid(payload.diagnostic_id, "diagnostic_id");
  const questionId = ensureUuid(payload.question_id, "question_id");

  const data = await requestJson("/answers", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      diagnostic_id: diagnosticId,
      question_id: questionId,
    }),
    fallbackMessage: "No se pudo guardar la respuesta.",
  });

  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al guardar la respuesta.");
  }

  return data;
}

export async function fetchDiagnosticAnswers(diagnosticId) {
  const normalizedDiagnosticId = ensureUuid(diagnosticId, "diagnostic_id");

  const data = await requestJson(`/diagnostics/${normalizedDiagnosticId}/answers`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las respuestas.",
  });

  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al cargar respuestas.");
  }

  return data;
}

export async function fetchDiagnosticEvaluation(diagnosticId) {
  const normalizedDiagnosticId = ensureUuid(diagnosticId, "diagnostic_id");

  const data = await requestJson(`/diagnostics/${normalizedDiagnosticId}/evaluation`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar la evaluación del diagnóstico.",
  });

  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al cargar evaluación.");
  }

  return data;
}

export async function evaluateDiagnostic(diagnosticId) {
  const normalizedDiagnosticId = ensureUuid(diagnosticId, "diagnostic_id");

  const data = await requestJson(`/diagnostics/${normalizedDiagnosticId}/evaluate`, {
    method: "POST",
    fallbackMessage: "No se pudo evaluar el diagnóstico.",
  });

  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al evaluar diagnóstico.");
  }

  return data;
}

export async function fetchDiagnosticsBundle(diagnosticIds) {
  const uniqueIds = Array.from(new Set((diagnosticIds || []).map((id) => ensureUuid(id, "diagnostic_id"))));

  const settled = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const diagnostic = await fetchDiagnostic(id);
        let evaluation = null;

        if (diagnostic.status === "completed") {
          try {
            evaluation = await fetchDiagnosticEvaluation(id);
          } catch (err) {
            const message = err instanceof Error ? err.message.toLowerCase() : "";
            if (!message.includes("aún no está completado")) {
              throw err;
            }
          }
        }

        return {
          diagnostic,
          evaluation,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        if (message.includes("diagnóstico no encontrado")) {
          return null;
        }
        throw err;
      }
    })
  );

  return settled.filter(Boolean);
}
