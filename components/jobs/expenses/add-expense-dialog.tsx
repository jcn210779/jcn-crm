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
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_SIZE_BYTES,
  uploadReceiptFile,
} from "@/lib/job-expenses";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types";

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

export function AddExpenseDialog({ jobId, open, onOpenChange, onDone }: Props) {
  const [category, setCategory] = useState<ExpenseCategory>("materials");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState<string>(defaultDate());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCategory("materials");
    setDescription("");
    setVendor("");
    setAmount("");
    setExpenseDate(defaultDate());
    setNotes("");
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
    if (f.size > MAX_RECEIPT_SIZE_BYTES) {
      toast.error("Arquivo grande demais (máximo 20 MB)");
      return;
    }
    if (
      !ALLOWED_RECEIPT_MIME_TYPES.some(
        (m) => m === f.type.toLowerCase(),
      )
    ) {
      toast.error(`Formato não aceito (${f.type})`);
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error("Descreva a despesa");
      return;
    }
    const amt = Number(amount.replace(/[^0-9.]/g, ""));
    if (!amt || amt <= 0 || Number.isNaN(amt)) {
      toast.error("Valor inválido");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Upload arquivo (se houver)
    let receiptPath: string | null = null;
    let receiptFileName: string | null = null;
    let receiptSize: number | null = null;
    let receiptMime: string | null = null;

    if (file) {
      const result = await uploadReceiptFile({ supabase, jobId, file });
      if (result.error) {
        setSaving(false);
        toast.error(result.error);
        return;
      }
      receiptPath = result.path ?? null;
      receiptFileName = result.fileName ?? null;
      receiptSize = result.fileSize ?? null;
      receiptMime = result.mimeType ?? null;
    }

    // 2) INSERT em job_expenses
    const { error } = await supabase.from("job_expenses").insert({
      job_id: jobId,
      category,
      description: description.trim(),
      vendor: vendor.trim() || null,
      amount: amt,
      expense_date: expenseDate,
      receipt_path: receiptPath,
      receipt_file_name: receiptFileName,
      receipt_size: receiptSize,
      receipt_mime: receiptMime,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      // Rollback do arquivo se INSERT falhou
      if (receiptPath) {
        await supabase.storage.from("job-receipts").remove([receiptPath]);
      }
      toast.error("Erro ao salvar despesa", { description: error.message });
      return;
    }

    toast.success("Despesa adicionada");
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
          <DialogTitle>Adicionar despesa</DialogTitle>
          <DialogDescription>
            Material, mão de obra, permit ou outros gastos da obra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-category">Categoria</Label>
              <select
                id="exp-category"
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ExpenseCategory)
                }
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-amount">Valor ($)</Label>
              <Input
                id="exp-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Descrição *</Label>
            <Input
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="20 tábuas 2x6 cedro"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-vendor">Fornecedor</Label>
              <Input
                id="exp-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Home Depot"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-date">Data</Label>
              <Input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Recibo (opcional)</Label>
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
                Anexar recibo (foto ou PDF)
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-notes">Notas (opcional)</Label>
            <Textarea
              id="exp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações..."
            />
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
            {saving ? "Salvando..." : "Salvar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
