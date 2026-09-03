-- ============================================================================
-- 0066 — flip_tasks.is_urgent (marca tarefa como urgente/prioridade)
-- ============================================================================
-- Adiciona flag simples pra sinalizar tarefas que nao podem esperar.
-- UI mostra badge vermelho "URGENTE" e ordena antes das normais dentro da fase.

ALTER TABLE flip_tasks
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_flip_tasks_urgent
  ON flip_tasks (flip_id) WHERE is_urgent = true;
