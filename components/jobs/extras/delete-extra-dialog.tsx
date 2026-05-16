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
import { deleteExtraAttachment } from "@/lib/job-extras";
import { EXTRA_STATUS_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { JobExtra } from "@/lib/types";

type Props = {
  extra: JobExtra;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteExtraDialog({
  extra,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const hasAttachments = Boolean(
    extra.approval_attachment_path || extra.contract_attachment_path,
  );

  async function handleDelete() {
    if (confirmText.toLowerCase() !== "excluir") {
      toast.error('Digite "excluir" pra confirmar');
      return;
    }
    setDeleting(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Remove arquivos do Storage (segue mesmo se falhar — débito técnico
    //    aceitável; arquivos órfãos podem ser limpos depois)
    if (extra.approval_attachment_path) {
      await deleteExtraAttachment({
        supabase,
        storagePath: extra.approval_attachment_path,
      });
    }
    if (extra.contract_attachment_path) {
      await deleteExtraAttachment({
        supabase,
        storagePath: extra.contract_attachment_path,
      });
    }

    // 2) DELETE do banco
    const { error } = await supabase
      .from("job_extras")
      .delete()
      .eq("id", extra.id);

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
            Excluir extra
          </DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
            <p className="text-sm font-semibold text-jcn-ice">{extra.title}</p>
            <p className="mt-1 text-xs text-jcn-ice/55">
              {EXTRA_STATUS_LABEL[extra.status]} ·{" "}
              {formatCurrency(Number(extra.additional_value))}
            </p>
            {hasAttachments && (
              <p className="mt-2 text-xs text-rose-300/80">
                Os anexos (prova e/ou contrato) também serão apagados.
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
