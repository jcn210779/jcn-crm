"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import type { JobSubcontractorWithSub } from "@/lib/job-subs";
import {
  JOB_SUBCONTRACTOR_STATUS_LABEL,
  SUBCONTRACTOR_SPECIALTY_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  JOB_SUBCONTRACTOR_STATUSES,
  type JobSubcontractorStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobSub: JobSubcontractorWithSub;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

type Mode = "edit" | "confirm-complete" | "confirm-delete";

export function EditJobSubDialog({
  jobSub,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const [serviceDescription, setServiceDescription] = useState(
    jobSub.service_description,
  );
  const [agreedValue, setAgreedValue] = useState(String(jobSub.agreed_value));
  const [status, setStatus] = useState<JobSubcontractorStatus>(jobSub.status);
  const [notes, setNotes] = useState(jobSub.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [confirmText, setConfirmText] = useState("");

  async function persistSave(nextStatus: JobSubcontractorStatus) {
    if (!serviceDescription.trim()) {
      toast.error("Descreva o serviço contratado");
      return;
    }
    const value = Number(agreedValue.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(value) || value < 0) {
      toast.error("Valor combinado inválido");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("job_subcontractors")
      .update({
        service_description: serviceDescription.trim(),
        agreed_value: value,
        status: nextStatus,
        notes: notes.trim() || null,
      })
      .eq("id", jobSub.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }

    toast.success("Contratação atualizada");
    if (onDone) onDone();
  }

  async function handleSave() {
    // Se mudou pra completed, pedir confirmação extra
    if (status === "completed" && jobSub.status !== "completed") {
      setMode("confirm-complete");
      return;
    }
    await persistSave(status);
  }

  async function attemptDelete() {
    if (confirmText.toLowerCase() !== "excluir") {
      toast.error('Digite "excluir" pra confirmar');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("job_subcontractors")
      .delete()
      .eq("id", jobSub.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }

    toast.success("Contratação removida");
    if (onDone) onDone();
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("edit");
      setConfirmText("");
    }
    onOpenChange(next);
  }

  const subName = jobSub.sub?.name ?? "Sub removido";
  const subCompany = jobSub.sub?.company_name ?? null;
  const subSpecialty = jobSub.sub?.specialty ?? null;
  const subId = jobSub.sub?.id ?? null;

  // Confirm complete
  if (mode === "confirm-complete") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-300">
              <AlertTriangle className="h-5 w-5" />
              Marcar como concluído
            </DialogTitle>
            <DialogDescription>
              Confirma que {subName} terminou o serviço e foi pago? Vai entrar
              no histórico e contar como pagamento realizado.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm">
            <p className="font-semibold text-jcn-ice">{subName}</p>
            <p className="mt-1 text-xs text-jcn-ice/55 italic">
              {serviceDescription}
            </p>
            <p className="mt-2 text-base font-black text-jcn-gold-300">
              {formatCurrency(Number(agreedValue))}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setMode("edit")}
              disabled={saving}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => persistSave("completed")}
              disabled={saving}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {saving ? "Salvando..." : "Confirmar conclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Confirm delete
  if (mode === "confirm-delete") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              Remover contratação
            </DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita. O cadastro do sub continua em
              /subcontractors, só some desta obra.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
              <p className="text-sm font-semibold text-jcn-ice">{subName}</p>
              <p className="mt-1 text-xs text-jcn-ice/55 italic">
                {jobSub.service_description}
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
                setMode("edit");
                setConfirmText("");
              }}
              disabled={saving}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={attemptDelete}
              disabled={saving || confirmText.toLowerCase() !== "excluir"}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              {saving ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar contratação</DialogTitle>
          <DialogDescription>
            Atualize valor, status ou descrição do serviço contratado nesta
            obra.
          </DialogDescription>
        </DialogHeader>

        {/* Sub info (read-only) */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-jcn-ice">{subName}</span>
              {subCompany && (
                <span className="text-xs text-jcn-ice/55">· {subCompany}</span>
              )}
              {subSpecialty && (
                <Badge
                  variant="outline"
                  className="border-white/[0.08] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/65"
                >
                  {SUBCONTRACTOR_SPECIALTY_LABEL[subSpecialty]}
                </Badge>
              )}
            </div>
            {subId && (
              <Link
                href="/subcontractors"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55 transition hover:text-jcn-gold-300"
              >
                <ExternalLink className="h-3 w-3" />
                Cadastro
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ejs-desc">Descrição do serviço *</Label>
            <Textarea
              id="ejs-desc"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ejs-value">Valor combinado ($) *</Label>
              <Input
                id="ejs-value"
                type="text"
                inputMode="decimal"
                value={agreedValue}
                onChange={(e) => setAgreedValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ejs-status">Status</Label>
              <select
                id="ejs-status"
                className={cn(
                  "flex h-10 w-full rounded-md border bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40",
                  "border-white/[0.1]",
                )}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as JobSubcontractorStatus)
                }
              >
                {JOB_SUBCONTRACTOR_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {JOB_SUBCONTRACTOR_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ejs-notes">Notas</Label>
            <Textarea
              id="ejs-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setMode("confirm-delete")}
            disabled={saving}
            className="text-rose-300/80 hover:text-rose-300"
          >
            Remover
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
