"use client";

import { Loader2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
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
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { PAYMENT_METHODS, type JobPayment, type PaymentMethod } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: JobPayment;
  onDone: () => void;
};

export function MarkReceivedDialog({
  open,
  onOpenChange,
  payment,
  onDone,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod("check");
    setReceivedAt(new Date().toISOString().slice(0, 10));
  }, [open]);

  async function handleConfirm() {
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("job_payments")
        .update({
          status: "paid",
          received_at: `${receivedAt}T12:00:00Z`,
          method,
        })
        .eq("id", payment.id);

      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }

      toast.success(`Recebido ${formatCurrency(Number(payment.amount))}`);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            Marcar como recebido
          </DialogTitle>
          <DialogDescription>
            <b>{payment.label}</b>
            <br />
            Valor:{" "}
            <span className="font-black text-emerald-300">
              {formatCurrency(Number(payment.amount))}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Data do recebimento
            </Label>
            <Input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Método
            </Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
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
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
