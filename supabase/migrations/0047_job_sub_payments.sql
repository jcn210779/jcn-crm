-- =============================================================================
-- CRM JCN — Migration 0047 — Pagamentos parcelados de subempreiteiros
-- =============================================================================
-- Data: 2026-06-26
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE — pode rodar várias vezes sem quebrar.
--
-- Problema:
--   Hoje job_subcontractors guarda só amount_paid (total acumulado) + paid_at
--   (data do último pagamento). José paga sub em parcelas (ex: $1.500 em 10/Jun,
--   $800 em 20/Jun, $700 em 1/Jul) mas o sistema só mostra "$3.000 pago em 1/Jul"
--   — perde histórico. business_expense criado fica com data errada também.
--
-- Solução:
--   Tabela nova job_sub_payments — 1 row por parcela paga. Cada parcela cria
--   seu próprio business_expense com a data certa. amount_paid e paid_at em
--   job_subcontractors viram cache derivado (SUM + MAX), atualizado por
--   trigger pra não quebrar UI/queries existentes.
--
-- Backfill:
--   Pra cada sub com amount_paid > 0, cria 1 row em job_sub_payments
--   representando o pagamento agregado. Linka ao paid_business_expense_id se
--   existir.
-- =============================================================================

-- =============================================================================
-- Tabela job_sub_payments
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_sub_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),

  job_subcontractor_id  uuid NOT NULL
                        REFERENCES job_subcontractors(id) ON DELETE CASCADE,

  amount                numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_at               date NOT NULL,
  method                payment_method,
  check_number          text,
  notes                 text,

  business_expense_id   uuid REFERENCES business_expenses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_sub_payments_sub
  ON job_sub_payments(job_subcontractor_id);

CREATE INDEX IF NOT EXISTS idx_job_sub_payments_paid_at
  ON job_sub_payments(paid_at);

COMMENT ON TABLE job_sub_payments IS
  'Parcelas pagas a subempreiteiros. Cada row cria business_expense próprio com a data certa.';
COMMENT ON COLUMN job_sub_payments.business_expense_id IS
  'Business expense criado pela UI ao registrar a parcela. SET NULL se José apagar a despesa manualmente.';

-- =============================================================================
-- RLS owner-only
-- =============================================================================
ALTER TABLE job_sub_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_job_sub_payments_owner_only ON job_sub_payments;
CREATE POLICY p_job_sub_payments_owner_only ON job_sub_payments
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- Trigger: mantém job_subcontractors.amount_paid e paid_at como cache derivado
-- =============================================================================
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
    ), 0),
    paid_at = (
      SELECT MAX(p.paid_at) FROM job_sub_payments p
      WHERE p.job_subcontractor_id = v_sub_id
    )
  WHERE js.id = v_sub_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_sub_payment_totals_ins ON job_sub_payments;
CREATE TRIGGER trg_sync_sub_payment_totals_ins
  AFTER INSERT ON job_sub_payments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_job_sub_payment_totals();

DROP TRIGGER IF EXISTS trg_sync_sub_payment_totals_upd ON job_sub_payments;
CREATE TRIGGER trg_sync_sub_payment_totals_upd
  AFTER UPDATE ON job_sub_payments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_job_sub_payment_totals();

DROP TRIGGER IF EXISTS trg_sync_sub_payment_totals_del ON job_sub_payments;
CREATE TRIGGER trg_sync_sub_payment_totals_del
  AFTER DELETE ON job_sub_payments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_job_sub_payment_totals();

-- =============================================================================
-- Backfill: subs com amount_paid > 0 viram 1 parcela única
-- =============================================================================
-- Só faz se ainda não existe parcela pra esse sub (idempotente).
INSERT INTO job_sub_payments (
  job_subcontractor_id,
  amount,
  paid_at,
  method,
  notes,
  business_expense_id
)
SELECT
  js.id,
  js.amount_paid,
  COALESCE(js.paid_at, CURRENT_DATE),
  'check'::payment_method,
  'Backfill 2026-06-26 — pagamento agregado antes do sistema de parcelas',
  js.paid_business_expense_id
FROM job_subcontractors js
WHERE js.amount_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM job_sub_payments p WHERE p.job_subcontractor_id = js.id
  );

-- =============================================================================
-- Validação
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM job_sub_payments) AS total_payments,
  (SELECT COUNT(DISTINCT job_subcontractor_id) FROM job_sub_payments) AS subs_com_parcelas,
  (SELECT COUNT(*) FROM job_subcontractors WHERE amount_paid > 0) AS subs_com_amount_paid;
