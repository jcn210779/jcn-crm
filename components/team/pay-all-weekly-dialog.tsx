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
import { ReceiptInput } from "@/components/ui/receipt-input";
import { formatCurrency } from "@/lib/format";
import { uploadReceiptGeneric } from "@/lib/job-expenses";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PaymentMethod, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PayoutEntry = {
  member: TeamMember;
  total: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekLabel: string;
  fridayDate: string; // YYYY-MM-DD
  entries: PayoutEntry[];
  onDone: () => void;
};

type Selection = "check" | "cash";

export function PayAllWeeklyDialog({
  open,
  onOpenChange,
  weekLabel,
  fridayDate,
  entries,
  onDone,
}: Props) {
  const [methods, setMethods] = useState<Record<string, Selection>>({});
  const [checkNumbers, setCheckNumbers] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState(false);

  // Inicializa todos como 'check' default ao abrir
  useEffect(() => {
    if (!open) return;
    const next: Record<string, Selection> = {};
    const nextC: Record<string, string> = {};
    const nextR: Record<string, File | null> = {};
    for (const e of entries) {
      next[e.member.id] = methods[e.member.id] ?? "check";
      nextC[e.member.id] = "";
      nextR[e.member.id] = null;
    }
    setMethods(next);
    setCheckNumbers(nextC);
    setReceipts(nextR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entries]);

  const total = entries.reduce((s, e) => s + e.total, 0);

  function setAll(method: Selection) {
    const next: Record<string, Selection> = {};
    for (const e of entries) next[e.member.id] = method;
    setMethods(next);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // 1) Upload de recibos por funcionário (em paralelo)
      const uploadedPaths: string[] = []; // pra rollback
      const receiptByMember: Record<
        string,
        {
          path: string | null;
          name: string | null;
          size: number | null;
          mime: string | null;
        }
      > = {};

      for (const e of entries) {
        const file = receipts[e.member.id];
        if (!file) {
          receiptByMember[e.member.id] = {
            path: null,
            name: null,
            size: null,
            mime: null,
          };
          continue;
        }
        const result = await uploadReceiptGeneric({
          supabase,
          pathPrefix: `payroll/${e.member.id}`,
          file,
        });
        if (result.error) {
          // Rollback dos uploads já feitos
          if (uploadedPaths.length > 0) {
            await supabase.storage.from("job-receipts").remove(uploadedPaths);
          }
          toast.error(`Erro upload (${e.member.name}): ${result.error}`);
          setSaving(false);
          return;
        }
        if (result.path) uploadedPaths.push(result.path);
        receiptByMember[e.member.id] = {
          path: result.path ?? null,
          name: result.fileName ?? null,
          size: result.fileSize ?? null,
          mime: result.mimeType ?? null,
        };
      }

      // 2) INSERT business_expenses (1 por funcionário)
      const rows = entries.map((e) => {
        const r = receiptByMember[e.member.id] ?? {
          path: null,
          name: null,
          size: null,
          mime: null,
        };
        const pm = methods[e.member.id] as PaymentMethod;
        const cn = (checkNumbers[e.member.id] ?? "").trim();
        return {
          expense_date: fridayDate,
          category: "payroll" as const,
          description: `Folha semana ${weekLabel} — ${e.member.name}`,
          vendor: e.member.name,
          amount: e.total,
          payment_method: pm,
          check_number: pm === "check" && cn.length > 0 ? cn : null,
          receipt_path: r.path,
          receipt_file_name: r.name,
          receipt_size: r.size,
          receipt_mime: r.mime,
        };
      });

      const { data: beData, error } = await supabase
        .from("business_expenses")
        .insert(rows)
        .select("id");
      if (error || !beData) {
        // Rollback dos uploads
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("job-receipts").remove(uploadedPaths);
        }
        toast.error(`Erro ao lançar folha: ${error?.message ?? "?"}`);
        return;
      }

      // 3) Marcar job_hours como pagos (paid_at + link com business_expense)
      //    Calcula segunda e domingo da semana a partir de fridayDate.
      const friday = new Date(fridayDate + "T00:00:00Z");
      const monday = new Date(friday);
      monday.setUTCDate(friday.getUTCDate() - 4);
      const sunday = new Date(friday);
      sunday.setUTCDate(friday.getUTCDate() + 2);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmtDate = (d: Date) =>
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      const mondayKey = fmtDate(monday);
      const sundayKey = fmtDate(sunday);

      const updateErrors: string[] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const beId = beData[i]?.id;
        if (!e || !beId) continue;
        const { error: hoursErr } = await supabase
          .from("job_hours")
          .update({
            paid_at: new Date().toISOString(),
            payment_business_expense_id: beId,
          })
          .eq("member_id", e.member.id)
          .gte("work_date", mondayKey)
          .lte("work_date", sundayKey)
          .is("paid_at", null);
        if (hoursErr) {
          updateErrors.push(`${e.member.name}: ${hoursErr.message}`);
        }
      }
      if (updateErrors.length > 0) {
        // Despesa criada com sucesso — só avisa que hours não fecharam
        toast.warning(
          `Despesa lançada mas algumas horas não fecharam: ${updateErrors.join("; ")}`,
        );
      }

      const checkCount = rows.filter((r) => r.payment_method === "check").length;
      const cashCount = rows.filter((r) => r.payment_method === "cash").length;
      const withReceiptCount = rows.filter((r) => r.receipt_path).length;

      toast.success(
        `Folha lançada: ${formatCurrency(total)} ` +
          `(${checkCount} cheque${checkCount !== 1 ? "s" : ""}, ${cashCount} cash` +
          (withReceiptCount > 0
            ? `, ${withReceiptCount} com recibo`
            : "") +
          `)`,
      );
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            {entries.length === 1
              ? `Pagar ${entries[0]?.member.name ?? ""}`
              : "Pagar folha"}
          </DialogTitle>
          <DialogDescription>
            Semana <b>{weekLabel}</b> · Pagamento na sexta {fridayDate}.{" "}
            {entries.length === 1
              ? "Escolhe como esse funcionário vai receber."
              : "Escolhe como cada um vai receber."}
          </DialogDescription>
        </DialogHeader>

        {/* Botões pra setar todos de uma vez (só faz sentido se 2+) */}
        {entries.length > 1 && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
            Todos:
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAll("check")}
            className="h-7 text-xs"
          >
            <Landmark className="h-3 w-3" />
            Cheque
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAll("cash")}
            className="h-7 text-xs"
          >
            <Banknote className="h-3 w-3" />
            Cash
          </Button>
        </div>
        )}

        {/* Lista funcionários */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {entries.map((e) => {
            const m = methods[e.member.id] ?? "check";
            const file = receipts[e.member.id] ?? null;
            return (
              <div
                key={e.member.id}
                className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-jcn-ice truncate">
                      {e.member.name}
                    </div>
                    <div className="text-xs font-black text-jcn-gold-300">
                      {formatCurrency(e.total)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MethodChip
                      active={m === "check"}
                      onClick={() =>
                        setMethods((prev) => ({
                          ...prev,
                          [e.member.id]: "check",
                        }))
                      }
                      icon={Landmark}
                      label="Cheque"
                      activeClass="border-sky-400/40 bg-sky-500/15 text-sky-300"
                    />
                    <MethodChip
                      active={m === "cash"}
                      onClick={() =>
                        setMethods((prev) => ({
                          ...prev,
                          [e.member.id]: "cash",
                        }))
                      }
                      icon={Banknote}
                      label="Cash"
                      activeClass="border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                    />
                  </div>
                </div>
                {m === "check" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                      Nº cheque (recomendado)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={checkNumbers[e.member.id] ?? ""}
                      onChange={(ev) =>
                        setCheckNumbers((prev) => ({
                          ...prev,
                          [e.member.id]: ev.target.value,
                        }))
                      }
                      placeholder="Ex: 1183"
                      maxLength={20}
                      className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 text-xs text-jcn-ice placeholder:text-white/30 focus:border-sky-400/40 focus:outline-none"
                      disabled={saving}
                    />
                  </div>
                )}
                <ReceiptInput
                  file={file}
                  onChange={(f) =>
                    setReceipts((prev) => ({ ...prev, [e.member.id]: f }))
                  }
                  label={
                    m === "check" ? "Foto do cheque" : "Foto do recibo (opcional)"
                  }
                  compact
                  disabled={saving}
                />
              </div>
            );
          })}
        </div>

        {/* Resumo total */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-jcn-gold-400/30 bg-jcn-gold-500/[0.08] p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-jcn-gold-300">
            <Wallet className="h-3.5 w-3.5" />
            Total da folha
          </div>
          <div className="text-lg font-black text-jcn-gold-300">
            {formatCurrency(total)}
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
                Lançando
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

function MethodChip({
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
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition",
        active
          ? activeClass
          : "border-white/[0.08] bg-white/[0.025] text-jcn-ice/45 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
