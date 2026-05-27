-- Migration 0031 — Excluir vendor_account das views de caixa (igual credit_card)
-- Aplicada em: 2026-05-27
--
-- Depende de: 0030 (que adiciona o ENUM value 'vendor_account')
--
-- Recria v_finance_monthly e v_account_balance pra tratar 'vendor_account'
-- igual 'credit_card': NÃO entra no caixa até fatura ser paga via
-- business_expense.
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
  SELECT date_trunc('month', contract_signed_at)::date AS month,
    SUM(value) AS total_amount, COUNT(*) AS sold_count
  FROM jobs GROUP BY 1
),
sold_extras AS (
  SELECT date_trunc('month', approved_at)::date AS month,
    SUM(additional_value) AS total_amount
  FROM job_extras
  WHERE status IN ('approved', 'completed') AND approved_at IS NOT NULL
  GROUP BY 1
),
sold AS (
  SELECT COALESCE(sc.month, se.month) AS month,
    COALESCE(sc.total_amount, 0) + COALESCE(se.total_amount, 0) AS total_sold,
    COALESCE(sc.sold_count, 0) AS sold_count
  FROM sold_contracts sc FULL OUTER JOIN sold_extras se ON se.month = sc.month
),
received_jobs AS (
  SELECT date_trunc('month', received_at)::date AS month,
    SUM(amount) AS total_amount, COUNT(*) AS cnt
  FROM job_payments
  WHERE status = 'paid' AND received_at IS NOT NULL
  GROUP BY 1
),
received_adjustments AS (
  SELECT date_trunc('month', adjustment_date)::date AS month,
    SUM(amount) AS total_amount, COUNT(*) AS cnt
  FROM cash_adjustments WHERE kind = 'income' GROUP BY 1
),
received AS (
  SELECT COALESCE(rj.month, ra.month) AS month,
    COALESCE(rj.total_amount, 0) + COALESCE(ra.total_amount, 0) AS total_received,
    COALESCE(rj.cnt, 0) + COALESCE(ra.cnt, 0) AS received_count
  FROM received_jobs rj FULL OUTER JOIN received_adjustments ra ON ra.month = rj.month
),
job_exp_cash AS (
  SELECT date_trunc('month', expense_date)::date AS month, SUM(amount) AS total_amount
  FROM job_expenses
  WHERE payment_method IS NULL
    OR (payment_method != 'credit_card' AND payment_method != 'vendor_account')
  GROUP BY 1
),
job_hours_info AS (
  SELECT date_trunc('month', work_date)::date AS month, SUM(calculated_amount) AS total_amount
  FROM job_hours GROUP BY 1
),
job_subs_cash AS (
  SELECT date_trunc('month', COALESCE(completed_at, hired_at))::date AS month,
    SUM(agreed_value) AS total_amount
  FROM job_subcontractors WHERE status = 'completed' GROUP BY 1
),
ads_cash AS (
  SELECT month::date, SUM(amount) AS total_amount FROM ad_spend
  WHERE payment_method IS NULL
    OR (payment_method != 'credit_card' AND payment_method != 'vendor_account')
  GROUP BY 1
),
business_cash AS (
  SELECT date_trunc('month', expense_date)::date AS month, SUM(amount) AS total_amount
  FROM business_expenses
  WHERE payment_method IS NULL
    OR (payment_method != 'credit_card' AND payment_method != 'vendor_account')
  GROUP BY 1
),
adjustments_outflow_cash AS (
  SELECT date_trunc('month', adjustment_date)::date AS month, SUM(amount) AS total_amount
  FROM cash_adjustments
  WHERE kind = 'outflow'
    AND (payment_method IS NULL
      OR (payment_method != 'credit_card' AND payment_method != 'vendor_account'))
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
  (COALESCE(je.total_amount, 0) + COALESCE(js.total_amount, 0)
    + COALESCE(ads.total_amount, 0) + COALESCE(be.total_amount, 0)
    + COALESCE(ao.total_amount, 0))::numeric AS total_paid_out,
  (COALESCE(r.total_received, 0)
    - (COALESCE(je.total_amount, 0) + COALESCE(js.total_amount, 0)
       + COALESCE(ads.total_amount, 0) + COALESCE(be.total_amount, 0)
       + COALESCE(ao.total_amount, 0)))::numeric AS cash_balance
FROM months m
LEFT JOIN sold s ON s.month = m.month
LEFT JOIN received r ON r.month = m.month
LEFT JOIN job_exp_cash je ON je.month = m.month
LEFT JOIN job_hours_info jh ON jh.month = m.month
LEFT JOIN job_subs_cash js ON js.month = m.month
LEFT JOIN ads_cash ads ON ads.month = m.month
LEFT JOIN business_cash be ON be.month = m.month
LEFT JOIN adjustments_outflow_cash ao ON ao.month = m.month
ORDER BY m.month DESC;

-- v_account_balance
DROP VIEW IF EXISTS v_account_balance;
CREATE OR REPLACE VIEW v_account_balance AS
WITH
inflows_cash AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM job_payments
  WHERE status = 'paid' AND method = 'cash'
  UNION ALL
  SELECT COALESCE(SUM(amount), 0) FROM cash_adjustments
  WHERE kind = 'income' AND payment_method = 'cash'
),
inflows_bank AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM job_payments
  WHERE status = 'paid' AND (method IS NULL OR method != 'cash')
  UNION ALL
  SELECT COALESCE(SUM(amount), 0) FROM cash_adjustments
  WHERE kind = 'income' AND (payment_method IS NULL OR payment_method != 'cash')
),
outflows_cash AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM job_expenses WHERE payment_method = 'cash'
  UNION ALL SELECT COALESCE(SUM(amount), 0) FROM ad_spend WHERE payment_method = 'cash'
  UNION ALL SELECT COALESCE(SUM(amount), 0) FROM business_expenses WHERE payment_method = 'cash'
  UNION ALL SELECT COALESCE(SUM(amount), 0) FROM cash_adjustments
    WHERE kind = 'outflow' AND payment_method = 'cash'
),
outflows_bank AS (
  -- job_expenses banco: tudo que NÃO é cash, credit_card, vendor_account
  SELECT COALESCE(SUM(amount), 0) AS total FROM job_expenses
  WHERE (payment_method IS NULL OR
    (payment_method != 'cash' AND payment_method != 'credit_card'
     AND payment_method != 'vendor_account'))
  UNION ALL SELECT COALESCE(SUM(agreed_value), 0) FROM job_subcontractors WHERE status = 'completed'
  UNION ALL SELECT COALESCE(SUM(amount), 0) FROM ad_spend
    WHERE (payment_method IS NULL OR
      (payment_method != 'cash' AND payment_method != 'credit_card'
       AND payment_method != 'vendor_account'))
  UNION ALL SELECT COALESCE(SUM(amount), 0) FROM business_expenses
    WHERE (payment_method IS NULL OR
      (payment_method != 'cash' AND payment_method != 'credit_card'
       AND payment_method != 'vendor_account'))
  UNION ALL SELECT COALESCE(SUM(amount), 0) FROM cash_adjustments
    WHERE kind = 'outflow' AND (payment_method IS NULL OR
      (payment_method != 'cash' AND payment_method != 'credit_card'
       AND payment_method != 'vendor_account'))
)
SELECT
  (SELECT SUM(total) FROM inflows_cash)::numeric AS cash_inflows,
  (SELECT SUM(total) FROM outflows_cash)::numeric AS cash_outflows,
  (SELECT SUM(total) FROM inflows_cash) - (SELECT SUM(total) FROM outflows_cash) AS cash_balance,
  (SELECT SUM(total) FROM inflows_bank)::numeric AS bank_inflows,
  (SELECT SUM(total) FROM outflows_bank)::numeric AS bank_outflows,
  (SELECT SUM(total) FROM inflows_bank) - (SELECT SUM(total) FROM outflows_bank) AS bank_balance,
  ((SELECT SUM(total) FROM inflows_cash) - (SELECT SUM(total) FROM outflows_cash))
    + ((SELECT SUM(total) FROM inflows_bank) - (SELECT SUM(total) FROM outflows_bank))
    AS total_balance;
