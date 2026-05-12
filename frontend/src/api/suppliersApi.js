import { requestJson } from "./httpClient";
import { ensureUuid } from "../utils/uuid";

const RATING_VALUES = new Set(["excellent", "approved", "conditional", "critical"]);
const ORDER_BY_VALUES = new Set([
  "name",
  "global_score",
  "evaluation_date",
  "incidents_count",
  "created_at",
]);
const ORDER_DIR_VALUES = new Set(["asc", "desc"]);

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

function normalizeOptionalText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeOptionalEmail(value, fieldName) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  if (!normalized.includes("@") || normalized.startsWith("@") || normalized.endsWith("@")) {
    throw new Error(`${fieldName} inválido.`);
  }
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

function normalizeFloat(value, fieldName, { min = null, max = null } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName} inválido.`);
  if (min != null && parsed < min) throw new Error(`${fieldName} debe ser >= ${min}.`);
  if (max != null && parsed > max) throw new Error(`${fieldName} debe ser <= ${max}.`);
  return parsed;
}

function normalizeRating(value, fieldName) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (!RATING_VALUES.has(normalized)) throw new Error(`${fieldName} inválido.`);
  return normalized;
}

function normalizeOrderBy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (!ORDER_BY_VALUES.has(normalized)) throw new Error("order_by inválido.");
  return normalized;
}

function normalizeOrderDir(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (!ORDER_DIR_VALUES.has(normalized)) throw new Error("order_dir inválido.");
  return normalized;
}

function normalizeCreatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido.");
  }
  return {
    name: normalizeRequiredText(payload.name, "name"),
    service_category: normalizeRequiredText(payload.service_category, "service_category"),
    contact_name: normalizeOptionalText(payload.contact_name),
    contact_email: normalizeOptionalEmail(payload.contact_email, "contact_email"),
    contact_phone: normalizeOptionalText(payload.contact_phone),
    quality_score: normalizeInt(payload.quality_score, "quality_score", { required: true, min: 1, max: 5 }),
    delivery_score: normalizeInt(payload.delivery_score, "delivery_score", { required: true, min: 1, max: 5 }),
    incidents_score: normalizeInt(payload.incidents_score, "incidents_score", { required: true, min: 1, max: 5 }),
    certifications_score: normalizeInt(payload.certifications_score, "certifications_score", {
      required: true,
      min: 1,
      max: 5,
    }),
    additional_score: normalizeInt(payload.additional_score, "additional_score", { min: 1, max: 5 }),
    incidents_count: normalizeInt(payload.incidents_count, "incidents_count", {
      required: true,
      min: 0,
    }),
    evaluation_date: normalizeDate(payload.evaluation_date, "evaluation_date", { required: true }),
    evaluation_notes: normalizeOptionalText(payload.evaluation_notes),
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
  if (Object.prototype.hasOwnProperty.call(payload, "service_category")) {
    data.service_category = normalizeRequiredText(payload.service_category, "service_category");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "contact_name")) {
    data.contact_name = normalizeOptionalText(payload.contact_name);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "contact_email")) {
    data.contact_email = normalizeOptionalEmail(payload.contact_email, "contact_email");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "contact_phone")) {
    data.contact_phone = normalizeOptionalText(payload.contact_phone);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "quality_score")) {
    data.quality_score = normalizeInt(payload.quality_score, "quality_score", { required: true, min: 1, max: 5 });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "delivery_score")) {
    data.delivery_score = normalizeInt(payload.delivery_score, "delivery_score", {
      required: true,
      min: 1,
      max: 5,
    });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "incidents_score")) {
    data.incidents_score = normalizeInt(payload.incidents_score, "incidents_score", {
      required: true,
      min: 1,
      max: 5,
    });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "certifications_score")) {
    data.certifications_score = normalizeInt(payload.certifications_score, "certifications_score", {
      required: true,
      min: 1,
      max: 5,
    });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "additional_score")) {
    data.additional_score = normalizeInt(payload.additional_score, "additional_score", { min: 1, max: 5 });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "incidents_count")) {
    data.incidents_count = normalizeInt(payload.incidents_count, "incidents_count", { required: true, min: 0 });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "evaluation_date")) {
    data.evaluation_date = normalizeDate(payload.evaluation_date, "evaluation_date", { required: true });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "evaluation_notes")) {
    data.evaluation_notes = normalizeOptionalText(payload.evaluation_notes);
  }
  return data;
}

export async function fetchSuppliers(filters = {}) {
  const query = toQuery({
    service_category: normalizeOptionalText(filters.service_category),
    rating: normalizeRating(filters.rating, "rating"),
    evaluation_date_from: normalizeDate(filters.evaluation_date_from, "evaluation_date_from"),
    evaluation_date_to: normalizeDate(filters.evaluation_date_to, "evaluation_date_to"),
    score_min: normalizeFloat(filters.score_min, "score_min", { min: 1, max: 5 }),
    score_max: normalizeFloat(filters.score_max, "score_max", { min: 1, max: 5 }),
    order_by: normalizeOrderBy(filters.order_by),
    order_dir: normalizeOrderDir(filters.order_dir),
  });
  const data = await requestJson(`/suppliers${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los proveedores.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta invalida al listar proveedores.");
  }
  return data;
}

export async function fetchSuppliersSummary() {
  const data = await requestJson("/suppliers/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de proveedores.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al cargar resumen de proveedores.");
  }
  return data;
}

export async function createSupplier(payload) {
  const safePayload = normalizeCreatePayload(payload);
  const data = await requestJson("/suppliers", {
    method: "POST",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo crear el proveedor.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al crear proveedor.");
  }
  return { ...data, id: ensureUuid(data.id, "id") };
}

export async function patchSupplier(supplierId, payload) {
  const normalizedSupplierId = ensureUuid(supplierId, "supplier_id");
  const safePayload = normalizePatchPayload(payload);
  const data = await requestJson(`/suppliers/${normalizedSupplierId}`, {
    method: "PATCH",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo actualizar el proveedor.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al actualizar proveedor.");
  }
  return { ...data, id: ensureUuid(data.id, "id") };
}

export async function deleteSupplier(supplierId) {
  const normalizedSupplierId = ensureUuid(supplierId, "supplier_id");
  await requestJson(`/suppliers/${normalizedSupplierId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el proveedor.",
  });
}

