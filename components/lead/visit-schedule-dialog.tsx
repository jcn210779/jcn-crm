"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";
import { SERVICE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { Lead } from "@/lib/types";

const APP_BASE_URL = "https://jcn-crm.vercel.app";

/**
 * Dialog que abre quando lead vai pra `visita_agendada`. Pede data + hora
 * + duração e salva em leads.visit_scheduled_at. Mostra botão pra adicionar
 * ao Google Calendar (URL pré-preenchida, sem OAuth).
 */
type Props = {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback chamado depois de salvar (ou cancelar). Usado pelo Kanban
   *  pra refrescar lista. */
  onDone?: () => void;
};

function defaultDateTimeString(): string {
  // amanhã às 10h local — input datetime-local quer "YYYY-MM-DDTHH:mm" sem timezone
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()).replace(/^(\d{2})$/, ":$1")
  );
}

function existingDateTimeString(iso: string | null): string {
  if (!iso) return defaultDateTimeString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultDateTimeString();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

export function VisitScheduleDialog({ lead, open, onOpenChange, onDone }: Props) {
  const [dateTime, setDateTime] = useState<string>(() =>
    existingDateTimeString(lead.visit_scheduled_at),
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset state quando dialog reabre
  useEffect(() => {
    if (open) {
      setDateTime(existingDateTimeString(lead.visit_scheduled_at));
      setDurationMinutes(60);
      setSaved(false);
      setSaving(false);
    }
  }, [open, lead.visit_scheduled_at]);

  const fullAddress = useMemo(() => {
    const parts = [
      lead.address,
      lead.city,
      lead.state ?? "MA",
      lead.zip,
    ].filter((p): p is string => Boolean(p));
    return parts.join(", ");
  }, [lead.address, lead.city, lead.state, lead.zip]);

  const calendarUrl = useMemo(() => {
    try {
      const start = new Date(dateTime);
      if (Number.isNaN(start.getTime())) return null;
      return buildGoogleCalendarUrl({
        title: `Visita JCN: ${lead.name}`,
        location: fullAddress || undefined,
        startDate: start,
        durationMinutes,
        description: [
          `Serviço: ${SERVICE_LABEL[lead.service_interest]}`,
          lead.service_notes ? `Detalhes: ${lead.service_notes}` : null,
          lead.estimated_value
            ? `Valor estimado: $${lead.estimated_value.toLocaleString("en-US")}`
            : null,
          lead.phone ? `Telefone: ${lead.phone}` : null,
          ``,
          `Lead no CRM: ${APP_BASE_URL}/lead/${lead.id}`,
        ]
          .filter((l): l is string => l !== null)
          .join("\n"),
      });
    } catch {
      return null;
    }
  }, [
    dateTime,
    durationMinutes,
    lead.id,
    lead.name,
    lead.phone,
    lead.service_interest,
    lead.service_notes,
    lead.estimated_value,
    fullAddress,
  ]);

  async function handleSave() {
    if (!dateTime) {
      toast.error("Defina a data e hora da visita");
      return;
    }
    const date = new Date(dateTime);
    if (Number.isNaN(date.getTime())) {
      toast.error("Data inválida");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("leads")
      .update({
        visit_scheduled_at: date.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar visita", { description: error.message });
      return;
    }
    setSaved(true);
    toast.success("Visita agendada");
  }

  function handleClose() {
    onOpenChange(false);
    if (onDone) onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
          <DialogDescription>
            {lead.name}
            {fullAddress ? ` em ${fullAddress}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="visit-datetime">Data e hora</Label>
            <Input
              id="visit-datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              disabled={saved}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-duration">Duração</Label>
            <select
              id="visit-duration"
              className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/40"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              disabled={saved}
            >
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1 hora e 30 minutos</option>
              <option value={120}>2 horas</option>
            </select>
          </div>

          {saved && calendarUrl ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm">
              <p className="mb-3 text-amber-200">
                Visita salva pra{" "}
                <strong>
                  {format(new Date(dateTime), "EEEE, d 'de' MMMM 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </strong>
                .
              </p>
              <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full" type="button">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Adicionar ao Google Calendar
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {!saved ? (
            <>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar visita"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
