-- =============================================================================
-- CRM JCN — Migration 0053 — Data + horário em inspeções e tarefas do flip
-- =============================================================================
-- Data: 2026-07-06
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   Inspeções da cidade e tarefas do flip precisam de HORÁRIO específico
--   (ex: "framing inspection 15/07 às 09:30"). Hoje é só date, sem hora.
--   Também abre caminho pra integrar com Google Calendar.
--
-- Solução:
--   ALTER COLUMN date -> timestamptz nas 4 colunas afetadas:
--     flip_inspections.scheduled_date
--     flip_inspections.done_date
--     flip_tasks.due_date
--     flip_tasks.done_at
--   Valores existentes viram meia-noite local (aceitável — José pode editar).
-- =============================================================================

ALTER TABLE flip_inspections
  ALTER COLUMN scheduled_date TYPE timestamptz
    USING scheduled_date::timestamptz,
  ALTER COLUMN done_date TYPE timestamptz
    USING done_date::timestamptz;

ALTER TABLE flip_tasks
  ALTER COLUMN due_date TYPE timestamptz
    USING due_date::timestamptz,
  ALTER COLUMN done_at TYPE timestamptz
    USING done_at::timestamptz;

-- Validação
SELECT
  (SELECT COUNT(*) FROM flip_inspections) AS total_inspections,
  (SELECT COUNT(*) FROM flip_inspections WHERE scheduled_date IS NOT NULL) AS with_scheduled_time,
  (SELECT COUNT(*) FROM flip_tasks) AS total_tasks,
  (SELECT COUNT(*) FROM flip_tasks WHERE due_date IS NOT NULL) AS with_due_time;
