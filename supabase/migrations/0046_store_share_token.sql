-- Migration 0046 — Token de compartilhamento do depósito
-- =============================================================================
-- Data: 2026-06-17
-- Motivo:
--   José quer compartilhar o /store com o "menino do depósito" via WhatsApp.
--   Menino acessa link público com token UUID (sem login). Pode ver + ajustar
--   quantidade (entrada/saída com job obrigatório). Não pode criar/editar/apagar.
--
-- Modelo: 1 linha só. Token regenerável.
-- =============================================================================

CREATE TABLE IF NOT EXISTS store_share (
  id          boolean PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  token       uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  rotated_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- Garante 1 linha existindo (se não há, cria com token novo)
INSERT INTO store_share (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- RLS owner-only
ALTER TABLE store_share ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_store_share_owner_only ON store_share;
CREATE POLICY p_store_share_owner_only ON store_share FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- Validação
SELECT token, created_at, rotated_at FROM store_share;
