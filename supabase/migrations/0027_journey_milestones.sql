-- Migration 0027 — Jornada do cliente (12 etapas: lead → entrega)
-- Aplicada em: 2026-05-20
--
-- Motivo:
--   José quer ver o ciclo de vida completo do cliente numa linha do tempo,
--   do primeiro contato à entrega final, com 12 marcos visuais:
--
--   1. Cadastro do lead              (auto: lead criado)
--   2. Envio Proposta                (auto: stage>=estimate_enviado OU manual)
--   3. Proposta aceita               (manual)
--   4. Envio do Contrato             (manual)
--   5. Contrato assinado             (auto: job existe)
--   6. Invoice 1/3 enviada           (auto: 1º job_payment criado)
--   7. Aplicação Permit / Permit OK  (auto: phase>=permit_released OU manual)
--   8. Invoice 2/3 enviada           (auto: 2º job_payment criado)
--   9. Início da obra                (auto: actual_start preenchido OU phase>=work_in_progress)
--   10. Processo da obra             (auto: phase=work_in_progress)
--   11. Invoice 3/3 enviada          (auto: 3º job_payment criado)
--   12. Entrega                      (auto: phase=completed)
--
-- Tabela journey_milestones armazena overrides MANUAIS pras etapas 3, 4 e
-- qualquer outra que José quiser forçar/destravar. Os marcos automáticos
-- são computados em runtime a partir dos dados existentes.
--
-- =============================================================================

DROP TYPE IF EXISTS journey_milestone_kind CASCADE;
CREATE TYPE journey_milestone_kind AS ENUM (
  'lead_registered',
  'proposal_sent',
  'proposal_accepted',
  'contract_sent',
  'contract_signed',
  'invoice_1_sent',
  'permit_ok',
  'invoice_2_sent',
  'work_started',
  'work_in_progress',
  'invoice_3_sent',
  'delivered'
);

CREATE TABLE IF NOT EXISTS journey_milestones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Pode ser de um lead (etapas 1-4) OU de um job (etapas 5-12)
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  job_id        uuid REFERENCES jobs(id) ON DELETE CASCADE,

  kind          journey_milestone_kind NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  notes         text,

  CONSTRAINT chk_journey_origin CHECK (
    (lead_id IS NOT NULL) OR (job_id IS NOT NULL)
  )
);

-- Idempotência: 1 marco do mesmo kind por entidade
CREATE UNIQUE INDEX IF NOT EXISTS uniq_journey_lead
  ON journey_milestones(lead_id, kind)
  WHERE lead_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_journey_job
  ON journey_milestones(job_id, kind)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journey_completed
  ON journey_milestones(completed_at DESC);

-- RLS owner-only
ALTER TABLE journey_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_journey_milestones_owner_only ON journey_milestones;
CREATE POLICY p_journey_milestones_owner_only ON journey_milestones FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

SELECT 'journey_milestones criada' AS status;
