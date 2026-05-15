-- Migration 0008 — tabela job_payments pra tracking de parcelas de pagamento
-- Aplicada em: 2026-05-15
--
-- Escopo Fase 4.2A:
--   José hoje controla pagamentos de boca/cheque. Quer um tracker dentro do CRM
--   com parcelas por job (deposit, milestone, final, extras), total pago vs total
--   contrato (com %), próxima parcela em destaque, status visual e método de
--   pagamento (cheque, cash, wire, Zelle, Venmo, cartão, outro).
--
-- Notas de design:
--   - Tabela 1:N (jobs -> job_payments). Cada parcela é uma linha.
--   - `kind` distingue tipos (deposit/milestone/final/extra) pra UI agrupar.
--   - `display_order` permite reordenar parcelas mantendo histórico linear.
--   - `received_at` é timestamptz pra capturar dia+hora do recebimento.
--   - `due_date` é date (precisão de dia basta pra agendar parcela).
--   - View `v_job_payment_summary` agrega total pago/pendente/planejado por job.
--   - RLS owner-only (mesmo padrão de leads/jobs/ad_spend).

-- =============================================================================
-- Enums
-- =============================================================================

CREATE TYPE payment_method AS ENUM (
  'check',
  'cash',
  'wire_transfer',
  'credit_card',
  'zelle',
  'venmo',
  'other'
);

CREATE TYPE payment_kind AS ENUM (
  'deposit',
  'milestone',
  'final',
  'extra'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'overdue',
  'cancelled'
);

-- =============================================================================
-- Tabela job_payments
-- =============================================================================

CREATE TABLE job_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  kind            payment_kind NOT NULL,
  label           text NOT NULL,                  -- "Entrada", "Parcela 1", "Pagamento final", etc
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),

  due_date        date,
  received_at     timestamptz,

  status          payment_status NOT NULL DEFAULT 'pending',
  method          payment_method,
  notes           text,

  display_order   integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_job_payments_job ON job_payments(job_id);
CREATE INDEX idx_job_payments_status ON job_payments(status);
CREATE INDEX idx_job_payments_due ON job_payments(due_date) WHERE status = 'pending';

-- =============================================================================
-- Trigger updated_at automático
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_job_payments_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_payments_set_updated_at ON job_payments;
CREATE TRIGGER trg_job_payments_set_updated_at
  BEFORE UPDATE ON job_payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_payments_set_updated_at();

-- =============================================================================
-- RLS owner-only
-- =============================================================================

ALTER TABLE job_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_payments_owner_only ON job_payments;
CREATE POLICY p_job_payments_owner_only ON job_payments FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- View: total pago + pendente por job
-- =============================================================================

CREATE OR REPLACE VIEW v_job_payment_summary AS
SELECT
  job_id,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
  COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS total_paid,
  COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending,
  COALESCE(SUM(amount), 0) AS total_planned
FROM job_payments
GROUP BY job_id;

-- =============================================================================
-- Validação final
-- =============================================================================

SELECT * FROM job_payments LIMIT 5;
SELECT * FROM v_job_payment_summary LIMIT 5;
