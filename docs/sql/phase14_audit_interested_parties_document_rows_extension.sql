-- Consultor-ISO9001 - Phase 14 (Extension de filas P09)
-- Amplia la estructura de audit_interested_parties_document_rows para alinear
-- el documento P09 con la plantilla completa (necesidades, expectativas,
-- requisitos, riesgos, oportunidades y acciones).

alter table if exists public.audit_interested_parties_document_rows
  add column if not exists needs text,
  add column if not exists expectations text,
  add column if not exists requirements text,
  add column if not exists risks text,
  add column if not exists opportunities text,
  add column if not exists actions text;

-- Backfill de compatibilidad: cuando solo exista needs_expectations historico,
-- copiarlo a needs si needs y expectations aun estan vacios.
update public.audit_interested_parties_document_rows
set needs = needs_expectations
where coalesce(trim(needs), '') = ''
  and coalesce(trim(expectations), '') = ''
  and coalesce(trim(needs_expectations), '') <> '';

-- Nota:
-- - Se mantiene needs_expectations como columna legacy para compatibilidad.
-- - El flujo nuevo debe usar needs + expectations y el resto de campos nuevos.
