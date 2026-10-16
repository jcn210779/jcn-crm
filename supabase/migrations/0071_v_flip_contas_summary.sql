-- ============================================================================
-- 0071 — view v_flip_contas_summary (totais por conta do flip inteiro)
-- ============================================================================
-- Agrega as 5 contas (conta_tipo) somando TODOS os bank_draws de um flip.
-- Serve pro card consolidado "Totais por conta" na Caixa & Draws do flip.
--
-- Colunas por flip:
--   conta_tipo         (construcao / cottage / mortgage / salario / lucro)
--   alocado_total      SUM(amount)        — quanto foi alocado nessa conta em todos os draws
--   gasto_total        SUM(spent_amount)  — quanto foi gasto nessa conta em todos os draws
--   em_caixa_total     alocado − gasto
--   num_draws          contagem de draws que tem essa conta

CREATE OR REPLACE VIEW v_flip_contas_summary AS
SELECT
  d.flip_id,
  i.conta_tipo,
  SUM(i.amount)::numeric       AS alocado_total,
  SUM(i.spent_amount)::numeric AS gasto_total,
  (SUM(i.amount) - SUM(i.spent_amount))::numeric AS em_caixa_total,
  COUNT(*)::int                AS num_draws
FROM flip_draw_items i
JOIN flip_draws d ON d.id = i.draw_id
WHERE d.source = 'bank_draw'
  AND i.conta_tipo IS NOT NULL
GROUP BY d.flip_id, i.conta_tipo;
