-- Migration 0023 — A pagar pra funcionário (dívidas em aberto)
-- Aplicada em: 2026-05-18
--
-- Motivo:
--   José paga funcionários com 1 semana de atraso ("deixo uma semana na casa
--   deles"). Hoje deve $1.188 Matheus + $1.530 Lucas (semana que ainda não
--   pagou). Precisa de um lugar pra registrar essa dívida e dar baixa quando
--   pagar.
--
-- Fluxo:
--   1. José adiciona linha "A pagar Matheus $1.188" (semana X)
--   2. Quando paga: clica "Marcar pago" + escolhe método (check/cash)
--   3. Sistema cria business_expense payroll automaticamente + linka
--   4. Item some da lista "A pagar" e aparece no histórico de business_expenses
--
-- =============================================================================

-- 1) Enum status
DROP TYPE IF EXISTS team_payable_status CASCADE;
CREATE TYPE team_payable_status AS ENUM ('pending', 'paid');

-- 2) Tabela
CREATE TABLE IF NOT EXISTS team_payables (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  member_id            uuid NOT NULL REFERENCES team_members(id) ON DELETE RESTRICT,

  amount               numeric(10,2) NOT NULL CHECK (amount > 0),
  description          text NOT NULL,            -- "Semana 12-16 mai", "Adiantamento", etc
  due_date             date,                     -- Quando deveria pagar (opcional)

  status               team_payable_status NOT NULL DEFAULT 'pending',

  -- Quando paid: link com business_expense criado e timestamp
  paid_at              timestamptz,
  paid_business_expense_id uuid REFERENCES business_expenses(id) ON DELETE SET NULL,

  notes                text
);

CREATE INDEX IF NOT EXISTS idx_team_payables_status ON team_payables(status);
CREATE INDEX IF NOT EXISTS idx_team_payables_member ON team_payables(member_id);
CREATE INDEX IF NOT EXISTS idx_team_payables_due ON team_payables(due_date)
  WHERE status = 'pending';

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION fn_team_payables_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_payables_set_updated_at ON team_payables;
CREATE TRIGGER trg_team_payables_set_updated_at
  BEFORE UPDATE ON team_payables
  FOR EACH ROW
  EXECUTE FUNCTION fn_team_payables_set_updated_at();

-- 4) RLS owner-only
ALTER TABLE team_payables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_team_payables_owner_only ON team_payables;
CREATE POLICY p_team_payables_owner_only ON team_payables FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- 5) View agregada por funcionário (total devido + count)
CREATE OR REPLACE VIEW v_team_payable_summary AS
SELECT
  tp.member_id,
  tm.name AS member_name,
  COUNT(*) FILTER (WHERE tp.status = 'pending') AS pending_count,
  COALESCE(SUM(tp.amount) FILTER (WHERE tp.status = 'pending'), 0) AS pending_total,
  MIN(tp.due_date) FILTER (WHERE tp.status = 'pending') AS oldest_due_date
FROM team_payables tp
JOIN team_members tm ON tm.id = tp.member_id
GROUP BY tp.member_id, tm.name;

-- Validação
SELECT * FROM team_payables LIMIT 5;
