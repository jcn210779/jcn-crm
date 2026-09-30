-- ============================================================================
-- 0067 — v_finance_monthly: excluir credit_card de business_expenses e ad_spend
-- ============================================================================
-- Bug: mig 0052 aplicou o filtro `payment_method != 'credit_card'` só em
-- `job_expenses`. `business_expenses` e `ad_spend` ficaram sem, então TODO
-- BE ou ad_spend no cartão entra no caixa duas vezes:
--   (1) no dia da compra (BE com payment_method='credit_card')
--   (2) no dia do pagamento da fatura (BE nova "CREDIT CARD PAYMENT" com
--       payment_method='check' ou 'wire_transfer')
--
-- Regra correta: gasto no cartão NÃO afeta caixa até a fatura ser paga.
-- Só o pagamento da fatura (que já é registrado como BE separado com
-- payment_method != credit_card) conta como saída de caixa.
--
-- Fix: adicionar `AND (payment_method IS NULL OR payment_method != 'credit_card')`
-- nos dois CTEs (business_cash, ads_cash). Mesmo padrão de job_exp_cash.

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
    date_trunc('month', j.contract_signed_at)::date AS month,
    SUM(j.value) AS total_amount,
    COUNT(*) AS sold_count
  FROM jobs j
  WHERE j.is_flip = false
  GROUP BY 1
),
sold_extras AS (
  SELECT
    date_trunc('month', je.approved_at)::date AS month,
    SUM(je.additional_value) AS total_amount
  FROM job_extras je
  JOIN jobs j ON j.id = je.job_id
  WHERE je.status IN ('approved', 'completed')
    AND je.approved_at IS NOT NULL
    AND j.is_flip = false
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
    date_trunc('month', p.received_at)::date AS month,
    SUM(p.amount) AS total_received,
    COUNT(*) AS received_count
  FROM job_payments p
  JOIN jobs j ON j.id = p.job_id
  WHERE p.status = 'paid'
    AND p.received_at IS NOT NULL
    AND j.is_flip = false
  GROUP BY 1
),
job_exp_cash AS (
  SELECT
    date_trunc('month', e.expense_date)::date AS month,
    SUM(e.amount) AS total_amount
  FROM job_expenses e
  JOIN jobs j ON j.id = e.job_id
  WHERE (e.payment_method IS NULL OR e.payment_method != 'credit_card')
    AND j.is_flip = false
  GROUP BY 1
),
job_hours_cash AS (
  SELECT
    date_trunc('month', h.work_date)::date AS month,
    SUM(h.calculated_amount) AS total_amount
  FROM job_hours h
  JOIN jobs j ON j.id = h.job_id
  WHERE j.is_flip = false
  GROUP BY 1
),
job_subs_cash AS (
  SELECT
    date_trunc('month', COALESCE(js.completed_at, js.hired_at))::date AS month,
    SUM(js.agreed_value) AS total_amount
  FROM job_subcontractors js
  JOIN jobs j ON j.id = js.job_id
  WHERE js.status = 'completed'
    AND j.is_flip = false
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
  WHERE is_flip = false
    AND (payment_method IS NULL OR payment_method != 'credit_card')
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
