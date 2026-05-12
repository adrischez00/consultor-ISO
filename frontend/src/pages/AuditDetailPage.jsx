import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import RichTextarea from "../components/RichTextarea";

import {
  createAuditInterviewee,
  createAuditRecommendation,
  deleteAuditInterviewee,
  deleteAuditRecommendation,
  exportAuditReportDocx,
  fetchAuditCompliance,
  fetchAuditIsoWorkbench,
  fetchAuditRecommendationHistory,
  fetchAuditReportDetail,
  patchAuditRecommendation,
  patchAuditReport,
  patchAuditSection,
  putAuditClauseChecks,
  putAuditSectionItems,
} from "../api/auditsApi";
import PageHeader from "../components/PageHeader";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import StepTabs from "../components/StepTabs";
import AuditGuidedFields from "../components/AuditGuidedFields";
import { getSectionFieldDefinition, getSectionFieldGroups } from "../features/audits/sectionFieldDefinitions";
import {
  buildGuidedValuesFromItems,
  buildItemsFromGuidedValues,
  extractLegacyItems,
} from "../features/audits/sectionItemsMapper";

const RESULTS_TAB_KEY = "results";
const SECTION_NAME_BY_CODE = {
  "4": "Contexto",
  "5": "Liderazgo",
  "6": "Planificación",
  "7": "Apoyo",
  "8": "Operación",
  "9": "Evaluación del desempeño",
  "10": "Mejora",
};

const REPORT_STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "in_progress", label: "En progreso" },
  { value: "completed", label: "Completado" },
  { value: "approved", label: "Aprobado" },
];

const TIPO_AUDITORIA_OPTIONS = [
  { value: "inicial", label: "Inicial" },
  { value: "revisión_1", label: "Revisión I" },
  { value: "revisión_2", label: "Revisión II" },
  { value: "recertificacion", label: "Recertificación" },
];

const MODALIDAD_OPTIONS = [
  { value: "presencialmente", label: "Presencialmente" },
  { value: "de forma remota", label: "De forma remota" },
  { value: "de forma mixta", label: "De forma mixta" },
];

const SECTION_STATUS_OPTIONS = [
  { value: "not_started", label: "No iniciada" },
  { value: "in_progress", label: "En progreso" },
  { value: "completed", label: "Completada" },
];

const CLAUSE_STATUS_OPTIONS = [
  { value: "compliant", label: "Cumple" },
  { value: "partial", label: "Parcial" },
  { value: "non_compliant", label: "No cumple" },
];

const RECOMMENDATION_TYPE_OPTIONS = [
  { value: "recommendation", label: "Recomendación" },
  { value: "non_conformity", label: "No conformidad" },
  { value: "observation", label: "Observación" },
];

const RECOMMENDATION_PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

const RECOMMENDATION_STATUS_OPTIONS = [
  { value: "new", label: "Nueva" },
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En progreso" },
  { value: "done", label: "Finalizada" },
];

const WORKSPACE_ANCHORS = {
  summary: "audit-summary",
  workspace: "audit-workspace",
  compliance: "audit-compliance",
  isoRoute: "audit-iso-route",
  isoMatrix: "audit-iso-matrix",
  header: "audit-header",
  evidence: "audit-evidence",
  sections: "audit-sections",
  results: "audit-results",
};

const CLOSURE_PANEL_FOCUS_KEYS = new Set(["workspace", "compliance", "route", "matrix"]);
const SECTION_STATUS_AUTOSAVE_DEBOUNCE_MS = 700;

const ISO_SECTION_MATRIX = [
  {
    section: "4",
    title: "Contexto de la organización",
    focus: "Contexto, partes interesadas, alcance y procesos",
    to: "/sistema-iso",
  },
  {
    section: "5",
    title: "Liderazgo",
    focus: "Política de calidad, liderazgo y roles",
    to: "/sistema-iso",
  },
  {
    section: "6",
    title: "Planificación",
    focus: "Riesgos, oportunidades, objetivos y cambios",
    to: "/riesgos-oportunidades",
  },
  {
    section: "7",
    title: "Apoyo",
    focus: "Recursos, competencia, comunicación e información documentada",
    to: "/sistema-iso",
  },
  {
    section: "8",
    title: "Operación",
    focus: "Control operacional, proveedores y salidas no conformes",
    to: "/proveedores",
  },
  {
    section: "9",
    title: "Evaluación del desempeño",
    focus: "KPIs, satisfacción cliente, auditoría interna y revisión por la dirección",
    to: "/indicadores",
  },
  {
    section: "10",
    title: "Mejora",
    focus: "No conformidades, acciones correctivas y mejora continua",
    to: "/no-conformidades",
  },
];

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeRequiredText(value) {
  return String(value ?? "").trim();
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeSortOrder(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function resolveSectionProgressText(status) {
  if (status === "completed") return "Lista para cierre";
  if (status === "in_progress") return "En trabajo";
  return "Pendiente de iniciar";
}

function normalizeSectionStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "completed") return "completed";
  if (normalized === "in_progress") return "in_progress";
  return "not_started";
}

function createEmptyHeaderForm() {
  return {
    entity_name: "",
    auditor_organization: "",
    audited_area: "",
    audit_date: "",
    tipo_auditoria: "inicial",
    modalidad: "presencialmente",
    audited_facilities: "",
    quality_responsible_name: "",
    manager_name: "",
    reference_standard: "ISO 9001",
    reference_standard_revisión: "",
    audit_budget_code: "",
    system_scope: "",
    audit_description: "",
    conclusions_text: "",
    final_dispositions_text: "",
    status: "draft",
  };
}

function createEmptyIntervieweeForm() {
  return {
    full_name: "",
    role_name: "",
  };
}

function createEmptyRecommendationForm() {
  return {
    section_code: "",
    recommendation_type: "recommendation",
    priority: "medium",
    body_text: "",
    followup_comment: "",
    recommendation_status: "new",
    carried_from_previous: false,
  };
}


function toComplianceBadgeValue(status) {
  if (status === "green") return "compliant";
  if (status === "yellow") return "partial";
  if (status === "red") return "non_compliant";
  return "draft";
}

function mapBySection(list) {
  const bySection = {};
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const code = String(entry.section_code || "").trim();
    if (!code) return;
    if (!bySection[code]) {
      bySection[code] = [];
    }
    bySection[code].push(entry);
  });
  return bySection;
}

function buildQueryPath(pathname, query) {
  const search = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value == null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    search.set(key, normalized);
  });
  const raw = search.toString();
  return raw ? `${pathname}${raw}` : pathname;
}

function sortByOrderAndCode(list, codeField = "item_code") {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const orderDiff = (a?.sort_order || 0) - (b?.sort_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.[codeField] || "").localeCompare(String(b?.[codeField] || ""), "es");
  });
}

function normalizeSectionItems(list) {
  return sortByOrderAndCode(list, "item_code").map((entry) => ({
    id: entry.id,
    item_code: entry.item_code || "",
    item_label: entry.item_label || "",
    value_text: entry.value_text ?? "",
    value_json: entry.value_json ?? null,
    sort_order: entry.sort_order || 0,
  }));
}

function summarizeProgress({ headerForm, interviewees, sections, recommendations }) {
  const progress = [];
  const headerDone =
    Boolean(normalizeRequiredText(headerForm.entity_name)) &&
    Boolean(normalizeRequiredText(headerForm.auditor_organization)) &&
    Boolean(normalizeRequiredText(headerForm.audited_area)) &&
    Boolean(normalizeRequiredText(headerForm.audit_date));

  progress.push({
    key: "header",
    label: "Cabecera",
    status: headerDone ? "completed" : "in_progress",
  });

  progress.push({
    key: "interviewees",
    label: "Entrevistados",
    status: Array.isArray(interviewees) && interviewees.length > 0 ? "completed" : "not_started",
  });

  const normalizedSections = sortByOrderAndCode(sections, "section_code");
  normalizedSections.forEach((section) => {
    progress.push({
      key: `section-${section.section_code}`,
      label: `Sección ${section.section_code}`,
      status: section.status || "not_started",
    });
  });

  const hasResultsContent =
    (Array.isArray(recommendations) && recommendations.length > 0) ||
    Boolean(normalizeRequiredText(headerForm.conclusions_text)) ||
    Boolean(normalizeRequiredText(headerForm.final_dispositions_text));

  progress.push({
    key: "results",
    label: "Resultados",
    status: hasResultsContent ? "in_progress" : "not_started",
  });

  return progress;
}

