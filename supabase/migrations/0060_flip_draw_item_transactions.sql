-- ============================================================================
-- 0060 — flip_draw_item_transactions
-- ============================================================================
-- Cofrinho por linha do breakdown do draw: cada categoria do draw (Permit,
-- Roofing, etc) pode ter N saques do banco, despesas pagas e juros pagos.
-- Permite calcular quanto ainda tem em caixa e quanto ainda dá pra sacar.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flip_draw_item_txn_kind') THEN
    CREATE TYPE flip_draw_item_txn_kind AS ENUM ('withdrawal', 'expense', 'interest');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS flip_draw_item_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  draw_item_id    uuid NOT NULL REFERENCES flip_draw_items(id) ON DELETE CASCADE,
  txn_date        date NOT NULL DEFAULT CURRENT_DATE,
  kind            flip_draw_item_txn_kind NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  description     text,
  notes           text
);

CREATE INDEX IF NOT EXISTS idx_flip_draw_item_txn_item_date
  ON flip_draw_item_transactions (draw_item_id, txn_date DESC);

ALTER TABLE flip_draw_item_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_only_flip_draw_item_txn" ON flip_draw_item_transactions;
CREATE POLICY "owner_only_flip_draw_item_txn"
  ON flip_draw_item_transactions
  FOR ALL
  USING (auth.jwt() ->> 'email' = 'info@jcnconstructioninc.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'info@jcnconstructioninc.com');
