/**
 * Util pra extras / change orders do job — upload, signed URL, delete.
 *
 * Bucket Supabase Storage: `job-extras` (privado, owner-only via RLS).
 * Path canônico: `jobs/<job_id>/<uuid>.<ext>`.
 * Aceita imagens (JPG/PNG/WEBP/HEIC) E PDFs.
 *
 * Cada extra pode ter ATÉ DOIS anexos:
 *   - approval_attachment: prova de aprovação (foto/PDF/print do WhatsApp)
 *   - contract_attachment: contrato adicional formal (PDF)
 *
 * IMPORTANTE: o bucket é criado MANUAL pelo José via Supabase Dashboard.
 * Ver header da migration 0012 pras instruções completas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const BUCKET = "job-extras";

/** Tamanho máximo aceito (20 MB — PDFs de contrato podem ser grandes). */
export const MAX_EXTRA_SIZE_BYTES = 20 * 1024 * 1024;

/** Mime types aceitos (alinhado com policy do bucket). */
export const ALLOWED_EXTRA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

type Client = SupabaseClient<Database>;

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function extractExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const fromMime = file.type.split("/")[1]?.toLowerCase();
  return fromMime || "bin";
}

type UploadResult = {
  path?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
};

/**
 * Upload genérico no bucket job-extras. Usado tanto pra approval quanto
 * pra contract — quem chama decide em qual coluna salvar o path.
 */
export async function uploadExtraAttachment(args: {
  supabase: Client;
  jobId: string;
  file: File;
}): Promise<UploadResult> {
  const { supabase, jobId, file } = args;

  if (file.size > MAX_EXTRA_SIZE_BYTES) {
    return { error: `Arquivo grande demais (máximo 20 MB).` };
  }

  const mime = file.type || "application/octet-stream";
  if (
    !ALLOWED_EXTRA_MIME_TYPES.some(
      (allowed) => mime.toLowerCase() === allowed,
    )
  ) {
    return {
      error: `Formato não aceito (${mime}). Use JPG, PNG, WEBP, HEIC ou PDF.`,
    };
  }

  const ext = extractExtension(file);
  const storagePath = `jobs/${jobId}/${generateUuid()}.${ext}`;

  const uploadRes = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: mime,
    });

  if (uploadRes.error) {
    return { error: `Falha no upload: ${uploadRes.error.message}` };
  }

  return {
    path: storagePath,
    fileName: file.name || undefined,
    fileSize: file.size,
    mimeType: mime,
  };
}

export async function getSignedExtraUrl(args: {
  supabase: Client;
  storagePath: string;
  expiresIn?: number;
}): Promise<string | null> {
  const { supabase, storagePath, expiresIn = 3600 } = args;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function getSignedExtraUrls(args: {
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

export async function deleteExtraAttachment(args: {
  supabase: Client;
  storagePath: string;
}): Promise<{ error?: string }> {
  const { supabase, storagePath } = args;
  const removeRes = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (removeRes.error) {
    return { error: `Falha ao remover arquivo: ${removeRes.error.message}` };
  }
  return {};
}
