/**
 * Util pra fotos do job — upload, signed URL e delete.
 *
 * Bucket Supabase Storage: `job-photos` (privado, owner-only via RLS).
 * Path canônico: `jobs/<job_id>/<uuid>.<ext>`.
 *
 * IMPORTANTE: o bucket é criado MANUAL pelo José via Supabase Dashboard.
 * Ver header da migration 0009 pras instruções completas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, JobPhoto, PhotoCategory } from "./types";

const BUCKET = "job-photos";

/** Tamanho máximo aceito no input (10 MB — mesmo limite da policy do bucket). */
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

/** Mime types aceitos (alinhado com a policy do bucket). */
export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

type Client = SupabaseClient<Database>;

/**
 * Gera UUID v4 simples sem dependência externa.
 * Usa crypto.randomUUID se disponível (browser + Node 19+), fallback manual.
 */
function generateUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Extrai extensão a partir do nome do arquivo (lowercased, sem ponto). */
function extractExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  // Fallback pelo mime type
  const fromMime = file.type.split("/")[1]?.toLowerCase();
  return fromMime || "bin";
}

type UploadArgs = {
  supabase: Client;
  jobId: string;
  file: File;
  category: PhotoCategory;
  caption?: string;
  userEmail: string;
  /** Próximo display_order (default 0 — UI ordena por created_at quando empata). */
  displayOrder?: number;
};

type UploadResult = {
  data?: JobPhoto;
  error?: string;
};

/**
 * Faz upload da foto no Storage + cria linha em job_photos.
 *
 * Fluxo:
 *  1. Valida tamanho e mime type
 *  2. Gera path canônico `jobs/<job_id>/<uuid>.<ext>`
 *  3. Upload no Storage com cacheControl 1h e upsert=false
 *  4. INSERT em job_photos com metadata
 *  5. Se INSERT falhar, tenta limpar o arquivo do Storage (rollback best-effort)
 */
export async function uploadJobPhoto(
  args: UploadArgs,
): Promise<UploadResult> {
  const { supabase, jobId, file, category, caption, userEmail, displayOrder } =
    args;

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return {
      error: `Arquivo grande demais (máximo 10 MB).`,
    };
  }

  const mime = file.type || "application/octet-stream";
  if (
    !ALLOWED_PHOTO_MIME_TYPES.some(
      (allowed) => mime.toLowerCase() === allowed,
    )
  ) {
    return {
      error: `Formato não aceito (${mime}). Use JPG, PNG, WEBP ou HEIC.`,
    };
  }

  const ext = extractExtension(file);
  const storagePath = `jobs/${jobId}/${generateUuid()}.${ext}`;

  // 1) Upload no Storage
  const uploadRes = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: mime,
  });

  if (uploadRes.error) {
    return { error: `Falha no upload: ${uploadRes.error.message}` };
  }

  // 2) INSERT no banco
  const { data, error } = await supabase
    .from("job_photos")
    .insert({
      job_id: jobId,
      storage_path: storagePath,
      category,
      caption: caption?.trim() || null,
      file_name: file.name || null,
      file_size: file.size,
      mime_type: mime,
      uploaded_by: userEmail,
      display_order: displayOrder ?? 0,
    })
    .select("*")
    .single<JobPhoto>();

  if (error || !data) {
    // Rollback best-effort: tenta apagar o objeto do Storage
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return {
      error: `Falha ao salvar metadata: ${error?.message ?? "desconhecido"}`,
    };
  }

  return { data };
}

type SignedUrlArgs = {
  supabase: Client;
  storagePath: string;
  /** TTL em segundos (default 1h). */
  expiresIn?: number;
};

/**
 * Gera signed URL temporário pra exibir a foto no client.
 * Retorna null se falhar (UI cuida de mostrar placeholder).
 */
export async function getSignedPhotoUrl(
  args: SignedUrlArgs,
): Promise<string | null> {
  const { supabase, storagePath, expiresIn = 3600 } = args;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

/**
 * Gera signed URLs em lote (uma chamada do Supabase).
 * Retorna mapa `{ storage_path: signedUrl | null }`.
 */
export async function getSignedPhotoUrls(args: {
  supabase: Client;
  storagePaths: string[];
  expiresIn?: number;
}): Promise<Record<string, string | null>> {
  const { supabase, storagePaths, expiresIn = 3600 } = args;
  const map: Record<string, string | null> = {};

  if (storagePaths.length === 0) return map;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(storagePaths, expiresIn);

  if (error || !data) {
    for (const path of storagePaths) map[path] = null;
    return map;
  }

  for (const entry of data) {
    map[entry.path ?? ""] = entry.signedUrl ?? null;
  }
  return map;
}

type DeleteArgs = {
  supabase: Client;
  photo: JobPhoto;
};

type DeleteResult = {
  error?: string;
};

/**
 * Apaga a foto: remove do Storage + DELETE da linha em job_photos.
 *
 * Ordem: Storage primeiro, banco depois. Se Storage falhar, não toca no
 * banco. Se banco falhar depois do Storage, vira "órfão de banco" (sem foto
 * no Storage mas linha persistente) — improvável, mas registrar no console.
 */
export async function deleteJobPhoto(args: DeleteArgs): Promise<DeleteResult> {
  const { supabase, photo } = args;

  // 1) Remove do Storage
  const removeRes = await supabase.storage
    .from(BUCKET)
    .remove([photo.storage_path]);

  if (removeRes.error) {
    return { error: `Falha ao remover arquivo: ${removeRes.error.message}` };
  }

  // 2) DELETE da linha
  const { error } = await supabase
    .from("job_photos")
    .delete()
    .eq("id", photo.id);

  if (error) {
    console.error(
      `[job-photos] arquivo removido mas linha persistiu (id=${photo.id})`,
      error,
    );
    return { error: `Falha ao remover do banco: ${error.message}` };
  }

  return {};
}
