-- =============================================================================
-- CRM JCN — Migration 0052 — Segregar despesas de Flip do /finance da JCN
-- =============================================================================
-- Data: 2026-07-06
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   JCN Construction (operação de jobs pra cliente) e Flip (investimento
--   imobiliário próprio) têm PnLs separados. Hoje, despesas de sub/material
--   de job flip caem no /finance da JCN misturado com gastos operacionais.
--   José quer separar: /finance mostra só JCN, flip fica no dashboard do
--   próprio job (que já tem P&L e orçamento×real).
--
-- Solução:
--   1) Coluna is_flip em business_expenses (default false).
--   2) Backfill: BEs linkados a subs de jobs flip → marca is_flip=true.
--   3) UI: /finance filtra is_flip=false por default. Código de criação de
--      BE (add-sub-payment-dialog) passa is_flip conforme job.
-- =============================================================================

ALTER TABLE business_expenses
  ADD COLUMN IF NOT EXISTS is_flip boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_business_expenses_is_flip
  ON business_expenses(is_flip);

COMMENT ON COLUMN business_expenses.is_flip IS
  'true = despesa é de job flip (investimento). Ficha oculta em /finance da JCN. Marcado automaticamente pela UI quando o BE é criado por fluxo de sub payment de job flip.';

-- =============================================================================
-- Backfill: BEs de sub de jobs flip
-- =============================================================================

-- 1) BEs linkados via job_subcontractors.paid_business_expense_id
UPDATE business_expenses be
SET is_flip = true
FROM job_subcontractors js
JOIN jobs j ON j.id = js.job_id
WHERE js.paid_business_expense_id = be.id
  AND j.is_flip = true
  AND be.is_flip = false;

-- 2) BEs linkados via job_sub_payments.business_expense_id (mig 0047)
UPDATE business_expenses be
SET is_flip = true
FROM job_sub_payments sp
JOIN job_subcontractors js ON js.id = sp.job_subcontractor_id
JOIN jobs j ON j.id = js.job_id
WHERE sp.business_expense_id = be.id
  AND j.is_flip = true
  AND be.is_flip = false;

-- =============================================================================
-- Recriar v_finance_monthly excluindo TUDO relacionado a job flip:
-- sold, received, job_expenses, job_hours, job_subs (via jobs.is_flip)
-- + business_expenses (via nova coluna is_flip).
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
  GROUP BY 1
),
business_cash AS (
  SELECT
    date_trunc('month', expense_date)::date AS month,
    SUM(amount) AS total_amount
  FROM business_expenses
  WHERE is_flip = false
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

-- =============================================================================
-- Validação
-- =============================================================================
SELECT
  COUNT(*) FILTER (WHERE is_flip = false) AS jcn_expenses,
  COUNT(*) FILTER (WHERE is_flip = true) AS flip_expenses,
  COUNT(*) AS total_expenses
FROM business_expenses;
