import { requestJson } from "./httpClient";
import { ensureUuid } from "../utils/uuid";

function normalizeClientPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de cliente inválido.");
  }

  const name = String(payload.name ?? "").trim();
  if (!name) {
    throw new Error("El nombre del cliente es obligatorio.");
  }

  const sectorRaw = payload.sector;
  const descriptionRaw = payload.description;
  const employeeCountRaw = payload.employee_count;

  const employeeCount =
    employeeCountRaw == null || employeeCountRaw === "" ? null : Number.parseInt(String(employeeCountRaw), 10);

  if (employeeCount != null && (!Number.isFinite(employeeCount) || employeeCount < 0)) {
    throw new Error("employee_count inválido.");
  }

  return {
    name,
    sector: sectorRaw == null ? null : String(sectorRaw).trim() || null,
    employee_count: employeeCount,
    description: descriptionRaw == null ? null : String(descriptionRaw).trim() || null,
  };
}

export async function fetchClients() {
  const data = await requestJson("/clients", {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los clientes.",
  });

  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al listar clientes.");
  }

  return data;
}

export async function createClient(payload) {
  const safePayload = normalizeClientPayload(payload);
  const data = await requestJson("/clients", {
    method: "POST",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo crear el cliente.",
  });

  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta inválida al crear cliente.");
  }

  return {
    ...data,
    id: ensureUuid(data.id, "id"),
  };
}

export async function fetchClientDetail(clientId) {
  const normalizedClientId = ensureUuid(clientId, "client_id");

  const data = await requestJson(`/clients/${normalizedClientId}`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar el cliente.",
  });

  if (!data || typeof data !== "object" || typeof data.client !== "object") {
    throw new Error("Respuesta inválida al cargar detalle de cliente.");
  }

  return data;
}