function AuditDetailPage() {
  const { id: reportId } = useParams();
  const [searchParams] = useSearchParams();
  const showOnboarding = searchParams.get("onboarding") === "1";
  const initialFocus = String(searchParams.get("focus") || "").trim().toLowerCase();
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(showOnboarding);
  const [showClosureValidationPanel, setShowClosureValidationPanel] = useState(
    CLOSURE_PANEL_FOCUS_KEYS.has(initialFocus)
  );
  const sectionStatusAutosaveRef = useRef({});
  const sectionsRef = useRef([]);
  const sectionDraftByCodeRef = useRef({});

  const [loading, setLoading] = useState(true);
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingSection, setSavingSection] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [savingChecks, setSavingChecks] = useState(false);
  const [savingRecommendation, setSavingRecommendation] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const [report, setReport] = useState(null);
  const [client, setClient] = useState(null);
  const [headerForm, setHeaderForm] = useState(createEmptyHeaderForm);

  const [sections, setSections] = useState([]);
  const [activeTabKey, setActiveTabKey] = useState("");
  const [sectionDraftByCode, setSectionDraftByCode] = useState({});
  const [sectionItemsByCode, setSectionItemsByCode] = useState({});
  const [guidedValuesBySection, setGuidedValuesBySection] = useState({});
  const [clauseChecksByCode, setClauseChecksByCode] = useState({});

  const [interviewees, setInterviewees] = useState([]);
  const [intervieweeForm, setIntervieweeForm] = useState(createEmptyIntervieweeForm);
  const [intervieweeBusy, setIntervieweeBusy] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [historyRecommendations, setHistoryRecommendations] = useState([]);
  const [newRecommendationForm, setNewRecommendationForm] = useState(createEmptyRecommendationForm);
  const [compliance, setCompliance] = useState(null);
  const [isoWorkbench, setIsoWorkbench] = useState(null);
  const [isoWorkbenchError, setIsoWorkbenchError] = useState("");

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    sectionDraftByCodeRef.current = sectionDraftByCode;
  }, [sectionDraftByCode]);

  const hydrate = useCallback((detail, history, nextCompliance) => {
    const nextReport = detail?.report || null;
    const nextClient = detail?.client || null;
    const nextSections = sortByOrderAndCode(detail?.sections || [], "section_code");

    const header = createEmptyHeaderForm();
    if (nextReport) {
      header.entity_name = nextReport.entity_name || "";
      header.auditor_organization = nextReport.auditor_organization || "";
      header.audited_area = nextReport.audited_area || "";
      header.audit_date = toDateInputValue(nextReport.audit_date);
      header.tipo_auditoria = nextReport.tipo_auditoria || "inicial";
      header.modalidad = nextReport.modalidad || "presencialmente";
      header.audited_facilities = nextReport.audited_facilities || "";
      header.quality_responsible_name = nextReport.quality_responsible_name || "";
      header.manager_name = nextReport.manager_name || "";
      header.reference_standard = nextReport.reference_standard || "ISO 9001";
      header.reference_standard_revisión = nextReport.reference_standard_revisión || "";
      header.audit_budget_code = nextReport.audit_budget_code || "";
      header.system_scope = nextReport.system_scope || "";
      header.audit_description = nextReport.audit_description || "";
      header.conclusions_text = nextReport.conclusions_text || "";
      header.final_dispositions_text = nextReport.final_dispositions_text || "";
      header.status = nextReport.status || "draft";
    }

    const sectionDrafts = {};
    nextSections.forEach((section) => {
      sectionDrafts[section.section_code] = {
        auditor_notes: section.auditor_notes || "",
        final_text: section.final_text || "",
        status: section.status || "not_started",
      };
    });

    const itemsByCode = {};
    Object.entries(mapBySection(detail?.items || {})).forEach(([code, list]) => {
      itemsByCode[code] = normalizeSectionItems(list);
    });

    const nextGuidedValuesBySection = {};
    nextSections.forEach((section) => {
      const sectionDefinition = getSectionFieldDefinition(section.section_code);
      nextGuidedValuesBySection[section.section_code] = buildGuidedValuesFromItems(
        sectionDefinition,
        itemsByCode[section.section_code] || []
      );
    });

    const checksByCode = {};
    Object.entries(mapBySection(detail?.clause_checks || {})).forEach(([code, list]) => {
      checksByCode[code] = sortByOrderAndCode(list, "clause_code").map((entry) => ({
        id: entry.id,
        clause_code: entry.clause_code || "",
        clause_title: entry.clause_title || "",
        applicable: Boolean(entry.applicable),
        clause_status: entry.clause_status || "compliant",
        evidence_summary: entry.evidence_summary || "",
        observation_text: entry.observation_text || "",
        sort_order: entry.sort_order || 0,
      }));
    });

    setReport(nextReport);
    setClient(nextClient);
    setHeaderForm(header);
    setSections(nextSections);
    setSectionDraftByCode(sectionDrafts);
    setSectionItemsByCode(itemsByCode);
    setGuidedValuesBySection(nextGuidedValuesBySection);
    setClauseChecksByCode(checksByCode);
    setInterviewees(Array.isArray(detail?.interviewees) ? detail.interviewees : []);
    setRecommendations(Array.isArray(detail?.recommendations) ? detail.recommendations : []);
    setHistoryRecommendations(Array.isArray(history) ? history : []);
    setCompliance(nextCompliance && typeof nextCompliance === "object" ? nextCompliance : null);

    const firstSection = nextSections[0]?.section_code;
    setActiveTabKey((current) => {
      if (current === RESULTS_TAB_KEY) return RESULTS_TAB_KEY;
      if (current && firstSection && sectionDrafts[current]) return current;
      return firstSection || RESULTS_TAB_KEY;
    });
  }, []);

  const loadAudit = useCallback(async () => {
    if (!reportId) {
      setError("ID de auditoría inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setStatusMessage("");
    setIsoWorkbenchError("");

    try {
      const [detailResult, historyResult, complianceResult, workbenchResult] = await Promise.allSettled([
        fetchAuditReportDetail(reportId),
        fetchAuditRecommendationHistory(reportId),
        fetchAuditCompliance(reportId),
        fetchAuditIsoWorkbench(reportId),
      ]);

      if (detailResult.status === "rejected") {
        throw detailResult.reason;
      }
      if (historyResult.status === "rejected") {
        throw historyResult.reason;
      }
      if (complianceResult.status === "rejected") {
        throw complianceResult.reason;
      }

      hydrate(detailResult.value, historyResult.value, complianceResult.value);

      if (workbenchResult.status === "fulfilled") {
        setIsoWorkbench(workbenchResult.value && typeof workbenchResult.value === "object" ? workbenchResult.value : null);
      } else {
        setIsoWorkbench(null);
        setIsoWorkbenchError(
          workbenchResult.reason instanceof Error ? workbenchResult.reason.message : "No se pudo cargar el flujo ISO contextual."
        );
      }
    } catch (err) {
      setIsoWorkbench(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  }, [hydrate, reportId]);

  const refreshCompliance = useCallback(async () => {
    if (!reportId) return;
    const [nextComplianceResult, workbenchResult] = await Promise.allSettled([
      fetchAuditCompliance(reportId),
      fetchAuditIsoWorkbench(reportId),
    ]);

    if (nextComplianceResult.status === "fulfilled") {
      setCompliance(nextComplianceResult.value);
    } else {
      throw nextComplianceResult.reason;
    }

    if (workbenchResult.status === "fulfilled") {
      setIsoWorkbench(workbenchResult.value && typeof workbenchResult.value === "object" ? workbenchResult.value : null);
      setIsoWorkbenchError("");
    } else {
      setIsoWorkbenchError(
        workbenchResult.reason instanceof Error ? workbenchResult.reason.message : "No se pudo refrescar el flujo ISO contextual."
      );
    }
  }, [reportId]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    setShowOnboardingBanner(showOnboarding);
  }, [showOnboarding]);

  useEffect(() => {
    if (loading) return;
    if (initialFocus === "results") {
      setActiveTabKey(RESULTS_TAB_KEY);
    }

    if (CLOSURE_PANEL_FOCUS_KEYS.has(initialFocus) && !showClosureValidationPanel) {
      setShowClosureValidationPanel(true);
      return;
    }

    const focusToAnchor = {
      workspace: WORKSPACE_ANCHORS.workspace,
      compliance: WORKSPACE_ANCHORS.compliance,
      route: WORKSPACE_ANCHORS.isoRoute,
      matrix: WORKSPACE_ANCHORS.isoMatrix,
      header: WORKSPACE_ANCHORS.header,
      evidence: WORKSPACE_ANCHORS.evidence,
      sections: WORKSPACE_ANCHORS.sections,
      results: WORKSPACE_ANCHORS.results,
    };
    const targetId = focusToAnchor[initialFocus];
    if (!targetId) return;
    const element = document.getElementById(targetId);
    if (!element) return;
    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [initialFocus, loading, showClosureValidationPanel]);

  const sectionsWithDraftStatus = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        status: normalizeSectionStatus(
          sectionDraftByCode[section.section_code].status || section.status || "not_started"
        ),
      })),
    [sectionDraftByCode, sections]
  );

  const progressItems = useMemo(() => {
    return summarizeProgress({
      headerForm,
      interviewees,
      sections: sectionsWithDraftStatus,
      recommendations,
    });
  }, [headerForm, interviewees, recommendations, sectionsWithDraftStatus]);

  const complianceBlocks = useMemo(
    () => (Array.isArray(compliance?.blocks) ? compliance.blocks : []),
    [compliance]
  );

  const closingBlockers = useMemo(() => {
    return complianceBlocks
      .filter((block) => block.status !== "green")
      .map((block) => ({
        key: `${block.section_code}-${block.block_code}`,
        section_code: block.section_code,
        block_title: block.block_title,
        missing_fields: Array.isArray(block.missing_fields) ? block.missing_fields : [],
        status: block.status,
      }));
  }, [complianceBlocks]);

  const auditWarnings = useMemo(() => {
    const warnings = [];
    if ((interviewees || []).length === 0) {
      warnings.push("No hay entrevistados registrados.");
    }
    if ((recommendations || []).length === 0) {
      warnings.push("No hay recomendaciones ni hallazgos registrados.");
    }
    return warnings;
  }, [interviewees, recommendations]);

  const clauseCheckSummary = useMemo(() => {
    const checks = Object.values(clauseChecksByCode || {}).flat();
    const total = checks.length;
    const nonCompliant = checks.filter((item) => item?.clause_status === "non_compliant").length;
    const partial = checks.filter((item) => item?.clause_status === "partial").length;
    const compliant = checks.filter((item) => item?.clause_status === "compliant").length;
    return { total, compliant, partial, nonCompliant };
  }, [clauseChecksByCode]);

  const recommendationSummary = useMemo(() => {
    const total = recommendations.length;
    const nonConformities = recommendations.filter(
      (item) => item?.recommendation_type === "non_conformity"
    ).length;
    const observations = recommendations.filter(
      (item) => item?.recommendation_type === "observation"
    ).length;
    const open = recommendations.filter((item) => item?.recommendation_status !== "done").length;
    return { total, nonConformities, observations, open };
  }, [recommendations]);

  const exportState = useMemo(() => {
    const normalizedStatus = String(report?.status || "draft")
      .trim()
      .toLowerCase();
    const isFinal = ["completed", "approved", "closed", "final", "finalized"].includes(
      normalizedStatus
    );
    return {
      badgeValue: isFinal ? "completed" : "in_progress",
      label: isFinal ? "Exportación : versión final" : "Exportación: borrador controlado",
    };
  }, [report?.status]);

  const workspaceFlowLinks = useMemo(() => {
    return [
      {
        key: "header",
        label: "Cabecera y planificación",
        href: `#${WORKSPACE_ANCHORS.header}`,
        detail: "Define alcance auditado, responsable, fecha y contexto base.",
      },
      {
        key: "iso-matrix",
        label: "Matriz ISO y evidencias de apoyo",
        href: `#${WORKSPACE_ANCHORS.isoMatrix}`,
        detail: "Relaciona cada cláusula 4-10 con módulos de soporte auditables.",
      },
      {
        key: "evidence",
        label: "Evidencias y personas clave",
        href: `#${WORKSPACE_ANCHORS.evidence}`,
        detail: "Gestióna entrevistados, anexos y trazabilidad documental.",
      },
      {
        key: "sections",
        label: "Secciones y cláusulas ISO",
        href: `#${WORKSPACE_ANCHORS.sections}`,
        detail: "Completa secciones 4-10 y checks por cláusula.",
      },
      {
        key: "results",
        label: "Hallazgos y cierre",
        href: `#${WORKSPACE_ANCHORS.results}`,
        detail: "Registra recomendaciones, no conformidades y conclusiones.",
      },
    ];
  }, []);

  const sectionTabs = useMemo(() => {
    const mapped = sectionsWithDraftStatus.map((section) => ({
      key: section.section_code,
      label: `${section.section_code}. ${SECTION_NAME_BY_CODE[section.section_code] || section.title}`,
      status: section.status || "not_started",
      progressText: resolveSectionProgressText(section.status || "not_started"),
    }));

    mapped.push({
      key: RESULTS_TAB_KEY,
      label: "Resultados",
      status:
        recommendations.length > 0 ||
        Boolean(normalizeRequiredText(headerForm.conclusions_text)) ||
        Boolean(normalizeRequiredText(headerForm.final_dispositions_text)) ? "in_progress" : "not_started",
      progressText: "Recomendaciones y cierre",
    });

    return mapped;
  }, [
    headerForm.conclusions_text,
    headerForm.final_dispositions_text,
    recommendations.length,
    sectionsWithDraftStatus,
  ]);

  const activeTabIndex = useMemo(() => {
    const idx = sectionTabs.findIndex((item) => item.key === activeTabKey);
    return idx >= 0 ? idx : Math.max(sectionTabs.length - 1, 0);
  }, [activeTabKey, sectionTabs]);

  const activeSectionCode = activeTabKey === RESULTS_TAB_KEY ? null : activeTabKey;
  const activeSection = useMemo(
    () => sectionsWithDraftStatus.find((section) => section.section_code === activeSectionCode) || null,
    [activeSectionCode, sectionsWithDraftStatus]
  );

  const activeSectionDraft = activeSectionCode
    ? sectionDraftByCode[activeSectionCode] || {
        auditor_notes: "",
        final_text: "",
        status: "not_started",
      }
    : null;

  const activeSectionItems = activeSectionCode ? sectionItemsByCode[activeSectionCode] || [] : [];
  const activeSectionChecks = activeSectionCode ? clauseChecksByCode[activeSectionCode] || [] : [];
  const activeSectionDefinition = useMemo(
    () => getSectionFieldDefinition(activeSectionCode),
    [activeSectionCode]
  );
  const activeSectionGroups = useMemo(
    () => getSectionFieldGroups(activeSectionCode),
    [activeSectionCode]
  );
  const activeSectionGuidedValues = useMemo(() => {
    if (!activeSectionCode) return {};
    return (
      guidedValuesBySection[activeSectionCode] ||
      buildGuidedValuesFromItems(activeSectionDefinition, activeSectionItems)
    );
  }, [activeSectionCode, activeSectionDefinition, activeSectionItems, guidedValuesBySection]);
  const activeSectionLegacyItems = useMemo(
    () => extractLegacyItems(activeSectionDefinition, activeSectionItems),
    [activeSectionDefinition, activeSectionItems]
  );
  const activeSectionFieldCompletion = useMemo(() => {
    const fields = activeSectionDefinition?.flat_fields || [];
    if (fields.length === 0) return { completed: 0, total: 0 };
    const completed = fields.filter((field) => {
      const value = activeSectionGuidedValues[field.field_code];
      if (field.type === "boolean") return typeof value === "boolean";
      if (field.type === "number") return value !== "" && value != null;
      if (field.type === "list") return Array.isArray(value) && value.length > 0;
      if (field.type === "json") {
        if (value == null || value === "") return false;
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") return Object.keys(value).length > 0;
        return false;
      }
      return String(value ?? "").trim().length > 0;
    }).length;
    return { completed, total: fields.length };
  }, [activeSectionDefinition, activeSectionGuidedValues]);

  const sectionStatusSummary = useMemo(() => {
    const total = sectionsWithDraftStatus.length;
    const completed = sectionsWithDraftStatus.filter((section) => section.status === "completed").length;
    const inProgress = sectionsWithDraftStatus.filter((section) => section.status === "in_progress").length;
    const notStarted = Math.max(total - completed - inProgress, 0);
    return { total, completed, inProgress, notStarted };
  }, [sectionsWithDraftStatus]);

  const contextualNavLinks = useMemo(() => {
    const reportIdValue = report?.id || "";
    const clientIdValue = client?.id || "";
    const reportYearValue = report?.report_year ? String(report.report_year) : "";
    const baseQuery = {
      report_id: reportIdValue,
      client_id: clientIdValue,
      report_year: reportYearValue,
    };

    return [
      {
        key: "iso-core",
        label: "Contexto, alcance, política, roles, procesos y objetivos",
        detail:
          `Contexto ${isoWorkbench?.context_profile_completed ? "completo" : "pendiente"} · ` +
          `Partes ${isoWorkbench?.interested_parties_active ?? 0} · ` +
          `Objetivos ${isoWorkbench?.objectives_total ?? 0}`,
        to: buildQueryPath("/sistema-iso", baseQuery),
      },
      {
        key: "risks",
        label: "Riesgos y oportunidades",
        detail: `Riesgos abiertos: ${isoWorkbench?.risks_open ?? 0}`,
        to: buildQueryPath("/riesgos-oportunidades", baseQuery),
      },
      {
        key: "suppliers",
        label: "Proveedores evaluados",
        detail: `Proveedores criticos: ${isoWorkbench?.suppliers_critical ?? 0}`,
        to: buildQueryPath("/proveedores", baseQuery),
      },
      {
        key: "kpis",
        label: "Indicadores KPI",
        detail:
          `Total KPI: ${isoWorkbench?.kpis_total ?? 0} · ` +
          `Alerta/Crítico: ${isoWorkbench?.kpis_alert_or_critical ?? 0}`,
        to: buildQueryPath("/indicadores", baseQuery),
      },
      {
        key: "feedback",
        label: "Satisfacción del cliente",
        detail:
          `Feedback: ${isoWorkbench?.customer_feedback_total ?? 0} · ` +
          `Media: ${isoWorkbench?.customer_feedback_average == null ? "-" : Number(isoWorkbench.customer_feedback_average).toFixed(2)}`,
        to: buildQueryPath("/satisfaccion-cliente", baseQuery),
      },
      {
        key: "nonconformities",
        label: "No conformidades y mejora (CAPA)",
        detail:
          `NC desde auditoría: ${isoWorkbench?.nonconformities_from_audit_total ?? 0} · ` +
          `Abiertas: ${isoWorkbench?.nonconformities_from_audit_open ?? 0} · ` +
          `Mejoras: ${isoWorkbench?.improvements_from_audit_total ?? 0}`,
        to: buildQueryPath("/no-conformidades", baseQuery),
      },
      {
        key: "management-reviews",
        label: "Revisión por la dirección",
        detail: `Revisiónes vinculadas: ${isoWorkbench?.management_reviews_linked_total ?? 0}`,
        to: buildQueryPath("/revision-direccion", baseQuery),
      },
    ];
  }, [client?.id, isoWorkbench, report?.id, report?.report_year]);

  const isoMatrixLinks = useMemo(() => {
    const baseQuery = {
      report_id: report?.id || "",
      client_id: client?.id || "",
      report_year: report?.report_year ? String(report.report_year) : "",
    };
    return ISO_SECTION_MATRIX.map((item) => ({
      ...item,
      to: buildQueryPath(item.to, baseQuery),
    }));
  }, [client?.id, report?.id, report?.report_year]);

  function setSectionMetaDraft(sectionCode, patch) {
    const nextPatch = { ...(patch || {}) };
    if (Object.prototype.hasOwnProperty.call(nextPatch, "status")) {
      nextPatch.status = normalizeSectionStatus(nextPatch.status);
    }
    setSectionDraftByCode((prev) => ({
      ...prev,
      [sectionCode]: {
        ...(prev[sectionCode] || {}),
        ...nextPatch,
      },
    }));
  }

  function setSectionItemsDraft(sectionCode, nextItems) {
    setSectionItemsByCode((prev) => ({
      ...prev,
      [sectionCode]: nextItems,
    }));
  }

  function setSectionGuidedValuesDraft(sectionCode, nextValues) {
    setGuidedValuesBySection((prev) => ({
      ...prev,
      [sectionCode]: nextValues,
    }));
  }

  function handleSectionGuidedFieldChange(fieldCode, value) {
    if (!activeSectionCode) return;
    setSectionGuidedValuesDraft(activeSectionCode, {
      ...(guidedValuesBySection[activeSectionCode] || {}),
      [fieldCode]: value,
    });
  }

  function setSectionChecksDraft(sectionCode, nextChecks) {
    setClauseChecksByCode((prev) => ({
      ...prev,
      [sectionCode]: nextChecks,
    }));
  }

  function getSectionAutosaveEntry(sectionCode) {
    const key = String(sectionCode || "").trim();
    if (!key) return { key: "", entry: null };
    if (!sectionStatusAutosaveRef.current[key]) {
      sectionStatusAutosaveRef.current[key] = {
        timerId: null,
        inFlight: false,
        pendingStatus: null,
      };
    }
return { key, entry : sectionStatusAutosaveRef.current[key] };
  }

  function getPersistedSectionStatus(sectionCode) {
    const key = String(sectionCode || "").trim();
    if (!key) return "not_started";
    const persistedSection = (sectionsRef.current || []).find(
      (section) => section.section_code === key
    );
    return normalizeSectionStatus(persistedSection.status || "not_started");
  }

  function syncSectionDraftStatusToPersisted(sectionCode) {
    const key = String(sectionCode || "").trim();
    if (!key) return;
    setSectionMetaDraft(key, { status: getPersistedSectionStatus(key) });
  }

  const flushSectionStatusAutosave = useCallback(
    async (sectionCode, nextStatusOverride = null) => {
      const { key, entry } = getSectionAutosaveEntry(sectionCode);
      if (!reportId || !key || !entry) return;
      let savedSuccessfully = false;

      const persistedSection = (sectionsRef.current || []).find(
        (section) => section.section_code === key
      );
      const persistedStatus = normalizeSectionStatus(persistedSection.status || "not_started");
      const draftStatus = normalizeSectionStatus(
        nextStatusOverride ?? sectionDraftByCodeRef.current[key]?.status ?? persistedStatus
      );

      if (entry.inFlight) {
        entry.pendingStatus = draftStatus;
        return;
      }

      if (draftStatus === persistedStatus) return;

      entry.inFlight = true;
      try {
        const updated = await patchAuditSection(reportId, key, { status: draftStatus });
        const normalizedUpdatedStatus = normalizeSectionStatus(updated.status || draftStatus);

        setSections((prev) =>
          prev.map((section) => (section.section_code === key ? updated : section))
        );
        setSectionMetaDraft(key, { status: normalizedUpdatedStatus });
        savedSuccessfully = true;

        if (activeSectionCode === key) {
          setError("");
          setStatusMessage(`Estado de sección ${key} guardado automáticamente.`);
        }

        await refreshCompliance();
      } catch (err) {
        syncSectionDraftStatusToPersisted(key);
        if (activeSectionCode === key) {
          setError(
            err instanceof Error ? err.message : `No se pudo autoguardar el estado de la sección ${key}.`
          );
        }
      } finally {
        entry.inFlight = false;
        const queuedStatus = entry.pendingStatus;
        entry.pendingStatus = null;
        if (queuedStatus) {
          void flushSectionStatusAutosave(key, queuedStatus);
          return;
        }
        if (!savedSuccessfully) return;

        const persistedAfter = normalizeSectionStatus(
          (sectionsRef.current || []).find((section) => section.section_code === key).status ||
            "not_started"
        );
        const draftAfter = normalizeSectionStatus(
          sectionDraftByCodeRef.current[key]?.status || persistedAfter
        );

        if (draftAfter !== persistedAfter) {
          if (entry.timerId) clearTimeout(entry.timerId);
          entry.timerId = setTimeout(() => {
            entry.timerId = null;
            void flushSectionStatusAutosave(key);
          }, SECTION_STATUS_AUTOSAVE_DEBOUNCE_MS);
        }
      }
    },
    [activeSectionCode, refreshCompliance, reportId]
  );

  const scheduleSectionStatusAutosave = useCallback(
    (sectionCode) => {
      const { key, entry } = getSectionAutosaveEntry(sectionCode);
      if (!reportId || !key || !entry) return;
      if (entry.timerId) clearTimeout(entry.timerId);
      entry.timerId = setTimeout(() => {
        entry.timerId = null;
        void flushSectionStatusAutosave(key);
      }, SECTION_STATUS_AUTOSAVE_DEBOUNCE_MS);
    },
    [flushSectionStatusAutosave, reportId]
  );

  async function handleSectionStatusChange(sectionCode, statusValue) {
    const normalizedStatus = normalizeSectionStatus(statusValue);
    setError("");
    setSectionMetaDraft(sectionCode, { status: normalizedStatus });

    if (normalizedStatus === "completed" && sectionCode === activeSectionCode) {
      const savedItems = await handleSaveSectionItems({ silent: true });
      if (!savedItems) {
        syncSectionDraftStatusToPersisted(sectionCode);
        return;
      }
      await flushSectionStatusAutosave(sectionCode, normalizedStatus);
      return;
    }

    scheduleSectionStatusAutosave(sectionCode);
  }

  useEffect(() => {
    return () => {
      Object.values(sectionStatusAutosaveRef.current || {}).forEach((entry) => {
        if (entry.timerId) clearTimeout(entry.timerId);
      });
    };
  }, []);

  useEffect(() => {
    Object.values(sectionStatusAutosaveRef.current || {}).forEach((entry) => {
      if (entry.timerId) clearTimeout(entry.timerId);
    });
    sectionStatusAutosaveRef.current = {};
  }, [reportId]);

  async function handleSaveHeader() {
    if (!reportId) return;
    setSavingHeader(true);
    setError("");
    setStatusMessage("");
    try {
      const payload = {
        entity_name: normalizeRequiredText(headerForm.entity_name),
        auditor_organization: normalizeNullableText(headerForm.auditor_organization),
        audited_area: normalizeNullableText(headerForm.audited_area),
        audit_date: headerForm.audit_date || null,
        tipo_auditoria: normalizeRequiredText(headerForm.tipo_auditoria),
        modalidad: normalizeRequiredText(headerForm.modalidad),
        audited_facilities: normalizeNullableText(headerForm.audited_facilities),
        quality_responsible_name: normalizeNullableText(headerForm.quality_responsible_name),
        manager_name: normalizeNullableText(headerForm.manager_name),
        reference_standard: normalizeRequiredText(headerForm.reference_standard),
        reference_standard_revisión: normalizeNullableText(headerForm.reference_standard_revisión),
        audit_budget_code: normalizeNullableText(headerForm.audit_budget_code),
        system_scope: normalizeNullableText(headerForm.system_scope),
        audit_description: normalizeNullableText(headerForm.audit_description),
        conclusions_text: normalizeNullableText(headerForm.conclusions_text),
        final_dispositions_text: normalizeNullableText(headerForm.final_dispositions_text),
        status: normalizeRequiredText(headerForm.status),
      };

      const updated = await patchAuditReport(reportId, payload);
      setReport(updated);
      await refreshCompliance();
      setStatusMessage("Cabecera guardada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cabecera.");
    } finally {
      setSavingHeader(false);
    }
  }

  async function handleGenerateReport() {
    if (!reportId || generatingReport) return;
    setGeneratingReport(true);
    setError("");
    setStatusMessage("Generando informe P03, puede tardar unos segundos...");
    try {
      await exportAuditReportDocx(reportId);
      setStatusMessage("Informe generado y descargado correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el informe.");
      setStatusMessage("");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleSaveActiveSection() {
    if (!reportId || !activeSectionCode || !activeSectionDraft) return;
    setSavingSection(true);
    setError("");
    setStatusMessage("");
    try {
      const payload = {
        auditor_notes: normalizeNullableText(activeSectionDraft.auditor_notes),
        final_text: normalizeNullableText(activeSectionDraft.final_text),
        status: normalizeRequiredText(activeSectionDraft.status || "not_started"),
      };

      const updated = await patchAuditSection(reportId, activeSectionCode, payload);

      setSections((prev) =>
        prev.map((section) => (section.section_code === activeSectionCode ? updated : section))
      );
      setSectionMetaDraft(activeSectionCode, {
        auditor_notes: updated.auditor_notes || "",
        final_text: updated.final_text || "",
        status: updated.status || "not_started",
      });

      await refreshCompliance();
      setStatusMessage(`Sección ${activeSectionCode} guardada.`);
    } catch (err) {
      syncSectionDraftStatusToPersisted(activeSectionCode);
      setError(err instanceof Error ? err.message : "No se pudo guardar la sección.");
    } finally {
      setSavingSection(false);
    }
  }

  async function handleSaveSectionItems(options = {}) {
    const { silent = false } = options;
    if (!reportId || !activeSectionCode) return false;
    setSavingItems(true);
    if (!silent) {
      setError("");
      setStatusMessage("");
    }
    try {
      const safeGuidedValues = guidedValuesBySection[activeSectionCode] || {};
      const mergedItems = buildItemsFromGuidedValues(
        activeSectionDefinition,
        safeGuidedValues,
        activeSectionLegacyItems
      );
      const cleanedItems = mergedItems.map((item, index) => ({
        item_code: normalizeRequiredText(item.item_code) || `item_${index + 1}`,
        item_label: normalizeRequiredText(item.item_label) || `Campo ${index + 1}`,
        value_text: normalizeNullableText(item.value_text),
        value_json: item.value_json ?? null,
        sort_order: normalizeSortOrder(item.sort_order),
      }));

      const savedItems = await putAuditSectionItems(reportId, activeSectionCode, cleanedItems);
      const normalizedSavedItems = normalizeSectionItems(savedItems);
      setSectionItemsDraft(activeSectionCode, normalizedSavedItems);
      setSectionGuidedValuesDraft(
        activeSectionCode,
        buildGuidedValuesFromItems(activeSectionDefinition, normalizedSavedItems)
      );
      await refreshCompliance();
      if (!silent) {
        setStatusMessage(`Datos de la sección ${activeSectionCode} guardados.`);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los datos de la sección.");
      return false;
    } finally {
      setSavingItems(false);
    }
  }

  async function handleSaveSectionChecks() {
    if (!reportId || !activeSectionCode) return;
    setSavingChecks(true);
    setError("");
    setStatusMessage("");
    try {
      const payload = (activeSectionChecks || []).map((check) => ({
        clause_code: normalizeRequiredText(check.clause_code),
        applicable: Boolean(check.applicable),
        clause_status: normalizeRequiredText(check.clause_status || "compliant"),
        evidence_summary: normalizeNullableText(check.evidence_summary),
        observation_text: normalizeNullableText(check.observation_text),
        sort_order: normalizeSortOrder(check.sort_order),
      }));

      const saved = await putAuditClauseChecks(reportId, payload);
      const regrouped = mapBySection(saved);
      setClauseChecksByCode((prev) => ({
        ...prev,
        ...regrouped,
      }));
      await refreshCompliance();
      setStatusMessage(`Verificación de cláusulas de la sección ${activeSectionCode} guardada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las cláusulas.");
    } finally {
      setSavingChecks(false);
    }
  }

  async function handleAddInterviewee(event) {
    event.preventDefault();
    if (!reportId || intervieweeBusy) return;
    setIntervieweeBusy(true);
    setError("");
    setStatusMessage("");

    try {
      const created = await createAuditInterviewee(reportId, {
        full_name: normalizeRequiredText(intervieweeForm.full_name),
        role_name: normalizeNullableText(intervieweeForm.role_name),
      });
      setInterviewees((prev) => sortByOrderAndCode([...prev, created], "full_name"));
      setIntervieweeForm(createEmptyIntervieweeForm());
      setStatusMessage("Entrevistado añadido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir el entrevistado.");
    } finally {
      setIntervieweeBusy(false);
    }
  }

  async function handleDeleteInterviewee(intervieweeId) {
    if (!reportId || intervieweeBusy) return;
    setIntervieweeBusy(true);
    setError("");
    setStatusMessage("");

    try {
      await deleteAuditInterviewee(reportId, intervieweeId);
      setInterviewees((prev) => prev.filter((entry) => entry.id !== intervieweeId));
      setStatusMessage("Entrevistado eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el entrevistado.");
    } finally {
      setIntervieweeBusy(false);
    }
  }

  async function handleCreateRecommendation(event) {
    event.preventDefault();
    if (!reportId || savingRecommendation) return;
    setSavingRecommendation(true);
    setError("");
    setStatusMessage("");

    try {
      const created = await createAuditRecommendation(reportId, {
        section_code: normalizeNullableText(newRecommendationForm.section_code),
        recommendation_type: normalizeRequiredText(newRecommendationForm.recommendation_type),
        priority: normalizeRequiredText(newRecommendationForm.priority),
        body_text: normalizeRequiredText(newRecommendationForm.body_text),
        followup_comment: normalizeNullableText(newRecommendationForm.followup_comment),
        recommendation_status: normalizeRequiredText(newRecommendationForm.recommendation_status),
        carried_from_previous: Boolean(newRecommendationForm.carried_from_previous),
      });
      setRecommendations((prev) => [created, ...prev]);
      setNewRecommendationForm(createEmptyRecommendationForm());
      await refreshCompliance();
      setStatusMessage("Recomendación creada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la recomendación.");
    } finally {
      setSavingRecommendation(false);
    }
  }

  async function handlePatchRecommendation(recommendationId, patch) {
    if (!reportId || savingRecommendation) return;
    setSavingRecommendation(true);
    setError("");
    setStatusMessage("");

    try {
      const updated = await patchAuditRecommendation(reportId, recommendationId, patch);
      setRecommendations((prev) =>
        prev.map((entry) => (entry.id === recommendationId ? updated : entry))
      );
      await refreshCompliance();
      setStatusMessage("Recomendación actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la recomendación.");
    } finally {
      setSavingRecommendation(false);
    }
  }

  async function handleDeleteRecommendation(recommendationId) {
    if (!reportId || savingRecommendation) return;
    setSavingRecommendation(true);
    setError("");
    setStatusMessage("");

    try {
      await deleteAuditRecommendation(reportId, recommendationId);
      setRecommendations((prev) => prev.filter((entry) => entry.id !== recommendationId));
      await refreshCompliance();
      setStatusMessage("Recomendación eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la recomendación.");
    } finally {
      setSavingRecommendation(false);
    }
  }

  function updateClauseCheckRow(index, patch) {
    if (!activeSectionCode) return;
    const nextChecks = activeSectionChecks.map((entry, rowIndex) =>
      rowIndex === index ? { ...entry, ...patch } : entry
    );
    setSectionChecksDraft(activeSectionCode, nextChecks);
  }

  if (loading) {
    return (
      <section className="page audit-page-refactor audit-detail-page">
        <p className="status">Cargando auditoría...</p>
      </section>
    );
  }

  if (error && !report) {
    return (
      <section className="page audit-page-refactor audit-detail-page">
        <p className="status error">{error}</p>
        <div className="inline-actions">
          <Link className="btn-secondary link-btn" to="/auditorias">
            Volver a auditorías
          </Link>
          <button type="button" className="btn-primary" onClick={loadAudit}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page audit-page-refactor audit-detail-page">
      <PageHeader
        eyebrow="P03"
        title={report?.report_code || "Auditoría interna"}
        description={`Cliente: ${client?.name || "-"} · Año: ${report?.report_year || "-"} · Fecha: ${formatDate(report?.audit_date)}`}
        actions={
          <>
            <StatusBadge value={exportState.badgeValue} label={exportState.label} />
            <button type="button" className="btn-primary" onClick={handleSaveHeader} disabled={savingHeader}>
              {savingHeader ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={generatingReport}
              onClick={handleGenerateReport}
            >
              {generatingReport ? "Generando informe..." : "Generar informe"}
            </button>
            <Link className="btn-ghost link-btn" to="/auditorias">
              Volver a auditorías
            </Link>
          </>
        }
      />

      {statusMessage ? <p className="status">{statusMessage}</p> : null}
{error ? <p className="status error">{error}</p> : null}

      {showOnboardingBanner ? (
        <div className="status audit-onboarding-banner">
          <span>
            Expediente iniciado. Usa este workspace para completar la revisión ISO y comprobar bloqueos de cierre
            antes de completar o aprobar la auditoría.
          </span>
          <button type="button" className="btn-ghost" onClick={() => setShowOnboardingBanner(false)}>
            Ocultar
          </button>
        </div>
      ) : null}

      <SectionCard
        className="audit-closure-strip"
        title="Validación de cierre"
        description="Panel de control ISO para bloqueos, compliance y trazabilidad. Puedes ocultarlo mientras completas el informe."
        actions={
          <div className="inline-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowClosureValidationPanel((prev) => !prev)}
            >
              {showClosureValidationPanel ? "Ocultar validación" : "Ver validación"}
            </button>
            {showClosureValidationPanel ? (
              <button type="button" className="btn-secondary" onClick={refreshCompliance}>
                Recalcular
              </button>
            ) : null}
          </div>
        }
      >
        <div className="inline-actions audit-closure-strip-metrics">
          <StatusBadge value={report?.status || "draft"} />
          <span className="soft-label">
            {compliance?.completed_blocks ?? 0}/{compliance?.total_blocks ?? 0} bloques en verde
          </span>
          <StatusBadge
            value={closingBlockers.length === 0 ? "completed" : "pending"}
            label={closingBlockers.length === 0 ? "Sin bloqueos críticos" : `${closingBlockers.length} bloqueos`}
          />
          <span className="soft-label">Entrevistados: {interviewees.length}</span>
          <span className="soft-label">NC: {recommendationSummary.nonConformities}</span>
        </div>
      </SectionCard>

      {showClosureValidationPanel ? (
        <>
      <SectionCard
        id={WORKSPACE_ANCHORS.workspace}
        title="Centro de trabajo del auditor"
        description="Vista operativa del estado real del expediente, bloqueos de cierre y ruta de trabajo."
      >
        <div className="audit-workspace-metrics">
          <article className="audit-workspace-metric">
            <p className="audit-workspace-label">Estado global</p>
            <div className="inline-actions">
              <StatusBadge value={report?.status || "draft"} />
              <span className="soft-label">
                {compliance?.completed_blocks ?? 0}/{compliance?.total_blocks ?? 0} bloques en verde
              </span>
            </div>
          </article>
          <article className="audit-workspace-metric">
            <p className="audit-workspace-label">Bloqueos de cierre</p>
            <div className="inline-actions">
              <StatusBadge
                value={closingBlockers.length === 0 ? "completed" : "pending"}
                label={closingBlockers.length === 0 ? "Sin bloqueos críticos" : `${closingBlockers.length} pendientes`}
              />
            </div>
          </article>
          <article className="audit-workspace-metric">
            <p className="audit-workspace-label">Evidencias</p>
            <div className="inline-actions">
              <span className="soft-label">Entrevistados: {interviewees.length}</span>
            </div>
          </article>
          <article className="audit-workspace-metric">
            <p className="audit-workspace-label">Hallazgos</p>
            <div className="inline-actions">
              <span className="soft-label">Recomendaciones: {recommendationSummary.total}</span>
              <span className="soft-label">NC: {recommendationSummary.nonConformities}</span>
              <span className="soft-label">Checks no cumple: {clauseCheckSummary.nonCompliant}</span>
            </div>
          </article>
        </div>

        <div className="layout-grid two-columns">
          <div className="stack-list">
            <h4 className="audit-subtitle">Ruta recomendada</h4>
            <ul className="simple-list">
              {workspaceFlowLinks.map((item) => (
                <li key={item.key}>
                  <a className="list-link-row" href={item.href}>
                    <span>{item.label}</span>
                    <span className="soft-label">{item.detail}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="stack-list">
            <h4 className="audit-subtitle">Bloqueos y alertas</h4>
            {closingBlockers.length === 0 ? (
              <p className="empty-state">No hay bloqueos críticos de compliance para cerrar.</p>
            ) : (
              <ul className="simple-list">
                {closingBlockers.slice(0, 6).map((blocker) => (
                  <li key={blocker.key} className="audit-blocker-item">
                    <strong>
                      Sección {blocker.section_code}: {blocker.block_title}
                    </strong>
                    <p>Faltan: {blocker.missing_fields.length > 0 ? blocker.missing_fields.join(", ") : "evidencias"}</p>
                  </li>
                ))}
              </ul>
            )}
            {auditWarnings.length > 0 ? (
              <ul className="simple-list">
                {auditWarnings.map((warning) => (
                  <li key={warning} className="audit-warning-item">
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        id={WORKSPACE_ANCHORS.summary}
        title="Resumen de auditoría"
        description="Cabecera ejecutiva con estado, trazabilidad temporal y progreso por bloques."
      >
        <ul className="kv-list audit-header-kv">
          <li>
            <span>Cdigo</span>
            <strong>{report?.report_code || "-"}</strong>
          </li>
          <li>
            <span>Cliente</span>
            <strong>{client?.name || "-"}</strong>
          </li>
          <li>
            <span>Estado</span>
            <StatusBadge value={report?.status || "draft"} />
          </li>
          <li>
            <span>Año</span>
            <strong>{report?.report_year || "-"}</strong>
          </li>
          <li>
            <span>Creación</span>
            <strong>{formatDate(report?.created_at)}</strong>
          </li>
          <li>
            <span>Actualización</span>
            <strong>{formatDate(report?.updated_at)}</strong>
          </li>
        </ul>

        <ul className="audit-progress-list">
          {progressItems.map((item) => (
            <li className="audit-progress-item" key={item.key}>
              <span>{item.label}</span>
              <StatusBadge value={item.status} />
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        id={WORKSPACE_ANCHORS.compliance}
        title="Compliance ISO reforzado"
        description="Validacion de bloques ISO sobre evidencia registrada (amarillos reforzados)."
        actions={
          <button type="button" className="btn-ghost" onClick={refreshCompliance}>
            Recalcular
          </button>
        }
      >
        {!compliance ? (
          <p className="empty-state">No hay datos de compliance disponibles.</p>
        ) : (
          <>
            <div className="inline-actions">
              <span>Estado global</span>
              <StatusBadge
                value={toComplianceBadgeValue(compliance?.overall_status)}
                label={(compliance?.overall_status || "").toUpperCase()}
              />
              <span className="soft-label">
                {compliance?.completed_blocks ?? 0}/{compliance?.total_blocks ?? 0} bloques en verde
              </span>
            </div>
            {closingBlockers.length > 0 ? (
              <p className="status error">
                Cierre bloqueado: hay {closingBlockers.length} bloque(s) ISO pendiente(s). Revisa faltantes antes de
                marcar la auditoría como completada o aprobada.
              </p>
            ) : (
              <p className="status">
                Sin bloqueos críticos de compliance. El informe puede avanzar a cierre si el resto de evidencias está
                validado por el auditor.
              </p>
            )}
            <div className="stack-list">
              {(Array.isArray(compliance.blocks) ? compliance.blocks : []).map((block) => (
                <article className="finding-item" key={block.block_code}>
                  <div className="finding-head">
                    <p className="finding-title">
                      {block.section_code}. {block.block_title}
                    </p>
                    <StatusBadge
                      value={toComplianceBadgeValue(block.status)}
                      label={(block.status || "").toUpperCase()}
                    />
                  </div>
                  <p className="finding-meta">
                    Completados: {block.completed_fields?.length || 0} /{" "}
                    {block.required_fields?.length || 0}
                  </p>
                  {(block.missing_fields || []).length > 0 ? (
                    <p>Faltan: {(block.missing_fields || []).join(", ")}</p>
                  ) : (
                    <p>Sin pendientes en este bloque.</p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        id={WORKSPACE_ANCHORS.isoRoute}
        title="Ruta ISO de esta auditoría"
        description="Entradas, evidencias y salidas del flujo ISO conectadas al informe P03."
      >
        {isoWorkbenchError ? <p className="status error">{isoWorkbenchError}</p> : null}

        {!isoWorkbench && !isoWorkbenchError ? (
          <p className="status">Cargando contexto ISO de la auditoría...</p>
        ) : null}

        {isoWorkbench ? (
          <>
            <div className="inline-actions">
              <StatusBadge value={isoWorkbench.context_profile_completed ? "completed" : "pending"} label={isoWorkbench.context_profile_completed ? "Contexto completo" : "Contexto pendiente"}
              />
              <StatusBadge value={isoWorkbench.recommendations_total > 0 ? "in_progress" : "pending"} label={`Recomendaciones : ${isoWorkbench.recommendations_total}`}
              />
              <StatusBadge value={isoWorkbench.nonconformities_from_audit_open > 0 ? "pending" : "completed"} label={`NC abiertas : ${isoWorkbench.nonconformities_from_audit_open}`}
              />
              <StatusBadge value={isoWorkbench.management_reviews_linked_total > 0 ? "in_progress" : "pending"} label={`Rev. dirección vinculadas : ${isoWorkbench.management_reviews_linked_total}`}
              />
            </div>

            {Array.isArray(isoWorkbench.missing_tables) && isoWorkbench.missing_tables.length > 0 ? (
              <p className="status">
                Migraciones pendientes para trazabilidad completa: {isoWorkbench.missing_tables.join(", ")}
              </p>
            ) : null}

            <ul className="simple-list">
              {contextualNavLinks.map((linkItem) => (
                <li key={linkItem.key}>
                  <Link className="list-link-row" to={linkItem.to}>
                    <span>{linkItem.label}</span>
                    <span className="soft-label">{linkItem.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </SectionCard>

      <SectionCard
        id={WORKSPACE_ANCHORS.isoMatrix}
        title="Matriz de cláusulas ISO y apoyos"
        description="Referencia rápida para alinear cada sección auditada con su evidencia contextual en el sistema."
      >
        <ul className="simple-list">
          {isoMatrixLinks.map((item) => (
            <li key={item.section}>
              <Link className="list-link-row" to={item.to}>
                <span>
                  Sección {item.section}: {item.title}
                </span>
                <span className="soft-label">{item.focus}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="soft-label">
          Enmienda ISO 9001:2024: en la sección 4 valida explícitamente si el cambio climático es relevante en 4.1 y
          si afecta requisitos de partes interesadas en 4.2.
        </p>
      </SectionCard>
        </>
      ) : null}

      <SectionCard
        id={WORKSPACE_ANCHORS.header}
        title="Cabecera del expediente"
        description="Configuración base del expediente de auditoría y contexto operativo para el informe."
      >
        <div className="audit-header-groups">
          <section className="audit-header-group">
            <header className="audit-header-group-head">
              <h4>A. Identificación</h4>
              <p>Datos principales de la auditoría y de la entidad auditada.</p>
            </header>
            <div className="audit-form-grid audit-header-grid">
              <label className="field-stack">
                <span>Entidad</span>
                <input
                  className="input-text"
                  value={headerForm.entity_name}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, entity_name: event.target.value }))
                  }
                />
              </label>

              <label className="field-stack">
                <span>Auditor / Organización</span>
                <input
                  className="input-text"
                  value={headerForm.auditor_organization}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, auditor_organization: event.target.value }))
                  }
                />
              </label>

              <label className="field-stack">
                <span>Fecha de auditoría</span>
                <input
                  className="input-text"
                  type="date"
                  value={headerForm.audit_date} onChange={(event) => setHeaderForm((prev) => ({ ...prev, audit_date : event.target.value }))}
                />
              </label>

              <label className="field-stack">
                <span>Área auditada</span>
                <input
                  className="input-text"
                  value={headerForm.audited_area} onChange={(event) => setHeaderForm((prev) => ({ ...prev, audited_area : event.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="audit-header-group">
            <header className="audit-header-group-head">
              <h4>B. Configuración de auditoría</h4>
              <p>Parámetros que determinan el tipo de revisión y marco de referencia.</p>
            </header>
            <div className="audit-form-grid audit-header-grid">
              <label className="field-stack">
                <span>Tipo de auditoría</span>
                <select
                  className="input-select"
                  value={headerForm.tipo_auditoria}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, tipo_auditoria: event.target.value }))
                  }
                >
                  {TIPO_AUDITORIA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>Modalidad</span>
                <select
                  className="input-select"
                  value={headerForm.modalidad} onChange={(event) => setHeaderForm((prev) => ({ ...prev, modalidad : event.target.value }))}
                >
                  {MODALIDAD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>Norma de referencia</span>
                <input
                  className="input-text"
                  value={headerForm.reference_standard}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, reference_standard: event.target.value }))
                  }
                />
              </label>

              <label className="field-stack">
                <span>Revisión de norma</span>
                <input
                  className="input-text"
                  value={headerForm.reference_standard_revisión}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, reference_standard_revisión: event.target.value }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="audit-header-group">
            <header className="audit-header-group-head">
              <h4>C. Contexto operativo</h4>
              <p>Información de ejecución y soporte documental del expediente.</p>
            </header>
            <div className="audit-form-grid audit-header-grid">
              <label className="field-stack audit-full-width">
                <span>Instalaciones auditadas</span>
                <RichTextarea
                  className="input-textarea"
                  value={headerForm.audited_facilities}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, audited_facilities: event.target.value }))
                  }
                />
              </label>

              <label className="field-stack">
                <span>Responsable del sistema</span>
                <input
                  className="input-text"
                  value={headerForm.quality_responsible_name}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, quality_responsible_name: event.target.value }))
                  }
                />
              </label>

              <label className="field-stack">
                <span>Gerente</span>
                <input
                  className="input-text"
                  value={headerForm.manager_name}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, manager_name: event.target.value }))
                  }
                />
              </label>

              <label className="field-stack">
                <span>Código de presupuesto</span>
                <input
                  className="input-text"
                  value={headerForm.audit_budget_code}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, audit_budget_code: event.target.value }))
                  }
                />
              </label>

              <label className="field-stack audit-full-width">
                <span>Alcance del sistema</span>
                <RichTextarea
                  className="input-textarea"
                  value={headerForm.system_scope} onChange={(event) => setHeaderForm((prev) => ({ ...prev, system_scope : event.target.value }))}
                />
              </label>

              <label className="field-stack audit-full-width">
                <span>Notas adicionales para la introducción</span>
                <RichTextarea
                  className="input-textarea"
                  value={headerForm.audit_description}
                  onChange={(event) =>
                    setHeaderForm((prev) => ({ ...prev, audit_description: event.target.value }))
                  }
                />
                <small className="field-helper">
                  Este texto complementa la introducción generada automáticamente y no sustituye la estructura del
                  informe.
                </small>
              </label>
            </div>
          </section>

          <section className="audit-header-group audit-header-group-compact">
            <header className="audit-header-group-head">
              <h4>Control del expediente</h4>
              <p>Estado operativo actual para seguimiento interno y cierre.</p>
            </header>
            <div className="audit-form-grid audit-header-grid">
              <label className="field-stack">
                <span>Estado</span>
                <select
                  className="input-select"
                  value={headerForm.status} onChange={(event) => setHeaderForm((prev) => ({ ...prev, status : event.target.value }))}
                >
                  {REPORT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </div>
      </SectionCard>

      <SectionCard
        id={WORKSPACE_ANCHORS.evidence}
        title="Entrevistados"
        description="Registra las personas entrevistadas para reforzar la trazabilidad de la auditoría."
      >
        {interviewees.length === 0 ? (
          <p className="empty-state">
            Añade las personas entrevistadas durante la auditoría para incorporarlas al informe final.
          </p>
        ) : null}

        <div className="stack-list">
          {interviewees.map((entry) => (
            <article className="diagnostic-list-item" key={entry.id}>
              <div className="diagnostic-list-main">
                <p className="diagnostic-list-id">{entry.full_name}</p>
                <div className="diagnostic-list-meta">
                  <span>Cargo: {entry.role_name || "-"}</span>
                </div>
              </div>
              <div className="diagnostic-list-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={intervieweeBusy}
                  onClick={() => handleDeleteInterviewee(entry.id)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>

        <form className="interviewee-compact-form" onSubmit={handleAddInterviewee}>
          <label className="field-stack">
            <span>Nombre completo *</span>
            <input
              className="input-text"
              placeholder="Nombre completo"
              value={intervieweeForm.full_name}
              onChange={(event) =>
                setIntervieweeForm((prev) => ({ ...prev, full_name: event.target.value }))
              }
              required
            />
          </label>
          <label className="field-stack">
            <span>Cargo / función</span>
            <input
              className="input-text"
              placeholder="Cargo / función"
              value={intervieweeForm.role_name}
              onChange={(event) =>
                setIntervieweeForm((prev) => ({ ...prev, role_name: event.target.value }))
              }
            />
          </label>
          <div className="interviewee-compact-actions">
            <button type="submit" className="btn-primary interviewee-add-btn" disabled={intervieweeBusy}>
              Añadir entrevistado
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        id={WORKSPACE_ANCHORS.sections}
        className="audit-sections-nav-card"
        title="Secciones 4-10 del informe"
        description="Navega cada sección del expediente, controla su estado y completa los bloques requeridos."
      >
        <div className="audit-sections-summary">
          <span className="soft-label">Total: {sectionStatusSummary.total}</span>
          <StatusBadge value="completed" label={`Completadas: ${sectionStatusSummary.completed}`} />
          <StatusBadge value="in_progress" label={`En progreso: ${sectionStatusSummary.inProgress}`} />
          <StatusBadge value="not_started" label={`No iniciadas: ${sectionStatusSummary.notStarted}`} />
        </div>
        <StepTabs
          items={sectionTabs}
          activeIndex={activeTabIndex}
          onChange={(index) => setActiveTabKey(sectionTabs[index]?.key || RESULTS_TAB_KEY)}
          ariaLabel="Navegación de auditoría"
          className="step-tabs-audit"
        />
      </SectionCard>

      {activeSection ? (
        <>
          <SectionCard
            title={`A. Gestión de la sección ${activeSection.section_code}`}
            description={activeSection.title || "Control del estado y notas de sección."}
            actions={
              <div className="inline-actions audit-section-header-actions">
                <StatusBadge value={activeSectionDraft.status || "not_started"} />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveActiveSection}
                  disabled={savingSection}
                >
                  {savingSection ? "Guardando..." : "Guardar sección"}
                </button>
              </div>
            }
          >
            <div className="audit-section-subgrid">
              <label className="field-stack">
                <span>Estado de sección</span>
                <select
                  className="input-select"
                  value={activeSectionDraft.status || "not_started"}
                  onChange={(event) =>
                    void handleSectionStatusChange(activeSection.section_code, event.target.value)
                  }
                >
                  {SECTION_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack audit-full-width">
                <span>Notas del auditor</span>
                <RichTextarea
                  className="input-textarea"
                  value={activeSectionDraft.auditor_notes || ""}
                  onChange={(event) =>
                    setSectionMetaDraft(activeSection.section_code, {
                      auditor_notes: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="B. Datos de la sección"
            description="Formulario guiado alineado con el informe P03."
            actions={
              <div className="inline-actions">
                <span className="soft-label">
                  Completados: {activeSectionFieldCompletion.completed}/{activeSectionFieldCompletion.total}
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingItems}
                  onClick={handleSaveSectionItems}
                >
                  {savingItems ? "Guardando..." : "Guardar datos"}
                </button>
              </div>
            }
          >
            <AuditGuidedFields
              auditReportId={reportId}
              sectionTitle={activeSection.title}
              groups={activeSectionGroups}
              valuesByFieldCode={activeSectionGuidedValues}
              onFieldChange={handleSectionGuidedFieldChange}
              disabled={savingItems}
            />

            {activeSectionLegacyItems.length > 0 ? (
              <details className="audit-legacy-items">
                <summary>
                  Datos legacy detectados ({activeSectionLegacyItems.length}) - se conservarán al guardar
                </summary>
                <ul className="simple-list">
                  {activeSectionLegacyItems.map((item) => (
                    <li key={`${item.item_code}-${item.sort_order}`}>
                      <strong>{item.item_code}</strong> - {item.item_label || "-"}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </SectionCard>

          <SectionCard
            title="C. Verificación por cláusulas ISO"
            description="Revisión compacta por cláusula aplicable en esta sección."
            actions={
              <button
                type="button"
                className="btn-primary"
                disabled={savingChecks}
                onClick={handleSaveSectionChecks}
              >
                {savingChecks ? "Guardando..." : "Guardar verificación"}
              </button>
            }
          >
            {activeSectionChecks.length === 0 ? (
              <p className="empty-state">No hay cláusulas configuradas para esta sección.</p>
            ) : (
              <div
                className={`audit-check-table-wrap ${
                  activeSection.section_code === "9" ? "audit-check-table-wrap-compact" : ""
                }`}
              >
                <table
                  className={`audit-check-table ${
                    activeSection.section_code === "9" ? "audit-check-table-compact" : ""
                  }`}
                >
                  <thead>
                    <tr>
                      <th>Cláusula</th>
                      <th>Aplica</th>
                      <th>Estado</th>
                      <th>Evidencia</th>
                      <th>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSectionChecks.map((check, index) => (
                      <tr key={`${check.id || check.clause_code}-${index}`}>
                        <td>
                          <strong>{check.clause_code}</strong>
                          <p className="soft-label">{check.clause_title || "-"}</p>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={Boolean(check.applicable)}
                            onChange={(event) =>
                              updateClauseCheckRow(index, {
                                applicable: event.target.checked,
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="input-select"
                            value={check.clause_status || "compliant"}
                            onChange={(event) =>
                              updateClauseCheckRow(index, {
                                clause_status: event.target.value,
                              })
                            }
                          >
                            {CLAUSE_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className={`input-text ${
                              activeSection.section_code === "9" ? "audit-check-evidence-input" : ""
                            }`}
                            value={check.evidence_summary || ""}
                            onChange={(event) =>
                              updateClauseCheckRow(index, {
                                evidence_summary: event.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <RichTextarea
                            className={`input-textarea ${
                              activeSection.section_code === "9" ? "audit-check-observation-input" : ""
                            }`}
                            value={check.observation_text || ""}
                            onChange={(event) =>
                              updateClauseCheckRow(index, {
                                observation_text: event.target.value,
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="D. Texto del informe" description="Texto narrativo final visible en el informe.">
            <label className="field-stack">
              <span>Texto del informe</span>
              <RichTextarea
                className="input-textarea"
                value={activeSectionDraft.final_text || ""}
                onChange={(event) =>
                  setSectionMetaDraft(activeSection.section_code, {
                    final_text: event.target.value,
                  })
                }
              />
            </label>
          </SectionCard>
        </>
      ) : null}

      {activeTabKey === RESULTS_TAB_KEY ? (
        <SectionCard
          id={WORKSPACE_ANCHORS.results}
          title="Resultados"
          description="Recomendaciones, histórico, conclusiones y disposiciones finales."
        >
          <div className="layout-grid two-columns">
            <SectionCard title="Recomendaciones de esta auditoría" description="Gestión manual y seguimiento.">
              {recommendations.length === 0 ? (
                <p className="empty-state">No hay recomendaciones registradas todavía.</p>
              ) : (
                <div className="stack-list">
                  {recommendations.map((entry) => (
                    <article className="finding-item" key={entry.id}>
                      <div className="finding-head">
                        <p className="finding-title">{entry.body_text}</p>
                        <div className="finding-badges">
                          <StatusBadge value={entry.priority} />
                          <StatusBadge value={entry.recommendation_status} />
                        </div>
                      </div>
                      <div className="finding-meta">Sección: {entry.section_code || "-"}</div>
                      <Link
                        className="inline-link"
                        to={buildQueryPath("/no-conformidades", {
                          report_id: report.id,
                          client_id: client.id,
                          source_recommendation_id: entry.id,
                          origin_type: "audit",
                          title: entry.body_text || "",
                          description: entry.followup_comment || entry.body_text || "",
                        })}
                      >
                        Generar no conformidad / acción correctiva desde esta recomendación
                      </Link>
                      <div className="audit-recommendation-editor">
                        <label className="field-stack">
                          <span>Comentario de seguimiento</span>
                          <RichTextarea
                            className="input-textarea"
                            value={entry.followup_comment || ""}
                            onChange={(event) =>
                              setRecommendations((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id ? { ...item, followup_comment : event.target.value } : item
                                )
                              )
                            }
                          />
                        </label>
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={savingRecommendation}
                            onClick={() =>
                              handlePatchRecommendation(entry.id, {
                                followup_comment: normalizeNullableText(entry.followup_comment),
                              })
                            }
                          >
                            Guardar seguimiento
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={savingRecommendation}
                            onClick={() => handleDeleteRecommendation(entry.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <form className="form-grid" onSubmit={handleCreateRecommendation}>
                <label className="field-stack">
                  <span>Sección</span>
                  <select
                    className="input-select"
                    value={newRecommendationForm.section_code}
                    onChange={(event) =>
                      setNewRecommendationForm((prev) => ({ ...prev, section_code: event.target.value }))
                    }
                  >
                    <option value="">General</option>
                    {sections.map((section) => (
                      <option key={section.section_code} value={section.section_code}>
                        {section.section_code}. {SECTION_NAME_BY_CODE[section.section_code] || section.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="inline-actions">
                  <label className="field-inline">
                    <span>Tipo</span>
                    <select
                      className="input-select"
                      value={newRecommendationForm.recommendation_type}
                      onChange={(event) =>
                        setNewRecommendationForm((prev) => ({
                          ...prev,
                          recommendation_type: event.target.value,
                        }))
                      }
                    >
                      {RECOMMENDATION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-inline">
                    <span>Prioridad</span>
                    <select
                      className="input-select"
                      value={newRecommendationForm.priority}
                      onChange={(event) =>
                        setNewRecommendationForm((prev) => ({ ...prev, priority: event.target.value }))
                      }
                    >
                      {RECOMMENDATION_PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-inline">
                    <span>Estado</span>
                    <select
                      className="input-select"
                      value={newRecommendationForm.recommendation_status}
                      onChange={(event) =>
                        setNewRecommendationForm((prev) => ({
                          ...prev,
                          recommendation_status: event.target.value,
                        }))
                      }
                    >
                      {RECOMMENDATION_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field-stack">
                  <span>Texto</span>
                  <RichTextarea
                    className="input-textarea"
                    value={newRecommendationForm.body_text}
                    onChange={(event) =>
                      setNewRecommendationForm((prev) => ({ ...prev, body_text: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="field-stack">
                  <span>Comentario de seguimiento</span>
                  <RichTextarea
                    className="input-textarea"
                    value={newRecommendationForm.followup_comment}
                    onChange={(event) =>
                      setNewRecommendationForm((prev) => ({
                        ...prev,
                        followup_comment: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field-inline">
                  <input
                    type="checkbox"
                    checked={newRecommendationForm.carried_from_previous}
                    onChange={(event) =>
                      setNewRecommendationForm((prev) => ({
                        ...prev,
                        carried_from_previous: event.target.checked,
                      }))
                    }
                  />
                  <span>Arrastrada de auditoría previa</span>
                </label>

                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={savingRecommendation}>
                    Añadir recomendación
                  </button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Histórico de recomendaciones"
              description="Trazabilidad de auditorías anteriores del mismo cliente."
            >
              {historyRecommendations.length === 0 ? (
                <p className="empty-state">No hay histórico disponible para este cliente.</p>
              ) : (
                <div className="stack-list">
                  {historyRecommendations.map((entry) => (
                    <article className="finding-item" key={entry.id}>
                      <div className="finding-head">
                        <p className="finding-title">{entry.body_text}</p>
                        <StatusBadge value={entry.recommendation_status || "pending"} />
                      </div>
                      <p className="finding-meta">
                        {entry.report_code || "-"} · Año {entry.report_year || "-"} · Sección {entry.section_code || "-"}
                      </p>
                      <p>{entry.followup_comment || "Sin comentario de seguimiento."}</p>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="audit-results-final-block">
            <label className="field-stack">
              <span>Conclusiones</span>
              <RichTextarea
                className="input-textarea"
                value={headerForm.conclusions_text}
                onChange={(event) =>
                  setHeaderForm((prev) => ({ ...prev, conclusions_text: event.target.value }))
                }
              />
            </label>

            <label className="field-stack">
              <span>Disposiciones finales</span>
              <RichTextarea
                className="input-textarea"
                value={headerForm.final_dispositions_text}
                onChange={(event) =>
                  setHeaderForm((prev) => ({
                    ...prev,
                    final_dispositions_text: event.target.value,
                  }))
                }
              />
            </label>

            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={handleSaveHeader} disabled={savingHeader}>
                {savingHeader ? "Guardando..." : "Guardar resultados"}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}

export default AuditDetailPage;





