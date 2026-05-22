"use client";

import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  HardHat,
  Hammer,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type {
  Job,
  JobExpense,
  JobExtra,
  JobPayment,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import type { JobHoursWithMember } from "@/lib/job-hours";
import type { JobSubcontractorWithSub } from "@/lib/job-subs";

type Props = {
  job: Job;
  payments: JobPayment[];
  expenses: JobExpense[];
  hours: JobHoursWithMember[];
  extras: JobExtra[];
  jobSubs: JobSubcontractorWithSub[];
};

export function JobPnlSection({
  job,
  payments,
  expenses,
  hours,
  extras,
  jobSubs,
}: Props) {
  const isCompleted = job.current_phase === "completed";

  const pnl = useMemo(() => {
    // RECEITA
    const contract = Number(job.value);
    const approvedExtras = extras
      .filter((e) => e.status === "approved" || e.status === "completed")
      .reduce((s, e) => s + Number(e.additional_value), 0);
    const totalContract = contract + approvedExtras;

    const received = payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.amount), 0);
    const pendingReceivable = payments
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + Number(p.amount), 0);

    // CUSTOS
    // Materiais não-cartão (que saíram do caixa)
    const materialsCash = expenses
      .filter((e) => e.payment_method !== "credit_card")
      .reduce((s, e) => s + Number(e.amount), 0);
    const materialsCard = expenses
      .filter((e) => e.payment_method === "credit_card")
      .reduce((s, e) => s + Number(e.amount), 0);
    const totalMaterials = materialsCash + materialsCard;

    // Horas (custo de mão de obra)
    const totalLabor = hours.reduce(
      (s, h) => s + Number(h.calculated_amount),
      0,
    );

    // Subs in_progress + completed (compromisso assumido)
    const subsCommitted = jobSubs
      .filter((s) => s.status === "in_progress" || s.status === "completed")
      .reduce((s, sub) => s + Number(sub.agreed_value), 0);
    const subsPaid = jobSubs
      .filter((s) => s.status === "completed")
      .reduce((s, sub) => s + Number(sub.agreed_value), 0);

    const totalCosts = totalMaterials + totalLabor + subsCommitted;

    // MARGEM
    const grossProfit = totalContract - totalCosts;
    const grossMarginPct =
      totalContract > 0 ? (grossProfit / totalContract) * 100 : null;

    // PRA OBRA ATIVA: projeção realizada
    const cashIn = received;
    const cashOut = materialsCash + totalLabor + subsPaid; // o que JÁ saiu do caixa
    const cashFlow = cashIn - cashOut;

    return {
      contract,
      approvedExtras,
      totalContract,
      received,
      pendingReceivable,
      materialsCash,
      materialsCard,
      totalMaterials,
      totalLabor,
      subsCommitted,
      subsPaid,
      totalCosts,
      grossProfit,
      grossMarginPct,
      cashIn,
      cashOut,
      cashFlow,
    };
  }, [job, payments, expenses, hours, extras, jobSubs]);

  const marginGoal = 35; // alvo padrão (%)
  const marginStatus =
    pnl.grossMarginPct === null
      ? "neutral"
      : pnl.grossMarginPct >= marginGoal
        ? "good"
        : pnl.grossMarginPct >= 20
          ? "warn"
          : "bad";

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-xl md:p-6">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <PiggyBank className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-jcn-ice md:text-xl">
              P&amp;L do job
            </h2>
            <p className="text-[11px] text-jcn-ice/55">
              {isCompleted
                ? "Margem REAL desta obra concluída."
                : "Projeção atual baseada nos lançamentos. Atualiza em tempo real."}
            </p>
          </div>
        </div>
        {isCompleted && (
          <Badge
            variant="outline"
            className="border-emerald-400/40 bg-emerald-500/15 text-[10px] font-bold text-emerald-300"
          >
            ✓ FINAL
          </Badge>
        )}
      </header>

      {/* KPIs grandes */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BigKpi
          icon={Briefcase}
          label="Contrato + Extras"
          value={formatCurrency(pnl.totalContract)}
          sub={
            pnl.approvedExtras > 0
              ? `${formatCurrency(pnl.contract)} + ${formatCurrency(pnl.approvedExtras)} extras`
              : "Sem extras aprovados"
          }
          accent="gold"
        />
        <BigKpi
          icon={TrendingDown}
          label="Custos totais"
          value={formatCurrency(pnl.totalCosts)}
          sub={`${pnl.totalContract > 0 ? Math.round((pnl.totalCosts / pnl.totalContract) * 100) : 0}% do contrato`}
          accent="rose"
        />
        <BigKpi
          icon={Wallet}
          label={isCompleted ? "Lucro final" : "Lucro projetado"}
          value={formatCurrency(pnl.grossProfit)}
          sub={
            pnl.grossMarginPct !== null
              ? `${pnl.grossMarginPct.toFixed(1)}% de margem`
              : "—"
          }
          accent={
            marginStatus === "good"
              ? "green"
              : marginStatus === "warn"
                ? "amber"
                : marginStatus === "bad"
                  ? "rose"
                  : "neutral"
          }
        />
      </div>

      {/* Alerta margem */}
      {pnl.grossMarginPct !== null && marginStatus !== "good" && (
        <div
          className={cn(
            "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
            marginStatus === "warn"
              ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
              : "border-rose-400/30 bg-rose-500/10 text-rose-300",
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {marginStatus === "warn"
              ? `Margem abaixo do alvo (${marginGoal}%). Ainda dá pra recuperar.`
              : `Margem crítica abaixo de 20%. Revisar custos ou ajustar escopo.`}
          </span>
        </div>
      )}

      {/* Breakdown detalhado */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Receita */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
            💰 Receita
          </h3>
          <BreakdownRow
            icon={Briefcase}
            label="Contrato base"
            value={pnl.contract}
            color="text-jcn-ice"
          />
          {pnl.approvedExtras > 0 && (
            <BreakdownRow
              icon={Plus}
              label="Extras aprovados"
              value={pnl.approvedExtras}
              color="text-jcn-gold-300"
            />
          )}
          <div className="my-2 border-t border-white/[0.06]" />
          <BreakdownRow
            icon={CheckCircle2}
            label="Já recebido"
            value={pnl.received}
            color="text-emerald-300"
          />
          {pnl.pendingReceivable > 0 && (
            <BreakdownRow
              icon={Wallet}
              label="A receber"
              value={pnl.pendingReceivable}
              color="text-amber-300"
            />
          )}
          <div className="my-2 border-t border-white/[0.06]" />
          <div className="flex items-center justify-between text-sm font-black">
            <span className="text-jcn-ice/85">Total contratado</span>
            <span className="text-jcn-gold-300">
              {formatCurrency(pnl.totalContract)}
            </span>
          </div>
        </div>

        {/* Custos */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
            💸 Custos
          </h3>
          {pnl.materialsCash > 0 && (
            <BreakdownRow
              icon={Hammer}
              label="Materiais (caixa)"
              value={pnl.materialsCash}
              color="text-rose-300"
            />
          )}
          {pnl.materialsCard > 0 && (
            <BreakdownRow
              icon={Hammer}
              label="Materiais (cartão)"
              value={pnl.materialsCard}
              color="text-amber-300"
              hint="Sai do caixa só quando paga fatura"
            />
          )}
          {pnl.totalLabor > 0 && (
            <BreakdownRow
              icon={HardHat}
              label="Mão de obra (horas)"
              value={pnl.totalLabor}
              color="text-rose-300"
            />
          )}
          {pnl.subsCommitted > 0 && (
            <BreakdownRow
              icon={Wrench}
              label="Subempreiteiros"
              value={pnl.subsCommitted}
              color="text-rose-300"
              hint={
                pnl.subsPaid < pnl.subsCommitted
                  ? `${formatCurrency(pnl.subsPaid)} pago, ${formatCurrency(pnl.subsCommitted - pnl.subsPaid)} pendente`
                  : "Todos completed"
              }
            />
          )}
          {pnl.totalCosts === 0 && (
            <p className="text-xs text-jcn-ice/45">
              Nenhum custo lançado ainda
            </p>
          )}
          <div className="my-2 border-t border-white/[0.06]" />
          <div className="flex items-center justify-between text-sm font-black">
            <span className="text-jcn-ice/85">Total custos</span>
            <span className="text-rose-300">
              {formatCurrency(pnl.totalCosts)}
            </span>
          </div>
        </div>
      </div>

      {/* Fluxo de caixa do job (somente em obra ativa) */}
      {!isCompleted && (
        <div className="mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
            <TrendingUp className="h-3 w-3" />
            Fluxo de caixa do job (até agora)
          </h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[10px] text-jcn-ice/45">Entrou</div>
              <div className="font-black text-emerald-300">
                {formatCurrency(pnl.cashIn)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-jcn-ice/45">Saiu (caixa)</div>
              <div className="font-black text-rose-300">
                {formatCurrency(pnl.cashOut)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-jcn-ice/45">
                Net (caixa real)
              </div>
              <div
                className={cn(
                  "font-black",
                  pnl.cashFlow >= 0 ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {formatCurrency(pnl.cashFlow)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-jcn-ice/45">
            Caixa real = recebido − (materiais não-cartão + horas + subs
            completed). Cartão de crédito e subs in_progress não contam aqui.
          </p>
        </div>
      )}
    </section>
  );
}

function BigKpi({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: "gold" | "green" | "amber" | "rose" | "neutral";
}) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    neutral: "border-white/[0.08] bg-white/[0.04] text-jcn-ice",
  }[accent];

  return (
    <div className={cn("rounded-2xl border p-4 backdrop-blur-xl", accentClass)}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight md:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-jcn-ice/55">{sub}</div>
    </div>
  );
}

function BreakdownRow({
  icon: Icon,
  label,
  value,
  color,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <div className="min-w-0">
          <div className="truncate text-jcn-ice/85">{label}</div>
          {hint && (
            <div className="text-[10px] text-jcn-ice/45">{hint}</div>
          )}
        </div>
      </div>
      <span className={cn("font-bold", color)}>{formatCurrency(value)}</span>
    </div>
  );
}
