-- Migration 0020 — payment_method em business_expenses + cash_adjustments + view v_account_balance
-- Aplicada em: 2026-05-18
--
-- Motivo:
--   José precisa rastrear separadamente saldo do BANCO (cheques, transferências)
--   vs saldo de CASH (dinheiro físico). Ele às vezes paga funcionários em cash.
--
-- Solução:
--   1. Adicionar coluna payment_method em business_expenses e cash_adjustments
--      (reusa enum payment_method existente: check, cash, wire_transfer,
--      credit_card, zelle, venmo, other)
--   2. View v_account_balance que classifica tudo em 3 baldes:
--      - cash_total: tudo com method='cash'
--      - bank_total: tudo com outros métodos (check, wire, zelle, venmo, other, NULL)
--      - credit_card excluído de ambos (entra só via fatura)
--
-- Regra de classificação:
--   ENTRADAS:
--     - job_payments paid: method='cash' → cash; outros → banco
--     - cash_adjustments income: method='cash' → cash; outros → banco
--   SAÍDAS:
--     - job_expenses: method='cash' → cash; method='credit_card' → ignora;
--                     outros (check/wire/zelle/venmo/other/NULL) → banco
--     - job_hours: sempre banco (assumido — funcionários CLT pagos via banco)
--     - job_subcontractors: sempre banco (assumido)
--     - ad_spend: method='cash' → cash; credit_card → ignora; outros → banco
--     - business_expenses: method='cash' → cash; outros → banco
--     - cash_adjustments outflow: method='cash' → cash; outros → banco
--
-- =============================================================================

-- NOTA: business_expenses já tem payment_method desde migration 0016.

-- 1) Adiciona payment_method em cash_adjustments
ALTER TABLE cash_adjustments
  ADD COLUMN IF NOT EXISTS payment_method payment_method;

COMMENT ON COLUMN cash_adjustments.payment_method IS
  'Como foi recebido/pago. cash = dinheiro físico. Outros = banco. NULL = banco por padrão.';

-- 3) View v_account_balance — calcula saldo CUMULATIVO separado por conta
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
  SELECT COALESCE(SUM(amount), 0) AS total FROM job_expenses
  WHERE payment_method = 'cash'
  UNION ALL
  SELECT COALESCE(SUM(amount), 0) FROM ad_spend
  WHERE payment_method = 'cash'
  UNION ALL
  SELECT COALESCE(SUM(amount), 0) FROM business_expenses
  WHERE payment_method = 'cash'
  UNION ALL
  SELECT COALESCE(SUM(amount), 0) FROM cash_adjustments
  WHERE kind = 'outflow' AND payment_method = 'cash'
),
outflows_bank AS (
  -- job_expenses: tudo que NÃO é cash nem credit_card sai do banco
  SELECT COALESCE(SUM(amount), 0) AS total FROM job_expenses
  WHERE (payment_method IS NULL OR (payment_method != 'cash' AND payment_method != 'credit_card'))
  UNION ALL
  -- job_hours: sempre banco
  SELECT COALESCE(SUM(calculated_amount), 0) FROM job_hours
  UNION ALL
  -- job_subcontractors completed: sempre banco
  SELECT COALESCE(SUM(agreed_value), 0) FROM job_subcontractors
  WHERE status = 'completed'
  UNION ALL
  -- ad_spend: tudo que NÃO é cash nem credit_card sai do banco
  SELECT COALESCE(SUM(amount), 0) FROM ad_spend
  WHERE (payment_method IS NULL OR (payment_method != 'cash' AND payment_method != 'credit_card'))
  UNION ALL
  -- business_expenses: tudo que NÃO é cash sai do banco
  SELECT COALESCE(SUM(amount), 0) FROM business_expenses
  WHERE (payment_method IS NULL OR payment_method != 'cash')
  UNION ALL
  -- cash_adjustments outflow: tudo que NÃO é cash sai do banco
  SELECT COALESCE(SUM(amount), 0) FROM cash_adjustments
  WHERE kind = 'outflow' AND (payment_method IS NULL OR payment_method != 'cash')
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

-- 4) Marca a abertura de cash como method='cash' (a do banco fica NULL = banco)
UPDATE cash_adjustments
  SET payment_method = 'cash'
  WHERE source = 'adjustment' AND description LIKE '%cash%' AND payment_method IS NULL;

-- 5) Validação
SELECT * FROM v_account_balance;
