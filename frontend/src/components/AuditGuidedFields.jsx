import { useEffect, useMemo, useState } from "react";

import {
  fetchAuditContextDocument,
  fetchAuditInterestedPartiesDocument,
  fetchAuditRiskOpportunityDocument,
  putAuditContextDocument,
  putAuditInterestedPartiesDocument,
  putAuditRiskOpportunityDocument,
} from "../api/auditsApi";

const P09_MASTER_TEMPLATE_ROWS = [
  {
    stakeholder: "Gerencia",
    needs: "Rentabilidad, control y margen de actuacion.",
    expectations: "Resultados sostenidos, retorno de la inversión y crecimiento.",
    requirements: "Objetivos e indicadores alcanzables y cumplimiento de requisitos aplicables.",
    risks: "Mala toma de decisiones, perdida de beneficios, falta de comunicacion e incumplimientos legales.",
    opportunities: "Crecimiento sostenible y mejora del posicionamiento.",
    actions: "Seguimiento periodico, revision de indicadores y mejora de la comunicacion y control estrategico.",
  },
  {
    stakeholder: "Trabajadores",
    needs: "Seguridad, estabilidad, medios adecuados y formacion.",
    expectations: "Buen ambiente, desarrollo profesional y comunicacion interna eficaz.",
    requirements: "Cumplimiento PRL, legislacion laboral e instrucciones de trabajo claras.",
    risks: "Accidentes, fuga de personal, bajas prolongadas y falta de comunicacion.",
    opportunities: "Mayor productividad, especializacion y mejora del compromiso.",
    actions: "Formación continua, reuniones periódicas, seguimiento del desempeño y entrega de EPIs.",
  },
  {
    stakeholder: "Clientes",
    needs: "Calidad, cumplimiento, rentabilidad y servicio fiable.",
    expectations: "Atencion adecuada, cumplimiento de plazos, confianza y buena imagen.",
    requirements: "Cumplimiento de especificaciones, requisitos del servicio y normativa aplicable.",
    risks: "Retrasos, errores de ejecucion, incumplimientos e incidencias de seguridad.",
    opportunities: "Fidelización, servicios personalizados, mejora reputacional y nuevas inversiones.",
    actions: "Control de calidad, seguimiento del servicio, mejora continua y cumplimiento normativo.",
  },
  {
    stakeholder: "Proveedores",
    needs: "Relacion estable, planificacion y pagos previsibles.",
    expectations: "Comunicacion clara y continuidad de colaboracion.",
    requirements: "Contratos claros, criterios definidos y cumplimiento legal.",
    risks: "Incumplimientos, interrupciones de suministro y dependencia excesiva.",
    opportunities: "Alianzas, mejora de condiciones y colaboracion a largo plazo.",
    actions: "Evaluación periódica, homologación, solicitud de certificaciones y seguimiento.",
  },
  {
    stakeholder: "Competencia",
    needs: "Vigilancia del mercado y posicionamiento competitivo.",
    expectations: "Diferenciacion y mantenimiento de cuota.",
    requirements: "Analisis de mercado y estrategia comercial coherente.",
    risks: "Perdida de cuota y competencia desleal.",
    opportunities: "Mejora competitiva, diferenciacion y refuerzo de certificaciones.",
    actions: "Analisis de mercado, revision de posicionamiento y mejora continua.",
  },
  {
    stakeholder: "Cambio climatico",
    needs: "Adaptacion, eficiencia y control del impacto ambiental.",
    expectations: "Mejora de imagen sostenible, reduccion de costes y atraccion de clientes sensibilizados.",
    requirements: "Consideracion de impactos ambientales y requisitos aplicables.",
    risks: "Sanciones, dano reputacional y aumento de costes energeticos o de materiales.",
    opportunities: "Eficiencia energetica, innovacion y diferenciacion sostenible.",
    actions: "Reduccion de emisiones, mejora de consumos, impulso de cultura ambiental y uso de tecnologias mas limpias.",
  },
  {
    stakeholder: "Autoridades legales",
    needs: "Cumplimiento normativo.",
    expectations: "Colaboracion, transparencia y adecuacion legal.",
    requirements: "Cumplimiento legal y reglamentario aplicable.",
    risks: "Multas, sanciones e incumplimientos administrativos.",
    opportunities: "Confianza institucional y reduccion de contingencias.",
    actions: "Auditorías, actualización legislativa y seguimiento del cumplimiento.",
  },
  {
    stakeholder: "Bancos y aseguradoras",
    needs: "Estabilidad financiera y cobertura adecuada.",
    expectations: "Solvencia, control y cumplimiento documental.",
    requirements: "Obligaciones financieras y contractuales al dia.",
    risks: "Falta de financiacion, coberturas insuficientes y desviaciones financieras.",
    opportunities: "Mejores condiciones, digitalizacion y optimizacion de costes.",
    actions: "Control financiero, revision de polizas, actualizacion documental y seguimiento de riesgos.",
  },
  {
    stakeholder: "Mutua accidentes",
    needs: "Coordinacion en salud laboral y gestion de contingencias.",
    expectations: "Prevencion, comunicacion rapida y cumplimiento.",
    requirements: "Gestion de accidentes y obligaciones preventivas.",
    risks: "Accidentes, incidencias laborales y deficiencias preventivas.",
    opportunities: "Mejora preventiva y reduccion de siniestralidad.",
    actions: "Protocolos, seguimiento de accidentes, coordinacion documental y acciones preventivas.",
  },
  {
    stakeholder: "Servicio prevencion ajeno",
    needs: "Integracion preventiva real y seguimiento eficaz.",
    expectations: "Colaboración, evaluación y planificación preventiva.",
    requirements: "Cumplimiento PRL, evaluaciones y medidas preventivas actualizadas.",
    risks: "Riesgos laborales no controlados, falta de seguimiento y deficiencias documentales.",
    opportunities: "Mejora de cultura preventiva, reduccion de incidentes y mejor planificacion.",
    actions: "Seguimiento de planificación preventiva, revisiones periódicas, coordinación y actualización de evaluaciones.",
  },
  {
    stakeholder: "Contratas",
    needs: "Coordinacion, ejecucion correcta y cumplimiento documental.",
    expectations: "Colaboracion fluida, calidad y cumplimiento.",
    requirements: "CAE, requisitos contractuales y control operativo.",
    risks: "Errores de ejecucion, incumplimientos documentales y fallos de coordinacion.",
    opportunities: "Sinergias, mejora de satisfacción del cliente y refuerzo de cumplimiento.",
    actions: "Control de coordinación, seguimiento documental, revisión de trabajos y control del desempeño.",
  },
];

const CONTEXT_P09_MASTER_TEMPLATE_ROWS = [
  {
    context_group: "externo",
    environment: "Legal y normativo",
    risks: "Cambios regulatorios y sanciones por incumplimiento.",
    opportunities: "Adaptacion temprana a normativa y mejora del cumplimiento.",
    actions: "Seguimiento legislativo, actualizacion documental y formacion continua.",
  },
  {
    context_group: "externo",
    environment: "Economico y financiero",
    risks: "Inflacion, subida de costes y tension de tesoreria.",
    opportunities: "Optimización de costes y nuevas inversiones sostenibles.",
    actions: "Control financiero periodico y diversificacion de proveedores.",
  },
  {
    context_group: "externo",
    environment: "Competitivo y de mercado",
    risks: "Alta competencia y presion en precios.",
    opportunities: "Diferenciacion en calidad y servicio.",
    actions: "Analisis de mercado y ajuste de estrategia comercial.",
  },
  {
    context_group: "externo",
    environment: "Tecnologico",
    risks: "Obsolescencia tecnologica y baja capacidad de respuesta.",
    opportunities: "Innovacion, digitalizacion y mejora operativa.",
    actions: "Inversión en tecnología y formación técnica del equipo.",
  },
  {
    context_group: "externo",
    environment: "Social",
    risks: "Cambios en la demanda o en la percepcion del servicio.",
    opportunities: "Mejor adaptacion al cliente y mejora de la confianza.",
    actions: "Escucha activa y adaptacion de servicios a necesidades reales.",
  },
  {
    context_group: "externo",
    environment: "Medioambiental",
    risks: "Restricciones ambientales y mayores exigencias regulatorias.",
    opportunities: "Posicionamiento sostenible y eficiencia en consumos.",
    actions: "Uso de materiales ecologicos y gestion responsable de residuos.",
  },
  {
    context_group: "interno",
    environment: "Organización",
    risks: "Falta de estructura clara y solapamiento de responsabilidades.",
    opportunities: "Mejora de la eficiencia y de la coordinacion interna.",
    actions: "Definicion de roles, responsabilidades y procesos clave.",
  },
  {
    context_group: "interno",
    environment: "Valores",
    risks: "Desalineacion interna y debilidad de cultura corporativa.",
    opportunities: "Cultura corporativa fuerte y compromiso sostenido.",
    actions: "Comunicacion de valores y refuerzo del liderazgo.",
  },
  {
    context_group: "interno",
    environment: "Conocimientos",
    risks: "Falta de formacion y dependencia de personas clave.",
    opportunities: "Especializacion tecnica y transferencia de conocimiento.",
    actions: "Plan de formacion continua y gestion del conocimiento.",
  },
  {
    context_group: "interno",
    environment: "Tecnologia",
    risks: "Sistemas obsoletos y baja trazabilidad operativa.",
    opportunities: "Automatizacion y mayor control del proceso.",
    actions: "Actualizacion de software, equipos y herramientas digitales.",
  },
  {
    context_group: "interno",
    environment: "Infraestructura",
    risks: "Instalaciones inadecuadas y fallos de mantenimiento.",
    opportunities: "Optimizacion de recursos y mejora de seguridad.",
    actions: "Mantenimiento planificado e inversión en infraestructura.",
  },
  {
    context_group: "interno",
    environment: "Comunicacion",
    risks: "Falta de coordinacion y errores por informacion incompleta.",
    opportunities: "Mejor trabajo en equipo y toma de decisiones agil.",
    actions: "Implantar canales efectivos y rutinas de comunicacion.",
  },
  {
    context_group: "interno",
    environment: "Factores operacionales",
    risks: "Errores de ejecucion y variabilidad en resultados.",
    opportunities: "Estandarizacion y mayor estabilidad del servicio.",
    actions: "Procedimientos operativos y controles de calidad periodicos.",
  },
];

const RISK_OPPORTUNITY_SWOT_TEMPLATE = {
  weakness: ["Dependencia de recursos clave en procesos criticos."],
  threat: ["Incremento de costes y cambios regulatorios con impacto operativo."],
  strength: ["Experiencia tecnica consolidada y capacidad de respuesta."],
  opportunity: ["Digitalizacion y mejora de eficiencia en la prestacion del servicio."],
};

const RISK_OPPORTUNITY_SEVERITY_OPTIONS = [
  { value: "slight", label: "Ligero" },
  { value: "harm", label: "Daño" },
  { value: "extreme", label: "Extremo" },
];

const RISK_OPPORTUNITY_VIABILITY_OPTIONS = [
  { value: 1, label: "1" },
  { value: 3, label: "3" },
  { value: 5, label: "5" },
];

const RISK_OPPORTUNITY_ACTION_TYPE_OPTIONS = [
  { value: "OBJ", label: "OBJ" },
  { value: "COS", label: "COS" },
  { value: "GES", label: "GES" },
  { value: "FOR", label: "FOR" },
  { value: "INF", label: "INF" },
  { value: "AC", label: "AC" },
  { value: "INV", label: "INV" },
  { value: "CAM", label: "CAM" },
  { value: "OTRA", label: "OTRA" },
];

const RISK_OPPORTUNITY_YES_NO_OPTIONS = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
];

const RISK_OPPORTUNITY_ACTION_RESULT_OPTIONS = [
  { value: "in_progress", label: "En progreso" },
  { value: "satisfactory", label: "Satisfactorio" },
  { value: "unsatisfactory", label: "No satisfactorio" },
];

const RISK_OPPORTUNITY_PROBABILITY_OPTIONS = [
  { value: "low", label: "Bajo" },
  { value: "medium", label: "Medio" },
  { value: "high", label: "Alto" },
];

const RISK_OPPORTUNITY_SWOT_SECTIONS = [
  { key: "weakness", title: "Debilidades" },
  { key: "threat", title: "Amenazas" },
  { key: "strength", title: "Fortalezas" },
  { key: "opportunity", title: "Oportunidades" },
];

const RISK_OPPORTUNITY_ROW_TYPES = {
  SWOT: "swot",
  RISK: "risk",
  OPPORTUNITY: "opportunity",
  FOLLOW_UP: "action",
};

const RISK_OPPORTUNITY_REFERENCE_TYPES = {
  RISK: "risk",
  OPPORTUNITY: "opportunity",
};

const RISK_PROBABILITY_SCORE = {
  low: 1,
  medium: 2,
  high: 3,
};

const RISK_SEVERITY_SCORE = {
  slight: 1,
  harm: 2,
  extreme: 3,
};

function normalizeRiskProbability(value, fallback = "medium") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return fallback;
}

function normalizeRiskSeverity(value, fallback = "harm") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "slight" || normalized === "harm" || normalized === "extreme") {
    return normalized;
  }
  return fallback;
}

function normalizeOpportunityScore(value, fallback = 3) {
  const numeric = Number(value);
  if (numeric === 1 || numeric === 3 || numeric === 5) {
    return numeric;
  }
  return fallback;
}

function mapOpportunityScoreToLevel(score) {
  if (score <= 1) return "low";
  if (score <= 3) return "medium";
  return "high";
}

function normalizeYesNoValue(value, fallback = "no") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["yes", "si", "sí", "true", "1"].includes(normalized)) return "yes";
  if (["no", "false", "0"].includes(normalized)) return "no";
  return fallback;
}

function normalizeActionResultValue(value, fallback = "in_progress") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (normalized === "satisfactorio" || normalized === "satisfactory") return "satisfactory";
  if (
    normalized === "no_satisfactorio" ||
    normalized === "nosatisfactorio" ||
    normalized === "no_satisfactory" ||
    normalized === "unsatisfactory"
  ) {
    return "unsatisfactory";
  }
  if (normalized === "en_progreso" || normalized === "in_progress" || normalized === "progreso") {
    return "in_progress";
  }
  return fallback;
}

function getActionResultBadge(value) {
  const normalized = normalizeActionResultValue(value);
  if (normalized === "satisfactory") {
    return { value: normalized, label: "Satisfactorio", tone: "satisfactory" };
  }
  if (normalized === "unsatisfactory") {
    return { value: normalized, label: "No satisfactorio", tone: "unsatisfactory" };
  }
  return { value: "in_progress", label: "En progreso", tone: "in-progress" };
}

function mapRiskSeverityToLegacyImpact(severity) {
  if (severity === "slight") return "low";
  if (severity === "harm") return "medium";
  return "high";
}

function mapLegacyImpactToSeverity(impact) {
  if (impact === "low") return "slight";
  if (impact === "medium") return "harm";
  if (impact === "high") return "extreme";
  return "harm";
}

function mapLegacyLevelToOpportunityScore(level) {
  if (level === "low") return 1;
  if (level === "high") return 5;
  return 3;
}

function calculateRiskEvaluation(probability, severity) {
  const riskScore =
    (RISK_PROBABILITY_SCORE[normalizeRiskProbability(probability)] || 2) *
    (RISK_SEVERITY_SCORE[normalizeRiskSeverity(severity)] || 2);

  if (riskScore <= 2) {
    return { score: riskScore, label: "Tolerable", tone: "tolerable" };
  }
  if (riskScore <= 4) {
    return { score: riskScore, label: "Moderado", tone: "moderate" };
  }
  if (riskScore <= 6) {
    return { score: riskScore, label: "Importante", tone: "important" };
  }
  return { score: riskScore, label: "Intolerable", tone: "intolerable" };
}

function calculateOpportunityEvaluation(viability, attractiveness) {
  const total =
    normalizeOpportunityScore(viability, 3) + normalizeOpportunityScore(attractiveness, 3);
  return {
    total,
    label: total >= 6 ? "Significativo" : "No significativo",
    tone: total >= 6 ? "significant" : "not-significant",
  };
}

function truncateRiskSourceText(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Sin detalle";
  if (normalized.length <= 64) return normalized;
  return `${normalized.slice(0, 61)}...`;
}

function toRiskSourcePairKey(leftPrefix, leftId, rightPrefix, rightId) {
  return `${leftPrefix}:${leftId}|${rightPrefix}:${rightId}`;
}

function buildRiskCandidatesFromSwot(swotRows) {
  const weaknesses = (Array.isArray(swotRows) ? swotRows : []).filter(
    (row) =>
      String(row?.swot_category || "").trim().toLowerCase() === "weakness" &&
      String(row?.description || "").trim()
  );
  const threats = (Array.isArray(swotRows) ? swotRows : []).filter(
    (row) =>
      String(row?.swot_category || "").trim().toLowerCase() === "threat" &&
      String(row?.description || "").trim()
  );

  const candidates = [];
  if (weaknesses.length > 0 && threats.length > 0) {
    weaknesses.forEach((weakness) => {
      threats.forEach((threat) => {
        const weaknessText = String(weakness.description || "").trim();
        const threatText = String(threat.description || "").trim();
        candidates.push({
          source_key: toRiskSourcePairKey("w", weakness.id, "t", threat.id),
          source_label: `${truncateRiskSourceText(weaknessText)} + ${truncateRiskSourceText(threatText)}`,
          description: `Riesgo derivado de la debilidad "${weaknessText}" frente a la amenaza "${threatText}".`,
        });
      });
    });
    return candidates;
  }

  weaknesses.forEach((weakness) => {
    const weaknessText = String(weakness.description || "").trim();
    candidates.push({
      source_key: `w:${weakness.id}`,
      source_label: truncateRiskSourceText(weaknessText),
      description: `Riesgo asociado a la debilidad "${weaknessText}".`,
    });
  });
  threats.forEach((threat) => {
    const threatText = String(threat.description || "").trim();
    candidates.push({
      source_key: `t:${threat.id}`,
      source_label: truncateRiskSourceText(threatText),
      description: `Riesgo asociado a la amenaza "${threatText}".`,
    });
  });
  return candidates;
}

function buildOpportunityCandidatesFromSwot(swotRows) {
  const strengths = (Array.isArray(swotRows) ? swotRows : []).filter(
    (row) =>
      String(row?.swot_category || "").trim().toLowerCase() === "strength" &&
      String(row?.description || "").trim()
  );
  const opportunities = (Array.isArray(swotRows) ? swotRows : []).filter(
    (row) =>
      String(row?.swot_category || "").trim().toLowerCase() === "opportunity" &&
      String(row?.description || "").trim()
  );

  const candidates = [];
  if (strengths.length > 0 && opportunities.length > 0) {
    strengths.forEach((strength) => {
      opportunities.forEach((opportunity) => {
        const strengthText = String(strength.description || "").trim();
        const opportunityText = String(opportunity.description || "").trim();
        candidates.push({
          source_key: toRiskSourcePairKey("s", strength.id, "o", opportunity.id),
          source_label: `${truncateRiskSourceText(strengthText)} + ${truncateRiskSourceText(opportunityText)}`,
          description: `Oportunidad derivada de la fortaleza "${strengthText}" para aprovechar "${opportunityText}".`,
        });
      });
    });
    return candidates;
  }

  strengths.forEach((strength) => {
    const strengthText = String(strength.description || "").trim();
    candidates.push({
      source_key: `s:${strength.id}`,
      source_label: truncateRiskSourceText(strengthText),
      description: `Oportunidad de apalancamiento de la fortaleza "${strengthText}".`,
    });
  });
  opportunities.forEach((opportunity) => {
    const opportunityText = String(opportunity.description || "").trim();
    candidates.push({
      source_key: `o:${opportunity.id}`,
      source_label: truncateRiskSourceText(opportunityText),
      description: `Oportunidad vinculada a "${opportunityText}".`,
    });
  });
  return candidates;
}

const INTERESTED_PARTIES_AUTOFILL_FIELD_CODES = new Set([
  "interested_parties_document_code",
  "interested_parties_revision",
  "interested_parties_date",
]);

const CONTEXT_AUTOFILL_FIELD_CODES = new Set([
  "context_document_code",
  "context_document_revision",
  "context_document_date",
]);

const AUTOFILL_FIELD_CODES = new Set([
  ...INTERESTED_PARTIES_AUTOFILL_FIELD_CODES,
  ...CONTEXT_AUTOFILL_FIELD_CODES,
]);

const INTERESTED_PARTIES_HIDDEN_UI_FIELD_CODES = new Set([
  "interested_parties_document_code",
  "interested_parties_revision",
  "interested_parties_date",
  "new_interested_parties_detected",
  "new_interested_parties_detail",
  "climate_change_in_interested_parties",
]);

