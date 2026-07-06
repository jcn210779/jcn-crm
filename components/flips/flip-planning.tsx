"use client";

/**
 * FlipPlanning — Pipeline do Flip (mig 0049)
 *
 * 3 seções compactas dentro de 1 card:
 *  - Fases (sequência de trabalhos, template automático de 10)
 *  - Inspeções (cidade + interna)
 *  - Checklist (tarefas consolidadas do flip)
 *
 * Todas com adicionar/editar status/apagar. Otimizado pra mobile-first.
 */

import {
  Building,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  Loader2,
  Pause,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  FlipInspection,
  FlipInspectionStatus,
  FlipInspectionType,
  FlipPhase,
  FlipPhaseStatus,
  FlipTask,
  FlipTaskStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  flipId: string;
};

const PHASE_STATUS_TONE: Record<FlipPhaseStatus, string> = {
  pending: "border-white/[0.08] bg-white/[0.03] text-jcn-ice/60",
  in_progress: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  blocked: "border-rose-400/30 bg-rose-500/10 text-rose-300",
};

const PHASE_STATUS_LABEL: Record<FlipPhaseStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  blocked: "Bloqueada",
};

const INSPECTION_STATUS_TONE: Record<FlipInspectionStatus, string> = {
  scheduled: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  passed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  rescheduled: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  cancelled: "border-white/[0.08] bg-white/[0.03] text-jcn-ice/45",
};

const INSPECTION_STATUS_LABEL: Record<FlipInspectionStatus, string> = {
  scheduled: "Agendada",
  passed: "Aprovada",
  failed: "Reprovada",
  rescheduled: "Reagendada",
  cancelled: "Cancelada",
};

const TASK_STATUS_LABEL: Record<FlipTaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Feito",
  cancelled: "Cancelada",
};

/**
 * Formata ISO timestamp pra valor de <input type="datetime-local"> (YYYY-MM-DDTHH:MM).
 * Usa timezone local do browser.
 */
function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Formata ISO pra exibição curta (dd/MM HH:mm).
 */
function formatDateTimeShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Gera link do Google Calendar pré-preenchido. Abre em nova aba —
 * José confirma no gCal e evento vai pra agenda dele.
 */
