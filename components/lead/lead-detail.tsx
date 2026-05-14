"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  HardHat,
  Mail,
  MapPin,
  Phone,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { FollowUpSection } from "@/components/lead/followup-section";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPhone } from "@/lib/format";
import {
  LOST_REASON_LABEL,
  SERVICE_LABEL,
  SOURCE_LABEL,
  STAGE_LABEL,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  LEAD_STAGES,
  LOST_REASONS,
  type ActivityLogRow,
  type Job,
  type Lead,
  type LeadStage,
  type LostReason,
  type StageHistoryRow,
  type Task,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  lead: Lead;
  activities: ActivityLogRow[];
  history: StageHistoryRow[];
  tasks: Task[];
  job: Job | null;
  userEmail: string;
};

const STAGE_BADGE_VARIANT: Record<
  LeadStage,
  "default" | "secondary" | "destructive" | "outline"
> = {
  novo: "secondary",
  contato_feito: "secondary",
  visita_agendada: "default",
  cotando: "default",
  estimate_enviado: "default",
  follow_up: "default",
  ganho: "default",
  perdido: "destructive",
};

export function LeadDetail({
  lead,
  activities,
  history,
  tasks,
  job,
  userEmail,
}: Props) {
  const router = useRouter();

  const [notes, setNotes] = useState<string>(lead.notes ?? "");
  const [estimatedValue, setEstimatedValue] = useState<string>(
    lead.estimated_value?.toString() ?? "",
  );
  const [showValueDialog, setShowValueDialog] = useState(false);
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [lostReason, setLostReason] = useState<LostReason>("ghosted");
  const [lostNotes, setLostNotes] = useState("");

  async function updateStage(newStage: LeadStage) {
    if (newStage === "perdido") {
      setShowLostDialog(true);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("leads")
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (error) {
      toast.error("Erro ao atualizar etapa", { description: error.message });
      return;
    }
    toast.success(`Etapa: ${STAGE_LABEL[newStage]}`);
    router.refresh();
  }

  async function saveNotes() {
    if (notes === (lead.notes ?? "")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("leads")
      .update({ notes: notes || null, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (error) {
      toast.error("Erro ao salvar nota", { description: error.message });
      return;
    }
    toast.success("Nota salva");
    router.refresh();
  }

  async function saveEstimatedValue() {
    const supabase = createSupabaseBrowserClient();
    const parsed = estimatedValue
      ? Number(estimatedValue.replace(/[^0-9.]/g, ""))
      : null;
    if (parsed !== null && Number.isNaN(parsed)) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({
        estimated_value: parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    if (error) {
      toast.error("Erro ao atualizar valor", { description: error.message });
      return;
    }
    setShowValueDialog(false);
    toast.success("Valor atualizado");
    router.refresh();
  }

  async function confirmLost() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("leads")
      .update({
        stage: "perdido",
        lost_reason: lostReason,
        lost_notes: lostNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    if (error) {
      toast.error("Erro ao marcar perdido", { description: error.message });
      return;
    }
    setShowLostDialog(false);
    toast.success("Lead marcado como perdido");
    router.refresh();
  }

  async function deleteLead() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Lead excluído");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-5 px-4 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Pipeline
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black tracking-[-0.02em] text-white md:text-4xl">
            {lead.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/55">
            <Badge variant={STAGE_BADGE_VARIANT[lead.stage]}>
              {STAGE_LABEL[lead.stage]}
            </Badge>
            <span>·</span>
            <span>{SOURCE_LABEL[lead.source]}</span>
            <span>·</span>
            <span>
              Criado{" "}
              {formatDistanceToNow(new Date(lead.created_at), {
                locale: ptBR,
                addSuffix: true,
              })}
            </span>
          </div>
          {lead.stage === "ganho" && job && (
            <Link
              href={`/job/${job.id}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-300 transition hover:bg-emerald-500/20"
            >
              <HardHat className="h-3.5 w-3.5" />
              Ver job →
            </Link>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 border-white/[0.1] bg-white/[0.04]">
              Mover etapa
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {LEAD_STAGES.map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={s === lead.stage}
                onSelect={() => updateStage(s)}
              >
                {STAGE_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Contato */}
        <SectionCard title="Contato">
          <div className="space-y-3 text-sm">
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-white transition hover:bg-white/[0.05]"
              >
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-semibold">{formatPhone(lead.phone)}</span>
              </a>
            ) : (
              <EmptyLine label="Sem telefone" />
            )}
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-white transition hover:bg-white/[0.05]"
              >
                <Mail className="h-4 w-4 text-primary" />
                <span className="font-semibold">{lead.email}</span>
              </a>
            ) : (
              <EmptyLine label="Sem email" />
            )}
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-white">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />
              <div className="text-sm font-semibold leading-[1.5]">
                {lead.address ? <div>{lead.address}</div> : null}
                <div>
                  {lead.city}
                  {lead.state ? `, ${lead.state}` : ""}
                  {lead.zip ? ` ${lead.zip}` : ""}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Detalhes */}
        <SectionCard title="Detalhes">
          <dl className="grid gap-3 text-sm">
            <Row label="Serviço">{SERVICE_LABEL[lead.service_interest]}</Row>
            <Row label="Fonte">{SOURCE_LABEL[lead.source]}</Row>
            <Row label="Valor estimado">
              <button
                onClick={() => setShowValueDialog(true)}
                className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-1 font-bold text-primary transition hover:border-primary/40"
              >
                {formatCurrency(lead.estimated_value)}
              </button>
            </Row>
            {lead.source_detail && (
              <Row label="Detalhe da fonte">{lead.source_detail}</Row>
            )}
            {lead.service_notes && (
              <Row label="Notas do serviço">{lead.service_notes}</Row>
            )}
            {lead.stage === "perdido" && lead.lost_reason && (
              <Row label="Motivo da perda">
                {LOST_REASON_LABEL[lead.lost_reason]}
              </Row>
            )}
          </dl>
        </SectionCard>
      </div>

      {/* Follow-ups (Fase 3) */}
      <FollowUpSection lead={lead} tasks={tasks} userEmail={userEmail} />

      {/* Notes editavel */}
      <SectionCard title="Anotações">
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Anotações livres. Salva automaticamente."
          className="resize-none border-white/[0.08] bg-white/[0.025] text-sm"
        />
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
          Salva ao sair do campo
        </p>
      </SectionCard>

      {/* Timeline */}
      <SectionCard title="Timeline">
        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/35">
            Sem atividade registrada ainda
          </p>
        ) : (
          <ol className="space-y-3">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">
                    {describeActivity(a)}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">
                    {format(new Date(a.created_at), "dd 'de' MMM 'às' HH:mm", {
                      locale: ptBR,
                    })}{" "}
                    · {a.created_by}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {/* Stage history */}
      <SectionCard title="Histórico de etapas">
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/35">
            Nenhuma mudança registrada
          </p>
        ) : (
          <ol className="space-y-2">
            {history.map((h, idx) => (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-sm"
              >
                <Clock className="h-4 w-4 text-white/40" />
                <div className="flex-1">
                  <span className="font-semibold text-white">
                    {h.from_stage ? STAGE_LABEL[h.from_stage] : "—"} →{" "}
                    {STAGE_LABEL[h.to_stage]}
                  </span>
                  {idx < history.length - 1 && (
                    <span className="ml-2 text-[11px] text-white/40">
                      ficou{" "}
                      {formatDistanceToNow(new Date(h.changed_at), {
                        locale: ptBR,
                      })}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-white/35">
                  {format(new Date(h.changed_at), "dd/MM HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {/* Acoes destrutivas */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Ações</h4>
          <p className="mt-0.5 text-xs text-white/45">
            Marcar perdido salva o motivo. Excluir não tem volta.
          </p>
        </div>
        <div className="flex gap-2">
          {lead.stage !== "perdido" && lead.stage !== "ganho" && (
            <Button
              variant="outline"
              className="h-10 border-white/[0.1]"
              onClick={() => setShowLostDialog(true)}
            >
              <XCircle className="h-4 w-4" />
              Marcar perdido
            </Button>
          )}
          <Button
            variant="destructive"
            className="h-10"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Dialog: editar valor */}
      <Dialog open={showValueDialog} onOpenChange={setShowValueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valor estimado</DialogTitle>
            <DialogDescription>
              Estimativa mental — não é o estimate formal.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-white/45">
              $
            </span>
            <Input
              inputMode="decimal"
              autoFocus
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              className="h-12 border-white/10 bg-white/[0.03] pl-8 text-base"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowValueDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={saveEstimatedValue}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: marcar perdido */}
      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como perdido</DialogTitle>
            <DialogDescription>
              Saber o porquê alimenta o aprendizado de longo prazo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-[0.15em] text-white/55">
                Motivo
              </Label>
              <Select
                value={lostReason}
                onValueChange={(v) => setLostReason(v as LostReason)}
              >
                <SelectTrigger className="mt-2 h-11 border-white/10 bg-white/[0.03]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {LOST_REASON_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-[0.15em] text-white/55">
                Contexto (opcional)
              </Label>
              <Textarea
                rows={3}
                value={lostNotes}
                onChange={(e) => setLostNotes(e.target.value)}
                placeholder="Ex: escolheu concorrente mais barato $3k"
                className="mt-2 resize-none border-white/10 bg-white/[0.03]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLostDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmLost}>
              Confirmar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: excluir */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lead?</DialogTitle>
            <DialogDescription>
              Remove o lead, a timeline e o histórico de etapas. Sem volta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteLead}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl md:p-6">
      <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/45">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4")}>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-white">{children}</dd>
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-transparent px-3 py-2.5 text-sm text-white/35">
      {label}
    </div>
  );
}

function describeActivity(a: ActivityLogRow): string {
  switch (a.type) {
    case "lead_created":
      return "Lead criado";
    case "stage_changed": {
      const payload = a.payload as {
        from?: LeadStage | null;
        to?: LeadStage;
      };
      if (payload?.to) {
        return `Mudou para ${STAGE_LABEL[payload.to]}`;
      }
      return "Mudança de etapa";
    }
    case "note_added":
      return "Nota adicionada";
    case "call_logged":
      return "Ligação registrada";
    case "followup_done": {
      const payload = a.payload as { notes?: string };
      return payload?.notes
        ? `Follow-up: ${payload.notes}`
        : "Follow-up registrado";
    }
    case "task_scheduled": {
      const payload = a.payload as { title?: string };
      return payload?.title
        ? `Tarefa agendada: ${payload.title}`
        : "Tarefa agendada";
    }
    case "task_done": {
      const payload = a.payload as { title?: string };
      return payload?.title
        ? `Tarefa concluída: ${payload.title}`
        : "Tarefa concluída";
    }
    default:
      return a.type.replace(/_/g, " ");
  }
}
