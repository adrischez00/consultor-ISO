-- Consultor-ISO9001 - Phase 1 baseline for diagnostic_questions
-- Execute this only if public.diagnostic_questions does not exist
-- or if you need baseline seed questions for local/dev.

create extension if not exists pgcrypto;

create table if not exists public.diagnostic_questions (
  id uuid primary key default gen_random_uuid(),
  code varchar(64) not null unique,
  clause varchar(32) not null,
  question_text text not null,
  question_type varchar(32) not null,
  help_text text,
  options_json jsonb,
  weight numeric(10,2),
  sort_order integer not null
);

insert into public.diagnostic_questions (
  code,
  clause,
  question_text,
  question_type,
  help_text,
  options_json,
  weight,
  sort_order
)
values
  (
    'Q4-001',
    '4',
    '¿La organización determina su contexto interno y externo?',
    'single_choice',
    'Revisa factores internos, externos y partes interesadas.',
    '[{"label":"No implementado","value":"0"},{"label":"Parcial","value":"1"},{"label":"Implementado","value":"2"}]'::jsonb,
    1.00,
    10
  ),
  (
    'Q5-001',
    '5',
    '¿La alta dirección demuestra liderazgo y compromiso con el SGC?',
    'single_choice',
    null,
    '[{"label":"No","value":"0"},{"label":"Parcial","value":"1"},{"label":"Sí","value":"2"}]'::jsonb,
    1.00,
    20
  ),
  (
    'Q6-001',
    '6',
    '¿Se gestionan riesgos y oportunidades del sistema de gestión?',
    'single_choice',
    null,
    '[{"label":"No","value":"0"},{"label":"Parcial","value":"1"},{"label":"Sí","value":"2"}]'::jsonb,
    1.00,
    30
  ),
  (
    'Q7-001',
    '7',
    '¿Se dispone de recursos y competencia adecuados para operar el SGC?',
    'single_choice',
    null,
    '[{"label":"No","value":"0"},{"label":"Parcial","value":"1"},{"label":"Sí","value":"2"}]'::jsonb,
    1.00,
    40
  ),
  (
    'Q8-001',
    '8',
    '¿Los procesos operativos están definidos y controlados?',
    'single_choice',
    null,
    '[{"label":"No","value":"0"},{"label":"Parcial","value":"1"},{"label":"Sí","value":"2"}]'::jsonb,
    1.00,
    50
  ),
  (
    'Q9-001',
    '9',
    '¿Se realiza seguimiento, medición, análisis y evaluación del desempeño?',
    'single_choice',
    null,
    '[{"label":"No","value":"0"},{"label":"Parcial","value":"1"},{"label":"Sí","value":"2"}]'::jsonb,
    1.00,
    60
  ),
  (
    'Q10-001',
    '10',
    '¿Se gestionan no conformidades y mejora continua?',
    'single_choice',
    null,
    '[{"label":"No","value":"0"},{"label":"Parcial","value":"1"},{"label":"Sí","value":"2"}]'::jsonb,
    1.00,
    70
  )
on conflict (code) do update
set
  clause = excluded.clause,
  question_text = excluded.question_text,
  question_type = excluded.question_type,
  help_text = excluded.help_text,
  options_json = excluded.options_json,
  weight = excluded.weight,
  sort_order = excluded.sort_order;
