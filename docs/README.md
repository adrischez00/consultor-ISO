# Consultor-ISO9001 - Base Técnica

## Stack
- Backend: FastAPI + SQLAlchemy + PostgreSQL (Supabase)
- Frontend: React + Vite + React Router

## Módulos base
- `backend/app`: API, modelos y schemas
- `frontend/src`: UI, routing y cliente API
- `docs`: documentación técnica
- Módulo principal actual: `Auditorías P03` (informe de auditoría interna ISO 9001)
- Módulo secundario legacy: `Diagnósticos`

## Flujo principal recomendado
1. `Dashboard`
2. `Clientes`
3. `Auditorías` (crear auditoría por cliente)
4. `Editar auditoría` como expediente central de trabajo ISO
5. Cierre / aprobación según bloqueos de compliance y evidencias

## Regla de IDs
- Todos los IDs del sistema son UUID (PostgreSQL UUID).
- `diagnostic_id` y `question_id` se manejan como strings UUID en frontend.
- Backend usa tipos UUID en modelos, schemas y endpoints.

## Endpoints disponibles
- `GET /health` -> `{ "status": "ok" }`
- `GET /questions` -> lectura de `diagnostic_questions` ordenada por `sort_order ASC`
- `GET /audit-reports` -> listado de auditorías P03 (filtros: `client_id`, `report_year`, `status`)
- `POST /audit-reports` -> crea auditoría P03 e inicializa secciones y cláusulas desde template (admite datos iniciales opcionales de planificación, incluyendo `tipo_auditoria` y `modalidad`)
- `GET /audit-reports/{report_id}` -> detalle completo (cabecera, entrevistados, secciones, ítems, checks, recomendaciones y anexos) con datos de cliente (`name`, `sector`, `employee_count`)
- `GET /audit-reports/{report_id}/compliance` -> estado de cumplimiento por bloques ISO reforzados (verde/amarillo/rojo)
- `GET /audit-reports/{report_id}/iso-workbench` -> resumen contextual del flujo ISO para esa auditoría (entradas, salidas y vínculos cruzados)
- `PATCH /audit-reports/{report_id}` -> actualiza cabecera de auditoría
- `DELETE /audit-reports/{report_id}` -> elimina auditoría (solo estados no cerrados/completados)
- `GET /audit-reports/{report_id}/sections`
- `PATCH /audit-reports/{report_id}/sections/{section_code}`
- `PUT /audit-reports/{report_id}/sections/{section_code}/items`
- `GET /audit-reports/{report_id}/interested-parties-document` -> devuelve documento P09 de partes interesadas para esa auditoría (o `null` si aún no existe)
- `PUT /audit-reports/{report_id}/interested-parties-document` -> crea/actualiza documento P09 con filas completas (`stakeholder_name`, `needs`, `expectations`, `requirements`, `risks`, `opportunities`, `actions`, `applies`, `observations`), revisión y fecha de último guardado
- `GET /audit-reports/{report_id}/clause-checks`
- `PUT /audit-reports/{report_id}/clause-checks`
- `GET /audit-reports/{report_id}/annexes`
- `POST /audit-reports/{report_id}/annexes`
- `PATCH /audit-reports/{report_id}/annexes/{annex_id}`
- `DELETE /audit-reports/{report_id}/annexes/{annex_id}`
- `GET /audit-reports/{report_id}/interviewees`
- `POST /audit-reports/{report_id}/interviewees`
- `DELETE /audit-reports/{report_id}/interviewees/{interviewee_id}`
- `GET /audit-reports/{report_id}/recommendations`
- `POST /audit-reports/{report_id}/recommendations`
- `PATCH /audit-reports/{report_id}/recommendations/{recommendation_id}`
- `DELETE /audit-reports/{report_id}/recommendations/{recommendation_id}`
- `GET /audit-reports/{report_id}/history/recommendations`
- `POST /audit-reports/{report_id}/exportar` -> genera DOCX P03 tomando evidencia del expediente y de módulos ISO vinculados (contexto, política, objetivos, riesgos, KPI, proveedores, satisfacción, NC/mejora, revisión); prioriza texto final validado por auditor y añade anexos en resultados. Si no hay `OPENAI_API_KEY`, exporta en modo respaldo sin IA y mantiene redacción profesional basada en evidencia disponible.
  - La cabecera del DOCX incluye datos de cliente para trazabilidad (`Sector` y `Nº de empleados`) cuando existen.
  - El DOCX muestra automáticamente `Estado de exportacion` según `report.status`: `BORRADOR CONTROLADO` en estados de trabajo y `VERSION FINAL` en estados cerrados (`completed/approved`).
  - Siempre exporta; si está en estado final con faltantes críticos, añade advertencia explícita y lista crítica en integridad documental.
