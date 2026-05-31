-- =============================================================================
-- CRM JCN — Migration 0035 — Invoices ENVIADOS ao cliente (por job)
-- =============================================================================
-- Data: 2026-05-31
-- Autor: Victor (build) supervisionado por Pedro
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE — pode rodar várias vezes sem quebrar.
--
-- Escopo:
--   José precisa guardar as FATURAS (invoices) que a JCN ENVIA pro cliente —
--   um documento de recebível (o que o cliente deve pagar).
--
-- IMPORTANTE — DIFERENÇA vs despesas (job_expenses):
--   - `job_expenses`  = $$$ que SAI (comprovante de DESPESA / receipt de compra).
--   - `job_invoices`  = FATURA que a JCN ENVIA ao cliente (recebível). ESTA migration.
--   NÃO confundir nem reaproveitar a tabela de expenses.
--
-- Notas de design:
--   - Tabela 1:N (jobs -> job_invoices). Múltiplos invoices por job.
--   - `file_path`/`file_name` apontam pro arquivo no Storage (bucket job-extras,
--     mesmo bucket usado pro contrato — já aceita PDF). Path canônico:
--       "invoices/<job_id>/<uuid>.<ext>"
--   - `invoice_number`, `amount` e `sent_at` são OPCIONAIS (nullable) — José
--     pode anexar o PDF sem digitar o número/valor.
--   - RLS owner-only (mesmo padrão de job_expenses / job_subcontractors).
--
-- =============================================================================
-- STORAGE — reaproveita o bucket job-extras (já existe, já aceita PDF)
-- =============================================================================
-- NENHUM bucket novo precisa ser criado. Os invoices usam o bucket `job-extras`
-- (criado na migration 0012, mesmo usado pro contrato assinado). As policies de
-- Storage owner-only desse bucket já cobrem SELECT/INSERT/DELETE.
-- =============================================================================

-- =============================================================================
-- TABELA: job_invoices
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Arquivo no Supabase Storage (bucket job-extras)
  file_path       text NOT NULL,                  -- "invoices/<job_id>/<uuid>.<ext>"
  file_name       text NOT NULL,                  -- nome original do arquivo
  mime            text,                           -- application/pdf, image/jpeg, ...

  -- Metadados opcionais da fatura
  invoice_number  text,                           -- número da fatura (ex: "INV-001")
  amount          numeric(12,2),                  -- valor faturado (recebível)
  sent_at         date                            -- data em que foi enviada ao cliente
);

CREATE INDEX IF NOT EXISTS idx_job_invoices_job ON job_invoices(job_id);

-- =============================================================================
-- RLS: owner-only (info@jcnconstructioninc.com) — mesmo padrão das outras tabelas
-- =============================================================================
ALTER TABLE job_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_invoices_owner_only ON job_invoices;
CREATE POLICY p_job_invoices_owner_only ON job_invoices FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- Validação final
-- =============================================================================
SELECT * FROM job_invoices LIMIT 5;
