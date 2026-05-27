"use client";

import {
  Briefcase,
  CheckCheck,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

import { formatUSD } from "@/lib/finance";
import type { FinanceMonthly } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  monthly: FinanceMonthly[];
};

export function YearSummaryBanner({ monthly }: Props) {
  const year = new Date().getFullYear();

  const totals = useMemo(() => {
    const filtered = monthly.filter((m) => m.month_label.startsWith(`${year}-`));
    return filtered.reduce(
      (acc, m) => ({
        sold: acc.sold + Number(m.sold),
        soldCount: acc.soldCount + Number(m.sold_count),
        received: acc.received + Number(m.received),
        paid: acc.paid + Number(m.total_paid_out),
      }),
      { sold: 0, soldCount: 0, received: 0, paid: 0 },
    );
  }, [monthly, year]);

  const profit = totals.received - totals.paid;
  const profitMarginPct =
    totals.sold > 0 ? Math.round((profit / totals.sold) * 100) : 0;

  return (
    <section className="rounded-3xl border border-jcn-gold-400/30 bg-gradient-to-br from-jcn-gold-500/[0.12] via-jcn-gold-500/[0.06] to-transparent p-6 backdrop-blur-xl">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jcn-gold-500/20 text-jcn-gold-300">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
            JCN em {year}
          </h2>
          <p className="text-xs text-jcn-ice/55">
            Acumulado do ano até hoje
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={Briefcase}
          label="Trabalhos fechados"
          value={`${totals.soldCount}`}
          sub="contratos assinados"
          accent="gold"
        />
        <KpiCard
          icon={TrendingUp}
          label="Vendido"
          value={formatUSD(totals.sold)}
          sub={
            totals.soldCount > 0
              ? `ticket médio ${formatUSD(totals.sold / totals.soldCount)}`
              : "—"
          }
          accent="gold"
        />
        <KpiCard
          icon={CheckCheck}
          label="Recebido"
          value={formatUSD(totals.received)}
          sub={
            totals.sold > 0
              ? `${Math.round((totals.received / totals.sold) * 100)}% do vendido`
              : "—"
          }
          accent="green"
        />
        <KpiCard
          icon={PiggyBank}
          label="Lucro líquido"
          value={formatUSD(profit)}
          sub={`${profitMarginPct}% margem`}
          accent={profit >= 0 ? "green" : "rose"}
        />
      </div>

      {/* Linha extra: total pago */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-2 text-xs text-jcn-ice/65">
        <span className="flex items-center gap-2">
          <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
          <span>Total pago no ano</span>
        </span>
        <span className="font-bold text-rose-300">
          {formatUSD(totals.paid)}
        </span>
      </div>
    </section>
  );
}

function KpiCard({
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
  accent: "gold" | "green" | "rose";
}) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
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
