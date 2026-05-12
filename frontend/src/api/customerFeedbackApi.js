import { requestJson } from "./httpClient";
import { ensureUuid } from "../utils/uuid";

const FEEDBACK_TYPES = new Set(["survey", "meeting", "call", "email", "complaint", "other"]);

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

function normalizeScore(value, fieldName, { required = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (required) throw new Error(`${fieldName} es obligatorio.`);
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new Error(`${fieldName} debe estar entre 1 y 5.`);
  }
  return parsed;
}

function normalizeFeedbackType(value, fieldName, { required = false } = {}) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) {
    if (required) throw new Error(`${fieldName} es obligatorio.`);
    return null;
  }
  if (!FEEDBACK_TYPES.has(raw)) {
    throw new Error(`${fieldName} inválido.`);
  }
  return raw;
}

function normalizeCreatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido.");
  }
  return {
    client_id: ensureUuid(payload.client_id, "client_id"),
    feedback_date: normalizeDate(payload.feedback_date, "feedback_date", { required: true }),
    score: normalizeScore(payload.score, "score", { required: true }),
    comment: normalizeRequiredText(payload.comment, "comment"),
    feedback_type: normalizeFeedbackType(payload.feedback_type || "survey", "feedback_type", {
      required: true,
    }),
  };
}

function normalizePatchPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido.");
  }
  const data = {};
  if (Object.prototype.hasOwnProperty.call(payload, "client_id")) {
    data.client_id = ensureUuid(payload.client_id, "client_id");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "feedback_date")) {
    data.feedback_date = normalizeDate(payload.feedback_date, "feedback_date", { required: true });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "score")) {
    data.score = normalizeScore(payload.score, "score", { required: true });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "comment")) {
    data.comment = normalizeRequiredText(payload.comment, "comment");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "feedback_type")) {
    data.feedback_type = normalizeFeedbackType(payload.feedback_type, "feedback_type", { required: true });
  }
  return data;
}

export async function fetchCustomerFeedback(filters = {}) {
  const query = toQuery({
    client_id: filters.client_id || null,
    type: filters.type || null,
    feedback_date_from: filters.feedback_date_from || null,
    feedback_date_to: filters.feedback_date_to || null,
    score_min: filters.score_min || null,
    score_max: filters.score_max || null,
  });
  const data = await requestJson(`/customer-feedback${query}`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar la satisfacción del cliente.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta invalida al listar feedback.");
  }
  return data;
}

export async function fetchCustomerFeedbackSummary() {
  const data = await requestJson("/customer-feedback/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de satisfacción.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al cargar resumen.");
  }
  return data;
}

export async function createCustomerFeedback(payload) {
  const safePayload = normalizeCreatePayload(payload);
  const data = await requestJson("/customer-feedback", {
    method: "POST",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo crear el registro de feedback.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al crear feedback.");
  }
  return { ...data, id: ensureUuid(data.id, "id") };
}

export async function patchCustomerFeedback(feedbackId, payload) {
  const normalizedFeedbackId = ensureUuid(feedbackId, "feedback_id");
  const safePayload = normalizePatchPayload(payload);
  const data = await requestJson(`/customer-feedback/${normalizedFeedbackId}`, {
    method: "PATCH",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo actualizar el feedback.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al actualizar feedback.");
  }
  return { ...data, id: ensureUuid(data.id, "id") };
}

export async function deleteCustomerFeedback(feedbackId) {
  const normalizedFeedbackId = ensureUuid(feedbackId, "feedback_id");
  await requestJson(`/customer-feedback/${normalizedFeedbackId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el feedback.",
  });
}

