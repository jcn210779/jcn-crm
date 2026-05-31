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
import { deleteInvoiceFile } from "@/lib/job-invoices";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { JobInvoice } from "@/lib/types";

type Props = {
  invoice: JobInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteInvoiceDialog({
  invoice,
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

    // 1) Remove arquivo do Storage (órfão é débito técnico aceitável se falhar)
    await deleteInvoiceFile({ supabase, storagePath: invoice.file_path });

    // 2) DELETE do banco
    const { error } = await supabase
      .from("job_invoices")
      .delete()
      .eq("id", invoice.id);

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
            Excluir fatura
          </DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita. O arquivo anexado também será
            apagado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
            <p className="text-sm font-semibold text-jcn-ice">
              {invoice.invoice_number
                ? `Fatura ${invoice.invoice_number}`
                : invoice.file_name}
            </p>
            <p className="mt-1 text-xs text-jcn-ice/55">
              {invoice.amount != null
                ? formatCurrency(Number(invoice.amount))
                : "Sem valor informado"}
              {" · "}
              {invoice.file_name}
            </p>
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
