"use client";

/**
 * Dialog unificado pra editar TODOS os inputs do P&L do flip.
 *
 * 3 abas:
 * - Aquisição/Loan: campos de flip_details
 * - Unidades: lista de flip_units com ARV/sale_price editáveis
 * - Orçamento: linhas de flip_budget_lines
 *
 * Cada aba tem seu botão Salvar próprio. Ao salvar, chama onChanged() do
 * dashboard pra recarregar tudo (P&L recalcula automático).
 */

import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  FlipBudgetLine,
  FlipDetails,
  FlipUnit,
  FlipUnitStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "details" | "units" | "budget";

type Props = {
  flipId: string;
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

function n(v: string | number | null): number {
  if (v === null || v === "" || v === undefined) return 0;
  return Number(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

const UNIT_STATUS_LABEL: Record<FlipUnitStatus, string> = {
  planned: "Planejado",
  listed: "Listado",
  under_contract: "Sob contrato",
  sold: "Vendido",
};

export function EditPnlDialog({
  flipId,
  jobId,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<FlipDetails | null>(null);
  const [units, setUnits] = useState<FlipUnit[]>([]);
  const [budgetLines, setBudgetLines] = useState<FlipBudgetLine[]>([]);

  async function reload() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const [d, u, b] = await Promise.all([
      supabase.from("flip_details").select("*").eq("id", flipId).single(),
      supabase.from("flip_units").select("*").eq("flip_id", flipId).order("display_order"),
      supabase.from("flip_budget_lines").select("*").eq("flip_id", flipId).order("display_order"),
    ]);
    setDetails((d.data ?? null) as FlipDetails | null);
    setUnits((u.data ?? []) as FlipUnit[]);
    setBudgetLines((b.data ?? []) as FlipBudgetLine[]);
    setLoading(false);
  }

  useEffect(() => {
    if (open) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flipId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-[5vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.1] bg-jcn-midnight shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <h2 className="text-lg font-black text-jcn-gold-300">
            Editar P&L do Flip
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-jcn-ice/45 hover:bg-white/[0.06] hover:text-jcn-ice"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.08] px-2">
          <TabBtn active={tab === "details"} onClick={() => setTab("details")}>
            Aquisição & Loan
          </TabBtn>
          <TabBtn active={tab === "units"} onClick={() => setTab("units")}>
            Unidades ({units.length})
          </TabBtn>
          <TabBtn active={tab === "budget"} onClick={() => setTab("budget")}>
            Orçamento ({budgetLines.length})
          </TabBtn>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-jcn-gold-300" />
            </div>
          ) : (
            <>
              {tab === "details" && details && (
                <DetailsTab
                  details={details}
                  onSaved={() => {
                    void reload();
                    onChanged();
                  }}
                />
              )}
              {tab === "units" && (
                <UnitsTab
                  flipId={flipId}
                  units={units}
                  onSaved={() => {
                    void reload();
                    onChanged();
                  }}
                />
              )}
              {tab === "budget" && (
                <BudgetTab
                  flipId={flipId}
                  budgetLines={budgetLines}
                  onSaved={() => {
                    void reload();
                    onChanged();
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Footer só com fechar (cada aba tem save próprio) */}
        <div className="border-t border-white/[0.08] p-3 text-right">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab helper
// ============================================================================

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition",
        active
          ? "border-jcn-gold-400 text-jcn-gold-200"
          : "border-transparent text-jcn-ice/45 hover:text-jcn-ice/75",
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Tab: Aquisição & Loan
// ============================================================================

function DetailsTab({
  details,
  onSaved,
}: {
  details: FlipDetails;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    purchase_price: String(details.purchase_price ?? ""),
    purchase_closed_at: details.purchase_closed_at ?? "",
    closing_costs_buy: String(details.closing_costs_buy ?? ""),
    lender_name: details.lender_name ?? "",
    loan_amount: String(details.loan_amount ?? ""),
    loan_rate: String(details.loan_rate ?? ""),
    loan_origination_fee: String(details.loan_origination_fee ?? ""),
    carrying_monthly: String(details.carrying_monthly ?? ""),
    estimated_months: String(details.estimated_months ?? "12"),
    rehab_budget: String(details.rehab_budget ?? ""),
    selling_costs: String(details.selling_costs ?? ""),
    notes: details.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_details")
      .update({
        purchase_price: n(form.purchase_price) || null,
        purchase_closed_at: form.purchase_closed_at || null,
        closing_costs_buy: n(form.closing_costs_buy),
        lender_name: form.lender_name.trim() || null,
        loan_amount: n(form.loan_amount) || null,
        loan_rate: n(form.loan_rate) || null,
        loan_origination_fee: n(form.loan_origination_fee),
        carrying_monthly: n(form.carrying_monthly),
        estimated_months: parseInt(form.estimated_months, 10) || 12,
        rehab_budget: n(form.rehab_budget) || null,
        selling_costs: n(form.selling_costs),
        notes: form.notes.trim() || null,
      })
      .eq("id", details.id);
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Aquisição/Loan atualizado");
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FF label="Compra ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.purchase_price}
            onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
          />
        </FF>
        <FF label="Data closing">
          <Input
            type="date"
            value={form.purchase_closed_at}
            onChange={(e) => setForm({ ...form, purchase_closed_at: e.target.value })}
          />
        </FF>
        <FF label="Closing costs compra ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.closing_costs_buy}
            onChange={(e) => setForm({ ...form, closing_costs_buy: e.target.value })}
          />
        </FF>
        <FF label="Lender">
          <Input
            value={form.lender_name}
            onChange={(e) => setForm({ ...form, lender_name: e.target.value })}
          />
        </FF>
        <FF label="Loan aprovado ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.loan_amount}
            onChange={(e) => setForm({ ...form, loan_amount: e.target.value })}
          />
        </FF>
        <FF label="Juros anual (%)">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.loan_rate}
            onChange={(e) => setForm({ ...form, loan_rate: e.target.value })}
          />
        </FF>
        <FF label="Origination fee ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.loan_origination_fee}
            onChange={(e) => setForm({ ...form, loan_origination_fee: e.target.value })}
          />
        </FF>
        <FF label="Carrego/mês ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.carrying_monthly}
            onChange={(e) => setForm({ ...form, carrying_monthly: e.target.value })}
          />
        </FF>
        <FF label="Meses estimados">
          <Input
            type="number"
            inputMode="numeric"
            value={form.estimated_months}
            onChange={(e) => setForm({ ...form, estimated_months: e.target.value })}
          />
        </FF>
        <FF label="Orçamento reforma total ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.rehab_budget}
            onChange={(e) => setForm({ ...form, rehab_budget: e.target.value })}
          />
        </FF>
        <FF label="Custos de venda ($)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.selling_costs}
            onChange={(e) => setForm({ ...form, selling_costs: e.target.value })}
          />
        </FF>
      </div>
      <div>
        <Label>Notas</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar aquisição/loan
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Unidades
// ============================================================================

function UnitsTab({
  flipId,
  units,
  onSaved,
}: {
  flipId: string;
  units: FlipUnit[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newArv, setNewArv] = useState("");

  async function updateUnit(
    id: string,
    patch: {
      label?: string;
      status?: FlipUnitStatus;
      arv?: number | null;
      sale_price?: number | null;
    },
  ) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_units").update(patch).eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    onSaved();
  }

  async function addUnit() {
    if (!newLabel.trim()) {
      toast.error("Nome da unidade obrigatório");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const nextOrder =
      units.length > 0 ? Math.max(...units.map((u) => u.display_order)) + 1 : 1;
    const { error } = await supabase.from("flip_units").insert({
      flip_id: flipId,
      label: newLabel.trim(),
      arv: newArv ? n(newArv) : null,
      display_order: nextOrder,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setNewLabel("");
    setNewArv("");
    onSaved();
  }

  async function deleteUnit(id: string) {
    if (!confirm("Apagar unidade?")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_units").delete().eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    onSaved();
  }

  return (
    <div className="space-y-3">
      {units.map((u) => (
        <div
          key={u.id}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <Input
              value={u.label}
              onChange={(e) => updateUnit(u.id, { label: e.target.value })}
              className="flex-1"
            />
            <select
              value={u.status}
              onChange={(e) =>
                updateUnit(u.id, { status: e.target.value as FlipUnitStatus })
              }
              className="h-10 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-sm text-jcn-ice"
            >
              {(Object.keys(UNIT_STATUS_LABEL) as FlipUnitStatus[]).map((s) => (
                <option key={s} value={s}>
                  {UNIT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => deleteUnit(u.id)}
              className="rounded p-2 text-jcn-ice/40 hover:bg-rose-500/15 hover:text-rose-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FF label="ARV projetado ($)">
              <Input
                type="number"
                inputMode="decimal"
                defaultValue={u.arv ?? ""}
                onBlur={(e) =>
                  updateUnit(u.id, { arv: e.target.value ? n(e.target.value) : null })
                }
              />
            </FF>
            <FF label="Preço venda real ($)">
              <Input
                type="number"
                inputMode="decimal"
                defaultValue={u.sale_price ?? ""}
                onBlur={(e) =>
                  updateUnit(u.id, {
                    sale_price: e.target.value ? n(e.target.value) : null,
                  })
                }
              />
            </FF>
          </div>
        </div>
      ))}

      {units.length === 0 && (
        <p className="py-4 text-center text-xs italic text-jcn-ice/40">
          Nenhuma unidade — adiciona abaixo
        </p>
      )}

      {/* Adicionar nova */}
      <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-3">
        <p className="mb-2 text-[10px] font-bold uppercase text-jcn-gold-300">
          Nova unidade
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex: Unidade 1 (2BR/1.5BA)"
          />
          <Input
            type="number"
            inputMode="decimal"
            value={newArv}
            onChange={(e) => setNewArv(e.target.value)}
            placeholder="ARV projetado ($)"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button onClick={addUnit} disabled={saving}>
            <Plus className="h-4 w-4" />
            Adicionar unidade
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-jcn-ice/40">
        ARV/preço salvam ao sair do campo. Nome/status salvam na hora.
      </p>
    </div>
  );
}

// ============================================================================
// Tab: Orçamento
// ============================================================================

function BudgetTab({
  flipId,
  budgetLines,
  onSaved,
}: {
  flipId: string;
  budgetLines: FlipBudgetLine[];
  onSaved: () => void;
}) {
  const [newCategory, setNewCategory] = useState("");
  const [newBudgeted, setNewBudgeted] = useState("");
  const [saving, setSaving] = useState(false);

  async function updateLine(
    id: string,
    patch: { category?: string; budgeted?: number },
  ) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_budget_lines")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    onSaved();
  }

  async function addLine() {
    if (!newCategory.trim()) {
      toast.error("Categoria obrigatória");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const nextOrder =
      budgetLines.length > 0
        ? Math.max(...budgetLines.map((b) => b.display_order)) + 1
        : 1;
    const { error } = await supabase.from("flip_budget_lines").insert({
      flip_id: flipId,
      category: newCategory.trim(),
      budgeted: newBudgeted ? n(newBudgeted) : 0,
      display_order: nextOrder,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setNewCategory("");
    setNewBudgeted("");
    onSaved();
  }

  async function deleteLine(id: string) {
    if (!confirm("Apagar linha do orçamento?")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_budget_lines")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    onSaved();
  }

  const totalBudget = budgetLines.reduce((s, b) => s + Number(b.budgeted), 0);

  return (
    <div className="space-y-3">
      {budgetLines.map((b) => (
        <div
          key={b.id}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              value={b.category}
              onChange={(e) => updateLine(b.id, { category: e.target.value })}
              className="flex-1"
            />
            <Input
              type="number"
              inputMode="decimal"
              defaultValue={b.budgeted}
              onBlur={(e) => updateLine(b.id, { budgeted: n(e.target.value) })}
              placeholder="Orçado ($)"
              className="w-32"
            />
            <button
              type="button"
              onClick={() => deleteLine(b.id)}
              className="rounded p-2 text-jcn-ice/40 hover:bg-rose-500/15 hover:text-rose-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {budgetLines.length === 0 && (
        <p className="py-4 text-center text-xs italic text-jcn-ice/40">
          Nenhuma linha de orçamento — adiciona abaixo
        </p>
      )}

      <div className="flex justify-between rounded-xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 p-3">
        <span className="text-xs font-bold uppercase text-jcn-gold-200">
          Total orçado
        </span>
        <span className="font-black text-jcn-gold-300">
          {formatCurrency(totalBudget)}
        </span>
      </div>

      {/* Adicionar nova */}
      <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-3">
        <p className="mb-2 text-[10px] font-bold uppercase text-jcn-gold-300">
          Nova linha
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Ex: Framing / estrutura"
          />
          <Input
            type="number"
            inputMode="decimal"
            value={newBudgeted}
            onChange={(e) => setNewBudgeted(e.target.value)}
            placeholder="Orçado ($)"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button onClick={addLine} disabled={saving}>
            <Plus className="h-4 w-4" />
            Adicionar linha
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-jcn-ice/40">
        Categoria/orçado salvam ao sair do campo.
      </p>
    </div>
  );
}

// FF: Field Frame (Label + child)
function FF({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-jcn-ice/55">
        {label}
      </Label>
      {children}
    </div>
  );
}

// unused import placeholder
void formatCurrency;
