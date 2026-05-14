-- =============================================================================
-- CRM JCN — Migration 0004: tabela tasks (follow-ups + lembretes)
-- =============================================================================
-- Data: 2026-05-14
-- Autor: Victor (build) supervisionado por Pedro
-- Escopo: nova tabela `tasks` + enums `task_type` e `task_status` + indices + RLS
--         owner-only (mesmo padrao das outras tabelas pos M1).
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- =============================================================================

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

-- Tipos de tarefa que o Jose pode agendar/registrar
DO $$ BEGIN
  CREATE TYPE task_type AS ENUM (
    'call',
    'sms',
    'email',
    'visit',
    'followup',
    'internal'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Status da tarefa
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'pending',
    'done',
    'skipped',
    'overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. TABELA `tasks`
-- =============================================================================
-- Toda tarefa pendente ou feita liga num lead. Audit + lembrete.
-- `lead_id` e obrigatorio na Fase 3 (todo follow-up pertence a um lead);
-- a coluna nullable + CHECK existem caso futuramente queiramos tarefa
-- standalone (ex: "ligar pra agencia"), basta relaxar o CHECK depois.
CREATE TABLE IF NOT EXISTS tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  type          task_type NOT NULL,
  title         text NOT NULL,
  due_date      timestamptz NOT NULL,
  status        task_status NOT NULL DEFAULT 'pending',
  completed_at  timestamptz,
  notes         text,
  created_by    text NOT NULL DEFAULT 'system',
  CHECK (lead_id IS NOT NULL)
);

-- Indice parcial: query principal e "tarefas pendentes ordenadas por vencimento"
CREATE INDEX IF NOT EXISTS idx_tasks_due
  ON tasks(due_date)
  WHERE status = 'pending';

-- Indice por lead pra render rapido do detalhe do lead
CREATE INDEX IF NOT EXISTS idx_tasks_lead
  ON tasks(lead_id);

-- =============================================================================
-- 3. RLS — owner-only (mesmo padrao das outras tabelas pos M1)
-- =============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_tasks_owner_only ON tasks;
CREATE POLICY p_tasks_owner_only
  ON tasks
  FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- FIM da migration 0004_tasks_table.sql
-- =============================================================================
-- Como aplicar:
--   1. Supabase dashboard -> projeto jcn-crm -> SQL Editor
--   2. New query -> colar todo o conteudo deste arquivo -> Run
--   3. Verificar em Database -> Tables: tasks
--   4. Verificar em Authentication -> Policies: p_tasks_owner_only
-- =============================================================================
