-- Consultor-ISO9001 - Phase 6 (Revision por la Direccion)

create extension if not exists pgcrypto;

create table if not exists public.management_reviews (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  review_date date not null,
  reviewed_period text not null,
  summary text not null,
  conclusions text not null,
  decisions text not null,
  derived_actions text not null,
  responsible_name text not null,
  followup_status text not null default 'pending',
  followup_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_management_reviews_followup_status check (
    followup_status in ('pending', 'in_progress', 'completed')
  )
);

create index if not exists ix_management_reviews_consultancy_id on public.management_reviews(consultancy_id);
create index if not exists ix_management_reviews_review_date on public.management_reviews(review_date);
create index if not exists ix_management_reviews_followup_status on public.management_reviews(followup_status);

create table if not exists public.management_review_references (
  id uuid primary key default gen_random_uuid(),
  management_review_id uuid not null references public.management_reviews(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  reference_type text not null,
  source_id uuid not null,
  source_label text null,
  created_at timestamptz not null default now(),
  constraint ck_management_review_references_reference_type check (
    reference_type in (
      'audit_report',
      'kpi_indicator',
      'non_conformity',
      'improvement_opportunity'
    )
  ),
  constraint uq_management_review_reference_unique_source unique (
    management_review_id,
    reference_type,
    source_id
  )
);

create index if not exists ix_management_review_references_review_id
  on public.management_review_references(management_review_id);
create index if not exists ix_management_review_references_consultancy_id
  on public.management_review_references(consultancy_id);
create index if not exists ix_management_review_references_reference_type
  on public.management_review_references(reference_type);
create index if not exists ix_management_review_references_source_id
  on public.management_review_references(source_id);
