-- Migration 0026 — Apontamentos de reparos (warranty + paid)
-- Aplicada em: 2026-05-20
--
-- Motivo:
--   José recebe ligações de clientes pedindo reparo. Maioria é garantia (warranty)
--   coberta no contrato original — não gera receita. Algumas são reparos pagos
--   (cliente que não tem warranty mais ou serviço fora do escopo) — entram no caixa.
--
-- Fluxo:
--   1. Cliente liga → José cria reparo (cliente + tel + endereço + descrição + tipo)
--   2. Status default: 'open'
--   3. José agenda → status 'scheduled' + scheduled_for
--   4. Executa → 'in_progress'
--   5. Concluiu:
--      - Se type=warranty: marca completed. Nada no caixa.
--      - Se type=paid + value_charged > 0: marca completed + cria cash_adjustment
--        income automaticamente (cliente paga = entra no caixa).
--
-- =============================================================================

-- 1) Enums
DROP TYPE IF EXISTS repair_status CASCADE;
CREATE TYPE repair_status AS ENUM (
  'open',          -- recebeu ligação, ainda não agendou
  'scheduled',     -- data marcada
  'in_progress',   -- executando
  'completed',     -- terminou
  'cancelled'      -- cancelado pelo cliente ou José
);

DROP TYPE IF EXISTS repair_type CASCADE;
CREATE TYPE repair_type AS ENUM (
  'warranty',  -- cobertura de garantia (gratuito pro cliente)
  'paid'       -- reparo cobrado (gera receita)
);

-- 2) Tabela
CREATE TABLE IF NOT EXISTS repairs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Cliente
  customer_name     text NOT NULL,
  customer_phone    text,
  customer_address  text,

  -- O que arrumar
  description       text NOT NULL,

  -- Tipo + status
  type              repair_type NOT NULL DEFAULT 'warranty',
  status            repair_status NOT NULL DEFAULT 'open',

  -- Datas
  scheduled_for     timestamptz,
  completed_at      timestamptz,

  -- Valores (só fazem sentido pra type=paid)
  value_estimated   numeric(10,2),
  value_charged     numeric(10,2),

  -- Vínculo opcional com job antigo (se for warranty de um trabalho do CRM)
  linked_job_id     uuid REFERENCES jobs(id) ON DELETE SET NULL,

  -- Caixa: cash_adjustment criado automaticamente quando completed+paid+charged
  cash_adjustment_id uuid REFERENCES cash_adjustments(id) ON DELETE SET NULL,

  notes             text
);

CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_type ON repairs(type);
CREATE INDEX IF NOT EXISTS idx_repairs_scheduled ON repairs(scheduled_for)
  WHERE status IN ('open', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_repairs_created ON repairs(created_at DESC);

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION fn_repairs_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_repairs_set_updated_at ON repairs;
CREATE TRIGGER trg_repairs_set_updated_at
  BEFORE UPDATE ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION fn_repairs_set_updated_at();

-- 4) RLS owner-only
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_repairs_owner_only ON repairs;
CREATE POLICY p_repairs_owner_only ON repairs FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- Validação
SELECT 'repairs table criada' AS status;
