"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { HardHat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { JobCard } from "@/components/jobs/job-card";
import { JobsColumn } from "@/components/jobs/jobs-column";
import { JOB_PHASE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { JOB_PHASES, type Job, type JobPhase, type Lead } from "@/lib/types";

export type JobWithLead = Job & { lead: Lead | null };

type Props = {
  initialJobs: JobWithLead[];
};

export function JobsBoardClient({ initialJobs }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithLead[]>(initialJobs);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Realtime: re-busca tudo quando muda algo no banco.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("jobs_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          startTransition(() => {
            router.refresh();
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  // Sincroniza com nova prop quando router.refresh() repassa.
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const byPhase = useMemo(() => {
    const map = new Map<JobPhase, JobWithLead[]>();
    for (const phase of JOB_PHASES) map.set(phase, []);
    for (const j of jobs) map.get(j.current_phase)?.push(j);
    return map;
  }, [jobs]);

  const activeJob = activeId ? jobs.find((j) => j.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const jobId = String(active.id);
    const overId = String(over.id);
    const newPhase = JOB_PHASES.find((p) => p === overId);
    if (!newPhase) return;

    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.current_phase === newPhase) return;

    const previousPhase = job.current_phase;

    // Optimistic update.
    setJobs((current) =>
      current.map((j) =>
        j.id === jobId ? { ...j, current_phase: newPhase } : j,
      ),
    );

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("jobs")
      .update({ current_phase: newPhase })
      .eq("id", jobId);

    if (error) {
      // Rollback.
      setJobs((current) =>
        current.map((j) =>
          j.id === jobId ? { ...j, current_phase: previousPhase } : j,
        ),
      );
      toast.error("Não foi possível mover o job", {
        description: error.message,
      });
      return;
    }

    const clientName = job.lead?.name ?? "Job";
    toast.success(`${clientName} → ${JOB_PHASE_LABEL[newPhase]}`);
    startTransition(() => {
      router.refresh();
    });
  }

  const isEmpty = jobs.length === 0;

  return (
    <div className="mx-auto mt-4 max-w-[1600px] px-4 md:px-6">
      {isEmpty ? (
        <EmptyState />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-6 [-webkit-overflow-scrolling:touch]">
            {JOB_PHASES.map((phase) => (
              <JobsColumn
                key={phase}
                phase={phase}
                jobs={byPhase.get(phase) ?? []}
              />
            ))}
          </div>

          <DragOverlay>
            {activeJob ? <JobCard job={activeJob} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 text-center backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HardHat className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.02em] text-white">
        Nenhuma obra ativa
      </h2>
      <p className="mt-3 text-sm leading-[1.7] text-white/55">
        Quando você marcar um lead como ganho no pipeline, ele aparece aqui automaticamente como job em planejamento.
      </p>
    </div>
  );
}
