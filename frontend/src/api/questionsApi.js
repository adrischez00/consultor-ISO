import { requestJson } from "./httpClient";

export async function fetchQuestions() {
  const data = await requestJson("/questions", {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las preguntas del diagnóstico.",
  });

  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al cargar preguntas.");
  }

  return data;
}
