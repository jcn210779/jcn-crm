"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { JobPayment } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: JobPayment | null;
};

/**
 * Dialog de confirmação pra deletar parcela.
 *
 * Regra anti-DELETE (lessons.md 2026-05-14): nenhum delete sem confirmação
 * explícita. Mostra o que vai ser apagado e exige um clique adicional.
 */
export function DeletePaymentDialog({ open, onOpenChange, payment }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) setDeleting(false);
  }, [open]);

  async function handleDelete() {
    if (!payment) return;
    setDeleting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("job_payments")
        .delete()
        .eq("id", payment.id);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Parcela removida.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-rose-500/30 bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight text-rose-300">
            Remover parcela
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. A parcela será apagada do banco.
          </DialogDescription>
        </DialogHeader>

        {payment ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 text-sm">
            <p className="font-bold text-white">{payment.label}</p>
            <p className="mt-1 text-primary">{formatCurrency(payment.amount)}</p>
            {payment.status === "paid" ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-300">
                Atenção: esta parcela está marcada como paga.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting || !payment}
            className="bg-rose-500 font-semibold text-white hover:bg-rose-600"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Removendo
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Remover
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
