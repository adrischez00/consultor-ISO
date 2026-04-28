-- Consultor-ISO9001 - Phase 17 (Documento P09 Riesgos y oportunidades V2)
-- Amplia el detalle de filas para soportar:
-- - DAFO como origen
-- - matriz de evaluacion de riesgos
-- - evaluacion de oportunidades
-- - acciones asociadas a riesgos/oportunidades

alter table if exists public.audit_risk_opportunity_document_rows
  add column if not exists process_name text,
  add column if not exists severity text,
  add column if not exists viability integer,
  add column if not exists attractiveness integer,
  add column if not exists source_key text,
  add column if not exists reference_kind text,
  add column if not exists reference_row_id uuid,
  add column if not exists action_type text,
  add column if not exists indicator text,
  add column if not exists due_date date,
  add column if not exists action_result text,
  add column if not exists is_auto_generated boolean not null default false;

alter table if exists public.audit_risk_opportunity_document_rows
  drop constraint if exists ck_audit_risk_opportunity_document_rows_row_type;

alter table if exists public.audit_risk_opportunity_document_rows
  add constraint ck_audit_risk_opportunity_document_rows_row_type
  check (row_type in ('swot', 'risk', 'opportunity', 'action', 'follow_up'));

alter table if exists public.audit_risk_opportunity_document_rows
  drop constraint if exists ck_audit_risk_opportunity_document_rows_severity;

alter table if exists public.audit_risk_opportunity_document_rows
  add constraint ck_audit_risk_opportunity_document_rows_severity
  check (severity is null or severity in ('slight', 'harm', 'extreme'));

alter table if exists public.audit_risk_opportunity_document_rows
  drop constraint if exists ck_audit_risk_opportunity_document_rows_viability;

alter table if exists public.audit_risk_opportunity_document_rows
  add constraint ck_audit_risk_opportunity_document_rows_viability
  check (viability is null or viability in (1, 3, 5));

alter table if exists public.audit_risk_opportunity_document_rows
  drop constraint if exists ck_audit_risk_opportunity_document_rows_attractiveness;

alter table if exists public.audit_risk_opportunity_document_rows
  add constraint ck_audit_risk_opportunity_document_rows_attractiveness
  check (attractiveness is null or attractiveness in (1, 3, 5));

alter table if exists public.audit_risk_opportunity_document_rows
  drop constraint if exists ck_audit_risk_opportunity_document_rows_reference_kind;

alter table if exists public.audit_risk_opportunity_document_rows
  add constraint ck_audit_risk_opportunity_document_rows_reference_kind
  check (reference_kind is null or reference_kind in ('risk', 'opportunity'));

create index if not exists ix_audit_risk_opportunity_document_rows_reference_row_id
  on public.audit_risk_opportunity_document_rows (reference_row_id);
