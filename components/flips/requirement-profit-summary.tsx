"use client";

/**
 * Painel consolidado de lucro por requerimento (bank_draw).
 *
 * Lista cada draw do banco com: Aprovado, Recebido, Total gasto, Lucro.
 * Faz total geral no rodape. Fonte da verdade: flip_draw_item_transactions
 * agrupada por draw_item -> draw.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { CollapsibleCard } from "@/components/flips/collapsible-card";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { resolveCategoryColor } from "@/lib/category-colors";
import type {
  FlipDraw,
  FlipDrawItem,
  FlipDrawItemTransaction,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  flipId: string;
};

type Row = {
  draw: FlipDraw;
  approved: number;
  received: number;
  spent: number;
  profit: number;
};

const OUTFLOW_KINDS = new Set([
  "mortgage",
  "expense_house",
  "expense_cottage",
  "expense_general",
  "salary",
]);

export function RequirementProfitSummary({ flipId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();

      const { data: draws } = await supabase
        .from("flip_draws")
        .select("*")
        .eq("flip_id", flipId)
        .eq("source", "bank_draw")
        .order("draw_date", { ascending: false });

      const drawList = (draws ?? []) as FlipDraw[];
      if (drawList.length === 0) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const drawIds = drawList.map((d) => d.id);

      const { data: items } = await supabase
        .from("flip_draw_items")
        .select("*")
        .in("draw_id", drawIds);

      const itemList = (items ?? []) as FlipDrawItem[];
      const itemIds = itemList.map((i) => i.id);

      let txns: FlipDrawItemTransaction[] = [];
      if (itemIds.length > 0) {
        const { data: t } = await supabase
          .from("flip_draw_item_transactions")
          .select("*")
          .in("draw_item_id", itemIds);
        txns = (t ?? []) as FlipDrawItemTransaction[];
      }

      // Aggregate per draw
      const itemsByDraw = new Map<string, FlipDrawItem[]>();
      for (const it of itemList) {
        const arr = itemsByDraw.get(it.draw_id) ?? [];
        arr.push(it);
        itemsByDraw.set(it.draw_id, arr);
      }

      const txnsByItem = new Map<string, FlipDrawItemTransaction[]>();
      for (const tx of txns) {
        const arr = txnsByItem.get(tx.draw_item_id) ?? [];
        arr.push(tx);
        txnsByItem.set(tx.draw_item_id, arr);
      }

      const computed: Row[] = drawList.map((d) => {
        const drawItems = itemsByDraw.get(d.id) ?? [];
        const approved = drawItems.reduce((s, i) => s + Number(i.amount), 0);
        let received = 0;
        let spent = 0;
        for (const i of drawItems) {
          const its = txnsByItem.get(i.id) ?? [];
          for (const tx of its) {
            const amt = Number(tx.amount);
            if (OUTFLOW_KINDS.has(tx.kind)) spent += amt;
            else received += amt;
          }
        }
        return {
          draw: d,
          approved,
          received,
          spent,
          profit: received - spent,
        };
      });

      if (!cancelled) {
        setRows(computed);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [flipId]);

  const totalApproved = rows.reduce((s, r) => s + r.approved, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalProfit = totalReceived - totalSpent;
  const totalAvailable = totalApproved - totalReceived;

  return (
    <CollapsibleCard
      title="Lucro por Requerimento"
      storageKey={`flip:${flipId}:profit-summary-open`}
      icon={<Wallet className="h-4 w-4 text-jcn-gold-300" />}
      subtitle={
        !loading && rows.length > 0 ? (
          <span>
            {rows.length} requerimento{rows.length > 1 ? "s" : ""} · Lucro geral{" "}
            <span
              className={cn(
                "font-black",
                totalProfit > 0
                  ? "text-emerald-300"
                  : totalProfit < 0
                    ? "text-rose-300"
                    : "text-jcn-ice/55",
              )}
            >
              {formatCurrency(totalProfit)}
            </span>
          </span>
        ) : undefined
      }
    >
      {/* KPIs consolidados no topo */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <BigKpi
          label="Aprovado total"
          value={totalApproved}
          tone="text-jcn-gold-300"
        />
        <BigKpi
          label="Recebido do banco"
          value={totalReceived}
          tone="text-emerald-300"
        />
        <BigKpi label="Total gasto" value={totalSpent} tone="text-rose-300" />
        <BigKpi
          label="LUCRO GERAL"
          value={totalProfit}
          tone={
            totalProfit > 0
              ? "text-emerald-300"
              : totalProfit < 0
                ? "text-rose-300"
                : "text-jcn-ice/55"
          }
          highlight
        />
      </div>

      {/* Extra: quanto ainda dá pra sacar */}
      {totalAvailable > 0 && (
        <p className="mb-3 text-[11px] text-jcn-ice/50">
          Ainda dá pra sacar do banco:{" "}
          <span className="font-black text-jcn-gold-300">
            {formatCurrency(totalAvailable)}
          </span>
        </p>
      )}

      {/* Tabela por draw */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-jcn-gold-300" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs italic text-jcn-ice/40">
          Nenhum requerimento de banco cadastrado ainda.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const tone = resolveCategoryColor({
              manualColor: r.draw.color,
              category: r.draw.milestone ?? "Requerimento",
            });
            const isProfit = r.profit > 0;
            const isLoss = r.profit < 0;
            const ProfitIcon = isProfit
              ? TrendingUp
              : isLoss
                ? TrendingDown
                : null;
            return (
              <div
                key={r.draw.id}
                className={cn(
                  "rounded-lg border p-3",
                  tone.bg,
                  tone.border,
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-jcn-ice">
                      {r.draw.milestone ?? "Sem descrição"}
                    </p>
                    <p className="text-[10px] text-jcn-ice/45">
                      {format(new Date(r.draw.draw_date + "T12:00:00"), "dd MMM yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ProfitIcon && (
                      <ProfitIcon
                        className={cn(
                          "h-4 w-4",
                          isProfit ? "text-emerald-300" : "text-rose-300",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-lg font-black",
                        isProfit
                          ? "text-emerald-300"
                          : isLoss
                            ? "text-rose-300"
                            : "text-jcn-ice/55",
                      )}
                    >
                      {formatCurrency(r.profit)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <MiniStat label="Aprovado" value={r.approved} tone="text-jcn-gold-300" />
                  <MiniStat label="Recebido" value={r.received} tone="text-emerald-300" />
                  <MiniStat label="Gasto" value={r.spent} tone="text-rose-300" />
                </div>
              </div>
            );
          })}

          {/* Linha de total */}
          <div className="mt-3 flex items-center justify-between border-t border-jcn-gold-500/30 pt-3">
            <span className="text-sm font-black uppercase tracking-wider text-jcn-ice">
              Total geral
            </span>
            <span
              className={cn(
                "text-xl font-black",
                totalProfit > 0
                  ? "text-emerald-300"
                  : totalProfit < 0
                    ? "text-rose-300"
                    : "text-jcn-ice/55",
              )}
            >
              {formatCurrency(totalProfit)}
            </span>
          </div>
        </div>
      )}
    </CollapsibleCard>
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
  tone: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2",
        highlight
          ? "border-jcn-gold-500/40 bg-jcn-gold-500/10"
          : "border-white/[0.06] bg-white/[0.03]",
      )}
    >
      <p className="text-[9px] uppercase tracking-wider text-jcn-ice/45">
        {label}
      </p>
      <p className={cn("text-base font-black", tone)}>{formatCurrency(value)}</p>
    </div>
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
      <p className="text-[9px] uppercase text-jcn-ice/40">{label}</p>
      <p className={cn("font-black", tone)}>{formatCurrency(value)}</p>
    </div>
  );
}
