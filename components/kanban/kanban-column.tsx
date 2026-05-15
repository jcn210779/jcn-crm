"use client";

import { useDroppable } from "@dnd-kit/core";

import { LeadCard } from "@/components/kanban/lead-card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { STAGE_LABEL } from "@/lib/labels";
import type { Lead, LeadStage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  stage: LeadStage;
  leads: Lead[];
};

const STAGE_ACCENT: Record<LeadStage, string> = {
  novo: "bg-sky-400/80",
  contato_feito: "bg-indigo-400/80",
  visita_agendada: "bg-violet-400/80",
  cotando: "bg-jcn-gold-400/80",
  estimate_enviado: "bg-orange-400/80",
  follow_up: "bg-yellow-500/80",
  ganho: "bg-emerald-400/80",
  perdido: "bg-rose-400/80",
};

export function KanbanColumn({ stage, leads }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const total = leads.reduce(
    (acc, l) => acc + (l.estimated_value ?? 0),
    0,
  );

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
          <span
            className={cn("h-2 w-2 rounded-full", STAGE_ACCENT[stage])}
          />
          <h3 className="text-sm font-bold tracking-tight text-white">
            {STAGE_LABEL[stage]}
          </h3>
        </div>
        <Badge
          variant="outline"
          className="border-white/[0.1] bg-white/[0.04] text-[10px] font-bold tracking-wider text-white/75"
        >
          {leads.length}
        </Badge>
      </header>

      {total > 0 && (
        <div className="border-b border-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Pipeline: {formatCurrency(total)}
        </div>
      )}

      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-3">
        {leads.length === 0 ? (
          <p className="py-8 text-center text-xs font-medium text-white/30">
            Nenhum lead nesta etapa
          </p>
        ) : (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
