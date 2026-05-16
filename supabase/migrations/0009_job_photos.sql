-- Migration 0009 — fotos do job (upload + categorização)
-- Aplicada em: 2026-05-16
--
-- Escopo Fase 4.2B:
--   José documenta obra com fotos (antes/durante/depois) durante visita.
--   Hoje as fotos ficam soltas no celular (Photos do iPhone). Quer um lar
--   dentro do CRM organizado por job, categorizado e com legenda opcional.
--
-- Notas de design:
--   - Tabela 1:N (jobs -> job_photos). Cada foto é uma linha.
--   - `storage_path` aponta pro objeto no bucket Supabase Storage `job-photos`.
--     Path canônico: "jobs/<job_id>/<uuid>.<ext>".
--   - `category` em 3 valores (`before`, `during`, `after`) define em qual aba
--     a foto aparece na UI. Enum simples — se José precisar mais (ex: "permit",
--     "material"), migration nova adiciona.
--   - `caption` é texto livre opcional pra descrever a foto.
--   - `file_size` em bytes (informativo, não enforced via CHECK — limite real
--     fica no input do form + policy de upload do Supabase Storage).
--   - `display_order` permite reordenar fotos. Default 0 — UI ordena por
--     `created_at desc` quando há empate.
--   - View `v_job_photo_counts` agrega contagem por job × categoria pra UI mostrar
--     "5 antes · 8 durante · 3 depois" no header sem precisar contar no client.
--   - RLS owner-only (mesmo padrão de leads/jobs/payments/ad_spend).
--
-- =============================================================================
-- IMPORTANTE — JOSÉ CRIA O BUCKET STORAGE MANUAL (não via SQL)
-- =============================================================================
-- Supabase Storage não suporta criar bucket via migration SQL pura. Antes de
-- aplicar esta migration (ou logo depois — tanto faz), criar o bucket manual:
--
-- 1. Supabase Dashboard → Storage (ícone pasta no menu esquerdo)
-- 2. Botão "New bucket"
-- 3. Name: job-photos
-- 4. Public bucket: NO (manter privado — vamos servir via signed URL)
-- 5. File size limit: 10 MB
-- 6. Allowed MIME types: image/jpeg, image/png, image/webp, image/heic
-- 7. Save
--
-- Depois, em Storage → Policies → New policy on `job-photos`, criar 3:
--
--   Policy 1 — SELECT (Read):
--     Name: "Owner can read"
--     Allowed operation: SELECT
--     Target roles: authenticated
--     USING expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
--   Policy 2 — INSERT (Upload):
--     Name: "Owner can upload"
--     Allowed operation: INSERT
--     Target roles: authenticated
--     WITH CHECK expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
--   Policy 3 — DELETE:
--     Name: "Owner can delete"
--     Allowed operation: DELETE
--     Target roles: authenticated
--     USING expression:
--       (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
--
-- Sem essas policies o upload falha com "new row violates row-level security".
-- =============================================================================

-- =============================================================================
-- Enum: categoria da foto
-- =============================================================================

CREATE TYPE photo_category AS ENUM (
  'before',
  'during',
  'after'
);

-- =============================================================================
-- Tabela job_photos
-- =============================================================================

CREATE TABLE job_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  job_id        uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Caminho no Supabase Storage (bucket job-photos)
  -- Ex: "jobs/<job_id>/<uuid>.jpg"
  storage_path  text NOT NULL UNIQUE,

  -- Metadata
  category      photo_category NOT NULL,
  caption       text,
  file_name     text,       -- nome original do arquivo (ex: "IMG_4032.HEIC")
  file_size     integer,    -- bytes
  mime_type     text,       -- image/jpeg, image/png, etc

  uploaded_by   text NOT NULL DEFAULT 'system',
  display_order integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_job_photos_job ON job_photos(job_id);
CREATE INDEX idx_job_photos_category ON job_photos(category);

-- =============================================================================
-- RLS owner-only
-- =============================================================================

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_job_photos_owner_only ON job_photos;
CREATE POLICY p_job_photos_owner_only ON job_photos FOR ALL
  USING ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com');

-- =============================================================================
-- View: contagem por job × categoria
-- =============================================================================

CREATE OR REPLACE VIEW v_job_photo_counts AS
SELECT
  job_id,
  COUNT(*) FILTER (WHERE category = 'before') AS before_count,
  COUNT(*) FILTER (WHERE category = 'during') AS during_count,
  COUNT(*) FILTER (WHERE category = 'after')  AS after_count,
  COUNT(*) AS total_count
FROM job_photos
GROUP BY job_id;

-- =============================================================================
-- Validação final
-- =============================================================================

SELECT * FROM job_photos LIMIT 5;
SELECT * FROM v_job_photo_counts LIMIT 5;
