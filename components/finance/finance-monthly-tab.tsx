"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Hammer,
  HardHat,
  Megaphone,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  BUSINESS_EXPENSE_CATEGORY_LABEL,
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  SOURCE_LABEL,
} from "@/lib/labels";
import {
  comparePeriod,
  findMonth,
  formatDateBR,
  formatDeltaPercent,
  formatMonthLabel,
  formatUSD,
  previousMonth,
} from "@/lib/finance";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  BusinessExpense,
  ExpenseCategory,
  FinanceMonthly,
  JobExpense,
  JobHours,
  JobSubcontractor,
  LeadSource,
  PaymentKind,
  PaymentMethod,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  monthly: FinanceMonthly[];
};

type DetailTab = "received" | "paid" | "sold";

type PaidEntry = {
  id: string;
  date: string;
  label: string;
  detail: string | null;
  amount: number;
  source: "job_expense" | "job_hours" | "job_sub" | "ads" | "business";
};

type ReceivedEntry = {
  id: string;
  date: string;
  job_id: string;
  job_label: string;
  kind: PaymentKind;
  amount: number;
  method: PaymentMethod | null;
};

type SoldEntry = {
  id: string;
  date: string;
  lead_name: string;
  value: number;
};

export function FinanceMonthlyTab({ monthly }: Props) {
  // mês atual (YYYY-MM) — fallback pro mais recente da view
  const currentMonth =
    monthly[0]?.month_label ??
    new Date().toISOString().slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [detailTab, setDetailTab] = useState<DetailTab>("paid");

  const row = useMemo(
    () => findMonth(monthly, selectedMonth),
    [monthly, selectedMonth],
  );
  const prev = useMemo(
    () => (row ? previousMonth(monthly, row) : undefined),
    [monthly, row],
  );

  const safeRow: FinanceMonthly =
    row ??
    ({
      month: `${selectedMonth}-01`,
      month_label: selectedMonth,
      sold: 0,
      sold_count: 0,
      received: 0,
      received_count: 0,
      job_expenses_cash: 0,
      job_hours_cost: 0,
      job_subs_cost: 0,
      ads_spend: 0,
      business_expenses: 0,
      total_paid_out: 0,
      cash_balance: 0,
    } as FinanceMonthly);

  const receivedCmp = comparePeriod(
    Number(safeRow.received),
    Number(prev?.received ?? 0),
  );
  const paidCmp = comparePeriod(
    Number(safeRow.total_paid_out),
    Number(prev?.total_paid_out ?? 0),
  );

  function nudgeMonth(delta: number) {
    const [y, m] = selectedMonth.split("-").map(Number);
    if (!y || !m) return;
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  return (
    <div className="space-y-5">
      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <button
          type="button"
          onClick={() => nudgeMonth(-1)}
          className="rounded-full border border-white/[0.08] bg-white/[0.02] p-2 text-jcn-ice/75 transition hover:bg-white/[0.08]"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-jcn-ice/45">
            Mês selecionado
          </div>
          <div className="mt-1 text-lg font-black capitalize tracking-tight text-jcn-ice md:text-xl">
            {formatMonthLabel(selectedMonth)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => nudgeMonth(1)}
          className="rounded-full border border-white/[0.08] bg-white/[0.02] p-2 text-jcn-ice/75 transition hover:bg-white/[0.08]"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiBig
          icon={Briefcase}
          label="Vendido"
          value={formatUSD(Number(safeRow.sold))}
          sub={`${safeRow.sold_count} ${safeRow.sold_count === 1 ? "job" : "jobs"} assinados`}
          accent="gold"
        />
        <KpiBig
          icon={ArrowDownRight}
          label="Recebido"
          value={formatUSD(Number(safeRow.received))}
          sub={`${safeRow.received_count} ${safeRow.received_count === 1 ? "pagamento" : "pagamentos"}`}
          accent="green"
          delta={receivedCmp.deltaPercent}
          deltaDir={receivedCmp.direction}
        />
        <KpiBig
          icon={ArrowUpRight}
          label="Pago"
          value={formatUSD(Number(safeRow.total_paid_out))}
          sub="Todas as saídas"
          accent="rose"
          delta={paidCmp.deltaPercent}
          deltaDir={paidCmp.direction}
          deltaInverted
          tooltip={
            <PaidBreakdown row={safeRow} />
          }
        />
        <KpiBig
          icon={Wallet}
          label="Saldo do mês"
          value={formatUSD(Number(safeRow.cash_balance))}
          sub="Recebido menos pago"
          accent={Number(safeRow.cash_balance) >= 0 ? "green" : "rose"}
        />
      </div>

      {/* Detalhes - tabs */}
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-3 md:p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <DetailTabButton
            active={detailTab === "received"}
            onClick={() => setDetailTab("received")}
            icon={ArrowDownRight}
            label="Recebidos"
            count={safeRow.received_count}
          />
          <DetailTabButton
            active={detailTab === "paid"}
            onClick={() => setDetailTab("paid")}
            icon={ArrowUpRight}
            label="Pagos"
            count={null}
          />
          <DetailTabButton
            active={detailTab === "sold"}
            onClick={() => setDetailTab("sold")}
            icon={Briefcase}
            label="Vendidos"
            count={safeRow.sold_count}
          />
        </div>

        <MonthDetails month={selectedMonth} detailTab={detailTab} />
      </div>
    </div>
  );
}

// ============================================================================
// KPI Big card
// ============================================================================

function KpiBig({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delta,
  deltaDir,
  deltaInverted,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: "gold" | "green" | "rose" | "neutral";
  delta?: number | null;
  deltaDir?: "up" | "down" | "flat";
  /** Pra "pago": delta UP (mais gasto) deve ser ruim. */
  deltaInverted?: boolean;
  tooltip?: React.ReactNode;
}) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    neutral: "border-white/[0.08] bg-white/[0.03] text-jcn-ice",
  }[accent];

  let deltaTone: "good" | "bad" | "neutral" = "neutral";
  if (deltaDir === "up") deltaTone = deltaInverted ? "bad" : "good";
  else if (deltaDir === "down") deltaTone = deltaInverted ? "good" : "bad";

  const DeltaIcon =
    deltaDir === "up"
      ? TrendingUp
      : deltaDir === "down"
        ? TrendingDown
        : null;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-5 backdrop-blur-xl",
        accentClass,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        {delta !== undefined && delta !== null && DeltaIcon && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              deltaTone === "good" &&
                "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
              deltaTone === "bad" &&
                "border-rose-400/30 bg-rose-500/10 text-rose-300",
              deltaTone === "neutral" &&
                "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {formatDeltaPercent(delta)}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-xs opacity-70">{sub}</div>

      {tooltip && (
        <div className="pointer-events-none absolute inset-x-3 top-full z-30 mt-2 origin-top scale-95 rounded-xl border border-white/[0.1] bg-jcn-midnight/95 p-3 opacity-0 shadow-xl backdrop-blur-2xl transition group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100">
          {tooltip}
        </div>
      )}
    </div>
  );
}

