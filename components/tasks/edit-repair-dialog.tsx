"use client";

import { CheckCircle2, Loader2, Save, Trash2 } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  REPAIR_STATUSES,
  type Repair,
  type RepairStatus,
  type RepairType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RepairStatus, string> = {
  open: "Aberto",
  scheduled: "Agendado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: Repair;
  onDone: () => void;
};

export function EditRepairDialog({
  open,
  onOpenChange,
  repair,
  onDone,
}: Props) {
  const [customerName, setCustomerName] = useState(repair.customer_name);
  const [customerPhone, setCustomerPhone] = useState(
    repair.customer_phone ?? "",
  );
  const [customerAddress, setCustomerAddress] = useState(
    repair.customer_address ?? "",
  );
  const [description, setDescription] = useState(repair.description);
  const [type, setType] = useState<RepairType>(repair.type);
  const [status, setStatus] = useState<RepairStatus>(repair.status);
  const [scheduledFor, setScheduledFor] = useState(
    repair.scheduled_for
      ? new Date(repair.scheduled_for).toISOString().slice(0, 16)
      : "",
  );
  const [valueEstimated, setValueEstimated] = useState(
    repair.value_estimated?.toString() ?? "",
  );
  const [valueCharged, setValueCharged] = useState(
    repair.value_charged?.toString() ?? "",
  );
  const [notes, setNotes] = useState(repair.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerName(repair.customer_name);
    setCustomerPhone(repair.customer_phone ?? "");
    setCustomerAddress(repair.customer_address ?? "");
    setDescription(repair.description);
    setType(repair.type);
    setStatus(repair.status);
    setScheduledFor(
      repair.scheduled_for
        ? new Date(repair.scheduled_for).toISOString().slice(0, 16)
        : "",
    );
    setValueEstimated(repair.value_estimated?.toString() ?? "");
    setValueCharged(repair.value_charged?.toString() ?? "");
    setNotes(repair.notes ?? "");
  }, [open, repair]);

  const isCompleted = repair.status === "completed";
  const hasCashAdjustment = !!repair.cash_adjustment_id;

  async function handleSave() {
    if (!customerName.trim() || !description.trim()) {
      toast.error("Cliente e descrição são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("repairs")
        .update({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          customer_address: customerAddress.trim() || null,
          description: description.trim(),
          type,
          status,
          scheduled_for: scheduledFor ? `${scheduledFor}:00` : null,
          value_estimated:
            type === "paid" && valueEstimated
              ? Number(valueEstimated.replace(/[^0-9.]/g, ""))
              : null,
          notes: notes.trim() || null,
        })
        .eq("id", repair.id);

      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }

      toast.success("Reparo atualizado");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteAndCharge() {
    const charged =
      type === "paid" && valueCharged
        ? Number(valueCharged.replace(/[^0-9.]/g, ""))
        : null;

    if (type === "paid" && (!charged || charged <= 0)) {
      toast.error("Pra concluir reparo pago, informe o valor cobrado");
      return;
    }

    setCompleting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      let cashAdjustmentId: string | null = null;

      // Se é PAID + valor > 0, cria cash_adjustment income
      if (type === "paid" && charged && charged > 0) {
        const { data: caData, error: caError } = await supabase
          .from("cash_adjustments")
          .insert({
            adjustment_date: new Date().toISOString().slice(0, 10),
            kind: "income",
            source: "other",
            amount: charged,
            description: `[Reparo] ${customerName.trim()} — ${description.trim().slice(0, 60)}`,
            notes: `Reparo cobrado. Endereço: ${customerAddress || "—"}`,
          })
          .select("id")
          .single();

        if (caError || !caData) {
          toast.error(`Erro ao lançar caixa: ${caError?.message}`);
          setCompleting(false);
          return;
        }
        cashAdjustmentId = caData.id;
      }

      // Marca reparo como completed
      const { error: updError } = await supabase
        .from("repairs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          value_charged: charged,
          cash_adjustment_id: cashAdjustmentId,
        })
        .eq("id", repair.id);

      if (updError) {
        toast.error(`Erro: ${updError.message}`);
        return;
      }

      toast.success(
        type === "warranty"
          ? "Reparo de garantia concluído ✓"
          : `Reparo concluído + ${formatCurrency(charged ?? 0)} no caixa`,
      );
      onDone();
    } finally {
      setCompleting(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Deletar reparo de ${customerName}? Esta ação não pode ser desfeita.`,
      )
    )
      return;

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("repairs")
        .delete()
        .eq("id", repair.id);

      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }
      toast.success("Reparo deletado");
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
            {isCompleted ? "Reparo concluído" : "Editar reparo"}
          </DialogTitle>
          <DialogDescription>
            {customerName} · {type === "warranty" ? "Garantia" : "Pago"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-1 pr-1">
          {hasCashAdjustment && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm">
              ✅ Reparo concluído e cobrado{" "}
              {formatCurrency(Number(repair.value_charged ?? 0))} — entrou no caixa
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RepairStatus)}
              disabled={isCompleted}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {REPAIR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isCompleted}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={isCompleted}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data/hora</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                disabled={isCompleted}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              disabled={isCompleted}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isCompleted}
            />
          </div>

          {type === "paid" && !isCompleted && (
            <>
              <div className="space-y-1.5">
                <Label>Valor estimado ($)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valueEstimated}
                  onChange={(e) => setValueEstimated(e.target.value)}
                  placeholder="200.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor cobrado ($) — preencha pra concluir</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valueCharged}
                  onChange={(e) => setValueCharged(e.target.value)}
                  placeholder="200.00"
                />
                <p className="text-[11px] text-jcn-ice/45">
                  Ao clicar Concluir, esse valor vira receita no caixa.
                </p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={isCompleted}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={saving || completing}
            className={cn("text-rose-300 hover:bg-rose-500/15 hover:text-rose-200")}
          >
            <Trash2 className="h-4 w-4" />
            Deletar
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || completing}
            >
              Fechar
            </Button>
            {!isCompleted && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={saving || completing}
                  variant="outline"
                >
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
                <Button
                  onClick={handleCompleteAndCharge}
                  disabled={saving || completing}
                  className="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-400/40"
                  variant="outline"
                >
                  {completing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Concluindo
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {type === "paid" ? "Concluir + cobrar" : "Concluir"}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
