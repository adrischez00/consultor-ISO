import { requestJson } from "./httpClient";
import { ensureUuid, normalizeUuidOrNull } from "../utils/uuid";

const STATUS_ACTIVE_VALUES = ["active", "inactive"];
const PARTY_TYPE_VALUES = ["internal", "external", "customer", "supplier", "regulator", "other"];
const PRIORITY_VALUES = ["low", "medium", "high"];
const PROCESS_TYPE_VALUES = ["strategic", "operational", "support"];
const OBJECTIVE_STATUS_VALUES = ["planned", "in_progress", "completed", "on_hold"];
const CHANGE_STATUS_VALUES = ["planned", "in_progress", "completed", "cancelled"];
const NONCONFORMITY_STATUS_VALUES = ["open", "in_progress", "pending_verification", "closed"];
const NONCONFORMITY_ORIGIN_VALUES = ["audit", "complaint", "process", "supplier", "kpi", "other"];
const IMPROVEMENT_STATUS_VALUES = ["proposed", "in_progress", "implemented", "validated", "closed"];
const IMPROVEMENT_SOURCE_VALUES = [
  "risk_opportunity",
  "audit_recommendation",
  "nonconformity",
  "management_review",
  "other",
];

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
  if (!normalized) {
    throw new Error(`${fieldName} es obligatorio.`);
  }
  return normalized;
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeDate(value, fieldName, { required = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) {
      throw new Error(`${fieldName} es obligatorio.`);
    }
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} invalida.`);
  }
  return normalized;
}

function normalizeOptionalUuid(value, fieldName) {
  if (value == null || value === "") return null;
  const normalized = normalizeUuidOrNull(value);
  if (!normalized) {
    throw new Error(`${fieldName} invalido: debe ser UUID.`);
  }
  return normalized;
}

function normalizeEnum(value, fieldName, allowedValues, { required = true, fallback = null } = {}) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    if (!required) return fallback;
    throw new Error(`${fieldName} es obligatorio.`);
  }
  if (!allowedValues.includes(normalized)) {
    throw new Error(`${fieldName} invalido.`);
  }
  return normalized;
}

function ensureObjectResponse(data, fallbackMessage) {
  if (!data || typeof data !== "object") {
    throw new Error(fallbackMessage);
  }
  return data;
}

function ensureArrayResponse(data, fallbackMessage) {
  if (!Array.isArray(data)) {
    throw new Error(fallbackMessage);
  }
  return data;
}

function withId(data) {
  return { ...data, id: ensureUuid(data.id, "id") };
}

function normalizeContextPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de contexto invalido.");
  }
  const reviewDate = normalizeDate(payload.review_date, "review_date", { required: true });
  const nextReviewDate = normalizeDate(payload.next_review_date, "next_review_date");
  if (reviewDate && nextReviewDate && nextReviewDate < reviewDate) {
    throw new Error("next_review_date no puede ser menor que review_date.");
  }
  return {
    internal_context: normalizeRequiredText(payload.internal_context, "internal_context"),
    external_context: normalizeRequiredText(payload.external_context, "external_context"),
    system_scope: normalizeRequiredText(payload.system_scope, "system_scope"),
    exclusions: normalizeNullableText(payload.exclusions),
    review_date: reviewDate,
    next_review_date: nextReviewDate,
  };
}

export async function fetchIsoContextProfile() {
  const data = await requestJson("/iso-context-profile", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el contexto ISO.",
  });
  if (data == null) return null;
  return ensureObjectResponse(data, "Respuesta invalida al cargar contexto ISO.");
}

export async function upsertIsoContextProfile(payload) {
  const safePayload = normalizeContextPayload(payload);
  const data = await requestJson("/iso-context-profile", {
    method: "PUT",
    body: JSON.stringify(safePayload),
    fallbackMessage: "No se pudo guardar el contexto ISO.",
  });
  return ensureObjectResponse(data, "Respuesta invalida al guardar contexto ISO.");
}

function normalizeInterestedPartyPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de parte interesada invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "name")) {
    safePayload.name = normalizeRequiredText(payload.name, "name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "party_type")) {
    safePayload.party_type = normalizeEnum(payload.party_type, "party_type", PARTY_TYPE_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "needs_expectations")) {
    safePayload.needs_expectations = normalizeRequiredText(payload.needs_expectations, "needs_expectations");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "monitoring_method")) {
    safePayload.monitoring_method = normalizeNullableText(payload.monitoring_method);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "priority")) {
    safePayload.priority = normalizeEnum(payload.priority || "medium", "priority", PRIORITY_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "status")) {
    safePayload.status = normalizeEnum(payload.status || "active", "status", STATUS_ACTIVE_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "review_date")) {
    safePayload.review_date = normalizeDate(payload.review_date, "review_date");
  }
  return safePayload;
}

export async function fetchInterestedParties(filters = {}) {
  const query = toQuery({
    party_type: filters.party_type || null,
    priority: filters.priority || null,
    status: filters.status || null,
  });
  const data = await requestJson(`/iso-interested-parties${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las partes interesadas.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar partes interesadas.");
}

