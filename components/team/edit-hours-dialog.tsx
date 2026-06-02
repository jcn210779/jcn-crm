"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { TeamMember } from "@/lib/types";

import type { HoursRow, JobOption } from "./team-payroll-weekly";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  workDate: string; // YYYY-MM-DD
  entries: HoursRow[];
  jobs: JobOption[];
  onDone: () => void;
  /** Abre o dialog de adicionar novo registro (pra mesmo dia). */
  onAddNew: () => void;
};

type RowState = {
  id: string;
  job_id: string;
  hours: string;
  notes: string;
  paid_at: string | null;
  hourly_rate_snapshot: number;
  saving: boolean;
  deleting: boolean;
};

export function EditHoursDialog({
  open,
  onOpenChange,
  member,
  workDate,
  entries,
  jobs,
  onDone,
  onAddNew,
}: Props) {
  const [rows, setRows] = useState<RowState[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      entries.map((e) => ({
        id: e.id,
        job_id: e.job_id,
        hours: String(e.hours),
        notes: e.notes ?? "",
        paid_at: e.paid_at,
        hourly_rate_snapshot: Number(e.hourly_rate_snapshot),
        saving: false,
        deleting: false,
      })),
    );
  }, [open, entries]);

  const totalAmount = useMemo(
    () =>
      rows.reduce((s, r) => {
        const h = Number(r.hours);
        if (Number.isNaN(h) || h <= 0) return s;
        return s + h * r.hourly_rate_snapshot;
      }, 0),
    [rows],
  );

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((curr) => curr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSaveRow(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const hoursNum = Number(row.hours);
    if (Number.isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      toast.error("Horas inválidas (entre 0.1 e 24)");
      return;
    }
    if (!row.job_id) {
      toast.error("Escolha o job");
      return;
    }

    if (row.paid_at) {
      if (
        !confirm(
          `Esse registro já foi pago.\n\n` +
            `Editar vai mudar as horas/valor MAS o pagamento (business_expense) ` +
            `que já foi feito NÃO muda. Isso vai criar diferença entre o ` +
            `valor da semana e o que você pagou.\n\n` +
            `Continuar?`,
        )
      )
        return;
    }

    updateRow(rowId, { saving: true });
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("job_hours")
      .update({
        job_id: row.job_id,
        hours: hoursNum,
        notes: row.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);

    updateRow(rowId, { saving: false });

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success(`Registro atualizado (${hoursNum}h)`);
    onDone();
  }

  async function handleDeleteRow(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const baseMsg = `Apagar este registro de horas?\n\n${row.hours}h em ${workDate} — ${formatCurrency(
      Number(row.hours) * row.hourly_rate_snapshot,
    )}`;
    const extra = row.paid_at
      ? `\n\n⚠️ Esse registro JÁ FOI PAGO. Apagar vai criar diferença com o pagamento já feito.`
      : "";

    if (!confirm(baseMsg + extra)) return;

    updateRow(rowId, { deleting: true });
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("job_hours").delete().eq("id", rowId);

    updateRow(rowId, { deleting: false });

    if (error) {
      toast.error(`Erro ao apagar: ${error.message}`);
      return;
    }
    toast.success("Registro apagado");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            Editar horas — {member.name}
          </DialogTitle>
          <DialogDescription>
            {format(new Date(workDate + "T12:00:00"), "EEEE, dd 'de' MMM 'de' yyyy", {
              locale: ptBR,
            })}{" "}
            · {formatCurrency(Number(member.hourly_rate))}/h
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-jcn-ice/45">
              Sem registros neste dia.
            </p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
              >
                {/* Header status */}
                <div className="flex items-center justify-between gap-2">
                  {r.paid_at ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Pago
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      Pendente
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRow(r.id)}
                    disabled={r.saving || r.deleting}
                    className="h-7 px-2 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                  >
                    {r.deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Apagar
                  </Button>
                </div>

                {/* Job + Hours */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                      Job
                    </Label>
                    <select
                      value={r.job_id}
                      onChange={(e) =>
                        updateRow(r.id, { job_id: e.target.value })
                      }
                      disabled={r.saving || r.deleting}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {jobs.length === 0 && <option value="">Nenhum job</option>}
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.label}
                        </option>
                      ))}
                      {/* Garante que job atual aparece mesmo se nao tá no select (job completado) */}
                      {r.job_id &&
                        !jobs.find((j) => j.id === r.job_id) && (
                          <option value={r.job_id}>
                            (job atual, fora da lista)
                          </option>
                        )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                      Horas
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={r.hours}
                      onChange={(e) =>
                        updateRow(r.id, { hours: e.target.value })
                      }
                      disabled={r.saving || r.deleting}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Notas */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                    Notas
                  </Label>
                  <Input
                    type="text"
                    placeholder="Opcional"
                    value={r.notes}
                    onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                    disabled={r.saving || r.deleting}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Preview valor + Save */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-xs">
                    <span className="text-jcn-ice/55">Valor: </span>
                    <span className="font-bold text-jcn-gold-300">
                      {formatCurrency(
                        (Number(r.hours) || 0) * r.hourly_rate_snapshot,
                      )}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSaveRow(r.id)}
                    disabled={r.saving || r.deleting}
                    className="h-8"
                  >
                    {r.saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Salvar
                  </Button>
                </div>

                {r.paid_at && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Já foi pago. Editar muda só as horas, NÃO ajusta a
                      despesa que já foi lançada.
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Total + adicionar mais */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-jcn-gold-400/30 bg-jcn-gold-500/[0.08] p-3">
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-jcn-gold-300">
            Total do dia: {formatCurrency(totalAmount)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddNew}
            className="border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300 hover:bg-jcn-gold-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar outro
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
