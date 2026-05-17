-- Migration 0015 — diário de obra (daily logs por job)
-- Aplicada em: 2026-05-16
-- IDEMPOTENTE: pode rodar 2x sem erro

DROP TYPE IF EXISTS weather_condition CASCADE;
CREATE TYPE weather_condition AS ENUM (
  'sunny',
  'cloudy',
  'rainy',
  'stormy',
  'snowy',
  'windy',
  'hot',
  'cold',
  'other'
);

DROP TYPE IF EXISTS daily_log_type CASCADE;
CREATE TYPE daily_log_type AS ENUM (
  'progress',     -- ✅ progresso normal
  'problem',      -- ⚠️ problema encontrado
  'blocker',      -- 🛑 bloqueio (precisa resolver pra continuar)
  'observation',  -- 💡 observação / nota geral
  'inspection',   -- 🔍 inspeção / visita
  'client_visit'  -- 👤 cliente passou na obra
);

CREATE TABLE IF NOT EXISTS job_daily_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  log_date        date NOT NULL DEFAULT CURRENT_DATE,
  content         text NOT NULL,

  weather         weather_condition,
  entry_type      daily_log_type NOT NULL DEFAULT 'progress',

  created_by      text NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_job_daily_logs_job ON job_daily_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_daily_logs_date ON job_daily_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_daily_logs_type ON job_daily_logs(entry_type);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_job_daily_logs_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_daily_logs_set_updated_at ON job_daily_logs;
CREATE TRIGGER trg_job_daily_logs_set_updated_at
  BEFORE UPDATE ON job_daily_logs
  FOR EACH ROW EXECUTE FUNCTION fn_job_daily_logs_set_updated_at();

-- RLS owner-only
ALTER TABLE job_daily_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_daily_logs_owner_only ON job_daily_logs;
CREATE POLICY p_job_daily_logs_owner_only ON job_daily_logs FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- View: resumo de daily logs por job
CREATE OR REPLACE VIEW v_job_daily_logs_summary AS
SELECT
  job_id,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE entry_type = 'problem') AS problem_count,
  COUNT(*) FILTER (WHERE entry_type = 'blocker') AS blocker_count,
  MAX(log_date) AS last_log_date,
  MIN(log_date) AS first_log_date
FROM job_daily_logs
GROUP BY job_id;

-- Validação
SELECT count(*) AS total_logs FROM job_daily_logs;
