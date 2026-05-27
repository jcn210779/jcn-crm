-- Migration 0030 — Método "vendor_account" (conta aberta com fornecedor)
-- Aplicada em: 2026-05-27
--
-- Motivo:
--   José compra material na Lansing Lumber (e potencialmente outros fornecedores)
--   com conta aberta — pega o material durante o mês, paga fatura única no dia
--   15 do mês seguinte. Mesmo padrão do cartão de crédito: o gasto ENTRA no
--   custo do job (margem reflete), mas NÃO sai do caixa real até a fatura ser
--   paga (via business_expense).
--
-- Solução:
--   1. ADD VALUE 'vendor_account' no enum payment_method existente
--   2. Recriar v_finance_monthly excluindo vendor_account de job_exp_cash,
--      business_cash, ads_cash, adjustments_outflow_cash
--   3. Recriar v_account_balance excluindo vendor_account de outflows_cash
--      e outflows_bank
--
-- Quando José paga fatura dia 15:
--   - Lança business_expense (categoria 'other' ou nova) com method='check'
--     (sai do banco)
--   - business_expense entra no caixa normalmente
--   - Ou seja: 1 lançamento mensal cobre N materiais comprados durante o mês
--
-- =============================================================================

-- 1) ADD VALUE no enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'vendor_account';

COMMENT ON TYPE payment_method IS
  'Métodos: check/cash/wire/zelle/venmo (banco/cash), credit_card (cartão, sai do caixa via fatura), vendor_account (conta aberta com fornecedor tipo Lansing, sai via business_expense quando paga fatura), other.';
