"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  ExternalLink,
  HardHat,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { MarkReceivedDialog } from "@/components/finance/mark-received-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { JOB_PHASE_LABEL, PAYMENT_KIND_LABEL } from "@/lib/labels";
import type {
  JobPayment,
  JobPhase,
  Lead,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASE_ACCENT: Record<JobPhase, string> = {
  planning: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  permit_released: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  materials_ordered: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  materials_delivered: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  work_in_progress: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
};

export type ReceivableRow = JobPayment & {
  job?: {
    id: string;
    value: number;
    current_phase: JobPhase;
    lead?: Pick<Lead, "id" | "name" | "city"> | null;
  } | null;
};

type Props = {
  pending: ReceivableRow[];
  /** Soma total recebido por job_id (pra calcular % pago). */
  receivedByJob: Record<string, number>;
};

type JobGroup = {
  jobId: string;
  jobValue: number;
  phase: JobPhase;
  leadName: string;
  leadCity: string | null;
  payments: ReceivableRow[];
  pendingTotal: number;
  receivedTotal: number;
};

export function FinanceReceivableTab({ pending, receivedByJob }: Props) {
  const router = useRouter();
  const [markTarget, setMarkTarget] = useState<ReceivableRow | null>(null);

  const groups = useMemo<JobGroup[]>(() => {
    const map = new Map<string, JobGroup>();
    for (const p of pending) {
      if (!p.job) continue;
      const cur = map.get(p.job_id);
      if (cur) {
        cur.payments.push(p);
        cur.pendingTotal += Number(p.amount);
      } else {
        map.set(p.job_id, {
          jobId: p.job_id,
          jobValue: Number(p.job.value),
          phase: p.job.current_phase,
          leadName: p.job.lead?.name ?? "Cliente sem nome",
          leadCity: p.job.lead?.city ?? null,
          payments: [p],
          pendingTotal: Number(p.amount),
          receivedTotal: receivedByJob[p.job_id] ?? 0,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.pendingTotal - a.pendingTotal,
    );
  }, [pending, receivedByJob]);

  const totalPending = pending.reduce((s, p) => s + Number(p.amount), 0);
  const totalContract = groups.reduce((s, g) => s + g.jobValue, 0);
  const totalReceived = groups.reduce((s, g) => s + g.receivedTotal, 0);

  return (
    <div className="space-y-5">
      {/* KPIs topo */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi
          icon={Wallet}
          label="Total a receber"
          value={formatCurrency(totalPending)}
          accent="gold"
          sub={`${pending.length} ${pending.length === 1 ? "parcela" : "parcelas"} em ${groups.length} ${groups.length === 1 ? "job" : "jobs"}`}
        />
        <Kpi
          icon={TrendingUp}
          label="Já recebido (acumulado)"
          value={formatCurrency(totalReceived)}
          accent="green"
          sub={
            totalContract > 0
              ? `${Math.round((totalReceived / totalContract) * 100)}% dos contratos ativos`
              : "—"
          }
        />
        <Kpi
          icon={Briefcase}
          label="Valor contratos ativos"
          value={formatCurrency(totalContract)}
          accent="neutral"
          sub={`${groups.length} ${groups.length === 1 ? "job" : "jobs"} ativos`}
        />
      </div>

      {/* Lista */}
      {groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            Tudo recebido ✓
          </p>
          <p className="mt-1 text-xs text-jcn-ice/40">
            Nenhuma parcela pendente nos jobs ativos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <JobGroupCard
              key={g.jobId}
              group={g}
              onMark={setMarkTarget}
            />
          ))}
        </div>
      )}

      {/* Dialog marcar recebido */}
      {markTarget && (
        <MarkReceivedDialog
          open={!!markTarget}
          onOpenChange={(o) => {
            if (!o) setMarkTarget(null);
          }}
          payment={markTarget}
          onDone={() => {
            setMarkTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function JobGroupCard({
  group,
  onMark,
}: {
  group: JobGroup;
  onMark: (p: ReceivableRow) => void;
}) {
  const total = group.receivedTotal + group.pendingTotal;
  const pctReceived =
    total > 0 ? Math.round((group.receivedTotal / total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur-xl">
      <header className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <Link
              href={`/job/${group.jobId}`}
              className="group flex items-center gap-1.5 text-base font-bold text-jcn-ice hover:text-jcn-gold-200"
            >
              {group.leadName}
              <ExternalLink className="h-3 w-3 opacity-50 transition group-hover:opacity-100" />
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {group.leadCity && (
                <span className="text-[11px] text-jcn-ice/55">
                  {group.leadCity}
                </span>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  PHASE_ACCENT[group.phase],
                )}
              >
                {JOB_PHASE_LABEL[group.phase]}
              </Badge>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
            A receber
          </div>
          <div className="text-xl font-black text-amber-300">
            {formatCurrency(group.pendingTotal)}
          </div>
          <div className="mt-0.5 text-[10px] text-jcn-ice/55">
            de {formatCurrency(total)} total ({pctReceived}% pago)
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-emerald-400/70"
          style={{ width: `${pctReceived}%` }}
        />
      </div>

      {/* Parcelas */}
      <div className="space-y-2">
        {group.payments.map((p) => {
          const due = p.due_date ? new Date(p.due_date) : null;
          const isLate = due && due < new Date();
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-jcn-ice">
                    {p.label}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/65"
                  >
                    {PAYMENT_KIND_LABEL[p.kind]}
                  </Badge>
                  {due && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold",
                        isLate
                          ? "border-rose-400/40 bg-rose-500/15 text-rose-300"
                          : "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
                      )}
                    >
                      {isLate ? (
                        <AlertTriangle className="mr-1 h-3 w-3" />
                      ) : (
                        <Calendar className="mr-1 h-3 w-3" />
                      )}
                      {isLate ? "Atrasado " : "Vence "}
                      {format(due, "d MMM", { locale: ptBR })}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-base font-black text-amber-300">
                  {formatCurrency(Number(p.amount))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMark(p)}
                  className="h-8 border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Marcar recebido
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: "gold" | "green" | "neutral";
}) {
  const accentClass = {
    gold: "border-amber-400/30 bg-amber-500/[0.08] text-amber-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    neutral: "border-white/[0.08] bg-white/[0.04] text-jcn-ice",
  }[accent];

  return (
    <div className={cn("rounded-2xl border p-4 backdrop-blur-xl", accentClass)}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-jcn-ice/45">{sub}</div>
    </div>
  );
}
