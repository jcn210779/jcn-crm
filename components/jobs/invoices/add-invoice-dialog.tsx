"use client";

import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
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
  ALLOWED_INVOICE_MIME_TYPES,
  MAX_INVOICE_SIZE_BYTES,
  uploadInvoiceFile,
} from "@/lib/job-invoices";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Props = {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

function defaultDate(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AddInvoiceDialog({ jobId, open, onOpenChange, onDone }: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [sentAt, setSentAt] = useState<string>(defaultDate());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setInvoiceNumber("");
    setAmount("");
    setSentAt(defaultDate());
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSaving(false);
  }

  function handleFile(f: File | null) {
    if (!f) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    if (f.size > MAX_INVOICE_SIZE_BYTES) {
      toast.error("Arquivo grande demais (máximo 20 MB)");
      return;
    }
    if (!ALLOWED_INVOICE_MIME_TYPES.some((m) => m === f.type.toLowerCase())) {
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

  async function handleSubmit() {
    if (!file) {
      toast.error("Anexe o arquivo da fatura (PDF ou imagem)");
      return;
    }

    let amt: number | null = null;
    const rawAmount = amount.replace(/[^0-9.]/g, "");
    if (rawAmount.length > 0) {
      const parsed = Number(rawAmount);
      if (Number.isNaN(parsed) || parsed < 0) {
        toast.error("Valor inválido");
        return;
      }
      amt = parsed;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Upload do arquivo (obrigatório pra invoice)
    const result = await uploadInvoiceFile({ supabase, jobId, file });
    if (result.error || !result.path) {
      setSaving(false);
      toast.error(result.error ?? "Falha no upload");
      return;
    }

    // 2) INSERT em job_invoices
    const { error } = await supabase.from("job_invoices").insert({
      job_id: jobId,
      file_path: result.path,
      file_name: result.fileName ?? file.name,
      mime: result.mimeType ?? null,
      invoice_number: invoiceNumber.trim() || null,
      amount: amt,
      sent_at: sentAt || null,
    });

    setSaving(false);

    if (error) {
      // Rollback do arquivo se INSERT falhou
      await supabase.storage.from("job-extras").remove([result.path]);
      toast.error("Erro ao salvar fatura", { description: error.message });
      return;
    }

    toast.success("Fatura anexada");
    reset();
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar fatura enviada</DialogTitle>
          <DialogDescription>
            Fatura (invoice) que você enviou ao cliente. Anexe o arquivo e, se
            quiser, informe número e valor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-number">Número da fatura</Label>
              <Input
                id="inv-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-001"
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-amount">Valor ($)</Label>
              <Input
                id="inv-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-date">Data de envio</Label>
            <Input
              id="inv-date"
              type="date"
              value={sentAt}
              onChange={(e) => setSentAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Arquivo da fatura *</Label>
            <input
              ref={fileInputRef}
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
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                type="button"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Anexar fatura (PDF ou imagem)
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar fatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
