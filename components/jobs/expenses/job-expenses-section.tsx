"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddExpenseDialog } from "@/components/jobs/expenses/add-expense-dialog";
import { DeleteExpenseDialog } from "@/components/jobs/expenses/delete-expense-dialog";
import { ReceiptViewer } from "@/components/jobs/expenses/receipt-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type Job,
  type JobExpense,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  job: Job;
  expenses: JobExpense[];
  receiptUrls: Record<string, string | null>;
};

const CATEGORY_ACCENT: Record<ExpenseCategory, string> = {
  materials: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  labor: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  permit: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  subcontractor: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  equipment: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  transport: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  other: "bg-stone-500/15 text-stone-300 border-stone-400/30",
};

export function JobExpensesSection({ job, expenses, receiptUrls }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobExpense | null>(null);
  const [viewerTarget, setViewerTarget] = useState<{
    expense: JobExpense;
    url: string;
  } | null>(null);

  // KPIs e breakdown
  const stats = useMemo(() => {
    const totals: Record<ExpenseCategory, number> = {
      materials: 0,
      labor: 0,
      permit: 0,
      subcontractor: 0,
      equipment: 0,
      transport: 0,
      other: 0,
    };
    let grandTotal = 0;
    for (const e of expenses) {
      const amt = Number(e.amount);
      totals[e.category] += amt;
      grandTotal += amt;
    }
    const topCategory = (Object.entries(totals) as [ExpenseCategory, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])[0];

    const margin = job.value - grandTotal;
    const marginPercent = job.value > 0 ? (margin / job.value) * 100 : 0;

    return {
      totals,
      grandTotal,
      topCategory,
      margin,
      marginPercent,
      count: expenses.length,
    };
  }, [expenses, job.value]);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-jcn-ice">
              Despesas e recibos
            </h3>
            <p className="text-xs text-jcn-ice/55">
              Tudo que sai do bolso pra fazer essa obra
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="h-10 font-semibold">
          <Plus className="h-4 w-4" />
          Adicionar despesa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Total gasto"
          value={formatCurrency(stats.grandTotal)}
          accent="gold"
        />
        <KpiCard
          label="Recibos"
          value={`${stats.count}`}
          accent="neutral"
        />
        <KpiCard
          label="Top categoria"
          value={
            stats.topCategory
              ? `${EXPENSE_CATEGORY_LABEL[stats.topCategory[0]]}`
              : "Sem dados"
          }
          subValue={
            stats.topCategory ? formatCurrency(stats.topCategory[1]) : undefined
          }
          accent="neutral"
        />
        <KpiCard
          label="Margem estimada"
          value={
            stats.grandTotal === 0
              ? "—"
              : `${stats.marginPercent.toFixed(1)}%`
          }
          subValue={
            stats.grandTotal === 0 ? undefined : formatCurrency(stats.margin)
          }
          accent={
            stats.grandTotal === 0
              ? "neutral"
              : stats.marginPercent >= 25
                ? "green"
                : stats.marginPercent >= 10
                  ? "amber"
                  : "red"
          }
          icon={
            stats.grandTotal === 0
              ? undefined
              : stats.margin >= 0
                ? TrendingUp
                : TrendingDown
          }
        />
      </div>

      {/* Breakdown por categoria */}
      {stats.grandTotal > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
          {EXPENSE_CATEGORIES.filter((c) => stats.totals[c] > 0).map((cat) => (
            <Badge
              key={cat}
              variant="outline"
              className={cn("font-semibold", CATEGORY_ACCENT[cat])}
            >
              {EXPENSE_CATEGORY_LABEL[cat]}: {formatCurrency(stats.totals[cat])}
            </Badge>
          ))}
        </div>
      )}

      {/* Lista de despesas */}
      <div className="mt-5 space-y-2">
        {expenses.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          expenses.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              receiptUrl={
                e.receipt_path ? (receiptUrls[e.receipt_path] ?? null) : null
              }
              onView={(url) => setViewerTarget({ expense: e, url })}
              onDelete={() => setDeleteTarget(e)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddExpenseDialog
        jobId={job.id}
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      {deleteTarget && (
        <DeleteExpenseDialog
          expense={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onDeleted={() => {
            setDeleteTarget(null);
            toast.success("Despesa excluída");
            router.refresh();
          }}
        />
      )}

      {viewerTarget && (
        <ReceiptViewer
          expense={viewerTarget.expense}
          signedUrl={viewerTarget.url}
          open={viewerTarget !== null}
          onClose={() => setViewerTarget(null)}
        />
      )}
    </section>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  subValue?: string;
  accent: "gold" | "green" | "amber" | "red" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
};

function KpiCard({ label, value, subValue, accent, icon: Icon }: KpiCardProps) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    red: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    neutral: "border-white/[0.08] bg-white/[0.03] text-jcn-ice",
  }[accent];

  return (
    <div className={cn("rounded-2xl border p-3 backdrop-blur-xl", accentClass)}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="mt-1.5 text-lg font-black tracking-tight">{value}</div>
      {subValue && (
        <div className="mt-0.5 text-xs opacity-80">{subValue}</div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
      <Receipt className="mx-auto h-8 w-8 text-jcn-ice/30" />
      <p className="mt-3 text-sm font-semibold text-jcn-ice/65">
        Sem despesas registradas
      </p>
      <p className="mt-1 text-xs text-jcn-ice/40">
        Adicione material, mão de obra, permit e outros gastos pra calcular margem real.
      </p>
      <Button onClick={onAdd} variant="outline" className="mt-4">
        <Plus className="h-4 w-4" />
        Adicionar primeiro
      </Button>
    </div>
  );
}

type ExpenseRowProps = {
  expense: JobExpense;
  receiptUrl: string | null;
  onView: (url: string) => void;
  onDelete: () => void;
};

function ExpenseRow({ expense, receiptUrl, onView, onDelete }: ExpenseRowProps) {
  const isImage = expense.receipt_mime?.startsWith("image/");
  const isPdf = expense.receipt_mime === "application/pdf";
  const hasReceipt = expense.receipt_path !== null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold",
              CATEGORY_ACCENT[expense.category],
            )}
          >
            {EXPENSE_CATEGORY_LABEL[expense.category]}
          </Badge>
          <span className="text-sm font-semibold text-jcn-ice">
            {expense.description}
          </span>
          {hasReceipt && (
            <Paperclip className="h-3.5 w-3.5 text-jcn-gold-300/70" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
          {expense.vendor && <span>{expense.vendor}</span>}
          <span>
            {format(new Date(expense.expense_date), "d 'de' MMM 'de' yyyy", {
              locale: ptBR,
            })}
          </span>
          {expense.notes && (
            <span className="italic opacity-70">{expense.notes}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="text-right">
          <div className="text-base font-black text-jcn-gold-300">
            {formatCurrency(Number(expense.amount))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {hasReceipt && receiptUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                isPdf ? window.open(receiptUrl, "_blank") : onView(receiptUrl)
              }
              className="h-9 w-9 p-0"
              title="Ver recibo"
            >
              {isPdf ? (
                <FileText className="h-4 w-4" />
              ) : isImage ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-9 w-9 p-0 text-rose-300/70 hover:text-rose-300"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
