"use client";

/**
 * Modelo envelope por requerimento (mig 0068).
 *
 * Cada bank_draw tem 5 contas FIXAS (criadas por trigger):
 *   Construção · Cottage · Mortgage · Salário · Lucro
 *
 * Fluxo:
 *   1. Recebe dinheiro do banco → "Dividir dinheiro recebido" aloca entre as 5
 *      (cria transactions kind='allocation', uma por conta).
 *   2. Gasta de uma conta → "+ Gasto" cria transaction kind='expense'.
 *   3. amount e spent_amount do item sao recomputados por trigger DB.
 *
 * Saldo em caixa da conta = amount (alocado) − spent_amount (gasto).
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  Eye,
  Loader2,
  Minus,
  Plus,
  Split,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  FlipContaTipo,
  FlipDrawItem,
  FlipDrawItemTransaction,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  drawId: string;
  drawAmount: number;
  defaultOpen?: boolean;
};

type ContaMeta = {
  label: string;
  short: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
};

const CONTA_META: Record<FlipContaTipo, ContaMeta> = {
  construcao: {
    label: "Construção",
    short: "Const.",
    color: "text-amber-200",
    bg: "bg-amber-500/[0.06]",
    border: "border-amber-400/30",
    icon: "🏗️",
  },
  cottage: {
    label: "Cottage",
    short: "Cottage",
    color: "text-orange-200",
    bg: "bg-orange-500/[0.06]",
    border: "border-orange-400/30",
    icon: "🏡",
  },
  mortgage: {
    label: "Mortgage",
    short: "Mortg.",
    color: "text-violet-200",
    bg: "bg-violet-500/[0.06]",
    border: "border-violet-400/30",
    icon: "🏦",
  },
  salario: {
    label: "Salário",
    short: "Salário",
    color: "text-sky-200",
    bg: "bg-sky-500/[0.06]",
    border: "border-sky-400/30",
    icon: "👷",
  },
  lucro: {
    label: "Lucro",
    short: "Lucro",
    color: "text-emerald-200",
    bg: "bg-emerald-500/[0.07]",
    border: "border-emerald-400/40",
    icon: "💰",
  },
};

const ORDER: FlipContaTipo[] = [
  "construcao",
  "cottage",
  "mortgage",
  "salario",
  "lucro",
];

export function DrawContasEnvelope({
  drawId,
  drawAmount,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<FlipDrawItem[]>([]);
  const [allocTxns, setAllocTxns] = useState<FlipDrawItemTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [expenseConta, setExpenseConta] = useState<FlipContaTipo | null>(null);
  const [detailConta, setDetailConta] = useState<FlipContaTipo | null>(null);

  async function reload() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("flip_draw_items")
      .select("*")
      .eq("draw_id", drawId)
      .order("display_order");
    const rows = (data ?? []) as FlipDrawItem[];
    setItems(rows);

    // Puxa allocation txns pra agrupar em "requerimentos recebidos"
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: txns } = await supabase
        .from("flip_draw_item_transactions")
        .select("*")
        .in("draw_item_id", ids)
        .eq("kind", "allocation")
        .order("txn_date", { ascending: true })
        .order("created_at", { ascending: true });
      setAllocTxns((txns ?? []) as FlipDrawItemTransaction[]);
    } else {
      setAllocTxns([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drawId]);

  // Sort por ORDER canonico
  const sortedItems = ORDER.map((tipo) =>
    items.find((i) => i.conta_tipo === tipo),
  ).filter((i): i is FlipDrawItem => Boolean(i));

  const totalAlocado = sortedItems.reduce((s, i) => s + Number(i.amount), 0);
  const totalGasto = sortedItems.reduce(
    (s, i) => s + Number(i.spent_amount ?? 0),
    0,
  );
  const totalCaixa = totalAlocado - totalGasto;
  const sobraPraAlocar = drawAmount - totalAlocado;

  // Agrupa allocation txns por batch_id = "requerimentos recebidos"
  // Txns sem batch_id (dados antigos) ficam cada uma como seu próprio grupo.
  const batchGroups = (() => {
    const map = new Map<
      string,
      { batchId: string | null; date: string; description: string | null; total: number; count: number }
    >();
    for (const t of allocTxns) {
      const key = t.allocation_batch_id ?? `legacy-${t.id}`;
      const existing = map.get(key);
      if (existing) {
        existing.total += Number(t.amount);
        existing.count += 1;
      } else {
        map.set(key, {
          batchId: t.allocation_batch_id,
          date: t.txn_date,
          description: t.description,
          total: Number(t.amount),
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const percentRecebido =
    drawAmount > 0 ? Math.min(100, (totalAlocado / drawAmount) * 100) : 0;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-jcn-ice/50 hover:bg-white/[0.04] hover:text-jcn-gold-300"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-0",
            !open && "-rotate-90",
          )}
        />
        5 Contas do requerimento
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
          {/* Topo: botao dividir + resumo */}
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
                <span className="text-jcn-ice/45">
                  Alocado{" "}
                  <span className="font-black text-jcn-gold-300">
                    {formatCurrency(totalAlocado)}
                  </span>
                </span>
                <span className="text-jcn-ice/45">
                  Gasto{" "}
                  <span className="font-black text-rose-300">
                    {formatCurrency(totalGasto)}
                  </span>
                </span>
                <span className="text-jcn-ice/45">
                  Sobra em caixa{" "}
                  <span
                    className={cn(
                      "font-black",
                      totalCaixa > 0
                        ? "text-emerald-300"
                        : totalCaixa < 0
                          ? "text-rose-300"
                          : "text-jcn-ice/55",
                    )}
                  >
                    {formatCurrency(totalCaixa)}
                  </span>
                </span>
              </div>
              {Math.abs(sobraPraAlocar) >= 0.01 && (
                <p className="mt-1 text-[10px] text-amber-300">
                  {sobraPraAlocar > 0
                    ? `Faltam ${formatCurrency(sobraPraAlocar)} do requerimento (${formatCurrency(drawAmount)}) pra alocar nas contas`
                    : `Excesso de ${formatCurrency(-sobraPraAlocar)} alocado além do requerimento (${formatCurrency(drawAmount)})`}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setSplitOpen(true)}
              className="h-8 bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400"
            >
              <Split className="h-3.5 w-3.5" />
              Dividir recebido
            </Button>
          </div>

          {/* Progresso + lista de requerimentos recebidos (mig 0070) */}
          {batchGroups.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-jcn-gold-400/15 bg-jcn-gold-500/[0.04] p-2.5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                <span className="font-black text-jcn-gold-300">
                  {batchGroups.length} requerimento{batchGroups.length > 1 ? "s" : ""} recebido{batchGroups.length > 1 ? "s" : ""}
                </span>
                <span className="font-black text-jcn-ice/80">
                  {formatCurrency(totalAlocado)} de {formatCurrency(drawAmount)} ({percentRecebido.toFixed(0)}%)
                </span>
              </div>
              {/* Barra de progresso */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    percentRecebido >= 100
                      ? "bg-emerald-400"
                      : "bg-jcn-gold-400",
                  )}
                  style={{ width: `${percentRecebido}%` }}
                />
              </div>
              <ul className="space-y-0.5 pt-1">
                {batchGroups.map((b, i) => (
                  <li
                    key={b.batchId ?? `legacy-${i}`}
                    className="flex items-center justify-between gap-2 text-[11px] text-jcn-ice/70"
                  >
                    <span className="truncate">
                      <span className="font-bold text-jcn-ice">
                        Requerimento {i + 1}
                      </span>
                      {" · "}
                      {b.date}
                      {b.description && (
                        <span className="ml-1 text-jcn-ice/45">
                          · {b.description}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-black text-jcn-gold-300">
                      {formatCurrency(b.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 5 contas */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-jcn-gold-300" />
            </div>
          ) : (
            <div className="grid gap-2">
              {sortedItems.map((it) => {
                const meta = CONTA_META[it.conta_tipo as FlipContaTipo];
                const alocado = Number(it.amount);
                const gasto = Number(it.spent_amount ?? 0);
                const saldo = alocado - gasto;
                return (
                  <div
                    key={it.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2",
                      meta.bg,
                      meta.border,
                    )}
                  >
                    <span className="text-base">{meta.icon}</span>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-xs font-black uppercase tracking-wider",
                          meta.color,
                        )}
                      >
                        {meta.label}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-jcn-ice/55">
                        <span>Alocado {formatCurrency(alocado)}</span>
                        <span>·</span>
                        <span>Gasto {formatCurrency(gasto)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase text-jcn-ice/45">
                        Em caixa
                      </p>
                      <p
                        className={cn(
                          "text-sm font-black",
                          saldo > 0
                            ? "text-emerald-300"
                            : saldo < 0
                              ? "text-rose-300"
                              : "text-jcn-ice/55",
                        )}
                      >
                        {formatCurrency(saldo)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailConta(it.conta_tipo as FlipContaTipo)}
                      className="h-8 border-white/[0.12] bg-white/[0.04] text-jcn-ice/70 hover:bg-white/[0.08] hover:text-jcn-gold-300"
                      title="Ver histórico (quanto, pra quem, quando)"
                    >
                      <Eye className="h-3 w-3" />
                      Ver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setExpenseConta(it.conta_tipo as FlipContaTipo)}
                      className="h-8 border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                    >
                      <Minus className="h-3 w-3" />
                      Gasto
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {detailConta && (
        <ContaDetailDialog
          item={sortedItems.find((i) => i.conta_tipo === detailConta)!}
          open={!!detailConta}
          onClose={() => setDetailConta(null)}
          onChanged={() => void reload()}
        />
      )}

      {splitOpen && (
        <SplitDialog
          drawId={drawId}
          drawAmount={drawAmount}
          items={sortedItems}
          open={splitOpen}
          onClose={() => setSplitOpen(false)}
          onSaved={() => {
            setSplitOpen(false);
            void reload();
          }}
        />
      )}

      {expenseConta && (
        <ExpenseDialog
          item={sortedItems.find((i) => i.conta_tipo === expenseConta)!}
          open={!!expenseConta}
          onClose={() => setExpenseConta(null)}
          onSaved={() => {
            setExpenseConta(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Dialog: dividir dinheiro recebido entre as 5 contas
// ============================================================================
function SplitDialog({
  drawId: _drawId,
  drawAmount,
  items,
  open,
  onClose,
  onSaved,
}: {
  drawId: string;
  drawAmount: number;
  items: FlipDrawItem[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [vals, setVals] = useState<Record<FlipContaTipo, string>>({
    construcao: "",
    cottage: "",
    mortgage: "",
    salario: "",
    lucro: "",
  });
  const [saving, setSaving] = useState(false);

  const total = ORDER.reduce((s, t) => s + (Number(vals[t]) || 0), 0);
  const diff = drawAmount - total;

  async function handleSave() {
    if (total <= 0) {
      toast.error("Valor total precisa ser maior que zero");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const payload = ORDER.map((tipo) => ({
      tipo,
      amount: Number(vals[tipo]) || 0,
      item: items.find((i) => i.conta_tipo === tipo),
    })).filter((p) => p.amount > 0 && p.item);

    // UUID agrupa as 5 allocations desse split = 1 "requerimento parcial" (mig 0070)
    const batchId = crypto.randomUUID();
    const rows = payload.map((p) => ({
      draw_item_id: p.item!.id,
      kind: "allocation" as const,
      amount: p.amount,
      txn_date: date,
      description: description.trim() || null,
      allocation_batch_id: batchId,
    }));

    const { error } = await supabase
      .from("flip_draw_item_transactions")
      .insert(rows);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success(
      `${formatCurrency(total)} dividido entre ${rows.length} contas`,
    );
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dividir dinheiro recebido</DialogTitle>
          <DialogDescription>
            Requerimento aprovado: <strong>{formatCurrency(drawAmount)}</strong>.
            Divida o que você recebeu entre as 5 contas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Draw 1 do permit"
                disabled={saving}
              />
            </div>
          </div>

          {ORDER.map((tipo) => {
            const meta = CONTA_META[tipo];
            return (
              <div key={tipo} className="flex items-center gap-2">
                <span className="w-6 text-base">{meta.icon}</span>
                <Label className={cn("flex-1 text-xs font-bold", meta.color)}>
                  {meta.label}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={vals[tipo]}
                  onChange={(e) =>
                    setVals({ ...vals, [tipo]: e.target.value })
                  }
                  placeholder="0"
                  className="h-8 w-32 text-right text-sm font-black"
                  disabled={saving}
                />
              </div>
            );
          })}

          <div
            className={cn(
              "flex items-center justify-between border-t border-white/[0.06] pt-2 text-xs",
              Math.abs(diff) < 0.01
                ? "text-emerald-300"
                : diff > 0
                  ? "text-amber-300"
                  : "text-rose-300",
            )}
          >
            <span>Total alocado</span>
            <span className="font-black">
              {formatCurrency(total)}
              {Math.abs(diff) >= 0.01 && (
                <span className="ml-2 text-[10px] font-normal">
                  ({diff > 0 ? `faltam ${formatCurrency(diff)}` : `${formatCurrency(-diff)} além do requerimento`})
                </span>
              )}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || total <= 0}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Alocar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Dialog: adicionar gasto numa conta
// ============================================================================
function ExpenseDialog({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: FlipDrawItem;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const meta = CONTA_META[item.conta_tipo as FlipContaTipo];
  const alocado = Number(item.amount);
  const gasto = Number(item.spent_amount ?? 0);
  const saldo = alocado - gasto;

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
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
        kind: "expense",
        amount: amt,
        txn_date: date,
        description: description.trim() || null,
      });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success(`${formatCurrency(amt)} debitado da conta ${meta.label}`);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Gasto em {meta.icon} {meta.label}
          </DialogTitle>
          <DialogDescription>
            Alocado {formatCurrency(alocado)} · Gasto {formatCurrency(gasto)} ·
            Saldo <strong>{formatCurrency(saldo)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <Label>Valor ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="font-black"
                disabled={saving}
                autoFocus
              />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: pgto permit City Somerville"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-rose-500 hover:bg-rose-600"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            Registrar gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Dialog: ver histórico completo de uma conta (allocations + expenses)
// ============================================================================
function ContaDetailDialog({
  item,
  open,
  onClose,
  onChanged,
}: {
  item: FlipDrawItem;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const meta = CONTA_META[item.conta_tipo as FlipContaTipo];
  const [txns, setTxns] = useState<FlipDrawItemTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingExpense, setAddingExpense] = useState(false);

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
    if (open) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.id]);

  const alocado = Number(item.amount);
  const gasto = Number(item.spent_amount ?? 0);
  const saldo = alocado - gasto;

  const allocations = txns.filter((t) => t.kind === "allocation");
  const expenses = txns.filter((t) => t.kind === "expense");

  async function deleteTxn(t: FlipDrawItemTransaction) {
    const label = t.kind === "allocation" ? "alocação" : "gasto";
    if (!confirm(`Apagar essa ${label} de ${formatCurrency(Number(t.amount))}?`))
      return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_draw_item_transactions")
      .delete()
      .eq("id", t.id);
    if (error) {
      toast.error("Erro ao apagar", { description: error.message });
      return;
    }
    toast.success("Apagado");
    await reload();
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", meta.color)}>
            <span className="text-xl">{meta.icon}</span>
            Conta {meta.label}
          </DialogTitle>
          <DialogDescription>
            Alocado <strong>{formatCurrency(alocado)}</strong> ·
            Gasto <strong>{formatCurrency(gasto)}</strong> ·
            Saldo em caixa{" "}
            <strong
              className={cn(
                saldo > 0
                  ? "text-emerald-300"
                  : saldo < 0
                    ? "text-rose-300"
                    : "text-jcn-ice/55",
              )}
            >
              {formatCurrency(saldo)}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gastos */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-300">
                Gastos ({expenses.length}) · {formatCurrency(gasto)}
              </h3>
              <Button
                type="button"
                size="sm"
                onClick={() => setAddingExpense(true)}
                className="h-7 bg-rose-500 text-white hover:bg-rose-600"
              >
                <Plus className="h-3 w-3" />
                Lançar gasto
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-jcn-gold-300" />
              </div>
            ) : expenses.length === 0 ? (
              <p className="py-2 text-center text-[11px] italic text-jcn-ice/40">
                Nenhum gasto nessa conta ainda
              </p>
            ) : (
              <ul className="space-y-1">
                {expenses.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-md border border-rose-400/20 bg-rose-500/[0.05] px-2.5 py-1.5 text-xs"
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {t.description ?? "Sem descrição"}
                      </p>
                      <p className="text-[10px] text-jcn-ice/45">
                        {format(
                          new Date(t.txn_date + "T12:00:00"),
                          "dd MMM yyyy",
                          { locale: ptBR },
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-rose-300">
                      −{formatCurrency(Number(t.amount))}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteTxn(t)}
                      className="shrink-0 rounded p-1 text-jcn-ice/35 hover:bg-rose-500/15 hover:text-rose-300"
                      title="Apagar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Alocações recebidas */}
          <section>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-emerald-300">
              Alocações recebidas ({allocations.length}) · {formatCurrency(alocado)}
            </h3>
            {allocations.length === 0 ? (
              <p className="py-2 text-center text-[11px] italic text-jcn-ice/40">
                Nenhuma alocação ainda — use &ldquo;Dividir recebido&rdquo; no card
                do requerimento
              </p>
            ) : (
              <ul className="space-y-1">
                {allocations.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-500/[0.05] px-2.5 py-1.5 text-xs"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {t.description ?? "Alocação do draw"}
                      </p>
                      <p className="text-[10px] text-jcn-ice/45">
                        {format(
                          new Date(t.txn_date + "T12:00:00"),
                          "dd MMM yyyy",
                          { locale: ptBR },
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-emerald-300">
                      +{formatCurrency(Number(t.amount))}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteTxn(t)}
                      className="shrink-0 rounded p-1 text-jcn-ice/35 hover:bg-rose-500/15 hover:text-rose-300"
                      title="Apagar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>

        {addingExpense && (
          <ExpenseDialog
            item={item}
            open={addingExpense}
            onClose={() => setAddingExpense(false)}
            onSaved={() => {
              setAddingExpense(false);
              void reload();
              onChanged();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
