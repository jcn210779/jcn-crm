"use client";

/**
 * Card de inspeções da cidade por job (mig 0055).
 *
 * 3 padrão criadas automaticamente pelo trigger quando permit_status
 * vira 'released': Footing, Framing, Finish. Também permite adicionar
 * custom (Electrical, Plumbing, etc). Status ciclável por click.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarPlus,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  JobInspection,
  JobInspectionStatus,
  JobInspectionType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string;
};

const STATUS_LABEL: Record<JobInspectionStatus, string> = {
  pending: "Pendente",
  scheduled: "Agendada",
  passed: "Aprovada",
  failed: "Reprovada",
  skipped: "Dispensada",
};

const STATUS_TONE: Record<JobInspectionStatus, string> = {
  pending: "border-white/[0.08] bg-white/[0.03] text-jcn-ice/70",
  scheduled: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  passed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  failed: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  skipped: "border-white/[0.08] bg-white/[0.03] text-jcn-ice/40 line-through",
};

const TYPE_LABEL: Record<JobInspectionType, string> = {
  footing: "Footing",
  framing: "Framing",
  finish: "Finish",
  electrical: "Electrical",
  plumbing: "Plumbing",
  other: "Outra",
};

function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function googleCalendarUrl(opts: {
  title: string;
  startIso: string;
  details?: string;
}): string {
  const toG = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
      `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
  };
  const startG = toG(opts.startIso);
  const endG = toG(
    new Date(new Date(opts.startIso).getTime() + 60 * 60 * 1000).toISOString(),
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${startG}/${endG}`,
  });
  if (opts.details) params.set("details", opts.details);
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export function JobInspectionsCard({ jobId }: Props) {
  const [inspections, setInspections] = useState<JobInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<JobInspectionType>("other");
  const [addDateTime, setAddDateTime] = useState("");

  async function reload() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("job_inspections")
      .select("*")
      .eq("job_id", jobId)
      .order("display_order");
    setInspections((data ?? []) as JobInspection[]);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function cycleStatus(insp: JobInspection) {
    // pending → scheduled → passed → failed → pending
    const order: JobInspectionStatus[] = [
      "pending",
      "scheduled",
      "passed",
      "failed",
    ];
    const idx = order.indexOf(insp.status);
    const next = order[(idx + 1) % order.length]!;
    const patch: {
      status: JobInspectionStatus;
      done_date?: string | null;
    } = { status: next };
    if (next === "passed" || next === "failed") {
      patch.done_date = new Date().toISOString();
    }
    if (next === "pending") patch.done_date = null;

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("job_inspections")
      .update(patch)
      .eq("id", insp.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await reload();
  }

  async function updateScheduled(insp: JobInspection, dateTime: string) {
    const iso = dateTime ? new Date(dateTime).toISOString() : null;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("job_inspections")
      .update({ scheduled_date: iso })
      .eq("id", insp.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await reload();
  }

  async function deleteInspection(insp: JobInspection) {
    if (!confirm(`Apagar inspeção "${insp.name}"?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("job_inspections")
      .delete()
      .eq("id", insp.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Removida");
    await reload();
  }

  async function addInspection() {
    if (!addName.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const scheduled = addDateTime ? new Date(addDateTime).toISOString() : null;
    const nextOrder =
      inspections.length > 0
        ? Math.max(...inspections.map((i) => i.display_order)) + 1
        : 1;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("job_inspections").insert({
      job_id: jobId,
      type: addType,
      name: addName.trim(),
      scheduled_date: scheduled,
      display_order: nextOrder,
    });
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setAddName("");
    setAddDateTime("");
    setAddType("other");
    await reload();
  }

  async function seedDefaults() {
    if (inspections.length > 0) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("job_inspections").insert([
      { job_id: jobId, type: "footing", name: "Footing", display_order: 1 },
      { job_id: jobId, type: "framing", name: "Framing", display_order: 2 },
      { job_id: jobId, type: "finish", name: "Finish", display_order: 3 },
    ]);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Inspeções padrão criadas");
    await reload();
  }

  const passed = inspections.filter((i) => i.status === "passed").length;
  const total = inspections.length;

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-jcn-gold-300" />
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            Inspeções
          </h2>
          {total > 0 && (
            <span className="text-[10px] text-jcn-ice/55">
              {passed}/{total} aprovadas
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-jcn-gold-300" />
        </div>
      ) : inspections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-jcn-ice/55">
            Nenhuma inspeção cadastrada
          </p>
          <p className="mt-1 text-[11px] text-jcn-ice/40">
            (as 3 padrão criam sozinhas quando você marcar permit como
            &quot;liberado&quot;)
          </p>
          <Button
            onClick={seedDefaults}
            variant="outline"
            className="mt-3 border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-200 hover:bg-jcn-gold-500/20"
          >
            <Plus className="h-4 w-4" />
            Criar padrão (Footing/Framing/Finish)
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {inspections.map((insp) => (
            <div
              key={insp.id}
              className={cn(
                "rounded-xl border p-3",
                STATUS_TONE[insp.status],
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => cycleStatus(insp)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  title="Click pra mudar status"
                >
                  {insp.status === "passed" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : insp.status === "failed" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{insp.name}</p>
                    <p className="text-[10px] opacity-80">
                      {STATUS_LABEL[insp.status]}
                      {insp.type !== "other" && ` · ${TYPE_LABEL[insp.type]}`}
                      {insp.done_date &&
                        ` · feita ${format(new Date(insp.done_date), "dd MMM yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                </button>
                {insp.scheduled_date && (
                  <a
                    href={googleCalendarUrl({
                      title: `Inspeção: ${insp.name}`,
                      startIso: insp.scheduled_date,
                      details: `JCN — inspeção da cidade`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded p-1 opacity-60 hover:bg-sky-500/20 hover:text-sky-300 hover:opacity-100"
                    title="Google Agenda"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => deleteInspection(insp)}
                  className="shrink-0 rounded p-1 opacity-45 hover:bg-rose-500/20 hover:text-rose-300 hover:opacity-100"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <Label className="text-[9px] uppercase tracking-wider opacity-70">
                  Data agendada
                </Label>
                <Input
                  type="datetime-local"
                  value={toDateTimeLocalValue(insp.scheduled_date)}
                  onChange={(e) => updateScheduled(insp, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulário adicionar inspeção */}
      <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-jcn-ice/55">
              Tipo
            </Label>
            <select
              value={addType}
              onChange={(e) =>
                setAddType(e.target.value as JobInspectionType)
              }
              className="flex h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-xs text-jcn-ice"
            >
              {(Object.keys(TYPE_LABEL) as JobInspectionType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-jcn-ice/55">
              Data (opcional)
            </Label>
            <Input
              type="datetime-local"
              value={addDateTime}
              onChange={(e) => setAddDateTime(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Nome (ex: Electrical rough-in)"
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
            className="h-9 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      </div>
    </section>
  );
}