export async function createInterestedParty(payload) {
  const data = await requestJson("/iso-interested-parties", {
    method: "POST",
    body: JSON.stringify(normalizeInterestedPartyPayload(payload)),
    fallbackMessage: "No se pudo crear la parte interesada.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear parte interesada."));
}

export async function patchInterestedParty(partyId, payload) {
  const normalizedId = ensureUuid(partyId, "party_id");
  const data = await requestJson(`/iso-interested-parties/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeInterestedPartyPayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar la parte interesada.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar parte interesada."));
}

export async function deleteInterestedParty(partyId) {
  const normalizedId = ensureUuid(partyId, "party_id");
  await requestJson(`/iso-interested-parties/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar la parte interesada.",
  });
}

function normalizeQualityPolicyPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de politica de calidad invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "client_id")) {
    safePayload.client_id = normalizeOptionalUuid(payload.client_id, "client_id");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "version_label")) {
    safePayload.version_label = normalizeRequiredText(payload.version_label, "version_label");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "policy_text")) {
    safePayload.policy_text = normalizeRequiredText(payload.policy_text, "policy_text");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "approved_by_name")) {
    safePayload.approved_by_name = normalizeNullableText(payload.approved_by_name);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "approved_date")) {
    safePayload.approved_date = normalizeDate(payload.approved_date, "approved_date");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "review_date")) {
    safePayload.review_date = normalizeDate(payload.review_date, "review_date");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "is_active")) {
    safePayload.is_active = Boolean(payload.is_active);
  }
  return safePayload;
}

export async function fetchQualityPolicies(filters = {}) {
  const query = toQuery({
    client_id: filters.client_id || null,
    is_active: filters.is_active == null ? null : String(Boolean(filters.is_active)),
  });
  const data = await requestJson(`/quality-policies${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las politicas de calidad.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar politicas de calidad.");
}

export async function createQualityPolicy(payload) {
  const data = await requestJson("/quality-policies", {
    method: "POST",
    body: JSON.stringify(normalizeQualityPolicyPayload(payload)),
    fallbackMessage: "No se pudo crear la politica de calidad.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear politica de calidad."));
}

export async function patchQualityPolicy(policyId, payload) {
  const normalizedId = ensureUuid(policyId, "policy_id");
  const data = await requestJson(`/quality-policies/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeQualityPolicyPayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar la politica de calidad.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar politica de calidad."));
}

export async function deleteQualityPolicy(policyId) {
  const normalizedId = ensureUuid(policyId, "policy_id");
  await requestJson(`/quality-policies/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar la politica de calidad.",
  });
}

function normalizeRolePayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de rol invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "role_name")) {
    safePayload.role_name = normalizeRequiredText(payload.role_name, "role_name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    safePayload.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsibility_details")) {
    safePayload.responsibility_details = normalizeRequiredText(
      payload.responsibility_details,
      "responsibility_details"
    );
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "related_process")) {
    safePayload.related_process = normalizeNullableText(payload.related_process);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "status")) {
    safePayload.status = normalizeEnum(payload.status || "active", "status", STATUS_ACTIVE_VALUES);
  }
  return safePayload;
}

export async function fetchRoleAssignments(filters = {}) {
  const query = toQuery({ status: filters.status || null });
  const data = await requestJson(`/iso-role-assignments${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los roles.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar roles.");
}

export async function createRoleAssignment(payload) {
  const data = await requestJson("/iso-role-assignments", {
    method: "POST",
    body: JSON.stringify(normalizeRolePayload(payload)),
    fallbackMessage: "No se pudo crear el rol.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear rol."));
}

export async function patchRoleAssignment(roleId, payload) {
  const normalizedId = ensureUuid(roleId, "role_id");
  const data = await requestJson(`/iso-role-assignments/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeRolePayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar el rol.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar rol."));
}

export async function deleteRoleAssignment(roleId) {
  const normalizedId = ensureUuid(roleId, "role_id");
  await requestJson(`/iso-role-assignments/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el rol.",
  });
}

function normalizeProcessPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de proceso invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "name")) {
    safePayload.name = normalizeRequiredText(payload.name, "name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "process_type")) {
    safePayload.process_type = normalizeEnum(payload.process_type, "process_type", PROCESS_TYPE_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "description")) {
    safePayload.description = normalizeRequiredText(payload.description, "description");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "process_inputs")) {
    safePayload.process_inputs = normalizeNullableText(payload.process_inputs);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "process_outputs")) {
    safePayload.process_outputs = normalizeNullableText(payload.process_outputs);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    safePayload.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "position_order")) {
    const parsed = Number.parseInt(String(payload.position_order ?? "0"), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("position_order invalido.");
    }
    safePayload.position_order = parsed;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "status")) {
    safePayload.status = normalizeEnum(payload.status || "active", "status", STATUS_ACTIVE_VALUES);
  }
  return safePayload;
}

