"use client";

import { AlertTriangle, FileText, Image as ImageIcon, Upload, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_SIZE_BYTES,
  uploadReceiptFile,
} from "@/lib/job-expenses";
import {
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type ExpenseCategory,
  type ExpenseKind,
  type JobExpense,
  type PaymentMethod,
} from "@/lib/types";

type Props = {
  jobId: string;
  /** 'purchase' (default) = compra normal. 'return' = devolução de material (subtrai do total). */
  kind?: ExpenseKind;
  /** Se passado, dialog entra em modo EDIÇÃO (UPDATE em vez de INSERT). */
  expense?: JobExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

function defaultDate(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AddExpenseDialog({
  jobId,
  kind = "purchase",
  expense = null,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const isEdit = expense !== null;
  const effectiveKind: ExpenseKind = isEdit ? expense.kind : kind;
  const isReturn = effectiveKind === "return";
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "materials",
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [amount, setAmount] = useState(
    expense ? String(expense.amount) : "",
  );
  const [expenseDate, setExpenseDate] = useState<string>(
    expense?.expense_date ?? defaultDate(),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    expense?.payment_method ?? "",
  );
  const [checkNumber, setCheckNumber] = useState(expense?.check_number ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sincroniza state quando expense muda (abrir edit em row diferente)
  useEffect(() => {
    if (!open) return;
    if (expense) {
      setCategory(expense.category);
      setDescription(expense.description);
      setVendor(expense.vendor ?? "");
      setAmount(String(expense.amount));
      setExpenseDate(expense.expense_date);
      setPaymentMethod(expense.payment_method ?? "");
      setCheckNumber(expense.check_number ?? "");
      setNotes(expense.notes ?? "");
    } else {
      // Modo criar — reset pra default
      setCategory("materials");
      setDescription("");
      setVendor("");
      setAmount("");
      setExpenseDate(defaultDate());
      setPaymentMethod("");
      setCheckNumber("");
      setNotes("");
    }
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  function reset() {
    setCategory("materials");
    setDescription("");
    setVendor("");
    setAmount("");
    setExpenseDate(defaultDate());
    setPaymentMethod("");
    setCheckNumber("");
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

    // 2) INSERT ou UPDATE em job_expenses
    const trimmedCheck = checkNumber.trim();
    const basePayload = {
      category,
      description: description.trim(),
      vendor: vendor.trim() || null,
      amount: amt,
      expense_date: expenseDate,
      payment_method: paymentMethod || null,
      check_number:
        paymentMethod === "check" && trimmedCheck.length > 0
          ? trimmedCheck
          : null,
      notes: notes.trim() || null,
    };

    let error: { message: string } | null = null;

    if (isEdit && expense) {
      // UPDATE: se subiu arquivo novo, substitui e apaga o antigo. Senão mantém.
      const updatePayload = file
        ? {
            ...basePayload,
            receipt_path: receiptPath,
            receipt_file_name: receiptFileName,
            receipt_size: receiptSize,
            receipt_mime: receiptMime,
          }
        : basePayload;
      const res = await supabase
        .from("job_expenses")
        .update(updatePayload)
        .eq("id", expense.id);
      error = res.error;
      // Apaga recibo antigo se subiu novo com sucesso
      if (!error && file && expense.receipt_path) {
        await supabase.storage
          .from("job-receipts")
          .remove([expense.receipt_path]);
      }
    } else {
      const res = await supabase.from("job_expenses").insert({
        job_id: jobId,
        kind: effectiveKind,
        ...basePayload,
        receipt_path: receiptPath,
        receipt_file_name: receiptFileName,
        receipt_size: receiptSize,
        receipt_mime: receiptMime,
      });
      error = res.error;
    }

    setSaving(false);

    if (error) {
      // Rollback do arquivo novo se INSERT/UPDATE falhou
      if (receiptPath) {
        await supabase.storage.from("job-receipts").remove([receiptPath]);
      }
      toast.error(
        isEdit ? "Erro ao atualizar despesa" : "Erro ao salvar despesa",
        { description: error.message },
      );
      return;
    }

    toast.success(
      isEdit
        ? isReturn
          ? "Devolução atualizada"
          : "Despesa atualizada"
        : isReturn
          ? "Devolução registrada"
          : "Despesa adicionada",
    );
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
          <DialogTitle>
            {isEdit
              ? isReturn
                ? "Editar devolução de material"
                : "Editar despesa"
              : isReturn
                ? "Registrar devolução de material"
                : "Adicionar despesa"}
          </DialogTitle>
          <DialogDescription>
            {isReturn
              ? "Material que sobrou e foi devolvido pra loja. Vai subtrair do total gasto do job e refletir no /finance."
              : "Material, mão de obra, permit ou outros gastos da obra."}
            {isEdit && expense?.receipt_file_name && !file && (
              <span className="mt-1 block text-[10px] text-jcn-ice/45">
                Recibo atual: <strong>{expense.receipt_file_name}</strong>.
                Anexar novo arquivo substitui.
              </span>
            )}
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
            <Label htmlFor="exp-method">Método de pagamento</Label>
            <select
              id="exp-method"
              className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | "")
              }
            >
              <option value="">Não informado</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
            {paymentMethod === "credit_card" && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Essa despesa <strong>NÃO</strong> conta no caixa real até
                  você registrar o pagamento da fatura em &ldquo;Gastos da
                  empresa&rdquo;. Continua entrando na margem do job
                  normalmente.
                </span>
              </div>
            )}
            {paymentMethod === "vendor_account" && (
              <div className="flex items-start gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3 text-[11px] text-violet-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Material em <strong>conta aberta com fornecedor</strong>{" "}
                  (Lansing, etc). NÃO sai do caixa agora. Quando você pagar a
                  fatura no dia 15, lance em &ldquo;Gastos da empresa&rdquo;
                  com método cheque/transferência. Continua entrando na margem
                  do job normalmente.
                </span>
              </div>
            )}
          </div>

          {/* Número do cheque — só quando method=check */}
          {paymentMethod === "check" && (
            <div className="space-y-1.5">
              <Label htmlFor="exp-check-number">
                Número do cheque
                <span className="ml-2 text-[10px] font-normal text-jcn-ice/45">
                  (recomendado — facilita reconciliar com extrato)
                </span>
              </Label>
              <Input
                id="exp-check-number"
                type="text"
                inputMode="numeric"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Ex: 1183"
                maxLength={20}
              />
            </div>
          )}

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
            {saving
              ? "Salvando..."
              : isEdit
                ? "Salvar alterações"
                : "Salvar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
