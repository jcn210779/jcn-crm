-- ============================================================================
-- 0068 — Modelo envelope: 5 contas fixas por requerimento (bank_draw)
-- ============================================================================
-- Modelo novo (José 2026-10-16): cada requerimento (bank_draw) tem 5 contas
-- reservadas quando aberto — Construção, Cottage, Mortgage, Salário, Lucro.
-- Dinheiro recebido do banco é dividido entre as 5 (allocation). Gasto sai de
-- uma conta específica (expense). Sobra em caixa = allocation - expense.
--
-- Migra TUDO: apaga breakdowns antigos + transactions antigas e cria as 5
-- contas (allocated=0, spent=0) pra cada bank_draw existente.
-- Trigger: ao inserir novo bank_draw, auto-cria as 5 contas.
-- Trigger de soma: amount = SUM(allocation txns); spent_amount = SUM(expense txns).

-- =============================================================================
-- 1) Enum do tipo de conta
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flip_conta_tipo') THEN
    CREATE TYPE flip_conta_tipo AS ENUM (
      'construcao', 'cottage', 'mortgage', 'salario', 'lucro'
    );
  END IF;
END$$;

ALTER TABLE flip_draw_items
  ADD COLUMN IF NOT EXISTS conta_tipo flip_conta_tipo;

CREATE INDEX IF NOT EXISTS idx_flip_draw_items_conta
  ON flip_draw_items (draw_id, conta_tipo)
  WHERE conta_tipo IS NOT NULL;

-- =============================================================================
-- 2) Expandir enum de kind das transações pra ter 'allocation' e 'expense'
-- =============================================================================
-- Os antigos (withdrawal/mortgage/expense_*/salary) ficam como legacy
-- (dados ja estao sendo apagados no backfill abaixo mesmo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'allocation'
    AND enumtypid = 'flip_draw_item_txn_kind'::regtype
  ) THEN
    ALTER TYPE flip_draw_item_txn_kind ADD VALUE 'allocation';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'expense'
    AND enumtypid = 'flip_draw_item_txn_kind'::regtype
  ) THEN
    ALTER TYPE flip_draw_item_txn_kind ADD VALUE 'expense';
  END IF;
END$$;

-- =============================================================================
-- 3) BACKFILL: apaga tudo relacionado aos draws existentes e cria as 5 contas
-- =============================================================================
-- Apaga transactions antigas (todas)
DELETE FROM flip_draw_item_transactions;

-- Apaga items antigos (todos)
DELETE FROM flip_draw_items;

-- Cria as 5 contas pra cada bank_draw existente
-- Ordem fixa pra ter display_order estável
INSERT INTO flip_draw_items (draw_id, category, amount, spent_amount, conta_tipo, display_order)
SELECT d.id, 'Construção', 0, 0, 'construcao', 0 FROM flip_draws d WHERE d.source = 'bank_draw'
UNION ALL
SELECT d.id, 'Cottage', 0, 0, 'cottage', 1 FROM flip_draws d WHERE d.source = 'bank_draw'
UNION ALL
SELECT d.id, 'Mortgage', 0, 0, 'mortgage', 2 FROM flip_draws d WHERE d.source = 'bank_draw'
UNION ALL
SELECT d.id, 'Salário', 0, 0, 'salario', 3 FROM flip_draws d WHERE d.source = 'bank_draw'
UNION ALL
SELECT d.id, 'Lucro', 0, 0, 'lucro', 4 FROM flip_draws d WHERE d.source = 'bank_draw';

-- =============================================================================
-- 4) Trigger: ao inserir novo bank_draw, auto-cria as 5 contas
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_create_5_contas_on_bank_draw()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source IS DISTINCT FROM 'bank_draw' THEN
    RETURN NEW;
  END IF;

  INSERT INTO flip_draw_items (draw_id, category, amount, spent_amount, conta_tipo, display_order)
  VALUES
    (NEW.id, 'Construção', 0, 0, 'construcao', 0),
    (NEW.id, 'Cottage',    0, 0, 'cottage',    1),
    (NEW.id, 'Mortgage',   0, 0, 'mortgage',   2),
    (NEW.id, 'Salário',    0, 0, 'salario',    3),
    (NEW.id, 'Lucro',      0, 0, 'lucro',      4);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_5_contas_on_bank_draw ON flip_draws;
CREATE TRIGGER trg_create_5_contas_on_bank_draw
AFTER INSERT ON flip_draws
FOR EACH ROW EXECUTE FUNCTION fn_create_5_contas_on_bank_draw();

-- =============================================================================
-- 5) Atualizar trigger de soma — agora amount tambem e recomputado
-- =============================================================================
-- Antes (mig 0063): so recomputava spent_amount. Agora:
--   amount        = SUM(txns.amount) WHERE kind = 'allocation'
--   spent_amount  = SUM(txns.amount) WHERE kind = 'expense'
CREATE OR REPLACE FUNCTION recompute_flip_draw_item_spent()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id uuid;
BEGIN
  v_item_id := COALESCE(NEW.draw_item_id, OLD.draw_item_id);
  IF v_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE flip_draw_items i
  SET
    amount = COALESCE((
      SELECT SUM(amount) FROM flip_draw_item_transactions
      WHERE draw_item_id = v_item_id AND kind = 'allocation'
    ), 0),
    spent_amount = COALESCE((
      SELECT SUM(amount) FROM flip_draw_item_transactions
      WHERE draw_item_id = v_item_id AND kind = 'expense'
    ), 0)
  WHERE i.id = v_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ja existe (criado em mig 0063). Nao precisa recriar.
