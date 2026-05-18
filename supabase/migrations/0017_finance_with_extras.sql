-- Migration 0017 — v_finance_monthly inclui extras aprovados no "Vendido"
-- Aplicada em: 2026-05-18
--
-- Motivo:
--   v_finance_monthly (criada em 0016) usava só SUM(jobs.value) na coluna
--   `sold`. Quando José aprova um Change Order, o valor extra precisa entrar
--   no "Vendido" do mês — senão a receita do mês fica mentirosa.
--
-- Regra de negócio:
--   - Contrato base do job: conta no mês de `contract_signed_at` (já era).
--   - Extra aprovado: conta no mês de `approved_at` (novo).
--   - Extra completed (foi aprovado em algum momento): também conta no mês
--     em que foi aprovado, não no completed_at.
--   - Extras rejected ou proposed (não aprovado): NÃO entram.
--
-- Decisão do dono (2026-05-18): extras contam no mês da aprovação, não no
-- mês do contrato original. Mais honesto financeiramente: a receita só foi
-- "vendida de verdade" quando o cliente aprovou o change order.
--
-- =============================================================================

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
  -- Contrato base = jobs assinados no mês
  SELECT
    date_trunc('month', contract_signed_at)::date AS month,
    SUM(value) AS total_amount,
    COUNT(*) AS sold_count
  FROM jobs
  GROUP BY 1
),
sold_extras AS (
  -- Extras aprovados no mês (status = approved OU completed, ambos passaram
  -- pela aprovação). approved_at é setado pelo trigger ao mudar status.
  SELECT
    date_trunc('month', approved_at)::date AS month,
    SUM(additional_value) AS total_amount
  FROM job_extras
  WHERE status IN ('approved', 'completed')
    AND approved_at IS NOT NULL
  GROUP BY 1
),
sold AS (
  -- Combina contratos + extras no mesmo mês
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
  SELECT
    month::date,
    SUM(amount) AS total_amount
  FROM ad_spend
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
SELECT month, sold, received, total_paid_out, cash_balance
FROM v_finance_monthly
WHERE month >= date_trunc('month', CURRENT_DATE - interval '3 months')
ORDER BY month DESC;
