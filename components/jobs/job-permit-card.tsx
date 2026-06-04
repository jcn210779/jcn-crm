"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MinusCircle,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERMIT_STATUS_LABEL } from "@/lib/labels";
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_SIZE_BYTES,
  uploadReceiptGeneric,
} from "@/lib/job-expenses";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { Job, JobPermitStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  job: Job;
  onChanged: () => void;
};

const STATUS_TONE: Record<JobPermitStatus, string> = {
  not_needed: "border-white/[0.08] bg-white/[0.04] text-jcn-ice/55",
  pending: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  released: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
};

const STATUS_ICON: Record<JobPermitStatus, typeof CheckCircle2> = {
  not_needed: MinusCircle,
  pending: Clock,
  released: CheckCircle2,
};

function formatBR(dateIso: string | null): string {
  if (!dateIso) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateIso));
}

export function JobPermitCard({ job, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<JobPermitStatus>(job.permit_status);
  const [permitNumber, setPermitNumber] = useState(job.permit_number ?? "");
  const [permitNotes, setPermitNotes] = useState(job.permit_notes ?? "");
  const [releasedAt, setReleasedAt] = useState<string>(
    job.permit_released_at ? job.permit_released_at.slice(0, 10) : "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStatus(job.permit_status);
    setPermitNumber(job.permit_number ?? "");
    setPermitNotes(job.permit_notes ?? "");
    setReleasedAt(
      job.permit_released_at ? job.permit_released_at.slice(0, 10) : "",
    );
  }, [job]);

  function handleFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_RECEIPT_SIZE_BYTES) {
      toast.error("Arquivo grande demais (máximo 20 MB)");
      return;
    }
    if (!ALLOWED_RECEIPT_MIME_TYPES.some((m) => m === f.type.toLowerCase())) {
      toast.error(`Formato não aceito (${f.type})`);
      return;
    }
    setFile(f);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // Upload do PDF se novo
    let newPath: string | null = job.permit_path;
    let newFileName: string | null = job.permit_file_name;
    let newSize: number | null = job.permit_size;
    let newMime: string | null = job.permit_mime;
    let newUploadedAt: string | null = job.permit_uploaded_at;

    if (file) {
      const result = await uploadReceiptGeneric({
        supabase,
        pathPrefix: `permits/${job.id}`,
        file,
      });
      if (result.error || !result.path) {
        setSaving(false);
        toast.error(result.error ?? "Falha no upload");
        return;
      }
      newPath = result.path;
      newFileName = result.fileName ?? null;
      newSize = result.fileSize ?? null;
      newMime = result.mimeType ?? null;
      newUploadedAt = new Date().toISOString();
    }

    // Released_at: se status virou released e ainda não tinha data, usa hoje
    let resAt: string | null = job.permit_released_at;
    if (status === "released") {
      resAt = releasedAt ? new Date(releasedAt + "T12:00:00").toISOString() : new Date().toISOString();
    } else {
      resAt = null;
    }

    const { error } = await supabase
      .from("jobs")
      .update({
        permit_status: status,
        permit_released_at: resAt,
        permit_number: permitNumber.trim() || null,
        permit_notes: permitNotes.trim() || null,
        permit_path: newPath,
        permit_file_name: newFileName,
        permit_size: newSize,
        permit_mime: newMime,
        permit_uploaded_at: newUploadedAt,
      })
      .eq("id", job.id);

    setSaving(false);

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }

    toast.success("Permit atualizado");
    setFile(null);
    setEditing(false);
    onChanged();
  }

  async function handleViewPdf() {
    if (!job.permit_path) return;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.storage
      .from("job-receipts")
      .createSignedUrl(job.permit_path, 3600);
    if (!data?.signedUrl) {
      toast.error("Não consegui gerar link do PDF");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDeletePdf() {
    if (!job.permit_path) return;
    if (!confirm("Apagar o PDF anexado do permit?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.storage.from("job-receipts").remove([job.permit_path]);
    const { error } = await supabase
      .from("jobs")
      .update({
        permit_path: null,
        permit_file_name: null,
        permit_size: null,
        permit_mime: null,
        permit_uploaded_at: null,
      })
      .eq("id", job.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success("PDF apagado");
    onChanged();
  }

  const StatusIcon = STATUS_ICON[job.permit_status];

  // VIEW MODE
  if (!editing) {
    return (
      <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border",
                STATUS_TONE[job.permit_status],
              )}
            >
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                Permit
              </p>
              <p
                className={cn(
                  "text-base font-black",
                  job.permit_status === "released"
                    ? "text-emerald-300"
                    : job.permit_status === "pending"
                      ? "text-amber-300"
                      : "text-jcn-ice/55",
                )}
              >
                {PERMIT_STATUS_LABEL[job.permit_status]}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="h-8"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>

        {/* Detalhes quando released */}
        {job.permit_status === "released" && (
          <div className="mt-4 space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 text-sm">
            {job.permit_released_at && (
              <div className="flex items-center gap-2 text-emerald-200/90">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-semibold">
                  Liberado em {formatBR(job.permit_released_at)}
                </span>
              </div>
            )}
            {job.permit_number && (
              <div className="text-jcn-ice/75">
                Número: <span className="font-mono font-semibold text-jcn-ice">{job.permit_number}</span>
              </div>
            )}
            {job.permit_notes && (
              <div className="text-jcn-ice/65 italic">{job.permit_notes}</div>
            )}
            {job.permit_path && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={handleViewPdf} className="h-8">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeletePdf}
                  className="h-8 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}

        {job.permit_status === "pending" && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3 text-[12px] text-amber-200/90">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Aguardando liberação do town/city. Clica em <strong>Editar</strong> quando sair pra anexar o PDF e
              marcar a data.
            </span>
          </div>
        )}
      </section>
    );
  }

  // EDIT MODE
  return (
    <section className="rounded-3xl border border-jcn-gold-400/30 bg-jcn-gold-500/[0.05] p-5 backdrop-blur-xl md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-jcn-gold-300">
          Editando permit
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(false);
            setFile(null);
            setStatus(job.permit_status);
            setPermitNumber(job.permit_number ?? "");
            setPermitNotes(job.permit_notes ?? "");
            setReleasedAt(
              job.permit_released_at ? job.permit_released_at.slice(0, 10) : "",
            );
          }}
          disabled={saving}
          className="h-7 px-2"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Status — 3 botões */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
            Status
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(["not_needed", "pending", "released"] as JobPermitStatus[]).map((s) => {
              const Icon = STATUS_ICON[s];
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-bold transition",
                    active
                      ? STATUS_TONE[s]
                      : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/45 hover:text-jcn-ice",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {PERMIT_STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data + Número (só quando released) */}
        {status === "released" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="permit-date" className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                  Data liberação
                </Label>
                <Input
                  id="permit-date"
                  type="date"
                  value={releasedAt}
                  onChange={(e) => setReleasedAt(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="permit-number" className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                  Número (opcional)
                </Label>
                <Input
                  id="permit-number"
                  type="text"
                  value={permitNumber}
                  onChange={(e) => setPermitNumber(e.target.value)}
                  placeholder="BLD-2026-1234"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="permit-notes" className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                Notas (opcional)
              </Label>
              <Textarea
                id="permit-notes"
                value={permitNotes}
                onChange={(e) => setPermitNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Town of Woburn — paid $385 on 03/06"
                disabled={saving}
              />
            </div>

            {/* Upload PDF */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">
                PDF do permit (opcional)
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-jcn-ice">{file.name}</p>
                    <p className="text-xs text-jcn-ice/55">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setFile(null)} disabled={saving}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : job.permit_path ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3">
                  <FileText className="h-5 w-5 text-emerald-300" />
                  <p className="flex-1 truncate text-sm text-jcn-ice">
                    {job.permit_file_name ?? "PDF anexado"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    Trocar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  type="button"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                >
                  <Upload className="h-4 w-4" />
                  Anexar PDF do permit
                </Button>
              )}
            </div>
          </>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditing(false);
              setFile(null);
            }}
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
                Salvar permit
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
