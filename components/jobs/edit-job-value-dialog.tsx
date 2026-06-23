"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Props = {
  jobId: string;
  currentValue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditJobValueDialog({
  jobId,
  currentValue,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentValue || 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(String(currentValue || 0));
  }, [open, currentValue]);

  async function handleSave() {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      toast.error("Valor inválido");
      return;
    }
    if (num === currentValue) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("jobs")
      .update({ value: num })
      .eq("id", jobId);
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success(`Valor atualizado pra ${formatCurrency(num)}`);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar valor do contrato</DialogTitle>
          <DialogDescription>
            Valor atual: <strong>{formatCurrency(currentValue)}</strong>. Não
            afeta extras aprovados — só o valor base do contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="job-value">Novo valor ($)</Label>
          <Input
            id="job-value"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            autoFocus
          />
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
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
