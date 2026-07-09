-- =============================================================================
-- CRM JCN — Migration 0054 — Retorno de material (devolução) em job_expenses
-- =============================================================================
-- Data: 2026-07-09
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   José compra material da obra (lança como despesa), termina obra, sobra
--   material, DEVOLVE pra loja e recebe crédito de volta. Hoje job_expenses
--   só aceita compra (amount > 0). Faltava registrar a devolução — que
--   REDUZ o gasto real do job e reflete no /finance.
--
-- Solução:
--   Enum expense_kind ('purchase' | 'return') + coluna kind em job_expenses.
--   Amount continua positivo (semantic clean). View v_job_expense_summary e
--   v_finance_monthly reescritas com CASE WHEN kind='return' THEN -amount
--   pra calcular NET.
--
-- Backfill: todos os expenses existentes ficam 'purchase' (default).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_kind') THEN
    CREATE TYPE expense_kind AS ENUM ('purchase', 'return');
  END IF;
END$$;

ALTER TABLE job_expenses
  ADD COLUMN IF NOT EXISTS kind expense_kind NOT NULL DEFAULT 'purchase';

CREATE INDEX IF NOT EXISTS idx_job_expenses_kind
  ON job_expenses(kind);

COMMENT ON COLUMN job_expenses.kind IS
  'purchase = compra (soma no total do job). return = devolução (subtrai). Amount continua positivo (o sinal vem do kind).';

-- =============================================================================
-- Recriar v_job_expense_summary com NET (purchases - returns).
-- CASCADE porque v_job_margin depende. Recriamos v_job_margin logo abaixo.
-- =============================================================================
DROP VIEW IF EXISTS v_job_expense_summary CASCADE;

CREATE OR REPLACE VIEW v_job_expense_summary AS
SELECT
  job_id,
  COUNT(*) FILTER (WHERE kind = 'purchase') AS expense_count,
  COUNT(*) FILTER (WHERE kind = 'return') AS return_count,
  COALESCE(SUM(amount) FILTER (WHERE kind = 'purchase'), 0) AS gross_expenses,
  COALESCE(SUM(amount) FILTER (WHERE kind = 'return'), 0) AS returns_total,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END), 0) AS total_expenses,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END) FILTER (WHERE category = 'materials'), 0) AS materials_total,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END) FILTER (WHERE category = 'labor'), 0) AS labor_total,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END) FILTER (WHERE category = 'permit'), 0) AS permit_total,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END) FILTER (WHERE category = 'subcontractor'), 0) AS subcontractor_total,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END) FILTER (WHERE category = 'equipment'), 0) AS equipment_total,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END) FILTER (WHERE category = 'transport'), 0) AS transport_total,
  COALESCE(SUM(CASE WHEN kind = 'return' THEN -amount ELSE amount END) FILTER (WHERE category = 'other'), 0) AS other_total
FROM job_expenses
GROUP BY job_id;

-- =============================================================================
-- Recriar v_job_margin (dropada pelo CASCADE acima) — idêntica à mig 0014,
-- só a semântica de total_expenses agora é NET (compra - devolução).
-- =============================================================================
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

