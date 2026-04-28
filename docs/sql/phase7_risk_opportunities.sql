-- Consultor-ISO9001 - Phase 7 (Riesgos y Oportunidades)

create extension if not exists pgcrypto;

create table if not exists public.risk_opportunities (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  name text not null,
  description text null,
  item_type text not null,
  probability integer not null,
  impact integer not null,
  level_score integer not null,
  level text not null,
  action_plan text not null,
  responsible_name text not null,
  status text not null default 'pending',
  review_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_risk_opportunities_item_type check (item_type in ('risk', 'opportunity')),
  constraint ck_risk_opportunities_probability check (probability between 1 and 5),
  constraint ck_risk_opportunities_impact check (impact between 1 and 5),
  constraint ck_risk_opportunities_status check (status in ('pending', 'in_progress', 'completed')),
  constraint ck_risk_opportunities_level check (level in ('low', 'medium', 'high', 'critical')),
  constraint ck_risk_opportunities_level_score check (level_score = probability * impact)
);

create index if not exists ix_risk_opportunities_consultancy_id on public.risk_opportunities(consultancy_id);
create index if not exists ix_risk_opportunities_item_type on public.risk_opportunities(item_type);
create index if not exists ix_risk_opportunities_status on public.risk_opportunities(status);
create index if not exists ix_risk_opportunities_level on public.risk_opportunities(level);
create index if not exists ix_risk_opportunities_level_score on public.risk_opportunities(level_score);
create index if not exists ix_risk_opportunities_review_date on public.risk_opportunities(review_date);
