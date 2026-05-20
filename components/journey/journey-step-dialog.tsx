"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Loader2, Save, Trash2 } from "lucide-react";
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
import type { JourneyStep } from "@/lib/journey";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  leadId: string | null;
  step: JourneyStep;
  /** Se passado, é edição/remoção de override manual existente. */
  existingMilestoneId?: string;
  onDone: () => void;
};

export function JourneyStepDialog({
  open,
  onOpenChange,
  jobId,
  leadId,
  step,
  existingMilestoneId,
  onDone,
}: Props) {
  const [completedAt, setCompletedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompletedAt(
      step.completedAt
        ? new Date(step.completedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setNotes("");
  }, [open, step]);

  const isCompleted = step.status === "completed";
  const isAutoCompleted = isCompleted && !step.manual;

  // Decide se etapa pode ser ligada a job ou lead
  // Etapas 1-4 podem ser do lead. Etapas 5+ são do job.
  const useLeadId = ["lead_registered", "proposal_sent", "proposal_accepted", "contract_sent"].includes(
    step.kind,
  );
  const targetLeadId = useLeadId ? leadId : null;
  const targetJobId = useLeadId ? null : jobId;

  async function handleMarkComplete() {
    if (!targetLeadId && !targetJobId) {
      toast.error("Sem job/lead vinculado");
      return;
    }
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("journey_milestones").insert({
        lead_id: targetLeadId,
        job_id: targetJobId,
        kind: step.kind,
        completed_at: `${completedAt}T12:00:00Z`,
        notes: notes.trim() || null,
      });

      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }
      toast.success(`"${step.label}" marcada como concluída`);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!existingMilestoneId) {
      toast.error("Sem registro manual pra remover");
      return;
    }
    if (
      !confirm(`Desmarcar "${step.label}"? O sistema vai recomputar do zero.`)
    )
      return;
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("journey_milestones")
        .delete()
        .eq("id", existingMilestoneId);
      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }
      toast.success("Etapa desmarcada");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/[0.08] bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            {isCompleted ? (
              <Check className="h-5 w-5 text-emerald-300" />
            ) : (
              <span className="h-5 w-5 rounded-full border-2 border-jcn-gold-400/60" />
            )}
            {step.label}
          </DialogTitle>
          <DialogDescription>
            {isAutoCompleted && step.autoSource && (
              <span className="text-emerald-300">
                ✓ Conclusão automática: {step.autoSource}
              </span>
            )}
            {step.manual && step.completedAt && (
              <span className="text-emerald-300">
                ✓ Marcada manualmente em{" "}
                {format(new Date(step.completedAt), "d MMM yyyy", {
                  locale: ptBR,
                })}
              </span>
            )}
            {!isCompleted && (
              <span>Marca essa etapa como concluída quando voc&apos;ê fechar.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isCompleted && (
            <>
              <div className="space-y-1.5">
                <Label>Data de conclusão</Label>
                <Input
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex: enviei proposta por email, valor $X..."
                />
              </div>
            </>
          )}

          {isAutoCompleted && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-xs text-jcn-ice/65">
              Esta etapa é deduzida automaticamente dos dados do CRM. Pra
              desmarcar, você precisa remover o dado que dispara o auto
              (payment, mudança de fase, etc).
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {step.manual && existingMilestoneId && (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={saving}
              className="text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
            >
              <Trash2 className="h-4 w-4" />
              Desmarcar
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {isCompleted ? "Fechar" : "Cancelar"}
            </Button>
            {!isCompleted && (
              <Button onClick={handleMarkComplete} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Marcar concluída
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
