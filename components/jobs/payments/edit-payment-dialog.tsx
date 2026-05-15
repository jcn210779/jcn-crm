"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type JobPayment,
  type JobPaymentUpdate,
  type PaymentKind,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: JobPayment | null;
};

/**
 * Dialog pra editar parcela existente.
 *
 * UX:
 * - Permite alterar tipo, label, valor, data prevista, status, método, notas.
 * - Status pode virar overdue, cancelled, paid (caso queira corrigir).
 * - Se virar `paid` mas received_at estiver vazio, preenche com agora.
 */
export function EditPaymentDialog({ open, onOpenChange, payment }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [kind, setKind] = useState<PaymentKind>("milestone");
  const [label, setLabel] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!open || !payment) return;
    setKind(payment.kind);
    setLabel(payment.label);
    setAmount(String(payment.amount));
    setDueDate(payment.due_date ?? "");
    setStatus(payment.status);
    setMethod(payment.method ?? "");
    setNotes(payment.notes ?? "");
    setSaving(false);
  }, [open, payment]);

  async function handleSave() {
    if (!payment) return;

    const cleaned = amount.replace(/[^0-9.]/g, "");
    const parsed = Number(cleaned);
    if (!cleaned || Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido (maior que zero).");
      return;
    }
    if (!label.trim()) {
      toast.error("Informe um nome pra parcela.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Se mudou pra paid e ainda não tem received_at, marca agora.
      const willMarkPaid = status === "paid" && !payment.received_at;
      const patch: JobPaymentUpdate = {
        kind,
        label: label.trim(),
        amount: parsed,
        due_date: dueDate || null,
        status,
        method: method || null,
        notes: notes.trim() || null,
        received_at: willMarkPaid ? new Date().toISOString() : payment.received_at,
      };

      // Se virou de paid pra outro status, limpa received_at e method (mantém histórico via updated_at).
      if (status !== "paid" && payment.status === "paid") {
        patch.received_at = null;
        patch.method = method || null;
      }

      const { error } = await supabase
        .from("job_payments")
        .update(patch)
        .eq("id", payment.id);

      if (error) {
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }

      toast.success("Parcela atualizada.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/[0.08] bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            Editar parcela
          </DialogTitle>
          <DialogDescription>
            Ajuste qualquer campo. O histórico do banco fica registrado via
            audit (updated_at).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-kind"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Tipo
            </Label>
            <select
              id="edit-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as PaymentKind)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {PAYMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-label"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Nome
            </Label>
            <Input
              id="edit-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-amount"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Valor
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-white/45">
                $
              </span>
              <Input
                id="edit-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 text-right font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-due"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Data prevista
            </Label>
            <Input
              id="edit-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-status"
                className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
              >
                Status
              </Label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="edit-method"
                className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
              >
                Método
              </Label>
              <select
                id="edit-method"
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as PaymentMethod | "")
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Sem método</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-notes"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Notas
            </Label>
            <Textarea
              id="edit-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !payment}
            className="font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
