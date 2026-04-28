-- Consultor-ISO9001 - Fase 3
-- Permite generar action_tasks en diagnósticos sin client_id (fase sin módulo de clientes).
-- Reversible con: ALTER TABLE public.action_tasks ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE public.action_tasks
ALTER COLUMN client_id DROP NOT NULL;
