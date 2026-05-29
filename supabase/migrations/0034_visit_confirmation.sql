-- Migration 0034 — Confirmação pública de visita/estimate
-- Aplicada em: PENDENTE (José/Pedro aplica depois de revisar)
--
-- Motivo:
--   Depois de agendar a visita, José manda um link pro cliente final (via SMS /
--   WhatsApp). Hoje não existe forma do cliente confirmar presença ou pedir pra
--   remarcar sem ligar/responder mensagem. Resultado: no-shows e visitas
--   desencontradas que custam tempo e gasolina.
--
-- Solução:
--   Página pública (sem login) /confirmar/<token> onde o cliente vê os dados da
--   visita dele e clica em "Confirm" ou "Need to reschedule". Como a base é
--   RLS owner-only, a página NÃO usa sessão autenticada — ela lê/escreve via
--   service_role dentro de API route, identificando o lead SÓ pelo token opaco.
--   O token é a única credencial. Nenhum outro lead é exposto.
--
-- Campos adicionados em leads:
--   confirm_token            uuid    — token opaco que vira o link público
--   visit_confirmed_at       tstz    — quando o cliente confirmou presença
--   reschedule_requested_at  tstz    — quando o cliente pediu pra remarcar
--
-- SEGURANÇA:
--   confirm_token é gerado por gen_random_uuid() (não adivinhável). O DEFAULT
--   cobre leads novos; o UPDATE de backfill garante token nos leads existentes.
--   Index único garante lookup rápido e impede colisão.
--
-- =============================================================================

-- 1) ADD COLUMNS
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS confirm_token UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS visit_confirmed_at TIMESTAMPTZ;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ;

-- 2) BACKFILL: garante token em leads existentes.
--    O DEFAULT já preenche linhas novas e, no ADD COLUMN com DEFAULT volátil,
--    o Postgres preenche cada linha existente com um valor distinto. Este UPDATE
--    é defensivo (idempotente) caso alguma linha tenha ficado nula.
UPDATE leads
SET confirm_token = gen_random_uuid()
WHERE confirm_token IS NULL;

-- 3) INDEX único no token (lookup público + garante unicidade)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_confirm_token
  ON leads(confirm_token);

COMMENT ON COLUMN leads.confirm_token IS
  'Token opaco (uuid) usado na página pública /confirmar/<token>. Única credencial pra cliente confirmar/remarcar visita sem login.';
COMMENT ON COLUMN leads.visit_confirmed_at IS
  'Quando o cliente confirmou presença na visita pela página pública.';
COMMENT ON COLUMN leads.reschedule_requested_at IS
  'Quando o cliente pediu pra remarcar a visita pela página pública.';

-- Validação
SELECT
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE confirm_token IS NOT NULL) AS com_token,
  COUNT(*) FILTER (WHERE confirm_token IS NULL) AS sem_token
FROM leads;
