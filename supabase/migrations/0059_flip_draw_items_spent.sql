-- =============================================================================
-- CRM JCN — Migration 0059 — Rastrear gasto real vs planejado por linha do draw
-- =============================================================================
-- Data: 2026-08-04
-- Aplicar via: Supabase dashboard -> SQL Editor -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   Jose quer ver por linha do breakdown: "peguei $40k, paguei X, paguei Y,
--   sobrou Z". `amount` (mig 0058) segue como planejado. Novo `spent_amount`
--   guarda o quanto foi realmente gasto naquela categoria daquele draw.
--
-- Sobra por linha = amount - spent_amount (calculado na UI).
-- Sobra do draw = SUM(amount) - SUM(spent_amount) (calculado na UI).
-- =============================================================================

ALTER TABLE flip_draw_items
  ADD COLUMN IF NOT EXISTS spent_amount numeric(12,2) NOT NULL DEFAULT 0
    CHECK (spent_amount >= 0);

COMMENT ON COLUMN flip_draw_items.amount IS
  'Valor PLANEJADO pra essa categoria no requerimento pro banco.';
COMMENT ON COLUMN flip_draw_items.spent_amount IS
  'Valor REALMENTE gasto (real) — atualizado conforme Jose paga. Diferenca vs amount = sobra/excesso.';

SELECT
  (SELECT COUNT(*) FROM flip_draw_items) AS total_items,
  (SELECT COUNT(*) FROM flip_draw_items WHERE spent_amount > 0) AS items_com_gasto;
