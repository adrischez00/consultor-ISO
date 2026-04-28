import { requestJson } from "./httpClient";

export async function fetchIsoFlowSummary() {
  const data = await requestJson("/iso-flow/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de integracion ISO.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al cargar el flujo ISO.");
  }
  return data;
}
