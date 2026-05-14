-- =============================================================================
-- CRM JCN — Migration inicial (Fase 1)
-- =============================================================================
-- Data: 2026-05-14
-- Autor: Victor (build) supervisionado por Pedro
-- Escopo: enums + tabelas `leads`, `stage_history`, `activity_log` + triggers
--         + views + RLS.
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- =============================================================================

-- Extensões necessárias (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUMS (valores fixos do dominio)
-- =============================================================================

-- Etapas do pipeline de leads (7 estados)
DO $$ BEGIN
  CREATE TYPE lead_stage AS ENUM (
    'novo',
    'contato_feito',
    'visita_agendada',
    'cotando',
    'estimate_enviado',
    'ganho',
    'perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fontes de aquisicao do lead
DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM (
    'meta_ads',
    'google_ads',
    'lsa',
    'permit',
    'zillow',
    'referral',
    'direct',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipo de servico de interesse
DO $$ BEGIN
  CREATE TYPE service_type AS ENUM (
    'deck',
    'siding',
    'patio',
    'multiple',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Motivo de perda do lead
DO $$ BEGIN
  CREATE TYPE lost_reason AS ENUM (
    'price',
    'no_show',
    'ghosted',
    'chose_competitor',
    'not_ready',
    'out_of_scope',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. TABELA `leads` (nucleo do CRM)
-- =============================================================================
-- Toda pessoa que entra no funil JCN. Email opcional (muito lead so passa fone).
-- state default 'MA' porque JCN so atende Massachusetts.
CREATE TABLE IF NOT EXISTS leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Contato
  name                text NOT NULL,
  phone               text,
  email               text,

  -- Endereco (servico e local)
  address             text,
  city                text NOT NULL,
  state               text DEFAULT 'MA',
  zip                 text,

  -- Origem
  source              lead_source NOT NULL,
  source_detail       text,

  -- Interesse
  service_interest    service_type NOT NULL,
  service_notes       text,

  -- Pipeline
  stage               lead_stage NOT NULL DEFAULT 'novo',

  -- Valor estimado (mental, antes de cotar formal)
  estimated_value     numeric(10,2),

  -- Marcos temporais
  first_contact_at    timestamptz,
  visit_scheduled_at  timestamptz,
  visit_completed_at  timestamptz,

  -- Se perdido, por que
  lost_reason         lost_reason,
  lost_notes          text,

  -- Livre
  notes               text
);

CREATE INDEX IF NOT EXISTS idx_leads_stage    ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_source   ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_city     ON leads(city);

-- =============================================================================
-- 3. TABELA `stage_history` (audit de mudanca de etapa)
-- =============================================================================
-- Sem isso, nunca da pra medir quanto tempo lead fica em cada fase.
-- Populada automaticamente pelo trigger abaixo.
CREATE TABLE IF NOT EXISTS stage_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_stage  lead_stage,
  to_stage    lead_stage NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text NOT NULL,
  note        text
);

CREATE INDEX IF NOT EXISTS idx_stage_history_lead ON stage_history(lead_id);

-- =============================================================================
-- 4. TABELA `activity_log` (timeline geral)
-- =============================================================================
-- Toda acao relevante fica registrada (criacao, mudanca de stage, nota, etc).
-- Alimenta a timeline visual do lead na tela de detalhe.
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  -- job_id sera adicionado em migration futura (Fase 4) quando jobs existir

  type        text NOT NULL,
  created_by  text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity_log(lead_id, created_at DESC);

-- =============================================================================
-- 5. TRIGGER: atualiza `updated_at` em leads a cada UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_leads_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_set_updated_at ON leads;
CREATE TRIGGER trg_leads_set_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_leads_set_updated_at();

-- =============================================================================
-- 6. TRIGGER: registra stage_history a cada mudanca de stage
-- =============================================================================
-- Usa current_setting('app.user_email', true) pra identificar quem mudou.
-- Frontend faz: SET LOCAL app.user_email = 'jose@...'; antes de UPDATE.
-- Se nao setado, registra 'system' como fallback (ex: trigger automatico).
CREATE OR REPLACE FUNCTION fn_leads_log_stage_change()
RETURNS trigger AS $$
DECLARE
  v_user text;
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    v_user := COALESCE(current_setting('app.user_email', true), 'system');
    IF v_user = '' THEN v_user := 'system'; END IF;

    INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_at, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, now(), v_user);

    -- Loga tambem em activity_log pra timeline geral
    INSERT INTO activity_log (lead_id, type, created_by, payload)
    VALUES (
      NEW.id,
      'stage_changed',
      v_user,
      jsonb_build_object('from', OLD.stage, 'to', NEW.stage)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_log_stage_change ON leads;
CREATE TRIGGER trg_leads_log_stage_change
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_leads_log_stage_change();

-- =============================================================================
-- 7. TRIGGER: registra activity_log a cada INSERT de lead
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_leads_log_creation()
RETURNS trigger AS $$
DECLARE
  v_user text;
BEGIN
  v_user := COALESCE(current_setting('app.user_email', true), 'system');
  IF v_user = '' THEN v_user := 'system'; END IF;

  INSERT INTO activity_log (lead_id, type, created_by, payload)
  VALUES (
    NEW.id,
    'lead_created',
    v_user,
    jsonb_build_object(
      'name', NEW.name,
      'source', NEW.source,
      'service_interest', NEW.service_interest,
      'city', NEW.city
    )
  );

  -- Tambem registra stage inicial em stage_history
  INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_at, changed_by, note)
  VALUES (NEW.id, NULL, NEW.stage, now(), v_user, 'initial');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_log_creation ON leads;
CREATE TRIGGER trg_leads_log_creation
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_leads_log_creation();

-- =============================================================================
-- 8. VIEWS uteis
-- =============================================================================

-- Leads ativos (nao ganho nem perdido), ordenados por criacao desc
CREATE OR REPLACE VIEW v_leads_active AS
SELECT *
FROM leads
WHERE stage NOT IN ('ganho', 'perdido')
ORDER BY created_at DESC;

-- Resumo do pipeline (contagem e valor por etapa)
CREATE OR REPLACE VIEW v_pipeline_summary AS
SELECT
  stage,
  COUNT(*)                      AS count,
  COALESCE(SUM(estimated_value), 0) AS total_value
FROM leads
WHERE stage NOT IN ('ganho', 'perdido')
GROUP BY stage;

-- =============================================================================
-- 9. RLS — Row Level Security
-- =============================================================================
-- Single user (Jose). Policy unica por tabela: qualquer usuario autenticado
-- tem acesso total. Anon (sem login) e bloqueado por nao ter policy permissiva.

ALTER TABLE leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log   ENABLE ROW LEVEL SECURITY;

-- LEADS — acesso total pra usuario logado
DROP POLICY IF EXISTS p_leads_authenticated_all ON leads;
CREATE POLICY p_leads_authenticated_all
  ON leads
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- STAGE_HISTORY — acesso total pra usuario logado
DROP POLICY IF EXISTS p_stage_history_authenticated_all ON stage_history;
CREATE POLICY p_stage_history_authenticated_all
  ON stage_history
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ACTIVITY_LOG — acesso total pra usuario logado
DROP POLICY IF EXISTS p_activity_log_authenticated_all ON activity_log;
CREATE POLICY p_activity_log_authenticated_all
  ON activity_log
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- FIM da migration 0001_initial_schema.sql
-- =============================================================================
-- Como aplicar:
--   1. Supabase dashboard -> projeto jcn-crm -> SQL Editor
--   2. New query -> colar todo o conteudo deste arquivo -> Run
--   3. Verificar em Database -> Tables: leads, stage_history, activity_log
--   4. Verificar em Database -> Views: v_leads_active, v_pipeline_summary
--   5. Verificar em Authentication -> Policies: 3 policies criadas
-- =============================================================================