- Endpoints `diagnostics` se mantienen como módulo legacy interno.
- `GET /diagnostics` -> listado de diagnósticos ordenado por `created_at DESC`
- `POST /diagnostics` -> crea diagnóstico en estado `draft`
- `GET /diagnostics/{diagnostic_id}` -> estado y metadatos del diagnóstico
- `POST /answers` -> guarda o actualiza respuesta (upsert)
- `GET /diagnostics/{diagnostic_id}/answers` -> devuelve respuestas del diagnóstico
- `POST /diagnostics/{diagnostic_id}/evaluate` -> calcula score, madurez, genera hallazgos y tareas iniciales
- `GET /diagnostics/{diagnostic_id}/result` -> payload unificado para vista de resultado (diagnóstico + clause_summary + findings + tasks)
- `GET /diagnostics/{diagnostic_id}/evaluation` -> recupera evaluación persistida si el diagnóstico está `completed`
- `GET /tasks` -> listado de tareas ordenado por `created_at DESC`
- `GET /kpis` -> listado de indicadores KPI (filtros: `status`, `start_date_from`, `start_date_to`, `end_date_from`, `end_date_to`)
- `POST /kpis` -> crea KPI y calcula estado (`ok`, `alerta`, `critico`)
- `GET /kpis/{kpi_id}`
- `PATCH /kpis/{kpi_id}`
- `DELETE /kpis/{kpi_id}`
- `GET /management-reviews/summary` -> resumen para dashboard de revisiones por la dirección
- `GET /management-reviews` -> listado de revisiones (filtros: `status`, `review_date_from`, `review_date_to`)
- `POST /management-reviews`
- `GET /management-reviews/{review_id}`
- `PATCH /management-reviews/{review_id}`
- `DELETE /management-reviews/{review_id}`
- `GET /risk-opportunities/summary` -> resumen de riesgos y oportunidades
- `GET /risk-opportunities` -> listado de riesgos y oportunidades (filtros: `type`, `status`, `level`)
- `POST /risk-opportunities`
- `GET /risk-opportunities/{item_id}`
- `PATCH /risk-opportunities/{item_id}`
- `DELETE /risk-opportunities/{item_id}`
- `GET /iso-flow/summary` -> resumen agregado del flujo ISO integrado

## Ejecución
### Backend
1. `cd backend`
2. `python -m pip install -r requirements.txt`
   - El hash de passwords usa `pwdlib[argon2]` (Argon2 recomendado).
