-- =============================================================================
-- CRM JCN — Migration 0058 — Line items por draw (breakdown do requerimento)
-- =============================================================================
-- Data: 2026-08-04
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   Jose tem tabela interna com requerimentos pro banco. Cada requerimento
--   (draw) tem lista de "onde vai o dinheiro" — quanto pra Framing, quanto
--   pra Eletrica, etc. Hoje flip_draws so guarda o valor TOTAL do draw,
--   sem o breakdown por categoria.
--
-- Solucao:
--   Tabela flip_draw_items — 1 row por linha do requerimento.
--   FK opcional pra flip_budget_lines (categoria vira dropdown das categorias
--   ja cadastradas no orcamento). category text guarda snapshot do nome pra
--   caso a linha do orcamento seja apagada.
-- =============================================================================

CREATE TABLE IF NOT EXISTS flip_draw_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  draw_id         uuid NOT NULL REFERENCES flip_draws(id) ON DELETE CASCADE,
  budget_line_id  uuid REFERENCES flip_budget_lines(id) ON DELETE SET NULL,

  category        text NOT NULL,                    -- snapshot pra sobreviver a delete da linha
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  notes           text,
  display_order   integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_flip_draw_items_draw
  ON flip_draw_items(draw_id, display_order);

CREATE INDEX IF NOT EXISTS idx_flip_draw_items_budget_line
  ON flip_draw_items(budget_line_id) WHERE budget_line_id IS NOT NULL;

COMMENT ON TABLE flip_draw_items IS
  'Breakdown do draw request pro banco. Cada linha justifica onde vai parte do valor pedido, opcionalmente linkada a uma categoria do orcamento.';

-- RLS owner-only
ALTER TABLE flip_draw_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_flip_draw_items_owner_only ON flip_draw_items;
CREATE POLICY p_flip_draw_items_owner_only ON flip_draw_items FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- Validacao
SELECT
  (SELECT COUNT(*) FROM flip_draws) AS total_draws,
  (SELECT COUNT(*) FROM flip_draw_items) AS total_items;
