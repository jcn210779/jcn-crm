"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInCalendarDays } from "date-fns";
import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

import type { JobWithLead } from "@/components/jobs/jobs-board-client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  job: JobWithLead;
  dragging?: boolean;
};

export function JobCard({ job, dragging }: Props) {
  const router = useRouter();

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: job.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  // "Dias em fase atual" — calcula a partir do updated_at do job
  // (atualizado sempre que muda current_phase via trigger fn_jobs_set_updated_at).
  const daysInPhase = Math.max(
    0,
    differenceInCalendarDays(new Date(), new Date(job.updated_at)),
  );

  const clientName = job.lead?.name ?? "Cliente sem nome";
  const city = job.lead?.city ?? "—";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => router.push(`/job/${job.id}`)}
      className={cn(
        "group cursor-grab rounded-xl border border-white/[0.06] bg-white/[0.035] p-3 transition-all duration-200 active:cursor-grabbing",
        "hover:border-white/[0.12] hover:bg-white/[0.06]",
        isDragging && "opacity-30",
        dragging &&
          "scale-[1.04] rotate-[1.5deg] border-primary/60 bg-white/[0.08] shadow-[0_20px_60px_-20px_rgba(250,204,21,0.4)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold tracking-tight text-white">
          {clientName}
        </h4>
        {job.value > 0 ? (
          <span className="shrink-0 text-xs font-bold text-primary">
            {formatCurrency(job.value)}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-white/55">
        <MapPin className="h-3 w-3" />
        <span className="truncate">{city}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
        <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-white/50">
          {daysInPhase === 0 ? "Hoje" : `${daysInPhase}d na fase`}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/job/${job.id}`);
        }}
        className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80 opacity-0 transition group-hover:opacity-100"
      >
        Abrir detalhes →
      </button>
    </div>
  );
}