3. Ajustar `backend/.env` (o `backend/.env.local`) con credenciales reales de Supabase
4. `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
5. (Opcional) Smoke test directo de conexión: `python main.py`

### Verificación de configuración backend
1. Confirmar carga de `.env` correcto y host de base de datos:
   - `python -c "from app.core.config import get_settings, ENV_FILE_PATH; s=get_settings(); print(ENV_FILE_PATH); print(s.database_username); print(s.database_host); print(s.database_port); print(s.database_mode); print(s.database_url_redacted)"`
2. Debe mostrar:
   - Ruta exacta a `backend/.env`
   - Usuario/host/puerto/modo efectivos según `DATABASE_URL`
3. Si falta `DATABASE_URL`, tiene formato inválido o mezcla datos de pooler, el backend falla en arranque con error de validación claro.
4. Verificar conexión real y estructura de `diagnostic_questions`:
   - `python scripts/check_questions_db.py`

### Supabase Pooler (importante)
- Session pooler: puerto `5432`.
- Transaction pooler: puerto `6543`.
- Para pooler, el usuario debe ser `postgres.<project_ref>`.
- En algunos proyectos Supabase entrega `6543` con host `db.<project_ref>.supabase.co`; también es válido si viene así desde Connect.
- No mezclar host/puerto/usuario de distintas opciones.
- Recomendado para este backend FastAPI (proceso estable con SQLAlchemy): Session pooler (`5432`).
- Usar `backend/.env.example` como plantilla y copiar la cadena exacta desde Supabase Connect.
- El backend admite también formato separado (`user`, `password`, `host`, `port`, `dbname`) y construye `DATABASE_URL` automáticamente si esta variable no existe.

### Tabla de preguntas (si falta)
- Script base: `docs/sql/phase1_diagnostic_questions.sql`
- Crea `public.diagnostic_questions` y carga seed mínimo para probar el diagnóstico.

### Frontend
1. `cd frontend`
2. `npm install`
3. Revisar `frontend/.env`
4. `npm run dev`

## Flujo de prueba rápido (Auditorías P03)
1. Abrir `http://localhost:5173/dashboard`
2. Ir a `Auditorías` (`/auditorias`) y pulsar `Nueva auditoría`
3. Seleccionar cliente + año y crear la auditoría
4. Abrir `/auditorias/{id}/editar` (o redirección automática desde `Nueva auditoría` con onboarding)
5. Revisar el bloque `Ruta ISO de esta auditoría` y navegar a módulos enlazados (`/sistema-iso`, `/riesgos-oportunidades`, `/proveedores`, `/indicadores`, `/satisfaccion-cliente`, `/no-conformidades`, `/revision-direccion`) manteniendo `report_id`/`client_id`.
6. Editar cabecera, secciones, ítems, checks, entrevistados y recomendaciones
7. Desde una recomendación, usar `Generar no conformidad / acción correctiva...` y confirmar prefill de `source_recommendation_id` en `/no-conformidades`.
8. Volver a la auditoría y verificar actualización de conteos en `Ruta ISO de esta auditoría`.
9. Verificar en backend:
   - `POST /audit-reports` crea el informe e inicializa estructura desde template
   - `PATCH /audit-reports/{id}` persiste cabecera
   - `PATCH /audit-reports/{id}/sections/{section_code}` persiste texto/estado de sección
   - `PUT /audit-reports/{id}/sections/{section_code}/items` persiste ítems de sección
   - `PUT /audit-reports/{id}/clause-checks` persiste checks por cláusula
   - `GET /audit-reports/{id}/compliance` valida bloques ISO reforzados sobre evidencias cargadas
   - `GET /audit-reports/{id}/iso-workbench` devuelve resumen contextual para navegación y trazabilidad de la auditoría
   - Si intentas cerrar una sección (`status=completed`) sin evidencias obligatorias, responde `409`
   - Si intentas cerrar/aprobar la auditoría con bloques no verdes, responde `409`
   - `GET/POST/PATCH/DELETE /audit-reports/{id}/annexes` gestiona evidencia documental
   - `POST/DELETE interviewees` y `POST/PATCH/DELETE recommendations` persisten cambios reales
  - `POST /audit-reports/{id}/exportar` genera el DOCX P03 con evidencia del proyecto completo, nota metodológica de revisión humana y metadatos de emisión (estado, fecha/hora y emisor).
  - Si faltan datos críticos, el DOCX incorpora `Observaciones de integridad documental`; si además está en estado final, añade advertencia reforzada para control documental.

## Flujo de prueba rápido (KPIs)
1. Ir a `http://localhost:5173/indicadores`
2. Crear un indicador con `name`, `target_value`, `current_value`, `unit`, `start_date` y `end_date` o `period_label`
3. Verificar estado calculado:
   - `ok` si `current_value >= target_value`
   - `alerta` si está entre 90% y 99.99% del objetivo
   - `critico` si está por debajo de 90%
4. Editar el `current_value` y confirmar recálculo automático de estado
5. Probar filtros por estado y fechas en el listado

## Flujo de prueba rápido (Revisión por la Dirección)
1. Ir a `http://localhost:5173/revision-direccion`
2. Crear una revisión con fecha, periodo, resumen, conclusiones, decisiones y acciones derivadas
3. Añadir referencias usando tipo + UUID (`audit_report`, `kpi_indicator`, `non_conformity`, `improvement_opportunity`, `risk_opportunity`, `customer_feedback`, `supplier`)
4. Verificar detalle de la revisión y conteos de integración (auditorías, KPIs, no conformidades, mejoras, riesgos, satisfacción y proveedores)
5. Editar seguimiento (`followup_status`) y notas de seguimiento
6. Probar filtros por estado y fecha de revisión

## Flujo legacy (Diagnósticos)
- Se mantiene disponible para compatibilidad en `/diagnosticos`.

