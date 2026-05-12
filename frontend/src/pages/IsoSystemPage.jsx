import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RichTextarea from "../components/RichTextarea";

import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { normalizeUuidOrNull } from "../utils/uuid";
import { fetchClients } from "../api/clientsApi";
import { fetchKpis } from "../api/kpisApi";
import {
  ISO_MANAGEMENT_OPTIONS,
  createChangePlan,
  createInterestedParty,
  createProcessMapItem,
  createQualityObjective,
  createQualityPolicy,
  createRoleAssignment,
  deleteChangePlan,
  deleteInterestedParty,
  deleteProcessMapItem,
  deleteQualityObjective,
  deleteQualityPolicy,
  deleteRoleAssignment,
  fetchChangePlans,
  fetchInterestedParties,
  fetchIsoContextProfile,
  fetchObjectiveSummary,
  fetchProcessMapItems,
  fetchQualityObjectives,
  fetchQualityPolicies,
  fetchRoleAssignments,
  patchChangePlan,
  patchInterestedParty,
  patchProcessMapItem,
  patchQualityObjective,
  patchQualityPolicy,
  patchRoleAssignment,
  upsertIsoContextProfile,
} from "../api/isoManagementApi";

const EMPTY_CONTEXT = {
  internal_context: "",
  external_context: "",
  system_scope: "",
  exclusions: "",
  review_date: "",
  next_review_date: "",
};

const EMPTY_PARTY = {
  name: "",
  party_type: "internal",
  needs_expectations: "",
  monitoring_method: "",
  priority: "medium",
  status: "active",
  review_date: "",
};

const EMPTY_POLICY = {
  client_id: "",
  version_label: "",
  policy_text: "",
  approved_by_name: "",
  approved_date: "",
  review_date: "",
  is_active: true,
};

const EMPTY_ROLE = {
  role_name: "",
  responsible_name: "",
  responsibility_details: "",
  related_process: "",
  status: "active",
};

const EMPTY_PROCESS = {
  name: "",
  process_type: "strategic",
  description: "",
  process_inputs: "",
  process_outputs: "",
  responsible_name: "",
  position_order: 100,
  status: "active",
};

const EMPTY_OBJECTIVE = {
  linked_kpi_id: "",
  title: "",
  description: "",
  period_label: "",
  responsible_name: "",
  status: "planned",
  tracking_notes: "",
  target_date: "",
  review_date: "",
};

const EMPTY_CHANGE = {
  change_title: "",
  reason: "",
  impact: "",
  responsible_name: "",
  planned_date: "",
  status: "planned",
  followup_notes: "",
  completion_date: "",
};

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function mapStatusToBadge(status) {
  if (status === "completed" || status === "closed" || status === "validated" || status === "active") {
    return "completed";
  }
  if (status === "in_progress" || status === "pending_verification" || status === "implemented") {
    return "in_progress";
  }
  if (status === "inactive" || status === "cancelled" || status === "on_hold") {
    return "draft";
  }
  return "pending";
}

function IsoSystemPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [contextForm, setContextForm] = useState(EMPTY_CONTEXT);
  const [parties, setParties] = useState([]);
  const [partyForm, setPartyForm] = useState(EMPTY_PARTY);
  const [editingPartyId, setEditingPartyId] = useState("");

  const [policies, setPolicies] = useState([]);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY);
  const [editingPolicyId, setEditingPolicyId] = useState("");

  const [roles, setRoles] = useState([]);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE);
  const [editingRoleId, setEditingRoleId] = useState("");

  const [processes, setProcesses] = useState([]);
  const [processForm, setProcessForm] = useState(EMPTY_PROCESS);
  const [editingProcessId, setEditingProcessId] = useState("");

  const [objectiveSummary, setObjectiveSummary] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [objectiveForm, setObjectiveForm] = useState(EMPTY_OBJECTIVE);
  const [editingObjectiveId, setEditingObjectiveId] = useState("");

  const [changePlans, setChangePlans] = useState([]);
  const [changeForm, setChangeForm] = useState(EMPTY_CHANGE);
  const [editingChangeId, setEditingChangeId] = useState("");

  const [clients, setClients] = useState([]);
  const [kpis, setKpis] = useState([]);

  const clientOptions = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const kpiOptions = useMemo(() => (Array.isArray(kpis) ? kpis : []), [kpis]);
  const contextReportId = normalizeUuidOrNull(searchParams.get("report_id"));
  const contextClientId = normalizeUuidOrNull(searchParams.get("client_id"));
  const contextReportYear = String(searchParams.get("report_year") || "").trim();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        contextData,
        partiesData,
        policiesData,
        rolesData,
        processData,
        objectiveSummaryData,
        objectivesData,
        changeData,
        clientsData,
        kpisData,
      ] = await Promise.all([
        fetchIsoContextProfile(),
        fetchInterestedParties(),
        fetchQualityPolicies(),
        fetchRoleAssignments(),
        fetchProcessMapItems(),
        fetchObjectiveSummary(),
        fetchQualityObjectives(),
        fetchChangePlans(),
        fetchClients(),
        fetchKpis(),
      ]);

      if (contextData && typeof contextData === "object") {
        setContextForm({
          internal_context: contextData.internal_context || "",
          external_context: contextData.external_context || "",
          system_scope: contextData.system_scope || "",
          exclusions: contextData.exclusions || "",
          review_date: contextData.review_date || "",
          next_review_date: contextData.next_review_date || "",
        });
      } else {
        setContextForm(EMPTY_CONTEXT);
      }
