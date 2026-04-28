-- Consultor-ISO9001 - Phase 2
-- All IDs use PostgreSQL UUID.

create extension if not exists pgcrypto;

create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  question_id uuid not null references public.diagnostic_questions(id) on delete cascade,
  answer_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_diag_answer unique (diagnostic_id, question_id)
);

create index if not exists ix_diagnostic_answers_diagnostic_id on public.diagnostic_answers(diagnostic_id);
create index if not exists ix_diagnostic_answers_question_id on public.diagnostic_answers(question_id);
