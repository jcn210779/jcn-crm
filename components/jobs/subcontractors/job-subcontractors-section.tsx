"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  PauseCircle,
  Plus,
  Wrench,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EditJobSubDialog } from "@/components/jobs/subcontractors/edit-job-sub-dialog";
import { HireSubDialog } from "@/components/jobs/subcontractors/hire-sub-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type {
  ActiveSubOption,
  JobSubcontractorWithSub,
} from "@/lib/job-subs";
import {
  JOB_SUBCONTRACTOR_STATUS_LABEL,
  SUBCONTRACTOR_SPECIALTY_LABEL,
} from "@/lib/labels";
import type {
  JobSubcontractorStatus,
  SubcontractorSpecialty,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string;
  jobSubs: JobSubcontractorWithSub[];
  activeSubs: ActiveSubOption[];
};

const STATUS_TONE: Record<JobSubcontractorStatus, string> = {
  pending: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  in_progress: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

const SPECIALTY_ACCENT: Record<SubcontractorSpecialty, string> = {
  electrical: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  plumbing: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  painting: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  roofing: "bg-stone-500/15 text-stone-300 border-stone-400/30",
  concrete: "bg-zinc-500/15 text-zinc-300 border-zinc-400/30",
  framing: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  hvac: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  landscaping: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  flooring: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  masonry: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  other: "bg-white/[0.05] text-jcn-ice/70 border-white/[0.1]",
};

export function JobSubcontractorsSection({
  jobId,
  jobSubs,
  activeSubs,
}: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] =
    useState<JobSubcontractorWithSub | null>(null);

  const stats = useMemo(() => {
    let inProgressCount = 0;
    let inProgressValue = 0;
    let completedCount = 0;
    let completedValue = 0;
    for (const js of jobSubs) {
      const amt = Number(js.agreed_value);
      if (js.status === "in_progress") {
        inProgressCount++;
        inProgressValue += amt;
      } else if (js.status === "completed") {
        completedCount++;
        completedValue += amt;
      }
    }
    return {
      total: jobSubs.length,
      inProgressCount,
      inProgressValue,
      completedCount,
      completedValue,
    };
  }, [jobSubs]);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-jcn-ice">
              Subempreiteiros
            </h3>
            <p className="text-xs text-jcn-ice/55">
              Eletricista, encanador, pintor e outros externos contratados pra
              esta obra.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="h-10 font-semibold"
          disabled={activeSubs.length === 0}
          title={
            activeSubs.length === 0
              ? "Cadastre um sub em /subcontractors primeiro"
              : undefined
          }
        >
          <Plus className="h-4 w-4" />
          Contratar subempreiteiro
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard
          label="Total contratados"
          value={`${stats.total}`}
          accent="neutral"
        />
        <KpiCard
          label="Em andamento"
          value={`${stats.inProgressCount}`}
          subValue={
            stats.inProgressValue > 0
              ? formatCurrency(stats.inProgressValue)
              : undefined
          }
          accent={stats.inProgressCount > 0 ? "gold" : "neutral"}
        />
        <KpiCard
          label="Total pago"
          value={formatCurrency(stats.completedValue)}
          subValue={
            stats.completedCount > 0
              ? `${stats.completedCount} concluído${
                  stats.completedCount === 1 ? "" : "s"
                }`
              : undefined
          }
          accent={stats.completedCount > 0 ? "green" : "neutral"}
        />
      </div>

      {/* Lista */}
      <div className="mt-5 space-y-2">
        {jobSubs.length === 0 ? (
          <EmptyState
            onAdd={() => setAddOpen(true)}
            hasActiveSubs={activeSubs.length > 0}
          />
        ) : (
          jobSubs.map((js) => (
            <JobSubRow
              key={js.id}
              jobSub={js}
              onOpen={() => setEditTarget(js)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <HireSubDialog
        jobId={jobId}
        activeSubs={activeSubs}
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      {editTarget && (
        <EditJobSubDialog
          jobSub={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onDone={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

type KpiAccent = "gold" | "green" | "neutral";

type KpiCardProps = {
  label: string;
  value: string;
  subValue?: string;
  accent: KpiAccent;
};

function KpiCard({ label, value, subValue, accent }: KpiCardProps) {
  const accentClass: Record<KpiAccent, string> = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    neutral: "border-white/[0.08] bg-white/[0.03] text-jcn-ice",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-3 backdrop-blur-xl",
        accentClass[accent],
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
        {label}
      </div>
      <div className="mt-1.5 text-lg font-black tracking-tight">{value}</div>
      {subValue && <div className="mt-0.5 text-xs opacity-80">{subValue}</div>}
    </div>
  );
}

function EmptyState({
  onAdd,
  hasActiveSubs,
}: {
  onAdd: () => void;
  hasActiveSubs: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
      <Wrench className="mx-auto h-8 w-8 text-jcn-ice/30" />
      <p className="mt-3 text-sm font-semibold text-jcn-ice/65">
        Nenhum subempreiteiro contratado nesta obra
      </p>
      <p className="mt-1 text-xs text-jcn-ice/40">
        {hasActiveSubs
          ? "Contrate eletricista, encanador, pintor e outros pra entrar no cálculo de margem."
          : "Cadastre primeiro um sub em /subcontractors. Depois você consegue contratar aqui."}
      </p>
      {hasActiveSubs && (
        <Button onClick={onAdd} variant="outline" className="mt-4">
          <Plus className="h-4 w-4" />
          Contratar primeiro
        </Button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: JobSubcontractorStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "cancelled") return <XCircle className="h-3 w-3" />;
  if (status === "in_progress") return <Clock className="h-3 w-3" />;
  return <PauseCircle className="h-3 w-3" />;
}

function JobSubRow({
  jobSub,
  onOpen,
}: {
  jobSub: JobSubcontractorWithSub;
  onOpen: () => void;
}) {
  const dateLabel = useMemo(() => {
    const ref =
      jobSub.status === "completed" && jobSub.completed_at
        ? jobSub.completed_at
        : jobSub.status === "cancelled" && jobSub.cancelled_at
          ? jobSub.cancelled_at
          : jobSub.status === "in_progress" && jobSub.started_at
            ? jobSub.started_at
            : jobSub.hired_at;
    return format(new Date(ref), "d 'de' MMM 'de' yyyy", { locale: ptBR });
  }, [jobSub]);

  const subName = jobSub.sub?.name ?? "Sub removido";
  const specialty = jobSub.sub?.specialty ?? null;
  const subCompany = jobSub.sub?.company_name ?? null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04] md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold",
              STATUS_TONE[jobSub.status],
            )}
          >
            <span className="inline-flex items-center gap-1">
              <StatusIcon status={jobSub.status} />
              {JOB_SUBCONTRACTOR_STATUS_LABEL[jobSub.status]}
            </span>
          </Badge>
          {specialty && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                SPECIALTY_ACCENT[specialty],
              )}
            >
              {SUBCONTRACTOR_SPECIALTY_LABEL[specialty]}
            </Badge>
          )}
          <span className="text-sm font-bold text-jcn-ice">{subName}</span>
          {subCompany && (
            <span className="text-xs text-jcn-ice/55">· {subCompany}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
          <span>{dateLabel}</span>
          <span className="italic opacity-80 line-clamp-2">
            {jobSub.service_description}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-base font-black text-jcn-gold-300">
          {formatCurrency(Number(jobSub.agreed_value))}
        </div>
      </div>
    </button>
  );
}

