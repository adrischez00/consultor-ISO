-- Consultor-ISO9001 - Phase 8 (Satisfaccion del Cliente)

create extension if not exists pgcrypto;

create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  feedback_date date not null,
  score integer not null,
  comment text not null,
  feedback_type text not null default 'survey',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_customer_feedback_score check (score between 1 and 5),
  constraint ck_customer_feedback_type check (
    feedback_type in ('survey', 'meeting', 'call', 'email', 'complaint', 'other')
  )
);

create index if not exists ix_customer_feedback_consultancy_id on public.customer_feedback(consultancy_id);
create index if not exists ix_customer_feedback_client_id on public.customer_feedback(client_id);
create index if not exists ix_customer_feedback_feedback_date on public.customer_feedback(feedback_date);
create index if not exists ix_customer_feedback_score on public.customer_feedback(score);
create index if not exists ix_customer_feedback_type on public.customer_feedback(feedback_type);
