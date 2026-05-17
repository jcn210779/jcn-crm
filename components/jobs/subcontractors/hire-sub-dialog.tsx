"use client";

import { Star } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import type { ActiveSubOption } from "@/lib/job-subs";
import {
  JOB_SUBCONTRACTOR_STATUS_LABEL,
  SUBCONTRACTOR_SPECIALTY_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  JOB_SUBCONTRACTOR_STATUSES,
  SUBCONTRACTOR_SPECIALTIES,
  type JobSubcontractorStatus,
  type SubcontractorSpecialty,
} from "@/lib/types";

type Props = {
  jobId: string;
  activeSubs: ActiveSubOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

export function HireSubDialog({
  jobId,
  activeSubs,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [subId, setSubId] = useState<string>("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [agreedValue, setAgreedValue] = useState("");
  const [status, setStatus] = useState<JobSubcontractorStatus>("pending");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Agrupar subs por especialidade, preferidos primeiro
  const groupedSubs = useMemo(() => {
    type Group = { specialty: SubcontractorSpecialty; subs: ActiveSubOption[] };
    const map = new Map<SubcontractorSpecialty, ActiveSubOption[]>();
    for (const s of activeSubs) {
      if (!map.has(s.specialty)) map.set(s.specialty, []);
      map.get(s.specialty)!.push(s);
    }
    const groups: Group[] = [];
    for (const sp of SUBCONTRACTOR_SPECIALTIES) {
      const subs = map.get(sp);
      if (!subs || subs.length === 0) continue;
      // Preferidos primeiro, depois alfabético
      subs.sort((a, b) => {
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      groups.push({ specialty: sp, subs });
    }
    return groups;
  }, [activeSubs]);

  const selectedSub = useMemo(
    () => activeSubs.find((s) => s.id === subId) ?? null,
    [activeSubs, subId],
  );

  // Pré-preencher valor com default_rate do sub selecionado
  useEffect(() => {
    if (!open) return;
    if (selectedSub && selectedSub.default_rate !== null && !agreedValue) {
      setAgreedValue(String(selectedSub.default_rate));
    }
  }, [selectedSub, open, agreedValue]);

  function reset() {
    setSubId("");
    setServiceDescription("");
    setAgreedValue("");
    setStatus("pending");
    setNotes("");
    setSaving(false);
  }

  async function handleSubmit() {
    if (!subId) {
      toast.error("Selecione um subempreiteiro");
      return;
    }
    if (!serviceDescription.trim()) {
      toast.error("Descreva o serviço contratado");
      return;
    }
    const value = Number(agreedValue.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(value) || value < 0) {
      toast.error("Valor combinado inválido");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("job_subcontractors").insert({
      job_id: jobId,
      subcontractor_id: subId,
      service_description: serviceDescription.trim(),
      agreed_value: value,
      status,
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      toast.error("Erro ao contratar subempreiteiro", {
        description: error.message,
      });
      return;
    }

    toast.success("Subempreiteiro contratado");
    reset();
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contratar subempreiteiro</DialogTitle>
          <DialogDescription>
            Vincula um sub cadastrado a esta obra com valor e status próprios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="hs-sub">Subempreiteiro *</Label>
            <select
              id="hs-sub"
              className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
              value={subId}
              onChange={(e) => setSubId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {groupedSubs.map((g) => (
                <optgroup
                  key={g.specialty}
                  label={SUBCONTRACTOR_SPECIALTY_LABEL[g.specialty]}
                >
                  {g.subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.preferred ? "★ " : ""}
                      {s.name}
                      {s.company_name ? ` (${s.company_name})` : ""}
                      {s.default_rate !== null
                        ? ` · ref ${formatCurrency(Number(s.default_rate))}`
                        : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedSub && selectedSub.preferred && (
              <p className="flex items-center gap-1 text-[11px] text-jcn-gold-300/80">
                <Star className="h-3 w-3 fill-jcn-gold-300" />
                Marcado como preferido
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hs-desc">Descrição do serviço *</Label>
            <Textarea
              id="hs-desc"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              rows={2}
              placeholder="Instalação elétrica completa do deck (luminárias + tomadas)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hs-value">Valor combinado ($) *</Label>
              <Input
                id="hs-value"
                type="text"
                inputMode="decimal"
                value={agreedValue}
                onChange={(e) => setAgreedValue(e.target.value)}
                placeholder="1500.00"
              />
              {selectedSub && selectedSub.default_rate !== null && (
                <p className="text-[10px] text-jcn-ice/40">
                  Referência: {formatCurrency(Number(selectedSub.default_rate))}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hs-status">Status inicial</Label>
              <select
                id="hs-status"
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as JobSubcontractorStatus)
                }
              >
                {JOB_SUBCONTRACTOR_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {JOB_SUBCONTRACTOR_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hs-notes">Notas (opcional)</Label>
            <Textarea
              id="hs-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Prazo combinado, material por conta de quem, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando..." : "Contratar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
