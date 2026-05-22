"use client";

import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  CheckCheck,
  Minus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import { formatUSD } from "@/lib/finance";
import type { FinanceMonthly } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  monthly: FinanceMonthly[];
};

type YearTotal = {
  year: number;
  sold: number;
  received: number;
  paid: number;
  net: number; // received - paid
  months: FinanceMonthly[];
};

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function FinanceAnnualTab({ monthly }: Props) {
  // Agrupar por ano
  const byYear = useMemo<YearTotal[]>(() => {
    const map = new Map<number, YearTotal>();
    for (const m of monthly) {
      const y = parseInt(m.month_label.slice(0, 4));
      const cur = map.get(y);
      if (cur) {
        cur.sold += Number(m.sold);
        cur.received += Number(m.received);
        cur.paid += Number(m.total_paid_out);
        cur.net += Number(m.cash_balance);
        cur.months.push(m);
      } else {
        map.set(y, {
          year: y,
          sold: Number(m.sold),
          received: Number(m.received),
          paid: Number(m.total_paid_out),
          net: Number(m.cash_balance),
          months: [m],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }, [monthly]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(
    byYear[0]?.year ?? currentYear,
  );

  const current = byYear.find((y) => y.year === selectedYear);
  const previous = byYear.find((y) => y.year === selectedYear - 1);

  // Meses ordenados Jan→Dez pra breakdown (sempre calcula, mesmo se current=null)
  const monthsOrdered = useMemo(() => {
    const arr: Array<FinanceMonthly | null> = Array(12).fill(null);
    if (!current) return arr;
    for (const m of current.months) {
      const idx = parseInt(m.month_label.slice(5, 7)) - 1;
      arr[idx] = m;
    }
    return arr;
  }, [current]);

  if (!current) {
    return (
      <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
        <p className="text-sm font-semibold text-jcn-ice/65">
          Sem dados pra {selectedYear}
        </p>
      </div>
    );
  }

  function delta(curr: number, prev: number | undefined): {
    pct: number | null;
    direction: "up" | "down" | "flat";
  } {
    if (prev === undefined || prev === 0) {
      return { pct: null, direction: "flat" };
    }
    const diff = curr - prev;
    const pct = (diff / Math.abs(prev)) * 100;
    return {
      pct,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    };
  }

  const dSold = delta(current.sold, previous?.sold);
  const dReceived = delta(current.received, previous?.received);
  const dPaid = delta(current.paid, previous?.paid);
  const dNet = delta(current.net, previous?.net);

  const monthsWithData = monthsOrdered.filter((m) => m !== null).length;

  return (
    <div className="space-y-5">
      {/* Seletor de ano */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <span className="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/55">
          Ano
        </span>
        {byYear.map((y) => (
          <button
            key={y.year}
            type="button"
            onClick={() => setSelectedYear(y.year)}
            className={cn(
              "rounded-xl border px-4 py-1.5 text-sm font-bold transition",
              selectedYear === y.year
                ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
                : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
            )}
          >
            {y.year}
            {y.year === currentYear && (
              <span className="ml-1 text-[10px] font-semibold opacity-70">
                (atual)
              </span>
            )}
          </button>
        ))}
      </div>

      {/* KPIs grandes */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BigKpi
          icon={Briefcase}
          label="Vendido no ano"
          value={formatUSD(current.sold)}
          delta={dSold}
          accent="gold"
        />
        <BigKpi
          icon={CheckCheck}
          label="Recebido no ano"
          value={formatUSD(current.received)}
          delta={dReceived}
          accent="green"
        />
        <BigKpi
          icon={TrendingDown}
          label="Pago no ano"
          value={formatUSD(current.paid)}
          delta={dPaid}
          accent="rose"
          inverse
        />
        <BigKpi
          icon={Wallet}
          label="Lucro líquido"
          value={formatUSD(current.net)}
          delta={dNet}
          accent={current.net >= 0 ? "green" : "rose"}
        />
      </div>

      {/* Breakdown mensal */}
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black uppercase tracking-[0.12em] text-jcn-ice/85">
            Detalhe mensal — {current.year}
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-jcn-ice/45">
            {monthsWithData} {monthsWithData === 1 ? "mês" : "meses"} com dado
          </span>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/55">
              <tr className="border-b border-white/[0.06]">
                <th className="px-2 py-2 text-left">Mês</th>
                <th className="px-2 py-2 text-right">Vendido</th>
                <th className="px-2 py-2 text-right">Recebido</th>
                <th className="px-2 py-2 text-right">Pago</th>
                <th className="px-2 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {monthsOrdered.map((m, i) => {
                const monthName = MONTH_NAMES[i];
                if (!m) {
                  return (
                    <tr
                      key={i}
                      className="border-b border-white/[0.04] text-jcn-ice/30"
                    >
                      <td className="px-2 py-2 font-semibold">{monthName}</td>
                      <td className="px-2 py-2 text-right">—</td>
                      <td className="px-2 py-2 text-right">—</td>
                      <td className="px-2 py-2 text-right">—</td>
                      <td className="px-2 py-2 text-right">—</td>
                    </tr>
                  );
                }
                const saldo = Number(m.cash_balance);
                return (
                  <tr
                    key={i}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="px-2 py-2 font-bold text-jcn-ice">
                      {monthName}
                    </td>
                    <td className="px-2 py-2 text-right text-jcn-ice">
                      {Number(m.sold) > 0 ? formatUSD(Number(m.sold)) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-emerald-300">
                      {Number(m.received) > 0
                        ? formatUSD(Number(m.received))
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-rose-300">
                      {Number(m.total_paid_out) > 0
                        ? formatUSD(Number(m.total_paid_out))
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2 text-right font-black",
                        saldo > 0 && "text-emerald-300",
                        saldo < 0 && "text-rose-300",
                        saldo === 0 && "text-jcn-ice/30",
                      )}
                    >
                      {saldo !== 0 ? formatUSD(saldo) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-white/[0.03] text-sm font-black">
              <tr>
                <td className="px-2 py-3 uppercase tracking-[0.12em] text-jcn-ice/65">
                  Total
                </td>
                <td className="px-2 py-3 text-right text-jcn-gold-300">
                  {formatUSD(current.sold)}
                </td>
                <td className="px-2 py-3 text-right text-emerald-300">
                  {formatUSD(current.received)}
                </td>
                <td className="px-2 py-3 text-right text-rose-300">
                  {formatUSD(current.paid)}
                </td>
                <td
                  className={cn(
                    "px-2 py-3 text-right",
                    current.net >= 0 ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {formatUSD(current.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Comparativo curto se tiver ano anterior */}
      {previous && (
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl">
          <header className="mb-3">
            <h2 className="text-base font-black uppercase tracking-[0.12em] text-jcn-ice/85">
              {current.year} vs {previous.year}
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <ComparativeRow
              label="Vendido"
              curr={current.sold}
              prev={previous.sold}
            />
            <ComparativeRow
              label="Recebido"
              curr={current.received}
              prev={previous.received}
            />
            <ComparativeRow
              label="Pago"
              curr={current.paid}
              prev={previous.paid}
              inverse
            />
            <ComparativeRow
              label="Lucro líquido"
              curr={current.net}
              prev={previous.net}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BigKpi({
  icon: Icon,
  label,
  value,
  delta,
  accent,
  inverse = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: { pct: number | null; direction: "up" | "down" | "flat" };
  accent: "gold" | "green" | "rose";
  /** Se true, "up" é ruim (ex: gastos subindo). */
  inverse?: boolean;
}) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  }[accent];

  const good = inverse ? delta.direction === "down" : delta.direction === "up";
  const bad = inverse ? delta.direction === "up" : delta.direction === "down";

  return (
    <div className={cn("rounded-2xl border p-5 backdrop-blur-xl", accentClass)}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
        {value}
      </div>
      {delta.pct !== null && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1 text-[11px] font-bold",
            good && "text-emerald-300",
            bad && "text-rose-300",
            !good && !bad && "text-jcn-ice/45",
          )}
        >
          {delta.direction === "up" && <ArrowUp className="h-3 w-3" />}
          {delta.direction === "down" && <ArrowDown className="h-3 w-3" />}
          {delta.direction === "flat" && <Minus className="h-3 w-3" />}
          {Math.abs(delta.pct).toFixed(1)}% vs ano anterior
        </div>
      )}
      {delta.pct === null && (
        <div className="mt-2 text-[11px] text-jcn-ice/45">
          Sem dados do ano anterior
        </div>
      )}
    </div>
  );
}

function ComparativeRow({
  label,
  curr,
  prev,
  inverse = false,
}: {
  label: string;
  curr: number;
  prev: number;
  inverse?: boolean;
}) {
  const diff = curr - prev;
  const pct = prev === 0 ? 0 : (diff / Math.abs(prev)) * 100;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const good = inverse ? direction === "down" : direction === "up";
  const bad = inverse ? direction === "up" : direction === "down";

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/55">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-lg font-black text-jcn-ice">{formatUSD(curr)}</div>
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
            good && "bg-emerald-500/15 text-emerald-300",
            bad && "bg-rose-500/15 text-rose-300",
            !good && !bad && "bg-white/[0.05] text-jcn-ice/55",
          )}
        >
          {direction === "up" && <TrendingUp className="h-2.5 w-2.5" />}
          {direction === "down" && <TrendingDown className="h-2.5 w-2.5" />}
          {direction === "flat" && <Minus className="h-2.5 w-2.5" />}
          {Math.abs(pct).toFixed(0)}%
        </div>
      </div>
      <div className="mt-0.5 text-[10px] text-jcn-ice/45">
        ano anterior: {formatUSD(prev)}
      </div>
    </div>
  );
}
