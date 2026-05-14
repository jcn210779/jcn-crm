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
import { Filter, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { KanbanColumn } from "@/components/kanban/kanban-column";
import { LeadCard } from "@/components/kanban/lead-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCE_LABEL, STAGE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  type Lead,
  type LeadSource,
  type LeadStage,
} from "@/lib/types";

type Props = {
  initialLeads: Lead[];
  userEmail: string;
};

const ALL_VALUE = "__all__";

export function KanbanBoardClient({ initialLeads, userEmail }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>(ALL_VALUE);
  const [sourceFilter, setSourceFilter] = useState<LeadSource | typeof ALL_VALUE>(
    ALL_VALUE,
  );
  const [, startTransition] = useTransition();

  // Realtime: re-busca tudo quando muda algo no banco.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("leads_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
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
    setLeads(initialLeads);
  }, [initialLeads]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) set.add(l.city);
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (cityFilter !== ALL_VALUE && l.city !== cityFilter) return false;
      if (sourceFilter !== ALL_VALUE && l.source !== sourceFilter) return false;
      return true;
    });
  }, [leads, cityFilter, sourceFilter]);

  const byStage = useMemo(() => {
    const map = new Map<LeadStage, Lead[]>();
    for (const stage of LEAD_STAGES) map.set(stage, []);
    for (const l of filtered) map.get(l.stage)?.push(l);
    return map;
  }, [filtered]);

  const activeLead = activeId
    ? leads.find((l) => l.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const overId = String(over.id);
    const newStage = LEAD_STAGES.find((s) => s === overId);
    if (!newStage) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    const previousStage = lead.stage;

    // Optimistic update.
    setLeads((current) =>
      current.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)),
    );

    const supabase = createSupabaseBrowserClient();

    // Seta `app.user_email` via RPC seria o ideal; sem essa func no schema atual,
    // gravamos `created_by` direto no activity_log via RPC futura. Por enquanto
    // a trigger no banco usa current_setting('app.user_email', true) com fallback
    // pra 'system' — vamos sinalizar isso como pendencia pra Fase 2 do banco.

    const { error } = await supabase
      .from("leads")
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (error) {
      // Rollback.
      setLeads((current) =>
        current.map((l) =>
          l.id === leadId ? { ...l, stage: previousStage } : l,
        ),
      );
      toast.error("Não foi possível mover o lead", {
        description: error.message,
      });
      return;
    }

    toast.success(`${lead.name} → ${STAGE_LABEL[newStage]}`);
    startTransition(() => {
      router.refresh();
    });
  }

  const isEmpty = leads.length === 0;

  return (
    <div className="mx-auto mt-4 max-w-[1600px] px-4 md:px-6">
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
          <Filter className="h-3 w-3" />
          Filtros
        </div>

        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="h-9 w-[180px] border-white/[0.08] bg-white/[0.03] text-sm text-white">
            <SelectValue placeholder="Todas cidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas as cidades</SelectItem>
            {availableCities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sourceFilter}
          onValueChange={(v) =>
            setSourceFilter(v as LeadSource | typeof ALL_VALUE)
          }
        >
          <SelectTrigger className="h-9 w-[180px] border-white/[0.08] bg-white/[0.03] text-sm text-white">
            <SelectValue placeholder="Todas as fontes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas as fontes</SelectItem>
            {LEAD_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35 md:inline">
          Usuário: {userEmail}
        </span>
      </div>

      {isEmpty ? (
        <EmptyOnboarding />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-6 [-webkit-overflow-scrolling:touch]">
            {LEAD_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                leads={byStage.get(stage) ?? []}
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead ? <LeadCard lead={activeLead} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* FAB mobile */}
      <Link
        href="/lead/novo"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-black shadow-[0_10px_40px_-10px_rgba(250,204,21,0.6)] transition hover:scale-[1.04] active:scale-95 md:hidden"
        aria-label="Novo lead"
      >
        <Plus className="h-6 w-6" strokeWidth={3} />
      </Link>
    </div>
  );
}

function EmptyOnboarding() {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 text-center backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.02em] text-white">
        Pipeline vazio
      </h2>
      <p className="mt-3 text-sm leading-[1.7] text-white/55">
        Adicione seu primeiro lead pra começar. Em 10 segundos seu Kanban tá vivo.
      </p>
      <Button asChild className="mt-6 h-11 font-semibold">
        <Link href="/lead/novo">
          <Plus className="h-4 w-4" />
          Adicionar primeiro lead
        </Link>
      </Button>
    </div>
  );
}
