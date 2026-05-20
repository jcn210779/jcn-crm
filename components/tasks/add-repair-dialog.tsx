"use client";

import { Loader2, Save, ShieldCheck, DollarSign } from "lucide-react";
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
import type { RepairType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

export function AddRepairDialog({ open, onOpenChange, onDone }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<RepairType>("warranty");
  const [scheduledFor, setScheduledFor] = useState("");
  const [valueEstimated, setValueEstimated] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDescription("");
    setType("warranty");
    setScheduledFor("");
    setValueEstimated("");
    setNotes("");
  }, [open]);

  async function handleSave() {
    if (!customerName.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }
    if (!description.trim()) {
      toast.error("Descreva o reparo");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const valueEst =
        type === "paid" && valueEstimated
          ? Number(valueEstimated.replace(/[^0-9.]/g, ""))
          : null;

      const { error } = await supabase.from("repairs").insert({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        description: description.trim(),
        type,
        status: scheduledFor ? "scheduled" : "open",
        scheduled_for: scheduledFor
          ? `${scheduledFor}:00`
          : null,
        value_estimated: valueEst,
        notes: notes.trim() || null,
      });

      if (error) {
        toast.error(`Erro: ${error.message}`);
        return;
      }

      toast.success("Reparo registrado");
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
            Novo reparo
          </DialogTitle>
          <DialogDescription>
            Registra ligação de cliente pedindo reparo. Marca se é garantia (sem
            cobrança) ou pago.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto py-1 pr-1">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
              Tipo
            </Label>
            <div className="flex gap-2">
              <TypeChip
                active={type === "warranty"}
                onClick={() => setType("warranty")}
                icon={ShieldCheck}
                label="Garantia"
                activeClass="border-violet-400/40 bg-violet-500/15 text-violet-300"
              />
              <TypeChip
                active={type === "paid"}
                onClick={() => setType("paid")}
                icon={DollarSign}
                label="Pago"
                activeClass="border-jcn-gold-400/40 bg-jcn-gold-500/15 text-jcn-gold-300"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Smith"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="857-555-1234"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data/hora agendada</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="123 Main St, Woburn MA"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição do reparo *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tábua solta no deck, parafuso enferrujado, etc"
            />
          </div>

          {type === "paid" && (
            <div className="space-y-1.5">
              <Label>Valor estimado ($)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={valueEstimated}
                onChange={(e) => setValueEstimated(e.target.value)}
                placeholder="200.00"
              />
              <p className="text-[11px] text-jcn-ice/45">
                Quando concluir, o valor cobrado entra no caixa automaticamente.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notas</Label>
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
                Registrar reparo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeChip({
  active,
  onClick,
  icon: Icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition",
        active
          ? activeClass
          : "border-white/[0.08] bg-white/[0.025] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
