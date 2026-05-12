import { requestBlob, requestJson } from "./httpClient";
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

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export async function fetchAuditReports(filters = {}) {
  const query = toQuery({
    client_id: filters.client_id ? ensureUuid(filters.client_id, "client_id") : null,
    report_year: filters.report_year,
    status: filters.status,
  });

  const data = await requestJson(`/audit-reports${query}`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las auditorías.",
  });

  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al listar auditorías.");
  }

  return data;
}

export async function createAuditReport(payload) {
  const safePayload = {
    client_id: ensureUuid(payload?.client_id, "client_id"),
    report_year: Number(payload?.report_year),
    template_code: String(payload?.template_code || "P03"),
    entity_name: normalizeNullableText(payload?.entity_name),
    auditor_organization: normalizeNullableText(payload?.auditor_organization),
    audited_area: normalizeNullableText(payload?.audited_area),
    audit_date: normalizeNullableText(payload?.audit_date),
    tipo_auditoria: normalizeNullableText(payload?.tipo_auditoria),
    modalidad: normalizeNullableText(payload?.modalidad),
    audited_facilities: normalizeNullableText(payload?.audited_facilities),
    quality_responsible_name: normalizeNullableText(payload?.quality_responsible_name),
    reference_standard_revision: normalizeNullableText(payload?.reference_standard_revision),
    audit_budget_code: normalizeNullableText(payload?.audit_budget_code),
    system_scope: normalizeNullableText(payload?.system_scope),
    audit_description: normalizeNullableText(payload?.audit_description),
  };
  if (!Number.isFinite(safePayload.report_year)) {
    throw new Error("report_year inválido.");
  }

  const data = await requestJson("/audit-reports", {
    method: "POST",
    body: JSON.stringify(safePayload),
    timeoutMs: 60000,
    fallbackMessage: "No se pudo crear la auditoría.",
  });

  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Respuesta inválida al crear auditoría.");
  }
  return data;
}

export async function deleteAuditReport(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  await requestJson(`/audit-reports/${normalizedReportId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar la auditoría.",
  });
}

export async function fetchAuditReportDetail(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar el detalle de la auditoría.",
  });
  if (!data || typeof data !== "object" || typeof data.report !== "object") {
    throw new Error("Respuesta inválida al cargar detalle de auditoría.");
  }
  return data;
}

export async function fetchAuditCompliance(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/compliance`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar el compliance de la auditoria.",
  });
  if (!data || typeof data !== "object" || !Array.isArray(data.blocks)) {
    throw new Error("Respuesta invalida al cargar compliance.");
  }
  return data;
}

export async function fetchAuditIsoWorkbench(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/iso-workbench`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar el flujo ISO de la auditoria.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al cargar flujo ISO de auditoria.");
  }
  return data;
}

export async function patchAuditReport(reportId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
    fallbackMessage: "No se pudo actualizar la cabecera de auditoría.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al actualizar auditoría.");
  }
  return data;
}

export async function fetchAuditSections(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/sections`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las secciones.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al cargar secciones.");
  }
  return data;
}

export async function patchAuditSection(reportId, sectionCode, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const code = String(sectionCode || "").trim();
  if (!code) {
    throw new Error("section_code inválido.");
  }
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/sections/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
      fallbackMessage: "No se pudo actualizar la sección.",
    }
  );
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al actualizar sección.");
  }
  return data;
}

export async function putAuditSectionItems(reportId, sectionCode, items) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const code = String(sectionCode || "").trim();
  if (!code) {
    throw new Error("section_code inválido.");
  }
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/sections/${encodeURIComponent(code)}/items`,
    {
      method: "PUT",
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
      fallbackMessage: "No se pudieron guardar los ítems de la sección.",
    }
  );
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al guardar ítems.");
  }
  return data;
}

export async function fetchAuditInterestedPartiesDocument(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/interested-parties-document`,
    {
      method: "GET",
      fallbackMessage: "No se pudo cargar el documento P09 de partes interesadas.",
    }
  );
  if (data == null) {
    return null;
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
    throw new Error("Respuesta invalida al cargar documento P09.");
  }
  return data;
}

export async function putAuditInterestedPartiesDocument(reportId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/interested-parties-document`,
    {
      method: "PUT",
      body: JSON.stringify(payload || {}),
      fallbackMessage: "No se pudo guardar el documento P09 de partes interesadas.",
    }
  );
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
    throw new Error("Respuesta invalida al guardar documento P09.");
  }
  return data;
}

export async function fetchAuditContextDocument(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/context-document`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar el documento P09 de contexto.",
  });
  if (data == null) {
    return null;
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
    throw new Error("Respuesta invalida al cargar documento de contexto.");
  }
  return data;
}

