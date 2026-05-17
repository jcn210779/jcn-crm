"use client";

import { AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  BUSINESS_EXPENSE_CATEGORY_GROUPS,
  BUSINESS_EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  PAYMENT_METHODS,
  type BusinessExpense,
  type BusinessExpenseCategory,
  type PaymentMethod,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  expense: BusinessExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

type Mode = "edit" | "confirm-delete";

export function EditBusinessExpenseDialog({
  expense,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [category, setCategory] = useState<BusinessExpenseCategory>(
    expense.category,
  );
  const [description, setDescription] = useState(expense.description);
  const [vendor, setVendor] = useState(expense.vendor ?? "");
  const [amount, setAmount] = useState(String(expense.amount));
  const [expenseDate, setExpenseDate] = useState(expense.expense_date);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    expense.payment_method ?? "",
  );
  const [recurring, setRecurring] = useState(expense.recurring);
  const [recurrenceNote, setRecurrenceNote] = useState(
    expense.recurrence_note ?? "",
  );
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [confirmText, setConfirmText] = useState("");

  async function handleSave() {
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
    const { error } = await supabase
      .from("business_expenses")
      .update({
        expense_date: expenseDate,
        category,
        vendor: vendor.trim() || null,
        description: description.trim(),
        amount: amt,
        payment_method: paymentMethod || null,
        recurring,
        recurrence_note: recurring ? recurrenceNote.trim() || null : null,
        notes: notes.trim() || null,
      })
      .eq("id", expense.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }

    toast.success("Gasto atualizado");
    if (onDone) onDone();
  }

  async function attemptDelete() {
    if (confirmText.toLowerCase() !== "excluir") {
      toast.error('Digite "excluir" pra confirmar');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("business_expenses")
      .delete()
      .eq("id", expense.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Gasto excluído");
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("edit");
      setConfirmText("");
    }
    onOpenChange(next);
  }

  if (mode === "confirm-delete") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              Excluir gasto
            </DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
              <p className="text-sm font-semibold text-jcn-ice">
                {expense.description}
              </p>
              <p className="mt-1 text-xs text-jcn-ice/55">
                {BUSINESS_EXPENSE_CATEGORY_LABEL[expense.category]} •{" "}
                {expense.expense_date}
              </p>
              <p className="mt-2 text-base font-black text-rose-300">
                $ {Number(expense.amount).toFixed(2)}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-jcn-ice/55">
                Pra confirmar, digite <strong>excluir</strong>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="flex h-10 w-full rounded-md border border-rose-400/30 bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-rose-400"
                placeholder="excluir"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setMode("edit");
                setConfirmText("");
              }}
              disabled={saving}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={attemptDelete}
              disabled={saving || confirmText.toLowerCase() !== "excluir"}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              {saving ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar gasto da empresa</DialogTitle>
          <DialogDescription>
            Atualize valores ou categoria desse lançamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="be-edit-category">Categoria *</Label>
            <select
              id="be-edit-category"
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="be-edit-description">Descrição *</Label>
            <Input
              id="be-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="be-edit-vendor">Fornecedor</Label>
              <Input
                id="be-edit-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be-edit-amount">Valor ($) *</Label>
              <Input
                id="be-edit-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="be-edit-date">Data *</Label>
              <Input
                id="be-edit-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be-edit-method">Método</Label>
              <select
                id="be-edit-method"
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
              <Label htmlFor="be-edit-recurrence">Frequência</Label>
              <Input
                id="be-edit-recurrence"
                value={recurrenceNote}
                onChange={(e) => setRecurrenceNote(e.target.value)}
                placeholder="Mensal, anual, trimestral..."
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="be-edit-notes">Notas</Label>
            <Textarea
              id="be-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setMode("confirm-delete")}
            disabled={saving}
            className="text-rose-300/80 hover:text-rose-300"
          >
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
