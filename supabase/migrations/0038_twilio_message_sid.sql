-- Migration 0038 — twilio_message_sid em follow_ups
-- Aplicada em: 2026-06-03
--
-- Motivo:
--   Substituir click-to-SMS (manual, abre app do celular) por envio automático
--   via Twilio. Cron processa SMS pendentes igual ja faz com email Resend.
--   Precisa armazenar o SID que Twilio retorna pra rastrear status depois.
--
-- =============================================================================

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS twilio_message_sid TEXT;

CREATE INDEX IF NOT EXISTS idx_follow_ups_twilio_sid
  ON follow_ups(twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

COMMENT ON COLUMN follow_ups.twilio_message_sid IS
  'SID retornado pela Twilio Messaging API quando SMS é enviado. Padrao SM<32hex>.';

-- Validacao
SELECT
  COUNT(*) FILTER (WHERE channel = 'sms' AND twilio_message_sid IS NOT NULL) AS sms_enviados_twilio,
  COUNT(*) FILTER (WHERE channel = 'sms') AS sms_total,
  COUNT(*) FILTER (WHERE channel = 'email') AS email_total
FROM follow_ups;
