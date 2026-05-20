"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  ChevronRight,
  Clock,
  Map as MapIcon,
  MapPin,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { JourneyStepDialog } from "@/components/journey/journey-step-dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  computeJourney,
  countCompleted,
  currentStep,
  type JourneyStep,
} from "@/lib/journey";
import { JOB_PHASE_LABEL } from "@/lib/labels";
import type {
  Job,
  JobPhase,
  JourneyMilestone,
  Lead,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type JobRow = Job & {
  lead: Pick<
    Lead,
    "id" | "name" | "city" | "phone" | "email" | "created_at" | "stage"
  > | null;
};

type Props = {
  jobs: JobRow[];
  milestones: JourneyMilestone[];
};

type Filter = "active" | "completed" | "all";

const PHASE_ACCENT: Record<JobPhase, string> = {
  planning: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  permit_released: "border-violet-400/30 bg-violet-500/15 text-violet-300",
  materials_ordered: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
  materials_delivered: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
  work_in_progress: "border-jcn-gold-400/30 bg-jcn-gold-500/15 text-jcn-gold-300",
  completed: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
};

export function JourneyView({ jobs, milestones }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("active");
  const [dialog, setDialog] = useState<{
    jobId: string;
    leadId: string | null;
    step: JourneyStep;
  } | null>(null);

  // Agrupar milestones por (lead_id, job_id)
  const milestonesByJob = useMemo(() => {
    const m = new Map<string, JourneyMilestone[]>();
    for (const ms of milestones) {
      const key = ms.job_id ?? `lead-${ms.lead_id}`;
      const arr = m.get(key) ?? [];
      arr.push(ms);
      m.set(key, arr);
    }
    return m;
  }, [milestones]);

  // Compute journey por job (100% manual — usa só milestones)
  const enriched = useMemo(() => {
    return jobs.map((job) => {
      const jobMs = milestonesByJob.get(job.id) ?? [];
      const leadMs = job.lead
        ? milestonesByJob.get(`lead-${job.lead.id}`) ?? []
        : [];
      const allMs = [...jobMs, ...leadMs];
      const steps = computeJourney({ milestones: allMs });
      return {
        job,
        steps,
        completedCount: countCompleted(steps),
        currentStep: currentStep(steps),
      };
    });
  }, [jobs, milestonesByJob]);

  const filtered = useMemo(() => {
    if (filter === "all") return enriched;
    if (filter === "active") {
      return enriched.filter((e) => e.job.current_phase !== "completed");
    }
    return enriched.filter((e) => e.job.current_phase === "completed");
  }, [enriched, filter]);

  const counts = {
    all: enriched.length,
    active: enriched.filter((e) => e.job.current_phase !== "completed").length,
    completed: enriched.filter((e) => e.job.current_phase === "completed").length,
  };

  return (
    <div className="mx-auto mt-6 max-w-7xl space-y-5 px-4 md:px-6">
      {/* Header */}
      <header className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <MapIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
              Jornada do cliente
            </h1>
            <p className="text-xs text-jcn-ice/55">
              Linha do tempo de 12 etapas — do primeiro contato à entrega.
              Click numa etapa pra marcar concluída.
            </p>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <FilterChip
          active={filter === "active"}
          onClick={() => setFilter("active")}
          label="Em andamento"
          count={counts.active}
        />
        <FilterChip
          active={filter === "completed"}
          onClick={() => setFilter("completed")}
          label="Entregues"
          count={counts.completed}
        />
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="Tudo"
          count={counts.all}
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
          <MapIcon className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            Nenhum job nesse filtro
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((e) => (
            <JobJourneyCard
              key={e.job.id}
              job={e.job}
              steps={e.steps}
              completedCount={e.completedCount}
              currentStep={e.currentStep}
              onStepClick={(step) =>
                setDialog({
                  jobId: e.job.id,
                  leadId: e.job.lead?.id ?? null,
                  step,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Dialog marcar etapa */}
      {dialog && (
        <JourneyStepDialog
          open={!!dialog}
          onOpenChange={(o) => {
            if (!o) setDialog(null);
          }}
          jobId={dialog.jobId}
          leadId={dialog.leadId}
          step={dialog.step}
          existingMilestoneId={(() => {
            const jobMs = milestonesByJob.get(dialog.jobId) ?? [];
            const leadMs = dialog.leadId
              ? milestonesByJob.get(`lead-${dialog.leadId}`) ?? []
              : [];
            return [...jobMs, ...leadMs].find(
              (m) => m.kind === dialog.step.kind,
            )?.id;
          })()}
          onDone={() => {
            setDialog(null);
            router.refresh();
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
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
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
      {label}
      <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold normal-case">
        {count}
      </span>
    </button>
  );
}

function JobJourneyCard({
  job,
  steps,
  completedCount,
  currentStep,
  onStepClick,
}: {
  job: JobRow;
  steps: JourneyStep[];
  completedCount: number;
  currentStep: JourneyStep | null;
  onStepClick: (step: JourneyStep) => void;
}) {
  const pct = Math.round((completedCount / steps.length) * 100);
  const contractValue = Number(job.value);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl">
      {/* Header do job */}
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href={`/job/${job.id}`}
            className="group flex items-center gap-2"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
              <MapIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-jcn-ice group-hover:text-jcn-gold-200">
                {job.lead?.name ?? "Cliente sem nome"}
                <ChevronRight className="h-4 w-4 opacity-50" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-jcn-ice/55">
                {job.lead?.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {job.lead.city}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold",
                    PHASE_ACCENT[job.current_phase],
                  )}
                >
                  {JOB_PHASE_LABEL[job.current_phase]}
                </Badge>
                <span>{formatCurrency(contractValue)}</span>
              </div>
            </div>
          </Link>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
            Progresso
          </div>
          <div className="text-2xl font-black text-jcn-gold-300">
            {pct}%
            <span className="ml-1 text-xs text-jcn-ice/55">
              ({completedCount}/{steps.length})
            </span>
          </div>
          {currentStep && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-jcn-ice/65">
              <Clock className="h-3 w-3" />
              Próxima: <b>{currentStep.label}</b>
            </div>
          )}
        </div>
      </header>

      {/* Timeline horizontal */}
      <div className="overflow-x-auto pb-2">
        <ol className="flex min-w-max items-start gap-1">
          {steps.map((step, idx) => (
            <li key={step.kind} className="flex items-start">
              <StepNode step={step} onClick={() => onStepClick(step)} />
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 mt-5 h-0.5 w-6 md:w-10",
                    step.status === "completed"
                      ? "bg-emerald-400/60"
                      : "bg-white/[0.08]",
                  )}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepNode({
  step,
  onClick,
}: {
  step: JourneyStep;
  onClick: () => void;
}) {
  const isCompleted = step.status === "completed";
  const isCurrent = step.status === "current";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center text-center"
      title={
        step.completedAt
          ? `Concluído em ${format(new Date(step.completedAt), "d MMM yyyy", { locale: ptBR })}`
          : "Click pra marcar concluído"
      }
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition",
          isCompleted &&
            "border-emerald-400/60 bg-emerald-500/20 text-emerald-300",
          isCurrent &&
            "animate-pulse border-jcn-gold-400/80 bg-jcn-gold-500/20 text-jcn-gold-300",
          !isCompleted &&
            !isCurrent &&
            "border-white/[0.08] bg-white/[0.02] text-jcn-ice/30 group-hover:border-white/[0.2] group-hover:text-jcn-ice/55",
        )}
      >
        {isCompleted ? (
          <Check className="h-5 w-5" />
        ) : isCurrent ? (
          <TrendingUp className="h-5 w-5" />
        ) : (
          <span className="text-xs font-black">·</span>
        )}
      </div>
      <span
        className={cn(
          "mt-1.5 max-w-[80px] text-[10px] font-bold leading-tight",
          isCompleted && "text-emerald-300",
          isCurrent && "text-jcn-gold-300",
          !isCompleted && !isCurrent && "text-jcn-ice/45",
        )}
      >
        {step.label}
      </span>
    </button>
  );
}
