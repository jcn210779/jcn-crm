"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TASK_TYPE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { Lead, Task, TaskType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tasks: Task[];
  leads: Lead[];
  userEmail: string;
};

type PeriodFilter = "today" | "7d" | "30d" | "all";
type TypeFilter = TaskType | "all";

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "all", label: "Tudo" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "followup", label: "Follow-up" },
  { value: "call", label: "Ligação" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "visit", label: "Visita" },
  { value: "internal", label: "Interno" },
];

export function TasksList({ tasks, leads, userEmail }: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const leadById = useMemo(() => {
    const map = new Map<string, Lead>();
    leads.forEach((l) => map.set(l.id, l));
    return map;
  }, [leads]);

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;

      if (period !== "all") {
        const due = new Date(t.due_date).getTime();
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const endToday = today.getTime();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        let endLimit = endToday;
        if (period === "7d") endLimit = endToday + 6 * 24 * 60 * 60 * 1000;
        if (period === "30d") endLimit = endToday + 29 * 24 * 60 * 60 * 1000;
        // tarefas atrasadas sempre entram (importante pra dashboard)
        if (due > endLimit) return false;
      }
      return true;
    });
  }, [tasks, typeFilter, period]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => new Date(t.due_date).getTime() < now.getTime()).length,
    [tasks, now],
  );

  async function markDone(task: Task) {
    if (!confirm(`Marcar "${task.title}" como feita?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    if (error) {
      toast.error("Erro ao marcar feita", { description: error.message });
      return;
    }
    if (task.lead_id) {
      await supabase.from("activity_log").insert({
        lead_id: task.lead_id,
        type: "task_done",
        created_by: userEmail || "system",
        payload: { task_id: task.id, title: task.title, type: task.type },
      });
    }
    toast.success("Tarefa marcada como feita");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-5 px-4 md:px-6">
      {/* Header + métricas */}
      <header className="flex flex-col gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.02em] text-white md:text-4xl">
            Tarefas
          </h1>
          <p className="mt-1 text-sm text-white/55">
            {tasks.length} pendente{tasks.length === 1 ? "" : "s"}
            {overdueCount > 0 ? ` · ${overdueCount} atrasada${overdueCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        {overdueCount > 0 && (
          <Badge variant="destructive" className="self-start">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {overdueCount} atrasada{overdueCount === 1 ? "" : "s"}
          </Badge>
        )}
      </header>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition",
                period === opt.value
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/[0.08] bg-white/[0.025] text-white/55 hover:text-white",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition",
                typeFilter === opt.value
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/[0.08] bg-white/[0.025] text-white/55 hover:text-white",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-16 text-center">
          <CalendarCheck2 className="mx-auto h-10 w-10 text-white/25" />
          <p className="mt-4 text-base font-bold text-white">
            Nada pendente nesse filtro
          </p>
          <p className="mt-1 text-sm text-white/45">
            Ajuste período/tipo ou agende um follow-up num lead
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {filtered.map((t) => {
            const due = new Date(t.due_date);
            const isOverdue = due.getTime() < now.getTime();
            const lead = t.lead_id ? leadById.get(t.lead_id) : null;
            return (
              <li
                key={t.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-4 backdrop-blur-xl md:flex-row md:items-center",
                  isOverdue
                    ? "border-red-500/30 bg-red-500/[0.04]"
                    : "border-white/[0.06] bg-white/[0.025]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isOverdue && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    )}
                    <Badge
                      variant={isOverdue ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {TASK_TYPE_LABEL[t.type]}
                    </Badge>
                    <p className="truncate text-sm font-bold text-white">
                      {t.title}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                      isOverdue ? "text-red-400" : "text-white/40",
                    )}
                  >
                    {isOverdue ? "Atrasado " : "Vence "}
                    {formatDistanceToNow(due, {
                      locale: ptBR,
                      addSuffix: true,
                    })}{" "}
                    · {format(due, "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                  {lead && (
                    <Link
                      href={`/lead/${lead.id}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:underline"
                    >
                      <MapPin className="h-3 w-3" />
                      {lead.name} · {lead.city}
                    </Link>
                  )}
                  {t.notes && (
                    <p className="mt-2 text-xs text-white/55">{t.notes}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markDone(t)}
                  className="h-9 border-white/[0.1] text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar feita
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
