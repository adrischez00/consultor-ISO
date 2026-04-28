-- Consultor-ISO9001 - Phase 9 (Proveedores y Evaluacion de Proveedores)

create extension if not exists pgcrypto;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  name text not null,
  service_category text not null,
  contact_name text null,
  contact_email text null,
  contact_phone text null,
  quality_score integer not null,
  delivery_score integer not null,
  incidents_score integer not null,
  certifications_score integer not null,
  additional_score integer null,
  global_score numeric(5,2) not null,
  incidents_count integer not null default 0,
  evaluation_date date not null,
  final_rating text not null,
  evaluation_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_suppliers_quality_score check (quality_score between 1 and 5),
  constraint ck_suppliers_delivery_score check (delivery_score between 1 and 5),
  constraint ck_suppliers_incidents_score check (incidents_score between 1 and 5),
  constraint ck_suppliers_certifications_score check (certifications_score between 1 and 5),
  constraint ck_suppliers_additional_score check (
    additional_score is null or additional_score between 1 and 5
  ),
  constraint ck_suppliers_incidents_count check (incidents_count >= 0),
  constraint ck_suppliers_global_score check (global_score between 1 and 5),
  constraint ck_suppliers_final_rating check (
    final_rating in ('excellent', 'approved', 'conditional', 'critical')
  )
);

create index if not exists ix_suppliers_consultancy_id on public.suppliers(consultancy_id);
create index if not exists ix_suppliers_name on public.suppliers(name);
create index if not exists ix_suppliers_service_category on public.suppliers(service_category);
create index if not exists ix_suppliers_global_score on public.suppliers(global_score);
create index if not exists ix_suppliers_evaluation_date on public.suppliers(evaluation_date);
create index if not exists ix_suppliers_final_rating on public.suppliers(final_rating);
create index if not exists ix_suppliers_incidents_count on public.suppliers(incidents_count);