const CONTEXT_HIDDEN_UI_FIELD_CODES = new Set([
  "context_document_code",
  "context_document_revision",
  "context_document_date",
  "external_issues_summary",
  "internal_issues_summary",
  "climate_change_relevant",
  "climate_change_notes",
]);

const PERFORMANCE_INDICATORS_FIELD_CODE = "performance_indicators_matrix";
const PERFORMANCE_INDICATORS_GROUP_CODE = "indicadores_desempeno";

const PERFORMANCE_TAB_KEYS = {
  INDICATORS: "indicators",
  TRACKING: "tracking",
  CHART: "chart",
  VALUES: "values",
};

const PERFORMANCE_ANNUAL_MODE_OPTIONS = [
  { value: "average", label: "Media" },
  { value: "sum", label: "Suma" },
];

const PERFORMANCE_CATALOG_TEMPLATE_ROWS = [
  {
    area: "Clientes",
    indicator: "Indice de satisfaccion",
    description: "Nivel de satisfaccion del cliente",
    formula: "(Encuestas positivas / Total encuestas) * 100",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Calidad",
  },
  {
    area: "Clientes",
    indicator: "Reclamaciones",
    description: "Numero de reclamaciones por proyecto",
    formula: "Total reclamaciones / Numero de proyectos",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Calidad",
  },
  {
    area: "Operaciones",
    indicator: "Instalaciones conformes",
    description: "Porcentaje de instalaciones aceptadas a la primera",
    formula: "(Instalaciones OK / Total) * 100",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Produccion",
  },
  {
    area: "Operaciones",
    indicator: "Desviacion de plazos",
    description: "Diferencia entre plazo previsto y real",
    formula: "Dias reales - Dias previstos",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Produccion",
  },
  {
    area: "Calidad",
    indicator: "No conformidades",
    description: "Numero de no conformidades detectadas",
    formula: "Conteo total",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Calidad",
  },
  {
    area: "Calidad",
    indicator: "Acciones correctivas eficaces",
    description: "Porcentaje de acciones cerradas eficazmente",
    formula: "(Acciones eficaces / Total) * 100",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Calidad",
  },
  {
    area: "Compras",
    indicator: "Evaluacion de proveedores",
    description: "Desempeno de proveedores",
    formula: "Puntuacion media de evaluaciones",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Compras",
  },
  {
    area: "Compras",
    indicator: "Incidencias de proveedor",
    description: "Problemas con suministros",
    formula: "Numero de incidencias / pedidos",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Compras",
  },
  {
    area: "Tecnico",
    indicator: "Incidencias en puesta en marcha",
    description: "Errores en arranque de instalaciones",
    formula: "Conteo total",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "Produccion",
  },
  {
    area: "Legal",
    indicator: "Cumplimiento normativo",
    description: "Grado de cumplimiento legal",
    formula: "(Requisitos cumplidos / Total) * 100",
    objective_associated: "no",
    target: "",
    frequency: "Anual",
    responsible: "Calidad",
  },
];

const PERFORMANCE_DEFAULT_VALUES = [
  { id: "yes", label: "Si", key: "yes" },
  { id: "no", label: "No", key: "no" },
];

let p09RowSequence = 0;
let contextRowSequence = 0;

function nextP09RowId() {
  p09RowSequence += 1;
  return `p09-row-${p09RowSequence}`;
}

function nextContextRowId() {
  contextRowSequence += 1;
  return `context-row-${contextRowSequence}`;
}

function createClientUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const segment = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${segment()}${segment()}-${segment()}-4${segment().slice(1)}-${(
    8 + Math.floor(Math.random() * 4)
  ).toString(16)}${segment().slice(1)}-${segment()}${segment()}${segment()}`;
}

function nextRiskOpportunityRowId() {
  return createClientUuid();
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function createEmptyPerformanceIndicatorCatalogRow(overrides = {}) {
  return {
    id: nextRiskOpportunityRowId(),
    area: "",
    indicator: "",
    description: "",
    formula: "",
    objective_associated: "no",
    target: "",
    frequency: "Trimestral",
    responsible: "",
    ...overrides,
  };
}

function createEmptyPerformanceTrackingRow(indicatorId, overrides = {}) {
  return {
    id: nextRiskOpportunityRowId(),
    indicator_id: String(indicatorId || "").trim(),
    q1: "",
    q2: "",
    q3: "",
    ...overrides,
  };
}

function normalizePerformanceNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return "";
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return "";
  return numericValue;
}

function normalizePerformanceCatalogRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((entry) =>
    createEmptyPerformanceIndicatorCatalogRow({
      id: String(entry?.id || "").trim() || nextRiskOpportunityRowId(),
      area: String(entry?.area || ""),
      indicator: String(entry?.indicator || ""),
      description: String(entry?.description || ""),
      formula: String(entry?.formula || ""),
      objective_associated: normalizeYesNoValue(entry?.objective_associated, "no"),
      target: String(entry?.target ?? ""),
      frequency: String(entry?.frequency || ""),
      responsible: String(entry?.responsible || ""),
    })
  );
}

function normalizePerformanceTrackingRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((entry) =>
    createEmptyPerformanceTrackingRow(entry?.indicator_id, {
      id: String(entry?.id || "").trim() || nextRiskOpportunityRowId(),
      indicator_id: String(entry?.indicator_id || "").trim(),
      q1: normalizePerformanceNumber(entry?.q1),
      q2: normalizePerformanceNumber(entry?.q2),
      q3: normalizePerformanceNumber(entry?.q3),
    })
  );
}

function normalizePerformanceValues(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return PERFORMANCE_DEFAULT_VALUES;
  }
  const normalized = rows
    .map((entry) => ({
      id: String(entry?.id || "").trim() || nextRiskOpportunityRowId(),
      key: String(entry?.key || "").trim().toLowerCase(),
      label: String(entry?.label || "").trim(),
    }))
    .filter((entry) => entry.label);
  if (normalized.length === 0) {
    return PERFORMANCE_DEFAULT_VALUES;
  }
  return normalized;
}

function reconcilePerformanceTrackingRows(indicators, trackingRows) {
  const trackingMap = new Map(
    normalizePerformanceTrackingRows(trackingRows).map((row) => [String(row.indicator_id || ""), row])
  );
  return normalizePerformanceCatalogRows(indicators).map((indicatorRow) => {
    const existing = trackingMap.get(String(indicatorRow.id || ""));
    return createEmptyPerformanceTrackingRow(indicatorRow.id, {
      id: existing?.id || nextRiskOpportunityRowId(),
      indicator_id: String(indicatorRow.id || ""),
      q1: normalizePerformanceNumber(existing?.q1),
      q2: normalizePerformanceNumber(existing?.q2),
      q3: normalizePerformanceNumber(existing?.q3),
    });
  });
}

function buildPerformanceTemplateRows() {
  return PERFORMANCE_CATALOG_TEMPLATE_ROWS.map((entry) =>
    createEmptyPerformanceIndicatorCatalogRow({
      area: entry.area,
      indicator: entry.indicator,
      description: entry.description,
      formula: entry.formula,
      objective_associated: entry.objective_associated,
      target: entry.target,
      frequency: entry.frequency,
      responsible: entry.responsible,
    })
  );
}

function buildDefaultPerformanceIndicatorsModel() {
  const indicators = buildPerformanceTemplateRows();
  return {
    version: 2,
    annual_mode: "average",
    indicators,
    tracking: reconcilePerformanceTrackingRows(indicators, []),
    values: PERFORMANCE_DEFAULT_VALUES,
  };
}

function migrateLegacyPerformanceIndicatorsRows(rawValue) {
  if (!Array.isArray(rawValue) || rawValue.length === 0) return null;
  const indicators = rawValue.map((row) =>
    createEmptyPerformanceIndicatorCatalogRow({
      area: String(row?.process || ""),
      indicator: String(row?.indicator || ""),
      description: String(row?.observation || ""),
      formula: "",
      objective_associated: "no",
      target: row?.objective == null || row?.objective === "" ? "" : String(row.objective),
      frequency: "Trimestral",
      responsible: "",
    })
  );
  const tracking = indicators.map((indicatorRow, index) =>
    createEmptyPerformanceTrackingRow(indicatorRow.id, {
      indicator_id: indicatorRow.id,
      q1: normalizePerformanceNumber(rawValue[index]?.result),
      q2: "",
      q3: "",
    })
  );
  return {
    version: 2,
    annual_mode: "average",
    indicators,
    tracking,
    values: PERFORMANCE_DEFAULT_VALUES,
  };
}

function normalizePerformanceIndicatorsModel(rawValue) {
  if (Array.isArray(rawValue)) {
    return migrateLegacyPerformanceIndicatorsRows(rawValue) || buildDefaultPerformanceIndicatorsModel();
  }

  if (rawValue && typeof rawValue === "object") {
    const indicators = normalizePerformanceCatalogRows(rawValue.indicators);
    const safeIndicators = indicators.length > 0 ? indicators : buildPerformanceTemplateRows();
    return {
      version: 2,
      annual_mode: String(rawValue.annual_mode || "").trim().toLowerCase() === "sum" ? "sum" : "average",
      indicators: safeIndicators,
      tracking: reconcilePerformanceTrackingRows(safeIndicators, rawValue.tracking),
      values: normalizePerformanceValues(rawValue.values),
    };
  }

  return buildDefaultPerformanceIndicatorsModel();
}

function calculatePerformanceAnnualValue(q1, q2, q3, annualMode = "average") {
  const values = [q1, q2, q3]
    .map((value) => normalizePerformanceNumber(value))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return "";

  const total = values.reduce((acc, value) => acc + Number(value), 0);
  if (annualMode === "sum") {
    return total;
  }
  return total / values.length;
}

function parsePerformanceTarget(target) {
  const normalized = normalizePerformanceNumber(target);
  if (!Number.isFinite(normalized)) return null;
  return normalized;
}

function evaluatePerformanceIndicatorStatus(target, annualValue) {
  const numericTarget = parsePerformanceTarget(target);
  if (!Number.isFinite(numericTarget) || !Number.isFinite(annualValue)) return "in_progress";
  return annualValue >= numericTarget ? "compliant" : "non_compliant";
}

function getPerformanceIndicatorStatusBadge(status) {
  if (status === "compliant") {
    return { label: "Cumple", tone: "compliant" };
  }
  if (status === "non_compliant") {
    return { label: "No cumple", tone: "non-compliant" };
  }
  return { label: "En progreso", tone: "in-progress" };
}

function formatPerformanceMetric(value) {
  const numeric = normalizePerformanceNumber(value);
  if (!Number.isFinite(numeric)) return "-";
  const hasDecimals = Math.abs(numeric % 1) > 0;
  return numeric.toLocaleString("es-ES", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function composeLegacyNeedsExpectations(needs, expectations) {
  const normalizedNeeds = normalizeNullableText(needs);
  const normalizedExpectations = normalizeNullableText(expectations);
  if (normalizedNeeds && normalizedExpectations) {
    return `${normalizedNeeds} | ${normalizedExpectations}`;
  }
  return normalizedNeeds || normalizedExpectations || null;
}

function createEmptyP09Row(overrides = {}) {
  return {
    id: nextP09RowId(),
    interested_party: "",
    needs: "",
    expectations: "",
    requirements: "",
    risks: "",
    opportunities: "",
    actions: "",
    applies: "yes",
    observations: "",
    ...overrides,
  };
}

function buildDefaultP09Rows() {
  return P09_MASTER_TEMPLATE_ROWS.map((entry) =>
    createEmptyP09Row({
      interested_party: entry.stakeholder,
      needs: entry.needs,
      expectations: entry.expectations,
      requirements: entry.requirements,
      risks: entry.risks,
      opportunities: entry.opportunities,
      actions: entry.actions,
      applies: "yes",
      observations: "",
    })
  );
}

function cloneP09Rows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id || nextP09RowId(),
    interested_party: String(row?.interested_party || ""),
    needs: String(row?.needs || ""),
    expectations: String(row?.expectations || ""),
    requirements: String(row?.requirements || ""),
    risks: String(row?.risks || ""),
    opportunities: String(row?.opportunities || ""),
    actions: String(row?.actions || ""),
    applies: row?.applies === "no" ? "no" : "yes",
    observations: String(row?.observations || ""),
  }));
}

function mapApiRowsToP09Rows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id || nextP09RowId(),
    interested_party: String(row?.stakeholder_name || ""),
    needs: String(row?.needs || row?.needs_expectations || ""),
    expectations: String(row?.expectations || ""),
    requirements: String(row?.requirements || ""),
    risks: String(row?.risks || ""),
    opportunities: String(row?.opportunities || ""),
    actions: String(row?.actions || ""),
    applies: row?.applies ? "yes" : "no",
    observations: String(row?.observations || ""),
  }));
}

function buildP09RowsPayload(rows) {
  const normalizedRows = cloneP09Rows(rows)
    .map((row, index) => ({
      stakeholder_name: normalizeNullableText(row.interested_party),
      needs: normalizeNullableText(row.needs),
      expectations: normalizeNullableText(row.expectations),
      requirements: normalizeNullableText(row.requirements),
      risks: normalizeNullableText(row.risks),
      opportunities: normalizeNullableText(row.opportunities),
      actions: normalizeNullableText(row.actions),
      needs_expectations: composeLegacyNeedsExpectations(row.needs, row.expectations),
      applies: row.applies !== "no",
      observations: normalizeNullableText(row.observations),
      sort_order: index,
    }))
    .filter(
      (row) =>
        row.stakeholder_name ||
        row.needs ||
        row.expectations ||
        row.requirements ||
        row.risks ||
        row.opportunities ||
        row.actions ||
        row.observations
    );
  return normalizedRows;
}

const CONTEXT_GROUP_ORDER = ["externo", "interno"];

const CONTEXT_GROUP_LABELS = {
  externo: "Contexto externo",
  interno: "Contexto interno",
};

function normalizeContextGroup(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "interno" ? "interno" : "externo";
}

function createEmptyContextRow(overrides = {}) {
  return {
    id: nextContextRowId(),
    context_group: "externo",
    environment: "",
    risks: "",
    opportunities: "",
    actions: "",
    observations: "",
    ...overrides,
  };
}

function buildDefaultContextRows() {
  return CONTEXT_P09_MASTER_TEMPLATE_ROWS.map((entry) =>
    createEmptyContextRow({
      context_group: normalizeContextGroup(entry.context_group),
      environment: entry.environment,
      risks: entry.risks,
      opportunities: entry.opportunities,
      actions: entry.actions,
      observations: "",
    })
  );
}

function cloneContextRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id || nextContextRowId(),
    context_group: normalizeContextGroup(row?.context_group),
    environment: String(row?.environment || ""),
    risks: String(row?.risks || ""),
    opportunities: String(row?.opportunities || ""),
    actions: String(row?.actions || ""),
    observations: String(row?.observations || ""),
  }));
}

function mapApiRowsToContextRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id || nextContextRowId(),
    context_group: normalizeContextGroup(row?.context_group),
    environment: String(row?.environment || ""),
    risks: String(row?.risks || ""),
    opportunities: String(row?.opportunities || ""),
    actions: String(row?.actions || ""),
    observations: String(row?.observations || ""),
  }));
}

function buildContextRowsPayload(rows) {
  return cloneContextRows(rows)
    .map((row, index) => ({
      context_group: normalizeContextGroup(row.context_group),
      environment: normalizeNullableText(row.environment),
      risks: normalizeNullableText(row.risks),
      opportunities: normalizeNullableText(row.opportunities),
      actions: normalizeNullableText(row.actions),
      observations: normalizeNullableText(row.observations),
      sort_order: index,
    }))
    .filter(
      (row) =>
        row.environment ||
        row.risks ||
        row.opportunities ||
        row.actions ||
        row.observations
    );
}

function normalizeContextRegisteredCount(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => String(row?.environment || "").trim()).length;
}

function groupContextRows(rows) {
  const grouped = {
    externo: [],
    interno: [],
  };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const groupKey = normalizeContextGroup(row?.context_group);
    grouped[groupKey].push(row);
  });
  return grouped;
}

function createEmptySwotRow(swotCategory, overrides = {}) {
  return {
    id: nextRiskOpportunityRowId(),
    swot_category: String(swotCategory || "weakness").trim().toLowerCase(),
    description: "",
    ...overrides,
  };
}

function createEmptyRiskRow(overrides = {}) {
  return {
    id: nextRiskOpportunityRowId(),
    source_key: "",
    source_label: "",
    is_auto_generated: true,
    process_name: "",
    description: "",
    probability: "medium",
    severity: "harm",
    ...overrides,
  };
}

function createEmptyOpportunityRow(overrides = {}) {
  return {
    id: nextRiskOpportunityRowId(),
    source_key: "",
    source_label: "",
    is_auto_generated: true,
    process_name: "",
    description: "",
    viability: 3,
    attractiveness: 3,
    ...overrides,
  };
}

function createEmptyFollowUpRow(overrides = {}) {
  return {
    id: nextRiskOpportunityRowId(),
    reference_kind: "",
    reference_row_id: "",
    action: "",
    action_type: "",
    indicator: "no",
    objective_associated: "no",
    due_date: "",
    result: "in_progress",
    ...overrides,
  };
}

function cloneRiskOpportunityDraft(value) {
  return {
    swotRows: (Array.isArray(value?.swotRows) ? value.swotRows : []).map((row) =>
      createEmptySwotRow(row?.swot_category, {
        id: row?.id || nextRiskOpportunityRowId(),
        description: String(row?.description || ""),
      })
    ),
    riskRows: (Array.isArray(value?.riskRows) ? value.riskRows : []).map((row) =>
      createEmptyRiskRow({
        id: row?.id || nextRiskOpportunityRowId(),
        source_key: String(row?.source_key || ""),
        source_label: String(row?.source_label || ""),
        is_auto_generated: row?.is_auto_generated !== false,
        process_name: String(row?.process_name || ""),
        description: String(row?.description || ""),
        probability: normalizeRiskProbability(row?.probability),
        severity: normalizeRiskSeverity(row?.severity),
      })
    ),
    opportunityRows: (Array.isArray(value?.opportunityRows) ? value.opportunityRows : []).map((row) =>
      createEmptyOpportunityRow({
        id: row?.id || nextRiskOpportunityRowId(),
        source_key: String(row?.source_key || ""),
        source_label: String(row?.source_label || ""),
        is_auto_generated: row?.is_auto_generated !== false,
        process_name: String(row?.process_name || ""),
        description: String(row?.description || ""),
        viability: normalizeOpportunityScore(row?.viability),
        attractiveness: normalizeOpportunityScore(row?.attractiveness),
      })
    ),
    followUpRows: (Array.isArray(value?.followUpRows) ? value.followUpRows : []).map((row) =>
      createEmptyFollowUpRow({
        id: row?.id || nextRiskOpportunityRowId(),
        reference_kind: String(row?.reference_kind || "").toLowerCase(),
        reference_row_id: String(row?.reference_row_id || ""),
        action: String(row?.action || ""),
        action_type: String(row?.action_type || ""),
        indicator: normalizeYesNoValue(row?.indicator, "no"),
        objective_associated: normalizeYesNoValue(row?.objective_associated, "no"),
        due_date: String(row?.due_date || ""),
        result: normalizeActionResultValue(row?.result, "in_progress"),
      })
    ),
  };
}

function syncRiskOpportunityAutoRows(draftValue) {
  const draft = cloneRiskOpportunityDraft(draftValue);
  const riskCandidates = buildRiskCandidatesFromSwot(draft.swotRows);
  const opportunityCandidates = buildOpportunityCandidatesFromSwot(draft.swotRows);

  const existingAutoRiskBySource = new Map(
    draft.riskRows
      .filter((row) => row.is_auto_generated && String(row.source_key || "").trim())
      .map((row) => [String(row.source_key), row])
  );
  const manualRiskRows = draft.riskRows.filter(
    (row) => !row.is_auto_generated || !String(row.source_key || "").trim()
  );
  const nextAutoRiskRows = riskCandidates.map((candidate) => {
    const existing = existingAutoRiskBySource.get(candidate.source_key);
    return createEmptyRiskRow({
      id: existing?.id || nextRiskOpportunityRowId(),
      source_key: candidate.source_key,
      source_label: candidate.source_label,
      is_auto_generated: true,
      process_name: String(existing?.process_name || ""),
      description: String(existing?.description || candidate.description),
      probability: normalizeRiskProbability(existing?.probability),
      severity: normalizeRiskSeverity(existing?.severity),
    });
  });

  const existingAutoOpportunityBySource = new Map(
    draft.opportunityRows
      .filter((row) => row.is_auto_generated && String(row.source_key || "").trim())
      .map((row) => [String(row.source_key), row])
  );
  const manualOpportunityRows = draft.opportunityRows.filter(
    (row) => !row.is_auto_generated || !String(row.source_key || "").trim()
  );
  const nextAutoOpportunityRows = opportunityCandidates.map((candidate) => {
    const existing = existingAutoOpportunityBySource.get(candidate.source_key);
    return createEmptyOpportunityRow({
      id: existing?.id || nextRiskOpportunityRowId(),
      source_key: candidate.source_key,
      source_label: candidate.source_label,
      is_auto_generated: true,
      process_name: String(existing?.process_name || ""),
      description: String(existing?.description || candidate.description),
      viability: normalizeOpportunityScore(existing?.viability),
      attractiveness: normalizeOpportunityScore(existing?.attractiveness),
    });
  });

  const nextRiskRows = [...nextAutoRiskRows, ...manualRiskRows];
  const nextOpportunityRows = [...nextAutoOpportunityRows, ...manualOpportunityRows];
  const validReferenceIds = new Set([
    ...nextRiskRows.map((row) => String(row.id || "")),
    ...nextOpportunityRows.map((row) => String(row.id || "")),
  ]);
  const nextFollowUpRows = draft.followUpRows.filter((row) => {
    const referenceId = String(row.reference_row_id || "").trim();
    if (!referenceId) return true;
    return validReferenceIds.has(referenceId);
  });

  return {
    swotRows: draft.swotRows,
    riskRows: nextRiskRows,
    opportunityRows: nextOpportunityRows,
    followUpRows: nextFollowUpRows,
  };
}

function buildDefaultRiskOpportunityDraft() {
  const swotRows = [];
  RISK_OPPORTUNITY_SWOT_SECTIONS.forEach((section) => {
    const seedRows = RISK_OPPORTUNITY_SWOT_TEMPLATE[section.key] || [""];
    seedRows.forEach((description) => {
      swotRows.push(
        createEmptySwotRow(section.key, {
          description: String(description || ""),
        })
      );
    });
  });
  return syncRiskOpportunityAutoRows({
    swotRows,
    riskRows: [],
    opportunityRows: [],
    followUpRows: [],
  });
}

function mapApiRowsToRiskOpportunityDraft(rows) {
  const draft = {
    swotRows: [],
    riskRows: [],
    opportunityRows: [],
    followUpRows: [],
  };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const rowType = String(row?.row_type || "").trim().toLowerCase();
    if (rowType === RISK_OPPORTUNITY_ROW_TYPES.SWOT) {
      const swotCategory = String(row?.swot_category || "").trim().toLowerCase();
      if (!RISK_OPPORTUNITY_SWOT_SECTIONS.some((item) => item.key === swotCategory)) return;
      draft.swotRows.push(
        createEmptySwotRow(swotCategory, {
          id: row?.id || nextRiskOpportunityRowId(),
          description: String(row?.description || ""),
        })
      );
      return;
    }
    if (rowType === RISK_OPPORTUNITY_ROW_TYPES.RISK) {
      draft.riskRows.push(
        createEmptyRiskRow({
          id: row?.id || nextRiskOpportunityRowId(),
          source_key: String(row?.source_key || ""),
          source_label: "",
          is_auto_generated: Boolean(row?.is_auto_generated),
          process_name: String(row?.process_name || row?.responsible || ""),
          description: String(row?.description || ""),
          probability: normalizeRiskProbability(row?.probability),
          severity: normalizeRiskSeverity(row?.severity || mapLegacyImpactToSeverity(row?.impact)),
        })
      );
      return;
    }
    if (rowType === RISK_OPPORTUNITY_ROW_TYPES.OPPORTUNITY) {
      draft.opportunityRows.push(
        createEmptyOpportunityRow({
          id: row?.id || nextRiskOpportunityRowId(),
          source_key: String(row?.source_key || ""),
          source_label: "",
          is_auto_generated: Boolean(row?.is_auto_generated),
          process_name: String(row?.process_name || row?.responsible || ""),
          description: String(row?.description || ""),
          viability: normalizeOpportunityScore(
            row?.viability,
            mapLegacyLevelToOpportunityScore(row?.probability)
          ),
          attractiveness: normalizeOpportunityScore(
            row?.attractiveness,
            mapLegacyLevelToOpportunityScore(row?.impact)
          ),
        })
      );
      return;
    }
    if (rowType === RISK_OPPORTUNITY_ROW_TYPES.FOLLOW_UP || rowType === "follow_up") {
      const followUpStatusRaw = String(row?.follow_up_status || "");
      const actionTypeFallback =
        !row?.action_type &&
        followUpStatusRaw &&
        !["yes", "no", "si", "sí", "true", "false", "1", "0"].includes(
          followUpStatusRaw.trim().toLowerCase()
        )
          ? followUpStatusRaw
          : "";
      draft.followUpRows.push(
        createEmptyFollowUpRow({
          id: row?.id || nextRiskOpportunityRowId(),
          reference_kind: String(row?.reference_kind || "").toLowerCase(),
          reference_row_id: String(row?.reference_row_id || ""),
          action: String(row?.action || ""),
          action_type: String(row?.action_type || actionTypeFallback || ""),
          indicator: normalizeYesNoValue(row?.indicator || row?.responsible, "no"),
          objective_associated: normalizeYesNoValue(row?.follow_up_status, "no"),
          due_date: String(row?.due_date || row?.follow_up_date || ""),
          result: normalizeActionResultValue(row?.action_result || row?.benefit, "in_progress"),
        })
      );
    }
  });
  return syncRiskOpportunityAutoRows(draft);
}

function buildRiskOpportunityRowsPayload(draft) {
  const safeDraft = syncRiskOpportunityAutoRows(draft);
  const rows = [];
  safeDraft.swotRows.forEach((row) => {
    const description = normalizeNullableText(row.description);
    const swotCategory = String(row.swot_category || "")
      .trim()
      .toLowerCase();
    if (!description || !swotCategory) return;
    rows.push({
      row_id: row.id,
      row_type: RISK_OPPORTUNITY_ROW_TYPES.SWOT,
      swot_category: swotCategory,
      description,
      process_name: null,
      impact: null,
      probability: null,
      severity: null,
      viability: null,
      attractiveness: null,
      benefit: null,
      action: null,
      responsible: null,
      follow_up_status: null,
      follow_up_date: null,
      source_key: null,
      reference_kind: null,
      reference_row_id: null,
      action_type: null,
      indicator: null,
      due_date: null,
      action_result: null,
      is_auto_generated: false,
    });
  });
  safeDraft.riskRows.forEach((row) => {
    const description = normalizeNullableText(row.description);
    if (!description) return;
    rows.push({
      row_id: row.id,
      row_type: RISK_OPPORTUNITY_ROW_TYPES.RISK,
      swot_category: null,
      description,
      process_name: normalizeNullableText(row.process_name),
      impact: mapRiskSeverityToLegacyImpact(normalizeRiskSeverity(row.severity)),
      probability: normalizeRiskProbability(row.probability),
      severity: normalizeRiskSeverity(row.severity),
      viability: null,
      attractiveness: null,
      benefit: null,
      action: null,
      responsible: null,
      follow_up_status: null,
      follow_up_date: null,
      source_key: normalizeNullableText(row.source_key),
      reference_kind: null,
      reference_row_id: null,
      action_type: null,
      indicator: null,
      due_date: null,
      action_result: null,
      is_auto_generated: row.is_auto_generated !== false,
    });
  });
  safeDraft.opportunityRows.forEach((row) => {
    const description = normalizeNullableText(row.description);
    if (!description) return;
    const viability = normalizeOpportunityScore(row.viability);
    const attractiveness = normalizeOpportunityScore(row.attractiveness);
    rows.push({
      row_id: row.id,
      row_type: RISK_OPPORTUNITY_ROW_TYPES.OPPORTUNITY,
      swot_category: null,
      description,
      process_name: normalizeNullableText(row.process_name),
      impact: mapOpportunityScoreToLevel(attractiveness),
      probability: mapOpportunityScoreToLevel(viability),
      severity: null,
      viability,
      attractiveness,
      benefit: null,
      action: null,
      responsible: null,
      follow_up_status: null,
      follow_up_date: null,
      source_key: normalizeNullableText(row.source_key),
      reference_kind: null,
      reference_row_id: null,
      action_type: null,
      indicator: null,
      due_date: null,
      action_result: null,
      is_auto_generated: row.is_auto_generated !== false,
    });
  });
  safeDraft.followUpRows.forEach((row) => {
    const action = normalizeNullableText(row.action);
    if (!action) return;
    const referenceKind = normalizeNullableText(row.reference_kind);
    const referenceRowId = normalizeNullableText(row.reference_row_id);
    const indicator = normalizeYesNoValue(row.indicator, "no");
    const objectiveAssociated = normalizeYesNoValue(row.objective_associated, "no");
    const result = normalizeActionResultValue(row.result, "in_progress");
    rows.push({
      row_id: row.id,
      row_type: RISK_OPPORTUNITY_ROW_TYPES.FOLLOW_UP,
      swot_category: null,
      description:
        referenceKind && referenceRowId ? `${referenceKind}:${referenceRowId}` : null,
      process_name: null,
      impact: null,
      probability: null,
      severity: null,
      viability: null,
      attractiveness: null,
      benefit: null,
      action,
      responsible: null,
      follow_up_status: objectiveAssociated,
      follow_up_date: row.due_date || null,
      source_key: null,
      reference_kind: referenceKind,
      reference_row_id: referenceRowId,
      action_type: normalizeNullableText(row.action_type),
      indicator,
      due_date: row.due_date || null,
      action_result: result,
      is_auto_generated: false,
    });
  });
  return rows;
}

function countRiskOpportunityRegisteredItems(draft) {
  const rows = buildRiskOpportunityRowsPayload(draft);
  return rows.length;
}

function buildRiskOpportunityCounters(draft) {
  const safeDraft = cloneRiskOpportunityDraft(draft);
  const weaknessCount = safeDraft.swotRows.filter(
    (row) => row.swot_category === "weakness" && String(row.description || "").trim()
  ).length;
  const threatCount = safeDraft.swotRows.filter(
    (row) => row.swot_category === "threat" && String(row.description || "").trim()
  ).length;
  const strengthCount = safeDraft.swotRows.filter(
    (row) => row.swot_category === "strength" && String(row.description || "").trim()
  ).length;
  const dafoOpportunityCount = safeDraft.swotRows.filter(
    (row) => row.swot_category === "opportunity" && String(row.description || "").trim()
  ).length;
  const swotCount = weaknessCount + threatCount + strengthCount + dafoOpportunityCount;
  const riskCount = safeDraft.riskRows.filter((row) => String(row.description || "").trim()).length;
  const generatedOpportunityCount = safeDraft.opportunityRows.filter(
    (row) => String(row.description || "").trim()
  ).length;
  const actionCount = safeDraft.followUpRows.filter((row) => String(row.action || "").trim()).length;
  return {
    swotCount,
    weaknessCount,
    threatCount,
    strengthCount,
    dafoOpportunityCount,
    riskCount,
    generatedOpportunityCount,
    actionCount,
  };
}

function buildContextSummaryItem(row) {
  const environment = String(row?.environment || "").trim() || "Entorno sin nombre";
  const risks = String(row?.risks || "").trim();
  const opportunities = String(row?.opportunities || "").trim();
  if (risks && opportunities) {
    return `${environment}: Riesgos ${risks} | Oportunidades ${opportunities}`;
  }
  if (risks) {
    return `${environment}: Riesgos ${risks}`;
  }
  if (opportunities) {
    return `${environment}: Oportunidades ${opportunities}`;
  }
  return environment;
}

function buildContextAutoSummary(rows) {
  const summary = {
    externalItems: [],
    internalItems: [],
  };
  cloneContextRows(rows).forEach((row) => {
    if (!String(row.environment || "").trim()) return;
    const item = buildContextSummaryItem(row);
    if (normalizeContextGroup(row.context_group) === "interno") {
      summary.internalItems.push(item);
      return;
    }
    summary.externalItems.push(item);
  });
  return summary;
}

function formatP09Date(now = new Date()) {
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${day}/${month}/${year}`;
}

