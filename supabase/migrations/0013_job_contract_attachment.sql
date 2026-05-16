-- Migration 0013 — adicionar contrato assinado ao job (1 arquivo por job)
-- Aplicada em: 2026-05-16
--
-- Reusa o bucket Supabase Storage `job-extras` (já criado em Fase 4.2F).
-- Path canônico: contracts/<job_id>.<ext>
--
-- IDEMPOTENTE: pode rodar 2x sem erro (ADD COLUMN IF NOT EXISTS é Postgres 9.6+).

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS contract_path text,
  ADD COLUMN IF NOT EXISTS contract_file_name text,
  ADD COLUMN IF NOT EXISTS contract_mime text,
  ADD COLUMN IF NOT EXISTS contract_uploaded_at timestamptz;

-- Validação: lista jobs com colunas novas
SELECT id, value, contract_path, contract_file_name, contract_uploaded_at
FROM jobs
LIMIT 5;