-- =============================================================================
-- Recriar v_finance_monthly com net de job_expenses (purchase - return)
-- (mantém o filtro is_flip da mig 0052)
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
  SELECT date_trunc('month', j.contract_signed_at)::date AS month,
    SUM(j.value) AS total_amount, COUNT(*) AS sold_count
  FROM jobs j WHERE j.is_flip = false GROUP BY 1
),
sold_extras AS (
  SELECT date_trunc('month', je.approved_at)::date AS month,
    SUM(je.additional_value) AS total_amount
  FROM job_extras je JOIN jobs j ON j.id = je.job_id
  WHERE je.status IN ('approved', 'completed')
    AND je.approved_at IS NOT NULL AND j.is_flip = false GROUP BY 1
),
sold AS (
  SELECT COALESCE(sc.month, se.month) AS month,
    COALESCE(sc.total_amount, 0) + COALESCE(se.total_amount, 0) AS total_sold,
    COALESCE(sc.sold_count, 0) AS sold_count
  FROM sold_contracts sc FULL OUTER JOIN sold_extras se ON se.month = sc.month
),
received AS (
  SELECT date_trunc('month', p.received_at)::date AS month,
    SUM(p.amount) AS total_received, COUNT(*) AS received_count
  FROM job_payments p JOIN jobs j ON j.id = p.job_id
  WHERE p.status = 'paid' AND p.received_at IS NOT NULL
    AND j.is_flip = false GROUP BY 1
),
job_exp_cash AS (
  -- kind='return' subtrai (José recebeu dinheiro/crédito de volta ao devolver material)
  SELECT date_trunc('month', e.expense_date)::date AS month,
    SUM(CASE WHEN e.kind = 'return' THEN -e.amount ELSE e.amount END) AS total_amount
  FROM job_expenses e JOIN jobs j ON j.id = e.job_id
  WHERE (e.payment_method IS NULL OR e.payment_method != 'credit_card')
    AND j.is_flip = false GROUP BY 1
),
job_hours_cash AS (
  SELECT date_trunc('month', h.work_date)::date AS month,
    SUM(h.calculated_amount) AS total_amount
  FROM job_hours h JOIN jobs j ON j.id = h.job_id
  WHERE j.is_flip = false GROUP BY 1
),
job_subs_cash AS (
  SELECT date_trunc('month', COALESCE(js.completed_at, js.hired_at))::date AS month,
    SUM(js.agreed_value) AS total_amount
  FROM job_subcontractors js JOIN jobs j ON j.id = js.job_id
  WHERE js.status = 'completed' AND j.is_flip = false GROUP BY 1
),
ads_cash AS (
  SELECT month::date, SUM(amount) AS total_amount FROM ad_spend GROUP BY 1
),
business_cash AS (
  SELECT date_trunc('month', expense_date)::date AS month,
    SUM(amount) AS total_amount
  FROM business_expenses WHERE is_flip = false GROUP BY 1
)
SELECT m.month, to_char(m.month, 'YYYY-MM') AS month_label,
  COALESCE(s.total_sold, 0)::numeric AS sold,
  COALESCE(s.sold_count, 0)::int AS sold_count,
  COALESCE(r.total_received, 0)::numeric AS received,
  COALESCE(r.received_count, 0)::int AS received_count,
  COALESCE(je.total_amount, 0)::numeric AS job_expenses_cash,
  COALESCE(jh.total_amount, 0)::numeric AS job_hours_cost,
  COALESCE(js.total_amount, 0)::numeric AS job_subs_cost,
  COALESCE(ads.total_amount, 0)::numeric AS ads_spend,
  COALESCE(be.total_amount, 0)::numeric AS business_expenses,
  (COALESCE(je.total_amount, 0) + COALESCE(jh.total_amount, 0)
    + COALESCE(js.total_amount, 0) + COALESCE(ads.total_amount, 0)
    + COALESCE(be.total_amount, 0))::numeric AS total_paid_out,
  (COALESCE(r.total_received, 0) - (COALESCE(je.total_amount, 0)
    + COALESCE(jh.total_amount, 0) + COALESCE(js.total_amount, 0)
    + COALESCE(ads.total_amount, 0) + COALESCE(be.total_amount, 0)))::numeric AS cash_balance
FROM months m
LEFT JOIN sold s ON s.month = m.month
LEFT JOIN received r ON r.month = m.month
LEFT JOIN job_exp_cash je ON je.month = m.month
LEFT JOIN job_hours_cash jh ON jh.month = m.month
LEFT JOIN job_subs_cash js ON js.month = m.month
LEFT JOIN ads_cash ads ON ads.month = m.month
LEFT JOIN business_cash be ON be.month = m.month
ORDER BY m.month DESC;

-- =============================================================================
-- Validação
-- =============================================================================
SELECT
  COUNT(*) FILTER (WHERE kind = 'purchase') AS total_purchases,
  COUNT(*) FILTER (WHERE kind = 'return') AS total_returns
FROM job_expenses;
