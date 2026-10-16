-- ============================================================================
-- 0069 — flip_draws ganha parcela_num + parcela_total
-- ============================================================================
-- Jose faz requerimentos parcelados ao banco: 50-50, 40-40-20, etc.
-- Antes cada parcela era um draw isolado sem conexao visual.
-- Agora cada draw pode ser marcado como "Parcela N de T" — label aparece
-- junto do milestone (ex: "Permit · Parcela 1 de 2").
-- Ambos nullable — draws sem parcelamento continuam funcionando igual.

ALTER TABLE flip_draws
  ADD COLUMN IF NOT EXISTS parcela_num   smallint,
  ADD COLUMN IF NOT EXISTS parcela_total smallint;

-- Sanidade: num <= total quando os 2 estao preenchidos
ALTER TABLE flip_draws
  DROP CONSTRAINT IF EXISTS flip_draws_parcela_valida_check;
ALTER TABLE flip_draws
  ADD  CONSTRAINT flip_draws_parcela_valida_check CHECK (
    (parcela_num IS NULL AND parcela_total IS NULL)
    OR (parcela_num >= 1 AND parcela_total >= 1 AND parcela_num <= parcela_total)
  );
