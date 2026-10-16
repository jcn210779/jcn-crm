-- ============================================================================
-- 0070 — flip_draw_item_transactions ganha allocation_batch_id
-- ============================================================================
-- Cada "Dividir recebido" (SplitDialog) cria 5 allocations (uma por conta).
-- Essas 5 formam UMA rodada / requerimento parcial. Pra agrupar visualmente
-- (ex: "Requerimento 1: $55k · 04/08", "Requerimento 2: $55k · 15/08") elas
-- precisam compartilhar um batch_id.
--
-- UUID gerado no cliente (SplitDialog). Null = alocacao avulsa (edge case,
-- raro).

ALTER TABLE flip_draw_item_transactions
  ADD COLUMN IF NOT EXISTS allocation_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_flip_draw_item_txn_batch
  ON flip_draw_item_transactions (allocation_batch_id)
  WHERE allocation_batch_id IS NOT NULL;
