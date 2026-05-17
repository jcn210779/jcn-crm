"use client";

import {
  Banknote,
  Briefcase,
  Calendar,
  CreditCard,
  DollarSign,
  Filter,
  Plus,
  Receipt,
  Repeat,
  Table as TableIcon,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AddBusinessExpenseDialog } from "@/components/finance/add-business-expense-dialog";
import { EditBusinessExpenseDialog } from "@/components/finance/edit-business-expense-dialog";
import { FinanceMonthlyTab } from "@/components/finance/finance-monthly-tab";
import { FinanceTableTab } from "@/components/finance/finance-table-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUSINESS_EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { formatDateBR, formatUSD } from "@/lib/finance";
import {
  BUSINESS_EXPENSE_CATEGORIES,
  type BusinessExpense,
  type BusinessExpenseCategory,
  type FinanceMonthly,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "monthly" | "table" | "business";

type Props = {
  monthly: FinanceMonthly[];
  businessExpenses: BusinessExpense[];
};

export function FinanceView({ monthly, businessExpenses }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("monthly");

  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-5 px-4 md:px-6">
      {/* Header */}
      <header className="flex flex-col gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
              Financeiro
            </h1>
            <p className="text-xs text-jcn-ice/55">
              Caixa real considera todas as saídas (obras + empresa). Despesas
              de obra no cartão entram só quando você paga a fatura.
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <TabButton
          active={tab === "monthly"}
          onClick={() => setTab("monthly")}
          icon={Calendar}
          label="Mensal"
        />
        <TabButton
          active={tab === "table"}
          onClick={() => setTab("table")}
          icon={TableIcon}
          label="Tabela"
        />
        <TabButton
          active={tab === "business"}
          onClick={() => setTab("business")}
          icon={Briefcase}
          label="Gastos da empresa"
        />
      </div>

      {tab === "monthly" && <FinanceMonthlyTab monthly={monthly} />}
      {tab === "table" && <FinanceTableTab monthly={monthly} />}
      {tab === "business" && (
        <BusinessExpensesTab
          expenses={businessExpenses}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ============================================================================
// Gastos da empresa
// ============================================================================

function BusinessExpensesTab({
  expenses,
  onRefresh,
}: {
  expenses: BusinessExpense[];
  onRefresh: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BusinessExpense | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<
    BusinessExpenseCategory | "all"
  >("all");
  const [period, setPeriod] = useState<"month" | "3m" | "6m" | "12m" | "all">(
    "month",
  );
  const [recurringFilter, setRecurringFilter] = useState<"all" | "yes" | "no">(
    "all",
  );

  const filtered = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;
    if (period === "month") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "3m") {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (period === "6m") {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (period === "12m") {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter)
        return false;
      if (recurringFilter === "yes" && !e.recurring) return false;
      if (recurringFilter === "no" && e.recurring) return false;
      if (cutoff) {
        const d = new Date(e.expense_date);
        if (d < cutoff) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, period, recurringFilter]);

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const count = filtered.length;

  // Categoria que mais consome
  const topCategory = useMemo<
    { cat: BusinessExpenseCategory; total: number } | null
  >(() => {
    const byCat = new Map<BusinessExpenseCategory, number>();
    for (const e of filtered) {
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
    }
    let top: { cat: BusinessExpenseCategory; total: number } | null = null;
    for (const [cat, total] of byCat.entries()) {
      if (!top || total > top.total) {
        top = { cat, total };
      }
    }
    return top;
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi
          icon={Wallet}
          label="Total no período"
          value={formatUSD(total)}
          accent="rose"
        />
        <Kpi
          icon={Receipt}
          label="Lançamentos"
          value={String(count)}
          accent="neutral"
        />
        <Kpi
          icon={TrendingUp}
          label="Maior categoria"
          value={
            topCategory
              ? `${BUSINESS_EXPENSE_CATEGORY_LABEL[topCategory.cat]} (${formatUSD(topCategory.total)})`
              : "—"
          }
          accent="gold"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/45">
            <Filter className="h-3 w-3" />
            Período
          </div>
          <FilterChip
            active={period === "month"}
            onClick={() => setPeriod("month")}
            label="Mês"
          />
          <FilterChip
            active={period === "3m"}
            onClick={() => setPeriod("3m")}
            label="3 meses"
          />
          <FilterChip
            active={period === "6m"}
            onClick={() => setPeriod("6m")}
            label="6 meses"
          />
          <FilterChip
            active={period === "12m"}
            onClick={() => setPeriod("12m")}
            label="12 meses"
          />
          <FilterChip
            active={period === "all"}
            onClick={() => setPeriod("all")}
            label="Tudo"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-jcn-ice outline-none focus:border-jcn-gold-400/40"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(
                e.target.value as BusinessExpenseCategory | "all",
              )
            }
          >
            <option value="all">Todas categorias</option>
            {BUSINESS_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BUSINESS_EXPENSE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-jcn-ice outline-none focus:border-jcn-gold-400/40"
            value={recurringFilter}
            onChange={(e) =>
              setRecurringFilter(e.target.value as "all" | "yes" | "no")
            }
          >
            <option value="all">Recorrentes + pontuais</option>
            <option value="yes">Só recorrentes</option>
            <option value="no">Só pontuais</option>
          </select>
          <Button
            onClick={() => setAddOpen(true)}
            size="sm"
            className="h-9 font-semibold"
          >
            <Plus className="h-4 w-4" />
            Adicionar gasto
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          filtered.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              onClick={() => setEditTarget(e)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddBusinessExpenseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          onRefresh();
        }}
      />
      {editTarget && (
        <EditBusinessExpenseDialog
          expense={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onDone={() => {
            setEditTarget(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.08] bg-white/[0.025] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      {label}
    </button>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "gold" | "green" | "rose" | "neutral";
}) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    neutral: "border-white/[0.08] bg-white/[0.03] text-jcn-ice",
  }[accent];

  return (
    <div
      className={cn("rounded-2xl border p-4 backdrop-blur-xl", accentClass)}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-2 text-xl font-black tracking-tight md:text-2xl">
        {value}
      </div>
    </div>
  );
}

function ExpenseRow({
  expense,
  onClick,
}: {
  expense: BusinessExpense;
  onClick: () => void;
}) {
  const isCC = expense.category === "credit_card_payment";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-left transition hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            isCC
              ? "bg-amber-500/15 text-amber-300"
              : "bg-white/[0.05] text-jcn-ice/65",
          )}
        >
          {isCC ? (
            <CreditCard className="h-5 w-5" />
          ) : (
            <Receipt className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-jcn-ice">
              {expense.description}
            </span>
            <Badge
              variant="outline"
              className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/65"
            >
              {BUSINESS_EXPENSE_CATEGORY_LABEL[expense.category]}
            </Badge>
            {expense.recurring && (
              <Badge
                variant="outline"
                className="border-jcn-gold-400/30 bg-jcn-gold-500/10 text-[10px] font-semibold text-jcn-gold-300"
              >
                <Repeat className="mr-1 h-3 w-3" />
                {expense.recurrence_note ?? "Recorrente"}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateBR(expense.expense_date)}
            </span>
            {expense.vendor && (
              <span className="flex items-center gap-1">
                <Banknote className="h-3 w-3" />
                {expense.vendor}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-black text-rose-300">
          {formatUSD(Number(expense.amount))}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
      <Briefcase className="mx-auto h-10 w-10 text-jcn-ice/30" />
      <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
        Nenhum gasto da empresa nesse filtro
      </p>
      <p className="mt-1 text-xs text-jcn-ice/40">
        Lançe seguro, gasolina, software, parcela da van, etc. Isso entra no
        cálculo do caixa real.
      </p>
      <Button onClick={onAdd} variant="outline" className="mt-5">
        <Plus className="h-4 w-4" />
        Adicionar primeiro
      </Button>
    </div>
  );
}

