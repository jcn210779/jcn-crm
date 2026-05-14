"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { Lead, Task } from "@/lib/types";

type Props = {
  lead: Lead;
  tasks: Task[];
  userEmail: string;
};

const APP_BASE_URL = "https://jcn-crm.vercel.app";

export function FollowUpSection({ lead, tasks, userEmail }: Props) {
  const router = useRouter();
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showDoneList, setShowDoneList] = useState(false);

  const now = useMemo(() => new Date(), []);

  const pending = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "pending" || t.status === "overdue")
        .sort(
          (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
        ),
    [tasks],
  );

  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "done")
        .sort((a, b) => {
          const aDate = a.completed_at ?? a.created_at;
          const bDate = b.completed_at ?? b.created_at;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }),
    [tasks],
  );

  async function markTaskDone(task: Task) {
    if (!confirm(`Marcar "${task.title}" como feita?`)) return;
    const supabase = createSupabaseBrowserClient();
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completed_at: completedAt })
      .eq("id", task.id);
    if (error) {
      toast.error("Erro ao marcar feita", { description: error.message });
      return;
    }
    await supabase.from("activity_log").insert({
      lead_id: lead.id,
      type: "task_done",
      created_by: userEmail || "system",
      payload: { task_id: task.id, title: task.title, type: task.type },
    });
    toast.success("Tarefa marcada como feita");
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/45">
          Follow-ups
        </h3>
        {pending.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {pending.length} pendente{pending.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {/* Lista pendentes */}
      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-6 text-center">
          <p className="text-sm text-white/40">Nenhum follow-up pendente</p>
          <p className="mt-1 text-[11px] text-white/30">
            Agende o próximo abaixo
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {pending.map((t) => {
            const due = new Date(t.due_date);
            const isOverdue = due.getTime() < now.getTime();
            return (
              <li
                key={t.id}
                className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 md:flex-row md:items-center ${
                  isOverdue
                    ? "border-red-500/30 bg-red-500/[0.04]"
                    : "border-white/[0.06] bg-white/[0.025]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isOverdue && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    )}
                    <p className="truncate text-sm font-semibold text-white">
                      {t.title}
                    </p>
                  </div>
                  <p
                    className={`mt-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] ${
                      isOverdue ? "text-red-400" : "text-white/40"
                    }`}
                  >
                    {isOverdue ? "Atrasado " : "Vence "}
                    {formatDistanceToNow(due, {
                      locale: ptBR,
                      addSuffix: true,
                    })}{" "}
                    · {format(due, "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                  {t.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-white/55">
                      {t.notes}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markTaskDone(t)}
                  className="h-8 border-white/[0.1] text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Feita
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      {/* Botões principais */}
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Button
          onClick={() => setShowLogDialog(true)}
          className="h-12 font-bold"
        >
          <MessageSquare className="h-4 w-4" />
          Registrar follow-up feito agora
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowScheduleDialog(true)}
          className="h-12 border-white/[0.1] bg-white/[0.04] font-bold"
        >
          <CalendarPlus className="h-4 w-4" />
          Agendar próximo follow-up
        </Button>
      </div>

      {/* Histórico feitos */}
      {done.length > 0 && (
        <div className="mt-5 border-t border-white/[0.05] pt-4">
          <button
            type="button"
            onClick={() => setShowDoneList((v) => !v)}
            className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.25em] text-white/35 transition hover:text-white/60"
          >
            <span>Histórico ({done.length})</span>
            {showDoneList ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showDoneList && (
            <ol className="mt-3 space-y-2">
              {done.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-2 rounded-xl border border-white/[0.04] bg-white/[0.015] px-3 py-2 text-xs"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/35">
                      Feita{" "}
                      {t.completed_at
                        ? formatDistanceToNow(new Date(t.completed_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })
                        : "—"}
                    </p>
                    {t.notes && (
                      <p className="mt-1 text-[11px] text-white/45">
                        {t.notes}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <LogFollowUpDialog
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        lead={lead}
        userEmail={userEmail}
      />
      <ScheduleFollowUpDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        lead={lead}
        userEmail={userEmail}
      />
    </section>
  );
}

// ============================================================================
// Dialog: Registrar follow-up feito agora
// ============================================================================

type LogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead;
  userEmail: string;
};

function LogFollowUpDialog({ open, onOpenChange, lead, userEmail }: LogProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = notes.trim();
    if (!trimmed) {
      toast.error("Escreva o que foi conversado");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) registra no activity_log
    const { error: actErr } = await supabase.from("activity_log").insert({
      lead_id: lead.id,
      type: "followup_done",
      created_by: userEmail || "system",
      payload: { notes: trimmed },
    });
    if (actErr) {
      setSaving(false);
      toast.error("Erro ao registrar", { description: actErr.message });
      return;
    }

    // 2) concatena nas notas internas do lead (audit visível na tela)
    const stamp = new Date().toISOString().slice(0, 10);
    const prefix = lead.notes ? lead.notes + "\n" : "";
    const newNotes = `${prefix}[${stamp}] Follow-up: ${trimmed}`;
    const { error: leadErr } = await supabase
      .from("leads")
      .update({ notes: newNotes, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (leadErr) {
      setSaving(false);
      toast.error("Erro ao atualizar nota", { description: leadErr.message });
      return;
    }

    setSaving(false);
    setNotes("");
    onOpenChange(false);
    toast.success("Follow-up registrado");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar follow-up feito agora</DialogTitle>
          <DialogDescription>
            O que o cliente respondeu? Vai pra timeline e pras anotações do
            lead.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label
            htmlFor="followup-notes"
            className="text-xs font-bold uppercase tracking-[0.15em] text-white/55"
          >
            O que foi conversado
          </Label>
          <Textarea
            id="followup-notes"
            autoFocus
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: cliente pediu pra retornar quinta. Está comparando com mais 2 contratores."
            className="mt-2 resize-none border-white/10 bg-white/[0.03] text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Dialog: Agendar próximo follow-up
// ============================================================================

type ScheduleProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead;
  userEmail: string;
};

/** Default: hoje + 3 dias, formato yyyy-MM-dd pra <input type="date">. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

/** Default time: 10:00 (manhã prática pra Jose ligar). */
const DEFAULT_TIME = "10:00";

function ScheduleFollowUpDialog({
  open,
  onOpenChange,
  lead,
  userEmail,
}: ScheduleProps) {
  const router = useRouter();
  const [date, setDate] = useState<string>(defaultDueDate);
  const [time, setTime] = useState<string>(DEFAULT_TIME);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);

  function reset() {
    setDate(defaultDueDate());
    setTime(DEFAULT_TIME);
    setNotes("");
    setCreatedTask(null);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function save() {
    if (!date) {
      toast.error("Escolha uma data");
      return;
    }
    // monta Date local (input type=date é UTC-naive)
    const iso = `${date}T${time || "10:00"}:00`;
    const due = new Date(iso);
    if (Number.isNaN(due.getTime())) {
      toast.error("Data inválida");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const title = `Follow-up ${lead.name}`;
    const insertPayload = {
      lead_id: lead.id,
      type: "followup" as const,
      title,
      due_date: due.toISOString(),
      status: "pending" as const,
      notes: notes.trim() || null,
      created_by: userEmail || "system",
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error || !data) {
      setSaving(false);
      toast.error("Erro ao agendar", {
        description: error?.message ?? "tente novamente",
      });
      return;
    }
    const created = data as Task;

    // registra também no activity_log
    await supabase.from("activity_log").insert({
      lead_id: lead.id,
      type: "task_scheduled",
      created_by: userEmail || "system",
      payload: {
        task_id: created.id,
        title,
        due_date: due.toISOString(),
      },
    });

    setSaving(false);
    setCreatedTask(created);
    toast.success("Follow-up agendado");
    router.refresh();
  }

  // monta URL pré-preenchida do Google Calendar
  const calendarUrl = useMemo(() => {
    if (!createdTask) return "";
    const trimmedNotes = (createdTask.notes ?? "").trim();
    const leadUrl = `${APP_BASE_URL}/lead/${lead.id}`;
    const description = trimmedNotes
      ? `${trimmedNotes} | Lead: ${leadUrl}`
      : `Lead: ${leadUrl}`;
    return buildGoogleCalendarUrl({
      title: `Follow-up JCN: ${lead.name}`,
      description,
      startDate: createdTask.due_date,
      durationMinutes: 30,
    });
  }, [createdTask, lead.id, lead.name]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar próximo follow-up</DialogTitle>
          <DialogDescription>
            Vira tarefa pendente no CRM. Você pode jogar no Google Calendar
            depois.
          </DialogDescription>
        </DialogHeader>

        {!createdTask ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="followup-date"
                  className="text-xs font-bold uppercase tracking-[0.15em] text-white/55"
                >
                  Quando
                </Label>
                <Input
                  id="followup-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2 h-11 border-white/10 bg-white/[0.03] text-sm"
                />
              </div>
              <div>
                <Label
                  htmlFor="followup-time"
                  className="text-xs font-bold uppercase tracking-[0.15em] text-white/55"
                >
                  Horário
                </Label>
                <Input
                  id="followup-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-2 h-11 border-white/10 bg-white/[0.03] text-sm"
                />
              </div>
            </div>
            <div>
              <Label
                htmlFor="followup-about"
                className="text-xs font-bold uppercase tracking-[0.15em] text-white/55"
              >
                Sobre o quê (opcional)
              </Label>
              <Textarea
                id="followup-about"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: retornar com proposta revisada incluindo siding."
                className="mt-2 resize-none border-white/10 bg-white/[0.03] text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-bold">Tarefa agendada no CRM</p>
            </div>
            <p className="text-xs text-white/55">
              {createdTask.title} ·{" "}
              {format(new Date(createdTask.due_date), "dd/MM 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              <CalendarPlus className="h-4 w-4" />
              Adicionar ao Google Calendar
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="text-center text-[11px] text-white/40">
              Abre numa aba nova. Confirme lá pra cair na sua agenda.
            </p>
          </div>
        )}

        <DialogFooter>
          {!createdTask ? (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Agendando..." : "Agendar"}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
