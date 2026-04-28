-- Consultor-ISO9001 - Phase 10 (Integracion ISO entre modulos)
-- Amplia referencias cruzadas de Revision por la Direccion para integrar
-- riesgos/oportunidades, satisfaccion del cliente y proveedores.

create extension if not exists pgcrypto;

alter table if exists public.management_review_references
  drop constraint if exists ck_management_review_references_reference_type;

alter table if exists public.management_review_references
  add constraint ck_management_review_references_reference_type check (
    reference_type in (
      'audit_report',
      'kpi_indicator',
      'non_conformity',
      'improvement_opportunity',
      'risk_opportunity',
      'customer_feedback',
      'supplier'
    )
  );

create index if not exists ix_management_review_references_reference_type
  on public.management_review_references(reference_type);
