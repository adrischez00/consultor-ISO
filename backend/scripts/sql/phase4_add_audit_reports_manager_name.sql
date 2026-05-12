-- Añade el campo "Gerente" en cabecera de auditorías (tabla audit_reports).
-- Reversible con:
-- ALTER TABLE public.audit_reports DROP COLUMN IF EXISTS manager_name;

ALTER TABLE public.audit_reports
ADD COLUMN IF NOT EXISTS manager_name text;
