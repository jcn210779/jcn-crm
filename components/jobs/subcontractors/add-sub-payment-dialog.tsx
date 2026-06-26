"use client";

import { Loader2, Save } from "lucide-react";
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
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PaymentMethod } from "@/lib/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "check", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "wire_transfer", label: "Transferência" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "other", label: "Outro" },
];

type Props = {
  jobSubId: string;
  subName: string;
  serviceDescription: string;
  agreedValue: number;
  alreadyPaid: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

export function AddSubPaymentDialog({
  jobSubId,
  subName,
  serviceDescription,
  agreedValue,
  alreadyPaid,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const remaining = Math.max(0, agreedValue - alreadyPaid);
  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [checkNumber, setCheckNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(remaining > 0 ? String(remaining) : "");
      setPaidAt(today);
      setMethod("check");
      setCheckNumber("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSave() {
    const num = Number(amount);
    if (Number.isNaN(num) || num <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (!paidAt) {
      toast.error("Data obrigatória");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Cria business_expense pra essa parcela (lança no /finance com a data certa)
    const expenseDescription = `Pagamento sub: ${serviceDescription} — ${subName}`;
    const { data: beData, error: beError } = await supabase
      .from("business_expenses")
      .insert({
        expense_date: paidAt,
        category: "other",
        vendor: subName,
        description: expenseDescription,
        amount: num,
        payment_method: method,
        check_number: method === "check" ? checkNumber.trim() || null : null,
      })
      .select("id")
      .single();

    if (beError) {
      setSaving(false);
      toast.error("Erro ao lançar no /finance", { description: beError.message });
      return;
    }

    // 2) Cria parcela linkada ao BE (trigger atualiza job_subcontractors.amount_paid/paid_at)
    const { error: pmtError } = await supabase
      .from("job_sub_payments")
      .insert({
        job_subcontractor_id: jobSubId,
        amount: num,
        paid_at: paidAt,
        method,
        check_number: method === "check" ? checkNumber.trim() || null : null,
        notes: notes.trim() || null,
        business_expense_id: beData?.id ?? null,
      });

    setSaving(false);

    if (pmtError) {
      // Rollback do BE pra não deixar despesa órfã
      if (beData?.id) {
        await supabase.from("business_expenses").delete().eq("id", beData.id);
      }
      toast.error("Erro ao registrar parcela", {
        description: pmtError.message,
      });
      return;
    }

    toast.success(
      `${formatCurrency(num)} registrado · lançado em /finance em ${paidAt}`,
    );
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento ao sub</DialogTitle>
          <DialogDescription>
            <strong>{subName}</strong> · combinado{" "}
            {formatCurrency(agreedValue)} · já pago{" "}
            {formatCurrency(alreadyPaid)} · saldo{" "}
            <strong>{formatCurrency(remaining)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sub-pmt-amount">Valor ($)</Label>
              <Input
                id="sub-pmt-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={saving}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="sub-pmt-date">Data do pagamento</Label>
              <Input
                id="sub-pmt-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="sub-pmt-method">Método</Label>
            <select
              id="sub-pmt-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              disabled={saving}
              className="flex h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-jcn-ice"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {method === "check" && (
            <div>
              <Label htmlFor="sub-pmt-check">Nº do cheque</Label>
              <Input
                id="sub-pmt-check"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                disabled={saving}
                placeholder="ex: 1234"
              />
            </div>
          )}

          <div>
            <Label htmlFor="sub-pmt-notes">Notas (opcional)</Label>
            <Input
              id="sub-pmt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              placeholder="ex: parcela 1 de 3, fim da fundação..."
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Registrar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
