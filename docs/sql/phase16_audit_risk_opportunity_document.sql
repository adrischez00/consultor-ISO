-- Consultor-ISO9001 - Phase 16 (Documento P09 Riesgos y oportunidades - Seccion 6)
-- Persistencia del documento central de planificacion (6.1) asociado a audit_reports.

create extension if not exists pgcrypto;

create table if not exists public.audit_risk_opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  audit_report_id uuid not null
    references public.audit_reports (id)
    on delete cascade,
  code text not null default 'P09',
  revision_number integer not null default 0,
  document_date date,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audit_risk_opportunity_documents_audit_report_id_key
    unique (audit_report_id),
  constraint ck_audit_risk_opportunity_documents_revision_number
    check (revision_number >= 0),
  constraint ck_audit_risk_opportunity_documents_status
    check (status in ('draft', 'completed'))
);

create index if not exists ix_audit_risk_opportunity_documents_audit_report_id
  on public.audit_risk_opportunity_documents (audit_report_id);

create table if not exists public.audit_risk_opportunity_document_rows (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.audit_risk_opportunity_documents (id)
    on delete cascade,
  row_type text not null,
  swot_category text,
  description text,
  impact text,
  probability text,
  benefit text,
  action text,
  responsible text,
  follow_up_status text,
  follow_up_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audit_risk_opportunity_document_rows_document_id_sort_order_key
    unique (document_id, sort_order),
  constraint ck_audit_risk_opportunity_document_rows_row_type
    check (row_type in ('swot', 'risk', 'opportunity', 'follow_up')),
  constraint ck_audit_risk_opportunity_document_rows_swot_category
    check (
      swot_category is null
      or swot_category in ('weakness', 'threat', 'strength', 'opportunity')
    ),
  constraint ck_audit_risk_opportunity_document_rows_impact
    check (impact is null or impact in ('low', 'medium', 'high')),
  constraint ck_audit_risk_opportunity_document_rows_probability
    check (probability is null or probability in ('low', 'medium', 'high')),
  constraint ck_audit_risk_opportunity_document_rows_sort_order
    check (sort_order >= 0)
);

create index if not exists ix_audit_risk_opportunity_document_rows_document_id
  on public.audit_risk_opportunity_document_rows (document_id);
