-- Migration 0056 — Bucket de anexos do Playbook do Flip
-- =============================================================================
-- Data: 2026-07-21
-- Motivo:
--   José quer anexar DOCUMENTOS DE EXEMPLO (contrato P&S modelo, foto de permit,
--   estimate) em cada etapa do playbook, pra mostrar no office. Os arquivos
--   ficam no Storage do Supabase (servidor) — salvos e acessíveis no celular e
--   no computador. Só os METADADOS (nome/path/tamanho) entram no JSON da árvore.
--
-- Bucket privado + RLS owner-only (mesmo pattern do bucket lead-estimates 0037).
-- =============================================================================

-- 1) Bucket privado (25 MB por arquivo; sem restrição de tipo — José anexa o que quiser)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('playbook-files', 'playbook-files', false, 26214400, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2) RLS owner-only no bucket
DROP POLICY IF EXISTS p_playbook_files_owner_select ON storage.objects;
CREATE POLICY p_playbook_files_owner_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'playbook-files'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

DROP POLICY IF EXISTS p_playbook_files_owner_insert ON storage.objects;
CREATE POLICY p_playbook_files_owner_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'playbook-files'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

DROP POLICY IF EXISTS p_playbook_files_owner_update ON storage.objects;
CREATE POLICY p_playbook_files_owner_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'playbook-files'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

DROP POLICY IF EXISTS p_playbook_files_owner_delete ON storage.objects;
CREATE POLICY p_playbook_files_owner_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'playbook-files'
    AND (auth.jwt() ->> 'email') = 'info@jcnconstructioninc.com'
  );

-- Validação
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'playbook-files';
