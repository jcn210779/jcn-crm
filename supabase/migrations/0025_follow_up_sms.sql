-- Migration 0025 — Adicionar canal SMS em follow_ups (click-to-send)
-- Aplicada em: 2026-05-19
--
-- Motivo:
--   José quer follow-up por SMS também (não só email). Como não tem Twilio
--   ainda, vai funcionar via "click-to-SMS": sistema gera link sms:+phone?body=,
--   José clica no celular → abre app de SMS → ele aperta enviar.
--
-- Mudanças:
--   - Adicionar coluna channel (email/sms) com default 'email'
--   - Adicionar coluna to_phone pra SMS
--   - to_email vira nullable (SMS não precisa email)
--
-- Pra SMS, o status 'sent' significa "José clicou pra abrir o app e confirmou
-- que enviou". Não há confirmação automática do envio (sem Twilio API).
--
-- =============================================================================

-- 1) Enum canal
DROP TYPE IF EXISTS follow_up_channel CASCADE;
CREATE TYPE follow_up_channel AS ENUM ('email', 'sms');

-- 2) Adiciona colunas
ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS channel follow_up_channel NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS to_phone text;

-- 3) Tornar to_email nullable (SMS não precisa)
ALTER TABLE follow_ups
  ALTER COLUMN to_email DROP NOT NULL;

-- 4) Constraint: se channel=email, to_email obrigatório; se channel=sms, to_phone obrigatório
ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS chk_follow_ups_channel_target;
ALTER TABLE follow_ups ADD CONSTRAINT chk_follow_ups_channel_target CHECK (
  (channel = 'email' AND to_email IS NOT NULL) OR
  (channel = 'sms' AND to_phone IS NOT NULL)
);

COMMENT ON COLUMN follow_ups.channel IS
  'email = envia via Resend automaticamente. sms = abre app de SMS no celular do José (click-to-send).';

-- Validação
SELECT 'channel + to_phone adicionados em follow_ups' AS status;
