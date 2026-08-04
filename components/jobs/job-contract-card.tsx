"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { CollapsibleCard } from "@/components/flips/collapsible-card";
import { Button } from "@/components/ui/button";
import {
  ALLOWED_EXTRA_MIME_TYPES,
  deleteExtraAttachment,
  getSignedExtraUrl,
  MAX_EXTRA_SIZE_BYTES,
} from "@/lib/job-extras";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { Job } from "@/lib/types";

type Props = {
  job: Job;
  initialSignedUrl: string | null;
};

/**
 * Card compacto pra contrato assinado do job.
 * 1 arquivo por job (PDF ou imagem), guardado no bucket job-extras.
 * Path canônico: contracts/<job_id>.<ext>
 */
export function JobContractCard({ job, initialSignedUrl }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(initialSignedUrl);

  const hasContract = job.contract_path !== null;
  const isPdf = job.contract_mime === "application/pdf";

  async function handleUpload(file: File) {
    if (file.size > MAX_EXTRA_SIZE_BYTES) {
      toast.error("Arquivo grande demais (máximo 20 MB)");
      return;
    }
    if (
      !ALLOWED_EXTRA_MIME_TYPES.some((m) => m === file.type.toLowerCase())
    ) {
      toast.error(`Formato não aceito (${file.type})`);
      return;
    }

    setUploading(true);
    const supabase = createSupabaseBrowserClient();

    // Path fixo por job: contracts/<job_id>.<ext>
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `contracts/${job.id}.${ext}`;

    // Se já tinha contrato, remove o antigo antes (pode ter ext diferente)
    if (job.contract_path && job.contract_path !== path) {
      await deleteExtraAttachment({
        supabase,
        storagePath: job.contract_path,
      });
    }

    // Upload (upsert=true pra substituir se mesmo path)
    const upRes = await supabase.storage
      .from("job-extras")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (upRes.error) {
      setUploading(false);
      toast.error(`Falha no upload: ${upRes.error.message}`);
      return;
    }

    // UPDATE jobs com os novos paths
    const { error } = await supabase
      .from("jobs")
      .update({
        contract_path: path,
        contract_file_name: file.name,
        contract_mime: file.type,
        contract_uploaded_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    setUploading(false);

    if (error) {
      // Rollback
      await supabase.storage.from("job-extras").remove([path]);
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }

    toast.success("Contrato anexado");
    // Atualiza signed URL local pra ver na hora
    const newUrl = await getSignedExtraUrl({ supabase, storagePath: path });
    setSignedUrl(newUrl);
    router.refresh();
  }

  async function handleRemove() {
    if (!job.contract_path) return;
    if (
      !window.confirm(
        "Remover contrato? O arquivo será apagado permanentemente.",
      )
    )
      return;

    const supabase = createSupabaseBrowserClient();
    await deleteExtraAttachment({
      supabase,
      storagePath: job.contract_path,
    });

    const { error } = await supabase
      .from("jobs")
      .update({
        contract_path: null,
        contract_file_name: null,
        contract_mime: null,
        contract_uploaded_at: null,
      })
      .eq("id", job.id);

    if (error) {
      toast.error(`Erro ao remover: ${error.message}`);
      return;
    }

    setSignedUrl(null);
    toast.success("Contrato removido");
    router.refresh();
  }

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleView() {
    if (signedUrl) {
      window.open(signedUrl, "_blank");
      return;
    }
    if (!job.contract_path) return;
    const supabase = createSupabaseBrowserClient();
    const url = await getSignedExtraUrl({
      supabase,
      storagePath: job.contract_path,
    });
    if (url) {
      window.open(url, "_blank");
      setSignedUrl(url);
    } else {
      toast.error("Não foi possível abrir o contrato");
    }
  }

  return (
    <CollapsibleCard
      title="Contrato assinado"
      storageKey={`job:${job.id}:contract`}
      icon={
        hasContract ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <FileText className="h-4 w-4 text-jcn-ice/45" />
        )
      }
      subtitle={
        hasContract ? (
          <span className="truncate">
            {job.contract_file_name || "arquivo"}
            {job.contract_uploaded_at && (
              <>
                {" "}
                · anexado em{" "}
                {format(new Date(job.contract_uploaded_at), "d MMM yyyy", {
                  locale: ptBR,
                })}
              </>
            )}
            {isPdf && " · PDF"}
          </span>
        ) : (
          <>Anexe o PDF ou foto do contrato assinado pra ter à mão.</>
        )
      }
      right={
        <div className="flex items-center gap-1.5">
          {hasContract && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleView}
                className="h-9"
              >
                <ExternalLink className="h-4 w-4" />
                Ver
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePickFile}
                disabled={uploading}
                className="h-9 text-xs"
              >
                <Upload className="h-4 w-4" />
                Substituir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-9 w-9 p-0 text-rose-300/70 hover:text-rose-300"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {!hasContract && (
            <Button
              onClick={handlePickFile}
              disabled={uploading}
              className="h-9 font-semibold"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : "Anexar contrato"}
            </Button>
          )}
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          // Reset pra permitir re-upload do mesmo arquivo se necessário
          e.target.value = "";
        }}
      />

      {hasContract ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-200/90">
          Contrato anexado. Use os botões no cabeçalho pra visualizar, substituir
          ou remover.
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-4 text-center text-xs text-jcn-ice/55">
          Nenhum contrato anexado ainda. Clique em <strong>Anexar contrato</strong> pra
          enviar o PDF ou foto do contrato assinado.
        </div>
      )}
    </CollapsibleCard>
  );
}
