-- ============================================================================
-- 0065 — job_sub_payments.paid_at pode ser NULL (invoice pendente)
-- ============================================================================
-- Bug: mig 0064 introduziu fluxo de invoice pendente (paid_at=NULL, invoice
-- anexado, ainda nao pago). Mas paid_at foi criado NOT NULL na mig 0036/0047.
-- Resultado: inserir invoice pendente pela UI falhava silenciosamente com
-- "null value in column paid_at violates not-null constraint".
--
-- Fix: remove NOT NULL. Semantica agora:
--   paid_at IS NULL  → invoice recebido, aguardando pagamento
--   paid_at IS NOT NULL → parcela paga na data indicada
-- Trigger fn_sync_job_sub_payment_totals ja tinha sido corrigido na 0064
-- pra so somar amount_paid quando paid_at IS NOT NULL.

ALTER TABLE job_sub_payments
  ALTER COLUMN paid_at DROP NOT NULL;
