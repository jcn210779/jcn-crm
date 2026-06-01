-- Migration 0037 — Anexo do estimate no lead
-- Aplicada em: 2026-06-01
--
-- Motivo:
--   Hoje quando lead vai pra 'estimate_enviado' nao tem onde anexar o PDF/foto
--   do estimate que foi enviado pro cliente. Resultado: nao da pra auditar
--   depois "o que foi prometido" vs "o que virou contrato" vs "o que foi feito".
--
-- Solucao:
--   - 5 campos novos em leads pra metadados do anexo (path, name, size, mime, uploaded_at)
--   - Bucket Storage 'lead-estimates' com RLS owner-only
--   - Path pattern: estimates/<lead_id>/<uuid>.<ext>
--
-- =============================================================================

-- 1) ADD COLUMNS
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimate_path TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimate_file_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimate_size INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimate_mime TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimate_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_estimate_path
  ON leads(estimate_path)
  WHERE estimate_path IS NOT NULL;

-- 2) BUCKET Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-estimates',
  'lead-estimates',
  false,
  20971520, -- 20MB
  ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3) RLS owner-only no bucket
DROP POLICY IF EXISTS p_lead_estimates_owner_select ON storage.objects;
CREATE POLICY p_lead_estimates_owner_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'lead-estimates'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

DROP POLICY IF EXISTS p_lead_estimates_owner_insert ON storage.objects;
CREATE POLICY p_lead_estimates_owner_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'lead-estimates'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

DROP POLICY IF EXISTS p_lead_estimates_owner_update ON storage.objects;
CREATE POLICY p_lead_estimates_owner_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'lead-estimates'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

DROP POLICY IF EXISTS p_lead_estimates_owner_delete ON storage.objects;
CREATE POLICY p_lead_estimates_owner_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'lead-estimates'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

-- Validacao
SELECT
  COUNT(*) FILTER (WHERE estimate_path IS NOT NULL) AS leads_com_estimate,
  COUNT(*) AS total_leads
FROM leads;
