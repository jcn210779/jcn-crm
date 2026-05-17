"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { buildDailyLogAutofill } from "@/lib/daily-log-autofill";
import type { JobHoursWithMember } from "@/lib/job-hours";
import {
  DAILY_LOG_TYPE_EMOJI,
  DAILY_LOG_TYPE_LABEL,
  WEATHER_EMOJI,
  WEATHER_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  DAILY_LOG_TYPES,
  WEATHER_CONDITIONS,
  type DailyLogType,
  type JobDailyLog,
  type JobExpense,
  type JobPhoto,
  type WeatherCondition,
} from "@/lib/types";

type Props = {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hours: JobHoursWithMember[];
  expenses: JobExpense[];
  photos: JobPhoto[];
  editingLog?: JobDailyLog;
  onDone?: () => void;
};

function defaultDate(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AddDailyLogDialog({
  jobId,
  open,
  onOpenChange,
  hours,
  expenses,
  photos,
  editingLog,
  onDone,
}: Props) {
  const isEditing = editingLog !== undefined;

  const [logDate, setLogDate] = useState<string>(
    editingLog?.log_date ?? defaultDate(),
  );
  const [content, setContent] = useState<string>(editingLog?.content ?? "");
  const [entryType, setEntryType] = useState<DailyLogType>(
    editingLog?.entry_type ?? "progress",
  );
  const [weather, setWeather] = useState<WeatherCondition | "">(
    editingLog?.weather ?? "",
  );
  const [saving, setSaving] = useState(false);

  // Reset quando dialog reabre
  useEffect(() => {
    if (open) {
      setLogDate(editingLog?.log_date ?? defaultDate());
      setContent(editingLog?.content ?? "");
      setEntryType(editingLog?.entry_type ?? "progress");
      setWeather(editingLog?.weather ?? "");
      setSaving(false);
    }
  }, [open, editingLog]);

  function handleAutofill() {
    const prefix = content.trim();
    const autoText = buildDailyLogAutofill({
      date: logDate,
      hours,
      expenses,
      photos,
    });
    setContent(prefix ? `${prefix}\n\n${autoText}` : autoText);
    toast.success("Resumo do dia adicionado. Edite pra adicionar contexto.");
  }

  async function handleSave() {
    if (!content.trim()) {
      toast.error("Escreva o que aconteceu no dia");
      return;
    }
    if (!logDate) {
      toast.error("Defina a data");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const payload = {
      log_date: logDate,
      content: content.trim(),
      entry_type: entryType,
      weather: weather || null,
    };

    if (isEditing && editingLog) {
      const { error } = await supabase
        .from("job_daily_logs")
        .update(payload)
        .eq("id", editingLog.id);
      setSaving(false);
      if (error) {
        toast.error("Erro ao atualizar", { description: error.message });
        return;
      }
      toast.success("Entrada atualizada");
    } else {
      const { error } = await supabase
        .from("job_daily_logs")
        .insert({ ...payload, job_id: jobId });
      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
        return;
      }
      toast.success("Entrada registrada");
    }

    if (onDone) onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar entrada" : "Registrar dia"}
          </DialogTitle>
          <DialogDescription>
            Anota o que aconteceu na obra. Use o botão de autopreencher pra
            puxar o resumo de horas, despesas e fotos do dia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="log-date">Data</Label>
              <Input
                id="log-date"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-type">Tipo</Label>
              <select
                id="log-type"
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as DailyLogType)}
              >
                {DAILY_LOG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DAILY_LOG_TYPE_EMOJI[t]} {DAILY_LOG_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-weather">Clima (opcional)</Label>
            <select
              id="log-weather"
              className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
              value={weather}
              onChange={(e) =>
                setWeather(e.target.value as WeatherCondition | "")
              }
            >
              <option value="">Sem registro de clima</option>
              {WEATHER_CONDITIONS.map((w) => (
                <option key={w} value={w}>
                  {WEATHER_EMOJI[w]} {WEATHER_LABEL[w]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="log-content">O que aconteceu *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAutofill}
                className="h-7 gap-1 px-2 text-xs text-jcn-gold-300 hover:text-jcn-gold-200"
                title="Puxa resumo automático de horas, despesas e fotos desse dia"
              >
                <Sparkles className="h-3 w-3" />
                Preencher automático
              </Button>
            </div>
            <Textarea
              id="log-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="Ex: Demoli deck antigo, descobri encanamento velho na lateral. Vou precisar trocar antes de instalar viga."
            />
            <p className="text-[10px] text-jcn-ice/40">
              Use o botão acima pra começar com o resumo automático. Depois
              edita pra adicionar contexto humano.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
