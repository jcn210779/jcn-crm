"use client";

import { FileText, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALLOWED_ESTIMATE_MIME_TYPES,
  MAX_ESTIMATE_SIZE_BYTES,
  uploadEstimateFile,
} from "@/lib/lead-estimate";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  /** Valor atualmente em leads.estimated_value (pode estar null). */
  currentEstimatedValue: number | null;
  onDone: () => void;
};

export function EstimateUploadDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  currentEstimatedValue,
  onDone,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [value, setValue] = useState<string>(
    currentEstimatedValue ? String(currentEstimatedValue) : "",
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreviewUrl(null);
    setValue(currentEstimatedValue ? String(currentEstimatedValue) : "");
  }, [open, currentEstimatedValue]);

  function handleFile(f: File | null) {
    if (!f) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    if (f.size > MAX_ESTIMATE_SIZE_BYTES) {
      toast.error("Arquivo grande demais (máximo 20 MB)");
      return;
    }
    const mime = f.type.toLowerCase();
    if (!ALLOWED_ESTIMATE_MIME_TYPES.some((m) => m === mime)) {
      toast.error(`Formato não aceito (${f.type})`);
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleSave() {
    if (!file) {
      toast.error("Anexe um arquivo do estimate (PDF ou foto)");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const up = await uploadEstimateFile({ supabase, leadId, file });
    if (up.error || !up.path) {
      setSaving(false);
      toast.error(up.error ?? "Falha no upload");
      return;
    }

    const valNum = value.trim() ? Number(value.replace(/[^0-9.]/g, "")) : null;

    const { error } = await supabase
      .from("leads")
      .update({
        estimate_path: up.path,
        estimate_file_name: up.fileName ?? null,
        estimate_size: up.fileSize ?? null,
        estimate_mime: up.mimeType ?? null,
        estimate_uploaded_at: new Date().toISOString(),
        ...(valNum && valNum > 0 ? { estimated_value: valNum } : {}),
      })
      .eq("id", leadId);

    setSaving(false);

    if (error) {
      await supabase.storage.from("lead-estimates").remove([up.path]);
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }

    toast.success("Estimate anexado");
    onDone();
  }

  function handleSkip() {
    toast.info("Você pode anexar o estimate depois pelo /lead/" + leadName);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            Anexar estimate
          </DialogTitle>
          <DialogDescription>
            <b>{leadName}</b> — estimate enviado pro cliente.
            <br />
            Anexe o PDF ou foto pra ter histórico do que foi prometido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Valor do estimate */}
          <div className="space-y-1.5">
            <Label htmlFor="est-value">Valor do estimate (opcional)</Label>
            <Input
              id="est-value"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              disabled={saving}
            />
            <p className="text-[10px] text-jcn-ice/45">
              Vai pra coluna &ldquo;Valor estimado&rdquo; do lead. Ajuda a
              comparar depois com o contrato real.
            </p>
          </div>

          {/* Upload */}
          <div className="space-y-1.5">
            <Label>Arquivo do estimate *</Label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300">
                    {file.type === "application/pdf" ? (
                      <FileText className="h-6 w-6" />
                    ) : (
                      <ImageIcon className="h-6 w-6" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-jcn-ice">
                    {file.name}
                  </p>
                  <p className="text-xs text-jcn-ice/55">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleFile(null)}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                type="button"
                className="w-full"
                onClick={() => inputRef.current?.click()}
                disabled={saving}
              >
                <Upload className="h-4 w-4" />
                Anexar PDF ou foto do estimate
              </Button>
            )}
            <p className="text-[10px] text-jcn-ice/45">
              PDF, JPG, PNG, WEBP ou HEIC. Máximo 20 MB.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-jcn-ice/55 hover:bg-white/[0.04] hover:text-jcn-ice/75"
          >
            Pular por agora
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !file}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Salvar estimate
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
