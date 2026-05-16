"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddHoursDialog } from "@/components/jobs/hours/add-hours-dialog";
import { DeleteHoursDialog } from "@/components/jobs/hours/delete-hours-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { TEAM_ROLE_LABEL } from "@/lib/labels";
import type { JobHoursWithMember, TeamMemberLite } from "@/lib/job-hours";
import type { TeamRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string;
  hours: JobHoursWithMember[];
  activeMembers: TeamMemberLite[];
};

const ROLE_ACCENT: Record<TeamRole, string> = {
  helper: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  skilled: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  foreman: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  subcontractor: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  other: "bg-stone-500/15 text-stone-300 border-stone-400/30",
};

export function JobHoursSection({ jobId, hours, activeMembers }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobHoursWithMember | null>(
    null,
  );

  const stats = useMemo(() => {
    let totalHours = 0;
    let totalCost = 0;
    for (const h of hours) {
      totalHours += Number(h.hours);
      totalCost += Number(h.calculated_amount);
    }
    return {
      totalHours,
      totalCost,
      count: hours.length,
    };
  }, [hours]);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-jcn-ice">
              Horas trabalhadas
            </h3>
            <p className="text-xs text-jcn-ice/55">
              Registre quem trabalhou, quando, quantas horas. Mão de obra
              calculada na hora.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          disabled={activeMembers.length === 0}
          className="h-10 font-semibold"
        >
          <Plus className="h-4 w-4" />
          Registrar horas
        </Button>
      </div>

      {/* Total banner */}
      {stats.count > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-jcn-gold-300" />
            <span className="text-sm font-bold text-jcn-ice">
              {stats.totalHours.toFixed(2)}h em mão de obra
            </span>
          </div>
          <div className="text-lg font-black text-jcn-gold-300">
            = {formatCurrency(stats.totalCost)}
          </div>
        </div>
      )}

      {/* Lista de entradas */}
      <div className="space-y-2">
        {hours.length === 0 ? (
          <EmptyState
            hasActiveMembers={activeMembers.length > 0}
            onAdd={() => setAddOpen(true)}
          />
        ) : (
          hours.map((h) => (
            <HourRow
              key={h.id}
              entry={h}
              onDelete={() => setDeleteTarget(h)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddHoursDialog
        jobId={jobId}
        members={activeMembers}
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      {deleteTarget && (
        <DeleteHoursDialog
          entry={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onDeleted={() => {
            setDeleteTarget(null);
            toast.success("Registro excluído");
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function EmptyState({
  hasActiveMembers,
  onAdd,
}: {
  hasActiveMembers: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
      <Clock className="mx-auto h-8 w-8 text-jcn-ice/30" />
      <p className="mt-3 text-sm font-semibold text-jcn-ice/65">
        Sem horas registradas
      </p>
      {hasActiveMembers ? (
        <>
          <p className="mt-1 text-xs text-jcn-ice/40">
            Comece registrando quem trabalhou e quantas horas pra calcular
            mão de obra.
          </p>
          <Button onClick={onAdd} variant="outline" className="mt-4">
            <Plus className="h-4 w-4" />
            Registrar primeira entrada
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-jcn-ice/40">
            Cadastre funcionários em <strong>Team</strong> antes de
            registrar horas neste job.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/team">
              <Users className="h-4 w-4" />
              Ir pra Team
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}

function HourRow({
  entry,
  onDelete,
}: {
  entry: JobHoursWithMember;
  onDelete: () => void;
}) {
  const memberName = entry.member?.name ?? "Funcionário removido";
  const memberRole = entry.member?.role ?? "other";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold",
              ROLE_ACCENT[memberRole],
            )}
          >
            {TEAM_ROLE_LABEL[memberRole]}
          </Badge>
          <span className="text-sm font-bold text-jcn-ice">{memberName}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
          <span>
            {format(new Date(entry.work_date), "d 'de' MMM 'de' yyyy", {
              locale: ptBR,
            })}
          </span>
          <span>·</span>
          <span className="font-semibold text-jcn-ice/75">
            {Number(entry.hours).toFixed(2)}h × {formatCurrency(Number(entry.hourly_rate_snapshot))}/h
          </span>
          {entry.notes && (
            <span className="italic opacity-70">{entry.notes}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="text-right">
          <div className="text-base font-black text-jcn-gold-300">
            {formatCurrency(Number(entry.calculated_amount))}
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
