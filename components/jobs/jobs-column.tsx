"use client";

import { useDroppable } from "@dnd-kit/core";

import { JobCard } from "@/components/jobs/job-card";
import type { JobWithLead } from "@/components/jobs/jobs-board-client";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { JOB_PHASE_LABEL } from "@/lib/labels";
import type { JobPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  phase: JobPhase;
  jobs: JobWithLead[];
};

const PHASE_ACCENT: Record<JobPhase, string> = {
  planning: "bg-sky-400/80",
  materials_ordered: "bg-indigo-400/80",
  materials_arrived: "bg-violet-400/80",
  demo: "bg-rose-400/80",
  construction: "bg-amber-400/80",
  finishing: "bg-orange-400/80",
  completed: "bg-emerald-400/80",
};

export function JobsColumn({ phase, jobs }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: phase });

  const total = jobs.reduce((acc, j) => acc + (j.value ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] flex-none flex-col rounded-2xl border bg-white/[0.025] backdrop-blur-xl transition-colors duration-200",
        isOver
          ? "border-primary/60 bg-primary/[0.05] shadow-[0_0_40px_-10px_rgba(250,204,21,0.4)]"
          : "border-white/[0.06]",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", PHASE_ACCENT[phase])} />
          <h3 className="text-sm font-bold tracking-tight text-white">
            {JOB_PHASE_LABEL[phase]}
          </h3>
        </div>
        <Badge
          variant="outline"
          className="border-white/[0.1] bg-white/[0.04] text-[10px] font-bold tracking-wider text-white/75"
        >
          {jobs.length}
        </Badge>
      </header>

      {total > 0 && (
        <div className="border-b border-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Total: {formatCurrency(total)}
        </div>
      )}

      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-3">
        {jobs.length === 0 ? (
          <p className="py-8 text-center text-xs font-medium text-white/30">
            Nenhum job nesta fase
          </p>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
