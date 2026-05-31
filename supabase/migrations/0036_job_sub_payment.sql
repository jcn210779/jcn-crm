-- =============================================================================
-- CRM JCN — Migration 0036 — Status de pagamento do subempreiteiro
-- =============================================================================
-- Data: 2026-05-31
-- Autor: Victor (build) supervisionado por Pedro
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE — pode rodar várias vezes sem quebrar.
--
-- Escopo:
--   `job_subcontractors.status` já existe MAS representa o estado do TRABALHO
--   (pending / in_progress / completed / cancelled), não o pagamento.
--   José quer saber se o sub foi PAGO, NÃO pago, ou pago em PARTE.
--
-- Design — pagamento é DERIVADO (não enum novo):
--   - `amount_paid` = quanto já foi pago ao sub (default 0).
--   - Status de pagamento é calculado na UI a partir de amount_paid vs agreed_value:
--       amount_paid = 0                     -> "Não pago"
--       0 < amount_paid < agreed_value      -> "Parcial"
--       amount_paid >= agreed_value         -> "Pago"
--   - `paid_at` = data do último pagamento registrado (opcional).
--   - Sem CHECK de teto: permite registrar pagamento acima do combinado
--     (a UI avisa, mas não bloqueia — pode haver ajuste/extra fora do sistema).
-- =============================================================================

ALTER TABLE job_subcontractors
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at date;

-- =============================================================================
-- Validação final
-- =============================================================================
SELECT id, agreed_value, amount_paid, paid_at FROM job_subcontractors LIMIT 5;
