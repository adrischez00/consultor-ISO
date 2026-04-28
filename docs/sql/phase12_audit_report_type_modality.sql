-- Consultor-ISO9001 - Phase 12 (Tipología y modalidad de auditoría en P03)
-- Añade campos de cabecera para generar bloque dinámico:
-- "DESCRIPCIÓN Y CRITERIOS DE LA AUDITORÍA"

alter table public.audit_reports
  add column if not exists tipo_auditoria text;

alter table public.audit_reports
  add column if not exists modalidad text;

update public.audit_reports
set tipo_auditoria = lower(btrim(tipo_auditoria))
where tipo_auditoria is not null;

update public.audit_reports
set modalidad = lower(btrim(modalidad))
where modalidad is not null;

update public.audit_reports
set tipo_auditoria = 'inicial'
where tipo_auditoria is null
   or tipo_auditoria = ''
   or tipo_auditoria not in ('inicial', 'revision_1', 'revision_2', 'recertificacion');

update public.audit_reports
set modalidad = 'presencialmente'
where modalidad is null
   or modalidad = ''
   or modalidad not in ('presencialmente', 'de forma remota', 'de forma mixta');

alter table public.audit_reports
  alter column tipo_auditoria set default 'inicial';

alter table public.audit_reports
  alter column modalidad set default 'presencialmente';

alter table public.audit_reports
  alter column tipo_auditoria set not null;

alter table public.audit_reports
  alter column modalidad set not null;

alter table public.audit_reports
  drop constraint if exists ck_audit_reports_tipo_auditoria;

alter table public.audit_reports
  add constraint ck_audit_reports_tipo_auditoria
  check (tipo_auditoria in ('inicial', 'revision_1', 'revision_2', 'recertificacion'));

alter table public.audit_reports
  drop constraint if exists ck_audit_reports_modalidad;

alter table public.audit_reports
  add constraint ck_audit_reports_modalidad
  check (modalidad in ('presencialmente', 'de forma remota', 'de forma mixta'));
