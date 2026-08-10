-- ============================================================================
-- 0063 — trigger sync spent_amount do flip_draw_items (fonte de verdade = txns)
-- ============================================================================
-- Antes: sync manual no cliente (fragil, silenciava falhas).
-- Agora: trigger DB que recalcula spent_amount sempre que uma transacao muda
-- (INSERT / UPDATE / DELETE). spent_amount = SUM de todas as saidas do item
-- (mortgage + expense_house + expense_cottage + expense_general + salary).

CREATE OR REPLACE FUNCTION recompute_flip_draw_item_spent()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id uuid;
BEGIN
  v_item_id := COALESCE(NEW.draw_item_id, OLD.draw_item_id);
  IF v_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE flip_draw_items
  SET spent_amount = COALESCE((
    SELECT SUM(amount)
    FROM flip_draw_item_transactions
    WHERE draw_item_id = v_item_id
      AND kind IN (
        'mortgage', 'expense_house', 'expense_cottage',
        'expense_general', 'salary'
      )
  ), 0)
  WHERE id = v_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recompute_flip_draw_item_spent
  ON flip_draw_item_transactions;

CREATE TRIGGER trg_recompute_flip_draw_item_spent
AFTER INSERT OR UPDATE OR DELETE ON flip_draw_item_transactions
FOR EACH ROW EXECUTE FUNCTION recompute_flip_draw_item_spent();

-- Backfill: recomputa spent_amount de todos os items existentes
-- (corrige qualquer desync que ficou de sync manual)
UPDATE flip_draw_items i
SET spent_amount = COALESCE((
  SELECT SUM(amount)
  FROM flip_draw_item_transactions
  WHERE draw_item_id = i.id
    AND kind IN (
      'mortgage', 'expense_house', 'expense_cottage',
      'expense_general', 'salary'
    )
), 0);
