-- Migration 0006 — refatorar enum job_phase pras 6 fases reais do JCN
-- Aplicada em: 2026-05-14
--
-- Mudanças:
-- - REMOVE: demo, construction, finishing (consolidam em work_in_progress)
-- - RENOMEIA: materials_arrived → materials_delivered
-- - ADICIONA: permit_released, work_in_progress
-- - REORDENA: permit vem antes de pedido de material (lógica do GC)
--
-- Ordem final (6 fases):
--   1. planning             (Planejamento)
--   2. permit_released      (Permit liberado)
--   3. materials_ordered    (Material pedido)
--   4. materials_delivered  (Material entregue)
--   5. work_in_progress     (Trabalho em andamento)
--   6. completed            (Concluído)
--
-- Postgres enum não permite DROP VALUE, então recria o tipo do zero
-- e migra os dados existentes com CASE.

-- 1) Cria enum novo com valores corretos
CREATE TYPE job_phase_new AS ENUM (
  'planning',
  'permit_released',
  'materials_ordered',
  'materials_delivered',
  'work_in_progress',
  'completed'
);

-- 2) Migra jobs.current_phase com mapeamento dos valores antigos
ALTER TABLE jobs
  ALTER COLUMN current_phase DROP DEFAULT,
  ALTER COLUMN current_phase TYPE job_phase_new
    USING (
      CASE current_phase::text
        WHEN 'materials_arrived' THEN 'materials_delivered'::job_phase_new
        WHEN 'demo'              THEN 'work_in_progress'::job_phase_new
        WHEN 'construction'      THEN 'work_in_progress'::job_phase_new
        WHEN 'finishing'         THEN 'work_in_progress'::job_phase_new
        ELSE current_phase::text::job_phase_new
      END
    ),
  ALTER COLUMN current_phase SET DEFAULT 'planning'::job_phase_new;

-- 3) Migra job_phase_history.phase com mesmo mapeamento
ALTER TABLE job_phase_history
  ALTER COLUMN phase TYPE job_phase_new
    USING (
      CASE phase::text
        WHEN 'materials_arrived' THEN 'materials_delivered'::job_phase_new
        WHEN 'demo'              THEN 'work_in_progress'::job_phase_new
        WHEN 'construction'      THEN 'work_in_progress'::job_phase_new
        WHEN 'finishing'         THEN 'work_in_progress'::job_phase_new
        ELSE phase::text::job_phase_new
      END
    );

-- 4) Remove tipo antigo e renomeia novo pro nome canônico
DROP TYPE job_phase;
ALTER TYPE job_phase_new RENAME TO job_phase;

-- 5) Validação — listar jobs por fase pra confirmar migração
SELECT current_phase, COUNT(*) AS total
FROM jobs
GROUP BY current_phase
ORDER BY current_phase;
-- Esperado: linhas só com valores do novo enum (planning, materials_ordered, etc).
-- Se aparecer 'demo', 'construction', 'finishing' ou 'materials_arrived' = ERRO.
