"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AddDailyLogDialog } from "@/components/jobs/daily-log/add-daily-log-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  DAILY_LOG_TYPE_EMOJI,
  DAILY_LOG_TYPE_LABEL,
  WEATHER_EMOJI,
  WEATHER_LABEL,
} from "@/lib/labels";
import type { JobDailyLog, JobExpense, JobPhoto } from "@/lib/types";
import type { JobHoursWithMember } from "@/lib/job-hours";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string;
  logs: JobDailyLog[];
  // Pra auto-fill cruzar com eventos do dia:
  hours: JobHoursWithMember[];
  expenses: JobExpense[];
  photos: JobPhoto[];
};

const TYPE_ACCENT: Record<string, string> = {
  progress: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  problem: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  blocker: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  observation: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  inspection: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  client_visit: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
};

export function JobDailyLogSection({
  jobId,
  logs,
  hours,
  expenses,
  photos,
}: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<JobDailyLog | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(log: JobDailyLog) {
    if (!window.confirm(`Apagar entrada do dia ${log.log_date}?`)) return;
    setDeleting(log.id);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("job_daily_logs")
      .delete()
      .eq("id", log.id);
    setDeleting(null);
    if (error) {
      toast.error("Erro ao apagar", { description: error.message });
      return;
    }
    toast.success("Entrada apagada");
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-jcn-ice">
              Diário de obra
            </h3>
            <p className="text-xs text-jcn-ice/55">
              {logs.length === 0
                ? "Anota o que acontece a cada dia. Vira memória útil pra depois."
                : `${logs.length} ${logs.length === 1 ? "entrada" : "entradas"}`}
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="h-10 font-semibold">
          <Plus className="h-4 w-4" />
          Registrar dia
        </Button>
      </div>

      {/* Lista */}
      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-jcn-ice/30" />
          <p className="mt-3 text-sm font-semibold text-jcn-ice/65">
            Nenhuma entrada
          </p>
          <p className="mt-1 text-xs text-jcn-ice/40">
            Use o botão de preencher automático no dialog pra começar com o
            resumo dos eventos do dia (horas, despesas, fotos).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <article
              key={log.id}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:bg-white/[0.04]"
            >
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-base font-black text-jcn-ice">
                  {format(new Date(log.log_date), "EEEE, d 'de' MMMM", {
                    locale: ptBR,
                  })}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold",
                    TYPE_ACCENT[log.entry_type] ?? TYPE_ACCENT.progress,
                  )}
                >
                  {DAILY_LOG_TYPE_EMOJI[log.entry_type]}{" "}
                  {DAILY_LOG_TYPE_LABEL[log.entry_type]}
                </Badge>
                {log.weather && (
                  <Badge
                    variant="outline"
                    className="border-white/[0.08] bg-white/[0.03] text-[10px] font-semibold text-jcn-ice/65"
                  >
                    {WEATHER_EMOJI[log.weather]} {WEATHER_LABEL[log.weather]}
                  </Badge>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingLog(log)}
                    className="h-8 px-2 text-xs text-jcn-ice/55 hover:text-jcn-ice"
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(log)}
                    disabled={deleting === log.id}
                    className="h-8 w-8 p-0 text-rose-300/70 hover:text-rose-300"
                    title="Apagar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </header>
              <p className="whitespace-pre-wrap text-sm leading-[1.6] text-jcn-ice/85">
                {log.content}
              </p>
            </article>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddDailyLogDialog
        jobId={jobId}
        open={addOpen}
        onOpenChange={setAddOpen}
        hours={hours}
        expenses={expenses}
        photos={photos}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      {editingLog && (
        <AddDailyLogDialog
          jobId={jobId}
          open={editingLog !== null}
          onOpenChange={(open) => {
            if (!open) setEditingLog(null);
          }}
          hours={hours}
          expenses={expenses}
          photos={photos}
          editingLog={editingLog}
          onDone={() => {
            setEditingLog(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
