"use client";

/**
 * Lista + adiciona/apaga line items dentro de um draw (mig 0058).
 *
 * Usado inline dentro da DrawsSection. Ao expandir, mostra breakdown
 * do requerimento com categorias vindas do orçamento (flip_budget_lines).
 */

import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";

import {
  COLOR_CLASSES,
  COLOR_LABEL,
  COLOR_TOKENS,
  resolveCategoryColor,
  type ColorToken,
} from "@/lib/category-colors";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { FlipBudgetLine, FlipDrawItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DrawItemTransactions } from "./draw-item-transactions";

type Props = {
  drawId: string;
  drawAmount: number;
  budgetLines: FlipBudgetLine[];
  defaultOpen?: boolean;
};

export function DrawItemsList({
  drawId,
  drawAmount,
  budgetLines,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<FlipDrawItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [budgetLineId, setBudgetLineId] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<FlipDrawItem | null>(null);
  const [txnItem, setTxnItem] = useState<FlipDrawItem | null>(null);

  async function reload() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("flip_draw_items")
      .select("*")
      .eq("draw_id", drawId)
      .order("display_order");
    setItems((data ?? []) as FlipDrawItem[]);
    setLoading(false);
  }

  useEffect(() => {
    if (open) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drawId]);

  const totalPlanned = items.reduce((s, i) => s + Number(i.amount), 0);
  const totalSpent = items.reduce((s, i) => s + Number(i.spent_amount ?? 0), 0);
  const diffPlannedVsDraw = drawAmount - totalPlanned;
  const drawRemaining = drawAmount - totalSpent;

  async function updateSpent(id: string, value: string) {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_draw_items")
      .update({ spent_amount: num })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar gasto", { description: error.message });
      return;
    }
    await reload();
  }

  async function updateItem(
    id: string,
    patch: { category?: string; amount?: number; notes?: string | null },
  ) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_draw_items")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    await reload();
  }

  async function moveItem(id: string, direction: "up" | "down") {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const a = items[idx]!;
    const b = items[swapIdx]!;
    const supabase = createSupabaseBrowserClient();
    // Swap dos display_orders — 2 updates paralelos
    const [r1, r2] = await Promise.all([
      supabase
        .from("flip_draw_items")
        .update({ display_order: b.display_order })
        .eq("id", a.id),
      supabase
        .from("flip_draw_items")
        .update({ display_order: a.display_order })
        .eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      toast.error("Erro ao mover", {
        description: r1.error?.message ?? r2.error?.message,
      });
      return;
    }
    await reload();
  }

  async function addItem() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Valor inválido");
      return;
    }
    let category = "";
    if (budgetLineId && budgetLineId !== "__custom__") {
      const line = budgetLines.find((b) => b.id === budgetLineId);
      if (!line) {
        toast.error("Categoria não encontrada");
        return;
      }
      category = line.category;
    } else {
      if (!customCategory.trim()) {
        toast.error("Descreva a categoria");
        return;
      }
      category = customCategory.trim();
    }

    setSaving(true);
    const nextOrder =
      items.length > 0
        ? Math.max(...items.map((i) => i.display_order)) + 1
        : 1;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_draw_items").insert({
      draw_id: drawId,
      budget_line_id: budgetLineId === "__custom__" ? null : budgetLineId || null,
      category,
      amount: amt,
      notes: notes.trim() || null,
      display_order: nextOrder,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setBudgetLineId("");
    setCustomCategory("");
    setAmount("");
    setNotes("");
    setAdding(false);
    await reload();
  }

  async function deleteItem(id: string) {
    if (!confirm("Apagar linha?")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_draw_items")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await reload();
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-jcn-ice/50 hover:bg-white/[0.04] hover:text-jcn-gold-300"
      >
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-0", !open && "-rotate-90")}
        />
        Breakdown ({items.length})
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-jcn-gold-300" />
            </div>
          ) : items.length === 0 && !adding ? (
            <p className="py-1 text-center text-[10px] italic text-jcn-ice/40">
              Sem linhas cadastradas
            </p>
          ) : (
            items.map((it) => {
              const planned = Number(it.amount);
              const spent = Number(it.spent_amount ?? 0);
              const remaining = planned - spent;
              const bl = budgetLines.find((b) => b.id === it.budget_line_id);
              const tone = resolveCategoryColor({
                manualColor: bl?.color ?? null,
                category: it.category,
              });
              return (
                <div
                  key={it.id}
                  className={cn(
                    "rounded-md border p-2 text-[11px]",
                    tone.bg,
                    tone.border,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold text-jcn-ice">
                      {it.category}
                      {it.notes && (
                        <span className="ml-1 text-[10px] font-normal text-jcn-ice/50">
                          — {it.notes}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTxnItem(it)}
                      className="shrink-0 rounded p-1 text-emerald-300 hover:bg-emerald-500/15"
                      title="Saques / despesas / juros"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingItem(it)}
                      className="shrink-0 rounded p-1 text-jcn-gold-300 hover:bg-jcn-gold-500/15"
                      title="Editar linha"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(it.id)}
                      className="shrink-0 rounded p-1 text-jcn-ice/35 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] uppercase text-jcn-ice/40">
                        Planejado
                      </p>
                      <p className="font-black text-jcn-gold-300">
                        {formatCurrency(planned)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-jcn-ice/40">
                        Gasto
                      </p>
                      <p className="font-black text-jcn-ice">
                        {formatCurrency(spent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-jcn-ice/40">
                        {remaining >= 0 ? "Sobrou" : "Excedeu"}
                      </p>
                      <p
                        className={cn(
                          "font-black",
                          Math.abs(remaining) < 0.01
                            ? "text-jcn-ice/55"
                            : remaining > 0
                              ? "text-emerald-300"
                              : "text-rose-300",
                        )}
                      >
                        {formatCurrency(Math.abs(remaining))}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {items.length > 0 && (
            <div className="space-y-1 border-t border-white/[0.05] pt-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-jcn-ice/55">Planejado (total das linhas)</span>
                <span
                  className={cn(
                    "font-black",
                    Math.abs(diffPlannedVsDraw) < 0.01
                      ? "text-emerald-300"
                      : diffPlannedVsDraw > 0
                        ? "text-amber-300"
                        : "text-rose-300",
                  )}
                >
                  {formatCurrency(totalPlanned)}
                  {Math.abs(diffPlannedVsDraw) >= 0.01 && (
                    <span className="ml-1 text-[9px] font-normal">
                      ({diffPlannedVsDraw > 0 ? "falta " : "excesso "}
                      {formatCurrency(Math.abs(diffPlannedVsDraw))})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-jcn-ice/55">Gasto (real)</span>
                <span className="font-black text-jcn-ice">
                  {formatCurrency(totalSpent)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.05] pt-1">
                <span className="font-bold text-jcn-ice/70">Sobra do draw</span>
                <span
                  className={cn(
                    "font-black",
                    drawRemaining > 0
                      ? "text-emerald-300"
                      : drawRemaining < 0
                        ? "text-rose-300"
                        : "text-jcn-ice/55",
                  )}
                >
                  {formatCurrency(drawRemaining)}
                </span>
              </div>
            </div>
          )}

          {adding ? (
            <div className="space-y-2 rounded-md border border-jcn-gold-400/20 bg-jcn-gold-500/5 p-2">
              <div>
                <Label className="text-[10px] uppercase">Categoria</Label>
                <select
                  value={budgetLineId}
                  onChange={(e) => setBudgetLineId(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-xs text-jcn-ice"
                >
                  <option value="">Selecione...</option>
                  {budgetLines.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.category} ({formatCurrency(Number(b.budgeted))})
                    </option>
                  ))}
                  <option value="__custom__">➕ Outra (livre)</option>
                </select>
              </div>
              {budgetLineId === "__custom__" && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Nome da categoria"
                  className="h-8 text-xs"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Valor ($)"
                  className="h-8 text-xs"
                  autoFocus
                />
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas (opcional)"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={addItem}
                  disabled={saving}
                  className="h-8 flex-1"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Adicionar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAdding(false)}
                  className="h-8"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-white/[0.1] py-1.5 text-[10px] text-jcn-ice/50 hover:bg-white/[0.03] hover:text-jcn-gold-300"
            >
              <Plus className="h-3 w-3" />
              Adicionar linha
            </button>
          )}
        </div>
      )}

      {editingItem && (
        <EditItemDialog
          item={editingItem}
          budgetLines={budgetLines}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            void reload();
          }}
        />
      )}

      {txnItem && (
        <DrawItemTransactions
          item={txnItem}
          onClose={() => setTxnItem(null)}
          onSaved={() => {
            void reload();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// EditItemDialog — edita categoria/valor/gasto/notas/cor num modal só
// ============================================================================

function EditItemDialog({
  item,
  budgetLines,
  onClose,
  onSaved,
}: {
  item: FlipDrawItem;
  budgetLines: FlipBudgetLine[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(item.category);
  const [amount, setAmount] = useState(String(item.amount));
  const [spent, setSpent] = useState(String(item.spent_amount ?? 0));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const bl = budgetLines.find((b) => b.id === item.budget_line_id);
  const [color, setColor] = useState<string | null>(bl?.color ?? null);

  async function save() {
    const amt = Number(amount);
    const spnt = Number(spent);
    if (!category.trim()) {
      toast.error("Categoria obrigatória");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Valor planejado inválido");
      return;
    }
    if (Number.isNaN(spnt) || spnt < 0) {
      toast.error("Valor gasto inválido");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Atualiza a linha do draw
    const { error: itemErr } = await supabase
      .from("flip_draw_items")
      .update({
        category: category.trim(),
        amount: amt,
        spent_amount: spnt,
        notes: notes.trim() || null,
      })
      .eq("id", item.id);

    if (itemErr) {
      setSaving(false);
      toast.error("Erro ao salvar", { description: itemErr.message });
      return;
    }

    // 2) Se tem budget_line linkada, atualiza cor lá (afeta outras linhas
    //    da mesma categoria em outros draws)
    if (item.budget_line_id && color !== (bl?.color ?? null)) {
      await supabase
        .from("flip_budget_lines")
        .update({ color })
        .eq("id", item.budget_line_id);
    }

    setSaving(false);
    toast.success("Linha atualizada");
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-jcn-midnight shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <h2 className="text-lg font-black text-jcn-gold-300">
            Editar linha
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-jcn-ice/45 hover:bg-white/[0.06] hover:text-jcn-ice"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <Label className="text-[10px] uppercase text-jcn-ice/55">
              Categoria
            </Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-white/[0.15] bg-white/[0.05]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase text-jcn-ice/55">
                Planejado ($)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-white/[0.15] bg-white/[0.05] font-black text-jcn-gold-300"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-jcn-ice/55">
                Gasto ($)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={spent}
                onChange={(e) => setSpent(e.target.value)}
                placeholder="0"
                className="border-white/[0.15] bg-white/[0.05] font-black text-jcn-ice"
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase text-jcn-ice/55">
              Notas
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: pago via cheque 1234"
              className="border-white/[0.15] bg-white/[0.05]"
            />
          </div>

          {item.budget_line_id ? (
            <div>
              <Label className="text-[10px] uppercase text-jcn-ice/55">
                Cor da categoria
              </Label>
              <p className="mb-1 text-[10px] text-jcn-ice/45">
                Muda a cor em TODAS as linhas dessa categoria (em outros draws
                também).
              </p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  title="Auto (por keyword)"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold",
                    color === null
                      ? "border-jcn-gold-400 text-jcn-gold-300 ring-2 ring-jcn-gold-400/50"
                      : "border-white/[0.1] text-jcn-ice/40 hover:border-white/30",
                  )}
                >
                  A
                </button>
                {COLOR_TOKENS.map((tok) => {
                  const classes = COLOR_CLASSES[tok];
                  const active = color === tok;
                  return (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => setColor(tok as ColorToken)}
                      title={COLOR_LABEL[tok]}
                      className={cn(
                        "h-7 w-7 rounded-full border transition",
                        classes.swatch,
                        active
                          ? "border-white ring-2 ring-white/60"
                          : "border-white/20 hover:scale-110",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[10px] italic text-jcn-ice/45">
              Essa linha é categoria livre (não veio do orçamento). Pra usar
              cor manual, crie a categoria no orçamento primeiro.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.08] p-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="bg-jcn-gold-500 text-jcn-midnight hover:bg-jcn-gold-400">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
