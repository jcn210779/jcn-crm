-- ============================================================================
-- 0061 — flip_draw_item_txn_kind v2
-- ============================================================================
-- Troca kinds pra: withdrawal, mortgage, expense_house, expense_cottage,
-- expense_general, salary. Mantem 'withdrawal' pra saque do banco; todos os
-- outros sao "saida". O que sobra (recebido - saidas) = lucro do requerimento.

-- 1. Passa coluna pra text temporariamente pra poder mexer no enum
ALTER TABLE flip_draw_item_transactions
  ALTER COLUMN kind TYPE text;

-- 2. Coerce valores antigos pra novos (caso ja tenha alguma linha lancada)
UPDATE flip_draw_item_transactions SET kind = 'expense_general' WHERE kind = 'expense';
UPDATE flip_draw_item_transactions SET kind = 'mortgage'        WHERE kind = 'interest';

-- 3. Dropa enum antigo e recria com novos valores
DROP TYPE IF EXISTS flip_draw_item_txn_kind;

CREATE TYPE flip_draw_item_txn_kind AS ENUM (
  'withdrawal',
  'mortgage',
  'expense_house',
  'expense_cottage',
  'expense_general',
  'salary'
);

-- 4. Volta coluna pro enum novo
ALTER TABLE flip_draw_item_transactions
  ALTER COLUMN kind TYPE flip_draw_item_txn_kind
  USING kind::flip_draw_item_txn_kind;
