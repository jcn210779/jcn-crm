"use client";

import { Loader2, Plus } from "lucide-react";
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
import { PAYMENT_KIND_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  PAYMENT_KINDS,
  type JobPaymentInsert,
  type PaymentKind,
} from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  /** Próximo display_order (max + 1). */
  nextOrder: number;
};

/**
 * Dialog pra adicionar parcela nova no job.
 *
 * UX:
 * - Tipo (select): deposit / milestone / final / extra
 * - Label (text com default por tipo)
 * - Valor (input numérico em USD)
 * - Data prevista (date — opcional)
 * - Notas (textarea — opcional)
 * - Submit: INSERT em job_payments com status='pending' + display_order
 */
export function AddPaymentDialog({
  open,
  onOpenChange,
  jobId,
  nextOrder,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<PaymentKind>("deposit");
  const [label, setLabel] = useState<string>(defaultLabel("deposit"));
  const [amount, setAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Reseta tudo quando abre
  useEffect(() => {
    if (open) {
      setKind("deposit");
      setLabel(defaultLabel("deposit"));
      setAmount("");
      setDueDate("");
      setNotes("");
      setSaving(false);
    }
  }, [open]);

  function handleKindChange(next: PaymentKind) {
    setKind(next);
    setLabel(defaultLabel(next));
  }

  async function handleSave() {
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
      const payload: JobPaymentInsert = {
        job_id: jobId,
        kind,
        label: label.trim(),
        amount: parsed,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        display_order: nextOrder,
        status: "pending",
      };

      const { error } = await supabase.from("job_payments").insert(payload);

      if (error) {
        toast.error(`Erro ao salvar parcela: ${error.message}`);
        return;
      }

      toast.success("Parcela adicionada.");
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
            Nova parcela
          </DialogTitle>
          <DialogDescription>
            Adicione uma parcela do contrato. Você marca como paga depois,
            quando o cliente quitar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="payment-kind"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Tipo
            </Label>
            <select
              id="payment-kind"
              value={kind}
              onChange={(e) => handleKindChange(e.target.value as PaymentKind)}
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
              htmlFor="payment-label"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Nome
            </Label>
            <Input
              id="payment-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Entrada, Parcela 1, Pagamento final"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="payment-amount"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Valor
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-white/45">
                $
              </span>
              <Input
                id="payment-amount"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 text-right font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="payment-due"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Data prevista (opcional)
            </Label>
            <Input
              id="payment-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="payment-notes"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Notas (opcional)
            </Label>
            <Textarea
              id="payment-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes, lembrete, qualquer observação."
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
            disabled={saving}
            className="font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Adicionar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultLabel(kind: PaymentKind): string {
  switch (kind) {
    case "deposit":
      return "Entrada";
    case "milestone":
      return "Parcela";
    case "final":
      return "Pagamento final";
    case "extra":
      return "Extra";
  }
}
