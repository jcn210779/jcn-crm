-- Migration 0055 — Playbook do Flip (árvore de fases do processo)
-- =============================================================================
-- Data: 2026-07-21
-- Motivo:
--   José quer um "passo a passo" (árvore de fases) do processo de flip pra
--   mostrar no office e usar no celular E no computador, com TUDO SALVO.
--   Solução: guardar a árvore como 1 documento JSON no servidor (Supabase),
--   então fica igual em todo aparelho e nunca se perde (diferente de
--   localStorage do navegador, que é por-aparelho e efêmero no preview).
--
-- Modelo: 1 linha só (o documento). Editado pela página /playbook do CRM.
--   A árvore default é semeada pelo cliente na 1ª abertura (data vazio -> seed).
-- =============================================================================

CREATE TABLE IF NOT EXISTS flip_playbook (
  id          boolean PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Garante a linha única existindo
INSERT INTO flip_playbook (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- RLS owner-only (mesmo pattern do resto do CRM)
ALTER TABLE flip_playbook ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_flip_playbook_owner_only ON flip_playbook;
CREATE POLICY p_flip_playbook_owner_only ON flip_playbook FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- Validação
SELECT id, updated_at, jsonb_typeof(data) AS data_type FROM flip_playbook;
