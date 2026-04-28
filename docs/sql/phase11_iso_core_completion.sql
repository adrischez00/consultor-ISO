-- Consultor-ISO9001 - Phase 11 (Bloques ISO base y flujo CAPA)
-- Completa contexto, partes interesadas, alcance, politica, roles, procesos,
-- objetivos, cambios, no conformidades y mejora continua.

create extension if not exists pgcrypto;

create table if not exists public.iso_context_profiles (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  internal_context text not null,
  external_context text not null,
  system_scope text not null,
  exclusions text null,
  review_date date not null,
  next_review_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_iso_context_profiles_consultancy unique (consultancy_id),
  constraint ck_iso_context_profiles_review_dates check (
    next_review_date is null or next_review_date >= review_date
  )
);

create table if not exists public.iso_interested_parties (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  name text not null,
  party_type text not null,
  needs_expectations text not null,
  monitoring_method text null,
  priority text not null default 'medium',
  status text not null default 'active',
  review_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_iso_interested_parties_type check (
    party_type in ('internal', 'external', 'customer', 'supplier', 'regulator', 'other')
  ),
  constraint ck_iso_interested_parties_priority check (
    priority in ('low', 'medium', 'high')
  ),
  constraint ck_iso_interested_parties_status check (
    status in ('active', 'inactive')
  )
);

