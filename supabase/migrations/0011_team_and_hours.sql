-- Migration 0011 — team members + horas trabalhadas por job + margem expandida
-- Aplicada em: 2026-05-16
--
-- Escopo Fase 4.2E:
--   José quer trackear horas dos funcionários por job, com cálculo automático
--   de mão de obra (hours × hourly_rate). Funcionários são compartilhados
--   entre jobs (1 lista global em /team) e a taxa é fixa por funcionário, mas
--   gravamos snapshot da taxa em cada entrada de horas pra preservar histórico
--   se a taxa mudar depois.
--
-- Decisões do dono:
--   - Funcionários COMPARTILHADOS entre jobs (não duplicar cadastro por obra)
--   - Taxa FIXA por funcionário (não customizável por job)
--   - Snapshot da taxa em cada entrada de job_hours (histórico preservado)
--   - Margem do job agora considera DESPESAS + HORAS TRABALHADAS
--
-- Notas de design:
--   - team_members: cadastro global, soft delete via `active=false` se já
--     houver horas registradas (FK RESTRICT impede DELETE).
--   - job_hours: cada entrada referencia member + job + work_date + hours.
--     Coluna calculada GENERATED ALWAYS pra calculated_amount (PG 12+).
--   - View v_job_hours_summary: total de horas e total de mão de obra por job.
--   - View v_job_margin: recriada incluindo total_labor na conta.
--   - RLS owner-only (padrão Fase 1+).
--
-- Idempotência:
--   Esta migration usa IF EXISTS/IF NOT EXISTS sempre que possível e DROP TYPE
--   IF EXISTS CASCADE no topo, pra José poder rodar 2x sem erro caso já tenha
--   aplicado parcialmente.
--
-- =============================================================================
-- Limpeza idempotente (caso já tenha rodado parcialmente)
-- =============================================================================

DROP VIEW IF EXISTS v_job_margin;
DROP VIEW IF EXISTS v_job_hours_summary;
DROP TABLE IF EXISTS job_hours;
DROP TABLE IF EXISTS team_members;
DROP TYPE IF EXISTS team_role CASCADE;

-- =============================================================================
-- Enum: papel do funcionário
-- =============================================================================

CREATE TYPE team_role AS ENUM (
  'helper',         -- ajudante geral
  'skilled',        -- técnico (carpinteiro, instalador qualificado)
  'foreman',        -- líder de equipe na obra
  'subcontractor',  -- subempreiteiro contratado por hora
  'other'
);

-- =============================================================================
-- Tabela team_members (cadastro global de funcionários)
-- =============================================================================

CREATE TABLE team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  name          text NOT NULL,
  role          team_role NOT NULL DEFAULT 'helper',
  hourly_rate   numeric(8,2) NOT NULL CHECK (hourly_rate >= 0),
  phone         text,
  email         text,
  active        boolean NOT NULL DEFAULT true,
  notes         text
);

CREATE INDEX idx_team_members_active ON team_members(active);
CREATE INDEX idx_team_members_name ON team_members(name);

-- =============================================================================
-- Tabela job_hours (registros de horas por job + funcionário)
-- =============================================================================

CREATE TABLE job_hours (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  job_id                uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  member_id             uuid NOT NULL REFERENCES team_members(id) ON DELETE RESTRICT,

  work_date             date NOT NULL DEFAULT CURRENT_DATE,
  hours                 numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),

  -- Snapshot da taxa do funcionário no momento do registro
  -- (preserva histórico caso a taxa mude depois)
  hourly_rate_snapshot  numeric(8,2) NOT NULL CHECK (hourly_rate_snapshot >= 0),

  -- Coluna calculada (PG 12+): hours × hourly_rate_snapshot
  calculated_amount     numeric(10,2) GENERATED ALWAYS AS
    (ROUND((hours * hourly_rate_snapshot)::numeric, 2)) STORED,

  notes                 text
);

CREATE INDEX idx_job_hours_job ON job_hours(job_id);
CREATE INDEX idx_job_hours_member ON job_hours(member_id);
CREATE INDEX idx_job_hours_date ON job_hours(work_date DESC);

-- =============================================================================
-- Triggers updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_team_members_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_members_set_updated_at ON team_members;
CREATE TRIGGER trg_team_members_set_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_team_members_set_updated_at();

CREATE OR REPLACE FUNCTION fn_job_hours_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_hours_set_updated_at ON job_hours;
CREATE TRIGGER trg_job_hours_set_updated_at
  BEFORE UPDATE ON job_hours
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_hours_set_updated_at();

-- =============================================================================
-- RLS owner-only
-- =============================================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_team_members_owner_only ON team_members;
CREATE POLICY p_team_members_owner_only ON team_members FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

ALTER TABLE job_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_hours_owner_only ON job_hours;
CREATE POLICY p_job_hours_owner_only ON job_hours FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- View: resumo de horas por job
-- =============================================================================

CREATE OR REPLACE VIEW v_job_hours_summary AS
SELECT
  job_id,
  COUNT(*) AS entry_count,
  COALESCE(SUM(hours), 0) AS total_hours,
  COALESCE(SUM(calculated_amount), 0) AS total_labor_cost
FROM job_hours
GROUP BY job_id;

-- =============================================================================
-- View: margem do job (contrato - despesas - mão de obra)
-- =============================================================================

CREATE OR REPLACE VIEW v_job_margin AS
SELECT
  j.id AS job_id,
  j.value AS contract_value,
  COALESCE(es.total_expenses, 0) AS total_expenses,
  COALESCE(hs.total_labor_cost, 0) AS total_labor,
  j.value - COALESCE(es.total_expenses, 0) - COALESCE(hs.total_labor_cost, 0)
    AS estimated_margin,
  CASE
    WHEN j.value > 0 THEN
      ROUND(
        ((j.value - COALESCE(es.total_expenses, 0) - COALESCE(hs.total_labor_cost, 0))
          / j.value * 100)::numeric, 1
      )
    ELSE NULL
  END AS margin_percent
FROM jobs j
LEFT JOIN v_job_expense_summary es ON es.job_id = j.id
LEFT JOIN v_job_hours_summary hs ON hs.job_id = j.id;

-- =============================================================================
-- Validação final
-- =============================================================================

SELECT * FROM team_members LIMIT 5;
SELECT * FROM job_hours LIMIT 5;
SELECT * FROM v_job_hours_summary LIMIT 5;
SELECT * FROM v_job_margin LIMIT 5;
