-- Migration 0039 — client_token em jobs (página pública pro cliente)
-- Aplicada em: 2026-06-04
--
-- Motivo:
--   Cliente quer ver progresso do projeto sem ligar pro Jose. Solução: página
--   pública /projeto/[token] com token opaco UUID. Cliente recebe link via
--   SMS/WhatsApp/email e abre — vê timeline, fotos, pagamentos, contato.
--   SEM mostrar margem/despesas internas (só o que cliente PRECISA ver).
--
-- Pattern igual /confirmar/[token] (visit confirmation) — auth via token no path.
--
-- =============================================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS client_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Cada job tem token UNICO pra evitar adivinhação
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_client_token_key;
ALTER TABLE jobs ADD CONSTRAINT jobs_client_token_key UNIQUE (client_token);

CREATE INDEX IF NOT EXISTS idx_jobs_client_token ON jobs(client_token);

COMMENT ON COLUMN jobs.client_token IS
  'Token opaco UUID pra página pública do cliente em /projeto/<token>. Gerado automático no INSERT. Cliente acessa sem auth — token é a única proteção.';

-- Validacao
SELECT
  COUNT(*) AS total_jobs,
  COUNT(DISTINCT client_token) AS tokens_unicos,
  COUNT(*) FILTER (WHERE client_token IS NULL) AS jobs_sem_token
FROM jobs;
