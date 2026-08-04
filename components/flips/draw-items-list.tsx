"use client";

/**
 * Lista + adiciona/apaga line items dentro de um draw (mig 0058).
 *
 * Usado inline dentro da DrawsSection. Ao expandir, mostra breakdown
 * do requerimento com categorias vindas do orçamento (flip_budget_lines).
 */

import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

import { resolveCategoryColor } from "@/lib/category-colors";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { FlipBudgetLine, FlipDrawItem } from "@/lib/types";
import { cn } from "@/lib/utils";

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
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-[9px] uppercase text-jcn-ice/40">
                        Categoria (click pra editar)
                      </p>
                      <Input
                        defaultValue={it.category}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== it.category) {
                            updateItem(it.id, { category: v });
                          }
                        }}
                        className="h-7 w-full border-white/[0.15] bg-white/[0.05] px-2 py-0 font-semibold text-jcn-ice"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteItem(it.id)}
                      className="mt-4 shrink-0 rounded p-1 text-jcn-ice/35 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] uppercase text-jcn-ice/40">
                        Planejado ($)
                      </p>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        defaultValue={planned || ""}
                        onBlur={(e) => {
                          const num = Number(e.target.value);
                          if (!Number.isNaN(num) && num > 0 && num !== planned) {
                            updateItem(it.id, { amount: num });
                          }
                        }}
                        className="h-7 border-white/[0.15] bg-white/[0.05] px-2 py-0 text-[12px] font-black text-jcn-gold-300"
                      />
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-jcn-ice/40">
                        Gasto ($)
                      </p>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        defaultValue={spent || ""}
                        onBlur={(e) => updateSpent(it.id, e.target.value)}
                        placeholder="0"
                        className="h-7 border-white/[0.15] bg-white/[0.05] px-2 py-0 text-[12px] font-black text-jcn-ice"
                      />
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
                  <div className="mt-2">
                    <p className="text-[9px] uppercase text-jcn-ice/40">
                      Notas
                    </p>
                    <Input
                      defaultValue={it.notes ?? ""}
                      placeholder="Ex: pago via cheque 1234"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if ((v || null) !== (it.notes ?? null)) {
                          updateItem(it.id, { notes: v || null });
                        }
                      }}
                      className="h-7 border-white/[0.15] bg-white/[0.05] px-2 py-0 text-[11px] text-jcn-ice/85"
                    />
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
    </div>
  );
}
