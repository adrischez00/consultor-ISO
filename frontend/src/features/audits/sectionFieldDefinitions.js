function toTitleCase(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const TOKEN_LABELS = {
  manual: "manual",
  quality: "calidad",
  revision: "revisión",
  date: "fecha",
  context: "contexto",
  document: "documento",
  code: "código",
  external: "externas",
  internal: "internas",
  issues: "cuestiones",
  summary: "resumen",
  climate: "clima",
  change: "cambio",
  relevant: "relevante",
  notes: "notas",
  interested: "interesadas",
  parties: "partes",
  detected: "detectadas",
  detail: "detalle",
  scope: "alcance",
  current: "actual",
  text: "texto",
  changed: "cambio",
  reason: "motivo",
  process: "proceso",
  map: "mapa",
  updated: "actualizado",
  sgc: "SGC",
  inputs: "entradas",
  outputs: "salidas",
  defined: "definidos",
  top: "alta",
  management: "dirección",
  involvement: "implicación",
  leadership: "liderazgo",
  evidence: "evidencias",
  policy: "política",
  includes: "incluye",
  responsible: "responsable",
  name: "nombre",
  roles: "roles",
  org: "organigrama",
  chart: "organigrama",
  changes: "cambios",
  swot: "DAFO",
  risk: "riesgos",
  assessment: "evaluación",
  weaknesses: "debilidades",
  strengths: "fortalezas",
  threats: "amenazas",
  opportunities: "oportunidades",
  actions: "acciones",
  objectives: "objetivos",
  reference: "referencia",
  measurable: "medibles",
  review: "revisión",
  planned: "planificada",
  method: "método",
  extraordinary: "extraordinarios",
  previous: "anteriores",
  employee: "empleados",
  partner: "socios",
  staff: "personal",
  resources: "recursos",
  sufficient: "suficientes",
  personnel: "personal",
  competent: "competente",
  structure: "estructura",
  infrastructure: "infraestructura",
  status: "estado",
  maintenance: "mantenimiento",
  vehicles: "vehículos",
  equipment: "equipos",
  work: "trabajo",
  environment: "entorno",
  prl: "PRL",
  provider: "servicio",
  compliance: "cumplimiento",
  time: "tiempo",
  tracking: "seguimiento",
  tool: "herramienta",
  measurement: "medición",
  tools: "herramientas",
  organizational: "organizacional",
  knowledge: "conocimiento",
  managed: "gestionado",
  job: "puestos",
  profiles: "perfiles",
  training: "formación",
  awareness: "sensibilización",
  communication: "comunicación",
  channels: "canales",
  last: "última",
  meeting: "reunión",
  topics: "temas",
  control: "control",
  documents: "documentos",
  accessible: "accesibles",
  operational: "operacional",
  customer: "cliente",
  requirements: "requisitos",
  contracts: "contratos",
  service: "servicio",
  supplier: "proveedor",
  evaluation: "evaluación",
  average: "media",
  criteria: "criterios",
  certifications: "certificaciones",
  requested: "solicitadas",
  sample: "muestra",
  project: "proyecto",
  budget: "presupuesto",
  contract: "contrato",
  invoice: "factura",
  payment: "pago",
  terms: "plazos",
  legal: "legales",
  sources: "fuentes",
  extinguishers: "extintores",
  reviewed: "revisados",
  result: "resultado",
  release: "liberación",
  nonconformities: "no conformidades",
  count: "cantidad",
  indicators: "indicadores",
  acceptance: "aceptación",
  target: "objetivo",
  turnover: "facturación",
  surveys: "encuestas",
  sent: "enviadas",
  response: "respuesta",
  rate: "tasa",
  overall: "global",
  recommendation: "recomendación",
  delivery: "entrega",
  deadlines: "plazos",
  customers: "clientes",
  responded: "respondieron",
  list: "listado",
  feedback: "satisfacción",
  annual: "anual",
  audit: "auditoría",
  program: "programa",
  improvement: "mejora",
  system: "sistema",
  procedure: "procedimiento",
  exists: "existe",
  corrective: "correctivas",
  followed: "seguimiento",
  continuous: "continua",
  mechanism: "mecanismo",
  outputs: "salidas",
  used: "utilizadas",
  for: "para",
};

const BOOLEAN_FIELD_CODES = new Set([
  "climate_change_relevant",
  "new_interested_parties_detected",
  "climate_change_in_interested_parties",
  "scope_changed",
  "process_map_updated",
  "sgc_processes_defined",
  "process_inputs_outputs_defined",
  "quality_policy_updated",
  "quality_policy_includes_climate_change",
  "quality_policy_available",
  "quality_policy_coherent",
  "roles_defined",
  "org_chart_updated",
  "staff_aware_of_roles",
  "management_resources_adequate",
  "sgc_integrated_in_business",
  "s512_requirements_met",
  "s512_feedback_tracked",
  "objectives_are_measurable",
  "extraordinary_changes_exist",
  "resources_sufficient",
  "documents_accessible",
  "organizational_knowledge_managed",
  "planned_work_control_exists",
  "customer_requirements_defined",
  "contracts_used",
  "suppliers_certifications_requested",
  "vehicles_included",
  "equipment_included",
  "extinguishers_reviewed",
  "vehicle_extinguishers_in_contract",
  "service_release_control_exists",
  "supplier_nc_exists",
  "internal_nc_exists",
  "corrective_actions_followed",
  "management_review_outputs_used_for_improvement",
]);

const LIST_FIELD_CODES = new Set([
  "previous_objectives",
  "current_objectives",
]);

const JSON_FIELD_CODES = new Set([
  "performance_indicators_matrix",
  "s5_objective_evidence",
  "s5_guided_answers",
  "quality_objectives_matrix",
  "planned_changes_log",
  "s6_guided_answers",
  "competence_training_matrix",
  "communication_matrix",
  "s7_guided_answers",
  "document_traceability_matrix",
  "s8_guided_answers",
  "s9_guided_answers",
]);

const NUMBER_FIELD_CODES = new Set([
  "employee_count",
  "partner_count",
  "supplier_evaluation_count",
  "supplier_average_score",
  "nonconformities_count",
  "customer_satisfaction_surveys_count",
  "customer_satisfaction_response_rate",
  "customer_satisfaction_global_score",
]);

const SELECT_FIELD_CODES = {
  personnel_competent: {
    options: [
      { value: "yes", label: "Sí" },
      { value: "partial", label: "Parcial" },
      { value: "no", label: "No" },
    ],
  },
  sample_payment_terms: {
    options: [
      { value: "cash", label: "Contado" },
      { value: "30_days", label: "30 días" },
      { value: "60_days", label: "60 días" },
      { value: "other", label: "Otro" },
    ],
  },
  internal_audit_program_exists: {
    options: [
      { value: "yes", label: "Sí" },
      { value: "no", label: "No" },
    ],
  },
};

const REQUIRED_FIELD_CODES = new Set([
  "manual_quality_revision",
  "external_issues_summary",
  "scope_current_text",
  "top_management_involvement_summary",
  "quality_policy_revision",
  "objectives_reference_document",
  "employee_count",
  "resources_sufficient",
  "operational_control_summary",
  "supplier_control_summary",
  "performance_indicators_matrix",
  "improvement_system_summary",
]);

const HELP_TEXT_BY_FIELD = {
  previous_objectives: "Registra objetivos del periodo anterior (uno por linea).",
  current_objectives: "Registra objetivos vigentes del periodo actual (uno por linea).",
  performance_indicators_matrix:
    "El estado se calcula automáticamente por fila: Cumple, No cumple o En progreso.",
  customer_satisfaction_global_score: "Escala sugerida de 0 a 10.",
  customer_satisfaction_response_rate: "Introduce porcentaje de respuesta (0-100).",
  context_document_code: "Autogenerado desde el documento P09 de contexto.",
  context_document_revision: "Autogenerado desde el documento P09 de contexto.",
  context_document_date: "Autogenerado desde el documento P09 de contexto.",
  interested_parties_document_code: "Autogenerado desde el documento P09 de partes interesadas.",
  interested_parties_revision: "Autogenerado desde el documento P09 de partes interesadas.",
  interested_parties_date: "Autogenerado desde el documento P09 de partes interesadas.",
  top_management_involvement_summary:
    "Resume la implicación activa de la dirección: participación en revisiones, comunicación interna, toma de decisiones y asignación de recursos.",
  leadership_evidence_summary:
    "Cita evidencias concretas observadas: actas de revisión por la dirección, comunicaciones, objetivos establecidos, recursos asignados...",
  s512_satisfaction_summary:
    "Describe el estado de la satisfacción del cliente: encuestas, resultados, tendencias y acciones derivadas.",
  s512_complaints_summary:
    "Registra las reclamaciones o incidencias del periodo: cantidad, tipología y estado de resolución.",
  s512_communication_notes:
    "Describe los canales de comunicación cliente-organización: comercial, posventa, gestión de incidencias...",
  s512_customer_risks_summary:
    "Riesgos identificados asociados a incumplimientos de requisitos o expectativas del cliente.",
  s512_evidence_notes:
    "Evidencias documentales revisadas en relación al enfoque al cliente: encuestas, registros de reclamaciones, indicadores comerciales...",
  s5_objective_evidence:
    "Selecciona las evidencias documentales revisadas durante la auditoría de esta sección. Se incorporarán al texto final del informe.",
  s5_guided_answers:
    "Respuestas del auditor a las preguntas guiadas por cláusula de la sección 5. Almacena estado (sí/parcial/no/na) y comentario opcional por pregunta.",
  s6_guided_answers:
    "Respuestas del auditor a las preguntas guiadas por cláusula de la sección 6 (6.1, 6.2, 6.3). Mismo patrón que s5_guided_answers.",
  s7_guided_answers:
    "Respuestas del auditor a las preguntas guiadas por cláusula de la sección 7 (7.1–7.5). Almacena estado (sí/parcial/no/na) y comentario opcional por pregunta.",
  competence_training_matrix:
    "Registro de competencias, formación y estado de validez por persona y puesto (7.2). Cada fila incluye persona, rol, competencia requerida, formación recibida, evidencia y estado.",
  communication_matrix:
    "Registro de canales de comunicación interna y externa (7.4). Cada fila incluye tema, destinatario, canal, frecuencia, responsable y evidencia.",
  awareness_actions_notes:
    "Acciones realizadas para asegurar la toma de conciencia del personal sobre la política, objetivos y contribución al SGC.",
  quality_objectives_matrix:
    "Matriz de objetivos de calidad del periodo (6.2). Cada fila incluye objetivo, indicador, meta, resultado, estado, responsable, plazo, evidencia y acciones correctivas.",
  planned_changes_log:
    "Registro de cambios planificados o realizados en el SGC (6.3). Cada fila incluye descripción, tipo, motivo, impacto, responsable, estado, fecha y evidencia.",
  quality_policy_change_summary:
    "Describe los cambios realizados respecto a la versión anterior: nueva redacción, nuevos compromisos, actualización de objetivos...",
  roles_changes_summary:
    "Describe cambios en la estructura organizativa, nuevas responsabilidades asignadas o modificaciones al organigrama.",
  s8_guided_answers:
    "Respuestas del auditor a las preguntas guiadas por cláusula de la sección 8 (8.1, 8.2, 8.4, 8.6, 8.7). Almacena estado (sí/parcial/no/na) y comentario opcional por pregunta.",
  document_traceability_matrix:
    "Matriz de trazabilidad documental de la muestra auditada (8.x). Cada fila incluye tipo de documento, referencia, fecha, estado de verificación y observaciones.",
  supplier_average_score: "Valoración media obtenida en la evaluación de proveedores, en escala 0–10.",
  s9_guided_answers:
    "Respuestas del auditor a las preguntas guiadas por cláusula de la sección 9 (9.1, 9.1.2, 9.2 y 9.3). Almacena estado (sí/parcial/no/na) y comentario opcional por pregunta.",
};

const LABEL_OVERRIDES = {
  manual_quality_revision: "Revisión del manual de calidad",
  manual_quality_date: "Fecha del manual de calidad",
  context_document_code: "Codigo del documento de contexto",
  context_document_revision: "Revisión del documento de contexto",
  context_document_date: "Fecha del documento de contexto",
  interested_parties_document_code: "Codigo documento partes interesadas",
  interested_parties_revision: "Revisión documento partes interesadas",
  interested_parties_date: "Fecha documento partes interesadas",
  external_issues_summary: "Cuestiones externas (resumen)",
  internal_issues_summary: "Cuestiones internas (resumen)",
  climate_change_relevant: "Cambio climatico considerado",
  climate_change_notes: "Cambio climatico - detalle",
  new_interested_parties_detected: "Nuevas partes interesadas detectadas",
  new_interested_parties_detail: "Detalle de nuevas partes interesadas",
  climate_change_in_interested_parties: "Cambio climatico en partes interesadas",
  scope_current_text: "Alcance actual del sistema",
  scope_changed: "Alcance con cambios",
  scope_change_reason: "Motivo del cambio de alcance",
  process_map_updated: "Mapa de procesos actualizado",
  process_map_date: "Fecha de actualizacion del mapa de procesos",
  process_map_change_summary: "Resumen de cambios del mapa de procesos",
  sgc_processes_defined: "Procesos del SGC definidos",
  process_inputs_outputs_defined: "Entradas y salidas de procesos definidas",
  internal_audit_plan_date: "Fecha plan de auditoría interna",
  performance_indicators_matrix: "Matriz de indicadores de desempeño",
  customer_satisfaction_surveys_count: "Nº encuestas",
  customer_satisfaction_response_rate: "Tasa de respuesta (%)",
  customer_satisfaction_global_score: "Score global (0-10)",
  customer_satisfaction_recommendation: "Recomendación",
  internal_audit_program_exists: "Existe programa anual",
  internal_audit_summary: "Resumen auditoría interna",
  management_review_date: "Fecha revisión por la dirección",
  management_review_summary: "Resumen revisión por la dirección",
  performance_conclusions_summary: "Conclusiones del desempeño",
  performance_trends_summary: "Tendencias",
  performance_deviations_summary: "Desviaciones detectadas",
  improvement_system_summary: "Resumen del sistema de mejora",
  improvement_opportunities_summary: "Oportunidades de mejora",
  nonconformities_procedure_reference: "Referencia procedimiento de no conformidades",
  supplier_nc_exists: "Existen NC de proveedor",
  supplier_nc_summary: "Resumen NC de proveedor",
  internal_nc_exists: "Existen NC internas",
  internal_nc_summary: "Resumen NC internas",
  corrective_actions_followed: "Acciones correctivas con seguimiento",
  continuous_improvement_mechanism_summary: "Mecanismo de mejora continua",
  management_review_outputs_used_for_improvement: "Salidas de revisión usadas para mejorar",
  // Sección 5 — nuevos campos
  top_management_involvement_summary: "Implicación de la alta dirección",
  leadership_evidence_summary: "Evidencias de liderazgo observadas",
  management_resources_adequate: "Recursos asignados adecuadamente",
  sgc_integrated_in_business: "SGC integrado en procesos de negocio",
  s512_satisfaction_summary: "Evaluación de satisfacción del cliente",
  s512_complaints_summary: "Reclamaciones e incidencias del periodo",
  s512_requirements_met: "Requisitos del cliente cumplidos",
  s512_feedback_tracked: "Seguimiento de feedback activo",
  s512_communication_notes: "Canales de comunicación con el cliente",
  s512_customer_risks_summary: "Riesgos relacionados con el cliente",
  s512_evidence_notes: "Evidencias de enfoque al cliente revisadas",
  quality_policy_available: "Política disponible y comunicada al personal",
  quality_policy_coherent: "Coherente con el contexto y dirección estratégica",
  staff_aware_of_roles: "El personal conoce sus funciones y autoridades",
  s5_objective_evidence: "Evidencias objetivas revisadas (§5)",
  quality_objectives_matrix: "Matriz de objetivos de calidad (§6.2)",
  planned_changes_log: "Registro de cambios del SGC (§6.3)",
  s6_guided_answers: "Respuestas guiadas del auditor (§6)",
  s7_guided_answers: "Respuestas guiadas del auditor (§7)",
  competence_training_matrix: "Matriz de competencias y formación (§7.2)",
  communication_matrix: "Matriz de comunicación (§7.4)",
  awareness_actions_notes: "Observaciones de toma de conciencia",
  s8_guided_answers: "Respuestas guiadas del auditor (§8)",
  document_traceability_matrix: "Matriz de trazabilidad documental (§8)",
  supplier_average_score: "Valoración media de proveedores",
  s9_guided_answers: "Respuestas guiadas del auditor (§9)",
};

const PLACEHOLDER_OVERRIDES = {
  top_management_involvement_summary:
    "Ej: La dirección participa en revisiones periódicas, establece objetivos, asigna recursos y asegura la comunicación interna del SGC...",
  leadership_evidence_summary:
    "Ej: Acta de revisión por la dirección (RD-2024-01), correos de comunicación de objetivos, registro de asignación de recursos...",
  s512_satisfaction_summary:
    "Ej: Se realizaron 12 encuestas con un score medio de 8,4/10. Tendencia positiva respecto al ejercicio anterior...",
  s512_complaints_summary:
    "Ej: 3 reclamaciones registradas en el periodo. Todas resueltas en plazo. Sin NC derivadas...",
  s512_communication_notes:
    "Ej: Canal comercial, email de incidencias, encuesta anual de satisfacción, reuniones de seguimiento de contrato...",
  s512_customer_risks_summary:
    "Ej: Riesgo de incumplimiento de plazo en proyecto X por dependencia de proveedor crítico. Acciones preventivas definidas...",
  s512_evidence_notes:
    "Ej: Encuesta satisfacción 2024, registro de reclamaciones Q1-Q3, actas de reunión con cliente principal...",
  quality_policy_change_summary:
    "Ej: Se actualizó el punto 3 para incluir compromisos relacionados con cambio climático, en línea con la revisión ISO 9001:2024...",
  roles_changes_summary:
    "Ej: Se incorporó la figura de Responsable de Calidad con dedicación parcial. Organigrama actualizado en enero 2024...",
  quality_system_responsible_name: "Nombre y apellidos del responsable del SGC",
  roles_document_reference: "Ej: P05 Descripción de puestos de trabajo, Rev. 3",
  org_chart_reference: "Ej: Organigrama corporativo, versión vigente en intranet",
  quality_policy_revision: "Ej: Rev. 4",
};

function inferFieldType(fieldCode) {
  if (BOOLEAN_FIELD_CODES.has(fieldCode)) return "boolean";
  if (LIST_FIELD_CODES.has(fieldCode)) return "list";
  if (JSON_FIELD_CODES.has(fieldCode)) return "json";
  if (NUMBER_FIELD_CODES.has(fieldCode)) return "number";
  if (fieldCode.endsWith("_date")) return "date";
  if (Object.prototype.hasOwnProperty.call(SELECT_FIELD_CODES, fieldCode)) return "select";
  if (
    fieldCode.endsWith("_summary") ||
    fieldCode.endsWith("_notes") ||
    fieldCode.endsWith("_detail") ||
    fieldCode.endsWith("_text") ||
    fieldCode.endsWith("_reason")
  ) {
    return "textarea";
  }
  return "text";
}

function codeToLabel(fieldCode) {
  if (LABEL_OVERRIDES[fieldCode]) return LABEL_OVERRIDES[fieldCode];
  const words = fieldCode
    .split("_")
    .map((word) => TOKEN_LABELS[word] || word)
    .join(" ");
  return toTitleCase(words);
}

function createField(fieldGroup, fieldCode, index) {
  const type = inferFieldType(fieldCode);
  const selectConfig = SELECT_FIELD_CODES[fieldCode];
  const placeholder =
    PLACEHOLDER_OVERRIDES[fieldCode] ||
    (type === "textarea"
      ? "Describe la evidencia observada..."
      : type === "date"
        ? "Selecciona fecha"
        : type === "number"
          ? "Introduce valor numérico"
          : type === "list"
            ? "Añade un valor"
            : "Introduce valor");

  return {
    field_group: fieldGroup,
    field_code: fieldCode,
    label: codeToLabel(fieldCode),
    type,
    placeholder,
    required: REQUIRED_FIELD_CODES.has(fieldCode),
    help_text: HELP_TEXT_BY_FIELD[fieldCode] || "",
    options: selectConfig?.options || [],
    repeatable: type === "list",
    field_mode: type === "list" ? "repeatable" : "simple",
    sort_order: index,
  };
}

function buildGroup(fieldGroup, title, description, fieldCodes) {
  return {
    field_group: fieldGroup,
    title,
    description,
    fields: fieldCodes.map((fieldCode, index) => createField(fieldGroup, fieldCode, index)),
  };
}

function withFlatFields(config) {
  const groups = config.groups || [];
  const flat_fields = groups.flatMap((group) => group.fields);
  return { ...config, flat_fields };
}

export const sectionFieldDefinitions = {
  "4": withFlatFields({
    section_code: "4",
    section_title: "Contexto de la organización",
    groups: [
      buildGroup(
        "analisis_contexto",
        "4.1 Analisis del contexto",
        "Completa el documento P09 de contexto y resume cuestiones externas e internas.",
        [
          "context_document_code",
          "context_document_revision",
          "context_document_date",
          "external_issues_summary",
          "internal_issues_summary",
          "climate_change_relevant",
          "climate_change_notes",
        ]
      ),
      buildGroup(
        "partes_interesadas",
        "4.2 Necesidades y expectativas de las partes interesadas",
        "Documento P09 de partes interesadas (fuente principal de la cláusula 4.2).",
        [
          "interested_parties_document_code",
          "interested_parties_revision",
          "interested_parties_date",
          "new_interested_parties_detected",
          "new_interested_parties_detail",
          "climate_change_in_interested_parties",
        ]
      ),
      buildGroup(
        "documentacion_contexto",
        "4.3 Alcance del sistema de gestion",
        "Registra alcance vigente, cambios aplicados y trazabilidad del manual de calidad.",
        [
          "manual_quality_revision",
          "manual_quality_date",
          "scope_current_text",
          "scope_changed",
          "scope_change_reason",
        ]
      ),
      buildGroup(
        "procesos_sgc",
        "4.4 Sistema de gestion de calidad y procesos",
        "Confirma actualizacion del mapa de procesos y definicion de entradas y salidas.",
        [
          "process_map_updated",
          "process_map_date",
          "process_map_change_summary",
          "sgc_processes_defined",
          "process_inputs_outputs_defined",
        ]
      ),
    ],
  }),
  "5": withFlatFields({
    section_code: "5",
    section_title: "Liderazgo",
    groups: [
      buildGroup(
        "liderazgo_direccion",
        "5.1 Liderazgo y compromiso",
        "Verifica la implicación activa de la alta dirección en el mantenimiento y mejora del SGC.",
        [
          "top_management_involvement_summary",
          "leadership_evidence_summary",
          "management_resources_adequate",
          "sgc_integrated_in_business",
        ]
      ),
      buildGroup(
        "enfoque_cliente",
        "5.1.2 Enfoque al cliente",
        "Verifica que la dirección asegura el cumplimiento de requisitos del cliente y el seguimiento de su satisfacción.",
        [
          "s512_satisfaction_summary",
          "s512_requirements_met",
          "s512_feedback_tracked",
          "s512_complaints_summary",
          "s512_communication_notes",
          "s512_customer_risks_summary",
          "s512_evidence_notes",
        ]
      ),
      buildGroup(
        "politica_calidad",
        "5.2 Política de calidad",
        "Estado, vigencia, coherencia y comunicación de la política de calidad.",
        [
          "quality_policy_revision",
          "quality_policy_date",
          "quality_policy_updated",
          "quality_policy_available",
          "quality_policy_coherent",
          "quality_policy_includes_climate_change",
          "quality_policy_change_summary",
        ]
      ),
      buildGroup(
        "roles_organizacion",
        "5.3 Roles, responsabilidades y autoridades",
        "Verifica la definición, comunicación y conocimiento de roles y autoridades en el SGC.",
        [
          "quality_system_responsible_name",
          "roles_defined",
          "roles_document_reference",
          "org_chart_reference",
          "org_chart_updated",
          "staff_aware_of_roles",
          "roles_changes_summary",
        ]
      ),
      buildGroup(
        "evidencias_s5",
        "Evidencias objetivas revisadas",
        "Selecciona los documentos y registros revisados durante la auditoría de esta sección.",
        [
          "s5_objective_evidence",
          "s5_guided_answers",
        ]
      ),
    ],
  }),
  "6": withFlatFields({
    section_code: "6",
    section_title: "Planificación",
    groups: [
      buildGroup(
        "documento_riesgos_oportunidades",
        "6.1 Riesgos y oportunidades",
        "Gestion centralizada mediante el documento P09 de riesgos y oportunidades.",
        []
      ),
      buildGroup(
        "objetivos_calidad",
        "6.2 Objetivos de calidad",
        "Matriz de objetivos con indicador, meta, resultado y seguimiento.",
        [
          "objectives_reference_document",
          "objectives_are_measurable",
          "previous_objectives",
          "current_objectives",
          "quality_objectives_matrix",
        ]
      ),
      buildGroup(
        "planificacion_cambios",
        "6.3 Planificacion de cambios",
        "Registro de cambios planificados o realizados en el SGC.",
        [
          "management_review_planned_date",
          "change_planning_method_summary",
          "extraordinary_changes_exist",
          "extraordinary_changes_summary",
          "planned_changes_log",
        ]
      ),
      buildGroup(
        "workspace_s6",
        "Workspace guiado sección 6",
        "Respuestas del auditor a preguntas guiadas por cláusula.",
        [
          "s6_guided_answers",
        ]
      ),
    ],
  }),
  "7": withFlatFields({
    section_code: "7",
    section_title: "Apoyo",
    groups: [
      buildGroup(
        "recursos_s7",
        "7.1 Recursos e infraestructura",
        "Personas, infraestructura, ambiente de trabajo, PRL y medios de seguimiento.",
        [
          "employee_count",
          "partner_count",
          "maintenance_reference_document",
          "prl_provider_name",
          "time_tracking_tool_name",
          // Legacy — preservados para compatibilidad
          "staff_changes_summary",
          "resources_sufficient",
          "personnel_competent",
          "staff_structure_summary",
          "infrastructure_status_summary",
          "vehicles_included",
          "equipment_included",
          "work_environment_summary",
          "prl_compliance_notes",
          "measurement_tools_summary",
        ]
      ),
      buildGroup(
        "competencia_s7",
        "7.2 Competencia y formación",
        "Competencias requeridas, formación y evaluación de eficacia por puesto.",
        [
          "job_profiles_reference",
          "training_2024_summary",
          "training_2025_planned_summary",
          "organizational_knowledge_managed",
          "knowledge_management_summary",
          "competence_training_matrix",
        ]
      ),
      buildGroup(
        "conciencia_s7",
        "7.3 Toma de conciencia",
        "Conocimiento del personal sobre política, objetivos y contribución al SGC.",
        [
          "awareness_actions_notes",
          // Legacy
          "awareness_actions_summary",
        ]
      ),
      buildGroup(
        "comunicacion_s7",
        "7.4 Comunicación",
        "Canales de comunicación interna y externa definidos y controlados.",
        [
          "communication_matrix",
          // Legacy
          "external_communication_channels",
          "internal_communication_channels",
          "last_meeting_date",
          "last_meeting_topics",
        ]
      ),
      buildGroup(
        "documentacion_s7",
        "7.5 Información documentada",
        "Control, revisión y accesibilidad de documentos y registros.",
        [
          "document_control_reference",
          "document_control_revision",
          "document_control_date",
          "documents_accessible",
        ]
      ),
      buildGroup(
        "workspace_s7",
        "Workspace guiado sección 7",
        "Respuestas del auditor a preguntas guiadas por cláusula.",
        [
          "s7_guided_answers",
        ]
      ),
    ],
  }),
  "8": withFlatFields({
    section_code: "8",
    section_title: "Operación",
    groups: [
      buildGroup(
        "operacion_servicio",
        "Planificación operacional",
        "Control del servicio y requisitos del cliente.",
        [
          "operational_control_summary",
          "planned_work_control_exists",
          "customer_requirements_defined",
          "contracts_used",
          "service_requirements_summary",
        ]
      ),
      buildGroup(
        "proveedores",
        "Control de proveedores",
        "Evaluación de proveedores y criterios aplicados.",
        [
          "supplier_evaluation_count",
          "supplier_average_score",
          "supplier_evaluation_criteria",
          "suppliers_certifications_requested",
          "supplier_control_summary",
        ]
      ),
      buildGroup(
        "muestra_operativa",
        "Muestra documental",
        "Trazabilidad de una muestra de proyecto.",
        [
          "sample_project_name",
          "sample_budget_code",
          "sample_budget_date",
          "sample_contract_date",
          "sample_invoice_code",
          "sample_invoice_date",
          "sample_payment_terms",
        ]
      ),
      buildGroup(
        "cumplimiento_liberacion",
        "Cumplimiento y liberación",
        "Requisitos legales, mantenimiento y no conformidades.",
        [
          "legal_requirements_sources",
          "maintenance_reference",
          "maintenance_notes",
          "extinguishers_reviewed",
          "extinguishers_review_date",
          "extinguishers_review_result",
          "vehicle_extinguishers_in_contract",
          "service_release_control_exists",
          "release_evidence_summary",
          "nonconformities_document_reference",
          "nonconformities_count",
          "nonconformities_summary",
        ]
      ),
      buildGroup(
        "workspace_s8",
        "Workspace de auditoría guiada (§8)",
        "Preguntas guiadas y matriz de trazabilidad — gestionados por el panel interactivo.",
        [
          "s8_guided_answers",
          "document_traceability_matrix",
        ]
      ),
    ],
  }),
  "9": withFlatFields({
    section_code: "9",
    section_title: "Evaluación del desempeño",
    groups: [
      buildGroup(
        "indicadores_desempeno",
        "Documento P09 - Indicadores de desempeño",
        "Sistema integrado por pestañas para catálogo, seguimiento, gráfico y valores.",
        [
          "performance_indicators_matrix",
        ]
      ),
      buildGroup(
        "satisfaccion_cliente",
        "Seguimiento de satisfaccion del cliente (9.1.2)",
        "Datos de encuestas, respuesta y valoracion global de cliente.",
        [
          "customer_satisfaction_surveys_count",
          "customer_satisfaction_response_rate",
          "customer_satisfaction_global_score",
          "customer_satisfaction_recommendation",
        ]
      ),
      buildGroup(
        "auditoria_interna",
        "Auditoria interna (9.2)",
        "Programa interno, fecha y resumen de hallazgos.",
        [
          "internal_audit_program_exists",
          "internal_audit_plan_date",
          "internal_audit_summary",
        ]
      ),
      buildGroup(
        "revision_direccion",
        "Revision por la direccion (9.3)",
        "Fecha de revision, entradas revisadas y acciones acordadas.",
        [
          "management_review_date",
          "management_review_summary",
        ]
      ),
      buildGroup(
        "workspace_s9",
        "Workspace de auditoria guiada (§9)",
        "Preguntas guiadas y resumen auditor de evaluacion del desempeno.",
        [
          "s9_guided_answers",
          "performance_conclusions_summary",
          "performance_trends_summary",
          "performance_deviations_summary",
        ]
      ),
    ],
  }),
  "10": withFlatFields({
    section_code: "10",
    section_title: "Mejora",
    groups: [
      buildGroup(
        "mejora_continua",
        "Mejora continua",
        "Sistema de mejora y oportunidades detectadas.",
        [
          "improvement_system_summary",
          "improvement_opportunities_summary",
          "continuous_improvement_mechanism_summary",
          "management_review_outputs_used_for_improvement",
          "improvement_meetings_summary",
        ]
      ),
      buildGroup(
        "no_conformidades",
        "No conformidades y acciones",
        "Gestión de no conformidades y acciones correctivas.",
        [
          "nonconformities_procedure_reference",
          "supplier_nc_exists",
          "supplier_nc_summary",
          "internal_nc_exists",
          "internal_nc_summary",
          "corrective_actions_followed",
        ]
      ),
    ],
  }),
};

export function getSectionFieldDefinition(sectionCode) {
  if (!sectionCode) return null;
  return sectionFieldDefinitions[String(sectionCode)] || null;
}

export function getSectionFieldGroups(sectionCode) {
  return getSectionFieldDefinition(sectionCode)?.groups || [];
}

export function getSectionFlatFields(sectionCode) {
  return getSectionFieldDefinition(sectionCode)?.flat_fields || [];
}


