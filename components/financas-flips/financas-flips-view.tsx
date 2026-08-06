"use client";

/**
 * Tela /financas-flips — panorama simples de lucro por flip.
 *
 * Formula: Requerimento (SUM bank_draws) − Gasto (SUM outflows do cofrinho) = Lucro
 * Sem JCN, sem mistura. So flips.
 */

import { Building2, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlipFinanceRow } from "@/app/financas-flips/page";

type Props = {
  rows: FlipFinanceRow[];
};

export function FinancasFlipsView({ rows }: Props) {
  const totalReq = rows.reduce((s, r) => s + r.requerimento, 0);
  const totalGasto = rows.reduce((s, r) => s + r.gasto, 0);
  const totalLucro = totalReq - totalGasto;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/10">
          <Landmark className="h-5 w-5 text-jcn-gold-300" />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-jcn-ice">
            Finanças dos Flips
          </h1>
          <p className="text-xs text-jcn-ice/50">
            Requerimento − Gasto = Lucro. Só flips, sem JCN.
          </p>
        </div>
      </div>

      {/* Totais no topo */}
      <div className="rounded-3xl border border-jcn-gold-400/40 bg-gradient-to-br from-jcn-gold-500/10 to-white/[0.02] p-5 backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-3">
          <BigKpi label="Requerimento total" value={totalReq} tone="gold" />
          <BigKpi label="Gasto total" value={totalGasto} tone="rose" />
          <BigKpi
            label="LUCRO TOTAL"
            value={totalLucro}
            tone={totalLucro >= 0 ? "emerald" : "rose"}
            highlight
          />
        </div>
      </div>

      {/* Cards por flip */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center text-sm text-jcn-ice/50">
          Nenhum flip cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <FlipRow key={r.flip.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlipRow({ row }: { row: FlipFinanceRow }) {
  const isPositive = row.lucro > 0;
  const isNegative = row.lucro < 0;
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : null;
  const marginPct =
    row.requerimento > 0 ? (row.lucro / row.requerimento) * 100 : 0;

  return (
    <Link
      href={`/job/${row.flip.job_id}`}
      className="block rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl transition hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-jcn-ice/70">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-jcn-ice">
              {row.flip.property_address ?? "Flip sem endereço"}
            </h3>
            <p className="truncate text-[11px] text-jcn-ice/45">
              {[row.flip.property_city, row.flip.property_state]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 md:min-w-[440px]">
          <MiniStat
            label="Requerimento"
            value={row.requerimento}
            tone="text-jcn-gold-300"
          />
          <MiniStat label="Gasto" value={row.gasto} tone="text-rose-300" />
          <div>
            <p className="text-[9px] uppercase tracking-wider text-jcn-ice/45">
              Lucro
            </p>
            <p
              className={cn(
                "flex items-center gap-1 text-lg font-black",
                isPositive
                  ? "text-emerald-300"
                  : isNegative
                    ? "text-rose-300"
                    : "text-jcn-ice/55",
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {formatCurrency(row.lucro)}
            </p>
            {row.requerimento > 0 && (
              <p className="text-[10px] text-jcn-ice/40">
                {marginPct.toFixed(1)}% de margem
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-jcn-ice/45">
        {label}
      </p>
      <p className={cn("text-sm font-black", tone)}>{formatCurrency(value)}</p>
    </div>
  );
}

function BigKpi({
  label,
  value,
  tone,
  highlight = false,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "gold";
  highlight?: boolean;
}) {
  const toneClass = {
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    gold: "text-jcn-gold-300",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        highlight
          ? "border-jcn-gold-500/40 bg-jcn-gold-500/10"
          : "border-white/[0.06] bg-white/[0.03]",
      )}
    >
      <p className="text-[9px] uppercase tracking-wider text-jcn-ice/45">
        {label}
      </p>
      <p className={cn("text-xl font-black", toneClass)}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
