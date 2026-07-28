-- =============================================================================
-- CRM JCN — Migration 0055 — Inspeções de permit por job (footing/framing/finish)
-- =============================================================================
-- Data: 2026-07-28
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   Jobs regulares (deck de cliente) tem inspeções da cidade durante a obra:
--   footing, framing, finish. Hoje nao ha lugar pra rastrear isso.
--   flip_inspections e so pra flips; jobs regulares precisam do proprio.
--
-- Solução:
--   Tabela job_inspections + enum de tipos + trigger que cria as 3 padrão
--   automaticamente quando permit_status vira 'released' (só cria se ainda
--   nao tem nenhuma inspeção pro job — idempotente).
--   Usuário pode adicionar/apagar/renomear e mudar status por click ciclável.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_inspection_type') THEN
    CREATE TYPE job_inspection_type AS ENUM (
      'footing', 'framing', 'finish', 'electrical', 'plumbing', 'other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_inspection_status') THEN
    CREATE TYPE job_inspection_status AS ENUM (
      'pending', 'scheduled', 'passed', 'failed', 'skipped'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS job_inspections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  job_id         uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  type           job_inspection_type NOT NULL DEFAULT 'other',
  name           text NOT NULL,
  status         job_inspection_status NOT NULL DEFAULT 'pending',

  scheduled_date timestamptz,
  done_date      timestamptz,
  inspector      text,
  notes          text,

  display_order  integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_job_inspections_job
  ON job_inspections(job_id, display_order);

CREATE INDEX IF NOT EXISTS idx_job_inspections_scheduled
  ON job_inspections(scheduled_date)
  WHERE status IN ('scheduled', 'pending');

COMMENT ON TABLE job_inspections IS
  'Inspeções da cidade durante a obra (footing/framing/finish/etc). 3 padrão criadas automaticamente quando permit_status = released.';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_job_inspections_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_inspections_touch ON job_inspections;
CREATE TRIGGER trg_job_inspections_touch
  BEFORE UPDATE ON job_inspections
  FOR EACH ROW EXECUTE FUNCTION fn_job_inspections_touch();

-- Trigger: cria as 3 padrão quando permit_status vira 'released'
-- Só cria se ainda não tem nenhuma inspeção pro job (idempotente).
CREATE OR REPLACE FUNCTION fn_seed_default_job_inspections()
RETURNS trigger AS $$
BEGIN
  IF NEW.permit_status = 'released'
     AND (OLD.permit_status IS DISTINCT FROM 'released')
     AND NOT EXISTS (SELECT 1 FROM job_inspections WHERE job_id = NEW.id)
  THEN
    INSERT INTO job_inspections (job_id, type, name, display_order) VALUES
      (NEW.id, 'footing', 'Footing', 1),
      (NEW.id, 'framing', 'Framing', 2),
      (NEW.id, 'finish', 'Finish', 3);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_default_job_inspections ON jobs;
CREATE TRIGGER trg_seed_default_job_inspections
  AFTER UPDATE OF permit_status ON jobs
  FOR EACH ROW EXECUTE FUNCTION fn_seed_default_job_inspections();

-- Backfill: pra jobs em fase ativa + permit_status='released' que ainda nao
-- tem inspeção, cria as 3 padrão.
INSERT INTO job_inspections (job_id, type, name, display_order)
SELECT j.id, phase.type::job_inspection_type, phase.name, phase.display_order
FROM jobs j
CROSS JOIN (VALUES
  ('footing', 'Footing', 1),
  ('framing', 'Framing', 2),
  ('finish', 'Finish', 3)
) AS phase(type, name, display_order)
WHERE j.permit_status = 'released'
  AND j.current_phase IN ('planning', 'materials_ordered', 'materials_delivered', 'work_in_progress')
  AND NOT EXISTS (SELECT 1 FROM job_inspections ji WHERE ji.job_id = j.id);

-- RLS owner-only
ALTER TABLE job_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_inspections_owner_only ON job_inspections;
CREATE POLICY p_job_inspections_owner_only ON job_inspections FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- Validação
SELECT
  (SELECT COUNT(*) FROM jobs WHERE permit_status = 'released') AS jobs_com_permit,
  (SELECT COUNT(*) FROM job_inspections) AS total_inspecoes,
  (SELECT COUNT(DISTINCT job_id) FROM job_inspections) AS jobs_com_inspecao;
