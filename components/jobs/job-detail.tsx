"use client";

import { format, formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { JobExpensesSection } from "@/components/jobs/expenses/job-expenses-section";
import { JobHoursSection } from "@/components/jobs/hours/job-hours-section";
import { JobPaymentsSection } from "@/components/jobs/payments/job-payments-section";
import { JobPhotosSection } from "@/components/jobs/photos/job-photos-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatPhone } from "@/lib/format";
import type { JobHoursWithMember, TeamMemberLite } from "@/lib/job-hours";
import { JOB_PHASE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  JOB_PHASES,
  type Job,
  type JobExpense,
  type JobPayment,
  type JobPhase,
  type JobPhaseHistoryRow,
  type JobPhoto,
  type JobUpdate,
  type Lead,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  job: Job;
  lead: Lead | null;
  history: JobPhaseHistoryRow[];
  payments: JobPayment[];
  photos: JobPhoto[];
  photoSignedUrls: Record<string, string | null>;
  expenses: JobExpense[];
  receiptSignedUrls: Record<string, string | null>;
  hours: JobHoursWithMember[];
  activeMembers: TeamMemberLite[];
  userEmail: string;
};

const PHASE_BADGE_TONE: Record<JobPhase, string> = {
  planning: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  permit_released: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  materials_ordered: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  materials_delivered: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  work_in_progress: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
};

export function JobDetail({
  job,
  lead,
  history,
  payments,
  photos,
  photoSignedUrls,
  expenses,
  receiptSignedUrls,
  hours,
  activeMembers,
  userEmail,
}: Props) {
  const router = useRouter();
  const totalLaborCost = hours.reduce(
    (sum, h) => sum + Number(h.calculated_amount),
    0,
  );

  const [notes, setNotes] = useState<string>(job.notes ?? "");
  const [expectedStart, setExpectedStart] = useState<string>(
    job.expected_start ?? "",
  );
  const [expectedEnd, setExpectedEnd] = useState<string>(job.expected_end ?? "");
  const [actualStart, setActualStart] = useState<string>(job.actual_start ?? "");
  const [actualEnd, setActualEnd] = useState<string>(job.actual_end ?? "");

  async function updatePhase(newPhase: JobPhase) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("jobs")
      .update({ current_phase: newPhase })
      .eq("id", job.id);
    if (error) {
      toast.error("Erro ao atualizar fase", { description: error.message });
      return;
    }
    toast.success(`Fase: ${JOB_PHASE_LABEL[newPhase]}`);
    router.refresh();
  }

  async function saveNotes() {
    if (notes === (job.notes ?? "")) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("jobs")
      .update({ notes: notes || null })
      .eq("id", job.id);
    if (error) {
      toast.error("Erro ao salvar nota", { description: error.message });
      return;
    }
    toast.success("Nota salva");
    router.refresh();
  }

  async function saveDate(
    field: "expected_start" | "expected_end" | "actual_start" | "actual_end",
    value: string,
  ) {
    const current = (job[field] ?? "") as string;
    if (value === current) return;
    const supabase = createSupabaseBrowserClient();
    const patch: JobUpdate = { [field]: value || null };
    const { error } = await supabase
      .from("jobs")
      .update(patch)
      .eq("id", job.id);
    if (error) {
      toast.error("Erro ao salvar data", { description: error.message });
      return;
    }
    toast.success("Data atualizada");
    router.refresh();
  }

  const clientName = lead?.name ?? "Cliente sem nome";

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-5 px-4 md:px-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Jobs
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black tracking-[-0.02em] text-white md:text-4xl">
            {clientName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/55">
            <Badge
              variant="outline"
              className={cn("font-bold", PHASE_BADGE_TONE[job.current_phase])}
            >
              {JOB_PHASE_LABEL[job.current_phase]}
            </Badge>
            <span>·</span>
            <span>
              Contrato{" "}
              {formatDistanceToNow(new Date(job.contract_signed_at), {
                locale: ptBR,
                addSuffix: true,
              })}
            </span>
            {job.value > 0 && (
              <>
                <span>·</span>
                <span className="font-bold text-primary">
                  {formatCurrency(job.value)}
                </span>
              </>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 border-white/[0.1] bg-white/[0.04]">
              Mover fase
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {JOB_PHASES.map((p) => (
              <DropdownMenuItem
                key={p}
                disabled={p === job.current_phase}
                onSelect={() => updatePhase(p)}
              >
                {JOB_PHASE_LABEL[p]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Cliente */}
        <SectionCard title="Cliente">
          {lead ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <p className="text-base font-bold text-white">{lead.name}</p>
              </div>
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
              <Link
                href={`/lead/${lead.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/65 transition hover:border-primary/40 hover:text-primary"
              >
                <ExternalLink className="h-3 w-3" />
                Ver lead original
              </Link>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-white/35">
              Lead vinculado não encontrado
            </p>
          )}
        </SectionCard>

        {/* Contrato + Cronograma */}
        <SectionCard title="Contrato e cronograma">
          <dl className="grid gap-3 text-sm">
            <Row label="Valor">
              <span className="font-bold text-primary">
                {formatCurrency(job.value)}
              </span>
            </Row>
            <Row label="Contrato assinado">
              {format(new Date(job.contract_signed_at), "dd 'de' MMM 'de' yyyy", {
                locale: ptBR,
              })}
            </Row>
          </dl>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DateField
              label="Início previsto"
              value={expectedStart}
              onChange={setExpectedStart}
              onBlur={() => saveDate("expected_start", expectedStart)}
            />
            <DateField
              label="Fim previsto"
              value={expectedEnd}
              onChange={setExpectedEnd}
              onBlur={() => saveDate("expected_end", expectedEnd)}
            />
            <DateField
              label="Início real"
              value={actualStart}
              onChange={setActualStart}
              onBlur={() => saveDate("actual_start", actualStart)}
            />
            <DateField
              label="Fim real"
              value={actualEnd}
              onChange={setActualEnd}
              onBlur={() => saveDate("actual_end", actualEnd)}
            />
          </div>
        </SectionCard>
      </div>

      {/* Pagamentos */}
      <JobPaymentsSection
        jobId={job.id}
        contractValue={job.value}
        payments={payments}
      />

      {/* Despesas e recibos */}
      <JobExpensesSection
        job={job}
        expenses={expenses}
        receiptUrls={receiptSignedUrls}
        totalLaborCost={totalLaborCost}
      />

      {/* Horas trabalhadas */}
      <JobHoursSection
        jobId={job.id}
        hours={hours}
        activeMembers={activeMembers}
      />

      {/* Fotos da obra */}
      <JobPhotosSection
        jobId={job.id}
        userEmail={userEmail}
        photos={photos}
        initialSignedUrls={photoSignedUrls}
      />

      {/* Histórico de fases */}
      <SectionCard title="Histórico de fases">
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/35">
            Nenhuma transição registrada ainda
          </p>
        ) : (
          <ol className="space-y-2">
            {history.map((h) => {
              const ended = h.ended_at ? new Date(h.ended_at) : null;
              const started = new Date(h.started_at);
              const duration = ended
                ? formatDistanceStrict(started, ended, { locale: ptBR })
                : `em curso · ${formatDistanceStrict(started, new Date(), {
                    locale: ptBR,
                  })}`;
              return (
                <li
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-sm"
                >
                  <Clock className="h-4 w-4 text-white/40" />
                  <div className="flex-1">
                    <span className="font-semibold text-white">
                      {JOB_PHASE_LABEL[h.phase]}
                    </span>
                    <span className="ml-2 text-[11px] text-white/40">
                      {duration}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-white/35">
                    {format(started, "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>

      {/* Notas */}
      <SectionCard title="Notas da obra">
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Detalhes da obra, material, equipe, observações. Salva automaticamente."
          className="resize-none border-white/[0.08] bg-white/[0.025] text-sm"
        />
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
          Salva ao sair do campo
        </p>
      </SectionCard>
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
    <div className="flex items-center justify-between gap-4">
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

function DateField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="mt-1.5 h-10 border-white/[0.08] bg-white/[0.025] text-sm"
      />
    </div>
  );
}
