-- Migration 0022 — anexar recibos em business_expenses
-- Aplicada em: 2026-05-18
--
-- Motivo:
--   José quer poder anexar foto/PDF do recibo em todo gasto da empresa
--   (fatura cartão, gasolina, seguro, foto do cheque pago a funcionário, etc).
--   Hoje só job_expenses tem recibo.
--
-- Reusa o bucket Storage `job-receipts` (que já existe desde migration 0010).
-- Path canônico: `business/<business_expense_id>/<uuid>.<ext>`.
-- Aceita imagem (JPEG/PNG/WEBP/HEIC) ou PDF.
--
-- =============================================================================

ALTER TABLE business_expenses
  ADD COLUMN IF NOT EXISTS receipt_path      text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text,
  ADD COLUMN IF NOT EXISTS receipt_size      integer,
  ADD COLUMN IF NOT EXISTS receipt_mime      text;

COMMENT ON COLUMN business_expenses.receipt_path IS
  'Path no bucket Storage job-receipts (formato: business/<id>/<uuid>.<ext>). NULL = sem recibo.';

-- Validação
SELECT
  column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_expenses'
  AND column_name LIKE 'receipt%'
ORDER BY column_name;
