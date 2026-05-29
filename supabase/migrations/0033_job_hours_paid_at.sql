-- Migration 0033 — paid_at em job_hours
-- Aplicada em: 2026-05-29
--
-- Motivo:
--   Hoje a folha semanal mostra "Pagar" e "A pagar" mesmo depois do funcionario
--   ter recebido, porque nada conecta o job_hours (horas trabalhadas) com o
--   business_expense (pagamento). Resultado: confusao + risco de pagar 2x.
--
-- Solucao:
--   Adicionar paid_at TIMESTAMPTZ NULL em job_hours. Quando setado, hour ja foi
--   "fechado" (pago direto OU movido pra A pagar OU marcado manualmente).
--
-- Tambem adiciona payment_business_expense_id UUID FK pra rastrear qual
-- despesa pagou esse hour (util pra unwind ou auditoria).
--
-- BACKFILL HISTORICO:
--   Marca como paid_at = NOW() todos os hours de semanas FECHADAS (work_date
--   anterior a segunda-feira da semana atual). Assume que tudo antes ja foi
--   pago via folha/cash. Semana atual fica pendente, Jose decide na sexta.
--
-- =============================================================================

-- 1) ADD COLUMNS
ALTER TABLE job_hours ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE job_hours
  ADD COLUMN IF NOT EXISTS payment_business_expense_id UUID
  REFERENCES business_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_hours_unpaid
  ON job_hours(member_id, work_date)
  WHERE paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_hours_payment_be
  ON job_hours(payment_business_expense_id)
  WHERE payment_business_expense_id IS NOT NULL;

-- 2) BACKFILL: marca semanas fechadas como pagas
--    date_trunc('week', CURRENT_DATE) retorna a segunda-feira da semana atual.
--    Hours com work_date anterior a essa segunda viram paid_at = NOW().
UPDATE job_hours
SET paid_at = NOW()
WHERE paid_at IS NULL
  AND work_date < date_trunc('week', CURRENT_DATE)::date;

-- Validacao
SELECT
  COUNT(*) FILTER (WHERE paid_at IS NOT NULL) AS hours_marcados_pagos_historico,
  COUNT(*) FILTER (WHERE paid_at IS NULL) AS hours_pendentes_semana_atual,
  COUNT(*) AS total_hours,
  date_trunc('week', CURRENT_DATE)::date AS segunda_da_semana_atual
FROM job_hours;
