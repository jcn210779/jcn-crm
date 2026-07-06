-- =============================================================================
-- CRM JCN — Migration 0049 — Pipeline do Flip (fases + inspeções + tarefas)
-- =============================================================================
-- Data: 2026-07-06
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE — pode rodar várias vezes sem quebrar.
--
-- Problema:
--   Módulo Flip hoje só tem P&L, aquisição, unidades, draws e budget lines.
--   Falta: sequência de trabalhos (pipeline), inspeções (cidade + interna),
--   e checklist de "o que fazer em cada casa". José precisa organizar a obra
--   ponta-a-ponta dentro do CRM.
--
-- Solução — 3 tabelas novas:
--   flip_phases       — etapas sequenciais da obra (template de 10 + editável)
--   flip_inspections  — inspeções da cidade E internas (data prevista/feita)
--   flip_tasks        — checklist consolidado do flip (opcionalmente linkada a fase)
--
-- Template automático: trigger AFTER INSERT em flip_details insere 10 fases
-- padrão em ordem. Idempotente — só insere se ainda não tem fase pro flip.
-- =============================================================================

-- =============================================================================
-- Enums
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flip_phase_status') THEN
    CREATE TYPE flip_phase_status AS ENUM ('pending', 'in_progress', 'completed', 'blocked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flip_inspection_type') THEN
    CREATE TYPE flip_inspection_type AS ENUM ('city', 'internal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flip_inspection_status') THEN
    CREATE TYPE flip_inspection_status AS ENUM ('scheduled', 'passed', 'failed', 'rescheduled', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flip_task_status') THEN
    CREATE TYPE flip_task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
  END IF;
END$$;

-- =============================================================================
-- flip_phases — sequência de trabalhos
-- =============================================================================
CREATE TABLE IF NOT EXISTS flip_phases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  flip_id           uuid NOT NULL REFERENCES flip_details(id) ON DELETE CASCADE,

  name              text NOT NULL,
  display_order     integer NOT NULL DEFAULT 0,
  status            flip_phase_status NOT NULL DEFAULT 'pending',

  target_end_date   date,
  started_at        date,
  completed_at      date,

  notes             text
);

CREATE INDEX IF NOT EXISTS idx_flip_phases_flip
  ON flip_phases(flip_id, display_order);

-- =============================================================================
-- flip_inspections — inspeções (cidade + interna)
-- =============================================================================
CREATE TABLE IF NOT EXISTS flip_inspections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  flip_id           uuid NOT NULL REFERENCES flip_details(id) ON DELETE CASCADE,

  type              flip_inspection_type NOT NULL DEFAULT 'city',
  name              text NOT NULL,                    -- ex "Framing inspection", "Revisão hidráulica interna"
  status            flip_inspection_status NOT NULL DEFAULT 'scheduled',

  scheduled_date    date,
  done_date         date,
  inspector         text,
  notes             text,

  -- Anexo opcional (foto do laudo, PDF) — bucket job-extras, path livre
  attachment_path       text,
  attachment_file_name  text,
  attachment_mime       text
);

CREATE INDEX IF NOT EXISTS idx_flip_inspections_flip
  ON flip_inspections(flip_id, scheduled_date);

-- =============================================================================
-- flip_tasks — checklist consolidado
-- =============================================================================
CREATE TABLE IF NOT EXISTS flip_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  flip_id           uuid NOT NULL REFERENCES flip_details(id) ON DELETE CASCADE,
  phase_id          uuid REFERENCES flip_phases(id) ON DELETE SET NULL,

  title             text NOT NULL,
  description       text,
  status            flip_task_status NOT NULL DEFAULT 'todo',
  display_order     integer NOT NULL DEFAULT 0,

  due_date          date,
  done_at           date,
  assigned_to       text                              -- texto livre por ora
);

CREATE INDEX IF NOT EXISTS idx_flip_tasks_flip
  ON flip_tasks(flip_id, display_order);
