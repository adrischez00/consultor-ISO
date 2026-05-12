import { requestJson } from "./httpClient";
import { ensureUuid } from "../utils/uuid";

function toQuery(params) {
  const qp = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    qp.set(key, normalized);
  });
  const raw = qp.toString();
  return raw ? `?${raw}` : "";
}

function normalizeRequiredText(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${fieldName} es obligatorio.`);
  return normalized;
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeInt(value, fieldName, { required = false, min = null, max = null } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (required) throw new Error(`${fieldName} es obligatorio.`);
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName} inválido.`);
  if (min != null && parsed < min) throw new Error(`${fieldName} debe ser >= ${min}.`);
  if (max != null && parsed > max) throw new Error(`${fieldName} debe ser <= ${max}.`);
  return parsed;
}

function normalizeDate(value, fieldName, { required = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) throw new Error(`${fieldName} es obligatorio.`);
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${fieldName} invalida.`);
  return normalized;
}

function normalizeCreatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido.");
  }
  return {
    name: normalizeRequiredText(payload.name, "name"),
    description: normalizeNullableText(payload.description),
    item_type: normalizeRequiredText(payload.item_type, "item_type"),
    probability: normalizeInt(payload.probability, "probability", { required: true, min: 1, max: 5 }),
    impact: normalizeInt(payload.impact, "impact", { required: true, min: 1, max: 5 }),
    action_plan: normalizeRequiredText(payload.action_plan, "action_plan"),
    responsible_name: normalizeRequiredText(payload.responsible_name, "responsible_name"),
    status: normalizeRequiredText(payload.status || "pending", "status"),
    review_date: normalizeDate(payload.review_date, "review_date", { required: true }),
  };
}

function normalizePatchPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido.");
  }
  const data = {};
  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    data.name = normalizeRequiredText(payload.name, "name");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    data.description = normalizeNullableText(payload.description);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "item_type")) {
    data.item_type = normalizeRequiredText(payload.item_type, "item_type");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "probability")) {
    data.probability = normalizeInt(payload.probability, "probability", { required: true, min: 1, max: 5 });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "impact")) {
    data.impact = normalizeInt(payload.impact, "impact", { required: true, min: 1, max: 5 });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "action_plan")) {
    data.action_plan = normalizeRequiredText(payload.action_plan, "action_plan");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    data.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    data.status = normalizeRequiredText(payload.status, "status");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "review_date")) {
    data.review_date = normalizeDate(payload.review_date, "review_date", { required: true });
  }
  return data;
}

export async function fetchRiskOpportunities(filters = {}) {
  const query = toQuery({
    type: filters.type || null,
    status: filters.status || null,
    level: filters.level || null,
  });
  const data = await requestJson(`/risk-opportunities${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar riesgos y oportunidades.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta invalida al listar riesgos y oportunidades.");
  }
  return data;
}

export async function fetchRiskOpportunitiesSummary() {
  const data = await requestJson("/risk-opportunities/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de riesgos y oportunidades.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al cargar resumen.");
  }
  return data;
}

export async function createRiskOpportunity(payload) {
  const safePayload = normalizeCreatePayload(payload);
  const data = await requestJson("/risk-opportunities", {
    method: "POST",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo crear el registro.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al crear registro.");
  }
  return { ...data, id: ensureUuid(data.id, "id") };
}

export async function patchRiskOpportunity(itemId, payload) {
  const normalizedId = ensureUuid(itemId, "item_id");
  const safePayload = normalizePatchPayload(payload);
  const data = await requestJson(`/risk-opportunities/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo actualizar el registro.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al actualizar registro.");
  }
  return { ...data, id: ensureUuid(data.id, "id") };
}

export async function deleteRiskOpportunity(itemId) {
  const normalizedId = ensureUuid(itemId, "item_id");
  await requestJson(`/risk-opportunities/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el registro.",
  });
}

