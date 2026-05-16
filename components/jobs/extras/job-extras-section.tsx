"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  FileText,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddExtraDialog } from "@/components/jobs/extras/add-extra-dialog";
import { DeleteExtraDialog } from "@/components/jobs/extras/delete-extra-dialog";
import { EditExtraDialog } from "@/components/jobs/extras/edit-extra-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { EXTRA_STATUS_LABEL } from "@/lib/labels";
import { type ExtraStatus, type JobExtra } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string;
  extras: JobExtra[];
  /** Map de signed URLs por storage path (approval e contract juntos). */
  attachmentUrls: Record<string, string | null>;
};

const STATUS_TONE: Record<ExtraStatus, string> = {
  proposed: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  completed: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
};

export function JobExtrasSection({
  jobId,
  extras,
  attachmentUrls,
}: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<JobExtra | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobExtra | null>(null);

  const stats = useMemo(() => {
    let proposedCount = 0;
    let proposedValue = 0;
    let approvedValue = 0;
    let completedCount = 0;
    for (const e of extras) {
      const amt = Number(e.additional_value);
      if (e.status === "proposed") {
        proposedCount++;
        proposedValue += amt;
      }
      if (e.status === "approved" || e.status === "completed") {
        approvedValue += amt;
      }
      if (e.status === "completed") {
        completedCount++;
      }
    }
    return {
      count: extras.length,
      proposedCount,
      proposedValue,
      approvedValue,
      completedCount,
    };
  }, [extras]);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-jcn-ice">
              Extras e change orders
            </h3>
            <p className="text-xs text-jcn-ice/55">
              Trabalhos adicionais que aparecem durante a obra. Cobre prova de
              aprovação e contrato anexo.
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="h-10 font-semibold">
          <Plus className="h-4 w-4" />
          Adicionar extra
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Total de extras"
          value={`${stats.count}`}
          accent="neutral"
        />
        <KpiCard
          label="Valor aprovado"
          value={formatCurrency(stats.approvedValue)}
          accent={stats.approvedValue > 0 ? "gold" : "neutral"}
        />
        <KpiCard
          label="Em proposta"
          value={`${stats.proposedCount}`}
          subValue={
            stats.proposedValue > 0
              ? formatCurrency(stats.proposedValue)
              : undefined
          }
          accent={stats.proposedCount > 0 ? "sky" : "neutral"}
        />
        <KpiCard
          label="Concluídos"
          value={`${stats.completedCount}`}
          accent={stats.completedCount > 0 ? "green" : "neutral"}
        />
      </div>

      {/* Lista */}
      <div className="mt-5 space-y-2">
        {extras.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          extras.map((e) => (
            <ExtraRow
              key={e.id}
              extra={e}
              hasApprovalUrl={Boolean(
                e.approval_attachment_path &&
                  attachmentUrls[e.approval_attachment_path],
              )}
              hasContractUrl={Boolean(
                e.contract_attachment_path &&
                  attachmentUrls[e.contract_attachment_path],
              )}
              onOpen={() => setEditTarget(e)}
              onDelete={() => setDeleteTarget(e)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddExtraDialog
        jobId={jobId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      {editTarget && (
        <EditExtraDialog
          extra={editTarget}
          signedUrls={{
            approval: editTarget.approval_attachment_path
              ? (attachmentUrls[editTarget.approval_attachment_path] ?? null)
              : null,
            contract: editTarget.contract_attachment_path
              ? (attachmentUrls[editTarget.contract_attachment_path] ?? null)
              : null,
          }}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          onSaved={() => {
            router.refresh();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteExtraDialog
          extra={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onDeleted={() => {
            setDeleteTarget(null);
            toast.success("Extra excluído");
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

type KpiAccent = "gold" | "green" | "sky" | "neutral";

type KpiCardProps = {
  label: string;
  value: string;
  subValue?: string;
  accent: KpiAccent;
};

function KpiCard({ label, value, subValue, accent }: KpiCardProps) {
  const accentClass: Record<KpiAccent, string> = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    sky: "border-sky-400/30 bg-sky-500/10 text-sky-300",
    neutral: "border-white/[0.08] bg-white/[0.03] text-jcn-ice",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-3 backdrop-blur-xl",
        accentClass[accent],
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
        {label}
      </div>
      <div className="mt-1.5 text-lg font-black tracking-tight">{value}</div>
      {subValue && <div className="mt-0.5 text-xs opacity-80">{subValue}</div>}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-jcn-ice/30" />
      <p className="mt-3 text-sm font-semibold text-jcn-ice/65">
        Nenhum extra registrado ainda
      </p>
      <p className="mt-1 text-xs text-jcn-ice/40">
        Trabalhos adicionais que o cliente pedir durante a obra ficam aqui, com
        prova de aprovação anexada.
      </p>
      <Button onClick={onAdd} variant="outline" className="mt-4">
        <Plus className="h-4 w-4" />
        Adicionar primeiro
      </Button>
    </div>
  );
}

type ExtraRowProps = {
  extra: JobExtra;
  hasApprovalUrl: boolean;
  hasContractUrl: boolean;
  onOpen: () => void;
  onDelete: () => void;
};

function ExtraRow({
  extra,
  hasApprovalUrl,
  hasContractUrl,
  onOpen,
  onDelete,
}: ExtraRowProps) {
  const dateLabel = useMemo(() => {
    const refDate =
      extra.status === "completed" && extra.completed_at
        ? extra.completed_at
        : extra.status === "rejected" && extra.rejected_at
          ? extra.rejected_at
          : extra.status === "approved" && extra.approved_at
            ? extra.approved_at
            : extra.proposed_at;
    return format(new Date(refDate), "d 'de' MMM 'de' yyyy", {
      locale: ptBR,
    });
  }, [extra]);

  const statusIcon =
    extra.status === "approved" || extra.status === "completed" ? (
      <CheckCircle2 className="h-3 w-3" />
    ) : extra.status === "rejected" ? (
      <XCircle className="h-3 w-3" />
    ) : null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.04] md:flex-row md:items-center md:justify-between">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col gap-1.5 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold",
              STATUS_TONE[extra.status],
            )}
          >
            <span className="inline-flex items-center gap-1">
              {statusIcon}
              {EXTRA_STATUS_LABEL[extra.status]}
            </span>
          </Badge>
          <span className="text-sm font-bold text-jcn-ice">{extra.title}</span>
          {hasApprovalUrl && (
            <Paperclip
              className="h-3.5 w-3.5 text-jcn-gold-300/70"
              aria-label="Prova de aprovação anexada"
            />
          )}
          {hasContractUrl && (
            <FileText
              className="h-3.5 w-3.5 text-jcn-gold-300/70"
              aria-label="Contrato anexado"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
          <span>{dateLabel}</span>
          {extra.approved_by_name && (
            <>
              <span>·</span>
              <span>Aprovou: {extra.approved_by_name}</span>
            </>
          )}
          {extra.description && (
            <span className="line-clamp-1 italic opacity-70">
              {extra.description}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="text-right">
          <div className="text-base font-black text-jcn-gold-300">
            {formatCurrency(Number(extra.additional_value))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-9 w-9 p-0 text-rose-300/70 hover:text-rose-300"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
