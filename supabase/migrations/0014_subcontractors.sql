-- =============================================================================
-- CRM JCN — Migration 0014 — Subempreiteiros (Fase 4.2H)
-- =============================================================================
-- Data: 2026-05-16
-- Autor: Victor (build) supervisionado por Pedro
-- Escopo: tabela `subcontractors` (cadastro global) + `job_subcontractors`
--         (vínculo por job) + 3 enums + 3 views (subs_summary, sub_stats,
--         v_job_margin recriada com total_subs).
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE — pode rodar várias vezes sem quebrar.
-- =============================================================================

DROP TYPE IF EXISTS subcontractor_specialty CASCADE;
CREATE TYPE subcontractor_specialty AS ENUM (
  'electrical',     -- elétrica
  'plumbing',       -- encanamento
  'painting',       -- pintura
  'roofing',        -- telhado
  'concrete',       -- concreto
  'framing',        -- estrutura/carpintaria
  'hvac',           -- ar condicionado/aquecimento
  'landscaping',    -- jardinagem/paisagismo
  'flooring',       -- piso
  'masonry',        -- alvenaria/pedra
  'other'
);

DROP TYPE IF EXISTS subcontractor_rate_type CASCADE;
CREATE TYPE subcontractor_rate_type AS ENUM (
  'per_service',  -- cobra valor fechado pelo serviço (mais comum)
  'hourly',       -- cobra por hora (raro mas existe)
  'per_unit'      -- cobra por unidade (ex: $/sqft, $/door)
);

DROP TYPE IF EXISTS job_subcontractor_status CASCADE;
CREATE TYPE job_subcontractor_status AS ENUM (
  'pending',       -- contratado, aguarda começar
  'in_progress',   -- trabalhando agora
  'completed',     -- terminou e foi pago
  'cancelled'      -- cancelou antes de terminar
);

-- =============================================================================
-- TABELA: subcontractors (cadastro global)
-- =============================================================================
CREATE TABLE IF NOT EXISTS subcontractors (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  name                  text NOT NULL,
  company_name          text,                      -- razão social se for empresa
  specialty             subcontractor_specialty NOT NULL DEFAULT 'other',
  specialty_detail      text,                      -- texto livre (ex: "elétrica residencial")

  default_rate_type     subcontractor_rate_type NOT NULL DEFAULT 'per_service',
  default_rate          numeric(10,2),             -- taxa de referência (opcional)

  phone                 text,
  email                 text,
  address               text,

  -- Status
  active                boolean NOT NULL DEFAULT true,
  preferred             boolean NOT NULL DEFAULT false,  -- destacar como favorito

  -- Licença / seguro (importante pra GC)
  license_number        text,
  license_expires_at    date,
  insurance_expires_at  date,

  notes                 text
);

CREATE INDEX IF NOT EXISTS idx_subcontractors_active ON subcontractors(active);
CREATE INDEX IF NOT EXISTS idx_subcontractors_specialty ON subcontractors(specialty);
CREATE INDEX IF NOT EXISTS idx_subcontractors_preferred ON subcontractors(preferred) WHERE preferred = true;

-- =============================================================================
-- TABELA: job_subcontractors (vínculo por job)
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_subcontractors (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  job_id                uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  subcontractor_id      uuid NOT NULL REFERENCES subcontractors(id) ON DELETE RESTRICT,

  -- Detalhes da contratação específica
  service_description   text NOT NULL,
  agreed_value          numeric(10,2) NOT NULL CHECK (agreed_value >= 0),

  status                job_subcontractor_status NOT NULL DEFAULT 'pending',

  hired_at              timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,

  notes                 text
);

