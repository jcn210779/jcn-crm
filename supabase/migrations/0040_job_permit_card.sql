-- Migration 0040 — Permit como card separado no job (não mais fase)
-- Aplicada em: 2026-06-04
--
-- Motivo:
--   "Permit released" era uma fase do job, mas permit não bloqueia o fluxo de
--   trabalho — você pode pedir material antes do permit sair, OU o job pode
--   nem precisar de permit. Forçar como fase travava o Kanban.
--
-- Solução:
--   - permit_status ENUM (not_needed | pending | released) em jobs
--   - permit_released_at, permit_number, permit_notes
--   - permit_path / file_name / size / mime / uploaded_at (anexar PDF)
--   - Reuso bucket existente `job-extras` (já tem RLS owner-only)
--   - Jobs com current_phase='permit_released' migram automaticamente:
--     current_phase → 'planning', permit_status → 'released',
--     permit_released_at → updated_at
--
-- IMPORTANTE:
--   Type job_phase NÃO é alterado (manter compat com job_phase_history).
--   Lista JOB_PHASES no TS é que vai sem permit_released pra UI esconder.
--
-- =============================================================================

-- 1) Enum status do permit DO JOB
--    Nome 'job_permit_status' pra evitar conflito com enum 'permit_status'
--    já existente (criado em migration 0028 pros permits scraped — valores:
--    active, expired, completed, cancelled, unknown).
DO $$ BEGIN
  CREATE TYPE job_permit_status AS ENUM ('not_needed', 'pending', 'released');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) ADD COLUMNS em jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_status job_permit_status NOT NULL DEFAULT 'pending';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_released_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_number TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_path TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_file_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_size INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_mime TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS permit_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_permit_status ON jobs(permit_status);

COMMENT ON COLUMN jobs.permit_status IS
  'Status do permit do town/city: not_needed (job dispensa), pending (solicitado), released (aprovado).';

-- 3) BACKFILL: jobs em phase=permit_released ficam como released + voltam pra planning
UPDATE jobs
SET
  current_phase = 'planning',
  permit_status = 'released',
  permit_released_at = COALESCE(permit_released_at, updated_at)
WHERE current_phase = 'permit_released'
  AND permit_status = 'pending'; -- só migra se ainda não tiver outro status

-- Validação
SELECT
  permit_status,
  COUNT(*) AS jobs_count,
  COUNT(*) FILTER (WHERE permit_released_at IS NOT NULL) AS with_release_date,
  COUNT(*) FILTER (WHERE permit_path IS NOT NULL) AS with_pdf
FROM jobs
GROUP BY permit_status
ORDER BY permit_status;