CREATE INDEX IF NOT EXISTS idx_flip_tasks_phase
  ON flip_tasks(phase_id) WHERE phase_id IS NOT NULL;

-- =============================================================================
-- Triggers updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_flip_planning_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_flip_phases_updated ON flip_phases;
CREATE TRIGGER trg_flip_phases_updated
  BEFORE UPDATE ON flip_phases
  FOR EACH ROW EXECUTE FUNCTION fn_flip_planning_touch_updated_at();

DROP TRIGGER IF EXISTS trg_flip_inspections_updated ON flip_inspections;
CREATE TRIGGER trg_flip_inspections_updated
  BEFORE UPDATE ON flip_inspections
  FOR EACH ROW EXECUTE FUNCTION fn_flip_planning_touch_updated_at();

DROP TRIGGER IF EXISTS trg_flip_tasks_updated ON flip_tasks;
CREATE TRIGGER trg_flip_tasks_updated
  BEFORE UPDATE ON flip_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_flip_planning_touch_updated_at();

-- =============================================================================
-- Template automático de 10 fases padrão ao criar flip_details
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_seed_default_flip_phases()
RETURNS trigger AS $$
BEGIN
  -- Idempotente: só insere se o flip ainda não tem fase nenhuma
  IF EXISTS (SELECT 1 FROM flip_phases WHERE flip_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO flip_phases (flip_id, name, display_order) VALUES
    (NEW.id, 'Demolição',                 1),
    (NEW.id, 'Estrutura / Framing',       2),
    (NEW.id, 'Elétrica (rough-in)',       3),
    (NEW.id, 'Hidráulica (rough-in)',     4),
    (NEW.id, 'HVAC',                       5),
    (NEW.id, 'Isolamento',                 6),
    (NEW.id, 'Drywall',                    7),
    (NEW.id, 'Piso e acabamento interno', 8),
    (NEW.id, 'Externo (siding/deck/telhado)', 9),
    (NEW.id, 'Limpeza e inspeção final',  10);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_default_flip_phases ON flip_details;
CREATE TRIGGER trg_seed_default_flip_phases
  AFTER INSERT ON flip_details
  FOR EACH ROW EXECUTE FUNCTION fn_seed_default_flip_phases();

-- Backfill: pra flips já existentes que não têm fase nenhuma
INSERT INTO flip_phases (flip_id, name, display_order)
SELECT fd.id, phase.name, phase.display_order
FROM flip_details fd
CROSS JOIN (VALUES
  ('Demolição', 1),
  ('Estrutura / Framing', 2),
  ('Elétrica (rough-in)', 3),
  ('Hidráulica (rough-in)', 4),
  ('HVAC', 5),
  ('Isolamento', 6),
  ('Drywall', 7),
  ('Piso e acabamento interno', 8),
  ('Externo (siding/deck/telhado)', 9),
  ('Limpeza e inspeção final', 10)
) AS phase(name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM flip_phases fp WHERE fp.flip_id = fd.id);

-- =============================================================================
-- RLS owner-only
-- =============================================================================
ALTER TABLE flip_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_flip_phases_owner_only ON flip_phases;
CREATE POLICY p_flip_phases_owner_only ON flip_phases FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

DROP POLICY IF EXISTS p_flip_inspections_owner_only ON flip_inspections;
CREATE POLICY p_flip_inspections_owner_only ON flip_inspections FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

DROP POLICY IF EXISTS p_flip_tasks_owner_only ON flip_tasks;
CREATE POLICY p_flip_tasks_owner_only ON flip_tasks FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- Validação
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM flip_details) AS total_flips,
  (SELECT COUNT(*) FROM flip_phases) AS total_phases,
  (SELECT COUNT(*) FROM flip_inspections) AS total_inspections,
  (SELECT COUNT(*) FROM flip_tasks) AS total_tasks;