function normalizeP09DateLabel(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const ddmmyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;
  if (ddmmyyyyPattern.test(raw)) {
    return raw;
  }
  const isoPattern = /^(\d{4})-(\d{2})-(\d{2})/;
  const isoMatch = raw.match(isoPattern);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return formatP09Date(parsed);
}

function formatP09Revision(revisionNumber) {
  const normalized = Number.isFinite(revisionNumber) && revisionNumber >= 0 ? revisionNumber : 0;
  return `Rev.${String(normalized).padStart(2, "0")}`;
}

function normalizeP09RegisteredCount(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => String(row?.interested_party || "").trim()).length;
}

function applyP09AutofillFields(onFieldChange, { code, revisionLabel, dateLabel }) {
  if (typeof onFieldChange !== "function") return;
  onFieldChange("interested_parties_document_code", code || "P09");
  onFieldChange("interested_parties_revision", revisionLabel || "");
  onFieldChange("interested_parties_date", dateLabel || "");
}

function applyContextAutofillFields(
  onFieldChange,
  { code, revisionLabel, dateLabel, externalIssuesSummary = "", internalIssuesSummary = "" }
) {
  if (typeof onFieldChange !== "function") return;
  onFieldChange("context_document_code", code || "P09");
  onFieldChange("context_document_revision", revisionLabel || "");
  onFieldChange("context_document_date", dateLabel || "");
  onFieldChange("external_issues_summary", externalIssuesSummary || "");
  onFieldChange("internal_issues_summary", internalIssuesSummary || "");
}

function renderBooleanField(field, value, onChange, disabled) {
  const normalizedValue = value === true ? "true" : value === false ? "false" : "";
  return (
    <select
      className="input-select"
      value={normalizedValue}
      disabled={disabled}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (!nextValue) {
          onChange(field.field_code, null);
          return;
        }
        onChange(field.field_code, nextValue === "true");
      }}
    >
      <option value="">Sin definir</option>
      <option value="true">Si</option>
      <option value="false">No</option>
    </select>
  );
}

