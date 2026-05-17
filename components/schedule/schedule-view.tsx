"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  HardHat,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { JOB_PHASE_LABEL } from "@/lib/labels";
import {
  buildMonthBuckets,
  calculateJobProgress,
  daysRemaining,
  jobsWithoutSchedule,
  type JobWithLead,
  type MonthBucket,
} from "@/lib/schedule";
import type { JobPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobs: JobWithLead[];
};

const PHASE_ACCENT: Record<JobPhase, string> = {
  planning: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  permit_released: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  materials_ordered: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  materials_delivered: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  work_in_progress: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
};

export function ScheduleView({ jobs }: Props) {
  const now = new Date();
  const [centerYear, setCenterYear] = useState(now.getFullYear());
  const [centerMonth, setCenterMonth] = useState(now.getMonth());
  const [includeCompleted, setIncludeCompleted] = useState(false);

  const buckets = useMemo<MonthBucket[]>(
    () =>
      buildMonthBuckets({
        jobs,
        centerYear,
        centerMonth,
        monthsBack: 1,
        monthsForward: 1,
        includeCompleted,
      }),
    [jobs, centerYear, centerMonth, includeCompleted],
  );

  const noSchedule = useMemo(
    () => jobsWithoutSchedule(jobs, includeCompleted),
    [jobs, includeCompleted],
  );

  function navigate(monthsDelta: number) {
    const newDate = new Date(centerYear, centerMonth + monthsDelta, 1);
    setCenterYear(newDate.getFullYear());
    setCenterMonth(newDate.getMonth());
  }

  function goToToday() {
    const today = new Date();
    setCenterYear(today.getFullYear());
    setCenterMonth(today.getMonth());
  }

  const totalActive = buckets.reduce((sum, b) => sum + b.jobs.length, 0);
  const totalValue = buckets.reduce((sum, b) => sum + b.totalValue, 0);

  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-5 px-4 md:px-6">
      {/* Header */}
      <header className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
              <CalendarRange className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
                Agenda de obras
              </h1>
              <p className="text-xs text-jcn-ice/55">
                {totalActive} {totalActive === 1 ? "obra" : "obras"} nos 3 meses
                visíveis · {formatCurrency(totalValue)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIncludeCompleted((v) => !v)}
              className={cn(
                "text-xs",
                includeCompleted && "bg-emerald-500/15 text-emerald-300",
              )}
            >
              {includeCompleted ? "Ocultar concluídas" : "Mostrar concluídas"}
            </Button>
          </div>
        </div>

        {/* Navegação de meses */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-9"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-9 font-semibold"
          >
            Hoje
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(1)}
            className="h-9"
          >
            <span className="hidden sm:inline">Próximo</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Sem cronograma definido (no topo, destaque amarelo) */}
      {noSchedule.length > 0 && (
        <section className="rounded-3xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 p-6 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-jcn-gold-300" />
            <h2 className="text-base font-black text-jcn-gold-200">
              Sem cronograma definido ({noSchedule.length})
            </h2>
          </div>
          <p className="mb-4 text-xs text-jcn-ice/65">
            Esses jobs não têm datas de início/fim. Abra cada um e defina o
            cronograma pra eles aparecerem nos meses certos.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {noSchedule.map((job) => (
              <JobMiniCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* Meses */}
      {buckets.map((bucket) => (
        <MonthSection key={bucket.monthKey} bucket={bucket} />
      ))}
    </div>
  );
}

function MonthSection({ bucket }: { bucket: MonthBucket }) {
  const now = new Date();
  const isCurrent =
    bucket.year === now.getFullYear() && bucket.monthIndex === now.getMonth();

  return (
    <section
      className={cn(
        "rounded-3xl border p-6 backdrop-blur-xl",
        isCurrent
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/[0.04]"
          : "border-white/[0.06] bg-white/[0.03]",
      )}
    >
      <header className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black tracking-tight text-jcn-ice md:text-2xl">
            {bucket.monthLabel}
            {isCurrent && (
              <Badge
                variant="outline"
                className="ml-2 border-jcn-gold-400/40 bg-jcn-gold-500/15 text-[10px] font-bold text-jcn-gold-300"
              >
                ESTE MÊS
              </Badge>
            )}
          </h2>
        </div>
        <div className="text-xs text-jcn-ice/55">
          {bucket.jobs.length} {bucket.jobs.length === 1 ? "obra" : "obras"}
          {bucket.totalValue > 0 && ` · ${formatCurrency(bucket.totalValue)}`}
        </div>
      </header>

      {bucket.jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-8 text-center text-sm text-jcn-ice/45">
          Sem obras nesse mês.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {bucket.jobs.map((job) => (
            <JobMonthCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  );
}

function JobMonthCard({ job }: { job: JobWithLead }) {
  const progress = calculateJobProgress(job);
  const days = daysRemaining(job);
  const start = job.actual_start ?? job.expected_start;
  const end = job.actual_end ?? job.expected_end;
  const isLate = days !== null && days < 0;

  return (
    <Link
      href={`/job/${job.id}`}
      className="group rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:border-jcn-gold-400/30 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-jcn-ice group-hover:text-jcn-gold-200">
            {job.lead?.name ?? "Cliente sem nome"}
          </p>
          {job.lead?.city && (
            <p className="text-xs text-jcn-ice/55">{job.lead.city}</p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] font-semibold", PHASE_ACCENT[job.current_phase])}
        >
          {JOB_PHASE_LABEL[job.current_phase]}
        </Badge>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-jcn-ice/65">
        <span className="font-bold text-jcn-gold-300">
          {formatCurrency(job.value)}
        </span>
        {start && end && (
          <span>
            {format(new Date(start), "d MMM", { locale: ptBR })} →{" "}
            {format(new Date(end), "d MMM", { locale: ptBR })}
          </span>
        )}
      </div>

      {progress !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-jcn-ice/55">
            <span>{progress}% do tempo</span>
            {days !== null && (
              <span
                className={cn(
                  "flex items-center gap-1 font-semibold",
                  isLate
                    ? "text-rose-300"
                    : days <= 7
                      ? "text-jcn-gold-300"
                      : "text-jcn-ice/55",
                )}
              >
                <Clock className="h-3 w-3" />
                {isLate
                  ? `${Math.abs(days)}d atrasada`
                  : `${days}d restantes`}
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isLate
                  ? "bg-rose-400"
                  : progress >= 90
                    ? "bg-jcn-gold-400"
                    : "bg-jcn-gold-500",
              )}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

function JobMiniCard({ job }: { job: JobWithLead }) {
  return (
    <Link
      href={`/job/${job.id}`}
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 transition hover:bg-white/[0.04]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300">
        <HardHat className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-jcn-ice group-hover:text-jcn-gold-200">
          {job.lead?.name ?? "Cliente sem nome"}
        </p>
        <p className="text-xs text-jcn-ice/55">
          {job.lead?.city ?? "Sem cidade"} ·{" "}
          {formatDistanceToNow(new Date(job.contract_signed_at), {
            locale: ptBR,
            addSuffix: true,
          })}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn("text-[10px] font-semibold", PHASE_ACCENT[job.current_phase])}
      >
        {JOB_PHASE_LABEL[job.current_phase]}
      </Badge>
    </Link>
  );
}
