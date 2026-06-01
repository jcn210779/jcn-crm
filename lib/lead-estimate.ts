/**
 * Util pra estimate do lead — upload, signed URL, delete.
 *
 * Bucket Supabase Storage: `lead-estimates` (privado, owner-only via RLS).
 * Path canônico: `estimates/<lead_id>/<uuid>.<ext>`.
 * Aceita imagens (JPG/PNG/WEBP/HEIC) E PDFs.
 *
 * Bucket criado via migration 0037 (INSERT INTO storage.buckets).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const BUCKET = "lead-estimates";

export const MAX_ESTIMATE_SIZE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_ESTIMATE_MIME_TYPES = [
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
 * Upload do PDF/imagem do estimate. Path = `estimates/<lead_id>/<uuid>.<ext>`.
 */
export async function uploadEstimateFile(args: {
  supabase: Client;
  leadId: string;
  file: File;
}): Promise<UploadResult> {
  const { supabase, leadId, file } = args;

  if (file.size > MAX_ESTIMATE_SIZE_BYTES) {
    return { error: `Arquivo grande demais (máximo 20 MB).` };
  }

  const mime = file.type || "application/octet-stream";
  if (
    !ALLOWED_ESTIMATE_MIME_TYPES.some(
      (allowed) => mime.toLowerCase() === allowed,
    )
  ) {
    return {
      error: `Formato não aceito (${mime}). Use JPG, PNG, WEBP, HEIC ou PDF.`,
    };
  }

  const ext = extractExtension(file);
  const storagePath = `estimates/${leadId}/${generateUuid()}.${ext}`;

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

/** Signed URL pra exibir/baixar o estimate (válida por 1h). */
export async function getSignedEstimateUrl(args: {
  supabase: Client;
  storagePath: string;
  expiresInSeconds?: number;
}): Promise<string | null> {
  const { supabase, storagePath, expiresInSeconds = 3600 } = args;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Apaga o estimate do Storage (chamar antes de zerar estimate_path no banco). */
export async function deleteEstimateFile(args: {
  supabase: Client;
  storagePath: string;
}): Promise<{ error?: string }> {
  const { supabase, storagePath } = args;
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) return { error: error.message };
  return {};
}
