-- Migration 0024 — Follow-ups automáticos (drafts revisados + envio via Resend)
-- Aplicada em: 2026-05-19
--
-- Motivo:
--   José quer follow-up automático pra (1) leads novos sem resposta, (2) leads
--   esfriando após estimate, (3) clientes em obra (mudança de fase).
--   Modo semi-automático: cron diário cria draft + José revisa + envia.
--
-- Fluxo:
--   1. Cron diário 9am escaneia leads/jobs → cria entradas em follow_ups status='pending'
--   2. UI em /follow-ups lista pendentes
--   3. José abre, revisa/edita draft, clica "Enviar"
--   4. Backend chama /api/send-email → Resend SDK → marca status='sent'
--   5. Histórico fica visível pra auditoria
--
-- =============================================================================

-- 1) Enum tipo de gatilho
DROP TYPE IF EXISTS follow_up_kind CASCADE;
CREATE TYPE follow_up_kind AS ENUM (
  'new_lead_4h',          -- Lead chegou +4h e ainda não tem ação
  'estimate_sent_3d',     -- Estimate enviado, esfriando 3 dias
  'estimate_sent_7d',     -- Esfriando 7 dias
  'estimate_sent_14d',    -- Última tentativa, 14 dias
  'job_phase_changed'     -- Fase do job mudou nas últimas 24h
);

-- 2) Enum status
DROP TYPE IF EXISTS follow_up_status CASCADE;
CREATE TYPE follow_up_status AS ENUM (
  'pending',    -- Draft criado, aguardando José revisar
  'sent',       -- Email enviado via Resend
  'skipped',    -- José pulou (não enviou)
  'failed'      -- Erro no envio (visível pra retry manual)
);

-- 3) Tabela follow_ups
CREATE TABLE IF NOT EXISTS follow_ups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Origem (pode ser de um lead OU de um job — sempre 1 dos 2)
  lead_id         uuid REFERENCES leads(id) ON DELETE CASCADE,
  job_id          uuid REFERENCES jobs(id) ON DELETE CASCADE,

  kind            follow_up_kind NOT NULL,
  status          follow_up_status NOT NULL DEFAULT 'pending',

  -- Conteúdo do draft (gerado pelo cron, editável pelo José)
  draft_subject   text NOT NULL,
  draft_body      text NOT NULL,
  to_email        text NOT NULL,
  to_name         text,

  -- Resultado do envio
  sent_at         timestamptz,
  resend_email_id text,                              -- ID que Resend retorna
  error_message   text,                              -- se falhou

  -- Notas internas
  notes           text,

  -- Constraint: pelo menos 1 dos 2 (lead_id OU job_id)
  CONSTRAINT chk_follow_ups_origin CHECK (
    (lead_id IS NOT NULL) OR (job_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_id)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_job ON follow_ups(job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_created ON follow_ups(created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_follow_ups_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_follow_ups_set_updated_at ON follow_ups;
CREATE TRIGGER trg_follow_ups_set_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION fn_follow_ups_set_updated_at();

-- RLS owner-only
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_follow_ups_owner_only ON follow_ups;
CREATE POLICY p_follow_ups_owner_only ON follow_ups FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- Validação
SELECT 'follow_ups table criada' AS status;
