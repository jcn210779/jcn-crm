"use client";

import { Banknote, Landmark, Loader2, Wallet } from "lucide-react";
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
import { ReceiptInput } from "@/components/ui/receipt-input";
import { formatCurrency } from "@/lib/format";
import { uploadReceiptGeneric } from "@/lib/job-expenses";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PaymentMethod, TeamPayable } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: TeamPayable;
  memberName: string;
  onDone: () => void;
};

type Method = "check" | "cash";

export function PayPayableDialog({
  open,
  onOpenChange,
  payable,
  memberName,
  onDone,
}: Props) {
  const [method, setMethod] = useState<Method>("check");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod("check");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setReceipt(null);
  }, [open]);

  async function handleConfirm() {
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // 1) Upload do recibo (se houver)
      let receiptPath: string | null = null;
      let receiptFileName: string | null = null;
      let receiptSize: number | null = null;
      let receiptMime: string | null = null;

      if (receipt) {
        const result = await uploadReceiptGeneric({
          supabase,
          pathPrefix: `payroll/${payable.member_id}`,
          file: receipt,
        });
        if (result.error) {
          toast.error(result.error);
          setSaving(false);
          return;
        }
        receiptPath = result.path ?? null;
        receiptFileName = result.fileName ?? null;
        receiptSize = result.fileSize ?? null;
        receiptMime = result.mimeType ?? null;
      }

      // 2) Criar business_expense payroll
      const { data: beData, error: beError } = await supabase
        .from("business_expenses")
        .insert({
          expense_date: paidAt,
          category: "payroll",
          description: `${payable.description} — ${memberName}`,
          vendor: memberName,
          amount: payable.amount,
          payment_method: method as PaymentMethod,
          receipt_path: receiptPath,
          receipt_file_name: receiptFileName,
          receipt_size: receiptSize,
          receipt_mime: receiptMime,
        })
        .select("id")
        .single();

      if (beError || !beData) {
        // Rollback upload
        if (receiptPath) {
          await supabase.storage.from("job-receipts").remove([receiptPath]);
        }
        toast.error(`Erro ao lançar despesa: ${beError?.message ?? "?"}`);
        setSaving(false);
        return;
      }

      // 3) Dar baixa no payable (linka com business_expense)
      const { error: updError } = await supabase
        .from("team_payables")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_business_expense_id: beData.id,
        })
        .eq("id", payable.id);

      if (updError) {
        // Não rollback do business_expense (já tá criado) — só avisa
        toast.warning(
          `Despesa criada mas pendência não fechou: ${updError.message}`,
        );
        setSaving(false);
        return;
      }

      toast.success(
        `Pago ${formatCurrency(Number(payable.amount))} pra ${memberName}`,
      );
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
            Pagar pendência
          </DialogTitle>
          <DialogDescription>
            <b>{memberName}</b> · {payable.description}
            <br />
            Valor:{" "}
            <span className="font-black text-jcn-gold-300">
              {formatCurrency(Number(payable.amount))}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Método */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Como pagou
            </Label>
            <div className="flex gap-2">
              <MethodButton
                active={method === "check"}
                onClick={() => setMethod("check")}
                icon={Landmark}
                label="Cheque"
                activeClass="border-sky-400/40 bg-sky-500/15 text-sky-300"
              />
              <MethodButton
                active={method === "cash"}
                onClick={() => setMethod("cash")}
                icon={Banknote}
                label="Cash"
                activeClass="border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
              />
            </div>
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Data do pagamento
            </Label>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          {/* Recibo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              {method === "check" ? "Foto do cheque" : "Foto do recibo"} (opcional)
            </Label>
            <ReceiptInput
              file={receipt}
              onChange={setReceipt}
              label={
                method === "check"
                  ? "Anexar foto do cheque"
                  : "Anexar foto do recibo"
              }
              disabled={saving}
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
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Pagando
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                Confirmar pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MethodButton({
  active,
  onClick,
  icon: Icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition",
        active
          ? activeClass
          : "border-white/[0.08] bg-white/[0.025] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
