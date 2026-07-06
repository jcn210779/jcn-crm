"use client";

import {
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  Home,
  Loader2,
  Plus,
  Save,
  TrendingDown,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlipPlanning } from "@/components/flips/flip-planning";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  FlipBudgetLine,
  FlipBudgetVsActual,
  FlipCashSummary,
  FlipDetails,
  FlipDraw,
  FlipDrawSource,
  FlipPnL,
  FlipUnit,
  FlipUnitStatus,
} from "@/lib/types";

type Props = {
  jobId: string;
};

const UNIT_STATUS_LABEL: Record<FlipUnitStatus, string> = {
  planned: "Planejado",
  listed: "Listado",
  under_contract: "Sob contrato",
  sold: "Vendido",
};

const UNIT_STATUS_TONE: Record<FlipUnitStatus, string> = {
  planned: "border-white/[0.1] bg-white/[0.04] text-jcn-ice/65",
  listed: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  under_contract: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  sold: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
};

const DRAW_SOURCE_LABEL: Record<FlipDrawSource, string> = {
  owner_capital: "Aporte próprio",
  bank_draw: "Draw banco",
  unit_sale: "Venda unidade",
  other: "Outro",
};

function n(v: string | number | null): number {
  if (v === null || v === "" || v === undefined) return 0;
  return Number(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

export function FlipDashboard({ jobId }: Props) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<FlipDetails | null>(null);
  const [units, setUnits] = useState<FlipUnit[]>([]);
  const [draws, setDraws] = useState<FlipDraw[]>([]);
  const [budgetLines, setBudgetLines] = useState<FlipBudgetLine[]>([]);
  const [pnl, setPnl] = useState<FlipPnL | null>(null);
  const [cash, setCash] = useState<FlipCashSummary | null>(null);
  const [budgetActual, setBudgetActual] = useState<FlipBudgetVsActual[]>([]);

  async function reload() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const [d, u, dr, bl, p, c, ba] = await Promise.all([
      supabase.from("flip_details").select("*").eq("job_id", jobId).maybeSingle(),
      supabase
        .from("flip_units")
        .select("*")
        .order("display_order", { ascending: true }),
      supabase
        .from("flip_draws")
        .select("*")
        .order("draw_date", { ascending: false }),
      supabase
        .from("flip_budget_lines")
        .select("*")
        .order("display_order", { ascending: true }),
      supabase.from("v_flip_pnl").select("*").eq("job_id", jobId).maybeSingle(),
      supabase
        .from("v_flip_cash_summary")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle(),
      supabase.from("v_flip_budget_vs_actual").select("*").eq("job_id", jobId),
    ]);

    const flipId = (d.data as FlipDetails | null)?.id;
    setDetails((d.data as FlipDetails) ?? null);
    setUnits(((u.data ?? []) as FlipUnit[]).filter((x) => x.flip_id === flipId));
    setDraws(((dr.data ?? []) as FlipDraw[]).filter((x) => x.flip_id === flipId));
    setBudgetLines(
      ((bl.data ?? []) as FlipBudgetLine[]).filter((x) => x.flip_id === flipId),
    );
    setPnl((p.data as FlipPnL) ?? null);
    setCash((c.data as FlipCashSummary) ?? null);
    setBudgetActual((ba.data ?? []) as FlipBudgetVsActual[]);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-jcn-gold-300" />
      </div>
    );
  }

  if (!details) {
    return (
      <Card title="Flip">
        <p className="text-sm text-jcn-ice/55">
          flip_details ainda não existe. Algo deu errado na criação.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PnLCard pnl={pnl} cash={cash} />
      <DetailsCard details={details} onChanged={reload} />
      <FlipPlanning flipId={details.id} />
      <UnitsSection
        flipId={details.id}
        units={units}
        onChanged={reload}
      />
      <DrawsSection
        flipId={details.id}
        units={units}
        draws={draws}
        loanApproved={Number(details.loan_amount ?? 0)}
        bankDrawn={Number(cash?.bank_drawn ?? 0)}
        onChanged={reload}
      />
      <BudgetSection
        flipId={details.id}
        budgetLines={budgetLines}
        budgetActual={budgetActual}
        onChanged={reload}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// P&L Card
// ────────────────────────────────────────────────────────────────────────
function PnLCard({
  pnl,
  cash,
}: {
  pnl: FlipPnL | null;
  cash: FlipCashSummary | null;
}) {
  const profitProj = Number(pnl?.profit_projected ?? 0);
  const profitActual = Number(pnl?.profit_actual ?? 0);
  const arv = Number(pnl?.arv_total ?? 0);
  const allInProj = Number(pnl?.all_in_projected ?? 0);
  const allInActual = Number(pnl?.all_in_actual ?? 0);

  return (
    <section className="rounded-3xl border border-jcn-gold-400/30 bg-gradient-to-br from-jcn-gold-500/[0.08] to-white/[0.02] p-5 backdrop-blur-xl md:p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-jcn-gold-300" />
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-jcn-gold-300">
          P&amp;L do Flip
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock
          label="ARV total"
          value={formatCurrency(arv)}
          sub={`${pnl?.units_count ?? 0} unidades`}
        />
        <StatBlock
          label="All-in projetado"
          value={formatCurrency(allInProj)}
          sub={`Real: ${formatCurrency(allInActual)}`}
        />
        <StatBlock
          label="Lucro projetado"
          value={formatCurrency(profitProj)}
          highlight={profitProj >= 0 ? "emerald" : "rose"}
        />
        <StatBlock
          label="Lucro realizado"
          value={formatCurrency(profitActual)}
          sub={`${pnl?.units_sold ?? 0}/${pnl?.units_count ?? 0} vendidas`}
          highlight={profitActual >= 0 ? "emerald" : "rose"}
        />
      </div>

      {cash && (
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[0.08] pt-4 md:grid-cols-4">
          <StatBlock
            label="Loan aprovado"
            value={formatCurrency(Number(cash.loan_approved))}
            small
          />
          <StatBlock
            label="Banco sacado"
            value={formatCurrency(Number(cash.bank_drawn))}
            small
          />
          <StatBlock
            label="Loan restante"
            value={formatCurrency(Number(cash.loan_remaining))}
            highlight={Number(cash.loan_remaining) > 0 ? "emerald" : "rose"}
            small
          />
          <StatBlock
            label="Aporte próprio"
            value={formatCurrency(Number(cash.owner_capital_in))}
            small
          />
        </div>
      )}
    </section>
  );
}

function StatBlock({
  label,
  value,
  sub,
  highlight,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "emerald" | "rose";
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/45">
        {label}
      </p>
      <p
        className={`mt-1 font-black ${small ? "text-sm" : "text-lg md:text-xl"} ${
          highlight === "emerald"
            ? "text-emerald-300"
            : highlight === "rose"
              ? "text-rose-300"
              : "text-jcn-ice"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-jcn-ice/45 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Details Card (purchase + loan + carrying + selling)
// ────────────────────────────────────────────────────────────────────────
function DetailsCard({
  details,
  onChanged,
}: {
  details: FlipDetails;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function handleSave() {
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
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success("Detalhes atualizados");
    setEditing(false);
    onChanged();
  }

  if (!editing) {
    return (
      <Card
        title="Aquisição & Loan"
        right={
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Compra" value={formatCurrency(Number(details.purchase_price ?? 0))} />
          <Field label="Closing" value={formatCurrency(Number(details.closing_costs_buy ?? 0))} />
          <Field label="Loan aprovado" value={formatCurrency(Number(details.loan_amount ?? 0))} />
          <Field
            label="Juros"
            value={details.loan_rate ? `${Number(details.loan_rate).toFixed(2)}%` : "—"}
          />
          <Field
            label="Carrego/mês"
            value={formatCurrency(Number(details.carrying_monthly ?? 0))}
          />
          <Field label="Meses" value={String(details.estimated_months ?? "—")} />
          <Field label="Orçamento reforma" value={formatCurrency(Number(details.rehab_budget ?? 0))} />
          <Field label="Custos venda" value={formatCurrency(Number(details.selling_costs ?? 0))} />
        </div>
        {details.lender_name && (
          <p className="mt-3 text-xs text-jcn-ice/55">
            Lender: <span className="font-bold text-jcn-ice/85">{details.lender_name}</span>
          </p>
        )}
        {details.notes && (
          <p className="mt-2 text-xs italic text-jcn-ice/45">{details.notes}</p>
        )}
      </Card>
    );
  }

  return (
    <Card title="Editando: Aquisição & Loan">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Compra ($)">
          <Input value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="1200000" />
        </FormField>
        <FormField label="Closing data">
          <Input type="date" value={form.purchase_closed_at} onChange={(e) => setForm({ ...form, purchase_closed_at: e.target.value })} />
        </FormField>
        <FormField label="Closing costs ($)">
          <Input value={form.closing_costs_buy} onChange={(e) => setForm({ ...form, closing_costs_buy: e.target.value })} />
        </FormField>
        <FormField label="Lender">
          <Input value={form.lender_name} onChange={(e) => setForm({ ...form, lender_name: e.target.value })} placeholder="Bank X" />
        </FormField>
        <FormField label="Loan ($)">
          <Input value={form.loan_amount} onChange={(e) => setForm({ ...form, loan_amount: e.target.value })} placeholder="900000" />
        </FormField>
        <FormField label="Juros (%)">
          <Input value={form.loan_rate} onChange={(e) => setForm({ ...form, loan_rate: e.target.value })} placeholder="10.5" />
        </FormField>
        <FormField label="Origination fee ($)">
          <Input value={form.loan_origination_fee} onChange={(e) => setForm({ ...form, loan_origination_fee: e.target.value })} />
        </FormField>
        <FormField label="Carrego/mês ($)">
          <Input value={form.carrying_monthly} onChange={(e) => setForm({ ...form, carrying_monthly: e.target.value })} placeholder="10000" />
        </FormField>
        <FormField label="Meses estimados">
          <Input value={form.estimated_months} onChange={(e) => setForm({ ...form, estimated_months: e.target.value })} placeholder="12" />
        </FormField>
        <FormField label="Orçamento reforma ($)">
          <Input value={form.rehab_budget} onChange={(e) => setForm({ ...form, rehab_budget: e.target.value })} placeholder="1350000" />
        </FormField>
        <FormField label="Custos de venda ($)">
          <Input value={form.selling_costs} onChange={(e) => setForm({ ...form, selling_costs: e.target.value })} placeholder="240000" />
        </FormField>
      </div>
      <div className="mt-3">
        <FormField label="Notas">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </FormField>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Units, Draws, Budget — listas com add/delete
// ────────────────────────────────────────────────────────────────────────

function UnitsSection({
  flipId,
  units,
  onChanged,
}: {
  flipId: string;
  units: FlipUnit[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [arv, setArv] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!label.trim()) {
      toast.error("Nome da unidade obrigatório");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_units").insert({
      flip_id: flipId,
      label: label.trim(),
      arv: n(arv) || null,
      status: "planned",
      display_order: units.length,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setLabel("");
    setArv("");
    setAdding(false);
    onChanged();
  }

  async function updateStatus(unit: FlipUnit, status: FlipUnitStatus) {
    const supabase = createSupabaseBrowserClient();
    const today = new Date().toISOString().slice(0, 10);
    const patch: Partial<FlipUnit> = { status };
    if (status === "listed" && !unit.listed_at) patch.listed_at = today;
    if (status === "under_contract" && !unit.under_contract_at) patch.under_contract_at = today;
    if (status === "sold" && !unit.sold_at) patch.sold_at = today;
    const { error } = await supabase
      .from("flip_units")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", unit.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    onChanged();
  }

  async function updateSale(unitId: string, price: string) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_units")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ sale_price: n(price) || null } as any)
      .eq("id", unitId);
    if (error) toast.error(`Erro: ${error.message}`);
    onChanged();
  }

  async function del(id: string) {
    if (!confirm("Apagar unidade?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.from("flip_units").delete().eq("id", id);
    onChanged();
  }

  return (
    <Card
      title="Unidades vendáveis"
      right={
        !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        )
      }
    >
      {units.length === 0 && !adding && (
        <p className="text-sm text-jcn-ice/55">Nenhuma unidade ainda. Adicione (ex: Unit 66, Cottage, Piso novo).</p>
      )}
      <div className="space-y-3">
        {units.map((u) => (
          <div key={u.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-jcn-gold-300" />
                <span className="font-bold text-jcn-ice">{u.label}</span>
                <Badge variant="outline" className={`${UNIT_STATUS_TONE[u.status]} text-[10px] font-bold`}>{UNIT_STATUS_LABEL[u.status]}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => del(u.id)} className="h-7 w-7 p-0 text-rose-300 hover:bg-rose-500/15">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-jcn-ice/45">ARV: </span>
                <span className="font-bold text-jcn-ice">{formatCurrency(Number(u.arv ?? 0))}</span>
              </div>
              <div>
                <span className="text-jcn-ice/45">Venda: </span>
                <Input
                  className="h-6 inline-block w-28 text-xs"
                  defaultValue={u.sale_price ?? ""}
                  onBlur={(e) => updateSale(u.id, e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="text-right">
                <select
                  value={u.status}
                  onChange={(e) => updateStatus(u, e.target.value as FlipUnitStatus)}
                  className="h-6 rounded border border-white/[0.1] bg-white/[0.04] px-1 text-xs"
                >
                  <option value="planned">Planejado</option>
                  <option value="listed">Listado</option>
                  <option value="under_contract">Sob contrato</option>
                  <option value="sold">Vendido</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        {adding && (
          <div className="rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/[0.05] p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nome (ex: Unit 66)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input placeholder="ARV $" value={arv} onChange={(e) => setArv(e.target.value)} />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
              <Button size="sm" onClick={add} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function DrawsSection({
  flipId,
  units,
  draws,
  loanApproved,
  bankDrawn,
  onChanged,
}: {
  flipId: string;
  units: FlipUnit[];
  draws: FlipDraw[];
  loanApproved: number;
  bankDrawn: number;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    draw_date: new Date().toISOString().slice(0, 10),
    source: "bank_draw" as FlipDrawSource,
    milestone: "",
    amount: "",
    unit_id: "",
  });

  async function add() {
    const amt = n(form.amount);
    if (amt <= 0) {
      toast.error("Valor obrigatório");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_draws").insert({
      flip_id: flipId,
      draw_date: form.draw_date,
      source: form.source,
      milestone: form.milestone.trim() || null,
      amount: amt,
      unit_id: form.unit_id || null,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setForm({
      draw_date: new Date().toISOString().slice(0, 10),
      source: "bank_draw",
      milestone: "",
      amount: "",
      unit_id: "",
    });
    setAdding(false);
    onChanged();
  }

  async function del(id: string) {
    if (!confirm("Apagar draw?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.from("flip_draws").delete().eq("id", id);
    onChanged();
  }

  const remaining = loanApproved - bankDrawn;

  return (
    <Card
      title="Caixa & Draws"
      right={
        !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Lançar
          </Button>
        )
      }
    >
      {loanApproved > 0 && (
        <div className="mb-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-jcn-ice/55">Loan aprovado</span>
            <span className="font-bold text-jcn-ice">{formatCurrency(loanApproved)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-jcn-ice/55">Sacado</span>
            <span className="font-bold text-amber-300">{formatCurrency(bankDrawn)}</span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/[0.05]">
            <span className="text-jcn-ice/55">Disponível</span>
            <span className={`font-black ${remaining > 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      )}
      {draws.length === 0 && !adding && (
        <p className="text-sm text-jcn-ice/55">Nenhum draw lançado.</p>
      )}
      <div className="space-y-2">
        {draws.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CreditCard className="h-3.5 w-3.5 text-jcn-ice/45 shrink-0" />
              <span className="text-xs text-jcn-ice/65 shrink-0">{d.draw_date}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {DRAW_SOURCE_LABEL[d.source]}
              </Badge>
              {d.milestone && <span className="text-xs text-jcn-ice/75 truncate">{d.milestone}</span>}
            </div>
            <span className="font-bold text-jcn-gold-300">{formatCurrency(Number(d.amount))}</span>
            <Button variant="ghost" size="sm" onClick={() => del(d.id)} className="h-7 w-7 p-0 text-rose-300 hover:bg-rose-500/15">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {adding && (
          <div className="rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/[0.05] p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.draw_date} onChange={(e) => setForm({ ...form, draw_date: e.target.value })} />
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as FlipDrawSource })} className="h-10 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm">
                <option value="bank_draw">Draw banco</option>
                <option value="owner_capital">Aporte próprio</option>
                <option value="unit_sale">Venda unidade</option>
                <option value="other">Outro</option>
              </select>
              <Input placeholder="Valor $" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <Input placeholder="Milestone (ex: framing 100%)" value={form.milestone} onChange={(e) => setForm({ ...form, milestone: e.target.value })} />
              {form.source === "unit_sale" && units.length > 0 && (
                <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="col-span-2 h-10 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm">
                  <option value="">Qual unidade vendeu?</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              )}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
              <Button size="sm" onClick={add} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function BudgetSection({
  flipId,
  budgetLines,
  budgetActual,
  onChanged,
}: {
  flipId: string;
  budgetLines: FlipBudgetLine[];
  budgetActual: FlipBudgetVsActual[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "", budgeted: "", committed: "" });

  const byId = new Map(budgetActual.map((b) => [b.budget_line_id, b]));
  const totalBudgeted = budgetLines.reduce((s, b) => s + Number(b.budgeted), 0);
  const totalCommitted = budgetLines.reduce((s, b) => s + Number(b.committed), 0);
  const totalActual = budgetActual.reduce((s, b) => s + Number(b.actual_spent), 0);

  async function add() {
    if (!form.category.trim()) {
      toast.error("Categoria obrigatória");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_budget_lines").insert({
      flip_id: flipId,
      category: form.category.trim(),
      budgeted: n(form.budgeted),
      committed: n(form.committed),
      display_order: budgetLines.length,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setForm({ category: "", budgeted: "", committed: "" });
    setAdding(false);
    onChanged();
  }

  async function del(id: string) {
    if (!confirm("Apagar linha?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.from("flip_budget_lines").delete().eq("id", id);
    onChanged();
  }

  return (
    <Card
      title="Orçamento × Real"
      right={
        !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Linha
          </Button>
        )
      }
    >
      {budgetLines.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs">
          <Field label="Orçado total" value={formatCurrency(totalBudgeted)} />
          <Field label="Contratado total" value={formatCurrency(totalCommitted)} />
          <Field label="Gasto real" value={formatCurrency(totalActual)} />
        </div>
      )}

      {budgetLines.length === 0 && !adding && (
        <p className="text-sm text-jcn-ice/55">Nenhuma linha. Sugiro começar com: Demolição, Framing, Elétrica, Encanamento, Cozinha, Banheiros, Acabamento.</p>
      )}

      <div className="space-y-2">
        {budgetLines.map((bl) => {
          const ba = byId.get(bl.id);
          const actual = Number(ba?.actual_spent ?? 0);
          const committed = Number(bl.committed);
          const budgeted = Number(bl.budgeted);
          const used = committed + actual;
          const pct = budgeted > 0 ? Math.min(100, (used / budgeted) * 100) : 0;
          const over = ba?.over_budget;
          return (
            <div key={bl.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-jcn-ice">{bl.category}</span>
                <Button variant="ghost" size="sm" onClick={() => del(bl.id)} className="h-7 w-7 p-0 text-rose-300 hover:bg-rose-500/15">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <Field label="Orçado" value={formatCurrency(budgeted)} />
                <Field label="Contratado" value={formatCurrency(committed)} />
                <Field label="Gasto real" value={formatCurrency(actual)} />
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full ${over ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
              </div>
              {over && (
                <p className="mt-1 text-[10px] font-bold text-rose-300">⚠️ ESTOUROU orçamento</p>
              )}
            </div>
          );
        })}
        {adding && (
          <div className="rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/[0.05] p-3">
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input placeholder="Orçado $" value={form.budgeted} onChange={(e) => setForm({ ...form, budgeted: e.target.value })} />
              <Input placeholder="Contratado $" value={form.committed} onChange={(e) => setForm({ ...form, committed: e.target.value })} />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
              <Button size="sm" onClick={add} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/45">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-jcn-ice">{value}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">{label}</Label>
      {children}
    </div>
  );
}
