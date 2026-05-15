"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  PAYMENT_METHODS,
  type JobPayment,
  type JobPaymentUpdate,
  type PaymentMethod,
} from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: JobPayment | null;
};

/**
 * Dialog pra marcar uma parcela como paga.
 *
 * UX:
 * - Data recebida (datetime-local, default = agora)
 * - Método (select obrigatório)
 * - Notas adicionais (opcional, anexa às existentes)
 * - Submit: UPDATE status='paid' + received_at + method + notes
 */
export function MarkPaymentPaidDialog({ open, onOpenChange, payment }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [receivedAt, setReceivedAt] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [extraNote, setExtraNote] = useState<string>("");

  useEffect(() => {
    if (open) {
      setReceivedAt(localDatetimeNow());
      setMethod((payment?.method as PaymentMethod) ?? "check");
      setExtraNote("");
      setSaving(false);
    }
  }, [open, payment]);

  async function handleSave() {
    if (!payment) return;

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const receivedISO = receivedAt
        ? new Date(receivedAt).toISOString()
        : new Date().toISOString();

      const mergedNotes = (() => {
        const existing = (payment.notes ?? "").trim();
        const extra = extraNote.trim();
        if (!extra) return existing || null;
        if (!existing) return extra;
        return `${existing}\n\n${extra}`;
      })();

      const patch: JobPaymentUpdate = {
        status: "paid",
        received_at: receivedISO,
        method,
        notes: mergedNotes,
      };

      const { error } = await supabase
        .from("job_payments")
        .update(patch)
        .eq("id", payment.id);

      if (error) {
        toast.error(`Erro ao marcar como paga: ${error.message}`);
        return;
      }

      toast.success(`${payment.label} marcada como paga.`);
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
            Marcar como paga
          </DialogTitle>
          <DialogDescription>
            {payment ? (
              <>
                <span className="font-bold text-white">{payment.label}</span>{" "}
                <span className="text-primary">
                  · {formatCurrency(payment.amount)}
                </span>
              </>
            ) : (
              "Selecione uma parcela."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="paid-received"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Data recebida
            </Label>
            <Input
              id="paid-received"
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="paid-method"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Método
            </Label>
            <select
              id="paid-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="paid-note"
              className="text-xs font-bold uppercase tracking-[0.12em] text-white/55"
            >
              Nota adicional (opcional)
            </Label>
            <Textarea
              id="paid-note"
              rows={3}
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Número do cheque, referência, observação."
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
                <CheckCircle2 className="h-4 w-4" />
                Confirmar pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Retorna timestamp atual no formato esperado pelo input datetime-local
 * (YYYY-MM-DDTHH:mm, sem timezone).
 */
function localDatetimeNow(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
