"use client";

import { AlertTriangle } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import { deleteReceiptFile } from "@/lib/job-expenses";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { JobExpense } from "@/lib/types";

type Props = {
  expense: JobExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteExpenseDialog({
  expense,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    if (confirmText.toLowerCase() !== "excluir") {
      toast.error('Digite "excluir" pra confirmar');
      return;
    }
    setDeleting(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Remove arquivo do Storage se houver
    if (expense.receipt_path) {
      await deleteReceiptFile({
        supabase,
        storagePath: expense.receipt_path,
      });
      // Se falhar, segue mesmo assim pra apagar do banco — arquivo órfão é débito técnico aceitável
    }

    // 2) DELETE do banco
    const { error } = await supabase
      .from("job_expenses")
      .delete()
      .eq("id", expense.id);

    setDeleting(false);

    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }

    setConfirmText("");
    if (onDeleted) onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
            Excluir despesa
          </DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
            <p className="text-sm font-semibold text-jcn-ice">
              {expense.description}
            </p>
            <p className="mt-1 text-xs text-jcn-ice/55">
              {EXPENSE_CATEGORY_LABEL[expense.category]} ·{" "}
              {formatCurrency(Number(expense.amount))}
              {expense.vendor && ` · ${expense.vendor}`}
            </p>
            {expense.receipt_path && (
              <p className="mt-2 text-xs text-rose-300/80">
                ⚠️ O recibo anexado também será apagado.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-jcn-ice/55">
              Pra confirmar, digite <strong>excluir</strong>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="flex h-10 w-full rounded-md border border-rose-400/30 bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-rose-400"
              placeholder="excluir"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setConfirmText("");
              onOpenChange(false);
            }}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={deleting || confirmText.toLowerCase() !== "excluir"}
            className="bg-rose-500 text-white hover:bg-rose-600"
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
