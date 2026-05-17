-- Migration 0016 — financeiro completo: payment_method em job_expenses + business_expenses + view finance_summary
-- Aplicada em: 2026-05-16
-- IDEMPOTENTE
--
-- Resolve o problema de double-counting de cartão de crédito:
-- Despesa de obra com payment_method = 'credit_card' NAO conta no caixa real.
-- Conta só quando o pagamento da fatura é registrado em business_expenses
-- (categoria 'credit_card_payment').
--
-- Caixa real = recebidos - (job_expenses não-cartão + job_hours + job_subcontractors completed + ad_spend + business_expenses)

-- =====================================================================
-- 1) ADD COLUMN payment_method em job_expenses (reusa enum existente)
-- =====================================================================

ALTER TABLE job_expenses
  ADD COLUMN IF NOT EXISTS payment_method payment_method;

-- =====================================================================
-- 2) Enum business_expense_category (18 categorias)
-- =====================================================================

DROP TYPE IF EXISTS business_expense_category CASCADE;
CREATE TYPE business_expense_category AS ENUM (
  'credit_card_payment',  -- pagamento de fatura de cartão de crédito
  'insurance',            -- seguro (auto, liability, workers comp)
  'vehicle_fuel',         -- gasolina van/truck
  'vehicle_maintenance',  -- manutenção veículo
  'vehicle_finance',      -- parcela do veículo
  'phone',                -- telefone celular/empresa
  'internet',             -- internet escritório
  'software',             -- Supabase, Vercel, QuickBooks, etc
  'accounting',           -- contador
  'legal',                -- advogado, licenças
  'office_supplies',      -- material de escritório
  'rent',                 -- aluguel escritório/garagem
  'utilities',            -- luz/água/gás
  'bank_fees',            -- tarifas bancárias
  'taxes',                -- impostos (sales tax, payroll tax)
  'marketing_other',      -- marketing fora de ads (cartão de visita, brinde, etc)
  'training',             -- cursos, certificações
  'other'
);

-- =====================================================================
-- 3) Tabela business_expenses
-- =====================================================================

CREATE TABLE IF NOT EXISTS business_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  expense_date    date NOT NULL DEFAULT CURRENT_DATE,
  category        business_expense_category NOT NULL,
  vendor          text,
  description     text NOT NULL,
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),

  payment_method  payment_method,

  -- Recorrência (informativa — não gera entrada automática)
  recurring       boolean NOT NULL DEFAULT false,
  recurrence_note text,  -- "mensal", "anual no dia 1", "trimestral" etc

  notes           text
);

CREATE INDEX IF NOT EXISTS idx_business_expenses_date
  ON business_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_business_expenses_category
  ON business_expenses(category);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_business_expenses_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_expenses_set_updated_at ON business_expenses;
CREATE TRIGGER trg_business_expenses_set_updated_at
  BEFORE UPDATE ON business_expenses
  FOR EACH ROW EXECUTE FUNCTION fn_business_expenses_set_updated_at();

-- RLS owner-only
ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_business_expenses_owner_only ON business_expenses;
CREATE POLICY p_business_expenses_owner_only ON business_expenses FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =====================================================================
-- 4) View v_finance_monthly — resumo financeiro mensal
-- =====================================================================
-- Cada linha = 1 mês. Soma cada tipo de movimento e calcula saldo do caixa.
-- Gera janela de 13 meses (12 atrás + atual). Frontend pode filtrar mais.

CREATE OR REPLACE VIEW v_finance_monthly AS
WITH months AS (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE - interval '12 months'),
    date_trunc('month', CURRENT_DATE + interval '1 month'),
    interval '1 month'
  )::date AS month
),
sold AS (
  -- Vendido = jobs assinados no mês (contract_signed_at)
  SELECT
    date_trunc('month', contract_signed_at)::date AS month,
    SUM(value) AS total_sold,
    COUNT(*) AS sold_count
  FROM jobs
  GROUP BY 1
),
received AS (
  -- Recebido = job_payments com status paid e received_at preenchido
  SELECT
    date_trunc('month', received_at)::date AS month,
    SUM(amount) AS total_received,
    COUNT(*) AS received_count
  FROM job_payments
  WHERE status = 'paid' AND received_at IS NOT NULL
  GROUP BY 1
),
job_exp_cash AS (
  -- Despesas de obra que SAÍRAM do caixa (cash/check/debit/zelle/venmo/wire/other)
  -- NÃO inclui credit_card (entra só quando fatura paga via business_expenses)
  SELECT
    date_trunc('month', expense_date)::date AS month,
    SUM(amount) AS total_amount
  FROM job_expenses
  WHERE payment_method IS NULL OR payment_method != 'credit_card'
  GROUP BY 1
),
job_hours_cash AS (
  -- Horas funcionários (assume pago semanalmente; usa work_date como aproximação)
  SELECT
    date_trunc('month', work_date)::date AS month,
    SUM(calculated_amount) AS total_amount
  FROM job_hours
  GROUP BY 1
),
job_subs_cash AS (
  -- Subempreiteiros completados (saiu do caixa no completion)
  SELECT
    date_trunc('month', COALESCE(completed_at, hired_at))::date AS month,
    SUM(agreed_value) AS total_amount
  FROM job_subcontractors
  WHERE status = 'completed'
  GROUP BY 1
),
ads_cash AS (
  -- Ad spend (campo month já é dia 1 do mês)
  SELECT
    month::date,
    SUM(amount) AS total_amount
  FROM ad_spend
  GROUP BY 1
),
business_cash AS (
  -- Gastos da empresa (todos saem do caixa na data informada)
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

-- =====================================================================
-- 5) Validação
-- =====================================================================

SELECT month, sold, received, total_paid_out, cash_balance
FROM v_finance_monthly
LIMIT 5;
