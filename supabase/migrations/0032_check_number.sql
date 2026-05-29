-- Migration 0032 — Numero do cheque em business_expenses e job_expenses
-- Aplicada em: 2026-05-29
--
-- Motivo:
--   Backfill Jan-Abr 2026 mostrou que 10 cheques sem numero identificado
--   custaram tempo de reconciliacao (precisou perguntar ao Jose quem recebeu
--   cada um). Adicionar campo check_number opcional em toda despesa via cheque
--   permite rastrear o cheque desde a hora do pagamento, eliminando trabalho
--   de identificacao posterior na reconciliacao com extrato BoA.
--
-- Escopo:
--   - business_expenses.check_number TEXT (despesas da empresa: Lansing,
--     aluguel, plumber, folha funcionario)
--   - job_expenses.check_number TEXT (despesas por obra: material, sub)
--
-- Campo aceita texto (nao numerico) pra suportar cheques com letra ou hifen
-- tipo "1234-A" ou "A1234". Opcional sempre (nao obrigatorio).
--
-- Indice parcial em check_number quando preenchido pra busca rapida.
--
-- =============================================================================

-- 1) ADD COLUMN business_expenses
ALTER TABLE business_expenses ADD COLUMN IF NOT EXISTS check_number TEXT;
CREATE INDEX IF NOT EXISTS idx_business_expenses_check_number
  ON business_expenses(check_number)
  WHERE check_number IS NOT NULL;

-- 2) ADD COLUMN job_expenses
ALTER TABLE job_expenses ADD COLUMN IF NOT EXISTS check_number TEXT;
CREATE INDEX IF NOT EXISTS idx_job_expenses_check_number
  ON job_expenses(check_number)
  WHERE check_number IS NOT NULL;

-- Validacao
SELECT
  'business_expenses' AS table_name,
  COUNT(*) FILTER (WHERE check_number IS NOT NULL) AS with_check_number,
  COUNT(*) AS total
FROM business_expenses
UNION ALL
SELECT
  'job_expenses',
  COUNT(*) FILTER (WHERE check_number IS NOT NULL),
  COUNT(*)
FROM job_expenses;