function PaidBreakdown({ row }: { row: FinanceMonthly }) {
  const items: Array<{
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      label: "Material e despesas (não-cartão)",
      value: Number(row.job_expenses_cash),
      icon: Hammer,
    },
    { label: "Mão de obra (horas)", value: Number(row.job_hours_cost), icon: HardHat },
    { label: "Subempreiteiros completos", value: Number(row.job_subs_cost), icon: Wrench },
    { label: "Ad spend", value: Number(row.ads_spend), icon: Megaphone },
    { label: "Gastos da empresa", value: Number(row.business_expenses), icon: Briefcase },
  ];
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
        Composição
      </div>
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between gap-3 text-xs text-jcn-ice"
        >
          <span className="flex items-center gap-2">
            <it.icon className="h-3 w-3 text-jcn-ice/55" />
            {it.label}
          </span>
          <span className="font-semibold">{formatUSD(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Detail tabs
// ============================================================================

function DetailTabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count !== null && (
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
          {count}
        </span>
      )}
    </button>
  );
}

function MonthDetails({
  month,
  detailTab,
}: {
  month: string;
  detailTab: DetailTab;
}) {
  const [loading, setLoading] = useState(true);
  const [received, setReceived] = useState<ReceivedEntry[]>([]);
  const [paid, setPaid] = useState<PaidEntry[]>([]);
  const [sold, setSold] = useState<SoldEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadMonthData(month).then((data) => {
      if (cancelled) return;
      setReceived(data.received);
      setPaid(data.paid);
      setSold(data.sold);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [month]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02]"
          />
        ))}
      </div>
    );
  }

  if (detailTab === "received") {
    return received.length === 0 ? (
      <EmptyDetail label="Nada recebido nesse mês" />
    ) : (
      <div className="space-y-1.5">
        {received.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                <ArrowDownRight className="h-4 w-4" />
              </div>
              <div>
                <Link
                  href={`/job/${r.job_id}`}
                  className="text-sm font-bold text-jcn-ice hover:text-jcn-gold-300"
                >
                  {r.job_label}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-jcn-ice/55">
                  <span>{formatDateBR(r.date)}</span>
                  <Badge
                    variant="outline"
                    className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/65"
                  >
                    {PAYMENT_KIND_LABEL[r.kind]}
                  </Badge>
                  {r.method && (
                    <Badge
                      variant="outline"
                      className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/65"
                    >
                      {PAYMENT_METHOD_LABEL[r.method]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right text-base font-black text-emerald-300">
              {formatUSD(Number(r.amount))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (detailTab === "sold") {
    return sold.length === 0 ? (
      <EmptyDetail label="Nenhum job assinado nesse mês" />
    ) : (
      <div className="space-y-1.5">
        {sold.map((s) => (
          <Link
            key={s.id}
            href={`/job/${s.id}`}
            className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-jcn-ice">
                  {s.lead_name}
                </div>
                <div className="text-xs text-jcn-ice/55">
                  Assinado em {formatDateBR(s.date)}
                </div>
              </div>
            </div>
            <div className="text-right text-base font-black text-jcn-gold-300">
              {formatUSD(Number(s.value))}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  // Paid
  return paid.length === 0 ? (
    <EmptyDetail label="Nenhuma saída nesse mês" />
  ) : (
    <div className="space-y-1.5">
      {paid.map((p) => (
        <PaidRow key={`${p.source}-${p.id}`} entry={p} />
      ))}
    </div>
  );
}

function PaidRow({ entry }: { entry: PaidEntry }) {
  const meta = sourceMeta(entry.source);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            meta.color,
          )}
        >
          <meta.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-jcn-ice">{entry.label}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-jcn-ice/55">
            <span>{formatDateBR(entry.date)}</span>
            <Badge
              variant="outline"
              className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/65"
            >
              {meta.tag}
            </Badge>
            {entry.detail && <span>{entry.detail}</span>}
          </div>
        </div>
      </div>
      <div className="text-right text-base font-black text-rose-300">
        {formatUSD(Number(entry.amount))}
      </div>
    </div>
  );
}

function EmptyDetail({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
      <Receipt className="mx-auto h-8 w-8 text-jcn-ice/30" />
      <p className="mt-3 text-sm font-semibold text-jcn-ice/55">{label}</p>
    </div>
  );
}

function sourceMeta(source: PaidEntry["source"]) {
  switch (source) {
    case "job_expense":
      return { icon: Hammer, color: "bg-orange-500/15 text-orange-300", tag: "Despesa obra" };
    case "job_hours":
      return { icon: HardHat, color: "bg-sky-500/15 text-sky-300", tag: "Horas" };
    case "job_sub":
      return { icon: Wrench, color: "bg-violet-500/15 text-violet-300", tag: "Subempreiteiro" };
    case "ads":
      return { icon: Megaphone, color: "bg-pink-500/15 text-pink-300", tag: "Ad spend" };
    case "business":
      return { icon: Briefcase, color: "bg-amber-500/15 text-amber-300", tag: "Empresa" };
  }
}

// ============================================================================
// Data loader (browser) — pega detalhes do mês selecionado
// ============================================================================

async function loadMonthData(monthLabel: string): Promise<{
  received: ReceivedEntry[];
  paid: PaidEntry[];
  sold: SoldEntry[];
}> {
  const supabase = createSupabaseBrowserClient();

  const [year, month] = monthLabel.split("-").map(Number);
  if (!year || !month) {
    return { received: [], paid: [], sold: [] };
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0); // último dia do mês
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  // RECEBIDOS — job_payments paid no mês
  const { data: paymentsData } = await supabase
    .from("job_payments")
    .select("id, job_id, kind, label, amount, method, received_at, jobs(lead_id, leads(name))")
    .eq("status", "paid")
    .gte("received_at", start)
    .lte("received_at", `${end}T23:59:59`)
    .order("received_at", { ascending: false });

  type PaymentRow = {
    id: string;
    job_id: string;
    kind: PaymentKind;
    label: string;
    amount: number;
    method: PaymentMethod | null;
    received_at: string | null;
    jobs?: { leads?: { name?: string } | null } | null;
  };
  const received: ReceivedEntry[] = ((paymentsData ?? []) as unknown as PaymentRow[]).map((p) => {
    const leadName = p.jobs?.leads?.name ?? "Cliente";
    return {
      id: p.id,
      date: p.received_at ?? "",
      job_id: p.job_id,
      job_label: `${leadName} — ${p.label}`,
      kind: p.kind,
      amount: Number(p.amount),
      method: p.method ?? null,
    };
  });

  // VENDIDOS — jobs com contract_signed_at no mês
  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, value, contract_signed_at, leads(name)")
    .gte("contract_signed_at", start)
    .lte("contract_signed_at", `${end}T23:59:59`)
    .order("contract_signed_at", { ascending: false });

  type JobRow = {
    id: string;
    value: number;
    contract_signed_at: string;
    leads?: { name?: string } | null;
  };
  const sold: SoldEntry[] = ((jobsData ?? []) as unknown as JobRow[]).map((j) => ({
    id: j.id,
    date: j.contract_signed_at ?? "",
    lead_name: j.leads?.name ?? "Cliente",
    value: Number(j.value),
  }));

  // PAGOS — agrega 5 fontes
  // 1) job_expenses (não credit_card)
  const { data: expData } = await supabase
    .from("job_expenses")
    .select("id, description, category, vendor, amount, expense_date, payment_method")
    .gte("expense_date", start)
    .lte("expense_date", end)
    .order("expense_date", { ascending: false });

  const expensesPaid: PaidEntry[] = ((expData ?? []) as JobExpense[])
    .filter((e) => e.payment_method !== "credit_card")
    .map((e) => ({
      id: e.id,
      date: e.expense_date,
      label: e.description,
      detail: `${EXPENSE_CATEGORY_LABEL[e.category as ExpenseCategory]}${e.vendor ? ` • ${e.vendor}` : ""}`,
      amount: Number(e.amount),
      source: "job_expense" as const,
    }));

  // 2) job_hours
  const { data: hoursData } = await supabase
    .from("job_hours")
    .select("id, hours, hourly_rate_snapshot, calculated_amount, work_date, team_members(name)")
    .gte("work_date", start)
    .lte("work_date", end);

  const hoursPaid: PaidEntry[] = ((hoursData ?? []) as Array<
    JobHours & { team_members: { name?: string } | null }
  >).map((h) => ({
    id: h.id,
    date: h.work_date,
    label: `${h.team_members?.name ?? "Funcionário"} • ${Number(h.hours).toFixed(1)}h`,
    detail: `$${Number(h.hourly_rate_snapshot).toFixed(2)}/h`,
    amount: Number(h.calculated_amount),
    source: "job_hours" as const,
  }));

  // 3) job_subcontractors completos — filtra em JS (data = completed_at OU hired_at)
  const { data: subsData } = await supabase
    .from("job_subcontractors")
    .select(
      "id, agreed_value, service_description, completed_at, hired_at, status, subcontractors(name)",
    )
    .eq("status", "completed");

  const subsPaid: PaidEntry[] = ((subsData ?? []) as Array<
    JobSubcontractor & { subcontractors: { name?: string } | null }
  >)
    .map((s) => ({
      id: s.id,
      date: (s.completed_at ?? s.hired_at) as string,
      label: s.subcontractors?.name ?? "Subempreiteiro",
      detail: s.service_description,
      amount: Number(s.agreed_value),
      source: "job_sub" as const,
    }))
    .filter((s) => {
      const d = s.date?.slice(0, 10) ?? "";
      return d >= start && d <= end;
    });

  // 4) ad_spend
  const { data: adsData } = await supabase
    .from("ad_spend")
    .select("id, source, amount, month")
    .eq("month", start);

  const adsPaid: PaidEntry[] = (adsData ?? []).map((a) => ({
    id: a.id as string,
    date: a.month as string,
    label: `Ad spend ${SOURCE_LABEL[a.source as LeadSource]}`,
    detail: null,
    amount: Number(a.amount),
    source: "ads" as const,
  }));

  // 5) business_expenses
  const { data: bizData } = await supabase
    .from("business_expenses")
    .select("id, description, amount, expense_date, category, vendor")
    .gte("expense_date", start)
    .lte("expense_date", end)
    .order("expense_date", { ascending: false });

  const bizPaid: PaidEntry[] = ((bizData ?? []) as BusinessExpense[]).map(
    (b) => ({
      id: b.id,
      date: b.expense_date,
      label: b.description,
      detail: `${BUSINESS_EXPENSE_CATEGORY_LABEL[b.category]}${b.vendor ? ` • ${b.vendor}` : ""}`,
      amount: Number(b.amount),
      source: "business" as const,
    }),
  );

  const paid: PaidEntry[] = [
    ...expensesPaid,
    ...hoursPaid,
    ...subsPaid,
    ...adsPaid,
    ...bizPaid,
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { received, paid, sold };
}
