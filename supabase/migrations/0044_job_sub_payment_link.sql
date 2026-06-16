-- Migration 0044 — Linkar pagamento de sub com business_expense
-- Aplicada em: 2026-06-12
--
-- Motivo:
--   Quando José dá baixa no sub (preenche amount_paid > 0), hoje só atualiza
--   job_subcontractors — o saldo banco/cash do CRM NÃO cai. José precisa ir
--   manualmente em /finance > Gastos da empresa e lançar a despesa duplicada.
--
--   Solução: ao marcar pagamento no sub, criar business_expense automático
--   linkado (mesmo pattern de team_payable.paid_business_expense_id criado
--   na migration 0023).
--
-- NUMERAÇÃO: 0044 reserva os números 0041-0043 pro Módulo de Flip do CRM
-- (migrations já preparadas em wiki/flips/_migrations/, aguardam aplicação).
--
-- =============================================================================

ALTER TABLE job_subcontractors
  ADD COLUMN IF NOT EXISTS paid_business_expense_id UUID
  REFERENCES business_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_subs_paid_be
  ON job_subcontractors(paid_business_expense_id)
  WHERE paid_business_expense_id IS NOT NULL;

COMMENT ON COLUMN job_subcontractors.paid_business_expense_id IS
  'Business expense criado quando amount_paid > 0. NULL se ainda não pago ou se José apagou a despesa manualmente.';

-- Validação
SELECT
  COUNT(*) FILTER (WHERE amount_paid > 0) AS subs_com_pagamento,
  COUNT(*) FILTER (WHERE paid_business_expense_id IS NOT NULL) AS subs_com_BE_linkado,
  COUNT(*) AS total_subs
FROM job_subcontractors;
