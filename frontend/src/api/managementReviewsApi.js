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

function normalizeDate(value, fieldName, { required = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) throw new Error(`${fieldName} es obligatorio.`);
    return null;
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} invalida.`);
  }
  return normalized;
}

function normalizeReferences(references, { required = false } = {}) {
  if (references == null) {
    if (required) return [];
    return undefined;
  }
  if (!Array.isArray(references)) {
    throw new Error("references debe ser una lista.");
  }
  const normalized = references.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Referencia invalida en posicion ${index + 1}.`);
    }
    return {
      reference_type: normalizeRequiredText(item.reference_type, "reference_type"),
      source_id: ensureUuid(item.source_id, "source_id"),
      source_label: normalizeNullableText(item.source_label),
    };
  });
  return normalized;
}

function normalizeCreatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de revision invalido.");
  }
  return {
    review_date: normalizeDate(payload.review_date, "review_date", { required: true }),
    reviewed_period: normalizeRequiredText(payload.reviewed_period, "reviewed_period"),
    summary: normalizeRequiredText(payload.summary, "summary"),
    conclusions: normalizeRequiredText(payload.conclusions, "conclusions"),
    decisions: normalizeRequiredText(payload.decisions, "decisions"),
    derived_actions: normalizeRequiredText(payload.derived_actions, "derived_actions"),
    responsible_name: normalizeRequiredText(payload.responsible_name, "responsible_name"),
    followup_status: normalizeRequiredText(payload.followup_status || "pending", "followup_status"),
    followup_notes: normalizeNullableText(payload.followup_notes),
    references: normalizeReferences(payload.references, { required: true }),
  };
}

function normalizePatchPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de revision invalido.");
  }
  const safePayload = {};
  if (Object.prototype.hasOwnProperty.call(payload, "review_date")) {
    safePayload.review_date = normalizeDate(payload.review_date, "review_date");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "reviewed_period")) {
    safePayload.reviewed_period = normalizeRequiredText(payload.reviewed_period, "reviewed_period");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "summary")) {
    safePayload.summary = normalizeRequiredText(payload.summary, "summary");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "conclusions")) {
    safePayload.conclusions = normalizeRequiredText(payload.conclusions, "conclusions");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "decisions")) {
    safePayload.decisions = normalizeRequiredText(payload.decisions, "decisions");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "derived_actions")) {
    safePayload.derived_actions = normalizeRequiredText(payload.derived_actions, "derived_actions");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    safePayload.responsible_name = normalizeRequiredText(
      payload.responsible_name,
      "responsible_name"
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, "followup_status")) {
    safePayload.followup_status = normalizeRequiredText(payload.followup_status, "followup_status");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "followup_notes")) {
    safePayload.followup_notes = normalizeNullableText(payload.followup_notes);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "references")) {
    safePayload.references = normalizeReferences(payload.references, { required: true });
  }
  return safePayload;
}

export async function fetchManagementReviews(filters = {}) {
  const query = toQuery({
    status: filters.status || null,
    review_date_from: filters.review_date_from || null,
    review_date_to: filters.review_date_to || null,
  });
  const data = await requestJson(`/management-reviews${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las revisiones por la direccion.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta invalida al listar revisiones.");
  }
  return data;
}

export async function fetchManagementReviewSummary() {
  const data = await requestJson("/management-reviews/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de revisiones.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al cargar resumen.");
  }
  return data;
}

export async function fetchManagementReviewDetail(reviewId) {
  const normalizedReviewId = ensureUuid(reviewId, "review_id");
  const data = await requestJson(`/management-reviews/${normalizedReviewId}`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar la revision por la direccion.",
  });
  if (!data || typeof data !== "object" || typeof data.review !== "object") {
    throw new Error("Respuesta invalida al cargar detalle de revision.");
  }
  return data;
}

export async function createManagementReview(payload) {
  const safePayload = normalizeCreatePayload(payload);
  const data = await requestJson("/management-reviews", {
    method: "POST",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo crear la revision por la direccion.",
  });
  if (!data || typeof data !== "object" || typeof data.review !== "object") {
    throw new Error("Respuesta invalida al crear revision.");
  }
  return data;
}

export async function patchManagementReview(reviewId, payload) {
  const normalizedReviewId = ensureUuid(reviewId, "review_id");
  const safePayload = normalizePatchPayload(payload);
  const data = await requestJson(`/management-reviews/${normalizedReviewId}`, {
    method: "PATCH",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo actualizar la revision por la direccion.",
  });
  if (!data || typeof data !== "object" || typeof data.review !== "object") {
    throw new Error("Respuesta invalida al actualizar revision.");
  }
  return data;
}

export async function deleteManagementReview(reviewId) {
  const normalizedReviewId = ensureUuid(reviewId, "review_id");
  await requestJson(`/management-reviews/${normalizedReviewId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar la revision por la direccion.",
  });
}
