"use client";

import {
  HardHat,
  Mail,
  Phone,
  Plus,
  Search,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AddTeamMemberDialog } from "@/components/team/add-team-member-dialog";
import { EditTeamMemberDialog } from "@/components/team/edit-team-member-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPhone } from "@/lib/format";
import { TEAM_ROLE_LABEL } from "@/lib/labels";
import type { TeamMember, TeamRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  members: TeamMember[];
};

type Filter = "active" | "inactive" | "all";

const ROLE_ACCENT: Record<TeamRole, string> = {
  helper: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  skilled: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  foreman: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  subcontractor: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  other: "bg-stone-500/15 text-stone-300 border-stone-400/30",
};

export function TeamList({ members }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "active" && !m.active) return false;
      if (filter === "inactive" && m.active) return false;
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, filter, query]);

  const activeCount = members.filter((m) => m.active).length;
  const inactiveCount = members.length - activeCount;
  const avgRate =
    activeCount > 0
      ? members
          .filter((m) => m.active)
          .reduce((sum, m) => sum + Number(m.hourly_rate), 0) / activeCount
      : 0;

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-5 px-4 md:px-6">
      {/* Header */}
      <header className="flex flex-col gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
              Funcionários
            </h1>
            <p className="text-xs text-jcn-ice/55">
              Cadastro global. Use no registro de horas dos jobs.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="h-10 font-semibold"
        >
          <Plus className="h-4 w-4" />
          Adicionar funcionário
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Ativos" value={`${activeCount}`} accent="green" />
        <Kpi
          label="Taxa média"
          value={
            activeCount > 0
              ? `${formatCurrency(avgRate)}/h`
              : "Sem dados"
          }
          accent="gold"
        />
        <Kpi label="Inativos" value={`${inactiveCount}`} accent="neutral" />
      </div>

      {/* Filtros + busca */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <FilterChip
            active={filter === "active"}
            onClick={() => setFilter("active")}
            label="Ativos"
          />
          <FilterChip
            active={filter === "inactive"}
            onClick={() => setFilter("inactive")}
            label="Inativos"
          />
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="Todos"
          />
        </div>
        <div className="relative flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jcn-ice/45" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-10 pr-3 text-sm text-jcn-ice outline-none placeholder:text-jcn-ice/35 focus:border-jcn-gold-400/40"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          filtered.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              onClick={() => setEditTarget(m)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddTeamMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />
      {editTarget && (
        <EditTeamMemberDialog
          member={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
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
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.08] bg-white/[0.025] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      {label}
    </button>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "gold" | "green" | "neutral";
}) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    neutral: "border-white/[0.08] bg-white/[0.03] text-jcn-ice",
  }[accent];

  return (
    <div
      className={cn("rounded-2xl border p-3 backdrop-blur-xl", accentClass)}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
        {label}
      </div>
      <div className="mt-1.5 text-lg font-black tracking-tight">{value}</div>
    </div>
  );
}

function MemberRow({
  member,
  onClick,
}: {
  member: TeamMember;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-2xl border bg-white/[0.025] p-4 text-left transition hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between",
        member.active
          ? "border-white/[0.06]"
          : "border-white/[0.04] opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            member.active
              ? "bg-jcn-gold-500/15 text-jcn-gold-300"
              : "bg-white/[0.05] text-jcn-ice/45",
          )}
        >
          {member.active ? (
            <HardHat className="h-5 w-5" />
          ) : (
            <UserMinus className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-jcn-ice">
              {member.name}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                ROLE_ACCENT[member.role],
              )}
            >
              {TEAM_ROLE_LABEL[member.role]}
            </Badge>
            {member.active ? (
              <Badge
                variant="outline"
                className="border-emerald-400/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-300"
              >
                <UserCheck className="mr-1 h-3 w-3" />
                Ativo
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/55"
              >
                Inativo
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
            {member.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatPhone(member.phone)}
              </span>
            )}
            {member.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {member.email}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-lg font-black text-jcn-gold-300">
          {formatCurrency(Number(member.hourly_rate))}
          <span className="ml-0.5 text-xs font-semibold text-jcn-ice/55">
            /h
          </span>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
      <Users className="mx-auto h-10 w-10 text-jcn-ice/30" />
      <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
        Nenhum funcionário aqui ainda
      </p>
      <p className="mt-1 text-xs text-jcn-ice/40">
        Cadastre helpers, técnicos e foremen pra começar a trackear horas nos jobs.
      </p>
      <Button onClick={onAdd} variant="outline" className="mt-5">
        <Plus className="h-4 w-4" />
        Adicionar primeiro
      </Button>
    </div>
  );
}
