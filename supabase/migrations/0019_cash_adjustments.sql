-- Migration 0019 — tabela cash_adjustments + view v_finance_monthly recriada
-- Aplicada em: 2026-05-18
--
-- Motivo:
--   José precisa fazer backfill de Maio/2026 com valores brutos (jobs antigos
--   pré-CRM, reembolsos, etc) sem ter que reconstruir nota fiscal por nota.
--   A partir de Junho ele lança tudo granular (recibos, notas, payments).
--
-- Caso de uso amplo: qualquer ajuste de caixa não-job:
--   - Recebimento de obras antigas (pré-CRM)
--   - Reembolso de cliente / fornecedor
--   - Empréstimo bancário (entrada)
--   - Pró-labore tirada (saída)
--   - Devolução de imposto
--   - Qualquer "achei dinheiro na caixa" que não bate com job/business_expense
--
-- Não polui Kanban de Jobs (não cria ghost job).
-- Entra na view v_finance_monthly nos buckets `received` e `total_paid_out`
-- automaticamente.
--
-- =============================================================================

-- 0) Adiciona categoria 'payroll' (folha de pagamento) ao enum business_expense_category
--    pra lançar pagamento de funcionários como business_expense.
ALTER TYPE business_expense_category ADD VALUE IF NOT EXISTS 'payroll';

-- 1) Enum: tipo do ajuste
DROP TYPE IF EXISTS cash_adjustment_kind CASCADE;
CREATE TYPE cash_adjustment_kind AS ENUM (
  'income',   -- entrada de caixa
  'outflow'   -- saída de caixa
);

-- 2) Enum: fonte do ajuste (categorização opcional pra relatório)
DROP TYPE IF EXISTS cash_adjustment_source CASCADE;
CREATE TYPE cash_adjustment_source AS ENUM (
  'historical_job',     -- job antigo pré-CRM
  'refund',             -- reembolso recebido/devolvido
  'loan',               -- empréstimo bancário/pessoal
  'owner_draw',         -- pró-labore / retirada do dono
  'tax_return',         -- devolução de imposto
  'adjustment',         -- ajuste genérico (correção de caixa)
  'other'               -- outro
);

-- 3) Tabela cash_adjustments
CREATE TABLE IF NOT EXISTS cash_adjustments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  adjustment_date   date NOT NULL,
  kind              cash_adjustment_kind NOT NULL,
  source            cash_adjustment_source NOT NULL DEFAULT 'other',
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  description       text NOT NULL,
  notes             text
);

CREATE INDEX IF NOT EXISTS idx_cash_adjustments_date
  ON cash_adjustments(adjustment_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_adjustments_kind
  ON cash_adjustments(kind);

-- 4) Trigger updated_at automático
CREATE OR REPLACE FUNCTION fn_cash_adjustments_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cash_adjustments_set_updated_at ON cash_adjustments;
CREATE TRIGGER trg_cash_adjustments_set_updated_at
  BEFORE UPDATE ON cash_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION fn_cash_adjustments_set_updated_at();

-- 5) RLS owner-only
ALTER TABLE cash_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_cash_adjustments_owner_only ON cash_adjustments;
CREATE POLICY p_cash_adjustments_owner_only ON cash_adjustments FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- 6) Recria v_finance_monthly incluindo cash_adjustments
DROP VIEW IF EXISTS v_finance_monthly;