## SQL para esta fase
- Script: `docs/sql/phase2_diagnostics_tables.sql`
- Ejecutar una vez en Supabase SQL Editor antes de probar persistencia si las tablas no existen.
- Ajuste Fase 3 (si `action_tasks.client_id` aún es `NOT NULL`):
  - Script: `backend/scripts/sql/phase3_make_action_tasks_client_id_nullable.sql`
  - Permite generar tareas cuando el diagnóstico aún no tiene cliente asociado.
- Fase 5 KPIs:
  - Script: `docs/sql/phase5_kpis_indicators.sql`
  - Crea `kpi_indicators` con constraints e indices para filtros.
- Fase 6 Revisión por la Dirección:
  - Script: `docs/sql/phase6_management_reviews.sql`
  - Crea `management_reviews` y `management_review_references` para trazabilidad con auditorías, KPIs y mejora.
- Fase 10 Integración ISO:
  - Script: `docs/sql/phase10_iso_integration.sql`
  - Amplía `management_review_references.reference_type` con `risk_opportunity`, `customer_feedback` y `supplier`.

## Endpoints - Satisfaccion del Cliente
- `GET /customer-feedback/summary` -> resumen de satisfaccion (media y distribucion)
- `GET /customer-feedback` -> listado de feedback (filtros: `client_id`, `type`, `feedback_date_from`, `feedback_date_to`, `score_min`, `score_max`)
- `POST /customer-feedback`
- `GET /customer-feedback/{feedback_id}`
- `PATCH /customer-feedback/{feedback_id}`
- `DELETE /customer-feedback/{feedback_id}`

## Flujo de prueba rapido (Satisfaccion del Cliente)
1. Ir a `http://localhost:5173/satisfaccion-cliente`
2. Crear feedback con cliente, fecha, puntuacion (1-5), origen y comentario
3. Verificar resumen: media, total, satisfechos/neutros/insatisfechos
4. Probar filtros por fecha y puntuacion
5. Editar y eliminar registros para confirmar persistencia

## SQL Fase 8
- Script: `docs/sql/phase8_customer_satisfaction.sql`
- Crea `customer_feedback` con constraints e indices para filtrado y resumen.

## Endpoints - Proveedores y Evaluacion
- `GET /suppliers/summary` -> resumen de proveedores (media global y distribucion por valoracion)
- `GET /suppliers` -> listado de proveedores (filtros: `service_category`, `rating`, `evaluation_date_from`, `evaluation_date_to`, `score_min`, `score_max`, `order_by`, `order_dir`)
- `POST /suppliers`
- `GET /suppliers/{supplier_id}`
- `PATCH /suppliers/{supplier_id}`
- `DELETE /suppliers/{supplier_id}`

## Flujo de prueba rapido (Proveedores)
1. Ir a `http://localhost:5173/proveedores`
2. Crear un proveedor con nombre, categoria y criterios de evaluacion (calidad, plazo, incidencias, certificaciones y opcional otro)
3. Verificar calculo automatico de `global_score` y `final_rating`
4. Probar filtros por valoracion, fecha y puntuacion, y ordenacion por columnas
5. Editar y eliminar para confirmar persistencia

## SQL Fase 9
- Script: `docs/sql/phase9_suppliers_evaluations.sql`
- Crea `suppliers` con criterios de evaluacion, score global, incidencias y valoracion final.

## Integracion ISO (Fase 10)
- Endpoint nuevo: `GET /iso-flow/summary`
- Devuelve una vista agregada del flujo ISO 9001:
  - contexto (clientes),
  - objetivos/indicadores,
  - riesgos y oportunidades,
  - operacion/proveedores,
  - auditorias,
  - no conformidades,
  - acciones correctivas,
  - satisfaccion del cliente,
  - revision por la direccion,
  - mejora (oportunidades).
- Incluye `missing_tables` para detectar migraciones pendientes de modulos.

## SQL Fase 10
- Script: `docs/sql/phase10_iso_integration.sql`
- Amplia `management_review_references.reference_type` para integrar:
  - `risk_opportunity`,
  - `customer_feedback`,
  - `supplier`.

## Endpoints - Sistema ISO (Fase 11)
- Contexto y alcance:
  - `GET /iso-context-profile`
  - `PUT /iso-context-profile`
- Partes interesadas:
  - `GET /iso-interested-parties`
  - `POST /iso-interested-parties`
  - `GET /iso-interested-parties/{party_id}`
  - `PATCH /iso-interested-parties/{party_id}`
  - `DELETE /iso-interested-parties/{party_id}`