function googleCalendarUrl(opts: {
  title: string;
  startIso: string;
  endIso?: string;
  details?: string;
  location?: string;
}): string {
  const toGoogleFormat = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
      `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
  };
  const startG = toGoogleFormat(opts.startIso);
  const endG = toGoogleFormat(
    opts.endIso ?? new Date(new Date(opts.startIso).getTime() + 60 * 60 * 1000).toISOString(),
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${startG}/${endG}`,
  });
  if (opts.details) params.set("details", opts.details);
  if (opts.location) params.set("location", opts.location);
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export function FlipPlanning({ flipId }: Props) {
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<FlipPhase[]>([]);
  const [inspections, setInspections] = useState<FlipInspection[]>([]);
  const [tasks, setTasks] = useState<FlipTask[]>([]);

  // Add-phase
  const [newPhaseName, setNewPhaseName] = useState("");
  // Add-inspection
  const [newInspType, setNewInspType] =
    useState<FlipInspectionType>("city");
  const [newInspName, setNewInspName] = useState("");
  const [newInspDateTime, setNewInspDateTime] = useState("");
  // Add-task
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPhaseId, setNewTaskPhaseId] = useState<string>("");
  const [newTaskDueDateTime, setNewTaskDueDateTime] = useState("");

  async function reload() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const [p, i, t] = await Promise.all([
      supabase
        .from("flip_phases")
        .select("*")
        .eq("flip_id", flipId)
        .order("display_order"),
      supabase
        .from("flip_inspections")
        .select("*")
        .eq("flip_id", flipId)
        .order("scheduled_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("flip_tasks")
        .select("*")
        .eq("flip_id", flipId)
        .order("display_order"),
    ]);
    setPhases((p.data ?? []) as FlipPhase[]);
    setInspections((i.data ?? []) as FlipInspection[]);
    setTasks((t.data ?? []) as FlipTask[]);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipId]);

  async function cyclePhaseStatus(phase: FlipPhase) {
    // pending → in_progress → completed → pending
    const next: FlipPhaseStatus =
      phase.status === "pending"
        ? "in_progress"
        : phase.status === "in_progress"
          ? "completed"
          : "pending";
    const today = new Date().toISOString().slice(0, 10);
    const patch: {
      status: FlipPhaseStatus;
      started_at?: string | null;
      completed_at?: string | null;
    } = { status: next };
    if (next === "in_progress" && !phase.started_at) patch.started_at = today;
    if (next === "completed") patch.completed_at = today;
    if (next === "pending") {
      patch.started_at = null;
      patch.completed_at = null;
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_phases")
      .update(patch)
      .eq("id", phase.id);
    if (error) {
      toast.error("Erro ao atualizar fase", { description: error.message });
      return;
    }
    await reload();
  }

  async function togglePhaseBlocked(phase: FlipPhase) {
    const supabase = createSupabaseBrowserClient();
    const next: FlipPhaseStatus =
      phase.status === "blocked" ? "pending" : "blocked";
    const { error } = await supabase
      .from("flip_phases")
      .update({ status: next })
      .eq("id", phase.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await reload();
  }

  async function deletePhase(phase: FlipPhase) {
    if (
      !confirm(
        `Apagar fase "${phase.name}"?\n\nTarefas dessa fase ficam sem fase vinculada (não são apagadas).`,
      )
    )
      return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_phases")
      .delete()
      .eq("id", phase.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Fase apagada");
    await reload();
  }

  async function addPhase() {
    if (!newPhaseName.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const nextOrder =
      phases.length > 0
        ? Math.max(...phases.map((p) => p.display_order)) + 1
        : 1;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_phases").insert({
      flip_id: flipId,
      name: newPhaseName.trim(),
      display_order: nextOrder,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setNewPhaseName("");
    await reload();
  }

  async function addInspection() {
    if (!newInspName.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const scheduled = newInspDateTime
      ? new Date(newInspDateTime).toISOString()
      : null;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("flip_inspections")
      .insert({
        flip_id: flipId,
        type: newInspType,
        name: newInspName.trim(),
        scheduled_date: scheduled,
      })
      .select("id")
      .single();
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    // Se tem data/hora, oferece link do Google Calendar
    if (scheduled && data) {
      const url = googleCalendarUrl({
        title: `${newInspType === "city" ? "Inspeção cidade" : "Inspeção interna"}: ${newInspName.trim()}`,
        startIso: scheduled,
        details: `Flip JCN · inspeção ${newInspType === "city" ? "da cidade" : "interna"}`,
      });
      toast.success("Inspeção criada", {
        description: "Click no toast pra abrir no Google Agenda",
        action: {
          label: "Google Agenda",
          onClick: () => window.open(url, "_blank"),
        },
        duration: 8000,
      });
    } else {
      toast.success("Inspeção criada");
    }
    setNewInspName("");
    setNewInspDateTime("");
    await reload();
  }

  async function cycleInspectionStatus(insp: FlipInspection) {
    // scheduled → passed → failed → rescheduled → scheduled
    const order: FlipInspectionStatus[] = [
      "scheduled",
      "passed",
      "failed",
      "rescheduled",
    ];
    const idx = order.indexOf(insp.status);
    const next = order[(idx + 1) % order.length]!;
    const patch: {
      status: FlipInspectionStatus;
      done_date?: string | null;
    } = { status: next };
    if (next === "passed" || next === "failed") {
      patch.done_date = new Date().toISOString().slice(0, 10);
    }
    if (next === "scheduled") patch.done_date = null;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_inspections")
      .update(patch)
      .eq("id", insp.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await reload();
  }

  async function deleteInspection(insp: FlipInspection) {
    if (!confirm(`Apagar inspeção "${insp.name}"?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_inspections")
      .delete()
      .eq("id", insp.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Inspeção apagada");
    await reload();
  }

  async function addTask() {
    if (!newTaskTitle.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    const nextOrder =
      tasks.length > 0
        ? Math.max(...tasks.map((t) => t.display_order)) + 1
        : 1;
    const due = newTaskDueDateTime
      ? new Date(newTaskDueDateTime).toISOString()
      : null;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("flip_tasks").insert({
      flip_id: flipId,
      phase_id: newTaskPhaseId || null,
      title: newTaskTitle.trim(),
      display_order: nextOrder,
      due_date: due,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    if (due) {
      const phase = phases.find((p) => p.id === newTaskPhaseId);
      const url = googleCalendarUrl({
        title: `Tarefa: ${newTaskTitle.trim()}`,
        startIso: due,
        details: `Flip JCN${phase ? ` · fase ${phase.name}` : ""}`,
      });
      toast.success("Tarefa criada", {
        description: "Click no toast pra abrir no Google Agenda",
        action: {
          label: "Google Agenda",
          onClick: () => window.open(url, "_blank"),
        },
        duration: 8000,
      });
    } else {
      toast.success("Tarefa criada");
    }
    setNewTaskTitle("");
    setNewTaskPhaseId("");
    setNewTaskDueDateTime("");
    await reload();
  }

  async function toggleTaskDone(task: FlipTask) {
    const next: FlipTaskStatus = task.status === "done" ? "todo" : "done";
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_tasks")
      .update({
        status: next,
        done_at: next === "done" ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await reload();
  }

  async function deleteTask(task: FlipTask) {
    if (!confirm(`Apagar tarefa "${task.title}"?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("flip_tasks")
      .delete()
      .eq("id", task.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Tarefa apagada");
    await reload();
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-jcn-gold-300" />
        </div>
      </section>
    );
  }

  const completedPhases = phases.filter((p) => p.status === "completed").length;
  const totalPhases = phases.length;
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const pendingInspections = inspections.filter(
    (i) => i.status === "scheduled" || i.status === "rescheduled",
  ).length;

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            Planejamento do flip
          </h2>
          <p className="mt-1 text-[11px] text-jcn-ice/45">
            {completedPhases}/{totalPhases} fases · {openTasks} tarefa(s) aberta(s) ·{" "}
            {pendingInspections} inspeção(ões) pendente(s)
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Fases */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Building className="h-4 w-4 text-jcn-gold-300" />
            <h3 className="text-sm font-bold text-jcn-ice">Fases</h3>
          </div>

          <div className="space-y-1.5">
            {phases.map((phase) => (
              <div
                key={phase.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs",
                  PHASE_STATUS_TONE[phase.status],
                )}
              >
                <button
                  type="button"
                  onClick={() => cyclePhaseStatus(phase)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title="Click pra mudar status"
                >
                  {phase.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : phase.status === "in_progress" ? (
                    <Clock className="h-4 w-4 shrink-0 animate-pulse" />
                  ) : phase.status === "blocked" ? (
                    <Pause className="h-4 w-4 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {phase.name}{" "}
                    <span className="text-[9px] opacity-70">
                      · {PHASE_STATUS_LABEL[phase.status]}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => togglePhaseBlocked(phase)}
                  className="rounded p-1 opacity-45 hover:opacity-100"
                  title={
                    phase.status === "blocked"
                      ? "Desbloquear"
                      : "Marcar bloqueada"
                  }
                >
                  <Pause className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => deletePhase(phase)}
                  className="rounded p-1 opacity-45 hover:bg-rose-500/20 hover:text-rose-300 hover:opacity-100"
                  title="Apagar"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {phases.length === 0 && (
              <p className="py-2 text-center text-xs italic text-jcn-ice/40">
                Nenhuma fase — adicione uma abaixo
              </p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              placeholder="Nova fase..."
              className="h-9 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addPhase();
                }
              }}
            />
            <Button
              type="button"
              onClick={addPhase}
              className="h-9 shrink-0 px-3"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Inspeções */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-jcn-gold-300" />
            <h3 className="text-sm font-bold text-jcn-ice">Inspeções</h3>
          </div>

          <div className="space-y-1.5">
            {inspections.map((insp) => (
              <div
                key={insp.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs",
                  INSPECTION_STATUS_TONE[insp.status],
                )}
              >
                <button
                  type="button"
                  onClick={() => cycleInspectionStatus(insp)}
                  className="min-w-0 flex-1 text-left"
                  title="Click pra mudar status"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="rounded bg-white/10 px-1 text-[9px] uppercase">
                      {insp.type === "city" ? "Cidade" : "Interna"}
                    </span>
                    <span className="truncate font-semibold">{insp.name}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] opacity-80">
                    {INSPECTION_STATUS_LABEL[insp.status]}
                    {insp.scheduled_date &&
                      ` · ${formatDateTimeShort(insp.scheduled_date)}`}
                    {insp.done_date &&
                      ` · feito ${formatDateTimeShort(insp.done_date)}`}
                  </div>
                </button>
                {insp.scheduled_date && (
                  <a
                    href={googleCalendarUrl({
                      title: `${insp.type === "city" ? "Inspeção cidade" : "Inspeção interna"}: ${insp.name}`,
                      startIso: insp.scheduled_date,
                      details: `Flip JCN · ${insp.type === "city" ? "cidade" : "interna"}`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded p-1 opacity-60 hover:bg-sky-500/20 hover:text-sky-300 hover:opacity-100"
                    title="Adicionar ao Google Agenda"
                  >
                    <CalendarPlus className="h-3 w-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => deleteInspection(insp)}
                  className="shrink-0 rounded p-1 opacity-45 hover:bg-rose-500/20 hover:text-rose-300 hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {inspections.length === 0 && (
              <p className="py-2 text-center text-xs italic text-jcn-ice/40">
                Nenhuma inspeção
              </p>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newInspType}
                onChange={(e) =>
                  setNewInspType(e.target.value as FlipInspectionType)
                }
                className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-xs text-jcn-ice"
              >
                <option value="city">Cidade</option>
                <option value="internal">Interna</option>
              </select>
              <Input
                type="datetime-local"
                value={newInspDateTime}
                onChange={(e) => setNewInspDateTime(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={newInspName}
                onChange={(e) => setNewInspName(e.target.value)}
                placeholder="Ex: Framing inspection"
                className="h-9 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addInspection();
                  }
                }}
              />
              <Button
                type="button"
                onClick={addInspection}
                className="h-9 shrink-0 px-3"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-jcn-gold-300" />
            <h3 className="text-sm font-bold text-jcn-ice">Checklist</h3>
          </div>

          <div className="space-y-1.5">
            {tasks.map((task) => {
              const phase = phases.find((p) => p.id === task.phase_id);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs",
                    task.status === "done"
                      ? "border-emerald-400/20 bg-emerald-500/5 text-jcn-ice/45 line-through"
                      : "border-white/[0.08] bg-white/[0.03]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleTaskDone(task)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    ) : (
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jcn-ice/45" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{task.title}</p>
                      {(phase || task.due_date) && (
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[9px] uppercase opacity-70">
                          {phase && (
                            <span className="rounded bg-white/10 px-1">
                              {phase.name}
                            </span>
                          )}
                          {task.due_date && (
                            <span>Até {formatDateTimeShort(task.due_date)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                  {task.due_date && task.status !== "done" && (
                    <a
                      href={googleCalendarUrl({
                        title: `Tarefa: ${task.title}`,
                        startIso: task.due_date,
                        details: `Flip JCN${phase ? ` · fase ${phase.name}` : ""}`,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded p-1 opacity-60 hover:bg-sky-500/20 hover:text-sky-300 hover:opacity-100"
                      title="Adicionar ao Google Agenda"
                    >
                      <CalendarPlus className="h-3 w-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteTask(task)}
                    className="shrink-0 rounded p-1 opacity-45 hover:bg-rose-500/20 hover:text-rose-300 hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <p className="py-2 text-center text-xs italic text-jcn-ice/40">
                Nenhuma tarefa
              </p>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Nova tarefa..."
              className="h-9 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTask();
                }
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newTaskPhaseId}
                onChange={(e) => setNewTaskPhaseId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-xs text-jcn-ice"
              >
                <option value="">Sem fase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Input
                type="datetime-local"
                value={newTaskDueDateTime}
                onChange={(e) => setNewTaskDueDateTime(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <Button
              type="button"
              onClick={addTask}
              className="h-9 w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar tarefa
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
