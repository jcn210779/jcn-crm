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
import { formatCurrency } from "@/lib/format";
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
  const [saving, setSaving] = useState(false);

  // Inicializa todos como 'check' default ao abrir
  useEffect(() => {
    if (!open) return;
    const next: Record<string, Selection> = {};
    for (const e of entries) {
      next[e.member.id] = methods[e.member.id] ?? "check";
    }
    setMethods(next);
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
      const rows = entries.map((e) => ({
        expense_date: fridayDate,
        category: "payroll" as const,
        description: `Folha semana ${weekLabel} — ${e.member.name}`,
        vendor: e.member.name,
        amount: e.total,
        payment_method: methods[e.member.id] as PaymentMethod,
      }));

      const { error } = await supabase.from("business_expenses").insert(rows);
      if (error) {
        toast.error(`Erro ao lançar folha: ${error.message}`);
        return;
      }

      const checkCount = rows.filter((r) => r.payment_method === "check").length;
      const cashCount = rows.filter((r) => r.payment_method === "cash").length;

      toast.success(
        `Folha lançada: ${formatCurrency(total)} total ` +
          `(${checkCount} cheque${checkCount !== 1 ? "s" : ""}, ${cashCount} cash)`,
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
            Pagar folha
          </DialogTitle>
          <DialogDescription>
            Semana <b>{weekLabel}</b> · Pagamento na sexta {fridayDate}. Escolhe
            como cada um vai receber.
          </DialogDescription>
        </DialogHeader>

        {/* Botões pra setar todos de uma vez */}
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

        {/* Lista funcionários */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {entries.map((e) => {
            const m = methods[e.member.id] ?? "check";
            return (
              <div
                key={e.member.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
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
                      setMethods((prev) => ({ ...prev, [e.member.id]: "check" }))
                    }
                    icon={Landmark}
                    label="Cheque"
                    activeClass="border-sky-400/40 bg-sky-500/15 text-sky-300"
                  />
                  <MethodChip
                    active={m === "cash"}
                    onClick={() =>
                      setMethods((prev) => ({ ...prev, [e.member.id]: "cash" }))
                    }
                    icon={Banknote}
                    label="Cash"
                    activeClass="border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                  />
                </div>
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