setParties(Array.isArray(partiesData) ? partiesData : []);
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setProcesses(Array.isArray(processData) ? processData : []);
      setObjectiveSummary(objectiveSummaryData && typeof objectiveSummaryData === "object" ? objectiveSummaryData : null);
      setObjectives(Array.isArray(objectivesData) ? objectivesData : []);
      setChangePlans(Array.isArray(changeData) ? changeData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setKpis(Array.isArray(kpisData) ? kpisData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos del sistema ISO.");
      setParties([]);
      setPolicies([]);
      setRoles([]);
      setProcesses([]);
      setObjectiveSummary(null);
      setObjectives([]);
      setChangePlans([]);
      setClients([]);
      setKpis([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (editingPolicyId) return;
    if (!contextClientId) return;
    setPolicyForm((prev) => ({ ...prev, client_id: prev.client_id || contextClientId }));
  }, [contextClientId, editingPolicyId]);

  function setMessage(message) {
    setStatusMessage(message);
    setError("");
  }

  async function handleSaveContext(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      await upsertIsoContextProfile({
        internal_context: contextForm.internal_context,
        external_context: contextForm.external_context,
        system_scope: contextForm.system_scope,
        exclusions: normalizeNullableText(contextForm.exclusions),
        review_date: contextForm.review_date,
        next_review_date: normalizeNullableText(contextForm.next_review_date),
      });
      setMessage("Contexto y alcance ISO actualizados.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el contexto ISO.");
    } finally {
      setSaving(false);
    }
  }

  function startEditParty(item) {
    setEditingPartyId(item.id);
    setPartyForm({
      name: item.name || "",
      party_type: item.party_type || "internal",
      needs_expectations: item.needs_expectations || "",
      monitoring_method: item.monitoring_method || "",
      priority: item.priority || "medium",
      status: item.status || "active",
      review_date: item.review_date || "",
    });
  }

  async function handleSaveParty(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const payload = {
        name: partyForm.name,
        party_type: partyForm.party_type,
        needs_expectations: partyForm.needs_expectations,
        monitoring_method: normalizeNullableText(partyForm.monitoring_method),
        priority: partyForm.priority,
        status: partyForm.status,
        review_date: normalizeNullableText(partyForm.review_date),
      };
      if (editingPartyId) {
        await patchInterestedParty(editingPartyId, payload);
        setMessage("Parte interesada actualizada.");
      } else {
        await createInterestedParty(payload);
        setMessage("Parte interesada creada.");
      }
      setPartyForm(EMPTY_PARTY);
      setEditingPartyId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la parte interesada.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteParty(partyId) {
    if (!window.confirm("Se eliminara la parte interesada. Continuar")) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      await deleteInterestedParty(partyId);
      if (editingPartyId === partyId) {
        setEditingPartyId("");
        setPartyForm(EMPTY_PARTY);
      }
      setMessage("Parte interesada eliminada.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la parte interesada.");
    } finally {
      setSaving(false);
    }
  }

  function startEditPolicy(item) {
    setEditingPolicyId(item.id);
    setPolicyForm({
      client_id: item.client_id || "",
      version_label: item.version_label || "",
      policy_text: item.policy_text || "",
      approved_by_name: item.approved_by_name || "",
      approved_date: item.approved_date || "",
      review_date: item.review_date || "",
      is_active: Boolean(item.is_active),
    });
  }

  async function handleSavePolicy(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const payload = {
        client_id: normalizeNullableText(policyForm.client_id),
        version_label: policyForm.version_label,
        policy_text: policyForm.policy_text,
        approved_by_name: normalizeNullableText(policyForm.approved_by_name),
        approved_date: normalizeNullableText(policyForm.approved_date),
        review_date: normalizeNullableText(policyForm.review_date),
        is_active: Boolean(policyForm.is_active),
      };
      if (editingPolicyId) {
        await patchQualityPolicy(editingPolicyId, payload);
        setMessage("Política de calidad actualizada.");
      } else {
        await createQualityPolicy(payload);
        setMessage("Política de calidad creada.");
      }
      setPolicyForm(EMPTY_POLICY);
      setEditingPolicyId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la política de calidad.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePolicy(policyId) {
    if (!window.confirm("Se eliminara la política de calidad. Continuar")) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      await deleteQualityPolicy(policyId);
      if (editingPolicyId === policyId) {
        setEditingPolicyId("");
        setPolicyForm(EMPTY_POLICY);
      }
      setMessage("Política de calidad eliminada.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la política de calidad.");
    } finally {
      setSaving(false);
    }
  }

  function startEditRole(item) {
    setEditingRoleId(item.id);
    setRoleForm({
      role_name: item.role_name || "",
      responsible_name: item.responsible_name || "",
      responsibility_details: item.responsibility_details || "",
      related_process: item.related_process || "",
      status: item.status || "active",
    });
  }

  async function handleSaveRole(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const payload = {
        role_name: roleForm.role_name,
        responsible_name: roleForm.responsible_name,
        responsibility_details: roleForm.responsibility_details,
        related_process: normalizeNullableText(roleForm.related_process),
        status: roleForm.status,
      };
      if (editingRoleId) {
        await patchRoleAssignment(editingRoleId, payload);
        setMessage("Rol actualizado.");
      } else {
        await createRoleAssignment(payload);
        setMessage("Rol creado.");
      }
      setRoleForm(EMPTY_ROLE);
      setEditingRoleId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el rol.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRole(roleId) {
    if (!window.confirm("Se eliminara el rol. Continuar")) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      await deleteRoleAssignment(roleId);
      if (editingRoleId === roleId) {
        setEditingRoleId("");
        setRoleForm(EMPTY_ROLE);
      }
      setMessage("Rol eliminado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el rol.");
    } finally {
      setSaving(false);
    }
  }

  function startEditProcess(item) {
    setEditingProcessId(item.id);
    setProcessForm({
      name: item.name || "",
      process_type: item.process_type || "strategic",
      description: item.description || "",
      process_inputs: item.process_inputs || "",
      process_outputs: item.process_outputs || "",
      responsible_name: item.responsible_name || "",
      position_order: Number(item.position_order ?? 100),
      status: item.status || "active",
    });
  }

  async function handleSaveProcess(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const payload = {
        name: processForm.name,
        process_type: processForm.process_type,
        description: processForm.description,
        process_inputs: normalizeNullableText(processForm.process_inputs),
        process_outputs: normalizeNullableText(processForm.process_outputs),
        responsible_name: processForm.responsible_name,
        position_order: Number(processForm.position_order),
        status: processForm.status,
      };
      if (editingProcessId) {
        await patchProcessMapItem(editingProcessId, payload);
        setMessage("Proceso actualizado.");
      } else {
        await createProcessMapItem(payload);
        setMessage("Proceso creado.");
      }
      setProcessForm(EMPTY_PROCESS);
      setEditingProcessId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el proceso.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProcess(processId) {
    if (!window.confirm("Se eliminara el proceso. Continuar")) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      await deleteProcessMapItem(processId);
      if (editingProcessId === processId) {
        setEditingProcessId("");
        setProcessForm(EMPTY_PROCESS);
      }
      setMessage("Proceso eliminado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el proceso.");
    } finally {
      setSaving(false);
    }
  }

  function startEditObjective(item) {
    setEditingObjectiveId(item.id);
    setObjectiveForm({
      linked_kpi_id: item.linked_kpi_id || "",
      title: item.title || "",
      description: item.description || "",
      period_label: item.period_label || "",
      responsible_name: item.responsible_name || "",
      status: item.status || "planned",
      tracking_notes: item.tracking_notes || "",
      target_date: item.target_date || "",
      review_date: item.review_date || "",
    });
  }

  async function handleSaveObjective(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const payload = {
        linked_kpi_id: normalizeNullableText(objectiveForm.linked_kpi_id),
        title: objectiveForm.title,
        description: objectiveForm.description,
        period_label: objectiveForm.period_label,
        responsible_name: objectiveForm.responsible_name,
        status: objectiveForm.status,
        tracking_notes: normalizeNullableText(objectiveForm.tracking_notes),
        target_date: normalizeNullableText(objectiveForm.target_date),
        review_date: normalizeNullableText(objectiveForm.review_date),
      };
      if (editingObjectiveId) {
        await patchQualityObjective(editingObjectiveId, payload);
        setMessage("Objetivo actualizado.");
      } else {
        await createQualityObjective(payload);
        setMessage("Objetivo creado.");
      }
      setObjectiveForm(EMPTY_OBJECTIVE);
      setEditingObjectiveId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el objetivo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteObjective(objectiveId) {
    if (!window.confirm("Se eliminara el objetivo. Continuar")) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      await deleteQualityObjective(objectiveId);
      if (editingObjectiveId === objectiveId) {
        setEditingObjectiveId("");
        setObjectiveForm(EMPTY_OBJECTIVE);
      }
      setMessage("Objetivo eliminado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el objetivo.");
    } finally {
      setSaving(false);
    }
  }

  function startEditChange(item) {
    setEditingChangeId(item.id);
    setChangeForm({
      change_title: item.change_title || "",
      reason: item.reason || "",
      impact: item.impact || "",
      responsible_name: item.responsible_name || "",
      planned_date: item.planned_date || "",
      status: item.status || "planned",
      followup_notes: item.followup_notes || "",
      completion_date: item.completion_date || "",
    });
  }

  async function handleSaveChange(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      const payload = {
        change_title: changeForm.change_title,
        reason: changeForm.reason,
        impact: changeForm.impact,
        responsible_name: changeForm.responsible_name,
        planned_date: changeForm.planned_date,
        status: changeForm.status,
        followup_notes: normalizeNullableText(changeForm.followup_notes),
        completion_date: normalizeNullableText(changeForm.completion_date),
      };
      if (editingChangeId) {
        await patchChangePlan(editingChangeId, payload);
        setMessage("Cambio planificado actualizado.");
      } else {
        await createChangePlan(payload);
        setMessage("Cambio planificado creado.");
      }
      setChangeForm(EMPTY_CHANGE);
      setEditingChangeId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio planificado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteChange(changeId) {
    if (!window.confirm("Se eliminara el cambio planificado. Continuar")) return;
    setSaving(true);
    setStatusMessage("");
    setError("");
    try {
      await deleteChangePlan(changeId);
      if (editingChangeId === changeId) {
        setEditingChangeId("");
        setChangeForm(EMPTY_CHANGE);
      }
      setMessage("Cambio planificado eliminado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el cambio planificado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="ISO 9001"
        title="Sistema ISO"
        description="Contexto, partes interesadas, política, roles, procesos, objetivos y cambios."
        actions={contextReportId ? (
            <Link className="btn-ghost link-btn" to={`/auditorias/${contextReportId}/editar`}>
              Volver a auditoría
            </Link>
          ) : null
        }
      />
      {contextReportId ? (
        <p className="status">
          Contexto de auditoría activo {contextReportId}
{contextReportYear ? ` · Año ${contextReportYear}` : ""}. Completa aquí los bloques base antes de cerrar
          la auditoría.
        </p>
      ) : null}
{statusMessage ? <p className="status">{statusMessage}</p> : null}
{error ? <p className="status error">{error}</p> : null}
{loading ? <p className="status">Cargando informacion del sistema ISO...</p> : null}

      {!loading ? (
        <>
          <SectionCard title="Contexto y alcance" description="Contexto interno/externo, alcance y exclusiones.">
            <form className="form-grid" onSubmit={handleSaveContext}>
              <label className="field-stack">
                <span>Contexto interno *</span>
                <RichTextarea
                  className="input-textarea"
                  value={contextForm.internal_context} onChange={(event) => setContextForm((prev) => ({ ...prev, internal_context : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-stack">
                <span>Contexto externo *</span>
                <RichTextarea
                  className="input-textarea"
                  value={contextForm.external_context} onChange={(event) => setContextForm((prev) => ({ ...prev, external_context : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-stack">
                <span>Alcance del sistema *</span>
                <RichTextarea
                  className="input-textarea"
                  value={contextForm.system_scope} onChange={(event) => setContextForm((prev) => ({ ...prev, system_scope : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-stack">
                <span>Exclusiones</span>
                <RichTextarea
                  className="input-textarea"
                  value={contextForm.exclusions} onChange={(event) => setContextForm((prev) => ({ ...prev, exclusions : event.target.value }))}
                  disabled={saving}
                />
              </label>
              <div className="inline-actions">
                <label className="field-inline">
                  <span>Revisión actual *</span>
                  <input
                    className="input-text"
                    type="date"
                    value={contextForm.review_date} onChange={(event) => setContextForm((prev) => ({ ...prev, review_date : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-inline">
                  <span>Próxima revisión</span>
                  <input
                    className="input-text"
                    type="date"
                    value={contextForm.next_review_date}
                    onChange={(event) =>
                      setContextForm((prev) => ({ ...prev, next_review_date: event.target.value }))
                    }
                    disabled={saving}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar contexto"}
                </button>
              </div>
            </form>
          </SectionCard>

          <div className="layout-grid two-columns">
            <SectionCard title={editingPartyId ? "Editar parte interesada" : "Partes interesadas"}
              description="Necesidades, expectativas y seguimiento."
            >
              <form className="form-grid" onSubmit={handleSaveParty}>
                <label className="field-stack">
                  <span>Nombre *</span>
                  <input
                    className="input-text"
                    value={partyForm.name} onChange={(event) => setPartyForm((prev) => ({ ...prev, name : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Necesidades y expectativas *</span>
                  <RichTextarea
                    className="input-textarea"
                    value={partyForm.needs_expectations}
                    onChange={(event) =>
                      setPartyForm((prev) => ({ ...prev, needs_expectations: event.target.value }))
                    }
                    required
                    disabled={saving}
                  />
                </label>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Tipo</span>
                    <select
                      className="input-select"
                      value={partyForm.party_type} onChange={(event) => setPartyForm((prev) => ({ ...prev, party_type : event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.partyTypes.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Prioridad</span>
                    <select
                      className="input-select"
                      value={partyForm.priority} onChange={(event) => setPartyForm((prev) => ({ ...prev, priority : event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.priorityValues.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Estado</span>
                    <select
                      className="input-select"
                      value={partyForm.status} onChange={(event) => setPartyForm((prev) => ({ ...prev, status : event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.statusActive.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {editingPartyId ? "Actualizar parte" : "Crear parte"}
                  </button>
                  {editingPartyId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingPartyId("");
                        setPartyForm(EMPTY_PARTY);
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="stack-list">
                {parties.map((item) => (
                  <article key={item.id} className="diagnostic-list-item">
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{item.name}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={mapStatusToBadge(item.status)} label={item.status} />
                        <span>Tipo: {item.party_type}</span>
                        <span>Prioridad: {item.priority}</span>
                        <span>Revisión: {formatDate(item.review_date)}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <button type="button" className="btn-secondary" onClick={() => startEditParty(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleDeleteParty(item.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={editingPolicyId ? "Editar política de calidad" : "Política de calidad"}
              description="Versiónado y activacion por cliente año general."
            >
              <form className="form-grid" onSubmit={handleSavePolicy}>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Cliente</span>
                    <select
                      className="input-select"
                      value={policyForm.client_id} onChange={(event) => setPolicyForm((prev) => ({ ...prev, client_id : event.target.value }))}
                    >
                      <option value="">General consultoria</option>
                      {clientOptions.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Versión *</span>
                    <input
                      className="input-text"
                      value={policyForm.version_label} onChange={(event) => setPolicyForm((prev) => ({ ...prev, version_label : event.target.value }))}
                      required
                      disabled={saving}
                    />
                  </label>
                </div>
                <label className="field-stack">
                  <span>Política *</span>
                  <RichTextarea
                    className="input-textarea"
                    value={policyForm.policy_text} onChange={(event) => setPolicyForm((prev) => ({ ...prev, policy_text : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-inline">
                  <input
                    type="checkbox"
                    checked={Boolean(policyForm.is_active)} onChange={(event) => setPolicyForm((prev) => ({ ...prev, is_active : event.target.checked }))}
                  />
                  <span>Política activa</span>
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {editingPolicyId ? "Actualizar política" : "Crear política"}
                  </button>
                  {editingPolicyId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingPolicyId("");
                        setPolicyForm(EMPTY_POLICY);
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="stack-list">
                {policies.map((item) => (
                  <article key={item.id} className="diagnostic-list-item">
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{item.version_label}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={item.is_active ? "completed" : "draft"} label={item.is_active ? "activa" : "inactiva"} />
                        <span>Cliente: {item.client_id || "General"}</span>
                        <span>Revisión: {formatDate(item.review_date)}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <button type="button" className="btn-secondary" onClick={() => startEditPolicy(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleDeletePolicy(item.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Objetivos de calidad" description="Seguimiento con vinculacion opcional a KPI.">
            <div className="inline-actions">
              <StatusBadge value="pending" label={`Total: ${objectiveSummary.total ?? 0}`} />
              <StatusBadge value="in_progress" label={`En progreso: ${objectiveSummary.in_progress ?? 0}`} />
              <StatusBadge value="completed" label={`Completados: ${objectiveSummary.completed ?? 0}`} />
              <span className="soft-label">Con KPI: {objectiveSummary.linked_to_kpi ?? 0}</span>
            </div>
            <form className="form-grid" onSubmit={handleSaveObjective}>
              <label className="field-stack">
                <span>Objetivo *</span>
                <input
                  className="input-text"
                  value={objectiveForm.title} onChange={(event) => setObjectiveForm((prev) => ({ ...prev, title : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-stack">
                <span>Descripcion *</span>
                <RichTextarea
                  className="input-textarea"
                  value={objectiveForm.description} onChange={(event) => setObjectiveForm((prev) => ({ ...prev, description : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <div className="inline-actions">
                <label className="field-inline">
                  <span>Periodo</span>
                  <input
                    className="input-text"
                    value={objectiveForm.period_label} onChange={(event) => setObjectiveForm((prev) => ({ ...prev, period_label : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-inline">
                  <span>Responsable</span>
                  <input
                    className="input-text"
                    value={objectiveForm.responsible_name}
                    onChange={(event) =>
                      setObjectiveForm((prev) => ({ ...prev, responsible_name: event.target.value }))
                    }
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-inline">
                  <span>Estado</span>
                  <select
                    className="input-select"
                    value={objectiveForm.status} onChange={(event) => setObjectiveForm((prev) => ({ ...prev, status : event.target.value }))}
                  >
                    {ISO_MANAGEMENT_OPTIONS.objectiveStatus.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="inline-actions">
                <label className="field-inline">
                  <span>KPI vinculado</span>
                  <select
                    className="input-select"
                    value={objectiveForm.linked_kpi_id} onChange={(event) => setObjectiveForm((prev) => ({ ...prev, linked_kpi_id : event.target.value }))}
                  >
                    <option value="">Sin vinculo</option>
                    {kpiOptions.map((kpi) => (
                      <option key={kpi.id} value={kpi.id}>
                        {kpi.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-inline">
                  <span>Fecha objetivo</span>
                  <input
                    className="input-text"
                    type="date"
                    value={objectiveForm.target_date} onChange={(event) => setObjectiveForm((prev) => ({ ...prev, target_date : event.target.value }))}
                  />
                </label>
                <label className="field-inline">
                  <span>Fecha revisión</span>
                  <input
                    className="input-text"
                    type="date"
                    value={objectiveForm.review_date} onChange={(event) => setObjectiveForm((prev) => ({ ...prev, review_date : event.target.value }))}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {editingObjectiveId ? "Actualizar objetivo" : "Crear objetivo"}
                </button>
                {editingObjectiveId ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setEditingObjectiveId("");
                      setObjectiveForm(EMPTY_OBJECTIVE);
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
            <div className="stack-list">
              {objectives.map((item) => (
                <article key={item.id} className="diagnostic-list-item">
                  <div className="diagnostic-list-main">
                    <p className="diagnostic-list-id">{item.title}</p>
                    <div className="diagnostic-list-meta">
                      <StatusBadge value={mapStatusToBadge(item.status)} label={item.status} />
                      <span>Periodo: {item.period_label}</span>
                      <span>Revisión: {formatDate(item.review_date)}</span>
                    </div>
                  </div>
                  <div className="diagnostic-list-actions">
                    <button type="button" className="btn-secondary" onClick={() => startEditObjective(item)}>
                      Editar
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => handleDeleteObjective(item.id)}>
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Planificacion de cambios" description="Registro y seguimiento de cambios planificados.">
            <form className="form-grid" onSubmit={handleSaveChange}>
              <label className="field-stack">
                <span>Cambio *</span>
                <input
                  className="input-text"
                  value={changeForm.change_title} onChange={(event) => setChangeForm((prev) => ({ ...prev, change_title : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-stack">
                <span>Motivo *</span>
                <RichTextarea
                  className="input-textarea"
                  value={changeForm.reason} onChange={(event) => setChangeForm((prev) => ({ ...prev, reason : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field-stack">
                <span>Impacto *</span>
                <RichTextarea
                  className="input-textarea"
                  value={changeForm.impact} onChange={(event) => setChangeForm((prev) => ({ ...prev, impact : event.target.value }))}
                  required
                  disabled={saving}
                />
              </label>
              <div className="inline-actions">
                <label className="field-inline">
                  <span>Responsable *</span>
                  <input
                    className="input-text"
                    value={changeForm.responsible_name} onChange={(event) => setChangeForm((prev) => ({ ...prev, responsible_name : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-inline">
                  <span>Fecha planificada *</span>
                  <input
                    className="input-text"
                    type="date"
                    value={changeForm.planned_date} onChange={(event) => setChangeForm((prev) => ({ ...prev, planned_date : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-inline">
                  <span>Estado</span>
                  <select
                    className="input-select"
                    value={changeForm.status} onChange={(event) => setChangeForm((prev) => ({ ...prev, status : event.target.value }))}
                  >
                    {ISO_MANAGEMENT_OPTIONS.changeStatus.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {editingChangeId ? "Actualizar cambio" : "Crear cambio"}
                </button>
                {editingChangeId ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setEditingChangeId("");
                      setChangeForm(EMPTY_CHANGE);
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
            <div className="stack-list">
              {changePlans.map((item) => (
                <article key={item.id} className="diagnostic-list-item">
                  <div className="diagnostic-list-main">
                    <p className="diagnostic-list-id">{item.change_title}</p>
                    <div className="diagnostic-list-meta">
                      <StatusBadge value={mapStatusToBadge(item.status)} label={item.status} />
                      <span>Responsable: {item.responsible_name}</span>
                      <span>Fecha: {formatDate(item.planned_date)}</span>
                    </div>
                  </div>
                  <div className="diagnostic-list-actions">
                    <button type="button" className="btn-secondary" onClick={() => startEditChange(item)}>
                      Editar
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => handleDeleteChange(item.id)}>
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <div className="layout-grid two-columns">
            <SectionCard title={editingRoleId ? "Editar rol y responsabilidad" : "Roles y responsabilidades"}
              description="Asignacion de responsables del sistema."
            >
              <form className="form-grid" onSubmit={handleSaveRole}>
                <label className="field-stack">
                  <span>Rol *</span>
                  <input
                    className="input-text"
                    value={roleForm.role_name} onChange={(event) => setRoleForm((prev) => ({ ...prev, role_name : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Responsable *</span>
                  <input
                    className="input-text"
                    value={roleForm.responsible_name} onChange={(event) => setRoleForm((prev) => ({ ...prev, responsible_name : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Detalle de responsabilidad *</span>
                  <RichTextarea
                    className="input-textarea"
                    value={roleForm.responsibility_details}
                    onChange={(event) =>
                      setRoleForm((prev) => ({ ...prev, responsibility_details: event.target.value }))
                    }
                    required
                    disabled={saving}
                  />
                </label>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Proceso relacionado</span>
                    <input
                      className="input-text"
                      value={roleForm.related_process} onChange={(event) => setRoleForm((prev) => ({ ...prev, related_process : event.target.value }))}
                      disabled={saving}
                    />
                  </label>
                  <label className="field-inline">
                    <span>Estado</span>
                    <select
                      className="input-select"
                      value={roleForm.status} onChange={(event) => setRoleForm((prev) => ({ ...prev, status : event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.statusActive.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {editingRoleId ? "Actualizar rol" : "Crear rol"}
                  </button>
                  {editingRoleId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingRoleId("");
                        setRoleForm(EMPTY_ROLE);
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="stack-list">
                {roles.map((item) => (
                  <article key={item.id} className="diagnostic-list-item">
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{item.role_name}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={mapStatusToBadge(item.status)} label={item.status} />
                        <span>Responsable: {item.responsible_name}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <button type="button" className="btn-secondary" onClick={() => startEditRole(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleDeleteRole(item.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard title={editingProcessId ? "Editar proceso" : "Mapa de procesos"}
              description="Procesos estrategicos, operativos y de apoyo."
            >
              <form className="form-grid" onSubmit={handleSaveProcess}>
                <label className="field-stack">
                  <span>Nombre del proceso *</span>
                  <input
                    className="input-text"
                    value={processForm.name} onChange={(event) => setProcessForm((prev) => ({ ...prev, name : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="field-stack">
                  <span>Descripcion *</span>
                  <RichTextarea
                    className="input-textarea"
                    value={processForm.description} onChange={(event) => setProcessForm((prev) => ({ ...prev, description : event.target.value }))}
                    required
                    disabled={saving}
                  />
                </label>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Tipo</span>
                    <select
                      className="input-select"
                      value={processForm.process_type} onChange={(event) => setProcessForm((prev) => ({ ...prev, process_type : event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.processTypes.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-inline">
                    <span>Responsable</span>
                    <input
                      className="input-text"
                      value={processForm.responsible_name}
                      onChange={(event) =>
                        setProcessForm((prev) => ({ ...prev, responsible_name: event.target.value }))
                      }
                      required
                      disabled={saving}
                    />
                  </label>
                </div>
                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Orden</span>
                    <input
                      className="input-text"
                      type="number"
                      min="0"
                      value={processForm.position_order} onChange={(event) => setProcessForm((prev) => ({ ...prev, position_order : event.target.value }))}
                      disabled={saving}
                    />
                  </label>
                  <label className="field-inline">
                    <span>Estado</span>
                    <select
                      className="input-select"
                      value={processForm.status} onChange={(event) => setProcessForm((prev) => ({ ...prev, status : event.target.value }))}
                    >
                      {ISO_MANAGEMENT_OPTIONS.statusActive.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {editingProcessId ? "Actualizar proceso" : "Crear proceso"}
                  </button>
                  {editingProcessId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingProcessId("");
                        setProcessForm(EMPTY_PROCESS);
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="stack-list">
                {processes.map((item) => (
                  <article key={item.id} className="diagnostic-list-item">
                    <div className="diagnostic-list-main">
                      <p className="diagnostic-list-id">{item.name}</p>
                      <div className="diagnostic-list-meta">
                        <StatusBadge value={mapStatusToBadge(item.status)} label={item.status} />
                        <span>Tipo: {item.process_type}</span>
                        <span>Orden: {item.position_order}</span>
                      </div>
                    </div>
                    <div className="diagnostic-list-actions">
                      <button type="button" className="btn-secondary" onClick={() => startEditProcess(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleDeleteProcess(item.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default IsoSystemPage;






