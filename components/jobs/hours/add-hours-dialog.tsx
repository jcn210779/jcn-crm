"use client";

import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";
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
import type { TeamMemberLite } from "@/lib/job-hours";
import { TEAM_ROLE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Props = {
  jobId: string;
  members: TeamMemberLite[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

function defaultDate(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AddHoursDialog({
  jobId,
  members,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [memberId, setMemberId] = useState<string>(members[0]?.id ?? "");
  const [workDate, setWorkDate] = useState<string>(defaultDate());
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId],
  );

  const preview = useMemo(() => {
    const h = Number(hours.replace(/[^0-9.]/g, ""));
    if (!selectedMember || Number.isNaN(h) || h <= 0) return null;
    const rate = Number(selectedMember.hourly_rate);
    const total = Math.round(h * rate * 100) / 100;
    return { hours: h, rate, total };
  }, [hours, selectedMember]);

  function reset() {
    setMemberId(members[0]?.id ?? "");
    setWorkDate(defaultDate());
    setHours("");
    setNotes("");
    setSaving(false);
  }

  async function handleSubmit() {
    if (!selectedMember) {
      toast.error("Selecione um funcionário");
      return;
    }
    const h = Number(hours.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(h) || h <= 0) {
      toast.error("Horas inválidas");
      return;
    }
    if (h > 24) {
      toast.error("Máximo de 24 horas por entrada");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("job_hours").insert({
      job_id: jobId,
      member_id: selectedMember.id,
      work_date: workDate,
      hours: h,
      hourly_rate_snapshot: Number(selectedMember.hourly_rate),
      notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      toast.error("Erro ao registrar horas", { description: error.message });
      return;
    }

    toast.success("Horas registradas");
    reset();
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar horas trabalhadas</DialogTitle>
          <DialogDescription>
            Mão de obra calculada com a taxa atual do funcionário e gravada
            como snapshot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="jh-member">Funcionário *</Label>
            <select
              id="jh-member"
              className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {TEAM_ROLE_LABEL[m.role]} ·{" "}
                  {formatCurrency(Number(m.hourly_rate))}/h
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jh-date">Data</Label>
              <Input
                id="jh-date"
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jh-hours">Horas *</Label>
              <Input
                id="jh-hours"
                type="number"
                inputMode="decimal"
                step={0.25}
                min={0.25}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="8"
              />
            </div>
          </div>

          {/* Preview do cálculo */}
          {preview && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-jcn-ice">
                <Calculator className="h-4 w-4 text-jcn-gold-300" />
                {preview.hours}h × {formatCurrency(preview.rate)}/h
              </div>
              <div className="text-lg font-black text-jcn-gold-300">
                = {formatCurrency(preview.total)}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="jh-notes">Notas (opcional)</Label>
            <Textarea
              id="jh-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="O que foi feito hoje..."
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
            {saving ? "Salvando..." : "Salvar horas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