export async function fetchProcessMapItems(filters = {}) {
  const query = toQuery({
    process_type: filters.process_type || null,
    status: filters.status || null,
  });
  const data = await requestJson(`/iso-process-map${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los procesos.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar procesos.");
}

export async function createProcessMapItem(payload) {
  const data = await requestJson("/iso-process-map", {
    method: "POST",
    body: JSON.stringify(normalizeProcessPayload(payload)),
    fallbackMessage: "No se pudo crear el proceso.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear proceso."));
}

export async function patchProcessMapItem(processId, payload) {
  const normalizedId = ensureUuid(processId, "process_id");
  const data = await requestJson(`/iso-process-map/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeProcessPayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar el proceso.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar proceso."));
}

export async function deleteProcessMapItem(processId) {
  const normalizedId = ensureUuid(processId, "process_id");
  await requestJson(`/iso-process-map/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el proceso.",
  });
}

function normalizeObjectivePayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de objetivo invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "linked_kpi_id")) {
    safePayload.linked_kpi_id = normalizeOptionalUuid(payload.linked_kpi_id, "linked_kpi_id");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "title")) {
    safePayload.title = normalizeRequiredText(payload.title, "title");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "description")) {
    safePayload.description = normalizeRequiredText(payload.description, "description");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "period_label")) {
    safePayload.period_label = normalizeRequiredText(payload.period_label, "period_label");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    safePayload.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "status")) {
    safePayload.status = normalizeEnum(payload.status || "planned", "status", OBJECTIVE_STATUS_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "tracking_notes")) {
    safePayload.tracking_notes = normalizeNullableText(payload.tracking_notes);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "target_date")) {
    safePayload.target_date = normalizeDate(payload.target_date, "target_date");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "review_date")) {
    safePayload.review_date = normalizeDate(payload.review_date, "review_date");
  }
  return safePayload;
}

export async function fetchObjectiveSummary() {
  const data = await requestJson("/iso-quality-objectives/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de objetivos.",
  });
  return ensureObjectResponse(data, "Respuesta invalida al cargar resumen de objetivos.");
}

export async function fetchQualityObjectives(filters = {}) {
  const query = toQuery({
    status: filters.status || null,
    target_date_from: filters.target_date_from || null,
    target_date_to: filters.target_date_to || null,
  });
  const data = await requestJson(`/iso-quality-objectives${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los objetivos.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar objetivos.");
}

export async function createQualityObjective(payload) {
  const data = await requestJson("/iso-quality-objectives", {
    method: "POST",
    body: JSON.stringify(normalizeObjectivePayload(payload)),
    fallbackMessage: "No se pudo crear el objetivo.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear objetivo."));
}

export async function patchQualityObjective(objectiveId, payload) {
  const normalizedId = ensureUuid(objectiveId, "objective_id");
  const data = await requestJson(`/iso-quality-objectives/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeObjectivePayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar el objetivo.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar objetivo."));
}

export async function deleteQualityObjective(objectiveId) {
  const normalizedId = ensureUuid(objectiveId, "objective_id");
  await requestJson(`/iso-quality-objectives/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el objetivo.",
  });
}

function normalizeChangePlanPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de cambio planificado invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "change_title")) {
    safePayload.change_title = normalizeRequiredText(payload.change_title, "change_title");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "reason")) {
    safePayload.reason = normalizeRequiredText(payload.reason, "reason");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "impact")) {
    safePayload.impact = normalizeRequiredText(payload.impact, "impact");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    safePayload.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "planned_date")) {
    safePayload.planned_date = normalizeDate(payload.planned_date, "planned_date", { required: !partial });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "status")) {
    safePayload.status = normalizeEnum(payload.status || "planned", "status", CHANGE_STATUS_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "followup_notes")) {
    safePayload.followup_notes = normalizeNullableText(payload.followup_notes);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "completion_date")) {
    safePayload.completion_date = normalizeDate(payload.completion_date, "completion_date");
  }
  return safePayload;
}

