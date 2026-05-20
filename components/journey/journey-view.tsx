"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Map as MapIcon,
  MapPin,
  TrendingUp,
  UserMinus,
  XCircle,
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
import { JOB_PHASE_LABEL, STAGE_LABEL } from "@/lib/labels";
import type {
  Job,
  JobPhase,
  JourneyMilestone,
  Lead,
  LeadStage,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type JobRow = Job & {
  lead: Pick<Lead, "id" | "name" | "city" | "phone" | "email" | "stage"> | null;
};

type Props = {
  jobs: JobRow[];
  leadsWithoutJob: Lead[];
  milestones: JourneyMilestone[];
};

type Section = "pipeline" | "won" | "delivered" | "lost";

const PHASE_ACCENT: Record<JobPhase, string> = {
  planning: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  permit_released: "border-violet-400/30 bg-violet-500/15 text-violet-300",
  materials_ordered: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
  materials_delivered: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
  work_in_progress: "border-jcn-gold-400/30 bg-jcn-gold-500/15 text-jcn-gold-300",
  completed: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
};

const STAGE_ACCENT: Record<LeadStage, string> = {
  novo: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  contato_feito: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
  visita_agendada: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
  cotando: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  estimate_enviado: "border-jcn-gold-400/30 bg-jcn-gold-500/15 text-jcn-gold-300",
  follow_up: "border-orange-400/30 bg-orange-500/15 text-orange-300",
  ganho: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  perdido: "border-rose-400/30 bg-rose-500/15 text-rose-300",
};

export function JourneyView({ jobs, leadsWithoutJob, milestones }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("pipeline");
  const [dialog, setDialog] = useState<{
    jobId: string | null;
    leadId: string | null;
    step: JourneyStep;
  } | null>(null);

  // Agrupar milestones por (lead_id, job_id)
  const milestonesByKey = useMemo(() => {
    const m = new Map<string, JourneyMilestone[]>();
    for (const ms of milestones) {
      if (ms.job_id) {
        const arr = m.get(`job-${ms.job_id}`) ?? [];
        arr.push(ms);
        m.set(`job-${ms.job_id}`, arr);
      }
      if (ms.lead_id) {
        const arr = m.get(`lead-${ms.lead_id}`) ?? [];
        arr.push(ms);
        m.set(`lead-${ms.lead_id}`, arr);
      }
    }
    return m;
  }, [milestones]);

  // Separar jobs em ativos vs entregues
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.current_phase !== "completed"),
    [jobs],
  );
  const deliveredJobs = useMemo(
    () => jobs.filter((j) => j.current_phase === "completed"),
    [jobs],
  );

  // Separar leads em pipeline vs perdidos
  const pipelineLeads = useMemo(
    () => leadsWithoutJob.filter((l) => l.stage !== "perdido"),
    [leadsWithoutJob],
  );
  const lostLeads = useMemo(
    () => leadsWithoutJob.filter((l) => l.stage === "perdido"),
    [leadsWithoutJob],
  );

  const counts = {
    pipeline: pipelineLeads.length,
    won: activeJobs.length,
    delivered: deliveredJobs.length,
    lost: lostLeads.length,
  };

  function getStepsForLead(leadId: string): JourneyStep[] {
    const ms = milestonesByKey.get(`lead-${leadId}`) ?? [];
    return computeJourney({ milestones: ms });
  }

  function getStepsForJob(jobId: string, leadId: string | null): JourneyStep[] {
    const jobMs = milestonesByKey.get(`job-${jobId}`) ?? [];
    const leadMs = leadId ? milestonesByKey.get(`lead-${leadId}`) ?? [] : [];
    return computeJourney({ milestones: [...jobMs, ...leadMs] });
  }

  function findExistingMilestone(
    jobId: string | null,
    leadId: string | null,
    kind: JourneyStep["kind"],
  ): string | undefined {
    const jobMs = jobId ? milestonesByKey.get(`job-${jobId}`) ?? [] : [];
    const leadMs = leadId ? milestonesByKey.get(`lead-${leadId}`) ?? [] : [];
    return [...jobMs, ...leadMs].find((m) => m.kind === kind)?.id;
  }

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

      {/* Tabs/Seções */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <SectionChip
          active={section === "pipeline"}
          onClick={() => setSection("pipeline")}
          icon={TrendingUp}
          label="Em pipeline"
          count={counts.pipeline}
          accent="amber"
        />
        <SectionChip
          active={section === "won"}
          onClick={() => setSection("won")}
          icon={Briefcase}
          label="Vendidos"
          count={counts.won}
          accent="gold"
        />
        <SectionChip
          active={section === "delivered"}
          onClick={() => setSection("delivered")}
          icon={CheckCircle2}
          label="Entregues"
          count={counts.delivered}
          accent="emerald"
        />
        <SectionChip
          active={section === "lost"}
          onClick={() => setSection("lost")}
          icon={XCircle}
          label="Perdidos"
          count={counts.lost}
          accent="rose"
        />
      </div>

      {/* Conteúdo por seção */}
      {section === "pipeline" && (
        <SectionContent
          isEmpty={pipelineLeads.length === 0}
          emptyMessage="Nenhum lead em pipeline. Os leads ativos sem job aparecem aqui."
          emptyIcon={TrendingUp}
        >
          {pipelineLeads.map((lead) => (
            <LeadJourneyCard
              key={lead.id}
              lead={lead}
              steps={getStepsForLead(lead.id)}
              onStepClick={(step) =>
                setDialog({ jobId: null, leadId: lead.id, step })
              }
            />
          ))}
        </SectionContent>
      )}

      {section === "won" && (
        <SectionContent
          isEmpty={activeJobs.length === 0}
          emptyMessage="Nenhum job ativo no momento."
          emptyIcon={Briefcase}
        >
          {activeJobs.map((job) => (
            <JobJourneyCard
              key={job.id}
              job={job}
              steps={getStepsForJob(job.id, job.lead?.id ?? null)}
              onStepClick={(step) =>
                setDialog({
                  jobId: job.id,
                  leadId: job.lead?.id ?? null,
                  step,
                })
              }
            />
          ))}
        </SectionContent>
      )}

      {section === "delivered" && (
        <SectionContent
          isEmpty={deliveredJobs.length === 0}
          emptyMessage="Nenhum job entregue ainda."
          emptyIcon={CheckCircle2}
        >
          {deliveredJobs.map((job) => (
            <JobJourneyCard
              key={job.id}
              job={job}
              steps={getStepsForJob(job.id, job.lead?.id ?? null)}
              onStepClick={(step) =>
                setDialog({
                  jobId: job.id,
                  leadId: job.lead?.id ?? null,
                  step,
                })
              }
            />
          ))}
        </SectionContent>
      )}

      {section === "lost" && (
        <SectionContent
          isEmpty={lostLeads.length === 0}
          emptyMessage="Nenhum lead perdido. Bom sinal."
          emptyIcon={UserMinus}
        >
          {lostLeads.map((lead) => (
            <LeadJourneyCard
              key={lead.id}
              lead={lead}
              steps={getStepsForLead(lead.id)}
              onStepClick={(step) =>
                setDialog({ jobId: null, leadId: lead.id, step })
              }
              isLost
            />
          ))}
        </SectionContent>
      )}

      {/* Dialog */}
      {dialog && (
        <JourneyStepDialog
          open={!!dialog}
          onOpenChange={(o) => {
            if (!o) setDialog(null);
          }}
          jobId={dialog.jobId ?? ""}
          leadId={dialog.leadId}
          step={dialog.step}
          existingMilestoneId={findExistingMilestone(
            dialog.jobId,
            dialog.leadId,
            dialog.step.kind,
          )}
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SectionContent({
  isEmpty,
  emptyMessage,
  emptyIcon: Icon,
  children,
}: {
  isEmpty: boolean;
  emptyMessage: string;
  emptyIcon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  if (isEmpty) {
    return (
      <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
        <Icon className="mx-auto h-10 w-10 text-jcn-ice/30" />
        <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
          {emptyMessage}
        </p>
      </div>
    );
  }
  return <div className="space-y-4">{children}</div>;
}

function SectionChip({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  accent: "amber" | "gold" | "emerald" | "rose";
}) {
  const activeAccent = {
    amber: "border-amber-400/40 bg-amber-500/10 text-amber-300",
    gold: "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300",
    emerald: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    rose: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition",
        active
          ? activeAccent
          : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
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
  onStepClick,
}: {
  job: JobRow;
  steps: JourneyStep[];
  onStepClick: (step: JourneyStep) => void;
}) {
  const completedCount = countCompleted(steps);
  const current = currentStep(steps);
  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Link href={`/job/${job.id}`} className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Briefcase className="h-5 w-5" />
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
              <span>{formatCurrency(Number(job.value))}</span>
            </div>
          </div>
        </Link>
        <ProgressBlock pct={pct} done={completedCount} total={steps.length} next={current} />
      </header>

      <Timeline steps={steps} onStepClick={onStepClick} />
    </section>
  );
}

function LeadJourneyCard({
  lead,
  steps,
  onStepClick,
  isLost = false,
}: {
  lead: Lead;
  steps: JourneyStep[];
  onStepClick: (step: JourneyStep) => void;
  isLost?: boolean;
}) {
  const completedCount = countCompleted(steps);
  const current = currentStep(steps);
  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <section
      className={cn(
        "rounded-3xl border p-5 backdrop-blur-xl",
        isLost
          ? "border-rose-400/15 bg-rose-500/[0.025] opacity-80"
          : "border-white/[0.06] bg-white/[0.025]",
      )}
    >
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Link
          href={`/lead/${lead.id}`}
          className="group flex items-center gap-3"
        >
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              isLost
                ? "bg-rose-500/15 text-rose-300"
                : "bg-amber-500/15 text-amber-300",
            )}
          >
            {isLost ? (
              <UserMinus className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-jcn-ice group-hover:text-jcn-gold-200">
              {lead.name}
              <ChevronRight className="h-4 w-4 opacity-50" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-jcn-ice/55">
              {lead.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {lead.city}
                </span>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  STAGE_ACCENT[lead.stage],
                )}
              >
                {STAGE_LABEL[lead.stage]}
              </Badge>
              {lead.estimated_value && Number(lead.estimated_value) > 0 && (
                <span>
                  est. {formatCurrency(Number(lead.estimated_value))}
                </span>
              )}
            </div>
          </div>
        </Link>
        <ProgressBlock pct={pct} done={completedCount} total={steps.length} next={current} />
      </header>

      <Timeline steps={steps} onStepClick={onStepClick} />
    </section>
  );
}

function ProgressBlock({
  pct,
  done,
  total,
  next,
}: {
  pct: number;
  done: number;
  total: number;
  next: JourneyStep | null;
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
        Progresso
      </div>
      <div className="text-2xl font-black text-jcn-gold-300">
        {pct}%
        <span className="ml-1 text-xs text-jcn-ice/55">
          ({done}/{total})
        </span>
      </div>
      {next && (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-jcn-ice/65">
          <Clock className="h-3 w-3" />
          Próxima: <b>{next.label}</b>
        </div>
      )}
    </div>
  );
}

function Timeline({
  steps,
  onStepClick,
}: {
  steps: JourneyStep[];
  onStepClick: (step: JourneyStep) => void;
}) {
  return (
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
          <CheckCircle2 className="h-5 w-5" />
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
