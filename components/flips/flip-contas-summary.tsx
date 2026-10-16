"use client";

/**
 * Totais consolidados das 5 contas do flip (mig 0071).
 * Soma TODOS os bank_draws em uma tabela única: alocado / gasto / em caixa.
 */

import { Loader2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { FlipContaSummary, FlipContaTipo } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  flipId: string;
  refreshKey?: number;
};

const META: Record<FlipContaTipo, { label: string; icon: string; color: string; bg: string; border: string }> = {
  construcao: {
    label: "Construção",
    icon: "🏗️",
    color: "text-amber-200",
    bg: "bg-amber-500/[0.06]",
    border: "border-amber-400/30",
  },
  cottage: {
    label: "Cottage",
    icon: "🏡",
    color: "text-orange-200",
    bg: "bg-orange-500/[0.06]",
    border: "border-orange-400/30",
  },
  mortgage: {
    label: "Mortgage",
    icon: "🏦",
    color: "text-violet-200",
    bg: "bg-violet-500/[0.06]",
    border: "border-violet-400/30",
  },
  salario: {
    label: "Salário",
    icon: "👷",
    color: "text-sky-200",
    bg: "bg-sky-500/[0.06]",
    border: "border-sky-400/30",
  },
  lucro: {
    label: "Lucro",
    icon: "💰",
    color: "text-emerald-200",
    bg: "bg-emerald-500/[0.07]",
    border: "border-emerald-400/40",
  },
};

const ORDER: FlipContaTipo[] = [
  "construcao",
  "cottage",
  "mortgage",
  "salario",
  "lucro",
];

export function FlipContasSummary({ flipId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<FlipContaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("v_flip_contas_summary")
        .select("*")
        .eq("flip_id", flipId);
      if (!cancelled) {
        setRows((data ?? []) as FlipContaSummary[]);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [flipId, refreshKey]);

  // Garante 5 linhas na ordem canonica (preenche zeros pras contas sem dado)
  const byTipo = new Map<FlipContaTipo, FlipContaSummary>();
  for (const r of rows) byTipo.set(r.conta_tipo, r);
  const ordered: FlipContaSummary[] = ORDER.map(
    (tipo) =>
      byTipo.get(tipo) ?? {
        flip_id: flipId,
        conta_tipo: tipo,
        alocado_total: 0,
        gasto_total: 0,
        em_caixa_total: 0,
        num_draws: 0,
      },
  );

  const totalAlocado = ordered.reduce((s, r) => s + Number(r.alocado_total), 0);
  const totalGasto = ordered.reduce((s, r) => s + Number(r.gasto_total), 0);
  const totalCaixa = totalAlocado - totalGasto;

  return (
    <div className="mb-3 rounded-2xl border border-jcn-gold-400/25 bg-gradient-to-br from-jcn-gold-500/[0.05] to-white/[0.015] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-jcn-gold-300" />
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-jcn-gold-300">
            Totais por conta (todos os requerimentos)
          </h3>
        </div>
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-jcn-gold-300" />
        )}
      </div>

      {/* Tabela */}
      <div className="space-y-1.5">
        {ordered.map((r) => {
          const meta = META[r.conta_tipo];
          const alocado = Number(r.alocado_total);
          const gasto = Number(r.gasto_total);
          const caixa = Number(r.em_caixa_total);
          return (
            <div
              key={r.conta_tipo}
              className={cn(
                "grid grid-cols-[auto_1fr_repeat(3,minmax(0,120px))] items-center gap-3 rounded-lg border px-3 py-2 text-xs",
                meta.bg,
                meta.border,
              )}
            >
              <span className="text-base">{meta.icon}</span>
              <span
                className={cn(
                  "font-black uppercase tracking-wider",
                  meta.color,
                )}
              >
                {meta.label}
              </span>
              <div className="text-right">
                <p className="text-[9px] uppercase text-jcn-ice/40">Alocado</p>
                <p className="font-black text-jcn-gold-300">
                  {formatCurrency(alocado)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase text-jcn-ice/40">Gasto</p>
                <p className="font-black text-rose-300">
                  {formatCurrency(gasto)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase text-jcn-ice/40">
                  Em caixa
                </p>
                <p
                  className={cn(
                    "text-sm font-black",
                    caixa > 0
                      ? "text-emerald-300"
                      : caixa < 0
                        ? "text-rose-300"
                        : "text-jcn-ice/55",
                  )}
                >
                  {formatCurrency(caixa)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodape total */}
      <div className="mt-2 grid grid-cols-[auto_1fr_repeat(3,minmax(0,120px))] items-center gap-3 border-t border-jcn-gold-400/25 px-3 pt-2 text-xs">
        <span />
        <span className="text-[10px] font-black uppercase tracking-wider text-jcn-ice/70">
          TOTAL
        </span>
        <p className="text-right font-black text-jcn-gold-300">
          {formatCurrency(totalAlocado)}
        </p>
        <p className="text-right font-black text-rose-300">
          {formatCurrency(totalGasto)}
        </p>
        <p
          className={cn(
            "text-right text-sm font-black",
            totalCaixa > 0
              ? "text-emerald-300"
              : totalCaixa < 0
                ? "text-rose-300"
                : "text-jcn-ice/55",
          )}
        >
          {formatCurrency(totalCaixa)}
        </p>
      </div>
    </div>
  );
}
