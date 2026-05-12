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
  return raw ? `${raw}` : "";
}

function normalizeNullableText(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeRequiredText(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${fieldName} es obligatorio.`);
  }
  return normalized;
}

function normalizeNumber(value, fieldName, { required = false, positive = false } = {}) {
  if (value == null || value === "") {
    if (required) throw new Error(`${fieldName} es obligatorio.`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} inválido.`);
  }
  if (positive && parsed <= 0) {
    throw new Error(`${fieldName} debe ser mayor que 0.`);
  }
  return parsed;
}

function normalizeDate(value, fieldName, { required = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) throw new Error(`${fieldName} es obligatorio.`);
    return null;
  }
  const asDate = new Date(normalized);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error(`${fieldName} invalida.`);
  }
  return normalized;
}

function validatePeriod({ startDate, endDate, periodLabel }) {
  if (!endDate && !periodLabel) {
    throw new Error("Debes informar fecha fin o periodo.");
  }
  if (startDate && endDate && endDate < startDate) {
    throw new Error("La fecha fin no puede ser anterior a la fecha inicio.");
  }
}

function normalizeKpiPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de indicador inválido.");
  }

  const result = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "name")) {
    const name = normalizeRequiredText(payload.name, "name");
    result.name = name;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "description")) {
    result.description = normalizeNullableText(payload.description);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "target_value")) {
    result.target_value = normalizeNumber(payload.target_value, "target_value", {
      required: !partial,
      positive: true,
    });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "current_value")) {
    result.current_value = normalizeNumber(payload.current_value, "current_value", {
      required: !partial,
    });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "unit")) {
    result.unit = normalizeRequiredText(payload.unit, "unit");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "start_date")) {
    result.start_date = normalizeDate(payload.start_date, "start_date", { required: !partial });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "end_date")) {
    result.end_date = normalizeDate(payload.end_date, "end_date");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "period_label")) {
    result.period_label = normalizeNullableText(payload.period_label);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    result.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }

  const effectiveStartDate = Object.prototype.hasOwnProperty.call(result, "start_date") ? result.start_date : null;
  const effectiveEndDate = Object.prototype.hasOwnProperty.call(result, "end_date") ? result.end_date : null;
  const effectivePeriodLabel = Object.prototype.hasOwnProperty.call(result, "period_label") ? result.period_label : null;

  if (!partial) {
    validatePeriod({
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      periodLabel: effectivePeriodLabel,
    });
  } else if (
    Object.prototype.hasOwnProperty.call(result, "start_date") ||
    Object.prototype.hasOwnProperty.call(result, "end_date") ||
    Object.prototype.hasOwnProperty.call(result, "period_label")
  ) {
    if (effectiveStartDate || effectiveEndDate || effectivePeriodLabel) {
      validatePeriod({
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        periodLabel: effectivePeriodLabel,
      });
    }
  }

  return result;
}

export async function fetchKpis(filters = {}) {
  const query = toQuery({
    status: filters.status || null,
    start_date_from: filters.start_date_from || null,
    start_date_to: filters.start_date_to || null,
    end_date_from: filters.end_date_from || null,
    end_date_to: filters.end_date_to || null,
  });
  const data = await requestJson(`/kpis${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los indicadores.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta invalida al listar indicadores.");
  }
  return data;
}

export async function createKpi(payload) {
  const safePayload = normalizeKpiPayload(payload, { partial: false });
  const data = await requestJson("/kpis", {
    method: "POST",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo crear el indicador.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al crear indicador.");
  }
return { ...data, id: ensureUuid(data.id, "id") };
}

export async function patchKpi(kpiId, payload) {
  const normalizedKpiId = ensureUuid(kpiId, "kpi_id");
  const safePayload = normalizeKpiPayload(payload, { partial: true });
  const data = await requestJson(`/kpis/${normalizedKpiId}`, {
    method: "PATCH",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo actualizar el indicador.",
  });
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta invalida al actualizar indicador.");
  }
return { ...data, id: ensureUuid(data.id, "id") };
}

export async function deleteKpi(kpiId) {
  const normalizedKpiId = ensureUuid(kpiId, "kpi_id");
  await requestJson(`/kpis/${normalizedKpiId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el indicador.",
  });
}


