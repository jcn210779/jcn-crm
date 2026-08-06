"use client";

/**
 * Tela /caixa — panorama consolidado de dinheiro em caixa.
 *
 * Regra: contabilidade separada (CLAUDE.md). NAO mistura pool JCN + Flip.
 * Mostra cada entidade lado a lado com Recebido / Gasto / Saldo em caixa.
 * O rodape "TOTAL VISUAL" e SOMENTE informativo, com aviso — nao usar em
 * contabilidade oficial.
 */

import {
  Banknote,
  Building2,
  HardHat,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { formatCurrency } from "@/lib/format";
import type { FinanceMonthly, FlipCashSummary, FlipDetails } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  flips: FlipDetails[];
  cashByFlip: Record<string, FlipCashSummary>;
  txnByFlip: Record<string, { received: number; spent: number }>;
  monthly: FinanceMonthly | null;
};

type EntityRow = {
  key: string;
  label: string;
  subtitle: string;
  received: number;
  spent: number;
  cash: number;
  href: string | null;
  icon: React.ComponentType<{ className?: string }>;
  tone: "jcn" | "flip";
};

export function CaixaView({ flips, cashByFlip, txnByFlip, monthly }: Props) {
  const rows: EntityRow[] = useMemo(() => {
    const out: EntityRow[] = [];

    // JCN Construction (linha dourada)
    out.push({
      key: "jcn",
      label: "JCN Construction",
      subtitle: monthly?.month_label
        ? `Mes atual: ${monthly.month_label}`
        : "Sem dados do mes",
      received: Number(monthly?.received ?? 0),
      spent: Number(monthly?.total_paid_out ?? 0),
      cash: Number(monthly?.cash_balance ?? 0),
      href: "/finance",
      icon: HardHat,
      tone: "jcn",
    });

    // Uma linha por flip
    for (const f of flips) {
      const cash = cashByFlip[f.id];
      const txn = txnByFlip[f.id] ?? { received: 0, spent: 0 };
      // Recebido = withdrawals (cash real que caiu na conta pra gastar).
      // Se ainda nao teve saque, usa bank_drawn (dinheiro que o banco
      // aprovou/liberou pro projeto) como fallback pra nao mostrar $0.
      const received = txn.received > 0 ? txn.received : Number(cash?.bank_drawn ?? 0);
      const spent = txn.spent;
      out.push({
        key: `flip:${f.id}`,
        label: f.property_address ?? "Flip sem endereco",
        subtitle: [f.property_city, f.property_state].filter(Boolean).join(", "),
        received,
        spent,
        cash: received - spent,
        href: `/job/${f.job_id}`,
        icon: Building2,
        tone: "flip",
      });
    }

    return out;
  }, [flips, cashByFlip, txnByFlip, monthly]);

  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalCash = rows.reduce((s, r) => s + r.cash, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/10">
          <Wallet className="h-5 w-5 text-jcn-gold-300" />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-jcn-ice">
            Caixa Consolidado
          </h1>
          <p className="text-xs text-jcn-ice/50">
            JCN + cada flip lado a lado. Contabilidade separada por regra —
            total geral e apenas visual.
          </p>
        </div>
      </div>

      {/* Cards de cada entidade */}
      <div className="grid gap-3">
        {rows.map((r) => (
          <EntityCard key={r.key} row={r} />
        ))}
      </div>

      {/* Total visual */}
      {rows.length > 1 && (
        <div className="rounded-3xl border border-jcn-gold-400/40 bg-gradient-to-br from-jcn-gold-500/10 to-white/[0.02] p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-jcn-gold-300" />
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-jcn-gold-300">
              Total visual (soma das entidades)
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <BigKpi label="Recebido total" value={totalReceived} tone="emerald" />
            <BigKpi label="Gasto total" value={totalSpent} tone="rose" />
            <BigKpi
              label="Saldo somado"
              value={totalCash}
              tone={totalCash >= 0 ? "gold" : "rose"}
              highlight
            />
          </div>
          <p className="mt-3 text-[10px] italic text-jcn-ice/45">
            ⚠️ Somatorio informativo. NAO usar em relatorio contabil oficial —
            JCN e cada Flip sao entidades separadas por regra do negocio.
          </p>
        </div>
      )}
    </div>
  );
}

function EntityCard({ row }: { row: EntityRow }) {
  const Icon = row.icon;
  const isPositive = row.cash > 0;
  const isNegative = row.cash < 0;
  const CashIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : null;

  const inner = (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border p-5 backdrop-blur-xl transition md:flex-row md:items-center md:justify-between",
        row.tone === "jcn"
          ? "border-jcn-gold-400/25 bg-gradient-to-br from-jcn-gold-500/[0.06] to-white/[0.02] hover:border-jcn-gold-400/40"
          : "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            row.tone === "jcn"
              ? "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300"
              : "border-white/10 bg-white/[0.05] text-jcn-ice/70",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-jcn-ice">
            {row.label}
          </h3>
          <p className="truncate text-[11px] text-jcn-ice/45">{row.subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 md:min-w-[420px]">
        <MiniStat label="Recebido" value={row.received} tone="text-emerald-300" />
        <MiniStat label="Gasto" value={row.spent} tone="text-rose-300" />
        <MiniStat
          label="Saldo em caixa"
          value={row.cash}
          tone={
            isPositive
              ? "text-emerald-300"
              : isNegative
                ? "text-rose-300"
                : "text-jcn-ice/55"
          }
          icon={CashIcon}
          bold
        />
      </div>
    </div>
  );

  return row.href ? (
    <Link href={row.href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function MiniStat({
  label,
  value,
  tone,
  icon: Icon,
  bold = false,
}: {
  label: string;
  value: number;
  tone: string;
  icon?: React.ComponentType<{ className?: string }> | null;
  bold?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-jcn-ice/45">
        {label}
      </p>
      <p
        className={cn(
          "flex items-center gap-1",
          bold ? "text-lg font-black" : "text-sm font-black",
          tone,
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {formatCurrency(value)}
      </p>
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
