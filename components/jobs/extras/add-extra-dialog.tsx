"use client";

import { useState } from "react";
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
import { EXTRA_STATUS_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { ExtraStatus, JobExtraInsert } from "@/lib/types";

type Props = {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

/**
 * Dialog pra adicionar um novo extra/change order ao job.
 * MVP: status inicial só `proposed` ou `approved` (rejeitado/concluído
 * vêm depois via edit).
 */
export function AddExtraDialog({ jobId, open, onOpenChange, onDone }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalValue, setAdditionalValue] = useState("");
  const [status, setStatus] = useState<ExtraStatus>("proposed");
  const [approvedByName, setApprovedByName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setAdditionalValue("");
    setStatus("proposed");
    setApprovedByName("");
    setNotes("");
    setSaving(false);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Dê um título pro extra");
      return;
    }
    const value = Number(additionalValue.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(value) || value < 0) {
      toast.error("Valor inválido");
      return;
    }
    if (status === "approved" && !approvedByName.trim()) {
      toast.error("Diga quem aprovou o extra");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const payload: JobExtraInsert = {
      job_id: jobId,
      title: title.trim(),
      description: description.trim() || null,
      additional_value: value,
      status,
      approved_by_name:
        status === "approved" ? approvedByName.trim() || null : null,
      notes: notes.trim() || null,
    };

    const { error } = await supabase.from("job_extras").insert(payload);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar extra", { description: error.message });
      return;
    }

    toast.success("Extra registrado");
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
          <DialogTitle>Adicionar extra (change order)</DialogTitle>
          <DialogDescription>
            Trabalho adicional pedido pelo cliente durante a obra. Prova de
            aprovação e contrato podem ser anexados depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ex-title">Título *</Label>
            <Input
              id="ex-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Adicionar escadinha lateral"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-desc">Descrição (opcional)</Label>
            <Textarea
              id="ex-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="2 degraus, mesma madeira do deck principal..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-value">Valor adicional ($)</Label>
              <Input
                id="ex-value"
                type="text"
                inputMode="decimal"
                value={additionalValue}
                onChange={(e) => setAdditionalValue(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[10px] text-jcn-ice/40">
                Deixe 0 se for cortesia.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-status">Status inicial</Label>
              <select
                id="ex-status"
                className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                value={status}
                onChange={(e) => setStatus(e.target.value as ExtraStatus)}
              >
                <option value="proposed">
                  {EXTRA_STATUS_LABEL.proposed}
                </option>
                <option value="approved">
                  {EXTRA_STATUS_LABEL.approved} (já acertado)
                </option>
              </select>
            </div>
          </div>

          {status === "approved" && (
            <div className="space-y-1.5 rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-3">
              <Label htmlFor="ex-approver">Aprovado por *</Label>
              <Input
                id="ex-approver"
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                placeholder="Nome do cliente que aprovou"
              />
              <p className="text-[10px] text-jcn-ice/55">
                Anexe a prova (foto/PDF/print) depois, no detalhe do extra.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ex-notes">Notas (opcional)</Label>
            <Textarea
              id="ex-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações internas..."
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
            {saving ? "Salvando..." : "Salvar extra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
