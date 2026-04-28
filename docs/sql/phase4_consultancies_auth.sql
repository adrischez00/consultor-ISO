-- Consultor-ISO9001 - Phase 4 (Auth + ownership by consultancy)
-- Safe script for transition to consultancy-shared model.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.consultancies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.consultancy_members (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint uq_consultancy_member unique (consultancy_id, user_id)
);

alter table public.clients
  add column if not exists consultancy_id uuid;

alter table public.clients
  add column if not exists user_id uuid;

alter table public.clients
  alter column user_id drop not null;

alter table public.diagnostics
  add column if not exists created_by_user_id uuid;

alter table public.diagnostics
  add column if not exists client_id uuid;

create index if not exists ix_clients_consultancy_id on public.clients(consultancy_id);
create index if not exists ix_diagnostics_created_by_user_id on public.diagnostics(created_by_user_id);
create index if not exists ix_consultancy_members_user_id on public.consultancy_members(user_id);
create index if not exists ix_consultancy_members_consultancy_id on public.consultancy_members(consultancy_id);
