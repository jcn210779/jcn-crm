"use client";

import { useState } from "react";
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
import { ReceiptInput } from "@/components/ui/receipt-input";
import { Textarea } from "@/components/ui/textarea";
import { uploadReceiptGeneric } from "@/lib/job-expenses";
import {
  BUSINESS_EXPENSE_CATEGORY_GROUPS,
  BUSINESS_EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  PAYMENT_METHODS,
  type BusinessExpenseCategory,
  type PaymentMethod,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

const PLACEHOLDER_BY_CATEGORY: Partial<Record<BusinessExpenseCategory, string>> =
  {
    credit_card_payment: "Fatura cartão Chase fechamento 5 mai",
    insurance: "Workers comp janeiro",
    vehicle_fuel: "Diesel posto Shell Woburn",
    vehicle_maintenance: "Troca óleo van Ford",
    vehicle_finance: "Parcela mensal Ford Transit",
    phone: "Verizon plano negócio",
    internet: "Comcast escritório",
    software: "Supabase Pro mensal",
    accounting: "Honorários contador trimestre",
    legal: "Renovação license GC 2026",
    office_supplies: "Resma papel + tinta impressora",
    rent: "Aluguel garagem Woburn",
    utilities: "Conta luz escritório",
    bank_fees: "Tarifa wire transfer",
    taxes: "Pagamento sales tax trimestre",
    marketing_other: "Cartão de visita 500 unidades",
    training: "Curso OSHA 30h",
    other: "Descreva o gasto",
  };

export function AddBusinessExpenseDialog({
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [category, setCategory] =
    useState<BusinessExpenseCategory>("credit_card_payment");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [checkNumber, setCheckNumber] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceNote, setRecurrenceNote] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setCategory("credit_card_payment");
    setDescription("");
    setVendor("");
    setAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
    setCheckNumber("");
    setRecurring(false);
    setRecurrenceNote("");
    setNotes("");
    setReceiptFile(null);
    setSaving(false);
  }

  async function handleSubmit() {
    if (!description.trim()) {
      toast.error("Informe uma descrição");
      return;
    }
    const amt = Number(amount.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Valor inválido");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Upload recibo (se houver)
    let receiptPath: string | null = null;
    let receiptFileName: string | null = null;
    let receiptSize: number | null = null;
    let receiptMime: string | null = null;

    if (receiptFile) {
      const result = await uploadReceiptGeneric({
        supabase,
        pathPrefix: "business",
        file: receiptFile,
      });
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

    // 2) INSERT business_expense
    const trimmedCheck = checkNumber.trim();
    const { error } = await supabase.from("business_expenses").insert({
      expense_date: expenseDate,
      category,
      vendor: vendor.trim() || null,
      description: description.trim(),
      amount: amt,
      payment_method: paymentMethod || null,
      check_number:
        paymentMethod === "check" && trimmedCheck.length > 0
          ? trimmedCheck
          : null,
      recurring,
      recurrence_note: recurring ? recurrenceNote.trim() || null : null,
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
      toast.error("Erro ao salvar gasto", { description: error.message });
      return;
    }

    toast.success("Gasto registrado");
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
          <DialogTitle>Adicionar gasto da empresa</DialogTitle>
          <DialogDescription>
            Custos operacionais que não são de obra. Tudo aqui entra no caixa
            real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="be-category">Categoria *</Label>
            <select
              id="be-category"
              className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as BusinessExpenseCategory)
              }
            >
              {BUSINESS_EXPENSE_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((c) => (
                    <option key={c} value={c}>
                      {BUSINESS_EXPENSE_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {category === "credit_card_payment" && (
              <p className="text-[11px] text-amber-300/80">
                Use para registrar quando você efetivamente pagou a fatura do
                cartão. Despesas individuais de obra no cartão NÃO precisam ser
                relançadas aqui.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="be-description">Descrição *</Label>
            <Input
              id="be-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={PLACEHOLDER_BY_CATEGORY[category] ?? "Descreva"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="be-vendor">Fornecedor</Label>
              <Input
                id="be-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be-amount">Valor ($) *</Label>
              <Input
                id="be-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="be-date">Data *</Label>
              <Input
                id="be-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be-method">Método</Label>
              <select
                id="be-method"
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
            </div>
          </div>

          {/* Número do cheque — só quando method=check */}
          {paymentMethod === "check" && (
            <div className="space-y-1.5">
              <Label htmlFor="be-check-number">
                Número do cheque
                <span className="ml-2 text-[10px] font-normal text-jcn-ice/45">
                  (recomendado — facilita reconciliar com extrato)
                </span>
              </Label>
              <Input
                id="be-check-number"
                type="text"
                inputMode="numeric"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Ex: 1183"
                maxLength={20}
              />
            </div>
          )}

          {/* Toggle Recorrente */}
          <button
            type="button"
            onClick={() => setRecurring((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition",
              recurring
                ? "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300"
                : "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
            )}
          >
            <span>{recurring ? "Recorrente" : "Gasto pontual"}</span>
            <span
              className={cn(
                "flex h-6 w-11 items-center rounded-full p-0.5 transition",
                recurring
                  ? "justify-end bg-jcn-gold-400/60"
                  : "bg-white/[0.1]",
              )}
            >
              <span className="h-5 w-5 rounded-full bg-white shadow" />
            </span>
          </button>

          {recurring && (
            <div className="space-y-1.5">
              <Label htmlFor="be-recurrence">Frequência</Label>
              <Input
                id="be-recurrence"
                value={recurrenceNote}
                onChange={(e) => setRecurrenceNote(e.target.value)}
                placeholder="Mensal, anual, trimestral..."
              />
              <p className="text-[11px] text-jcn-ice/45">
                Informativo. Não gera entrada automática — você lança quando
                paga.
              </p>
            </div>
          )}

          {/* Recibo */}
          <div className="space-y-1.5">
            <Label>Recibo (opcional)</Label>
            <ReceiptInput
              file={receiptFile}
              onChange={setReceiptFile}
              label="Anexar foto ou PDF do recibo"
              disabled={saving}
            />
            <p className="text-[11px] text-jcn-ice/45">
              JPG, PNG, WEBP, HEIC ou PDF. Máx 20 MB.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="be-notes">Notas</Label>
            <Textarea
              id="be-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações"
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
            {saving ? "Salvando..." : "Salvar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