CREATE OR REPLACE VIEW v_finance_monthly AS
WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE - interval '12 months'),
    date_trunc('month', CURRENT_DATE + interval '1 month'),
    interval '1 month'
  )::date AS month
),
sold_contracts AS (
  SELECT
    date_trunc('month', contract_signed_at)::date AS month,
    SUM(value) AS total_amount,
    COUNT(*) AS sold_count
  FROM jobs
  GROUP BY 1
),
sold_extras AS (
  SELECT
    date_trunc('month', approved_at)::date AS month,
    SUM(additional_value) AS total_amount
  FROM job_extras
  WHERE status IN ('approved', 'completed')
    AND approved_at IS NOT NULL
  GROUP BY 1
),
sold AS (
  SELECT
    COALESCE(sc.month, se.month) AS month,
    COALESCE(sc.total_amount, 0) + COALESCE(se.total_amount, 0) AS total_sold,
    COALESCE(sc.sold_count, 0) AS sold_count
  FROM sold_contracts sc
  FULL OUTER JOIN sold_extras se ON se.month = sc.month
),
received_jobs AS (
  SELECT
    date_trunc('month', received_at)::date AS month,
    SUM(amount) AS total_amount,
    COUNT(*) AS cnt
  FROM job_payments
  WHERE status = 'paid' AND received_at IS NOT NULL
  GROUP BY 1
),
received_adjustments AS (
  SELECT
    date_trunc('month', adjustment_date)::date AS month,
    SUM(amount) AS total_amount,
    COUNT(*) AS cnt
  FROM cash_adjustments
  WHERE kind = 'income'
  GROUP BY 1
),
received AS (
  SELECT
    COALESCE(rj.month, ra.month) AS month,
    COALESCE(rj.total_amount, 0) + COALESCE(ra.total_amount, 0) AS total_received,
    COALESCE(rj.cnt, 0) + COALESCE(ra.cnt, 0) AS received_count
  FROM received_jobs rj
  FULL OUTER JOIN received_adjustments ra ON ra.month = rj.month
),
job_exp_cash AS (
  SELECT
    date_trunc('month', expense_date)::date AS month,
    SUM(amount) AS total_amount
  FROM job_expenses
  WHERE payment_method IS NULL OR payment_method != 'credit_card'
  GROUP BY 1
),
job_hours_cash AS (
  SELECT
    date_trunc('month', work_date)::date AS month,
    SUM(calculated_amount) AS total_amount
  FROM job_hours
  GROUP BY 1
),
job_subs_cash AS (
  SELECT
    date_trunc('month', COALESCE(completed_at, hired_at))::date AS month,
    SUM(agreed_value) AS total_amount
  FROM job_subcontractors
  WHERE status = 'completed'
  GROUP BY 1
),
ads_cash AS (
  SELECT
    month::date,
    SUM(amount) AS total_amount
  FROM ad_spend
  WHERE payment_method IS NULL OR payment_method != 'credit_card'
  GROUP BY 1
),
business_cash AS (
  SELECT
    date_trunc('month', expense_date)::date AS month,
    SUM(amount) AS total_amount
  FROM business_expenses
  GROUP BY 1
),
adjustments_outflow_cash AS (
  SELECT
    date_trunc('month', adjustment_date)::date AS month,
    SUM(amount) AS total_amount
  FROM cash_adjustments
  WHERE kind = 'outflow'
  GROUP BY 1
)
SELECT
  m.month,
  to_char(m.month, 'YYYY-MM') AS month_label,
  COALESCE(s.total_sold, 0)::numeric AS sold,
  COALESCE(s.sold_count, 0)::int AS sold_count,
  COALESCE(r.total_received, 0)::numeric AS received,
  COALESCE(r.received_count, 0)::int AS received_count,
  COALESCE(je.total_amount, 0)::numeric AS job_expenses_cash,
  COALESCE(jh.total_amount, 0)::numeric AS job_hours_cost,
  COALESCE(js.total_amount, 0)::numeric AS job_subs_cost,
  COALESCE(ads.total_amount, 0)::numeric AS ads_spend,
  COALESCE(be.total_amount, 0)::numeric AS business_expenses,
  COALESCE(ao.total_amount, 0)::numeric AS adjustments_outflow,
  (COALESCE(je.total_amount, 0)
    + COALESCE(jh.total_amount, 0)
    + COALESCE(js.total_amount, 0)
    + COALESCE(ads.total_amount, 0)
    + COALESCE(be.total_amount, 0)
    + COALESCE(ao.total_amount, 0))::numeric AS total_paid_out,
  (COALESCE(r.total_received, 0)
    - (COALESCE(je.total_amount, 0)
      + COALESCE(jh.total_amount, 0)
      + COALESCE(js.total_amount, 0)
      + COALESCE(ads.total_amount, 0)
      + COALESCE(be.total_amount, 0)
      + COALESCE(ao.total_amount, 0)))::numeric AS cash_balance
FROM months m
LEFT JOIN sold s ON s.month = m.month
LEFT JOIN received r ON r.month = m.month
LEFT JOIN job_exp_cash je ON je.month = m.month
LEFT JOIN job_hours_cash jh ON jh.month = m.month
LEFT JOIN job_subs_cash js ON js.month = m.month
LEFT JOIN ads_cash ads ON ads.month = m.month
LEFT JOIN business_cash be ON be.month = m.month
LEFT JOIN adjustments_outflow_cash ao ON ao.month = m.month
ORDER BY m.month DESC;

-- 7) Validação
SELECT month_label, sold, received, adjustments_outflow, total_paid_out, cash_balance
FROM v_finance_monthly
WHERE month >= date_trunc('month', CURRENT_DATE - interval '3 months')
ORDER BY month DESC;