export async function fetchChangePlans(filters = {}) {
  const query = toQuery({
    status: filters.status || null,
    planned_date_from: filters.planned_date_from || null,
    planned_date_to: filters.planned_date_to || null,
  });
  const data = await requestJson(`/iso-change-plans${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los cambios planificados.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar cambios planificados.");
}

export async function createChangePlan(payload) {
  const data = await requestJson("/iso-change-plans", {
    method: "POST",
    body: JSON.stringify(normalizeChangePlanPayload(payload)),
    fallbackMessage: "No se pudo crear el cambio planificado.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear cambio planificado."));
}

export async function patchChangePlan(changeId, payload) {
  const normalizedId = ensureUuid(changeId, "change_id");
  const data = await requestJson(`/iso-change-plans/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeChangePlanPayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar el cambio planificado.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar cambio planificado."));
}

export async function deleteChangePlan(changeId) {
  const normalizedId = ensureUuid(changeId, "change_id");
  await requestJson(`/iso-change-plans/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el cambio planificado.",
  });
}

function normalizeNonconformityPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de no conformidad invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "client_id")) {
    safePayload.client_id = normalizeOptionalUuid(payload.client_id, "client_id");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "source_recommendation_id")) {
    safePayload.source_recommendation_id = normalizeOptionalUuid(
      payload.source_recommendation_id,
      "source_recommendation_id"
    );
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "linked_action_task_id")) {
    safePayload.linked_action_task_id = normalizeOptionalUuid(payload.linked_action_task_id, "linked_action_task_id");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "origin_type")) {
    safePayload.origin_type = normalizeEnum(payload.origin_type, "origin_type", NONCONFORMITY_ORIGIN_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "title")) {
    safePayload.title = normalizeRequiredText(payload.title, "title");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "description")) {
    safePayload.description = normalizeRequiredText(payload.description, "description");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "cause_analysis")) {
    safePayload.cause_analysis = normalizeNullableText(payload.cause_analysis);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "immediate_correction")) {
    safePayload.immediate_correction = normalizeNullableText(payload.immediate_correction);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "corrective_action")) {
    safePayload.corrective_action = normalizeNullableText(payload.corrective_action);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    safePayload.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "due_date")) {
    safePayload.due_date = normalizeDate(payload.due_date, "due_date");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "effectiveness_verification")) {
    safePayload.effectiveness_verification = normalizeNullableText(payload.effectiveness_verification);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "verification_date")) {
    safePayload.verification_date = normalizeDate(payload.verification_date, "verification_date");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "status")) {
    safePayload.status = normalizeEnum(payload.status || "open", "status", NONCONFORMITY_STATUS_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "closure_notes")) {
    safePayload.closure_notes = normalizeNullableText(payload.closure_notes);
  }
  return safePayload;
}

export async function fetchNonconformitySummary() {
  const data = await requestJson("/iso-nonconformities/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de no conformidades.",
  });
  return ensureObjectResponse(data, "Respuesta invalida al cargar resumen de no conformidades.");
}

export async function fetchNonconformities(filters = {}) {
  const query = toQuery({
    status: filters.status || null,
    origin_type: filters.origin_type || null,
    due_date_from: filters.due_date_from || null,
    due_date_to: filters.due_date_to || null,
    client_id: filters.client_id || null,
  });
  const data = await requestJson(`/iso-nonconformities${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las no conformidades.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar no conformidades.");
}

export async function createNonconformity(payload) {
  const data = await requestJson("/iso-nonconformities", {
    method: "POST",
    body: JSON.stringify(normalizeNonconformityPayload(payload)),
    fallbackMessage: "No se pudo crear la no conformidad.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear no conformidad."));
}

export async function patchNonconformity(nonconformityId, payload) {
  const normalizedId = ensureUuid(nonconformityId, "nonconformity_id");
  const data = await requestJson(`/iso-nonconformities/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeNonconformityPayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar la no conformidad.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar no conformidad."));
}

export async function deleteNonconformity(nonconformityId) {
  const normalizedId = ensureUuid(nonconformityId, "nonconformity_id");
  await requestJson(`/iso-nonconformities/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar la no conformidad.",
  });
}

function normalizeImprovementPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload de mejora invalido.");
  }
  const safePayload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "linked_nonconformity_id")) {
    safePayload.linked_nonconformity_id = normalizeOptionalUuid(
      payload.linked_nonconformity_id,
      "linked_nonconformity_id"
    );
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "source_type")) {
    safePayload.source_type = normalizeEnum(payload.source_type || "other", "source_type", IMPROVEMENT_SOURCE_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "source_id")) {
    safePayload.source_id = normalizeOptionalUuid(payload.source_id, "source_id");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "title")) {
    safePayload.title = normalizeRequiredText(payload.title, "title");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "description")) {
    safePayload.description = normalizeRequiredText(payload.description, "description");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "action_plan")) {
    safePayload.action_plan = normalizeRequiredText(payload.action_plan, "action_plan");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "responsible_name")) {
    safePayload.responsible_name = normalizeRequiredText(payload.responsible_name, "responsible_name");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "status")) {
    safePayload.status = normalizeEnum(payload.status || "proposed", "status", IMPROVEMENT_STATUS_VALUES);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "due_date")) {
    safePayload.due_date = normalizeDate(payload.due_date, "due_date");
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "followup_notes")) {
    safePayload.followup_notes = normalizeNullableText(payload.followup_notes);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "benefit_observed")) {
    safePayload.benefit_observed = normalizeNullableText(payload.benefit_observed);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(payload, "review_date")) {
    safePayload.review_date = normalizeDate(payload.review_date, "review_date");
  }
  return safePayload;
}

