"use client";

/**
 * Dialog "Cofrinho" — histórico de saques/despesas/juros de UMA linha do breakdown.
 *
 * Mostra 4 KPIs (Aprovado / Recebido / Sobra / Disponível pra sacar), lista
 * cronológica de transações e formulário pra adicionar novo saque, despesa
 * ou juros. Total refletido no spent_amount do item pra bater com view mãe.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Percent,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  FlipDrawItem,
  FlipDrawItemTransaction,
  FlipDrawItemTxnKind,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  item: FlipDrawItem;
  onClose: () => void;
  onSaved: () => void;
};

const KIND_LABEL: Record<FlipDrawItemTxnKind, string> = {
  withdrawal: "Saque do banco",
  expense: "Despesa paga",
  interest: "Juros pagos",
};

const KIND_TONE: Record<FlipDrawItemTxnKind, string> = {
  withdrawal: "text-emerald-300",
  expense: "text-rose-300",
  interest: "text-amber-300",
};

export function DrawItemTransactions({ item, onClose, onSaved }: Props) {
  const [txns, setTxns] = useState<FlipDrawItemTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<FlipDrawItemTxnKind>("withdrawal");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("flip_draw_item_transactions")
      .select("*")
      .eq("draw_item_id", item.id)
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false });
    setTxns((data ?? []) as FlipDrawItemTransaction[]);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const approved = Number(item.amount);
  const received = txns
    .filter((t) => t.kind === "withdrawal")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expensed = txns
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const interest = txns
    .filter((t) => t.kind === "interest")
    .reduce((s, t) => s + Number(t.amount), 0);
  const cashInHand = received - expensed - interest;
  const availableToPull = approved - received;

  async function addTxn() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_draw_item_transactions")
      .insert({
        draw_item_id: item.id,
        kind,
        amount: amt,
        txn_date: txnDate,
        description: description.trim() || null,
      });

    if (error) {
      setSaving(false);
      toast.error("Erro", { description: error.message });
      return;
    }

    // Sincroniza spent_amount do item = SUM(expense) + SUM(interest)
    // pra bater visualmente no card mãe do breakdown.
    const newSpent =
      expensed + interest + (kind === "expense" || kind === "interest" ? amt : 0);
    await supabase
      .from("flip_draw_items")
      .update({ spent_amount: newSpent })
      .eq("id", item.id);

    setSaving(false);
    setAmount("");
    setDescription("");
    await reload();
    onSaved();
  }

  async function deleteTxn(t: FlipDrawItemTransaction) {
    if (!confirm(`Apagar transação de ${formatCurrency(Number(t.amount))}?`))
      return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_draw_item_transactions")
      .delete()
      .eq("id", t.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    // Recalcula spent_amount depois de apagar
    const remaining = txns.filter((x) => x.id !== t.id);
    const newSpent = remaining
      .filter((x) => x.kind === "expense" || x.kind === "interest")
      .reduce((s, x) => s + Number(x.amount), 0);
    await supabase
      .from("flip_draw_items")
      .update({ spent_amount: newSpent })
      .eq("id", item.id);

    await reload();
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-jcn-midnight shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <div>
            <h2 className="text-lg font-black text-jcn-gold-300">
              {item.category}
            </h2>
            <p className="text-[10px] text-jcn-ice/45">
              Aprovado pelo banco: {formatCurrency(approved)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-jcn-ice/45 hover:bg-white/[0.06] hover:text-jcn-ice"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 border-b border-white/[0.08] bg-white/[0.02] p-3">
          <Kpi
            label="Recebido do banco"
            value={received}
            tone="text-emerald-300"
          />
          <Kpi
            label="Disponível pra sacar"
            value={availableToPull}
            tone={availableToPull > 0 ? "text-jcn-gold-300" : "text-jcn-ice/45"}
          />
          <Kpi label="Gasto" value={expensed + interest} tone="text-rose-300" />
          <Kpi
            label="Sobra em caixa"
            value={cashInHand}
            tone={
              cashInHand > 0
                ? "text-emerald-300"
                : cashInHand < 0
                  ? "text-rose-300"
                  : "text-jcn-ice/55"
            }
          />
        </div>

        {/* Lista de transações */}
        <div className="max-h-[35vh] overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-jcn-gold-300" />
            </div>
          ) : txns.length === 0 ? (
            <p className="py-4 text-center text-xs italic text-jcn-ice/40">
              Nenhuma transação. Comece pelo saque do banco abaixo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {txns.map((t) => {
                const Icon =
                  t.kind === "withdrawal"
                    ? ArrowDownCircle
                    : t.kind === "interest"
                      ? Percent
                      : ArrowUpCircle;
                const sign = t.kind === "withdrawal" ? "+" : "−";
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", KIND_TONE[t.kind])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-jcn-ice">
                        {t.description ?? KIND_LABEL[t.kind]}
                      </p>
                      <p className="text-[10px] text-jcn-ice/45">
                        {format(new Date(t.txn_date + "T12:00:00"), "dd MMM", {
                          locale: ptBR,
                        })}{" "}
                        · {KIND_LABEL[t.kind]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-black",
                        KIND_TONE[t.kind],
                      )}
                    >
                      {sign}
                      {formatCurrency(Number(t.amount))}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteTxn(t)}
                      className="shrink-0 rounded p-1 text-jcn-ice/35 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Form adicionar */}
        <div className="space-y-2 border-t border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex gap-1">
            <KindBtn
              active={kind === "withdrawal"}
              onClick={() => setKind("withdrawal")}
              icon={ArrowDownCircle}
              label="Saque"
              tone="emerald"
            />
            <KindBtn
              active={kind === "expense"}
              onClick={() => setKind("expense")}
              icon={ArrowUpCircle}
              label="Despesa"
              tone="rose"
            />
            <KindBtn
              active={kind === "interest"}
              onClick={() => setKind("interest")}
              icon={Percent}
              label="Juros"
              tone="amber"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] uppercase text-jcn-ice/55">Data</Label>
              <Input
                type="date"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[9px] uppercase text-jcn-ice/55">
                Valor ($)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-black"
              />
            </div>
          </div>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (ex: 50% do requerimento / pgto City Somerville)"
            className="h-8 text-xs"
          />
          <Button
            onClick={addTxn}
            disabled={saving}
            className="h-8 w-full bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar {KIND_LABEL[kind]}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
      <p className="text-[9px] uppercase tracking-wider text-jcn-ice/45">
        {label}
      </p>
      <p className={cn("text-sm font-black", tone)}>{formatCurrency(value)}</p>
    </div>
  );
}

function KindBtn({
  active,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "emerald" | "rose" | "amber";
}) {
  const toneMap = {
    emerald: {
      active: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
      inactive: "border-white/[0.08] bg-white/[0.03] text-jcn-ice/55",
    },
    rose: {
      active: "border-rose-400/50 bg-rose-500/15 text-rose-200",
      inactive: "border-white/[0.08] bg-white/[0.03] text-jcn-ice/55",
    },
    amber: {
      active: "border-amber-400/50 bg-amber-500/15 text-amber-200",
      inactive: "border-white/[0.08] bg-white/[0.03] text-jcn-ice/55",
    },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition",
        active ? toneMap.active : toneMap.inactive,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
