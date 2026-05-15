"use client";

import { format, formatDistanceToNow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AddPaymentDialog } from "@/components/jobs/payments/add-payment-dialog";
import { DeletePaymentDialog } from "@/components/jobs/payments/delete-payment-dialog";
import { EditPaymentDialog } from "@/components/jobs/payments/edit-payment-dialog";
import { MarkPaymentPaidDialog } from "@/components/jobs/payments/mark-payment-paid-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/labels";
import type { JobPayment, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string;
  contractValue: number;
  payments: JobPayment[];
};

const STATUS_TONE: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  overdue: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  cancelled: "bg-white/[0.05] text-white/40 border-white/10",
};

const KIND_TONE: Record<JobPayment["kind"], string> = {
  deposit: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  milestone: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  final: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  extra: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
};

export function JobPaymentsSection({ jobId, contractValue, payments }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<JobPayment | null>(null);

  // Computa parcelas com status efetivo (calcula overdue por due_date)
  const enriched = useMemo(() => {
    return payments.map((p) => {
      let effective: PaymentStatus = p.status;
      if (
        p.status === "pending" &&
        p.due_date &&
        isPast(parseISO(p.due_date))
      ) {
        effective = "overdue";
      }
      return { ...p, effective_status: effective };
    });
  }, [payments]);

  // Métricas agregadas
  const totalPaid = useMemo(
    () =>
      enriched
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [enriched],
  );

  const totalPending = useMemo(
    () =>
      enriched
        .filter((p) => p.status !== "paid" && p.status !== "cancelled")
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [enriched],
  );

  const totalPlanned = useMemo(
    () =>
      enriched
        .filter((p) => p.status !== "cancelled")
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [enriched],
  );

  const reference = Math.max(contractValue, totalPlanned, 1);
  const paidPercent = Math.min(100, Math.round((totalPaid / reference) * 100));

  const nextOrder = useMemo(() => {
    if (enriched.length === 0) return 0;
    return Math.max(...enriched.map((p) => p.display_order)) + 1;
  }, [enriched]);

  // Próxima parcela em destaque: primeira pendente, ordenada por due_date asc (null no fim)
  const nextPayment = useMemo(() => {
    const pending = enriched.filter(
      (p) => p.status === "pending" || p.status === "overdue",
    );
    if (pending.length === 0) return null;
    return [...pending].sort((a, b) => {
      if (!a.due_date && !b.due_date) return a.display_order - b.display_order;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    })[0];
  }, [enriched]);

  // Ordena lista por display_order asc
  const sorted = useMemo(
    () => [...enriched].sort((a, b) => a.display_order - b.display_order),
    [enriched],
  );

  function openEdit(p: JobPayment) {
    setSelected(p);
    setEditOpen(true);
  }

  function openPaid(p: JobPayment) {
    setSelected(p);
    setPaidOpen(true);
  }

  function openDelete(p: JobPayment) {
    setSelected(p);
    setDeleteOpen(true);
  }

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/45">
            Pagamentos
          </h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-black tracking-[-0.02em] text-primary">
              {formatCurrency(totalPaid)}
            </span>
            <span className="text-sm font-semibold text-white/45">
              de {formatCurrency(reference)}
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
              {paidPercent}% pago
            </span>
          </div>
          {totalPending > 0 ? (
            <p className="mt-1 text-xs font-semibold text-white/55">
              {formatCurrency(totalPending)} a receber
            </p>
          ) : null}
        </div>

        <Button
          onClick={() => setAddOpen(true)}
          className="h-10 font-semibold"
        >
          <Plus className="h-4 w-4" />
          Adicionar parcela
        </Button>
      </div>

      {/* Barra de progresso */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-jcn-gold-400 to-primary transition-all duration-500"
          style={{ width: `${paidPercent}%` }}
        />
      </div>

      {/* Próxima parcela em destaque */}
      {nextPayment ? (
        <div className="mt-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] to-jcn-gold-500/[0.04] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  Próxima parcela
                </span>
              </div>
              <p className="mt-2 text-lg font-black tracking-tight text-white">
                {nextPayment.label}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/65">
                <Badge
                  variant="outline"
                  className={cn("font-bold", KIND_TONE[nextPayment.kind])}
                >
                  {PAYMENT_KIND_LABEL[nextPayment.kind]}
                </Badge>
                {nextPayment.due_date ? (
                  <span
                    className={cn(
                      nextPayment.effective_status === "overdue"
                        ? "text-rose-300"
                        : "text-white/55",
                    )}
                  >
                    {nextPayment.effective_status === "overdue"
                      ? "Vencida "
                      : "Vence "}
                    {formatDistanceToNow(parseISO(nextPayment.due_date), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </span>
                ) : (
                  <span className="text-white/40">Sem data definida</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-primary">
                {formatCurrency(nextPayment.amount)}
              </p>
              <Button
                size="sm"
                onClick={() => openPaid(nextPayment)}
                className="mt-2 h-8 font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marcar paga
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lista de parcelas */}
      <div className="mt-5">
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
          Todas as parcelas ({sorted.length})
        </h4>

        {sorted.length === 0 ? (
          <EmptyPayments onAdd={() => setAddOpen(true)} />
        ) : (
          <ul className="space-y-2">
            {sorted.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onMarkPaid={() => openPaid(p)}
                onEdit={() => openEdit(p)}
                onDelete={() => openDelete(p)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Dialogs */}
      <AddPaymentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        jobId={jobId}
        nextOrder={nextOrder}
      />
      <MarkPaymentPaidDialog
        open={paidOpen}
        onOpenChange={setPaidOpen}
        payment={selected}
      />
      <EditPaymentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        payment={selected}
      />
      <DeletePaymentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        payment={selected}
      />
    </section>
  );
}

type RowProps = {
  payment: JobPayment & { effective_status: PaymentStatus };
  onMarkPaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function PaymentRow({ payment, onMarkPaid, onEdit, onDelete }: RowProps) {
  const effective = payment.effective_status;
  const isPaid = payment.status === "paid";
  const isCancelled = payment.status === "cancelled";

  return (
    <li
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 transition hover:bg-white/[0.05]",
        isPaid && "border-emerald-500/20 bg-emerald-500/[0.04]",
        effective === "overdue" && "border-rose-500/25 bg-rose-500/[0.04]",
        isCancelled && "opacity-50",
      )}
    >
      {/* Mobile-first: empilha em coluna no mobile, vira linha no md */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("font-bold", KIND_TONE[payment.kind])}
            >
              {PAYMENT_KIND_LABEL[payment.kind]}
            </Badge>
            <Badge
              variant="outline"
              className={cn("font-bold", STATUS_TONE[effective])}
            >
              {PAYMENT_STATUS_LABEL[effective]}
            </Badge>
            {payment.method ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
                <Wallet className="h-3 w-3" />
                {PAYMENT_METHOD_LABEL[payment.method]}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-bold text-white">{payment.label}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-white/55">
            {payment.due_date ? (
              <span>
                Vence{" "}
                {format(parseISO(payment.due_date), "dd 'de' MMM", {
                  locale: ptBR,
                })}
              </span>
            ) : null}
            {payment.received_at ? (
              <span className="text-emerald-300">
                Pago{" "}
                {format(parseISO(payment.received_at), "dd 'de' MMM", {
                  locale: ptBR,
                })}
              </span>
            ) : null}
          </div>

          {payment.notes ? (
            <p className="mt-2 line-clamp-2 text-[11px] font-medium text-white/50">
              {payment.notes}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 md:flex-col md:items-end">
          <div className="flex items-baseline gap-1">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <span className="text-lg font-black text-primary">
              {formatCurrency(payment.amount)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!isPaid && !isCancelled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onMarkPaid}
                className="h-8 border-emerald-500/30 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marcar paga
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="h-8 border-white/[0.1] bg-white/[0.04] px-2 text-xs"
              aria-label="Editar parcela"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="h-8 border-rose-500/20 bg-transparent px-2 text-xs text-rose-300 hover:bg-rose-500/10"
              aria-label="Remover parcela"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyPayments({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.015] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CircleDollarSign className="h-5 w-5" />
      </div>
      <h4 className="mt-4 text-base font-bold text-white">
        Nenhuma parcela ainda
      </h4>
      <p className="mt-1.5 text-sm text-white/55">
        Adicione a entrada, parcelas intermediárias e pagamento final pra
        acompanhar o que o cliente já pagou.
      </p>
      <Button onClick={onAdd} className="mt-4 font-semibold">
        <Plus className="h-4 w-4" />
        Adicionar primeira parcela
      </Button>
    </div>
  );
}
