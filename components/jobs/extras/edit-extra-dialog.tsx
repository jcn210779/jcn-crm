"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ALLOWED_EXTRA_MIME_TYPES,
  deleteExtraAttachment,
  getSignedExtraUrl,
  MAX_EXTRA_SIZE_BYTES,
  uploadExtraAttachment,
} from "@/lib/job-extras";
import { EXTRA_STATUS_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  EXTRA_STATUSES,
  type ExtraStatus,
  type JobExtra,
  type JobExtraUpdate,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AttachmentSlot = "approval" | "contract";

type Props = {
  extra: JobExtra;
  signedUrls: {
    approval: string | null;
    contract: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

const STATUS_TONE: Record<ExtraStatus, string> = {
  proposed: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  completed: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
};

export function EditExtraDialog({
  extra,
  signedUrls,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(extra.title);
  const [description, setDescription] = useState(extra.description ?? "");
  const [additionalValue, setAdditionalValue] = useState(
    String(extra.additional_value ?? ""),
  );
  const [status, setStatus] = useState<ExtraStatus>(extra.status);
  const [approvedByName, setApprovedByName] = useState(
    extra.approved_by_name ?? "",
  );
  const [notes, setNotes] = useState(extra.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Estado local dos anexos (refletindo último estado salvo do banco)
  const [approvalState, setApprovalState] = useState({
    path: extra.approval_attachment_path,
    fileName: extra.approval_file_name,
    mime: extra.approval_mime,
    signedUrl: signedUrls.approval,
  });
  const [contractState, setContractState] = useState({
    path: extra.contract_attachment_path,
    fileName: extra.contract_file_name,
    mime: extra.contract_mime,
    signedUrl: signedUrls.contract,
  });

  const [uploading, setUploading] = useState<AttachmentSlot | null>(null);

  const approvalInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado interno quando muda de extra (dialog reaproveitado)
  useEffect(() => {
    setTitle(extra.title);
    setDescription(extra.description ?? "");
    setAdditionalValue(String(extra.additional_value ?? ""));
    setStatus(extra.status);
    setApprovedByName(extra.approved_by_name ?? "");
    setNotes(extra.notes ?? "");
    setApprovalState({
      path: extra.approval_attachment_path,
      fileName: extra.approval_file_name,
      mime: extra.approval_mime,
      signedUrl: signedUrls.approval,
    });
    setContractState({
      path: extra.contract_attachment_path,
      fileName: extra.contract_file_name,
      mime: extra.contract_mime,
      signedUrl: signedUrls.contract,
    });
  }, [extra, signedUrls]);

  const timeline = useMemo(
    () => [
      { label: "Proposto", at: extra.proposed_at, icon: Paperclip },
      { label: "Aprovado", at: extra.approved_at, icon: CheckCircle2 },
      { label: "Rejeitado", at: extra.rejected_at, icon: XCircle },
      { label: "Concluído", at: extra.completed_at, icon: CheckCircle2 },
    ],
    [extra],
  );

  async function handleUpload(slot: AttachmentSlot, file: File | null) {
    if (!file) return;
    if (file.size > MAX_EXTRA_SIZE_BYTES) {
      toast.error("Arquivo grande demais (máximo 20 MB)");
      return;
    }
    if (
      !ALLOWED_EXTRA_MIME_TYPES.some((m) => m === file.type.toLowerCase())
    ) {
      toast.error(`Formato não aceito (${file.type})`);
      return;
    }

    setUploading(slot);
    const supabase = createSupabaseBrowserClient();

    const upload = await uploadExtraAttachment({
      supabase,
      jobId: extra.job_id,
      file,
    });

    if (upload.error || !upload.path) {
      setUploading(null);
      toast.error(upload.error ?? "Falha ao enviar arquivo");
      return;
    }

    const patch: JobExtraUpdate =
      slot === "approval"
        ? {
            approval_attachment_path: upload.path,
            approval_file_name: upload.fileName ?? null,
            approval_mime: upload.mimeType ?? null,
          }
        : {
            contract_attachment_path: upload.path,
            contract_file_name: upload.fileName ?? null,
            contract_mime: upload.mimeType ?? null,
          };

    const { error } = await supabase
      .from("job_extras")
      .update(patch)
      .eq("id", extra.id);

    if (error) {
      // Rollback do arquivo se UPDATE falhou
      await supabase.storage.from("job-extras").remove([upload.path]);
      setUploading(null);
      toast.error("Erro ao salvar anexo", { description: error.message });
      return;
    }

    // Gera signed URL pra preview imediato
    const signedUrl = await getSignedExtraUrl({
      supabase,
      storagePath: upload.path,
    });

    if (slot === "approval") {
      setApprovalState({
        path: upload.path,
        fileName: upload.fileName ?? null,
        mime: upload.mimeType ?? null,
        signedUrl,
      });
    } else {
      setContractState({
        path: upload.path,
        fileName: upload.fileName ?? null,
        mime: upload.mimeType ?? null,
        signedUrl,
      });
    }

    setUploading(null);
    toast.success(
      slot === "approval"
        ? "Prova de aprovação anexada"
        : "Contrato anexado",
    );
    if (onSaved) onSaved();
  }

  async function handleRemoveAttachment(slot: AttachmentSlot) {
    const state = slot === "approval" ? approvalState : contractState;
    if (!state.path) return;

    const confirmMsg =
      slot === "approval"
        ? "Remover a prova de aprovação? Não dá pra desfazer."
        : "Remover o contrato anexado? Não dá pra desfazer.";
    if (!window.confirm(confirmMsg)) return;

    setUploading(slot);
    const supabase = createSupabaseBrowserClient();

    // 1) Remove do storage (segue mesmo se falhar)
    await deleteExtraAttachment({ supabase, storagePath: state.path });

    // 2) Limpa colunas no banco
    const patch: JobExtraUpdate =
      slot === "approval"
        ? {
            approval_attachment_path: null,
            approval_file_name: null,
            approval_mime: null,
          }
        : {
            contract_attachment_path: null,
            contract_file_name: null,
            contract_mime: null,
          };

    const { error } = await supabase
      .from("job_extras")
      .update(patch)
      .eq("id", extra.id);

    setUploading(null);

    if (error) {
      toast.error("Erro ao remover anexo", { description: error.message });
      return;
    }

    if (slot === "approval") {
      setApprovalState({
        path: null,
        fileName: null,
        mime: null,
        signedUrl: null,
      });
    } else {
      setContractState({
        path: null,
        fileName: null,
        mime: null,
        signedUrl: null,
      });
    }

    toast.success("Anexo removido");
    if (onSaved) onSaved();
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Título não pode ficar vazio");
      return;
    }
    const value = Number(additionalValue.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(value) || value < 0) {
      toast.error("Valor inválido");
      return;
    }
    if (status === "approved" && !approvedByName.trim()) {
      toast.error("Diga quem aprovou o extra");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    const patch: JobExtraUpdate = {
      title: title.trim(),
      description: description.trim() || null,
      additional_value: value,
      status,
      approved_by_name:
        status === "approved" || status === "completed"
          ? approvedByName.trim() || null
          : null,
      notes: notes.trim() || null,
    };

    const { error } = await supabase
      .from("job_extras")
      .update(patch)
      .eq("id", extra.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }

    toast.success("Extra atualizado");
    if (onSaved) onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhe do extra
            <Badge
              variant="outline"
              className={cn("text-[10px] font-semibold", STATUS_TONE[status])}
            >
              {EXTRA_STATUS_LABEL[status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Edite o trabalho extra. Mudanças de status preenchem timestamps
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Detalhes editáveis */}
          <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-jcn-ice/50">
              Detalhes
            </h4>

            <div className="space-y-1.5">
              <Label htmlFor="edit-ex-title">Título</Label>
              <Input
                id="edit-ex-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-ex-desc">Descrição</Label>
              <Textarea
                id="edit-ex-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-ex-value">Valor ($)</Label>
                <Input
                  id="edit-ex-value"
                  type="text"
                  inputMode="decimal"
                  value={additionalValue}
                  onChange={(e) => setAdditionalValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-ex-status">Status</Label>
                <select
                  id="edit-ex-status"
                  className="flex h-10 w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-jcn-ice outline-none focus:border-jcn-gold-400/40"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExtraStatus)}
                >
                  {EXTRA_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {EXTRA_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(status === "approved" || status === "completed") && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-ex-approver">Aprovado por</Label>
                <Input
                  id="edit-ex-approver"
                  value={approvedByName}
                  onChange={(e) => setApprovedByName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-ex-notes">Notas</Label>
              <Textarea
                id="edit-ex-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-jcn-ice/50">
              Timeline
            </h4>
            <ul className="space-y-1.5 text-xs">
              {timeline
                .filter((t) => t.at)
                .map((t) => (
                  <li
                    key={t.label}
                    className="flex items-center gap-2 text-jcn-ice/70"
                  >
                    <t.icon className="h-3.5 w-3.5 text-jcn-gold-300/70" />
                    <span className="font-semibold text-jcn-ice/85">
                      {t.label}:
                    </span>
                    <span>
                      {format(new Date(t.at as string), "d MMM yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {/* Anexos */}
          <div className="grid gap-3 md:grid-cols-2">
            <AttachmentPanel
              kind="approval"
              title="Prova de aprovação"
              hint="Foto, PDF ou print do WhatsApp do cliente confirmando."
              state={approvalState}
              uploading={uploading === "approval"}
              onPick={() => approvalInputRef.current?.click()}
              onRemove={() => handleRemoveAttachment("approval")}
            />
            <input
              ref={approvalInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) =>
                handleUpload("approval", e.target.files?.[0] ?? null)
              }
            />

            <AttachmentPanel
              kind="contract"
              title="Contrato adicional"
              hint="PDF formal de change order, se houver."
              state={contractState}
              uploading={uploading === "contract"}
              onPick={() => contractInputRef.current?.click()}
              onRemove={() => handleRemoveAttachment("contract")}
            />
            <input
              ref={contractInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) =>
                handleUpload("contract", e.target.files?.[0] ?? null)
              }
            />
          </div>

          {/* Valor em destaque */}
          <div className="flex items-center justify-between rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-jcn-gold-300/80">
              Valor adicional
            </span>
            <span className="text-xl font-black text-jcn-gold-300">
              {formatCurrency(
                Number(additionalValue.replace(/[^0-9.]/g, "")) || 0,
              )}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Fechar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AttachmentPanelProps = {
  kind: AttachmentSlot;
  title: string;
  hint: string;
  state: {
    path: string | null;
    fileName: string | null;
    mime: string | null;
    signedUrl: string | null;
  };
  uploading: boolean;
  onPick: () => void;
  onRemove: () => void;
};

function AttachmentPanel({
  kind,
  title,
  hint,
  state,
  uploading,
  onPick,
  onRemove,
}: AttachmentPanelProps) {
  const isPdf = state.mime === "application/pdf";

  return (
    <div className="space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-jcn-ice/50">
          {title}
        </h4>
        {state.path && (
          <Badge
            variant="outline"
            className="text-[9px] font-semibold border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          >
            Anexado
          </Badge>
        )}
      </div>
      <p className="text-[11px] text-jcn-ice/45">{hint}</p>

      {state.path ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300">
              {isPdf ? (
                <FileText className="h-4 w-4" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-jcn-ice">
                {state.fileName ?? "Arquivo"}
              </p>
              <p className="text-[10px] text-jcn-ice/45">
                {state.mime ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {state.signedUrl && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="flex-1"
                onClick={() => window.open(state.signedUrl as string, "_blank")}
              >
                {isPdf ? (
                  <FileText className="h-3.5 w-3.5" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                Abrir
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="text-rose-300/70 hover:text-rose-300"
              title="Remover anexo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={onPick}
          disabled={uploading}
        >
          {uploading ? (
            <>Enviando...</>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Anexar {kind === "approval" ? "prova" : "contrato"}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

