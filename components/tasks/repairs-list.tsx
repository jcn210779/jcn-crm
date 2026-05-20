"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Hammer,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AddRepairDialog } from "@/components/tasks/add-repair-dialog";
import { EditRepairDialog } from "@/components/tasks/edit-repair-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Repair, RepairStatus, RepairType } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RepairStatus, string> = {
  open: "Aberto",
  scheduled: "Agendado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_ACCENT: Record<RepairStatus, string> = {
  open: "border-amber-400/40 bg-amber-500/15 text-amber-300",
  scheduled: "border-sky-400/40 bg-sky-500/15 text-sky-300",
  in_progress: "border-jcn-gold-400/40 bg-jcn-gold-500/15 text-jcn-gold-300",
  completed: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  cancelled: "border-white/[0.1] bg-white/[0.04] text-jcn-ice/55",
};

const TYPE_LABEL: Record<RepairType, string> = {
  warranty: "Garantia",
  paid: "Pago",
};

type Filter = RepairStatus | "all" | "active";

type Props = {
  repairs: Repair[];
};

export function RepairsList({ repairs }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("active");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Repair | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return repairs;
    if (filter === "active") {
      return repairs.filter(
        (r) => r.status !== "completed" && r.status !== "cancelled",
      );
    }
    return repairs.filter((r) => r.status === filter);
  }, [repairs, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: repairs.length,
      active: 0,
      open: 0,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const r of repairs) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (r.status !== "completed" && r.status !== "cancelled") {
        c.active = (c.active ?? 0) + 1;
      }
    }
    return c;
  }, [repairs]);

  const warrantyCount = repairs.filter((r) => r.type === "warranty").length;
  const paidCount = repairs.filter((r) => r.type === "paid").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
                Reparos
              </div>
              <div className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
                {counts.active ?? 0}
                <span className="text-base font-semibold text-jcn-ice/55"> abertos</span>
              </div>
              <div className="mt-0.5 text-xs text-jcn-ice/55">
                {warrantyCount} garantia · {paidCount} pagos · {repairs.length} total
              </div>
            </div>
          </div>
          <Button onClick={() => setAddOpen(true)} className="h-10 font-semibold">
            <Plus className="h-4 w-4" />
            Novo reparo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <FilterChip
          active={filter === "active"}
          onClick={() => setFilter("active")}
          icon={Wrench}
          label="Ativos"
          count={counts.active ?? 0}
        />
        <FilterChip
          active={filter === "open"}
          onClick={() => setFilter("open")}
          icon={Clock}
          label="Aberto"
          count={counts.open ?? 0}
        />
        <FilterChip
          active={filter === "scheduled"}
          onClick={() => setFilter("scheduled")}
          icon={Calendar}
          label="Agendado"
          count={counts.scheduled ?? 0}
        />
        <FilterChip
          active={filter === "in_progress"}
          onClick={() => setFilter("in_progress")}
          icon={Hammer}
          label="Em andamento"
          count={counts.in_progress ?? 0}
        />
        <FilterChip
          active={filter === "completed"}
          onClick={() => setFilter("completed")}
          icon={CheckCircle2}
          label="Concluído"
          count={counts.completed ?? 0}
        />
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          icon={Wrench}
          label="Tudo"
          count={counts.all ?? 0}
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
          <Wrench className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            Nenhum reparo {filter === "active" ? "ativo" : ""}
          </p>
          <p className="mt-1 text-xs text-jcn-ice/40">
            Cliente liga pedindo reparo? Registra aqui pra não esquecer.
          </p>
          <Button
            onClick={() => setAddOpen(true)}
            variant="outline"
            className="mt-5"
          >
            <Plus className="h-4 w-4" />
            Adicionar primeiro
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <RepairCard
              key={r.id}
              repair={r}
              onClick={() => setEditTarget(r)}
            />
          ))}
        </div>
      )}

      <AddRepairDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />
      {editTarget && (
        <EditRepairDialog
          open={!!editTarget}
          onOpenChange={(o) => {
            if (!o) setEditTarget(null);
          }}
          repair={editTarget}
          onDone={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      <span className="rounded-full bg-white/[0.08] px-1.5 py-0 text-[10px] font-bold normal-case">
        {count}
      </span>
    </button>
  );
}

function RepairCard({
  repair,
  onClick,
}: {
  repair: Repair;
  onClick: () => void;
}) {
  const isWarranty = repair.type === "warranty";
  const scheduledDate = repair.scheduled_for
    ? new Date(repair.scheduled_for)
    : null;
  const isLate =
    scheduledDate &&
    scheduledDate < new Date() &&
    (repair.status === "scheduled" || repair.status === "open");

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-left transition hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isWarranty
              ? "bg-violet-500/15 text-violet-300"
              : "bg-jcn-gold-500/15 text-jcn-gold-300",
          )}
        >
          {isWarranty ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <DollarSign className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-jcn-ice">
              {repair.customer_name}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                STATUS_ACCENT[repair.status],
              )}
            >
              {STATUS_LABEL[repair.status]}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                isWarranty
                  ? "border-violet-400/40 bg-violet-500/15 text-violet-300"
                  : "border-jcn-gold-400/40 bg-jcn-gold-500/15 text-jcn-gold-300",
              )}
            >
              {TYPE_LABEL[repair.type]}
            </Badge>
            {isLate && (
              <Badge
                variant="outline"
                className="border-rose-400/40 bg-rose-500/15 text-[10px] font-semibold text-rose-300"
              >
                ⚠️ Atrasado
              </Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-jcn-ice/75 line-clamp-2">
            {repair.description}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-jcn-ice/45">
            {repair.customer_phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {repair.customer_phone}
              </span>
            )}
            {repair.customer_address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {repair.customer_address}
              </span>
            )}
            {scheduledDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(scheduledDate, "d MMM, HH:mm", { locale: ptBR })}
              </span>
            )}
            {!scheduledDate && (
              <span>
                Criado{" "}
                {formatDistanceToNow(new Date(repair.created_at), {
                  locale: ptBR,
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {repair.type === "paid" && (
        <div className="text-right">
          {repair.status === "completed" && repair.value_charged ? (
            <div className="text-base font-black text-emerald-300">
              {formatCurrency(Number(repair.value_charged))}
            </div>
          ) : repair.value_estimated ? (
            <div>
              <div className="text-xs text-jcn-ice/55">est.</div>
              <div className="text-base font-black text-jcn-gold-300">
                {formatCurrency(Number(repair.value_estimated))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </button>
  );
}