function renderSelectField(field, value, onChange, disabled) {
  return (
    <select
      className="input-select"
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(field.field_code, event.target.value)}
    >
      <option value="">Selecciona una opcion</option>
      {(field.options || []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function renderListField(field, value, onChange, disabled) {
  const listValues = Array.isArray(value) ? value : [];

  function updateListItem(index, nextValue) {
    const next = [...listValues];
    next[index] = nextValue;
    onChange(field.field_code, next);
  }

  function removeListItem(index) {
    const next = listValues.filter((_, itemIndex) => itemIndex !== index);
    onChange(field.field_code, next);
  }

  function addListItem() {
    const next = [...listValues, ""];
    onChange(field.field_code, next);
  }

  return (
    <div className="guided-list-field">
      {listValues.length === 0 ? <p className="soft-label">Sin elementos añadidos.</p> : null}
      {listValues.map((itemValue, index) => (
        <div className="guided-list-row" key={`${field.field_code}-${index}`}>
          <input
            className="input-text"
            value={itemValue}
            disabled={disabled}
            placeholder={field.placeholder || "Añade un valor"}
            onChange={(event) => updateListItem(index, event.target.value)}
          />
          <button
            type="button"
            className="btn-ghost"
            disabled={disabled}
            onClick={() => removeListItem(index)}
          >
            Quitar
          </button>
        </div>
      ))}

      <button type="button" className="btn-secondary" disabled={disabled} onClick={addListItem}>
        Añadir elemento
      </button>
    </div>
  );
}

function renderJsonField(field, value, onChange, disabled) {
  const textValue =
    typeof value === "string" ? value : value != null ? JSON.stringify(value, null, 2) : "";

  return (
    <textarea
      className="input-textarea"
      value={textValue}
      disabled={disabled}
      placeholder={field.placeholder || "Introduce un objeto JSON"}
      onChange={(event) => onChange(field.field_code, event.target.value)}
    />
  );
}

function renderDefaultInput(field, value, onChange, disabled) {
  if (field.type === "textarea") {
    return (
      <textarea
        className="input-textarea"
        value={value ?? ""}
        disabled={disabled}
        placeholder={field.placeholder || ""}
        onChange={(event) => onChange(field.field_code, event.target.value)}
      />
    );
  }

  return (
    <input
      className="input-text"
      type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
      value={value ?? ""}
      disabled={disabled}
      placeholder={field.placeholder || ""}
      min={field.type === "number" ? "0" : undefined}
      step={field.type === "number" ? "any" : undefined}
      onChange={(event) => onChange(field.field_code, event.target.value)}
    />
  );
}

function renderFieldControl(field, value, onChange, disabled) {
  if (field.type === "boolean") return renderBooleanField(field, value, onChange, disabled);
  if (field.type === "select") return renderSelectField(field, value, onChange, disabled);
  if (field.type === "list") return renderListField(field, value, onChange, disabled);
  if (field.type === "json") return renderJsonField(field, value, onChange, disabled);
  return renderDefaultInput(field, value, onChange, disabled);
}

function isDocumentAutofillField(fieldCode) {
  return AUTOFILL_FIELD_CODES.has(String(fieldCode || ""));
}

function renderDocumentAutofillField(field, value) {
  const isCodeField =
    field.field_code === "interested_parties_document_code" ||
    field.field_code === "context_document_code";
  return (
    <input
      className="input-text audit-p09-autofill-input"
      type="text"
      value={String(value ?? "")}
      readOnly
      placeholder={isCodeField ? "P09" : "Autogenerado desde P09"}
    />
  );
}

function getAutofillHelpText(fieldCode) {
  const normalized = String(fieldCode || "");
  if (CONTEXT_AUTOFILL_FIELD_CODES.has(normalized)) {
    return "Autogenerado desde el documento P09 de contexto (apartado 4.1).";
  }
  if (INTERESTED_PARTIES_AUTOFILL_FIELD_CODES.has(normalized)) {
    return "Autogenerado desde el documento P09 de partes interesadas (apartado 4.2).";
  }
  return "Autogenerado desde el documento P09.";
}

function shouldRenderContextDocumentPanel(group, fieldIndex) {
  return group?.field_group === "analisis_contexto" && fieldIndex === 0;
}

function shouldRenderInterestedPartiesDocumentPanel(group, fieldIndex) {
  return group?.field_group === "partes_interesadas" && fieldIndex === 0;
}

function shouldRenderPerformanceIndicatorsPanel(group, fieldIndex) {
  return group?.field_group === PERFORMANCE_INDICATORS_GROUP_CODE && fieldIndex === 0;
}

function shouldRenderRiskOpportunityDocumentPanel(group) {
  return group?.field_group === "documento_riesgos_oportunidades";
}

function hasContextDocumentPanel(groups) {
  return (Array.isArray(groups) ? groups : []).some(
    (group) => group?.field_group === "analisis_contexto"
  );
}

function hasInterestedPartiesDocumentPanel(groups) {
  return (Array.isArray(groups) ? groups : []).some(
    (group) => group?.field_group === "partes_interesadas"
  );
}

function hasRiskOpportunityDocumentPanel(groups) {
  return (Array.isArray(groups) ? groups : []).some(
    (group) => group?.field_group === "documento_riesgos_oportunidades"
  );
}

function hasPerformanceIndicatorsPanel(groups) {
  return (Array.isArray(groups) ? groups : []).some(
    (group) => group?.field_group === PERFORMANCE_INDICATORS_GROUP_CODE
  );
}

function shouldHideFieldInUi(group, fieldCode) {
  const normalizedFieldCode = String(fieldCode || "");
  if (group?.field_group === "partes_interesadas") {
    return INTERESTED_PARTIES_HIDDEN_UI_FIELD_CODES.has(normalizedFieldCode);
  }
  if (group?.field_group === "analisis_contexto") {
    return CONTEXT_HIDDEN_UI_FIELD_CODES.has(normalizedFieldCode);
  }
  if (group?.field_group === PERFORMANCE_INDICATORS_GROUP_CODE) {
    return normalizedFieldCode === PERFORMANCE_INDICATORS_FIELD_CODE;
  }
  return false;
}

function renderGroupFields(
  group,
  valuesByFieldCode,
  onFieldChange,
  disabled,
  interestedPartiesUi,
  contextUi,
  riskOpportunityUi,
  performanceUi
) {
  const nodes = [];
  if (shouldRenderRiskOpportunityDocumentPanel(group)) {
    nodes.push(
      <aside
        key={`${group.field_group}-risk-opportunity-panel`}
        className="audit-p09-panel audit-p09-panel-compact audit-full-width"
        aria-label="Documento P09 de riesgos y oportunidades"
      >
        <div className="audit-p09-panel-header">
          <p className="audit-p09-panel-title">{"Documento P09 \u2013 Riesgos y oportunidades (6.1)"}</p>
          <div className="audit-p09-panel-status">
            <span className="soft-label">Estado</span>
            <span className={`audit-p09-status-badge ${riskOpportunityUi.isCompleted ? "completed" : ""}`}>
              {riskOpportunityUi.isCompleted ? "Completado" : "Pendiente"}
            </span>
          </div>
        </div>
        <p className="audit-p09-panel-description">
          Documento central de planificacion para DAFO, riesgos, oportunidades y acciones.
        </p>
        {riskOpportunityUi.isCompleted ? (
          <div className="audit-p09-panel-meta">
            <p>{riskOpportunityUi.summaryLine || `${riskOpportunityUi.registeredCount} registros en el documento`}</p>
            <p>{`${riskOpportunityUi.revisionLabel || "-"} \u00b7 ${riskOpportunityUi.dateLabel || "-"}`}</p>
          </div>
        ) : null}
        {riskOpportunityUi.loadError ? (
          <p className="audit-p09-validation-error">{riskOpportunityUi.loadError}</p>
        ) : null}
        <div className="audit-p09-panel-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={riskOpportunityUi.onOpenEditor}
            disabled={disabled || riskOpportunityUi.loading}
          >
            {riskOpportunityUi.loading
              ? "Cargando..."
              : riskOpportunityUi.isCompleted
                ? "Editar documento"
                : "Completar documento"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={riskOpportunityUi.onOpenSummary}
            disabled={!riskOpportunityUi.isCompleted || disabled || riskOpportunityUi.loading}
          >
            Ver resumen
          </button>
        </div>
      </aside>
    );
  }
  (group.fields || []).forEach((field, fieldIndex) => {
    if (shouldRenderPerformanceIndicatorsPanel(group, fieldIndex)) {
      nodes.push(
        <aside
          key={`${group.field_group}-performance-panel`}
          className="audit-performance-panel audit-performance-panel-v2 audit-full-width"
          aria-label={"Documento P09 de indicadores de desempe\u00f1o"}
        >
          <header className="audit-performance-panel-header audit-performance-panel-header-v2">
            <div className="audit-performance-panel-headings audit-performance-panel-headings-v2">
              <p className="audit-performance-panel-kicker">{"DOCUMENTO ISO 9001 - CL\u00c1USULA 9.1"}</p>
              <p className="audit-performance-panel-title">{"P09 - Indicadores de desempe\u00f1o"}</p>
              <p className="audit-performance-panel-description">
                {
                  "Sistema integral de indicadores alineado con P09_INDICADORES: cat\u00e1logo, seguimiento trimestral, gr\u00e1fico y tabla de valores."
                }
              </p>
            </div>
            <div className="audit-performance-metrics-strip">
              <article>
                <span>Indicadores</span>
                <strong>{performanceUi.model.indicators.length}</strong>
              </article>
              <article>
                <span>Seguimiento</span>
                <strong>{performanceUi.computedRows.length}</strong>
              </article>
              <article>
                <span>Cumplen</span>
                <strong>{performanceUi.compliantCount}</strong>
              </article>
            </div>
          </header>

          <nav
            className="audit-performance-tabs"
            role="tablist"
            aria-label={"Pesta\u00f1as de indicadores"}
          >
            {[
              { key: PERFORMANCE_TAB_KEYS.INDICATORS, label: "Indicadores" },
              { key: PERFORMANCE_TAB_KEYS.TRACKING, label: "Seguimiento" },
              { key: PERFORMANCE_TAB_KEYS.CHART, label: "Gr\u00e1fico" },
              { key: PERFORMANCE_TAB_KEYS.VALUES, label: "Valores" },
            ].map((tab) => (
              <button
                key={`performance-tab-${tab.key}`}
                type="button"
                role="tab"
                className={`audit-performance-tab-btn ${
                  performanceUi.activeTab === tab.key ? "active" : ""
                }`}
                aria-selected={performanceUi.activeTab === tab.key}
                onClick={() => performanceUi.onChangeTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section className="audit-performance-tab-content">
            {performanceUi.activeTab === PERFORMANCE_TAB_KEYS.INDICATORS ? (
              <div className="audit-performance-tab-block">
                <div className="audit-performance-tab-toolbar">
                  <p className="soft-label">
                    {
                      "Cat\u00e1logo base editable. Define \u00e1rea, indicador, f\u00f3rmula, meta y responsable."
                    }
                  </p>
                  <button
                    type="button"
                    className="btn-ghost audit-performance-add-btn"
                    onClick={performanceUi.onAddIndicatorRow}
                    disabled={disabled}
                  >
                    {"+ A\u00f1adir indicador"}
                  </button>
                </div>

                {performanceUi.model.indicators.length === 0 ? (
                  <p className="soft-label">No hay indicadores registrados.</p>
                ) : (
                  <div className="audit-performance-catalog-list">
                    {performanceUi.model.indicators.map((row, index) => (
                      <article className="audit-performance-catalog-row" key={row.id}>
                        <header className="audit-performance-catalog-row-head">
                          <p className="audit-performance-catalog-row-title">{`Indicador ${index + 1}`}</p>
                          <button
                            type="button"
                            className="btn-ghost audit-performance-catalog-delete-btn"
                            onClick={() => performanceUi.onDeleteIndicatorRow(row.id)}
                            disabled={disabled}
                          >
                            Eliminar
                          </button>
                        </header>
                        <div className="audit-performance-catalog-grid">
                          <label className="field-stack audit-performance-field audit-col-area">
                            <span>{"\u00c1rea"}</span>
                            <input
                              className="input-text"
                              value={row.area}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(row.id, "area", event.target.value)
                              }
                              placeholder={"\u00c1rea"}
                            />
                          </label>
                          <label className="field-stack audit-performance-field audit-col-indicator">
                            <span>Indicador</span>
                            <input
                              className="input-text"
                              value={row.indicator}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(row.id, "indicator", event.target.value)
                              }
                              placeholder="Indicador"
                            />
                          </label>
                          <label className="field-stack audit-performance-field audit-col-description">
                            <span>{"Descripci\u00f3n"}</span>
                            <input
                              className="input-text"
                              value={row.description}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(
                                  row.id,
                                  "description",
                                  event.target.value
                                )
                              }
                              placeholder={"Descripci\u00f3n"}
                            />
                          </label>
                          <label className="field-stack audit-performance-field audit-col-objective">
                            <span>Objetivo asociado</span>
                            <select
                              className="input-select"
                              value={normalizeYesNoValue(row.objective_associated, "no")}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(
                                  row.id,
                                  "objective_associated",
                                  event.target.value
                                )
                              }
                            >
                              {RISK_OPPORTUNITY_YES_NO_OPTIONS.map((option) => (
                                <option
                                  key={`catalog-objective-${row.id}-${option.value}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field-stack audit-performance-field audit-col-formula">
                            <span>{"F\u00f3rmula"}</span>
                            <input
                              className="input-text"
                              value={row.formula}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(row.id, "formula", event.target.value)
                              }
                              placeholder={"F\u00f3rmula"}
                            />
                          </label>
                          <label className="field-stack audit-performance-field audit-col-target">
                            <span>Meta</span>
                            <input
                              className="input-text"
                              value={row.target}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(row.id, "target", event.target.value)
                              }
                              placeholder="Meta"
                            />
                          </label>
                          <label className="field-stack audit-performance-field audit-col-frequency">
                            <span>Frecuencia</span>
                            <input
                              className="input-text"
                              value={row.frequency}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(row.id, "frequency", event.target.value)
                              }
                              placeholder="Frecuencia"
                            />
                          </label>
                          <label className="field-stack audit-performance-field audit-col-responsible">
                            <span>Responsable</span>
                            <input
                              className="input-text"
                              value={row.responsible}
                              disabled={disabled}
                              onChange={(event) =>
                                performanceUi.onChangeIndicatorRow(
                                  row.id,
                                  "responsible",
                                  event.target.value
                                )
                              }
                              placeholder="Responsable"
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {performanceUi.activeTab === PERFORMANCE_TAB_KEYS.TRACKING ? (
              <div className="audit-performance-tab-block">
                <div className="audit-performance-tab-toolbar">
                  <p className="soft-label">
                    Seguimiento trimestral por indicador. El campo anual se calcula automáticamente.
                  </p>
                  <label className="field-stack audit-performance-annual-mode">
                    <span>Anual</span>
                    <select
                      className="input-select"
                      value={performanceUi.model.annual_mode}
                      disabled={disabled}
                      onChange={(event) => performanceUi.onChangeAnnualMode(event.target.value)}
                    >
                      {PERFORMANCE_ANNUAL_MODE_OPTIONS.map((option) => (
                        <option key={`annual-mode-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {performanceUi.computedRows.length === 0 ? (
                  <p className="soft-label">No hay indicadores para seguimiento.</p>
                ) : (
                  <div className="audit-performance-table-wrap">
                    <div className="audit-performance-table-head tracking">
                      <span>Indicador</span>
                      <span>1er Trimestre</span>
                      <span>2º Trimestre</span>
                      <span>3er Trimestre</span>
                      <span>Anual</span>
                    </div>
                    {performanceUi.computedRows.map((row) => {
                      const statusBadge = getPerformanceIndicatorStatusBadge(row.statusCode);
                      return (
                        <article className="audit-performance-table-row tracking" key={`tracking-${row.id}`}>
                          <div className="audit-performance-indicator-cell">
                            <strong>{row.indicator || "Indicador sin nombre"}</strong>
                            <span>{row.area || "Sin \u00e1rea"}</span>
                          </div>
                          <input
                            className="input-text"
                            type="number"
                            step="any"
                            value={row.q1}
                            disabled={disabled}
                            onChange={(event) =>
                              performanceUi.onChangeTrackingRow(row.id, "q1", event.target.value)
                            }
                            placeholder="0"
                          />
                          <input
                            className="input-text"
                            type="number"
                            step="any"
                            value={row.q2}
                            disabled={disabled}
                            onChange={(event) =>
                              performanceUi.onChangeTrackingRow(row.id, "q2", event.target.value)
                            }
                            placeholder="0"
                          />
                          <input
                            className="input-text"
                            type="number"
                            step="any"
                            value={row.q3}
                            disabled={disabled}
                            onChange={(event) =>
                              performanceUi.onChangeTrackingRow(row.id, "q3", event.target.value)
                            }
                            placeholder="0"
                          />
                          <div className="audit-performance-annual-cell">
                            <strong>{formatPerformanceMetric(row.annualValue)}</strong>
                            <span className={`audit-performance-status-badge ${statusBadge.tone}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {performanceUi.activeTab === PERFORMANCE_TAB_KEYS.CHART ? (
              <div className="audit-performance-tab-block">
                {performanceUi.computedRows.length === 0 ? (
                  <p className="soft-label">No hay indicadores para representar.</p>
                ) : (
                  <>
                    <div className="audit-performance-chart-legend">
                      <span className="q1">T1</span>
                      <span className="q2">T2</span>
                      <span className="q3">T3</span>
                      <span className="annual">Anual</span>
                    </div>
                    <div className="audit-performance-chart-list">
                      {performanceUi.computedRows.map((row) => (
                        <article className="audit-performance-chart-row" key={`chart-${row.id}`}>
                          <header>
                            <strong>{row.indicator || "Indicador sin nombre"}</strong>
                            <span>{row.area || "Sin area"}</span>
                          </header>
                          <div className="audit-performance-chart-bars">
                            {[
                              { key: "q1", label: "T1", value: row.q1, tone: "q1" },
                              { key: "q2", label: "T2", value: row.q2, tone: "q2" },
                              { key: "q3", label: "T3", value: row.q3, tone: "q3" },
                              {
                                key: "annual",
                                label: "Anual",
                                value: row.annualValue,
                                tone: "annual",
                              },
                            ].map((bar) => {
                              const numericValue = normalizePerformanceNumber(bar.value);
                              const maxValue =
                                Number.isFinite(performanceUi.chartMaxValue) &&
                                performanceUi.chartMaxValue > 0
                                  ? performanceUi.chartMaxValue
                                  : 0;
                              const height = maxValue > 0 && Number.isFinite(numericValue)
                                ? `${Math.max(8, (numericValue / maxValue) * 100)}%`
                                : "0%";
                              return (
                                <div className="audit-performance-chart-bar-column" key={`${row.id}-${bar.key}`}>
                                  <span className="audit-performance-chart-bar-label">{bar.label}</span>
                                  <div className="audit-performance-chart-bar-track">
                                    <div
                                      className={`audit-performance-chart-bar ${bar.tone}`}
                                      style={{ height }}
                                    />
                                  </div>
                                  <span className="audit-performance-chart-bar-value">
                                    {formatPerformanceMetric(bar.value)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {performanceUi.activeTab === PERFORMANCE_TAB_KEYS.VALUES ? (
                <div className="audit-performance-tab-block">
                  <p className="soft-label">
                    {"Valores de referencia para listas de selecci\u00f3n binarias en otros bloques."}
                </p>
                <div className="audit-performance-values-table">
                  <div className="audit-performance-values-head">
                    <span>Valor</span>
                    <span>Clave</span>
                  </div>
                  {performanceUi.model.values.map((row) => (
                    <article className="audit-performance-values-row" key={`value-${row.id}`}>
                      <strong>{row.label}</strong>
                      <span>{row.key || "-"}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      );
    }

    if (shouldRenderContextDocumentPanel(group, fieldIndex)) {
      nodes.push(
        <aside
          key={`${group.field_group}-context-panel`}
          className="audit-p09-panel audit-p09-panel-compact audit-full-width"
          aria-label="Documento P09 de contexto"
        >
          <div className="audit-p09-panel-header">
            <p className="audit-p09-panel-title">
              {"Documento P09 \u2013 Contexto de la organización (4.1)"}
            </p>
            <div className="audit-p09-panel-status">
              <span className="soft-label">Estado</span>
              <span className={`audit-p09-status-badge ${contextUi.isCompleted ? "completed" : ""}`}>
                {contextUi.isCompleted ? "Completado" : "Pendiente"}
              </span>
            </div>
          </div>
          <p className="audit-p09-panel-description">
            Documento maestro del contexto de la organización para ISO 9001 (cláusula 4.1).
          </p>
          {contextUi.isCompleted ? (
            <div className="audit-p09-panel-meta">
              <p>{`${contextUi.registeredCount} entornos registrados`}</p>
              <p>{`${contextUi.revisionLabel || "-"} \u00b7 ${contextUi.dateLabel || "-"}`}</p>
            </div>
          ) : null}
          {contextUi.loadError ? <p className="audit-p09-validation-error">{contextUi.loadError}</p> : null}
          <div className="audit-p09-panel-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={contextUi.onOpenEditor}
              disabled={disabled || contextUi.loading}
            >
              {contextUi.loading
                ? "Cargando..."
                : contextUi.isCompleted
                  ? "Editar documento"
                  : "Completar documento"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={contextUi.onOpenSummary}
              disabled={!contextUi.isCompleted || disabled || contextUi.loading}
            >
              Ver resumen
            </button>
          </div>
        </aside>
      );
      nodes.push(
        <section
          key={`${group.field_group}-context-summary`}
          className="audit-context-autosummary audit-full-width"
          aria-label="Resumen del contexto autogenerado"
        >
          <header className="audit-context-autosummary-header">
            <h5>Resumen del contexto (autogenerado)</h5>
            <p>{"Generado autom\u00e1ticamente a partir del documento P09."}</p>
          </header>
          <div className="audit-context-autosummary-grid">
            <article className="audit-context-autosummary-column">
              <h6>Cuestiones externas</h6>
              {contextUi.externalSummaryItems?.length ? (
                <ul>
                  {contextUi.externalSummaryItems.map((item, index) => (
                    <li key={`external-summary-${index + 1}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="soft-label">Sin cuestiones externas registradas.</p>
              )}
            </article>
            <article className="audit-context-autosummary-column">
              <h6>Cuestiones internas</h6>
              {contextUi.internalSummaryItems?.length ? (
                <ul>
                  {contextUi.internalSummaryItems.map((item, index) => (
                    <li key={`internal-summary-${index + 1}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="soft-label">Sin cuestiones internas registradas.</p>
              )}
            </article>
          </div>
        </section>
      );
    }

    if (shouldRenderInterestedPartiesDocumentPanel(group, fieldIndex)) {
      nodes.push(
        <aside
          key={`${group.field_group}-p09-panel`}
          className="audit-p09-panel audit-p09-panel-compact audit-full-width"
          aria-label="Documento P09 de partes interesadas"
        >
          <div className="audit-p09-panel-header">
            <p className="audit-p09-panel-title">
              {"Documento P09 \u2013 Partes interesadas (4.2)"}
            </p>
            <div className="audit-p09-panel-status">
              <span className="soft-label">Estado</span>
              <span className={`audit-p09-status-badge ${interestedPartiesUi.isCompleted ? "completed" : ""}`}>
                {interestedPartiesUi.isCompleted ? "Completado" : "Pendiente"}
              </span>
            </div>
          </div>
          <p className="audit-p09-panel-description">
            Documento maestro de partes interesadas para ISO 9001 (cláusula 4.2).
          </p>
          {interestedPartiesUi.isCompleted ? (
            <div className="audit-p09-panel-meta">
              <p>{`${interestedPartiesUi.registeredCount} partes interesadas registradas`}</p>
              <p>{`${interestedPartiesUi.revisionLabel || "-"} \u00b7 ${interestedPartiesUi.dateLabel || "-"}`}</p>
            </div>
          ) : null}
          {interestedPartiesUi.loadError ? (
            <p className="audit-p09-validation-error">{interestedPartiesUi.loadError}</p>
          ) : null}
          <div className="audit-p09-panel-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={interestedPartiesUi.onOpenEditor}
              disabled={disabled || interestedPartiesUi.loading}
            >
              {interestedPartiesUi.loading
                ? "Cargando..."
                : interestedPartiesUi.isCompleted
                  ? "Editar documento"
                  : "Completar documento"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={interestedPartiesUi.onOpenSummary}
              disabled={
                !interestedPartiesUi.isCompleted || disabled || interestedPartiesUi.loading
              }
            >
              Ver resumen
            </button>
          </div>
        </aside>
      );
    }

    if (shouldHideFieldInUi(group, field.field_code)) {
      return;
    }

    const isWideField = field.type === "textarea" || field.type === "list" || field.type === "json";
    const isAutofillField = isDocumentAutofillField(field.field_code);
    nodes.push(
      <label key={field.field_code} className={`field-stack ${isWideField ? "audit-full-width" : ""}`}>
        <span>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        {isAutofillField
          ? renderDocumentAutofillField(field, valuesByFieldCode?.[field.field_code])
          : renderFieldControl(field, valuesByFieldCode?.[field.field_code], onFieldChange, disabled)}
        {isAutofillField ? (
          <small className="soft-label audit-p09-autofill-help">
            {getAutofillHelpText(field.field_code)}
          </small>
        ) : null}
        {field.help_text ? <small className="soft-label">{field.help_text}</small> : null}
      </label>
    );

  });
  return nodes;
}

function AuditGuidedFields({
  sectionTitle,
  groups,
  valuesByFieldCode,
  onFieldChange,
  disabled = false,
  auditReportId = "",
}) {
  const [p09PanelMode, setP09PanelMode] = useState(null);
  const [p09Completed, setP09Completed] = useState(false);
  const [p09SavedRows, setP09SavedRows] = useState([]);
  const [p09DraftRows, setP09DraftRows] = useState([]);
  const [p09RevisionNumber, setP09RevisionNumber] = useState(-1);
  const [p09DocumentDate, setP09DocumentDate] = useState("");
  const [p09ValidationError, setP09ValidationError] = useState("");
  const [p09Loading, setP09Loading] = useState(false);
  const [p09Saving, setP09Saving] = useState(false);
  const [p09LoadError, setP09LoadError] = useState("");
  const [p09LoadedAuditReportId, setP09LoadedAuditReportId] = useState("");
  const [p09HasPersistedDocument, setP09HasPersistedDocument] = useState(false);
  const [p09ExpandedRowIds, setP09ExpandedRowIds] = useState([]);
  const [contextPanelMode, setContextPanelMode] = useState(null);
  const [contextCompleted, setContextCompleted] = useState(false);
  const [contextSavedRows, setContextSavedRows] = useState([]);
  const [contextDraftRows, setContextDraftRows] = useState([]);
  const [contextRevisionNumber, setContextRevisionNumber] = useState(-1);
  const [contextDocumentDate, setContextDocumentDate] = useState("");
  const [contextReviewedBy, setContextReviewedBy] = useState("");
  const [contextApprovedBy, setContextApprovedBy] = useState("");
  const [contextDraftReviewedBy, setContextDraftReviewedBy] = useState("");
  const [contextDraftApprovedBy, setContextDraftApprovedBy] = useState("");
  const [contextValidationError, setContextValidationError] = useState("");
  const [contextLoading, setContextLoading] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const [contextLoadError, setContextLoadError] = useState("");
  const [contextLoadedAuditReportId, setContextLoadedAuditReportId] = useState("");
  const [contextHasPersistedDocument, setContextHasPersistedDocument] = useState(false);
  const [contextExpandedRowIds, setContextExpandedRowIds] = useState([]);
  const [riskOpportunityPanelMode, setRiskOpportunityPanelMode] = useState(null);
  const [riskOpportunitySavedDraft, setRiskOpportunitySavedDraft] = useState(
    buildDefaultRiskOpportunityDraft()
  );
  const [riskOpportunityDraft, setRiskOpportunityDraft] = useState(buildDefaultRiskOpportunityDraft());
  const [riskOpportunityCompleted, setRiskOpportunityCompleted] = useState(false);
  const [riskOpportunityRevisionNumber, setRiskOpportunityRevisionNumber] = useState(-1);
  const [riskOpportunityDocumentDate, setRiskOpportunityDocumentDate] = useState("");
  const [riskOpportunityValidationError, setRiskOpportunityValidationError] = useState("");
  const [riskOpportunityLoading, setRiskOpportunityLoading] = useState(false);
  const [riskOpportunitySaving, setRiskOpportunitySaving] = useState(false);
  const [riskOpportunityLoadError, setRiskOpportunityLoadError] = useState("");
  const [riskOpportunityLoadedAuditReportId, setRiskOpportunityLoadedAuditReportId] = useState("");
  const [riskOpportunityHasPersistedDocument, setRiskOpportunityHasPersistedDocument] = useState(false);

  const hasP09Panel = useMemo(() => hasInterestedPartiesDocumentPanel(groups), [groups]);
  const hasContextPanel = useMemo(() => hasContextDocumentPanel(groups), [groups]);
  const hasRiskOpportunityPanel = useMemo(() => hasRiskOpportunityDocumentPanel(groups), [groups]);
  const hasPerformancePanel = useMemo(() => hasPerformanceIndicatorsPanel(groups), [groups]);
  const p09RegisteredCount = useMemo(() => normalizeP09RegisteredCount(p09SavedRows), [p09SavedRows]);
  const contextRegisteredCount = useMemo(
    () => normalizeContextRegisteredCount(contextSavedRows),
    [contextSavedRows]
  );
  const groupedContextDraftRows = useMemo(
    () => groupContextRows(contextDraftRows),
    [contextDraftRows]
  );
  const groupedContextSavedRows = useMemo(
    () => groupContextRows(contextSavedRows),
    [contextSavedRows]
  );
  const contextAutoSummary = useMemo(
    () => buildContextAutoSummary(contextSavedRows),
    [contextSavedRows]
  );
  const riskOpportunityRegisteredCount = useMemo(
    () => countRiskOpportunityRegisteredItems(riskOpportunitySavedDraft),
    [riskOpportunitySavedDraft]
  );
  const riskOpportunitySavedCounters = useMemo(
    () => buildRiskOpportunityCounters(riskOpportunitySavedDraft),
    [riskOpportunitySavedDraft]
  );
  const riskOpportunityDraftCounters = useMemo(
    () => buildRiskOpportunityCounters(riskOpportunityDraft),
    [riskOpportunityDraft]
  );
  const p09RevisionLabel = p09RevisionNumber >= 0 ? formatP09Revision(p09RevisionNumber) : "";
  const contextRevisionLabel =
    contextRevisionNumber >= 0 ? formatP09Revision(contextRevisionNumber) : "";
  const riskOpportunityRevisionLabel =
    riskOpportunityRevisionNumber >= 0 ? formatP09Revision(riskOpportunityRevisionNumber) : "";
  const isP09EditMode = p09PanelMode === "edit";
  const isP09SummaryMode = p09PanelMode === "summary";
  const isP09PanelOpen = isP09EditMode || isP09SummaryMode;
  const isContextEditMode = contextPanelMode === "edit";
  const isContextSummaryMode = contextPanelMode === "summary";
  const isContextPanelOpen = isContextEditMode || isContextSummaryMode;
  const isRiskOpportunityEditMode = riskOpportunityPanelMode === "edit";
  const isRiskOpportunitySummaryMode = riskOpportunityPanelMode === "summary";
  const isRiskOpportunityPanelOpen = isRiskOpportunityEditMode || isRiskOpportunitySummaryMode;
  const riskOpportunityModalCounters = isRiskOpportunityEditMode
    ? riskOpportunityDraftCounters
    : riskOpportunitySavedCounters;
  const isAnyDocumentPanelOpen = isP09PanelOpen || isContextPanelOpen || isRiskOpportunityPanelOpen;
  const riskOpportunityReferenceOptions = useMemo(() => {
    const riskOptions = riskOpportunityDraft.riskRows
      .filter((row) => String(row.description || "").trim())
      .map((row) => ({
        value: String(row.id || ""),
        kind: RISK_OPPORTUNITY_REFERENCE_TYPES.RISK,
        label: `Riesgo: ${String(row.description || "").trim()}`,
      }));
    const opportunityOptions = riskOpportunityDraft.opportunityRows
      .filter((row) => String(row.description || "").trim())
      .map((row) => ({
        value: String(row.id || ""),
        kind: RISK_OPPORTUNITY_REFERENCE_TYPES.OPPORTUNITY,
        label: `Oportunidad: ${String(row.description || "").trim()}`,
      }));
    return [...riskOptions, ...opportunityOptions];
  }, [riskOpportunityDraft.riskRows, riskOpportunityDraft.opportunityRows]);
  const [performanceActiveTab, setPerformanceActiveTab] = useState(PERFORMANCE_TAB_KEYS.INDICATORS);
  const performanceModel = useMemo(
    () => normalizePerformanceIndicatorsModel(valuesByFieldCode?.[PERFORMANCE_INDICATORS_FIELD_CODE]),
    [valuesByFieldCode]
  );
  const performanceTrackingByIndicator = useMemo(
    () =>
      new Map(
        (Array.isArray(performanceModel.tracking) ? performanceModel.tracking : []).map((row) => [
          String(row.indicator_id || ""),
          row,
        ])
      ),
    [performanceModel]
  );
  const performanceComputedRows = useMemo(
    () =>
      (Array.isArray(performanceModel.indicators) ? performanceModel.indicators : []).map((indicatorRow) => {
        const trackingRow =
          performanceTrackingByIndicator.get(String(indicatorRow.id || "")) ||
          createEmptyPerformanceTrackingRow(indicatorRow.id);
        const annualValue = calculatePerformanceAnnualValue(
          trackingRow.q1,
          trackingRow.q2,
          trackingRow.q3,
          performanceModel.annual_mode
        );
        return {
          ...indicatorRow,
          q1: trackingRow.q1,
          q2: trackingRow.q2,
          q3: trackingRow.q3,
          annualValue,
          statusCode: evaluatePerformanceIndicatorStatus(indicatorRow.target, annualValue),
        };
      }),
    [performanceModel, performanceTrackingByIndicator]
  );
  const performanceChartMaxValue = useMemo(() => {
    const values = performanceComputedRows.flatMap((row) => [
      normalizePerformanceNumber(row.q1),
      normalizePerformanceNumber(row.q2),
      normalizePerformanceNumber(row.q3),
      normalizePerformanceNumber(row.annualValue),
    ]);
    const numericValues = values.filter((value) => Number.isFinite(value));
    if (numericValues.length === 0) return 0;
    return Math.max(...numericValues);
  }, [performanceComputedRows]);
  const performanceCompliantCount = useMemo(
    () => performanceComputedRows.filter((row) => row.statusCode === "compliant").length,
    [performanceComputedRows]
  );

  function syncAutofillField(fieldCode, value) {
    if (typeof onFieldChange !== "function") return;
    const nextValue = value == null ? "" : String(value);
    const currentValue = valuesByFieldCode?.[fieldCode];
    if (String(currentValue ?? "") === nextValue) return;
    onFieldChange(fieldCode, nextValue);
  }

  useEffect(() => {
    if (!hasP09Panel || !p09HasPersistedDocument) return;
    syncAutofillField("interested_parties_document_code", "P09");
    syncAutofillField("interested_parties_revision", p09RevisionLabel || "");
    syncAutofillField("interested_parties_date", p09DocumentDate || "");
  }, [
    hasP09Panel,
    p09HasPersistedDocument,
    p09RevisionLabel,
    p09DocumentDate,
    valuesByFieldCode,
  ]);

  useEffect(() => {
    if (!hasContextPanel || !contextHasPersistedDocument) return;
    syncAutofillField("context_document_code", "P09");
    syncAutofillField("context_document_revision", contextRevisionLabel || "");
    syncAutofillField("context_document_date", contextDocumentDate || "");
    syncAutofillField("external_issues_summary", contextAutoSummary.externalItems.join("\n"));
    syncAutofillField("internal_issues_summary", contextAutoSummary.internalItems.join("\n"));
  }, [
    hasContextPanel,
    contextHasPersistedDocument,
    contextRevisionLabel,
    contextDocumentDate,
    contextAutoSummary,
    valuesByFieldCode,
  ]);

  function updatePerformanceModel(nextModel) {
    const normalizedModel = normalizePerformanceIndicatorsModel(nextModel);
    onFieldChange(PERFORMANCE_INDICATORS_FIELD_CODE, normalizedModel);
  }

  function handlePerformanceIndicatorRowChange(rowId, fieldName, value) {
    const normalizedValue =
      fieldName === "objective_associated" ? normalizeYesNoValue(value, "no") : value;
    const nextIndicators = performanceModel.indicators.map((row) =>
      row.id === rowId ? { ...row, [fieldName]: normalizedValue } : row
    );
    updatePerformanceModel({
      ...performanceModel,
      indicators: nextIndicators,
      tracking: reconcilePerformanceTrackingRows(nextIndicators, performanceModel.tracking),
    });
  }

  function handleAddPerformanceIndicatorRow() {
    const nextIndicators = [
      ...performanceModel.indicators,
      createEmptyPerformanceIndicatorCatalogRow(),
    ];
    updatePerformanceModel({
      ...performanceModel,
      indicators: nextIndicators,
      tracking: reconcilePerformanceTrackingRows(nextIndicators, performanceModel.tracking),
    });
  }

  function handleDeletePerformanceIndicatorRow(rowId) {
    const nextIndicators = performanceModel.indicators.filter((row) => row.id !== rowId);
    updatePerformanceModel({
      ...performanceModel,
      indicators: nextIndicators,
      tracking: reconcilePerformanceTrackingRows(nextIndicators, performanceModel.tracking),
    });
  }

  function handlePerformanceTrackingRowChange(indicatorId, fieldName, value) {
    const nextTracking = reconcilePerformanceTrackingRows(
      performanceModel.indicators,
      performanceModel.tracking
    ).map((row) =>
      String(row.indicator_id || "") === String(indicatorId || "")
        ? {
            ...row,
            [fieldName]: normalizePerformanceNumber(value),
          }
        : row
    );
    updatePerformanceModel({
      ...performanceModel,
      tracking: nextTracking,
    });
  }

  function handlePerformanceAnnualModeChange(value) {
    const normalizedMode = String(value || "").trim().toLowerCase() === "sum" ? "sum" : "average";
    updatePerformanceModel({
      ...performanceModel,
      annual_mode: normalizedMode,
    });
  }

  useEffect(() => {
    if (!hasPerformancePanel) return;
    const currentValue = valuesByFieldCode?.[PERFORMANCE_INDICATORS_FIELD_CODE];
    const hasStoredValue = (() => {
      if (Array.isArray(currentValue)) return currentValue.length > 0;
      if (currentValue && typeof currentValue === "object") {
        const indicatorsLength = Array.isArray(currentValue.indicators)
          ? currentValue.indicators.length
          : 0;
        const trackingLength = Array.isArray(currentValue.tracking) ? currentValue.tracking.length : 0;
        return indicatorsLength > 0 || trackingLength > 0;
      }
      return String(currentValue ?? "").trim().length > 0;
    })();
    if (hasStoredValue) return;
    onFieldChange(PERFORMANCE_INDICATORS_FIELD_CODE, buildDefaultPerformanceIndicatorsModel());
  }, [hasPerformancePanel, onFieldChange, valuesByFieldCode]);

  function closeP09Panel() {
    if (p09Saving) return;
    setP09PanelMode(null);
  }

  function openP09Editor() {
    if (disabled || p09Loading) return;
    setContextPanelMode(null);
    setRiskOpportunityPanelMode(null);
    const sourceRows = p09HasPersistedDocument
      ? cloneP09Rows(p09SavedRows)
      : buildDefaultP09Rows();
    setP09DraftRows(sourceRows.length > 0 ? sourceRows : [createEmptyP09Row()]);
    setP09ExpandedRowIds(sourceRows.length > 0 ? [sourceRows[0].id] : []);
    setP09ValidationError("");
    setP09LoadError("");
    setP09PanelMode("edit");
  }

  function openP09Summary() {
    if (!p09Completed || disabled || p09Loading) return;
    setContextPanelMode(null);
    setRiskOpportunityPanelMode(null);
    setP09PanelMode("summary");
  }

  function handleP09RowChange(rowId, fieldName, value) {
    setP09ValidationError("");
    setP09DraftRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [fieldName]: value } : row))
    );
  }

  function handleAddP09Row() {
    setP09ValidationError("");
    const newRow = createEmptyP09Row();
    setP09DraftRows((prev) => [...prev, newRow]);
    setP09ExpandedRowIds((prev) => (prev.includes(newRow.id) ? prev : [...prev, newRow.id]));
  }

  function handleDeleteP09Row(rowId) {
    setP09ValidationError("");
    setP09DraftRows((prev) => prev.filter((row) => row.id !== rowId));
    setP09ExpandedRowIds((prev) => prev.filter((id) => id !== rowId));
  }

  function toggleP09RowExpanded(rowId) {
    setP09ExpandedRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  }

  function handleCancelP09Edition() {
    if (p09Saving) return;
    setP09PanelMode(null);
    setP09DraftRows([]);
    setP09ExpandedRowIds([]);
    setP09ValidationError("");
  }

  async function handleSaveP09Edition() {
    const normalizedAuditReportId = String(auditReportId || "").trim();
    if (!normalizedAuditReportId) {
      setP09ValidationError("No se pudo identificar la auditoría para guardar el documento.");
      return;
    }

    const normalizedRows = cloneP09Rows(p09DraftRows);
    const hasAtLeastOneInterestedParty = normalizedRows.some((row) =>
      String(row.interested_party || "").trim()
    );
    if (!hasAtLeastOneInterestedParty) {
      setP09ValidationError("Debes informar al menos una parte interesada para completar el documento.");
      return;
    }

    setP09Saving(true);
    setP09ValidationError("");
    setP09LoadError("");
    try {
      const payloadRows = buildP09RowsPayload(normalizedRows);
      const saved = await putAuditInterestedPartiesDocument(normalizedAuditReportId, {
        code: "P09",
        status: "completed",
        rows: payloadRows,
      });

      const mappedRows = mapApiRowsToP09Rows(saved.rows);
      const nextRevisionNumber = Number(saved.revision_number);
      const safeRevisionNumber = Number.isFinite(nextRevisionNumber) ? nextRevisionNumber : 0;
      const revisionLabel =
        String(saved.revision_label || "").trim() || formatP09Revision(safeRevisionNumber);
      const dateLabel = normalizeP09DateLabel(saved.document_date);

      setP09SavedRows(mappedRows);
      setP09Completed(String(saved.status || "").toLowerCase() === "completed");
      setP09RevisionNumber(safeRevisionNumber);
      setP09DocumentDate(dateLabel);
      setP09HasPersistedDocument(true);
      setP09ValidationError("");
      setP09PanelMode(null);
      setP09LoadedAuditReportId(normalizedAuditReportId);

      applyP09AutofillFields(onFieldChange, {
        code: String(saved.code || "P09"),
        revisionLabel,
        dateLabel,
      });
    } catch (err) {
      setP09ValidationError(
        err instanceof Error ? err.message : "No se pudo guardar el documento P09."
      );
    } finally {
      setP09Saving(false);
    }
  }

  function closeContextPanel() {
    if (contextSaving) return;
    setContextPanelMode(null);
  }

  function openContextEditor() {
    if (disabled || contextLoading) return;
    setP09PanelMode(null);
    setRiskOpportunityPanelMode(null);
    const sourceRows = contextHasPersistedDocument
      ? cloneContextRows(contextSavedRows)
      : buildDefaultContextRows();
    setContextDraftRows(sourceRows.length > 0 ? sourceRows : [createEmptyContextRow()]);
    setContextExpandedRowIds(sourceRows.length > 0 ? [sourceRows[0].id] : []);
    setContextDraftReviewedBy(contextReviewedBy);
    setContextDraftApprovedBy(contextApprovedBy);
    setContextValidationError("");
    setContextLoadError("");
    setContextPanelMode("edit");
  }

  function openContextSummary() {
    if (!contextCompleted || disabled || contextLoading) return;
    setP09PanelMode(null);
    setRiskOpportunityPanelMode(null);
    setContextPanelMode("summary");
  }

  function handleContextRowChange(rowId, fieldName, value) {
    setContextValidationError("");
    setContextDraftRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [fieldName]: value } : row))
    );
  }

  function handleAddContextRow() {
    setContextValidationError("");
    const newRow = createEmptyContextRow();
    setContextDraftRows((prev) => [...prev, newRow]);
    setContextExpandedRowIds((prev) => (prev.includes(newRow.id) ? prev : [...prev, newRow.id]));
  }

  function handleDeleteContextRow(rowId) {
    setContextValidationError("");
    setContextDraftRows((prev) => prev.filter((row) => row.id !== rowId));
    setContextExpandedRowIds((prev) => prev.filter((id) => id !== rowId));
  }

  function toggleContextRowExpanded(rowId) {
    setContextExpandedRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  }

  function handleCancelContextEdition() {
    if (contextSaving) return;
    setContextPanelMode(null);
    setContextDraftRows([]);
    setContextExpandedRowIds([]);
    setContextValidationError("");
  }

  async function handleSaveContextEdition() {
    const normalizedAuditReportId = String(auditReportId || "").trim();
    if (!normalizedAuditReportId) {
      setContextValidationError("No se pudo identificar la auditoría para guardar el documento.");
      return;
    }

    const normalizedRows = cloneContextRows(contextDraftRows);
    const hasAtLeastOneEnvironment = normalizedRows.some((row) =>
      String(row.environment || "").trim()
    );
    if (!hasAtLeastOneEnvironment) {
      setContextValidationError("Debes informar al menos un entorno para completar el documento.");
      return;
    }

    setContextSaving(true);
    setContextValidationError("");
    setContextLoadError("");
    try {
      const payloadRows = buildContextRowsPayload(normalizedRows);
      const saved = await putAuditContextDocument(normalizedAuditReportId, {
        code: "P09",
        status: "completed",
        reviewed_by: normalizeNullableText(contextDraftReviewedBy),
        approved_by: normalizeNullableText(contextDraftApprovedBy),
        rows: payloadRows,
      });

      const mappedRows = mapApiRowsToContextRows(saved.rows);
      const nextRevisionNumber = Number(saved.revision_number);
      const safeRevisionNumber = Number.isFinite(nextRevisionNumber) ? nextRevisionNumber : 0;
      const revisionLabel =
        String(saved.revision_label || "").trim() || formatP09Revision(safeRevisionNumber);
      const dateLabel = normalizeP09DateLabel(saved.document_date);
      const nextContextSummary = buildContextAutoSummary(mappedRows);
      const externalIssuesSummary = nextContextSummary.externalItems.join("\n");
      const internalIssuesSummary = nextContextSummary.internalItems.join("\n");

      setContextSavedRows(mappedRows);
      setContextCompleted(String(saved.status || "").toLowerCase() === "completed");
      setContextRevisionNumber(safeRevisionNumber);
      setContextDocumentDate(dateLabel);
      setContextReviewedBy(String(saved.reviewed_by || ""));
      setContextApprovedBy(String(saved.approved_by || ""));
      setContextHasPersistedDocument(true);
      setContextValidationError("");
      setContextPanelMode(null);
      setContextLoadedAuditReportId(normalizedAuditReportId);

      applyContextAutofillFields(onFieldChange, {
        code: String(saved.code || "P09"),
        revisionLabel,
        dateLabel,
        externalIssuesSummary,
        internalIssuesSummary,
      });
    } catch (err) {
      setContextValidationError(
        err instanceof Error ? err.message : "No se pudo guardar el documento de contexto."
      );
    } finally {
      setContextSaving(false);
    }
  }

  function closeRiskOpportunityPanel() {
    if (riskOpportunitySaving) return;
    setRiskOpportunityPanelMode(null);
  }

  function openRiskOpportunityEditor() {
    if (disabled || riskOpportunityLoading) return;
    setP09PanelMode(null);
    setContextPanelMode(null);
    const sourceDraft = riskOpportunityHasPersistedDocument
      ? cloneRiskOpportunityDraft(riskOpportunitySavedDraft)
      : buildDefaultRiskOpportunityDraft();
    setRiskOpportunityDraft(syncRiskOpportunityAutoRows(sourceDraft));
    setRiskOpportunityValidationError("");
    setRiskOpportunityLoadError("");
    setRiskOpportunityPanelMode("edit");
  }

  function openRiskOpportunitySummary() {
    if (!riskOpportunityCompleted || disabled || riskOpportunityLoading) return;
    setP09PanelMode(null);
    setContextPanelMode(null);
    setRiskOpportunityPanelMode("summary");
  }

  function handleSwotRowChange(rowId, value) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) =>
      syncRiskOpportunityAutoRows({
        ...prev,
        swotRows: prev.swotRows.map((row) =>
          row.id === rowId ? { ...row, description: value } : row
        ),
      })
    );
  }

  function handleAddSwotRow(swotCategory) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) =>
      syncRiskOpportunityAutoRows({
        ...prev,
        swotRows: [...prev.swotRows, createEmptySwotRow(swotCategory)],
      })
    );
  }

  function handleDeleteSwotRow(rowId) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) =>
      syncRiskOpportunityAutoRows({
        ...prev,
        swotRows: prev.swotRows.filter((row) => row.id !== rowId),
      })
    );
  }

  function handleRiskRowChange(rowId, fieldName, value) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      riskRows: prev.riskRows.map((row) => (row.id === rowId ? { ...row, [fieldName]: value } : row)),
    }));
  }

  function handleAddRiskRow() {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      riskRows: [...prev.riskRows, createEmptyRiskRow({ is_auto_generated: false })],
    }));
  }

  function handleDeleteRiskRow(rowId) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      riskRows: prev.riskRows.filter((row) => row.id !== rowId),
    }));
  }

  function handleOpportunityRowChange(rowId, fieldName, value) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      opportunityRows: prev.opportunityRows.map((row) =>
        row.id === rowId ? { ...row, [fieldName]: value } : row
      ),
    }));
  }

  function handleAddOpportunityRow() {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      opportunityRows: [...prev.opportunityRows, createEmptyOpportunityRow({ is_auto_generated: false })],
    }));
  }

  function handleDeleteOpportunityRow(rowId) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      opportunityRows: prev.opportunityRows.filter((row) => row.id !== rowId),
    }));
  }

  function handleFollowUpRowChange(rowId, fieldName, value) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      followUpRows: prev.followUpRows.map((row) =>
        row.id === rowId ? { ...row, [fieldName]: value } : row
      ),
    }));
  }

  function handleAddFollowUpRow() {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      followUpRows: [...prev.followUpRows, createEmptyFollowUpRow()],
    }));
  }

  function handleDeleteFollowUpRow(rowId) {
    setRiskOpportunityValidationError("");
    setRiskOpportunityDraft((prev) => ({
      ...prev,
      followUpRows: prev.followUpRows.filter((row) => row.id !== rowId),
    }));
  }

  function handleCancelRiskOpportunityEdition() {
    if (riskOpportunitySaving) return;
    setRiskOpportunityPanelMode(null);
    setRiskOpportunityDraft(cloneRiskOpportunityDraft(riskOpportunitySavedDraft));
    setRiskOpportunityValidationError("");
  }

  async function handleSaveRiskOpportunityEdition() {
    const normalizedAuditReportId = String(auditReportId || "").trim();
    if (!normalizedAuditReportId) {
      setRiskOpportunityValidationError(
        "No se pudo identificar la auditoría para guardar el documento."
      );
      return;
    }

    const normalizedDraft = syncRiskOpportunityAutoRows(riskOpportunityDraft);
    const hasDafoSource = normalizedDraft.swotRows.some((row) => String(row.description || "").trim());
    if (!hasDafoSource) {
      setRiskOpportunityValidationError(
        "Debes informar al menos un elemento DAFO para generar riesgos y oportunidades."
      );
      return;
    }

    const referenceIds = new Set([
      ...normalizedDraft.riskRows.map((row) => String(row.id || "")),
      ...normalizedDraft.opportunityRows.map((row) => String(row.id || "")),
    ]);
    const hasInvalidActionReference = normalizedDraft.followUpRows.some((row) => {
      const hasAction = String(row.action || "").trim().length > 0;
      if (!hasAction) return false;
      const referenceKind = String(row.reference_kind || "").trim().toLowerCase();
      const referenceId = String(row.reference_row_id || "").trim();
      if (
        referenceKind !== RISK_OPPORTUNITY_REFERENCE_TYPES.RISK &&
        referenceKind !== RISK_OPPORTUNITY_REFERENCE_TYPES.OPPORTUNITY
      ) {
        return true;
      }
      return !referenceId || !referenceIds.has(referenceId);
    });
    if (hasInvalidActionReference) {
      setRiskOpportunityValidationError(
        "Cada accion debe estar vinculada a un riesgo u oportunidad valido."
      );
      return;
    }

    const payloadRows = buildRiskOpportunityRowsPayload(normalizedDraft);
    if (payloadRows.length === 0) {
      setRiskOpportunityValidationError(
        "Debes informar al menos un elemento en DAFO, riesgos, oportunidades o acciones."
      );
      return;
    }

    setRiskOpportunityDraft(normalizedDraft);
    setRiskOpportunitySaving(true);
    setRiskOpportunityValidationError("");
    setRiskOpportunityLoadError("");
    try {
      const saved = await putAuditRiskOpportunityDocument(normalizedAuditReportId, {
        code: "P09",
        status: "completed",
        rows: payloadRows,
      });
      const mappedDraft = mapApiRowsToRiskOpportunityDraft(saved.rows);
      const nextRevisionNumber = Number(saved.revision_number);
      const safeRevisionNumber = Number.isFinite(nextRevisionNumber) ? nextRevisionNumber : 0;
      const dateLabel = normalizeP09DateLabel(saved.document_date);
      const normalizedStatus = String(saved.status || "").toLowerCase();

      setRiskOpportunitySavedDraft(mappedDraft);
      setRiskOpportunityDraft(cloneRiskOpportunityDraft(mappedDraft));
      setRiskOpportunityCompleted(normalizedStatus === "completed");
      setRiskOpportunityRevisionNumber(safeRevisionNumber);
      setRiskOpportunityDocumentDate(dateLabel);
      setRiskOpportunityHasPersistedDocument(true);
      setRiskOpportunityLoadedAuditReportId(normalizedAuditReportId);
      setRiskOpportunityPanelMode(null);
    } catch (err) {
      setRiskOpportunityValidationError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el documento de riesgos y oportunidades."
      );
    } finally {
      setRiskOpportunitySaving(false);
    }
  }

  useEffect(() => {
    if (!hasP09Panel) return;
    const normalizedAuditReportId = String(auditReportId || "").trim();
    if (!normalizedAuditReportId) return;
    if (p09LoadedAuditReportId === normalizedAuditReportId) return;

    let isCurrent = true;
    setP09Loading(true);
    setP09LoadError("");

    fetchAuditInterestedPartiesDocument(normalizedAuditReportId)
      .then((documentData) => {
        if (!isCurrent) return;
        if (!documentData) {
          setP09Completed(false);
          setP09SavedRows([]);
          setP09RevisionNumber(-1);
          setP09DocumentDate("");
          setP09HasPersistedDocument(false);
          setP09LoadedAuditReportId(normalizedAuditReportId);
          return;
        }

        const mappedRows = mapApiRowsToP09Rows(documentData.rows);
        const nextRevisionNumber = Number(documentData.revision_number);
        const safeRevisionNumber = Number.isFinite(nextRevisionNumber) ? nextRevisionNumber : 0;
        const revisionLabel =
          String(documentData.revision_label || "").trim() || formatP09Revision(safeRevisionNumber);
        const dateLabel = normalizeP09DateLabel(documentData.document_date);

        setP09SavedRows(mappedRows);
        setP09Completed(true);
        setP09RevisionNumber(safeRevisionNumber);
        setP09DocumentDate(dateLabel);
        setP09HasPersistedDocument(true);
        setP09LoadedAuditReportId(normalizedAuditReportId);

        applyP09AutofillFields(onFieldChange, {
          code: String(documentData.code || "P09"),
          revisionLabel,
          dateLabel,
        });
      })
      .catch((err) => {
        if (!isCurrent) return;
        setP09LoadError(
          err instanceof Error ? err.message : "No se pudo cargar el documento P09."
        );
      })
      .finally(() => {
        if (!isCurrent) return;
        setP09Loading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [auditReportId, hasP09Panel, p09LoadedAuditReportId]);

  useEffect(() => {
    if (!hasContextPanel) return;
    const normalizedAuditReportId = String(auditReportId || "").trim();
    if (!normalizedAuditReportId) return;
    if (contextLoadedAuditReportId === normalizedAuditReportId) return;

    let isCurrent = true;
    setContextLoading(true);
    setContextLoadError("");

    fetchAuditContextDocument(normalizedAuditReportId)
      .then((documentData) => {
        if (!isCurrent) return;
        if (!documentData) {
          setContextCompleted(false);
          setContextSavedRows([]);
          setContextRevisionNumber(-1);
          setContextDocumentDate("");
          setContextReviewedBy("");
          setContextApprovedBy("");
          setContextHasPersistedDocument(false);
          setContextLoadedAuditReportId(normalizedAuditReportId);
          return;
        }

        const mappedRows = mapApiRowsToContextRows(documentData.rows);
        const nextRevisionNumber = Number(documentData.revision_number);
        const safeRevisionNumber = Number.isFinite(nextRevisionNumber) ? nextRevisionNumber : 0;
        const revisionLabel =
          String(documentData.revision_label || "").trim() || formatP09Revision(safeRevisionNumber);
        const dateLabel = normalizeP09DateLabel(documentData.document_date);
        const normalizedStatus = String(documentData.status || "").toLowerCase();
        const nextContextSummary = buildContextAutoSummary(mappedRows);
        const externalIssuesSummary = nextContextSummary.externalItems.join("\n");
        const internalIssuesSummary = nextContextSummary.internalItems.join("\n");

        setContextSavedRows(mappedRows);
        setContextCompleted(normalizedStatus === "completed");
        setContextRevisionNumber(safeRevisionNumber);
        setContextDocumentDate(dateLabel);
        setContextReviewedBy(String(documentData.reviewed_by || ""));
        setContextApprovedBy(String(documentData.approved_by || ""));
        setContextHasPersistedDocument(true);
        setContextLoadedAuditReportId(normalizedAuditReportId);

        applyContextAutofillFields(onFieldChange, {
          code: String(documentData.code || "P09"),
          revisionLabel,
          dateLabel,
          externalIssuesSummary,
          internalIssuesSummary,
        });
      })
      .catch((err) => {
        if (!isCurrent) return;
        setContextLoadError(
          err instanceof Error ? err.message : "No se pudo cargar el documento de contexto."
        );
      })
      .finally(() => {
        if (!isCurrent) return;
        setContextLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [auditReportId, hasContextPanel, contextLoadedAuditReportId]);

  useEffect(() => {
    if (!hasRiskOpportunityPanel) return;
    const normalizedAuditReportId = String(auditReportId || "").trim();
    if (!normalizedAuditReportId) return;
    if (riskOpportunityLoadedAuditReportId === normalizedAuditReportId) return;

    let isCurrent = true;
    setRiskOpportunityLoading(true);
    setRiskOpportunityLoadError("");

    fetchAuditRiskOpportunityDocument(normalizedAuditReportId)
      .then((documentData) => {
        if (!isCurrent) return;
        if (!documentData) {
          const defaultDraft = buildDefaultRiskOpportunityDraft();
          setRiskOpportunitySavedDraft(defaultDraft);
          setRiskOpportunityDraft(cloneRiskOpportunityDraft(defaultDraft));
          setRiskOpportunityCompleted(false);
          setRiskOpportunityRevisionNumber(-1);
          setRiskOpportunityDocumentDate("");
          setRiskOpportunityHasPersistedDocument(false);
          setRiskOpportunityLoadedAuditReportId(normalizedAuditReportId);
          return;
        }

        const mappedDraft = mapApiRowsToRiskOpportunityDraft(documentData.rows);
        const nextRevisionNumber = Number(documentData.revision_number);
        const safeRevisionNumber = Number.isFinite(nextRevisionNumber) ? nextRevisionNumber : 0;
        const dateLabel = normalizeP09DateLabel(documentData.document_date);
        const normalizedStatus = String(documentData.status || "").toLowerCase();

        setRiskOpportunitySavedDraft(mappedDraft);
        setRiskOpportunityDraft(cloneRiskOpportunityDraft(mappedDraft));
        setRiskOpportunityCompleted(normalizedStatus === "completed");
        setRiskOpportunityRevisionNumber(safeRevisionNumber);
        setRiskOpportunityDocumentDate(dateLabel);
        setRiskOpportunityHasPersistedDocument(true);
        setRiskOpportunityLoadedAuditReportId(normalizedAuditReportId);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setRiskOpportunityLoadError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el documento de riesgos y oportunidades."
        );
      })
      .finally(() => {
        if (!isCurrent) return;
        setRiskOpportunityLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [auditReportId, hasRiskOpportunityPanel, riskOpportunityLoadedAuditReportId]);

  useEffect(() => {
    if (!isAnyDocumentPanelOpen) return undefined;
    function onEscape(event) {
      if (event.key === "Escape") {
        if (isRiskOpportunityPanelOpen) {
          closeRiskOpportunityPanel();
          return;
        }
        if (isContextPanelOpen) {
          closeContextPanel();
          return;
        }
        closeP09Panel();
      }
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [
    isAnyDocumentPanelOpen,
    isContextPanelOpen,
    isRiskOpportunityPanelOpen,
    p09Saving,
    contextSaving,
    riskOpportunitySaving,
  ]);

  useEffect(() => {
    if (hasP09Panel) return;
    if (!isP09PanelOpen) return;
    setP09PanelMode(null);
  }, [hasP09Panel, isP09PanelOpen]);

  useEffect(() => {
    if (hasContextPanel) return;
    if (!isContextPanelOpen) return;
    setContextPanelMode(null);
  }, [hasContextPanel, isContextPanelOpen]);

  useEffect(() => {
    if (hasRiskOpportunityPanel) return;
    if (!isRiskOpportunityPanelOpen) return;
    setRiskOpportunityPanelMode(null);
  }, [hasRiskOpportunityPanel, isRiskOpportunityPanelOpen]);

  if (!groups || groups.length === 0) {
    return <p className="empty-state">Esta seccion no tiene campos guiados configurados.</p>;
  }

  return (
    <div className="audit-guided-groups">
      {groups.map((group) => (
        <section key={group.field_group} className="audit-guided-group-card">
          <header className="audit-guided-group-header">
            <h4>{group.title}</h4>
            {group.description ? <p>{group.description}</p> : null}
          </header>

          <div className="audit-guided-group-grid">
            {renderGroupFields(
              group,
              valuesByFieldCode,
              onFieldChange,
              disabled,
              {
                isCompleted: p09Completed,
                onOpenEditor: openP09Editor,
                onOpenSummary: openP09Summary,
                registeredCount: p09RegisteredCount,
                revisionLabel: p09RevisionLabel,
                dateLabel: p09DocumentDate,
                loading: p09Loading,
                loadError: p09LoadError,
              },
              {
                isCompleted: contextCompleted,
                onOpenEditor: openContextEditor,
                onOpenSummary: openContextSummary,
                registeredCount: contextRegisteredCount,
                revisionLabel: contextRevisionLabel,
                dateLabel: contextDocumentDate,
                loading: contextLoading,
                loadError: contextLoadError,
                externalSummaryItems: contextAutoSummary.externalItems,
                internalSummaryItems: contextAutoSummary.internalItems,
              },
              {
                isCompleted: riskOpportunityCompleted,
                onOpenEditor: openRiskOpportunityEditor,
                onOpenSummary: openRiskOpportunitySummary,
                registeredCount: riskOpportunityRegisteredCount,
                summaryLine: `${riskOpportunitySavedCounters.riskCount} riesgos · ${riskOpportunitySavedCounters.generatedOpportunityCount} oportunidades · ${riskOpportunitySavedCounters.actionCount} acciones`,
                revisionLabel: riskOpportunityRevisionLabel,
                dateLabel: riskOpportunityDocumentDate,
                loading: riskOpportunityLoading,
                loadError: riskOpportunityLoadError,
              },
              {
                model: performanceModel,
                activeTab: performanceActiveTab,
                computedRows: performanceComputedRows,
                chartMaxValue: performanceChartMaxValue,
                compliantCount: performanceCompliantCount,
                onChangeTab: setPerformanceActiveTab,
                onAddIndicatorRow: handleAddPerformanceIndicatorRow,
                onDeleteIndicatorRow: handleDeletePerformanceIndicatorRow,
                onChangeIndicatorRow: handlePerformanceIndicatorRowChange,
                onChangeTrackingRow: handlePerformanceTrackingRowChange,
                onChangeAnnualMode: handlePerformanceAnnualModeChange,
              }
            )}
          </div>
        </section>
      ))}

      {isP09PanelOpen && hasP09Panel ? (
        <div className="audit-p09-drawer-overlay" role="presentation" onClick={closeP09Panel}>
          <aside
            className="audit-p09-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="P09 - Partes interesadas"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="audit-p09-drawer-header">
              <div className="audit-p09-drawer-headings">
                <p className="audit-p09-drawer-kicker">DOCUMENTO ISO 9001 - CLÁUSULA 4.2</p>
                <h4>{"P09 \u2013 Partes interesadas"}</h4>
                <p>
                  Define las partes interesadas y sus necesidades/expectativas para esta auditoría.
                </p>
              </div>
              <div className="audit-p09-drawer-right">
                <div className="audit-p09-drawer-meta">
                  <span className={`audit-p09-status-badge ${p09Completed ? "completed" : ""}`}>
                    {p09Completed ? "Completado" : "Pendiente"}
                  </span>
                  <p className="audit-p09-drawer-meta-line">
                    {p09Completed
                      ? `${p09RevisionLabel || "-"} | ${p09DocumentDate || "-"}`
                      : "Sin versión guardada"}
                  </p>
                </div>
                <button
                  type="button"
                  className="audit-p09-drawer-close"
                  onClick={closeP09Panel}
                  aria-label="Cerrar panel de partes interesadas"
                >
                  X
                </button>
              </div>
            </header>

            <div className="audit-p09-drawer-body">
              <article className="audit-p09-info-box">
                <p className="audit-p09-info-title">Contexto del documento</p>
                <p>
                  Define las partes interesadas relevantes y sus necesidades/expectativas. Este
                  {"documento alimenta autom\u00e1ticamente el apartado 4B del informe."}
                </p>
              </article>

              {isP09EditMode ? (
                <>
                  <div className="audit-p09-editor-toolbar">
                    <p className="soft-label audit-p09-editor-helper">
                      Completa el documento en bloques para facilitar la lectura y edición.
                    </p>
                    <button
                      type="button"
                      className="btn-ghost audit-p09-add-row-btn"
                      onClick={handleAddP09Row}
                      disabled={p09Saving}
                    >
                      + Añadir parte interesada
                    </button>
                  </div>

                  {p09DraftRows.length === 0 ? (
                    <p className="empty-state">No hay filas. Añade una para empezar.</p>
                  ) : (
                    <div className="audit-p09-editor-list">
                      {p09DraftRows.map((row, index) => (
                        <article
                          className={`audit-p09-editor-card ${p09ExpandedRowIds.includes(row.id) ? "" : "collapsed"}`}
                          key={row.id}
                        >
                          <header className="audit-p09-editor-card-header">
                            <button
                              type="button"
                              className="audit-p09-editor-card-toggle"
                              disabled={p09Saving}
                              onClick={() => toggleP09RowExpanded(row.id)}
                            >
                              <div className="audit-p09-editor-main">
                                <p className="audit-p09-editor-index">{`Parte interesada ${index + 1}`}</p>
                                <p className="audit-p09-editor-stakeholder-name">
                                  {String(row.interested_party || "").trim() || "Sin nombre definido"}
                                </p>
                              </div>
                              <div className="audit-p09-editor-toggle-side">
                                <span className={`audit-p09-inline-badge ${row.applies === "yes" ? "yes" : "no"}`}>
                                  {row.applies === "yes" ? "Aplica" : "No aplica"}
                                </span>
                                <span className="audit-p09-editor-toggle-hint">
                                  {p09ExpandedRowIds.includes(row.id) ? "Ocultar detalle" : "Ver detalle"}
                                </span>
                              </div>
                            </button>
                            <button
                              type="button"
                              className="btn-ghost audit-p09-delete-row-btn"
                              disabled={p09Saving}
                              onClick={() => handleDeleteP09Row(row.id)}
                            >
                              Eliminar
                            </button>
                          </header>

                          {p09ExpandedRowIds.includes(row.id) ? (
                            <div className="audit-p09-editor-card-body-wrap">
                              <div className="audit-p09-editor-core-row">
                                <label className="field-stack audit-p09-editor-field audit-p09-editor-field-wide">
                                  <span>Parte interesada</span>
                                  <input
                                    className="input-text"
                                    value={row.interested_party}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "interested_party", event.target.value)
                                    }
                                    placeholder="Parte interesada"
                                  />
                                </label>

                                <label className="field-stack audit-p09-editor-field audit-p09-editor-applies">
                                  <span>Aplica</span>
                                  <select
                                    className="input-select"
                                    value={row.applies}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "applies", event.target.value)
                                    }
                                  >
                                    <option value="yes">Sí</option>
                                    <option value="no">No</option>
                                  </select>
                                </label>
                              </div>

                              <div className="audit-p09-editor-card-body">
                                <label className="field-stack audit-p09-editor-field">
                                  <span>Necesidades</span>
                                  <textarea
                                    className="input-textarea audit-p09-editor-textarea"
                                    value={row.needs}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "needs", event.target.value)
                                    }
                                    placeholder="Describe las necesidades de esta parte interesada"
                                  />
                                </label>

                                <label className="field-stack audit-p09-editor-field">
                                  <span>Expectativas</span>
                                  <textarea
                                    className="input-textarea audit-p09-editor-textarea"
                                    value={row.expectations}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "expectations", event.target.value)
                                    }
                                    placeholder="Describe las expectativas principales"
                                  />
                                </label>

                                <label className="field-stack audit-p09-editor-field">
                                  <span>Requisitos</span>
                                  <textarea
                                    className="input-textarea audit-p09-editor-textarea"
                                    value={row.requirements}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "requirements", event.target.value)
                                    }
                                    placeholder="Requisitos aplicables (legales, contractuales, normativos)"
                                  />
                                </label>

                                <label className="field-stack audit-p09-editor-field">
                                  <span>Riesgos</span>
                                  <textarea
                                    className="input-textarea audit-p09-editor-textarea"
                                    value={row.risks}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "risks", event.target.value)
                                    }
                                    placeholder="Riesgos asociados"
                                  />
                                </label>

                                <label className="field-stack audit-p09-editor-field">
                                  <span>Oportunidades</span>
                                  <textarea
                                    className="input-textarea audit-p09-editor-textarea"
                                    value={row.opportunities}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "opportunities", event.target.value)
                                    }
                                    placeholder="Oportunidades de mejora o crecimiento"
                                  />
                                </label>

                                <label className="field-stack audit-p09-editor-field">
                                  <span>Acciones</span>
                                  <textarea
                                    className="input-textarea audit-p09-editor-textarea"
                                    value={row.actions}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "actions", event.target.value)
                                    }
                                    placeholder="Acciones de seguimiento o tratamiento"
                                  />
                                </label>

                                <label className="field-stack audit-p09-editor-field audit-p09-editor-field-wide">
                                  <span>Observaciones</span>
                                  <textarea
                                    className="input-textarea audit-p09-editor-textarea"
                                    value={row.observations}
                                    disabled={p09Saving}
                                    onChange={(event) =>
                                      handleP09RowChange(row.id, "observations", event.target.value)
                                    }
                                    placeholder="Observaciones adicionales (opcional)"
                                  />
                                </label>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                  {p09ValidationError ? <p className="audit-p09-validation-error">{p09ValidationError}</p> : null}
                </>
              ) : (
                <>
                  {p09SavedRows.length === 0 ? (
                    <p className="empty-state">No hay datos guardados para mostrar.</p>
                  ) : (
                    <div className="audit-p09-summary-list">
                      {p09SavedRows.map((row) => (
                        <article className="audit-p09-summary-item" key={row.id}>
                          <header>
                            <h5>{row.interested_party || "Parte interesada sin nombre"}</h5>
                            <span className={`audit-p09-inline-badge ${row.applies === "yes" ? "yes" : "no"}`}>
                              {row.applies === "yes" ? "Aplica" : "No aplica"}
                            </span>
                          </header>
                          <div className="audit-p09-summary-grid">
                            <div>
                              <p className="soft-label">Necesidades</p>
                              <p>{row.needs || "-"}</p>
                            </div>
                            <div>
                              <p className="soft-label">Expectativas</p>
                              <p>{row.expectations || "-"}</p>
                            </div>
                            <div>
                              <p className="soft-label">Requisitos</p>
                              <p>{row.requirements || "-"}</p>
                            </div>
                            <div>
                              <p className="soft-label">Riesgos</p>
                              <p>{row.risks || "-"}</p>
                            </div>
                            <div>
                              <p className="soft-label">Oportunidades</p>
                              <p>{row.opportunities || "-"}</p>
                            </div>
                            <div>
                              <p className="soft-label">Acciones</p>
                              <p>{row.actions || "-"}</p>
                            </div>
                            <div className="audit-p09-summary-wide">
                              <p className="soft-label">Observaciones</p>
                              <p>{row.observations || "-"}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <footer className="audit-p09-drawer-footer">
              {isP09EditMode ? (
                <>
                  <button type="button" className="btn-secondary" onClick={handleCancelP09Edition} disabled={p09Saving}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={disabled || p09Saving || p09Loading}
                    onClick={handleSaveP09Edition}
                  >
                    {p09Saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary" onClick={closeP09Panel} disabled={p09Saving}>
                  Cerrar
                </button>
              )}
            </footer>
          </aside>
        </div>
      ) : null}

      {isContextPanelOpen && hasContextPanel ? (
        <div className="audit-p09-drawer-overlay" role="presentation" onClick={closeContextPanel}>
          <aside
            className="audit-p09-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="P09 - Contexto de la organización"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="audit-p09-drawer-header">
              <div className="audit-p09-drawer-headings">
                <p className="audit-p09-drawer-kicker">DOCUMENTO ISO 9001 - CLÁUSULA 4.1</p>
                <h4>{"P09 - Contexto de la organización"}</h4>
                <p>
                  Define el contexto interno y externo, incorporando riesgos, oportunidades y
                  acciones para la auditoría.
                </p>
              </div>
              <div className="audit-p09-drawer-right">
                <div className="audit-p09-drawer-meta">
                  <span className={`audit-p09-status-badge ${contextCompleted ? "completed" : ""}`}>
                    {contextCompleted ? "Completado" : "Pendiente"}
                  </span>
                  <p className="audit-p09-drawer-meta-line">
                    {contextCompleted
                      ? `${contextRevisionLabel || "-"} | ${contextDocumentDate || "-"}`
                      : "Sin versión guardada"}
                  </p>
                </div>
                <button
                  type="button"
                  className="audit-p09-drawer-close"
                  onClick={closeContextPanel}
                  aria-label="Cerrar panel de contexto"
                >
                  X
                </button>
              </div>
            </header>

            <div className="audit-p09-drawer-body">
              <article className="audit-p09-info-box">
                <p className="audit-p09-info-title">Contexto del documento</p>
                <p>
                  Documento de contexto de la organización según ISO 9001 (4.1), con estructura por
                  entorno externo e interno.
                </p>
              </article>

              {isContextEditMode ? (
                <>
                  <div className="audit-context-meta-grid">
                    <label className="field-stack audit-p09-editor-field">
                      <span>Revisado por</span>
                      <input
                        className="input-text"
                        value={contextDraftReviewedBy}
                        disabled={contextSaving}
                        onChange={(event) => setContextDraftReviewedBy(event.target.value)}
                        placeholder="Persona que revisa"
                      />
                    </label>
                    <label className="field-stack audit-p09-editor-field">
                      <span>Aprobado por</span>
                      <input
                        className="input-text"
                        value={contextDraftApprovedBy}
                        disabled={contextSaving}
                        onChange={(event) => setContextDraftApprovedBy(event.target.value)}
                        placeholder="Persona que aprueba"
                      />
                    </label>
                  </div>

                  <div className="audit-p09-editor-toolbar">
                    <p className="soft-label audit-p09-editor-helper">
                      Gestiona cada entorno en cards para mantener lectura clara y trazabilidad.
                    </p>
                    <button
                      type="button"
                      className="btn-ghost audit-p09-add-row-btn"
                      onClick={handleAddContextRow}
                      disabled={contextSaving}
                    >
                      + Añadir entorno
                    </button>
                  </div>

                  {contextDraftRows.length === 0 ? (
                    <p className="empty-state">No hay filas. Añade una para empezar.</p>
                  ) : (
                    <>
                      {CONTEXT_GROUP_ORDER.map((groupKey) => {
                        const groupRows = groupedContextDraftRows[groupKey] || [];
                        return (
                          <section className="audit-context-group" key={groupKey}>
                            <header className="audit-context-group-header">
                              <div>
                                <p className="audit-context-group-kicker">CONTEXTO</p>
                                <h5>{CONTEXT_GROUP_LABELS[groupKey]}</h5>
                              </div>
                              <span className="soft-label">{`${groupRows.length} entornos`}</span>
                            </header>

                            {groupRows.length === 0 ? (
                              <p className="soft-label">No hay entornos en este bloque.</p>
                            ) : (
                              <div className="audit-p09-editor-list">
                                {groupRows.map((row) => {
                                  const rowIndex =
                                    contextDraftRows.findIndex((item) => item.id === row.id) + 1;
                                  return (
                                    <article
                                      key={row.id}
                                      className={`audit-p09-editor-card ${
                                        contextExpandedRowIds.includes(row.id) ? "" : "collapsed"
                                      }`}
                                    >
                                      <header className="audit-p09-editor-card-header">
                                        <button
                                          type="button"
                                          className="audit-p09-editor-card-toggle"
                                          disabled={contextSaving}
                                          onClick={() => toggleContextRowExpanded(row.id)}
                                        >
                                          <div className="audit-p09-editor-main">
                                            <p className="audit-p09-editor-index">{`Entorno ${rowIndex}`}</p>
                                            <p className="audit-p09-editor-stakeholder-name">
                                              {String(row.environment || "").trim() ||
                                                "Sin entorno definido"}
                                            </p>
                                          </div>
                                          <div className="audit-p09-editor-toggle-side">
                                            <span className="audit-context-group-chip">
                                              {CONTEXT_GROUP_LABELS[normalizeContextGroup(row.context_group)]}
                                            </span>
                                            <span className="audit-p09-editor-toggle-hint">
                                              {contextExpandedRowIds.includes(row.id)
                                                ? "Ocultar detalle"
                                                : "Ver detalle"}
                                            </span>
                                          </div>
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-ghost audit-p09-delete-row-btn"
                                          disabled={contextSaving}
                                          onClick={() => handleDeleteContextRow(row.id)}
                                        >
                                          Eliminar
                                        </button>
                                      </header>

                                      {contextExpandedRowIds.includes(row.id) ? (
                                        <div className="audit-p09-editor-card-body-wrap">
                                          <div className="audit-p09-editor-core-row">
                                            <label className="field-stack audit-p09-editor-field audit-p09-editor-field-wide">
                                              <span>Entorno</span>
                                              <input
                                                className="input-text"
                                                value={row.environment}
                                                disabled={contextSaving}
                                                onChange={(event) =>
                                                  handleContextRowChange(
                                                    row.id,
                                                    "environment",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Nombre del entorno"
                                              />
                                            </label>
                                            <label className="field-stack audit-p09-editor-field audit-p09-editor-applies">
                                              <span>Contexto</span>
                                              <select
                                                className="input-select"
                                                value={normalizeContextGroup(row.context_group)}
                                                disabled={contextSaving}
                                                onChange={(event) =>
                                                  handleContextRowChange(
                                                    row.id,
                                                    "context_group",
                                                    event.target.value
                                                  )
                                                }
                                              >
                                                <option value="externo">Externo</option>
                                                <option value="interno">Interno</option>
                                              </select>
                                            </label>
                                          </div>

                                          <div className="audit-p09-editor-card-body">
                                            <label className="field-stack audit-p09-editor-field">
                                              <span>Riesgos</span>
                                              <textarea
                                                className="input-textarea audit-p09-editor-textarea"
                                                value={row.risks}
                                                disabled={contextSaving}
                                                onChange={(event) =>
                                                  handleContextRowChange(
                                                    row.id,
                                                    "risks",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Riesgos del entorno"
                                              />
                                            </label>
                                            <label className="field-stack audit-p09-editor-field">
                                              <span>Oportunidades</span>
                                              <textarea
                                                className="input-textarea audit-p09-editor-textarea"
                                                value={row.opportunities}
                                                disabled={contextSaving}
                                                onChange={(event) =>
                                                  handleContextRowChange(
                                                    row.id,
                                                    "opportunities",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Oportunidades del entorno"
                                              />
                                            </label>
                                            <label className="field-stack audit-p09-editor-field">
                                              <span>Acciones</span>
                                              <textarea
                                                className="input-textarea audit-p09-editor-textarea"
                                                value={row.actions}
                                                disabled={contextSaving}
                                                onChange={(event) =>
                                                  handleContextRowChange(
                                                    row.id,
                                                    "actions",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Acciones previstas"
                                              />
                                            </label>
                                            <label className="field-stack audit-p09-editor-field">
                                              <span>Observaciones</span>
                                              <textarea
                                                className="input-textarea audit-p09-editor-textarea"
                                                value={row.observations}
                                                disabled={contextSaving}
                                                onChange={(event) =>
                                                  handleContextRowChange(
                                                    row.id,
                                                    "observations",
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Observaciones adicionales (opcional)"
                                              />
                                            </label>
                                          </div>
                                        </div>
                                      ) : null}
                                    </article>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </>
                  )}

                  {contextValidationError ? (
                    <p className="audit-p09-validation-error">{contextValidationError}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="audit-context-meta-summary">
                    <p>
                      <span className="soft-label">Revisado:</span> {contextReviewedBy || "-"}
                    </p>
                    <p>
                      <span className="soft-label">Aprobado:</span> {contextApprovedBy || "-"}
                    </p>
                  </div>

                  {contextSavedRows.length === 0 ? (
                    <p className="empty-state">No hay datos guardados para mostrar.</p>
                  ) : (
                    <>
                      {CONTEXT_GROUP_ORDER.map((groupKey) => {
                        const groupRows = groupedContextSavedRows[groupKey] || [];
                        if (groupRows.length === 0) return null;
                        return (
                          <section className="audit-context-summary-group" key={groupKey}>
                            <header className="audit-context-group-header">
                              <div>
                                <p className="audit-context-group-kicker">CONTEXTO</p>
                                <h5>{CONTEXT_GROUP_LABELS[groupKey]}</h5>
                              </div>
                              <span className="soft-label">{`${groupRows.length} entornos`}</span>
                            </header>
                            <div className="audit-p09-summary-list">
                              {groupRows.map((row) => (
                                <article className="audit-p09-summary-item" key={row.id}>
                                  <header>
                                    <h5>{row.environment || "Entorno sin nombre"}</h5>
                                  </header>
                                  <div className="audit-p09-summary-grid">
                                    <div>
                                      <p className="soft-label">Riesgos</p>
                                      <p>{row.risks || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="soft-label">Oportunidades</p>
                                      <p>{row.opportunities || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="soft-label">Acciones</p>
                                      <p>{row.actions || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="soft-label">Observaciones</p>
                                      <p>{row.observations || "-"}</p>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>

            <footer className="audit-p09-drawer-footer">
              {isContextEditMode ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCancelContextEdition}
                    disabled={contextSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={disabled || contextSaving || contextLoading}
                    onClick={handleSaveContextEdition}
                  >
                    {contextSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={closeContextPanel}
                  disabled={contextSaving}
                >
                  Cerrar
                </button>
              )}
            </footer>
          </aside>
        </div>
      ) : null}

      {isRiskOpportunityPanelOpen && hasRiskOpportunityPanel ? (
        <div
          className="audit-p09-drawer-overlay"
          role="presentation"
          onClick={closeRiskOpportunityPanel}
        >
          <aside
            className="audit-p09-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="P09 - Riesgos y oportunidades"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="audit-p09-drawer-header">
              <div className="audit-p09-drawer-headings">
                <p className="audit-p09-drawer-kicker">DOCUMENTO ISO 9001 - CLÁUSULA 6.1</p>
                <h4>{"P09 - Riesgos y oportunidades"}</h4>
                <p>Gestion centralizada de DAFO, riesgos, oportunidades y acciones.</p>
              </div>
              <div className="audit-p09-drawer-right">
                <div className="audit-p09-drawer-meta">
                  <span className={`audit-p09-status-badge ${riskOpportunityCompleted ? "completed" : ""}`}>
                    {riskOpportunityCompleted ? "Completado" : "Pendiente"}
                  </span>
                  <p className="audit-p09-drawer-meta-line">
                    {riskOpportunityCompleted
                      ? `${riskOpportunityRevisionLabel || "-"} | ${riskOpportunityDocumentDate || "-"}`
                      : "Sin versión guardada"}
                  </p>
                </div>
                <button
                  type="button"
                  className="audit-p09-drawer-close"
                  onClick={closeRiskOpportunityPanel}
                  aria-label="Cerrar panel de riesgos y oportunidades"
                >
                  X
                </button>
              </div>
            </header>

            <div className="audit-p09-drawer-body">
              <section className="audit-risk-top-summary" aria-label="Resumen del documento 6.1">
                <article className="audit-risk-top-summary-card tone-weakness">
                  <p>Debilidades</p>
                  <strong>{riskOpportunityModalCounters.weaknessCount}</strong>
                </article>
                <article className="audit-risk-top-summary-card tone-threat">
                  <p>Amenazas</p>
                  <strong>{riskOpportunityModalCounters.threatCount}</strong>
                </article>
                <article className="audit-risk-top-summary-card tone-strength">
                  <p>Fortalezas</p>
                  <strong>{riskOpportunityModalCounters.strengthCount}</strong>
                </article>
                <article className="audit-risk-top-summary-card tone-opportunity">
                  <p>Oportunidades</p>
                  <strong>{riskOpportunityModalCounters.dafoOpportunityCount}</strong>
                </article>
                <article className="audit-risk-top-summary-card tone-neutral">
                  <p>Riesgos</p>
                  <strong>{riskOpportunityModalCounters.riskCount}</strong>
                </article>
                <article className="audit-risk-top-summary-card tone-neutral">
                  <p>Oportunidades generadas</p>
                  <strong>{riskOpportunityModalCounters.generatedOpportunityCount}</strong>
                </article>
                <article className="audit-risk-top-summary-card tone-neutral">
                  <p>Acciones</p>
                  <strong>{riskOpportunityModalCounters.actionCount}</strong>
                </article>
              </section>

              {isRiskOpportunityEditMode ? (
                <div className="audit-risk-doc-layout">
                  <article className="audit-p09-info-box">
                    <p className="audit-p09-info-title">Flujo automatizado P09</p>
                    <p>
                      {"El DAFO alimenta autom\u00e1ticamente los riesgos y oportunidades. La evaluaci\u00f3n"}
                      se calcula en tiempo real y las acciones quedan vinculadas a su referencia.
                    </p>
                  </article>

                  <section className="audit-risk-doc-section">
                    <header className="audit-risk-doc-section-header">
                      <h5>BLOQUE 1 - DAFO (ORIGEN)</h5>
                    </header>
                    <p className="soft-label">
                      Debilidades + Amenazas generan riesgos. Fortalezas + Oportunidades generan
                      oportunidades.
                    </p>
                    <div className="audit-risk-swot-grid">
                      {RISK_OPPORTUNITY_SWOT_SECTIONS.map((section) => {
                        const rows = riskOpportunityDraft.swotRows.filter(
                          (row) => row.swot_category === section.key
                        );
                        return (
                          <article
                            className={`audit-risk-doc-card audit-risk-swot-card audit-risk-swot-${section.key}`}
                            key={`swot-${section.key}`}
                          >
                            <header className="audit-risk-doc-card-header">
                              <h6>{section.title}</h6>
                              <div className="audit-risk-swot-card-actions">
                                <span className="audit-risk-swot-counter">{rows.length}</span>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={() => handleAddSwotRow(section.key)}
                                  disabled={riskOpportunitySaving}
                                >
                                  + Añadir elemento
                                </button>
                              </div>
                            </header>
                            {rows.length === 0 ? (
                              <p className="soft-label">Sin elementos registrados.</p>
                            ) : (
                              <div className="audit-risk-doc-list">
                                {rows.map((row) => (
                                  <div className="audit-risk-doc-row" key={row.id}>
                                    <textarea
                                      className="input-textarea"
                                      value={row.description}
                                      disabled={riskOpportunitySaving}
                                      onChange={(event) =>
                                        handleSwotRowChange(row.id, event.target.value)
                                      }
                                      placeholder={`Describe ${section.title.toLowerCase()}`}
                                    />
                                    <button
                                      type="button"
                                      className="btn-ghost"
                                      onClick={() => handleDeleteSwotRow(row.id)}
                                      disabled={riskOpportunitySaving}
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <section className="audit-risk-doc-section">
                    <header className="audit-risk-doc-section-header">
                      <h5>BLOQUE 2 - RIESGOS</h5>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={handleAddRiskRow}
                        disabled={riskOpportunitySaving}
                      >
                        + Añadir riesgo
                      </button>
                    </header>
                    {riskOpportunityDraft.riskRows.length === 0 ? (
                      <p className="soft-label">Sin riesgos registrados.</p>
                    ) : (
                      <div className="audit-risk-doc-list">
                        <div className="audit-risk-table-head">
                          <span>Proceso</span>
                          <span>Origen DAFO</span>
                          <span>Riesgo</span>
                          <span>Probabilidad</span>
                          <span>Severidad</span>
                          <span>Evaluación</span>
                        </div>
                        {riskOpportunityDraft.riskRows.map((row, index) => {
                          const evaluation = calculateRiskEvaluation(row.probability, row.severity);
                          return (
                            <article className="audit-risk-doc-card audit-risk-table-row" key={row.id}>
                              <header className="audit-risk-doc-card-header">
                                <h6>{`Riesgo ${index + 1}`}</h6>
                                <div className="audit-risk-row-meta">
                                  {row.source_label ? (
                                    <span className="audit-risk-origin-chip">{row.source_label}</span>
                                  ) : null}
                                  {row.is_auto_generated ? (
                                    <span className="soft-label">Autogenerado</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-ghost"
                                      onClick={() => handleDeleteRiskRow(row.id)}
                                      disabled={riskOpportunitySaving}
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </header>
                              <div className="audit-risk-doc-grid">
                                <label className="field-stack">
                                  <span>Proceso</span>
                                  <input
                                    className="input-text"
                                    value={row.process_name}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleRiskRowChange(row.id, "process_name", event.target.value)
                                    }
                                    placeholder="Proceso afectado"
                                  />
                                </label>
                                <label className="field-stack">
                                  <span>Origen DAFO</span>
                                  <input
                                    className="input-text"
                                    value={row.source_label || "Entrada manual"}
                                    disabled
                                  />
                                </label>
                                <label className="field-stack audit-risk-field-wide">
                                  <span>Riesgo</span>
                                  <textarea
                                    className="input-textarea"
                                    value={row.description}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleRiskRowChange(row.id, "description", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="field-stack">
                                  <span>Probabilidad</span>
                                  <select
                                    className="input-select"
                                    value={row.probability}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleRiskRowChange(row.id, "probability", event.target.value)
                                    }
                                  >
                                    {RISK_OPPORTUNITY_PROBABILITY_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field-stack">
                                  <span>Severidad</span>
                                  <select
                                    className="input-select"
                                    value={row.severity}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleRiskRowChange(row.id, "severity", event.target.value)
                                    }
                                  >
                                    {RISK_OPPORTUNITY_SEVERITY_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="audit-risk-calculation">
                                  <span className="soft-label">Evaluación</span>
                                  <p className={`audit-risk-evaluation-pill ${evaluation.tone}`}>
                                    {`${evaluation.label} (${evaluation.score})`}
                                  </p>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    <aside className="audit-risk-matrix" aria-label="Matriz de riesgo">
                      <header className="audit-risk-matrix-header">
                        <h6>Matriz de riesgo</h6>
                        <p className="soft-label">Resultado calculado por probabilidad y severidad.</p>
                      </header>
                      <div className="audit-risk-matrix-table-wrap">
                        <table className="audit-risk-matrix-table">
                          <thead>
                            <tr>
                              <th>Probabilidad \ Severidad</th>
                              <th>Ligero</th>
                              <th>Daño</th>
                              <th>Extremo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {["high", "medium", "low"].map((probability) => (
                              <tr key={`matrix-${probability}`}>
                                <th>
                                  {probability === "high"
                                    ? "Alta"
                                    : probability === "medium"
                                      ? "Media"
                                      : "Baja"}
                                </th>
                                {["slight", "harm", "extreme"].map((severity) => {
                                  const evaluation = calculateRiskEvaluation(probability, severity);
                                  return (
                                    <td
                                      key={`matrix-${probability}-${severity}`}
                                      className={`audit-risk-matrix-cell ${evaluation.tone}`}
                                    >
                                      {evaluation.label}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </aside>

                    <div className="audit-risk-legend-strip" aria-label="Leyenda de evaluación">
                      <span className="audit-risk-evaluation-pill trivial">Trivial</span>
                      <span className="audit-risk-evaluation-pill tolerable">Tolerable</span>
                      <span className="audit-risk-evaluation-pill moderate">Moderado</span>
                      <span className="audit-risk-evaluation-pill important">Importante</span>
                      <span className="audit-risk-evaluation-pill intolerable">Intolerable</span>
                    </div>
                  </section>

                  <section className="audit-risk-doc-section">
                    <header className="audit-risk-doc-section-header">
                      <h5>BLOQUE 3 - OPORTUNIDADES</h5>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={handleAddOpportunityRow}
                        disabled={riskOpportunitySaving}
                      >
                        + Añadir oportunidad
                      </button>
                    </header>
                    {riskOpportunityDraft.opportunityRows.length === 0 ? (
                      <p className="soft-label">Sin oportunidades registradas.</p>
                    ) : (
                      <div className="audit-risk-doc-list">
                        <div className="audit-risk-table-head opportunity">
                          <span>Proceso</span>
                          <span>Origen DAFO</span>
                          <span>Oportunidad</span>
                          <span>Viabilidad</span>
                          <span>Atractiva</span>
                          <span>Total / Resultado</span>
                        </div>
                        {riskOpportunityDraft.opportunityRows.map((row, index) => {
                          const evaluation = calculateOpportunityEvaluation(
                            row.viability,
                            row.attractiveness
                          );
                          return (
                            <article className="audit-risk-doc-card audit-risk-table-row" key={row.id}>
                              <header className="audit-risk-doc-card-header">
                                <h6>{`Oportunidad ${index + 1}`}</h6>
                                <div className="audit-risk-row-meta">
                                  {row.source_label ? (
                                    <span className="audit-risk-origin-chip">{row.source_label}</span>
                                  ) : null}
                                  {row.is_auto_generated ? (
                                    <span className="soft-label">Autogenerada</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-ghost"
                                      onClick={() => handleDeleteOpportunityRow(row.id)}
                                      disabled={riskOpportunitySaving}
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </header>
                              <div className="audit-risk-doc-grid">
                                <label className="field-stack">
                                  <span>Proceso</span>
                                  <input
                                    className="input-text"
                                    value={row.process_name}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleOpportunityRowChange(
                                        row.id,
                                        "process_name",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Proceso relacionado"
                                  />
                                </label>
                                <label className="field-stack">
                                  <span>Origen DAFO</span>
                                  <input
                                    className="input-text"
                                    value={row.source_label || "Entrada manual"}
                                    disabled
                                  />
                                </label>
                                <label className="field-stack audit-risk-field-wide">
                                  <span>Oportunidad</span>
                                  <textarea
                                    className="input-textarea"
                                    value={row.description}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleOpportunityRowChange(
                                        row.id,
                                        "description",
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>
                                <label className="field-stack">
                                  <span>Viabilidad</span>
                                  <select
                                    className="input-select"
                                    value={String(row.viability)}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleOpportunityRowChange(
                                        row.id,
                                        "viability",
                                        Number(event.target.value)
                                      )
                                    }
                                  >
                                    {RISK_OPPORTUNITY_VIABILITY_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field-stack">
                                  <span>Atractiva</span>
                                  <select
                                    className="input-select"
                                    value={String(row.attractiveness)}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleOpportunityRowChange(
                                        row.id,
                                        "attractiveness",
                                        Number(event.target.value)
                                      )
                                    }
                                  >
                                    {RISK_OPPORTUNITY_VIABILITY_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="audit-risk-calculation">
                                  <span className="soft-label">Total</span>
                                  <p>{evaluation.total}</p>
                                  <p className={`audit-risk-evaluation-pill ${evaluation.tone}`}>
                                    {evaluation.label}
                                  </p>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                    <div className="audit-risk-legend-block" aria-label="Leyenda de oportunidades">
                      <p className="soft-label">Equivalencia de escalas</p>
                      <div className="audit-risk-legend-grid">
                        <span>Baja = 1</span>
                        <span>Media = 3</span>
                        <span>Alta = 5</span>
                        <span>Nada atractiva = 1</span>
                        <span>Atractiva = 3</span>
                        <span>Muy atractiva = 5</span>
                      </div>
                    </div>
                  </section>

                  <section className="audit-risk-doc-section">
                    <header className="audit-risk-doc-section-header">
                      <h5>BLOQUE 4 - ACCIONES</h5>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={handleAddFollowUpRow}
                        disabled={riskOpportunitySaving}
                      >
                        + Añadir acción
                      </button>
                    </header>
                    {riskOpportunityDraft.followUpRows.length === 0 ? (
                      <p className="soft-label">Sin acciones registradas.</p>
                    ) : (
                      <div className="audit-risk-doc-list">
                        <div className="audit-risk-table-head actions">
                          <span>Referencia</span>
                          <span>Tipo</span>
                          <span>Accion</span>
                          <span>Indicador</span>
                          <span>Plazo previsto</span>
                          <span>Objetivo asociado</span>
                          <span>Resultado</span>
                        </div>
                        {riskOpportunityDraft.followUpRows.map((row, index) => {
                          const availableReferences = riskOpportunityReferenceOptions.filter(
                            (option) =>
                              !row.reference_kind || option.kind === String(row.reference_kind || "")
                          );
                          const resultBadge = getActionResultBadge(row.result);
                          const hasIncompleteReference =
                            String(row.action || "").trim() &&
                            (!String(row.reference_kind || "").trim() ||
                              !String(row.reference_row_id || "").trim());
                          return (
                            <article className="audit-risk-doc-card audit-risk-table-row" key={row.id}>
                              <header className="audit-risk-doc-card-header">
                                <h6>{`Accion ${index + 1}`}</h6>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={() => handleDeleteFollowUpRow(row.id)}
                                  disabled={riskOpportunitySaving}
                                >
                                  Eliminar
                                </button>
                              </header>
                              <div className="audit-risk-doc-grid">
                                <label className="field-stack">
                                  <span>Referencia</span>
                                  <select
                                    className="input-select"
                                    value={row.reference_kind || ""}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) => {
                                      handleFollowUpRowChange(
                                        row.id,
                                        "reference_kind",
                                        event.target.value
                                      );
                                      handleFollowUpRowChange(row.id, "reference_row_id", "");
                                    }}
                                  >
                                    <option value="">Selecciona tipo</option>
                                    <option value={RISK_OPPORTUNITY_REFERENCE_TYPES.RISK}>Riesgo</option>
                                    <option value={RISK_OPPORTUNITY_REFERENCE_TYPES.OPPORTUNITY}>
                                      Oportunidad
                                    </option>
                                  </select>
                                </label>
                                <label className="field-stack">
                                  <span>Elemento vinculado</span>
                                  <select
                                    className="input-select"
                                    value={row.reference_row_id || ""}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleFollowUpRowChange(
                                        row.id,
                                        "reference_row_id",
                                        event.target.value
                                      )
                                    }
                                  >
                                    <option value="">Selecciona referencia</option>
                                    {availableReferences.map((option) => (
                                      <option key={`${option.kind}-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field-stack audit-full-width">
                                  <span>Accion</span>
                                  <textarea
                                    className="input-textarea"
                                    value={row.action}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleFollowUpRowChange(row.id, "action", event.target.value)
                                    }
                                    placeholder="Describe la accion definida"
                                  />
                                </label>
                                <label className="field-stack">
                                  <span>Tipo</span>
                                  <select
                                    className="input-select"
                                    value={row.action_type || ""}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleFollowUpRowChange(
                                        row.id,
                                        "action_type",
                                        event.target.value
                                      )
                                    }
                                  >
                                    <option value="">Selecciona tipo</option>
                                    {RISK_OPPORTUNITY_ACTION_TYPE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field-stack">
                                  <span>Indicador</span>
                                  <select
                                    className="input-select"
                                    value={row.indicator}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleFollowUpRowChange(row.id, "indicator", event.target.value)
                                    }
                                  >
                                    {RISK_OPPORTUNITY_YES_NO_OPTIONS.map((option) => (
                                      <option key={`indicator-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field-stack">
                                  <span>Objetivo asociado</span>
                                  <select
                                    className="input-select"
                                    value={row.objective_associated}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleFollowUpRowChange(
                                        row.id,
                                        "objective_associated",
                                        event.target.value
                                      )
                                    }
                                  >
                                    {RISK_OPPORTUNITY_YES_NO_OPTIONS.map((option) => (
                                      <option key={`objective-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="field-stack">
                                  <span>Plazo</span>
                                  <input
                                    className="input-text"
                                    type="date"
                                    value={row.due_date}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleFollowUpRowChange(row.id, "due_date", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="field-stack">
                                  <span>Resultado</span>
                                  <select
                                    className="input-select"
                                    value={row.result}
                                    disabled={riskOpportunitySaving}
                                    onChange={(event) =>
                                      handleFollowUpRowChange(row.id, "result", event.target.value)
                                    }
                                  >
                                    {RISK_OPPORTUNITY_ACTION_RESULT_OPTIONS.map((option) => (
                                      <option key={`result-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <span className={`audit-action-result-badge ${resultBadge.tone}`}>
                                    {resultBadge.label}
                                  </span>
                                </label>
                              </div>
                              {hasIncompleteReference ? (
                                <p className="audit-p09-validation-error">
                                  Selecciona referencia de riesgo u oportunidad para esta accion.
                                </p>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    )}
                    <div className="audit-risk-legend-block" aria-label="Leyenda de tipos de accion">
                      <p className="soft-label">Tipos de accion</p>
                      <div className="audit-risk-action-types">
                        {["OBJ", "COS", "GES", "FOR", "INF", "AC", "INV", "CAM", "OTRA"].map((typeCode) => (
                          <span key={`action-type-${typeCode}`}>{typeCode}</span>
                        ))}
                      </div>
                    </div>
                  </section>

                  {riskOpportunityValidationError ? (
                    <p className="audit-p09-validation-error">{riskOpportunityValidationError}</p>
                  ) : null}
                </div>
              ) : (
                <div className="audit-risk-doc-layout">
                  {riskOpportunityRegisteredCount === 0 ? (
                    <p className="empty-state">No hay datos guardados para mostrar.</p>
                  ) : (
                    <>
                      <section className="audit-risk-doc-section">
                        <header className="audit-risk-doc-section-header">
                          <h5>BLOQUE 1 - DAFO</h5>
                        </header>
                        <div className="audit-risk-doc-summary-grid">
                          {RISK_OPPORTUNITY_SWOT_SECTIONS.map((section) => {
                            const rows = riskOpportunitySavedDraft.swotRows.filter(
                              (row) =>
                                row.swot_category === section.key &&
                                String(row.description || "").trim()
                            );
                            return (
                              <article className="audit-risk-doc-card" key={`summary-swot-${section.key}`}>
                                <h6>{section.title}</h6>
                                {rows.length === 0 ? (
                                  <p className="soft-label">Sin elementos.</p>
                                ) : (
                                  <ul className="audit-risk-doc-bullets">
                                    {rows.map((row) => (
                                      <li key={row.id}>{row.description}</li>
                                    ))}
                                  </ul>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </section>

                      <section className="audit-risk-doc-section">
                        <header className="audit-risk-doc-section-header">
                          <h5>BLOQUE 2 - RIESGOS</h5>
                        </header>
                        <div className="audit-risk-doc-summary-grid">
                          {riskOpportunitySavedDraft.riskRows
                            .filter((row) => String(row.description || "").trim())
                            .map((row) => {
                              const evaluation = calculateRiskEvaluation(row.probability, row.severity);
                              return (
                                <article className="audit-risk-doc-card" key={`summary-risk-${row.id}`}>
                                  <p className="soft-label">{`Proceso: ${row.process_name || "-"}`}</p>
                                  <p>{row.description}</p>
                                  <p className={`audit-risk-evaluation-pill ${evaluation.tone}`}>
                                    {`${evaluation.label} (${evaluation.score})`}
                                  </p>
                                </article>
                              );
                            })}
                        </div>
                      </section>

                      <section className="audit-risk-doc-section">
                        <header className="audit-risk-doc-section-header">
                          <h5>BLOQUE 3 - OPORTUNIDADES</h5>
                        </header>
                        <div className="audit-risk-doc-summary-grid">
                          {riskOpportunitySavedDraft.opportunityRows
                            .filter((row) => String(row.description || "").trim())
                            .map((row) => {
                              const evaluation = calculateOpportunityEvaluation(
                                row.viability,
                                row.attractiveness
                              );
                              return (
                                <article className="audit-risk-doc-card" key={`summary-opportunity-${row.id}`}>
                                  <p className="soft-label">{`Proceso: ${row.process_name || "-"}`}</p>
                                  <p>{row.description}</p>
                                  <p className="soft-label">{`Viabilidad: ${row.viability} | Atractiva: ${row.attractiveness}`}</p>
                                  <p className={`audit-risk-evaluation-pill ${evaluation.tone}`}>
                                    {`${evaluation.label} (${evaluation.total})`}
                                  </p>
                                </article>
                              );
                            })}
                        </div>
                      </section>

                      <section className="audit-risk-doc-section">
                        <header className="audit-risk-doc-section-header">
                          <h5>BLOQUE 4 - ACCIONES</h5>
                        </header>
                        <div className="audit-risk-doc-summary-grid">
                          {riskOpportunitySavedDraft.followUpRows
                            .filter(
                              (row) =>
                                String(row.action || "").trim() ||
                                String(row.due_date || "").trim()
                            )
                            .map((row) => {
                              const referenceLabel = (() => {
                                const referenceId = String(row.reference_row_id || "").trim();
                                const referenceKind = String(row.reference_kind || "").trim().toLowerCase();
                                if (!referenceId || !referenceKind) return "-";
                                if (referenceKind === RISK_OPPORTUNITY_REFERENCE_TYPES.RISK) {
                                  const target = riskOpportunitySavedDraft.riskRows.find(
                                    (item) => String(item.id) === referenceId
                                  );
                                  return target?.description || "-";
                                }
                                const target = riskOpportunitySavedDraft.opportunityRows.find(
                                  (item) => String(item.id) === referenceId
                                );
                                return target?.description || "-";
                              })();
                              const resultBadge = getActionResultBadge(row.result);
                              return (
                                <article className="audit-risk-doc-card" key={`summary-followup-${row.id}`}>
                                  <span className={`audit-action-result-badge ${resultBadge.tone}`}>
                                    {resultBadge.label}
                                  </span>
                                  <p className="soft-label">{`Referencia: ${referenceLabel}`}</p>
                                  <p>{row.action || "-"}</p>
                                  <p className="soft-label">{`Tipo: ${row.action_type || "-"}`}</p>
                                  <p className="soft-label">{`Indicador: ${normalizeYesNoValue(row.indicator) === "yes" ? "Sí" : "No"}`}</p>
                                  <p className="soft-label">{`Objetivo asociado: ${normalizeYesNoValue(row.objective_associated) === "yes" ? "Sí" : "No"}`}</p>
                                  <p className="soft-label">{`Plazo: ${normalizeP09DateLabel(row.due_date) || "-"}`}</p>
                                </article>
                              );
                            })}
                        </div>
                      </section>
                    </>
                  )}
                </div>
              )}
            </div>

            <footer className="audit-p09-drawer-footer">
              {isRiskOpportunityEditMode ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCancelRiskOpportunityEdition}
                    disabled={riskOpportunitySaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={disabled || riskOpportunitySaving || riskOpportunityLoading}
                    onClick={handleSaveRiskOpportunityEdition}
                  >
                    {riskOpportunitySaving ? "Guardando..." : "Guardar documento"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={closeRiskOpportunityPanel}
                  disabled={riskOpportunitySaving}
                >
                  Cerrar
                </button>
              )}
            </footer>
          </aside>
        </div>
      ) : null}

      <p className="soft-label">
        {sectionTitle ? `Campos guiados para ${sectionTitle}.` : "Campos guiados de la seccion."}
      </p>
    </div>
  );
}

export default AuditGuidedFields;

