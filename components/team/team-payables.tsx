"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, HardHat, Plus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AddPayableDialog } from "@/components/team/add-payable-dialog";
import { PayPayableDialog } from "@/components/team/pay-payable-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { TeamMember, TeamPayable } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PayableRow = TeamPayable & {
  member?: Pick<TeamMember, "id" | "name" | "hourly_rate"> | null;
};

type Props = {
  members: TeamMember[];
  payables: PayableRow[];
};

export function TeamPayables({ members, payables }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PayableRow | null>(null);

  // Só pendentes (paid vai pro histórico de business_expenses)
  const pending = useMemo(
    () => payables.filter((p) => p.status === "pending"),
    [payables],
  );

  const totalPending = pending.reduce((s, p) => s + Number(p.amount), 0);

  // Agrupar por funcionário
  const byMember = useMemo(() => {
    const map = new Map<
      string,
      { member: TeamMember | undefined; items: PayableRow[]; total: number }
    >();
    for (const p of pending) {
      const m = members.find((mm) => mm.id === p.member_id);
      const cur = map.get(p.member_id);
      if (cur) {
        cur.items.push(p);
        cur.total += Number(p.amount);
      } else {
        map.set(p.member_id, {
          member: m,
          items: [p],
          total: Number(p.amount),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pending, members]);

  const activeMembers = members.filter((m) => m.active);

  return (
    <div className="space-y-5">
      {/* Header com total */}
      <div
        className={cn(
          "rounded-3xl border p-5 backdrop-blur-xl",
          totalPending > 0
            ? "border-amber-400/30 bg-amber-500/[0.08]"
            : "border-emerald-400/30 bg-emerald-500/[0.06]",
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl",
                totalPending > 0
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-emerald-500/15 text-emerald-300",
              )}
            >
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
                A pagar pra funcionários
              </div>
              <div
                className={cn(
                  "text-2xl font-black tracking-tight md:text-3xl",
                  totalPending > 0 ? "text-amber-300" : "text-emerald-300",
                )}
              >
                {formatCurrency(totalPending)}
              </div>
              <div className="mt-0.5 text-xs text-jcn-ice/55">
                {pending.length === 0
                  ? "Tudo em dia ✓"
                  : `${pending.length} ${pending.length === 1 ? "pendência" : "pendências"} em ${byMember.length} ${byMember.length === 1 ? "funcionário" : "funcionários"}`}
              </div>
            </div>
          </div>
          <Button onClick={() => setAddOpen(true)} className="h-10 font-semibold">
            <Plus className="h-4 w-4" />
            Adicionar pendência
          </Button>
        </div>
      </div>

      {/* Lista agrupada */}
      {byMember.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            Nenhuma pendência aberta
          </p>
          <p className="mt-1 text-xs text-jcn-ice/40">
            Quando você deixar uma semana na casa de algum funcionário, registra aqui.
          </p>
          <Button
            onClick={() => setAddOpen(true)}
            variant="outline"
            className="mt-5"
          >
            <Plus className="h-4 w-4" />
            Adicionar primeira
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {byMember.map((g) => (
            <section
              key={g.member?.id ?? "unknown"}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur-xl"
            >
              <header className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300">
                    <HardHat className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-jcn-ice">
                      {g.member?.name ?? "Funcionário"}
                    </div>
                    <div className="text-[10px] text-jcn-ice/55">
                      {g.items.length}{" "}
                      {g.items.length === 1 ? "pendência" : "pendências"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-amber-300">
                    {formatCurrency(g.total)}
                  </div>
                </div>
              </header>

              <div className="space-y-2">
                {g.items
                  .sort((a, b) =>
                    (a.due_date ?? a.created_at).localeCompare(
                      b.due_date ?? b.created_at,
                    ),
                  )
                  .map((p) => (
                    <PayableRowCard
                      key={p.id}
                      payable={p}
                      onPay={() => setPayTarget(p)}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddPayableDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        members={activeMembers}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />
      {payTarget && (
        <PayPayableDialog
          open={!!payTarget}
          onOpenChange={(o) => {
            if (!o) setPayTarget(null);
          }}
          payable={payTarget}
          memberName={
            members.find((m) => m.id === payTarget.member_id)?.name ?? ""
          }
          onDone={() => {
            setPayTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PayableRowCard({
  payable,
  onPay,
}: {
  payable: PayableRow;
  onPay: () => void;
}) {
  const due = payable.due_date ? new Date(payable.due_date) : null;
  const isLate = due && due < new Date();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-jcn-ice">
            {payable.description}
          </span>
          {due && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                isLate
                  ? "border-rose-400/40 bg-rose-500/15 text-rose-300"
                  : "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
              )}
            >
              <Calendar className="mr-1 h-3 w-3" />
              {isLate ? "Atrasado " : "Vence "}
              {format(due, "d MMM", { locale: ptBR })}
            </Badge>
          )}
        </div>
        {payable.notes && (
          <p className="mt-1 text-[11px] text-jcn-ice/45">{payable.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-base font-black text-amber-300">
          {formatCurrency(Number(payable.amount))}
        </div>
        <Button
          size="sm"
          onClick={onPay}
          className="h-8 border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          variant="outline"
        >
          <Wallet className="h-3.5 w-3.5" />
          Pagar
        </Button>
      </div>
    </div>
  );
}