create table if not exists public.quality_policies (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete set null,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  version_label text not null,
  policy_text text not null,
  approved_by_name text null,
  approved_date date null,
  review_date date null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iso_role_assignments (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  role_name text not null,
  responsible_name text not null,
  responsibility_details text not null,
  related_process text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_iso_role_assignments_status check (
    status in ('active', 'inactive')
  )
);

create table if not exists public.iso_process_map_items (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  name text not null,
  process_type text not null,
  description text not null,
  process_inputs text null,
  process_outputs text null,
  responsible_name text not null,
  position_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_iso_process_map_items_type check (
    process_type in ('strategic', 'operational', 'support')
  ),
  constraint ck_iso_process_map_items_status check (
    status in ('active', 'inactive')
  ),
  constraint ck_iso_process_map_items_position_order check (
    position_order >= 0 and position_order <= 10000
  )
);

create table if not exists public.iso_quality_objectives (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  linked_kpi_id uuid null references public.kpi_indicators(id) on delete set null,
  title text not null,
  description text not null,
  period_label text not null,
  responsible_name text not null,
  status text not null default 'planned',
  tracking_notes text null,
  target_date date null,
  review_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_iso_quality_objectives_status check (
    status in ('planned', 'in_progress', 'completed', 'on_hold')
  ),
  constraint ck_iso_quality_objectives_dates check (
    target_date is null or review_date is null or review_date >= target_date
  )
);

create table if not exists public.iso_change_plans (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  change_title text not null,
  reason text not null,
  impact text not null,
  responsible_name text not null,
  planned_date date not null,
  status text not null default 'planned',
  followup_notes text null,
  completion_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_iso_change_plans_status check (
    status in ('planned', 'in_progress', 'completed', 'cancelled')
  ),
  constraint ck_iso_change_plans_dates check (
    completion_date is null or completion_date >= planned_date
  )
);

create table if not exists public.iso_nonconformities (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete set null,
  source_recommendation_id uuid null references public.audit_report_recommendations(id) on delete set null,
  linked_action_task_id uuid null references public.action_tasks(id) on delete set null,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  origin_type text not null,
  title text not null,
  description text not null,
  cause_analysis text null,
  immediate_correction text null,
  corrective_action text null,
  responsible_name text not null,
  due_date date null,
  effectiveness_verification text null,
  verification_date date null,
  status text not null default 'open',
  closure_notes text null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_iso_nonconformities_origin_type check (
    origin_type in ('audit', 'complaint', 'process', 'supplier', 'kpi', 'other')
  ),
  constraint ck_iso_nonconformities_status check (
    status in ('open', 'in_progress', 'pending_verification', 'closed')
  ),
  constraint ck_iso_nonconformities_dates check (
    due_date is null or verification_date is null or verification_date >= due_date
  )
);

create table if not exists public.iso_improvements (
  id uuid primary key default gen_random_uuid(),
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  created_by_user_id uuid null references public.users(id) on delete set null,
  updated_by_user_id uuid null references public.users(id) on delete set null,
  linked_nonconformity_id uuid null references public.iso_nonconformities(id) on delete set null,
  source_type text not null default 'other',
  source_id uuid null,
  title text not null,
  description text not null,
  action_plan text not null,
  responsible_name text not null,
  status text not null default 'proposed',
  due_date date null,
  followup_notes text null,
  benefit_observed text null,
  review_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_iso_improvements_source_type check (
    source_type in ('risk_opportunity', 'audit_recommendation', 'nonconformity', 'management_review', 'other')
  ),
  constraint ck_iso_improvements_status check (
    status in ('proposed', 'in_progress', 'implemented', 'validated', 'closed')
  ),
  constraint ck_iso_improvements_dates check (
    due_date is null or review_date is null or review_date >= due_date
  )
);

create index if not exists ix_iso_context_profiles_consultancy_id
  on public.iso_context_profiles(consultancy_id);
create index if not exists ix_iso_context_profiles_review_date
  on public.iso_context_profiles(review_date);
create index if not exists ix_iso_context_profiles_next_review_date
  on public.iso_context_profiles(next_review_date);

create index if not exists ix_iso_interested_parties_consultancy_id
  on public.iso_interested_parties(consultancy_id);
create index if not exists ix_iso_interested_parties_party_type
  on public.iso_interested_parties(party_type);
create index if not exists ix_iso_interested_parties_priority
  on public.iso_interested_parties(priority);
create index if not exists ix_iso_interested_parties_status
  on public.iso_interested_parties(status);
create index if not exists ix_iso_interested_parties_review_date
  on public.iso_interested_parties(review_date);

create index if not exists ix_quality_policies_consultancy_id
  on public.quality_policies(consultancy_id);
create index if not exists ix_quality_policies_client_id
  on public.quality_policies(client_id);
create index if not exists ix_quality_policies_is_active
  on public.quality_policies(is_active);
create index if not exists ix_quality_policies_approved_date
  on public.quality_policies(approved_date);

create index if not exists ix_iso_role_assignments_consultancy_id
  on public.iso_role_assignments(consultancy_id);
create index if not exists ix_iso_role_assignments_role_name
  on public.iso_role_assignments(role_name);
create index if not exists ix_iso_role_assignments_status
  on public.iso_role_assignments(status);

create index if not exists ix_iso_process_map_items_consultancy_id
  on public.iso_process_map_items(consultancy_id);
create index if not exists ix_iso_process_map_items_process_type
  on public.iso_process_map_items(process_type);
create index if not exists ix_iso_process_map_items_position_order
  on public.iso_process_map_items(position_order);
create index if not exists ix_iso_process_map_items_status
  on public.iso_process_map_items(status);

create index if not exists ix_iso_quality_objectives_consultancy_id
  on public.iso_quality_objectives(consultancy_id);
create index if not exists ix_iso_quality_objectives_status
  on public.iso_quality_objectives(status);
create index if not exists ix_iso_quality_objectives_target_date
  on public.iso_quality_objectives(target_date);
create index if not exists ix_iso_quality_objectives_review_date
  on public.iso_quality_objectives(review_date);
create index if not exists ix_iso_quality_objectives_linked_kpi_id
  on public.iso_quality_objectives(linked_kpi_id);

create index if not exists ix_iso_change_plans_consultancy_id
  on public.iso_change_plans(consultancy_id);
create index if not exists ix_iso_change_plans_status
  on public.iso_change_plans(status);
create index if not exists ix_iso_change_plans_planned_date
  on public.iso_change_plans(planned_date);
create index if not exists ix_iso_change_plans_completion_date
  on public.iso_change_plans(completion_date);

create index if not exists ix_iso_nonconformities_consultancy_id
  on public.iso_nonconformities(consultancy_id);
create index if not exists ix_iso_nonconformities_status
  on public.iso_nonconformities(status);
create index if not exists ix_iso_nonconformities_origin_type
  on public.iso_nonconformities(origin_type);
create index if not exists ix_iso_nonconformities_due_date
  on public.iso_nonconformities(due_date);
create index if not exists ix_iso_nonconformities_client_id
  on public.iso_nonconformities(client_id);
create index if not exists ix_iso_nonconformities_source_recommendation_id
  on public.iso_nonconformities(source_recommendation_id);
create index if not exists ix_iso_nonconformities_linked_action_task_id
  on public.iso_nonconformities(linked_action_task_id);

create index if not exists ix_iso_improvements_consultancy_id
  on public.iso_improvements(consultancy_id);
create index if not exists ix_iso_improvements_status
  on public.iso_improvements(status);
create index if not exists ix_iso_improvements_source_type
  on public.iso_improvements(source_type);
create index if not exists ix_iso_improvements_due_date
  on public.iso_improvements(due_date);
create index if not exists ix_iso_improvements_linked_nonconformity_id
  on public.iso_improvements(linked_nonconformity_id);
