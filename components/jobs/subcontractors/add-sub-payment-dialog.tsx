"use client";

/**
 * Registra invoice de sub. Fluxo novo (mig 0064):
 * - Default OFF no toggle "Já paguei?": cria parcela com paid_at=NULL + invoice
 *   anexado. Aparece como pendente na Central.
 * - Toggle ON: cria parcela paga (fluxo antigo) + business_expense.
 */

import { FileText, Loader2, Save, Upload, X } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "check", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "wire_transfer", label: "Transferência" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "other", label: "Outro" },
];

const MAX_INVOICE_MB = 15;
const ACCEPT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type Props = {
  jobSubId: string;
  jobIsFlip: boolean;
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
  jobIsFlip,
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
  const [alreadyPaidNow, setAlreadyPaidNow] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [checkNumber, setCheckNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAmount(remaining > 0 ? String(remaining) : "");
      setAlreadyPaidNow(false);
      setPaidAt(today);
      setMethod("check");
      setCheckNumber("");
      setNotes("");
      setInvoiceFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPT_MIME.includes(f.type)) {
      toast.error("Formato inválido", {
        description: "Aceita PDF, JPG, PNG ou WebP",
      });
      return;
    }
    if (f.size > MAX_INVOICE_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_INVOICE_MB}MB`);
      return;
    }
    setInvoiceFile(f);
  }

  async function handleSave() {
    const num = Number(amount);
    if (Number.isNaN(num) || num <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (alreadyPaidNow && !paidAt) {
      toast.error("Data do pagamento obrigatória");
      return;
    }
    if (!alreadyPaidNow && !invoiceFile) {
      toast.error("Anexe o invoice do sub (PDF/foto)");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Upload do invoice (se tem)
    let invoicePath: string | null = null;
    let invoiceMime: string | null = null;
    let invoiceFileName: string | null = null;
    if (invoiceFile) {
      const ext = invoiceFile.name.split(".").pop() || "pdf";
      const path = `sub-invoices/${jobSubId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("job-extras")
        .upload(path, invoiceFile, { contentType: invoiceFile.type });
      if (upErr) {
        setSaving(false);
        toast.error("Erro no upload do invoice", { description: upErr.message });
        return;
      }
      invoicePath = path;
      invoiceMime = invoiceFile.type;
      invoiceFileName = invoiceFile.name;
    }

    // 2) Se já pago, cria business_expense (vai pro /finance com data certa)
    let businessExpenseId: string | null = null;
    if (alreadyPaidNow) {
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
          is_flip: jobIsFlip,
        })
        .select("id")
        .single();

      if (beError) {
        setSaving(false);
        toast.error("Erro ao lançar no /finance", { description: beError.message });
        return;
      }
      businessExpenseId = beData?.id ?? null;
    }

    // 3) Cria a parcela (paid_at=NULL se pendente)
    const { error: pmtError } = await supabase
      .from("job_sub_payments")
      .insert({
        job_subcontractor_id: jobSubId,
        amount: num,
        paid_at: alreadyPaidNow ? paidAt : null,
        method: alreadyPaidNow ? method : null,
        check_number:
          alreadyPaidNow && method === "check"
            ? checkNumber.trim() || null
            : null,
        notes: notes.trim() || null,
        business_expense_id: businessExpenseId,
        invoice_path: invoicePath,
        invoice_file_name: invoiceFileName,
        invoice_mime: invoiceMime,
        invoice_uploaded_at: invoicePath ? new Date().toISOString() : null,
      });

    setSaving(false);

    if (pmtError) {
      // Rollback BE + invoice pra não deixar órfão
      if (businessExpenseId) {
        await supabase.from("business_expenses").delete().eq("id", businessExpenseId);
      }
      if (invoicePath) {
        await supabase.storage.from("job-extras").remove([invoicePath]);
      }
      toast.error("Erro ao registrar", {
        description: pmtError.message,
      });
      return;
    }

    if (alreadyPaidNow) {
      toast.success(
        `${formatCurrency(num)} registrado como pago · lançado em /finance`,
      );
    } else {
      toast.success(
        `Invoice de ${formatCurrency(num)} recebido · aguardando pagamento`,
      );
    }
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar invoice do sub</DialogTitle>
          <DialogDescription>
            <strong>{subName}</strong> · combinado{" "}
            {formatCurrency(agreedValue)} · já pago{" "}
            {formatCurrency(alreadyPaid)} · saldo{" "}
            <strong>{formatCurrency(remaining)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Status do invoice: 2 botoes lado a lado (mais claro que toggle) */}
          <div>
            <Label className="mb-1.5 block">Status do invoice</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAlreadyPaidNow(false)}
                disabled={saving}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition",
                  !alreadyPaidNow
                    ? "border-amber-400/50 bg-amber-500/15 text-amber-100 ring-2 ring-amber-400/30"
                    : "border-white/[0.1] bg-white/[0.03] text-jcn-ice/60 hover:bg-white/[0.05]",
                )}
              >
                <span className="text-lg">📄</span>
                <span className="font-black uppercase tracking-wider text-[11px]">
                  Não pago
                </span>
                <span className="text-[9px] opacity-70">
                  invoice recebido
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAlreadyPaidNow(true)}
                disabled={saving}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition",
                  alreadyPaidNow
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 ring-2 ring-emerald-400/30"
                    : "border-white/[0.1] bg-white/[0.03] text-jcn-ice/60 hover:bg-white/[0.05]",
                )}
              >
                <span className="text-lg">✓</span>
                <span className="font-black uppercase tracking-wider text-[11px]">
                  Pago
                </span>
                <span className="text-[9px] opacity-70">
                  já quitei
                </span>
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="sub-pmt-amount">Valor do invoice ($)</Label>
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

          {/* Upload invoice — obrigatorio quando NAO pago (default), opcional quando pago */}
          <div>
            <Label>
              Anexar invoice do sub
              {!alreadyPaidNow && <span className="text-rose-300"> *</span>}
              {alreadyPaidNow && (
                <span className="text-[10px] text-jcn-ice/45"> (opcional)</span>
              )}
            </Label>
            {invoiceFile ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-300" />
                  <span className="font-semibold text-emerald-100">
                    {invoiceFile.name}
                  </span>
                  <span className="text-jcn-ice/50">
                    ({(invoiceFile.size / 1024 / 1024).toFixed(1)}MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceFile(null)}
                  className="rounded p-1 hover:bg-white/[0.06]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={saving}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] py-3 text-xs text-jcn-ice/60 hover:bg-white/[0.04] hover:text-jcn-gold-300"
              >
                <Upload className="h-3.5 w-3.5" />
                Escolher PDF ou foto do invoice
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_MIME.join(",")}
              onChange={handleFilePick}
              className="hidden"
            />
          </div>

          {/* Se já pago, campos de pagamento */}
          {alreadyPaidNow && (
            <>
              <div className="grid grid-cols-2 gap-3">
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
            </>
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
            {alreadyPaidNow ? "Registrar pagamento" : "Salvar invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