- Politica de calidad:
  - `GET /quality-policies`
  - `POST /quality-policies`
  - `GET /quality-policies/{policy_id}`
  - `PATCH /quality-policies/{policy_id}`
  - `DELETE /quality-policies/{policy_id}`
- Roles y responsabilidades:
  - `GET /iso-role-assignments`
  - `POST /iso-role-assignments`
  - `GET /iso-role-assignments/{role_id}`
  - `PATCH /iso-role-assignments/{role_id}`
  - `DELETE /iso-role-assignments/{role_id}`
- Mapa de procesos:
  - `GET /iso-process-map`
  - `POST /iso-process-map`
  - `GET /iso-process-map/{process_id}`
  - `PATCH /iso-process-map/{process_id}`
  - `DELETE /iso-process-map/{process_id}`
- Objetivos:
  - `GET /iso-quality-objectives/summary`
  - `GET /iso-quality-objectives`
  - `POST /iso-quality-objectives`
  - `GET /iso-quality-objectives/{objective_id}`
  - `PATCH /iso-quality-objectives/{objective_id}`
  - `DELETE /iso-quality-objectives/{objective_id}`
- Planificacion de cambios:
  - `GET /iso-change-plans`
  - `POST /iso-change-plans`
  - `GET /iso-change-plans/{change_id}`
  - `PATCH /iso-change-plans/{change_id}`
  - `DELETE /iso-change-plans/{change_id}`
- No conformidades y acciones correctivas:
  - `GET /iso-nonconformities/summary`
  - `GET /iso-nonconformities`
  - `POST /iso-nonconformities`
  - `GET /iso-nonconformities/{nc_id}`
  - `PATCH /iso-nonconformities/{nc_id}`
  - `DELETE /iso-nonconformities/{nc_id}`
- Mejora continua:
  - `GET /iso-improvements/summary`
  - `GET /iso-improvements`
  - `POST /iso-improvements`
  - `GET /iso-improvements/{improvement_id}`
  - `PATCH /iso-improvements/{improvement_id}`
  - `DELETE /iso-improvements/{improvement_id}`

## Flujo de prueba rapido (Fase 11)
1. Ir a `http://localhost:5173/sistema-iso`.
2. Guardar contexto y alcance en "Contexto y alcance".
3. Crear partes interesadas, politica de calidad, roles y procesos.
4. Crear objetivos y vincular opcionalmente un KPI.
5. Registrar cambios planificados y validar estado/seguimiento.
6. Ir a `http://localhost:5173/no-conformidades`.
7. Crear no conformidad con causa, accion correctiva y responsable.
8. Cambiar estado a `pending_verification` o `closed` con verificacion de eficacia.
9. Crear mejora continua vinculada opcionalmente a una no conformidad.

## SQL Fase 11
- Script: `docs/sql/phase11_iso_core_completion.sql`
- Crea tablas base para:
  - contexto y alcance,
  - partes interesadas,
  - politica de calidad,
  - roles y responsabilidades,
  - mapa de procesos,
  - objetivos,
  - planificacion de cambios,
  - no conformidades y acciones correctivas,
  - mejora continua.

## SQL Fase 12
- Script: `docs/sql/phase12_audit_report_type_modality.sql`
- Añade en `audit_reports`:
  - `tipo_auditoria` (`inicial`, `revision_1`, `revision_2`, `recertificacion`)
  - `modalidad` (`presencialmente`, `de forma remota`, `de forma mixta`)
- Normaliza datos previos, fija defaults y constraints de validación.

## SQL Fase 13
- Script: `docs/sql/phase13_audit_interested_parties_document.sql`
- Crea persistencia del documento `P09 - Partes interesadas` por auditoria:
  - `audit_interested_parties_documents` (cabecera con codigo, revision, fecha y estado)
  - `audit_interested_parties_document_rows` (filas de partes interesadas, necesidades/expectativas legacy, aplica y observaciones)
- Restringe una cabecera P09 por auditoria (`unique audit_report_id`) y mantiene filas hijas con borrado en cascada.

## SQL Fase 14
- Script: `docs/sql/phase14_audit_interested_parties_document_rows_extension.sql`
- Amplia `audit_interested_parties_document_rows` con:
  - `needs`, `expectations`, `requirements`, `risks`, `opportunities`, `actions`
- Mantiene `needs_expectations` como compatibilidad temporal y realiza backfill hacia `needs` para datos historicos donde aplique.
