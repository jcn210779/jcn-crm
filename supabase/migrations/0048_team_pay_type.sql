-- =============================================================================
-- CRM JCN — Migration 0048 — Tipo de pagamento (hourly / weekly) no membro
-- =============================================================================
-- Data: 2026-06-26
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE — pode rodar várias vezes sem quebrar.
--
-- Problema:
--   Hoje team_members.hourly_rate assume que TODO funcionário é pago por hora.
--   Rafael (e outros futuros) recebe $1.300/semana FIXO, semana fechada
--   (independente de horas). Modelo atual não cabe.
--
-- Solução:
--   - pay_type: 'hourly' (default) | 'weekly'
--   - weekly_salary: valor fixo pago por semana fechada (só usado se 'weekly')
--   - hourly_rate continua existindo pra job_hours.hourly_rate_snapshot
--     (custo proporcional no P&L do job). Pra weekly, José seta um rate
--     proporcional (sugestão: weekly_salary / 40).
--
-- Backfill: todos existentes ficam 'hourly' (status quo).
-- =============================================================================

-- Enum pay_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_pay_type') THEN
    CREATE TYPE team_pay_type AS ENUM ('hourly', 'weekly');
  END IF;
END$$;

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS pay_type team_pay_type NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS weekly_salary numeric(10,2)
    CHECK (weekly_salary IS NULL OR weekly_salary >= 0);

COMMENT ON COLUMN team_members.pay_type IS
  'hourly = pago por hora (folha = SUM horas × hourly_rate). weekly = salário fixo semanal (folha = weekly_salary independente de horas).';
COMMENT ON COLUMN team_members.weekly_salary IS
  'Salário semanal fixo. Usado se pay_type=weekly. Pra weekly, hourly_rate ainda é guardado e usado em job_hours.hourly_rate_snapshot pra alocar custo ao P&L do job.';

-- Validação
SELECT id, name, pay_type, hourly_rate, weekly_salary
FROM team_members
ORDER BY name
LIMIT 10;