CREATE INDEX IF NOT EXISTS idx_job_subs_job ON job_subcontractors(job_id);
CREATE INDEX IF NOT EXISTS idx_job_subs_sub ON job_subcontractors(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_job_subs_status ON job_subcontractors(status);

-- =============================================================================
-- TRIGGERS: updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_subcontractors_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subcontractors_set_updated_at ON subcontractors;
CREATE TRIGGER trg_subcontractors_set_updated_at
  BEFORE UPDATE ON subcontractors
  FOR EACH ROW EXECUTE FUNCTION fn_subcontractors_set_updated_at();

CREATE OR REPLACE FUNCTION fn_job_subs_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_subs_set_updated_at ON job_subcontractors;
CREATE TRIGGER trg_job_subs_set_updated_at
  BEFORE UPDATE ON job_subcontractors
  FOR EACH ROW EXECUTE FUNCTION fn_job_subs_set_updated_at();

-- TRIGGER: timestamps automáticos por status
-- Em transição de status, preenche o timestamp correspondente se ainda for null.
-- Status 'pending' (default inicial) não preenche nada — é o estado base.
CREATE OR REPLACE FUNCTION fn_job_subs_status_timestamp()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'in_progress' THEN
      NEW.started_at := COALESCE(NEW.started_at, now());
    ELSIF NEW.status = 'completed' THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSIF NEW.status = 'cancelled' THEN
      NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_subs_status_timestamp ON job_subcontractors;
CREATE TRIGGER trg_job_subs_status_timestamp
  BEFORE UPDATE ON job_subcontractors
  FOR EACH ROW EXECUTE FUNCTION fn_job_subs_status_timestamp();

-- =============================================================================
-- RLS: owner-only (info@jcnconstructioninc.com)
-- =============================================================================
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_subcontractors_owner_only ON subcontractors;
CREATE POLICY p_subcontractors_owner_only ON subcontractors FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

ALTER TABLE job_subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_subs_owner_only ON job_subcontractors;
CREATE POLICY p_job_subs_owner_only ON job_subcontractors FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- VIEW: v_job_subs_summary (subs ativos/concluídos por job)
-- =============================================================================
CREATE OR REPLACE VIEW v_job_subs_summary AS
SELECT
  job_id,
  COUNT(*) AS sub_count,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COALESCE(SUM(agreed_value) FILTER (WHERE status IN ('in_progress', 'completed')), 0)
    AS active_sub_cost,
  COALESCE(SUM(agreed_value) FILTER (WHERE status = 'completed'), 0)
    AS completed_sub_cost
FROM job_subcontractors
GROUP BY job_id;

-- =============================================================================
-- VIEW: v_subcontractor_stats (histórico por sub)
-- =============================================================================
CREATE OR REPLACE VIEW v_subcontractor_stats AS
SELECT
  subcontractor_id,
  COUNT(*) AS total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs,
  COALESCE(SUM(agreed_value) FILTER (WHERE status = 'completed'), 0)
    AS total_value_paid,
  MAX(hired_at) AS last_hired_at
FROM job_subcontractors
GROUP BY subcontractor_id;

-- =============================================================================
-- VIEW: v_job_margin RECRIADA — agora considera subs ativos/concluídos
-- Fórmula: (contrato + extras_aprovados) - despesas - horas - subs_ativos
-- =============================================================================
DROP VIEW IF EXISTS v_job_margin;
CREATE OR REPLACE VIEW v_job_margin AS
SELECT
  j.id AS job_id,
  j.value AS contract_value,
  COALESCE(xs.approved_value_total, 0) AS approved_extras_value,
  j.value + COALESCE(xs.approved_value_total, 0) AS effective_contract_value,
  COALESCE(es.total_expenses, 0) AS total_expenses,
  COALESCE(hs.total_labor_cost, 0) AS total_labor,
  COALESCE(ss.active_sub_cost, 0) AS total_subs,
  (j.value + COALESCE(xs.approved_value_total, 0))
    - COALESCE(es.total_expenses, 0)
    - COALESCE(hs.total_labor_cost, 0)
    - COALESCE(ss.active_sub_cost, 0)
    AS estimated_margin,
  CASE
    WHEN (j.value + COALESCE(xs.approved_value_total, 0)) > 0 THEN
      ROUND(
        (((j.value + COALESCE(xs.approved_value_total, 0))
          - COALESCE(es.total_expenses, 0)
          - COALESCE(hs.total_labor_cost, 0)
          - COALESCE(ss.active_sub_cost, 0))
          / (j.value + COALESCE(xs.approved_value_total, 0)) * 100)::numeric, 1
      )
    ELSE NULL
  END AS margin_percent
FROM jobs j
LEFT JOIN v_job_expense_summary es ON es.job_id = j.id
LEFT JOIN v_job_hours_summary hs ON hs.job_id = j.id
LEFT JOIN v_job_extras_summary xs ON xs.job_id = j.id
LEFT JOIN v_job_subs_summary ss ON ss.job_id = j.id;
