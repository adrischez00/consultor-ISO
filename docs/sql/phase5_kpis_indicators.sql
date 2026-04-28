-- Consultor-ISO9001 - Phase 5 (KPIs / indicadores)

create extension if not exists pgcrypto;

create table if not exists public.kpi_indicators (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  name text not null,
  description text null,
  target_value numeric(14,4) not null,
  current_value numeric(14,4) not null default 0,
  unit text not null,
  start_date date not null,
  end_date date null,
  period_label text null,
  responsible_name text not null,
  status text not null default 'critico',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_kpi_target_positive check (target_value > 0),
  constraint ck_kpi_status_values check (status in ('ok', 'alerta', 'critico')),
  constraint ck_kpi_period_presence check (
    end_date is not null
    or nullif(btrim(period_label), '') is not null
  ),
  constraint ck_kpi_end_date_after_start check (
    end_date is null or end_date >= start_date
  )
);

create index if not exists ix_kpi_indicators_consultancy_id on public.kpi_indicators(consultancy_id);
create index if not exists ix_kpi_indicators_status on public.kpi_indicators(status);
create index if not exists ix_kpi_indicators_start_date on public.kpi_indicators(start_date);
create index if not exists ix_kpi_indicators_end_date on public.kpi_indicators(end_date);
