"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AddSubPaymentDialog } from "@/components/jobs/subcontractors/add-sub-payment-dialog";

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
import {
  deriveSubPaymentStatus,
  subRemainingBalance,
  type JobSubcontractorWithSub,
} from "@/lib/job-subs";
import {
  JOB_SUBCONTRACTOR_STATUS_LABEL,
  SUBCONTRACTOR_SPECIALTY_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  JOB_SUBCONTRACTOR_STATUSES,
  type JobSubPayment,
  type JobSubcontractorStatus,
} from "@/lib/types";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
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

  // Parcelas pagas (migration 0047)
  const [payments, setPayments] = useState<JobSubPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);

  async function reloadPayments() {
    setLoadingPayments(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("job_sub_payments")
      .select("*")
      .eq("job_subcontractor_id", jobSub.id)
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false });
    setPayments((data ?? []) as JobSubPayment[]);
    setLoadingPayments(false);
  }

  useEffect(() => {
    if (open) void reloadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobSub.id]);

  async function handleDeletePayment(payment: JobSubPayment) {
    if (
      !confirm(
        `Apagar parcela de ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(payment.amount)} de ${payment.paid_at}?\n\nA despesa correspondente em /finance também vai ser apagada.`,
      )
    )
      return;
    const supabase = createSupabaseBrowserClient();
    // Apaga BE primeiro (FK SET NULL, não cascade)
    if (payment.business_expense_id) {
      await supabase
        .from("business_expenses")
        .delete()
        .eq("id", payment.business_expense_id);
    }
    const { error } = await supabase
      .from("job_sub_payments")
      .delete()
      .eq("id", payment.id);
    if (error) {
      toast.error("Erro ao apagar parcela", { description: error.message });
      return;
    }
    toast.success("Parcela apagada");
    await reloadPayments();
    if (onDone) onDone();
  }

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

    // Pagamento agora é gerenciado via tabela job_sub_payments (mig 0047) —
    // amount_paid e paid_at em job_subcontractors são cache derivado,
    // atualizado por trigger quando parcela é inserida/apagada.
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
              Confirma que {subName} terminou o serviço? Marca o trabalho como
              concluído. (Pagamento é gerenciado separado — em parcelas no card
              de Pagamentos.)
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

          {/* Pagamento ao sub — parcelas (mig 0047) */}
          {(() => {
            const agreed = Number(agreedValue.replace(/[^0-9.]/g, "")) || 0;
            const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const payStatus = deriveSubPaymentStatus({
              agreedValue: agreed,
              amountPaid: paid,
            });
            const remaining = subRemainingBalance({
              agreedValue: agreed,
              amountPaid: paid,
            });
            const overpaid = agreed > 0 && paid > agreed;
            const payTone =
              payStatus === "paid"
                ? "border-emerald-400/30 bg-emerald-500/5"
                : payStatus === "partial"
                  ? "border-orange-400/30 bg-orange-500/5"
                  : "border-white/[0.1] bg-white/[0.03]";
            const payLabel =
              payStatus === "paid"
                ? "Pago"
                : payStatus === "partial"
                  ? "Parcial"
                  : "Não pago";
            const payLabelTone =
              payStatus === "paid"
                ? "text-emerald-300"
                : payStatus === "partial"
                  ? "text-orange-300"
                  : "text-jcn-ice/70";
            return (
              <div className={cn("rounded-2xl border p-3", payTone)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/65">
                    Pagamentos ao sub
                  </span>
                  <span
                    className={cn(
                      "rounded-full border border-white/[0.15] bg-white/[0.04] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                      payLabelTone,
                    )}
                  >
                    {payLabel}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] uppercase text-jcn-ice/45">
                      Combinado
                    </p>
                    <p className="font-bold text-jcn-ice">
                      {formatCurrency(agreed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-jcn-ice/45">
                      Pago
                    </p>
                    <p className="font-bold text-jcn-ice">
                      {formatCurrency(paid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-jcn-ice/45">
                      Saldo
                    </p>
                    <p
                      className={cn(
                        "font-bold",
                        remaining > 0 ? "text-orange-300" : "text-jcn-ice/55",
                      )}
                    >
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                </div>

                {/* Lista de parcelas */}
                <div className="mt-3 space-y-1.5">
                  {loadingPayments ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-jcn-ice/45" />
                    </div>
                  ) : payments.length === 0 ? (
                    <p className="text-center text-xs italic text-jcn-ice/45">
                      Nenhuma parcela registrada ainda
                    </p>
                  ) : (
                    payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-jcn-ice">
                              {formatCurrency(Number(p.amount))}
                            </span>
                            <span className="text-jcn-ice/55">·</span>
                            <span className="text-jcn-ice/70">
                              {format(
                                new Date(`${p.paid_at}T12:00:00`),
                                "dd MMM yyyy",
                                { locale: ptBR },
                              )}
                            </span>
                          </div>
                          <div className="text-[10px] text-jcn-ice/45">
                            {p.method ? PAYMENT_METHOD_LABEL[p.method] : "—"}
                            {p.check_number && ` #${p.check_number}`}
                            {p.notes && ` · ${p.notes}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p)}
                          className="shrink-0 rounded-md p-1 text-jcn-ice/35 transition hover:bg-rose-500/15 hover:text-rose-300"
                          title="Apagar parcela (e despesa no /finance)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddPaymentOpen(true)}
                  className="mt-3 w-full border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-200 hover:bg-jcn-gold-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Registrar pagamento
                </Button>

                {overpaid && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Total pago ({formatCurrency(paid)}) está acima do combinado
                    ({formatCurrency(agreed)}). Confere se está certo.
                  </p>
                )}
              </div>
            );
          })()}

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

      <AddSubPaymentDialog
        jobSubId={jobSub.id}
        subName={subName}
        serviceDescription={serviceDescription}
        agreedValue={Number(agreedValue.replace(/[^0-9.]/g, "")) || 0}
        alreadyPaid={payments.reduce((sum, p) => sum + Number(p.amount), 0)}
        open={addPaymentOpen}
        onOpenChange={setAddPaymentOpen}
        onDone={() => {
          void reloadPayments();
          if (onDone) onDone();
        }}
      />
    </Dialog>
  );
}