export async function putAuditContextDocument(reportId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/context-document`, {
    method: "PUT",
    body: JSON.stringify(payload || {}),
    fallbackMessage: "No se pudo guardar el documento P09 de contexto.",
  });
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
    throw new Error("Respuesta invalida al guardar documento de contexto.");
  }
  return data;
}

export async function fetchAuditRiskOpportunityDocument(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/risk-opportunity-document`,
    {
      method: "GET",
      fallbackMessage: "No se pudo cargar el documento P09 de riesgos y oportunidades.",
    }
  );
  if (data == null) {
    return null;
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
    throw new Error("Respuesta invalida al cargar documento de riesgos y oportunidades.");
  }
  return data;
}

export async function putAuditRiskOpportunityDocument(reportId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/risk-opportunity-document`,
    {
      method: "PUT",
      body: JSON.stringify(payload || {}),
      fallbackMessage: "No se pudo guardar el documento P09 de riesgos y oportunidades.",
    }
  );
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
    throw new Error("Respuesta invalida al guardar documento de riesgos y oportunidades.");
  }
  return data;
}

export async function fetchAuditClauseChecks(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/clause-checks`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los checks de cláusulas.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al cargar checks.");
  }
  return data;
}

export async function putAuditClauseChecks(reportId, clauseChecks) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/clause-checks`, {
    method: "PUT",
    body: JSON.stringify({ clause_checks: Array.isArray(clauseChecks) ? clauseChecks : [] }),
    fallbackMessage: "No se pudieron guardar los checks de cláusulas.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al guardar checks.");
  }
  return data;
}

export async function fetchAuditInterviewees(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/interviewees`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los entrevistados.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al cargar entrevistados.");
  }
  return data;
}

export async function createAuditInterviewee(reportId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/interviewees`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    fallbackMessage: "No se pudo crear el entrevistado.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al crear entrevistado.");
  }
  return data;
}

export async function deleteAuditInterviewee(reportId, intervieweeId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const normalizedIntervieweeId = ensureUuid(intervieweeId, "interviewee_id");
  await requestJson(
    `/audit-reports/${normalizedReportId}/interviewees/${normalizedIntervieweeId}`,
    {
      method: "DELETE",
      fallbackMessage: "No se pudo eliminar el entrevistado.",
    }
  );
}

export async function fetchAuditRecommendations(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/recommendations`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar las recomendaciones.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al cargar recomendaciones.");
  }
  return data;
}

export async function createAuditRecommendation(reportId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/recommendations`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    fallbackMessage: "No se pudo crear la recomendación.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al crear recomendación.");
  }
  return data;
}

export async function patchAuditRecommendation(reportId, recommendationId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const normalizedRecommendationId = ensureUuid(recommendationId, "recommendation_id");
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/recommendations/${normalizedRecommendationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
      fallbackMessage: "No se pudo actualizar la recomendación.",
    }
  );
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta inválida al actualizar recomendación.");
  }
  return data;
}

export async function deleteAuditRecommendation(reportId, recommendationId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const normalizedRecommendationId = ensureUuid(recommendationId, "recommendation_id");
  await requestJson(
    `/audit-reports/${normalizedReportId}/recommendations/${normalizedRecommendationId}`,
    {
      method: "DELETE",
      fallbackMessage: "No se pudo eliminar la recomendación.",
    }
  );
}

export async function fetchAuditAnnexes(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/annexes`, {
    method: "GET",
    fallbackMessage: "No se pudieron cargar los anexos.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta invalida al cargar anexos.");
  }
  return data;
}

export async function createAuditAnnex(reportId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/annexes`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    fallbackMessage: "No se pudo crear el anexo.",
  });
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al crear anexo.");
  }
  return data;
}

export async function patchAuditAnnex(reportId, annexId, payload) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const normalizedAnnexId = ensureUuid(annexId, "annex_id");
  const data = await requestJson(
    `/audit-reports/${normalizedReportId}/annexes/${normalizedAnnexId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
      fallbackMessage: "No se pudo actualizar el anexo.",
    }
  );
  if (!data || typeof data !== "object") {
    throw new Error("Respuesta invalida al actualizar anexo.");
  }
  return data;
}

export async function deleteAuditAnnex(reportId, annexId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const normalizedAnnexId = ensureUuid(annexId, "annex_id");
  await requestJson(`/audit-reports/${normalizedReportId}/annexes/${normalizedAnnexId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo eliminar el anexo.",
  });
}

export async function fetchAuditRecommendationHistory(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const data = await requestJson(`/audit-reports/${normalizedReportId}/history/recommendations`, {
    method: "GET",
    fallbackMessage: "No se pudo cargar el histórico de recomendaciones.",
  });
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida al cargar histórico.");
  }
  return data;
}

export async function exportAuditReportDocx(reportId) {
  const normalizedReportId = ensureUuid(reportId, "report_id");
  const blob = await requestBlob(`/audit-reports/${normalizedReportId}/exportar`, {
    method: "POST",
    timeoutMs: 180000,
    fallbackMessage: "No se pudo exportar el informe en DOCX.",
  });

  const safeFileName = `informe-auditoria-${normalizedReportId}.docx`;
  const objectUrl = window.URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }
}