export async function fetchImprovementSummary() {
  const data = await requestJson("/iso-improvements/summary", {
    method: "GET",
    fallbackMessage: "No se pudo cargar el resumen de mejoras.",
  });
  return ensureObjectResponse(data, "Respuesta invalida al cargar resumen de mejoras.");
}

export async function fetchImprovements(filters = {}) {
  const query = toQuery({
    status: filters.status || null,
    source_type: filters.source_type || null,
    due_date_from: filters.due_date_from || null,
    due_date_to: filters.due_date_to || null,
  });
  const data = await requestJson(`/iso-improvements${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las mejoras.",
  });
  return ensureArrayResponse(data, "Respuesta invalida al listar mejoras.");
}

export async function createImprovement(payload) {
  const data = await requestJson("/iso-improvements", {
    method: "POST",
    body: JSON.stringify(normalizeImprovementPayload(payload)),
    fallbackMessage: "No se pudo crear la mejora.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al crear mejora."));
}

export async function patchImprovement(improvementId, payload) {
  const normalizedId = ensureUuid(improvementId, "improvement_id");
  const data = await requestJson(`/iso-improvements/${normalizedId}`, {
    method: "PATCH",
    body: JSON.stringify(normalizeImprovementPayload(payload, { partial: true })),
    fallbackMessage: "No se pudo actualizar la mejora.",
  });
  return withId(ensureObjectResponse(data, "Respuesta invalida al actualizar mejora."));
}

export async function deleteImprovement(improvementId) {
  const normalizedId = ensureUuid(improvementId, "improvement_id");
  await requestJson(`/iso-improvements/${normalizedId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar la mejora.",
  });
}

export const ISO_MANAGEMENT_OPTIONS = {
  statusActive: STATUS_ACTIVE_VALUES,
  partyTypes: PARTY_TYPE_VALUES,
  priorityValues: PRIORITY_VALUES,
  processTypes: PROCESS_TYPE_VALUES,
  objectiveStatus: OBJECTIVE_STATUS_VALUES,
  changeStatus: CHANGE_STATUS_VALUES,
  nonconformityStatus: NONCONFORMITY_STATUS_VALUES,
  nonconformityOrigin: NONCONFORMITY_ORIGIN_VALUES,
  improvementStatus: IMPROVEMENT_STATUS_VALUES,
  improvementSource: IMPROVEMENT_SOURCE_VALUES,
};
