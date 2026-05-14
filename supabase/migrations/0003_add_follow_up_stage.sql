-- Migration 0003 — adicionar etapa `follow_up` no pipeline
-- Aplicada em: 2026-05-14
-- Motivo: José pediu separar visualmente leads em "estimate enviado fresquinho"
-- vs "estimate em follow-up há dias". Antes era uma coluna só.
--
-- Posição: entre `estimate_enviado` e `ganho` (linha 6 do enum, era 7).
-- Trigger: MANUAL (José arrasta quando achar apropriado).
-- Reversibilidade: livre (pode voltar pra estimate_enviado ou ir pra ganho/perdido).
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE não roda dentro de transação no Postgres < 12.
-- Supabase usa Postgres 15+ que permite, mas execute como statement único pra garantir.

ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'follow_up' AFTER 'estimate_enviado';

-- Validação: lista os valores do enum pra confirmar ordem
SELECT enumlabel, enumsortorder
FROM pg_enum
WHERE enumtypid = 'lead_stage'::regtype
ORDER BY enumsortorder;
-- Esperado: novo (1), contato_feito (2), visita_agendada (3), cotando (4),
-- estimate_enviado (5), follow_up (6), ganho (7), perdido (8)
