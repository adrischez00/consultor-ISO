-- Consultor-ISO9001 - Phase 13 (Documento P09 por auditoria)
-- Persistencia del documento "P09 - Partes interesadas" asociado a audit_reports.

create extension if not exists pgcrypto;

create table if not exists public.audit_interested_parties_documents (
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
  constraint audit_interested_parties_documents_audit_report_id_key
    unique (audit_report_id),
  constraint ck_audit_interested_parties_documents_revision_number
    check (revision_number >= 0),
  constraint ck_audit_interested_parties_documents_status
    check (status in ('draft', 'completed'))
);

create index if not exists ix_audit_interested_parties_documents_audit_report_id
  on public.audit_interested_parties_documents (audit_report_id);

create table if not exists public.audit_interested_parties_document_rows (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.audit_interested_parties_documents (id)
    on delete cascade,
  stakeholder_name text not null,
  needs_expectations text,
  applies boolean not null default true,
  observations text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audit_interested_parties_document_rows_document_id_sort_order_key
    unique (document_id, sort_order),
  constraint ck_audit_interested_parties_document_rows_sort_order
    check (sort_order >= 0)
);

create index if not exists ix_audit_interested_parties_document_rows_document_id
  on public.audit_interested_parties_document_rows (document_id);
