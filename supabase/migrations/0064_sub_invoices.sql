-- ============================================================================
-- 0064 — invoice do subempreiteiro (anexo + status pending/pago)
-- ============================================================================
-- Regra nova (2026-08-14): sub tem que mandar invoice ANTES do pagamento.
-- Fluxo:
--   1) Invoice chega → cria job_sub_payment com paid_at=NULL + invoice anexado
--      (status = "aguardando pagamento", aparece na Central como pendente)
--   2) Quando paga → seta paid_at + method + cria business_expense (via UI)
--
-- job_sub_payments ja existe (mig 0036 + 0047). Aqui so adiciono os campos
-- de invoice e corrijo o trigger pra so somar em amount_paid do sub as
-- parcelas realmente PAGAS (paid_at IS NOT NULL) — antes contava tudo.

ALTER TABLE job_sub_payments
  ADD COLUMN IF NOT EXISTS invoice_path text,
  ADD COLUMN IF NOT EXISTS invoice_file_name text,
  ADD COLUMN IF NOT EXISTS invoice_mime text,
  ADD COLUMN IF NOT EXISTS invoice_uploaded_at timestamptz;

COMMENT ON COLUMN job_sub_payments.invoice_path IS
  'Path no bucket job-extras (path: sub-invoices/<job_sub_id>/<uuid>.<ext>). '
  'Quando presente + paid_at IS NULL = invoice recebido aguardando pagamento.';

-- Recria trigger corrigido: soma amount_paid so das parcelas com paid_at NOT NULL
CREATE OR REPLACE FUNCTION fn_sync_job_sub_payment_totals()
RETURNS trigger AS $$
DECLARE
  v_sub_id uuid;
BEGIN
  v_sub_id := COALESCE(NEW.job_subcontractor_id, OLD.job_subcontractor_id);

  UPDATE job_subcontractors js
  SET
    amount_paid = COALESCE((
      SELECT SUM(p.amount) FROM job_sub_payments p
      WHERE p.job_subcontractor_id = v_sub_id
        AND p.paid_at IS NOT NULL
    ), 0),
    paid_at = (
      SELECT MAX(p.paid_at) FROM job_sub_payments p
      WHERE p.job_subcontractor_id = v_sub_id
        AND p.paid_at IS NOT NULL
    )
  WHERE js.id = v_sub_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Backfill: recomputa amount_paid pra todos os subs (caso ja exista parcela
-- antiga com paid_at NULL, corrige agora)
UPDATE job_subcontractors js
SET
  amount_paid = COALESCE((
    SELECT SUM(p.amount) FROM job_sub_payments p
    WHERE p.job_subcontractor_id = js.id
      AND p.paid_at IS NOT NULL
  ), 0),
  paid_at = (
    SELECT MAX(p.paid_at) FROM job_sub_payments p
    WHERE p.job_subcontractor_id = js.id
      AND p.paid_at IS NOT NULL
  );

-- View pra Central: invoices pendentes (recebidos, sem pagamento)
DROP VIEW IF EXISTS v_pending_sub_invoices;
CREATE VIEW v_pending_sub_invoices AS
SELECT
  p.id AS payment_id,
  p.amount,
  p.invoice_path,
  p.invoice_file_name,
  p.invoice_uploaded_at,
  p.notes,
  p.created_at,
  js.id AS job_subcontractor_id,
  js.job_id,
  js.service_description,
  s.name AS sub_name,
  j.is_flip,
  l.name AS lead_name,
  l.city AS lead_city
FROM job_sub_payments p
JOIN job_subcontractors js ON js.id = p.job_subcontractor_id
JOIN jobs j ON j.id = js.job_id
JOIN subcontractors s ON s.id = js.subcontractor_id
LEFT JOIN leads l ON l.id = j.lead_id
WHERE p.paid_at IS NULL
  AND p.invoice_path IS NOT NULL
ORDER BY p.invoice_uploaded_at DESC NULLS LAST;

GRANT SELECT ON v_pending_sub_invoices TO authenticated;
