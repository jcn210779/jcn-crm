-- =============================================================================
-- CRM JCN — Migration 0005 (Fase 4)
-- =============================================================================
-- Data: 2026-05-14
-- Autor: Victor (build) supervisionado por Pedro
-- Escopo: tabela jobs (obras em execução pós ganho)
--         + job_phase_history (audit de transições de fase)
--         + enum job_phase (7 fases: planning -> completed)
--         + trigger lead.stage='ganho' -> cria job automaticamente
--         + backfill pros 2 leads atuais em 'ganho' (David Baker + Nick parke)
--         + RLS owner-only (info@jcnconstructioninc.com)
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- =============================================================================

-- =============================================================================
-- 1. ENUM job_phase (7 fases da obra)
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE job_phase AS ENUM (
    'planning',
    'materials_ordered',
    'materials_arrived',
    'demo',
    'construction',
    'finishing',
    'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. TABELA jobs (lead virou venda assinada)
-- =============================================================================
-- 1 job por lead (unique index abaixo). lead permanece em stage='ganho' e o
-- relacionamento jobs.lead_id mantém a ligação. ON DELETE RESTRICT garante
-- que ninguém deleta lead que tem job — proteção extra contra erro humano.
CREATE TABLE IF NOT EXISTS jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,

  contract_signed_at  timestamptz NOT NULL DEFAULT now(),
  value               numeric(10,2) NOT NULL DEFAULT 0,

  expected_start      date,
  expected_end        date,
  actual_start        date,
  actual_end          date,

  current_phase       job_phase NOT NULL DEFAULT 'planning',
  notes               text
);

CREATE INDEX IF NOT EXISTS idx_jobs_phase ON jobs(current_phase);
CREATE INDEX IF NOT EXISTS idx_jobs_lead ON jobs(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_lead_unique ON jobs(lead_id);
-- Unique garante 1 job por lead.

-- =============================================================================
-- 3. TABELA job_phase_history (audit das transições de fase)
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_phase_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  phase       job_phase NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  notes       text
);

CREATE INDEX IF NOT EXISTS idx_job_phase_history_job ON job_phase_history(job_id);

-- =============================================================================
-- 4. TRIGGER: updated_at automático em jobs
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_jobs_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_set_updated_at ON jobs;
CREATE TRIGGER trg_jobs_set_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION fn_jobs_set_updated_at();

-- =============================================================================
-- 5. TRIGGER: ao mudar current_phase em jobs, fecha entry anterior em
--    job_phase_history + abre nova. Em INSERT, cria entry inicial.
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_jobs_log_phase_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO job_phase_history (job_id, phase, started_at, notes)
    VALUES (NEW.id, NEW.current_phase, now(), 'initial');
  ELSIF TG_OP = 'UPDATE' AND OLD.current_phase IS DISTINCT FROM NEW.current_phase THEN
    UPDATE job_phase_history
       SET ended_at = now()
     WHERE job_id = NEW.id AND ended_at IS NULL;
    INSERT INTO job_phase_history (job_id, phase, started_at)
    VALUES (NEW.id, NEW.current_phase, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_log_phase_change ON jobs;
CREATE TRIGGER trg_jobs_log_phase_change
  AFTER INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION fn_jobs_log_phase_change();

-- =============================================================================
-- 6. TRIGGER: ao lead virar 'ganho', cria job automaticamente.
--    ON CONFLICT (lead_id) DO NOTHING garante idempotência se rodar mais
--    de uma vez (lead que volta pra ganho não duplica job).
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_leads_auto_create_job()
RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'ganho' AND (OLD.stage IS NULL OR OLD.stage IS DISTINCT FROM 'ganho') THEN
    INSERT INTO jobs (lead_id, value, contract_signed_at, current_phase)
    VALUES (
      NEW.id,
      COALESCE(NEW.estimated_value, 0),
      now(),
      'planning'
    )
    ON CONFLICT (lead_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_auto_create_job ON leads;
CREATE TRIGGER trg_leads_auto_create_job
  AFTER INSERT OR UPDATE OF stage ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_leads_auto_create_job();

-- =============================================================================
-- 7. BACKFILL — cria jobs pros leads atuais em 'ganho' (David Baker, Nick parke)
--    ON CONFLICT garante idempotência se rodar mais de uma vez.
-- =============================================================================
INSERT INTO jobs (lead_id, value, contract_signed_at, current_phase)
SELECT id, COALESCE(estimated_value, 0), updated_at, 'planning'
FROM leads
WHERE stage = 'ganho'
ON CONFLICT (lead_id) DO NOTHING;

-- =============================================================================
-- 8. RLS owner-only (info@jcnconstructioninc.com)
-- =============================================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_phase_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_jobs_owner_only ON jobs;
CREATE POLICY p_jobs_owner_only ON jobs FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

DROP POLICY IF EXISTS p_job_phase_history_owner_only ON job_phase_history;
CREATE POLICY p_job_phase_history_owner_only ON job_phase_history FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- 9. VALIDAÇÃO
-- =============================================================================
SELECT COUNT(*) AS total_jobs FROM jobs;
-- Esperado: 2 (David Baker + Nick parke retroativos)
