-- =============================================================================
-- CRM JCN — Migration 0057 — Anexo de documento por inspeção do job
-- =============================================================================
-- Data: 2026-07-30
-- Aplicar via: Supabase dashboard -> SQL Editor -> New query -> colar -> Run.
-- IDEMPOTENTE.
--
-- Motivo:
--   José quer anexar laudo/foto/PDF em cada job_inspection (footing/framing/
--   finish/etc). flip_inspections já tem essas 3 colunas (attachment_path,
--   attachment_file_name, attachment_mime) desde a mig 0049 — replicando
--   o mesmo padrão em job_inspections.
--
-- Bucket: job-extras (mesmo dos contratos, extras, invoices — path livre
-- prefixado com "inspections/<inspection_id>.<ext>").
-- =============================================================================

ALTER TABLE job_inspections
  ADD COLUMN IF NOT EXISTS attachment_path      text,
  ADD COLUMN IF NOT EXISTS attachment_file_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime      text;

COMMENT ON COLUMN job_inspections.attachment_path IS
  'Path no bucket job-extras. Padrão: inspections/<inspection_id>.<ext>. NULL = sem anexo.';

-- Validação
SELECT
  COUNT(*) AS total_inspecoes,
  COUNT(attachment_path) AS com_anexo
FROM job_inspections;
