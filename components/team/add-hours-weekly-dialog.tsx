"use client";

import { Loader2, Save } from "lucide-react";
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
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { TeamMember } from "@/lib/types";

import type { JobOption } from "./team-payroll-weekly";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  jobs: JobOption[];
  presetMemberId: string | null;
  presetDate: string | null; // YYYY-MM-DD
  onDone: () => void;
};

export function AddHoursWeeklyDialog({
  open,
  onOpenChange,
  members,
  jobs,
  presetMemberId,
  presetDate,
  onDone,
}: Props) {
  const [memberId, setMemberId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [workDate, setWorkDate] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMemberId(presetMemberId ?? (members[0]?.id ?? ""));
    setJobId(jobs[0]?.id ?? "");
    setWorkDate(presetDate ?? new Date().toISOString().slice(0, 10));
    setHours("");
    setNotes("");
  }, [open, presetMemberId, presetDate, members, jobs]);

  const selectedMember = members.find((m) => m.id === memberId);
  const hoursNum = Number(hours);
  const validHours =
    !Number.isNaN(hoursNum) && hoursNum > 0 && hoursNum <= 24;
  const previewAmount =
    selectedMember && validHours
      ? hoursNum * Number(selectedMember.hourly_rate)
      : null;

  async function handleSave() {
    if (!memberId) {
      toast.error("Escolha o funcionário");
      return;
    }
    if (!jobId) {
      toast.error("Escolha o job");
      return;
    }
    if (!validHours) {
      toast.error("Horas inválidas (entre 0.1 e 24)");
      return;
    }
    if (!selectedMember) return;

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("job_hours").insert({
        job_id: jobId,
        member_id: memberId,
        work_date: workDate,
        hours: hoursNum,
        hourly_rate_snapshot: Number(selectedMember.hourly_rate),
        notes: notes.trim() || null,
      });

      if (error) {
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }

      toast.success(
        `${hoursNum}h registradas pra ${selectedMember.name}`,
      );
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            Registrar horas
          </DialogTitle>
          <DialogDescription>
            Quem trabalhou, em que job, em que dia e quantas horas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Funcionário */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Funcionário
            </Label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (${Number(m.hourly_rate).toFixed(2)}/h)
                </option>
              ))}
            </select>
          </div>

          {/* Job */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Job
            </Label>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {jobs.length === 0 && (
                <option value="">Nenhum job ativo</option>
              )}
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>

          {/* Data + Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                Data
              </Label>
              <Input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                Horas
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                placeholder="8"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>

          {/* Preview */}
          {previewAmount !== null && (
            <div className="rounded-lg border border-jcn-gold-400/30 bg-jcn-gold-500/10 px-3 py-2 text-sm">
              <span className="text-jcn-gold-200/85">Vai pagar: </span>
              <span className="font-bold text-jcn-gold-300">
                ${previewAmount.toFixed(2)}
              </span>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Notas (opcional)
            </Label>
            <Input
              type="text"
              placeholder="Ex: instalou deck boards, deck frame, etc"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !validHours}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
