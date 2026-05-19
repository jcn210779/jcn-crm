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
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { TeamMember } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  /** Pré-selecionar funcionário (opcional). */
  presetMemberId?: string | null;
  onDone: () => void;
};

export function AddPayableDialog({
  open,
  onOpenChange,
  members,
  presetMemberId,
  onDone,
}: Props) {
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMemberId(presetMemberId ?? members[0]?.id ?? "");
    setAmount("");
    setDescription("");
    setDueDate("");
    setNotes("");
  }, [open, presetMemberId, members]);

  async function handleSave() {
    if (!memberId) {
      toast.error("Escolha o funcionário");
      return;
    }
    const amt = Number(amount.replace(/[^0-9.]/g, ""));
    if (!amt || amt <= 0 || Number.isNaN(amt)) {
      toast.error("Valor inválido");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe uma descrição (ex: semana 19-23 mai)");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("team_payables").insert({
        member_id: memberId,
        amount: amt,
        description: description.trim(),
        due_date: dueDate || null,
        notes: notes.trim() || null,
      });
      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }
      toast.success("Pendência registrada");
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
            A pagar pra funcionário
          </DialogTitle>
          <DialogDescription>
            Registra uma dívida em aberto. Quando pagar, clica em Pagar e vira
            despesa real automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Funcionário</Label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (${Number(m.hourly_rate).toFixed(2)}/h)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor ($)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1188.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento (opcional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Semana 19-23 mai"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observações"
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Registrar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
