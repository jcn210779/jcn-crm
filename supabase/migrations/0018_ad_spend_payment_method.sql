-- Migration 0018 — payment_method em ad_spend + recálculo do caixa
-- Aplicada em: 2026-05-18
--
-- Motivo:
--   José paga maior parte dos Ads no cartão de crédito. Hoje, v_finance_monthly
--   trata todo ad_spend como saída de caixa do mês — o que double-counta quando
--   a fatura do cartão é paga depois via business_expenses.
--
-- Solução (mesmo padrão de job_expenses da migration 0016):
--   1. Coluna payment_method nullable em ad_spend (reusa enum payment_method).
--   2. v_finance_monthly: ads_cash filtra fora 'credit_card' (igual job_expenses).
--   3. Quando José pagar a fatura do cartão, registra business_expense
--      categoria 'credit_card_bill' (ou 'marketing' se quiser separar) — aí entra
--      no caixa real.
--
-- Regra de granularidade: 1 método POR linha (mês × fonte), decidido pelo José
-- 2026-05-18. Permite LSA no débito e Meta no cartão no mesmo mês.
--
-- =============================================================================

-- 1) Adiciona payment_method em ad_spend
ALTER TABLE ad_spend
  ADD COLUMN IF NOT EXISTS payment_method payment_method;

COMMENT ON COLUMN ad_spend.payment_method IS
  'Como o spend foi pago. NULL = legado (entra no caixa). credit_card = NÃO entra no caixa até fatura ser paga via business_expenses.';

-- 2) Recria v_finance_monthly filtrando credit_card no ads_cash
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
received AS (
  SELECT
    date_trunc('month', received_at)::date AS month,
    SUM(amount) AS total_received,
    COUNT(*) AS received_count
  FROM job_payments
  WHERE status = 'paid' AND received_at IS NOT NULL
  GROUP BY 1
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
  -- Ads que SAÍRAM do caixa (NÃO inclui credit_card — entra só via business_expenses)
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
  (COALESCE(je.total_amount, 0)
    + COALESCE(jh.total_amount, 0)
    + COALESCE(js.total_amount, 0)
    + COALESCE(ads.total_amount, 0)
    + COALESCE(be.total_amount, 0))::numeric AS total_paid_out,
  (COALESCE(r.total_received, 0)
    - (COALESCE(je.total_amount, 0)
      + COALESCE(jh.total_amount, 0)
      + COALESCE(js.total_amount, 0)
      + COALESCE(ads.total_amount, 0)
      + COALESCE(be.total_amount, 0)))::numeric AS cash_balance
FROM months m
LEFT JOIN sold s ON s.month = m.month
LEFT JOIN received r ON r.month = m.month
LEFT JOIN job_exp_cash je ON je.month = m.month
LEFT JOIN job_hours_cash jh ON jh.month = m.month
LEFT JOIN job_subs_cash js ON js.month = m.month
LEFT JOIN ads_cash ads ON ads.month = m.month
LEFT JOIN business_cash be ON be.month = m.month
ORDER BY m.month DESC;

-- Validação
SELECT month_label, sold, received, ads_spend, total_paid_out, cash_balance
FROM v_finance_monthly
WHERE month >= date_trunc('month', CURRENT_DATE - interval '3 months')
ORDER BY month DESC;
