"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Calendar,
  Filter,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  formatMonthLabel,
  formatUSD,
  sumMonths,
} from "@/lib/finance";
import type { FinanceMonthly } from "@/lib/types";
import { cn } from "@/lib/utils";

type Period = "month" | "3m" | "6m" | "12m" | "ytd";

type Props = {
  monthly: FinanceMonthly[];
};

export function FinanceTableTab({ monthly }: Props) {
  const [period, setPeriod] = useState<Period>("3m");

  const filtered = useMemo(() => {
    const now = new Date();
    const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (period === "month") {
      return monthly.filter((m) => m.month_label === currentMonthLabel);
    }
    if (period === "ytd") {
      const yearStr = String(now.getFullYear());
      return monthly.filter((m) => m.month_label.startsWith(yearStr));
    }
    const n = period === "3m" ? 3 : period === "6m" ? 6 : 12;
    return monthly.slice(0, n);
  }, [monthly, period]);

  const totals = sumMonths(filtered);

  return (
    <div className="space-y-5">
      {/* Filtros de período */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/45">
          <Filter className="h-3 w-3" />
          Período
        </div>
        <Chip
          active={period === "month"}
          onClick={() => setPeriod("month")}
          label="Este mês"
        />
        <Chip
          active={period === "3m"}
          onClick={() => setPeriod("3m")}
          label="3 meses"
        />
        <Chip
          active={period === "6m"}
          onClick={() => setPeriod("6m")}
          label="6 meses"
        />
        <Chip
          active={period === "12m"}
          onClick={() => setPeriod("12m")}
          label="12 meses"
        />
        <Chip
          active={period === "ytd"}
          onClick={() => setPeriod("ytd")}
          label="Ano corrente"
        />
      </div>

      {/* 3 colunas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column
          icon={Briefcase}
          accent="gold"
          title="Vendido"
          subtitle="Contratos assinados"
          rows={filtered.map((m) => ({
            label: formatMonthLabel(m.month_label),
            value: Number(m.sold),
            sub: `${m.sold_count} ${m.sold_count === 1 ? "job" : "jobs"}`,
          }))}
          total={totals.sold}
        />
        <Column
          icon={ArrowDownRight}
          accent="green"
          title="Recebido"
          subtitle="Caixa que entrou"
          rows={filtered.map((m) => ({
            label: formatMonthLabel(m.month_label),
            value: Number(m.received),
            sub: `${m.received_count} ${m.received_count === 1 ? "pagamento" : "pagamentos"}`,
          }))}
          total={totals.received}
        />
        <Column
          icon={ArrowUpRight}
          accent="rose"
          title="Despesas"
          subtitle="Tudo que saiu do caixa"
          rows={filtered.map((m) => ({
            label: formatMonthLabel(m.month_label),
            value: Number(m.total_paid_out),
            sub: paidSub(m),
          }))}
          total={totals.paid}
        />
      </div>

      {/* Saldo geral */}
      <div
        className={cn(
          "rounded-3xl border p-6 backdrop-blur-xl",
          totals.balance >= 0
            ? "border-emerald-400/30 bg-emerald-500/10"
            : "border-rose-400/30 bg-rose-500/10",
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className={cn(
                "flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]",
                totals.balance >= 0 ? "text-emerald-300" : "text-rose-300",
              )}
            >
              <Wallet className="h-3 w-3" />
              Saldo geral do período
            </div>
            <div
              className={cn(
                "mt-2 text-3xl font-black tracking-tight md:text-4xl",
                totals.balance >= 0 ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {formatUSD(totals.balance)}
            </div>
            <div className="mt-1 text-xs text-jcn-ice/55">
              Recebido {formatUSD(totals.received)} menos Despesas{" "}
              {formatUSD(totals.paid)}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <Calendar className="h-4 w-4 text-jcn-ice/55" />
            <div className="text-xs text-jcn-ice/65">
              {filtered.length} {filtered.length === 1 ? "mês" : "meses"}{" "}
              somados
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function paidSub(m: FinanceMonthly): string {
  const parts: string[] = [];
  if (Number(m.job_expenses_cash) > 0)
    parts.push(`obra ${formatUSD(Number(m.job_expenses_cash))}`);
  if (Number(m.job_hours_cost) > 0)
    parts.push(`horas ${formatUSD(Number(m.job_hours_cost))}`);
  if (Number(m.job_subs_cost) > 0)
    parts.push(`subs ${formatUSD(Number(m.job_subs_cost))}`);
  if (Number(m.ads_spend) > 0)
    parts.push(`ads ${formatUSD(Number(m.ads_spend))}`);
  if (Number(m.business_expenses) > 0)
    parts.push(`empresa ${formatUSD(Number(m.business_expenses))}`);
  return parts.join(" • ") || "—";
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.08] bg-white/[0.025] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      {label}
    </button>
  );
}

function Column({
  icon: Icon,
  accent,
  title,
  subtitle,
  rows,
  total,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: "gold" | "green" | "rose";
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: number; sub: string }>;
  total: number;
}) {
  const accentClass = {
    gold: {
      border: "border-jcn-gold-400/30",
      bg: "bg-jcn-gold-500/10",
      text: "text-jcn-gold-300",
    },
    green: {
      border: "border-emerald-400/30",
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
    },
    rose: {
      border: "border-rose-400/30",
      bg: "bg-rose-500/10",
      text: "text-rose-300",
    },
  }[accent];

  return (
    <div className="flex flex-col rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur-xl">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border px-3 py-2",
          accentClass.border,
          accentClass.bg,
          accentClass.text,
        )}
      >
        <Icon className="h-4 w-4" />
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">
            {title}
          </div>
          <div className="text-[10px] opacity-60">{subtitle}</div>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-1.5">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-center text-xs text-jcn-ice/45">
            Sem dados
          </p>
        ) : (
          rows.map((r, i) => (
            <div
              key={`${r.label}-${i}`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] px-3 py-2.5 transition hover:bg-white/[0.03]",
                i % 2 === 0 ? "bg-white/[0.01]" : "bg-white/[0.02]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold capitalize text-jcn-ice">
                  {r.label}
                </div>
                <div className="truncate text-[10px] text-jcn-ice/45">
                  {r.sub}
                </div>
              </div>
              <div
                className={cn(
                  "shrink-0 text-sm font-black tabular-nums",
                  accentClass.text,
                )}
              >
                {formatUSD(r.value)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total rodapé */}
      <div
        className={cn(
          "mt-3 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5",
          accentClass.border,
          accentClass.bg,
        )}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/65">
          Total
        </span>
        <span className={cn("text-base font-black tabular-nums", accentClass.text)}>
          {formatUSD(total)}
        </span>
      </div>
    </div>
  );
}
