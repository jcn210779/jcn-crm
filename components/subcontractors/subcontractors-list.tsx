"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Mail,
  Phone,
  Plus,
  Search,
  Star,
  UserCheck,
  UserMinus,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AddSubDialog } from "@/components/subcontractors/add-sub-dialog";
import { EditSubDialog } from "@/components/subcontractors/edit-sub-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPhone } from "@/lib/format";
import { SUBCONTRACTOR_SPECIALTY_LABEL } from "@/lib/labels";
import {
  SUBCONTRACTOR_SPECIALTIES,
  type Subcontractor,
  type SubcontractorSpecialty,
  type SubcontractorStats,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  subs: Subcontractor[];
  stats: SubcontractorStats[];
};

type Filter = "active" | "inactive" | "all";

const SPECIALTY_ACCENT: Record<SubcontractorSpecialty, string> = {
  electrical: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  plumbing: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  painting: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  roofing: "bg-stone-500/15 text-stone-300 border-stone-400/30",
  concrete: "bg-zinc-500/15 text-zinc-300 border-zinc-400/30",
  framing: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  hvac: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  landscaping: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  flooring: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  masonry: "bg-jcn-gold-500/15 text-jcn-gold-300 border-jcn-gold-400/30",
  other: "bg-white/[0.05] text-jcn-ice/70 border-white/[0.1]",
};

export function SubcontractorsList({ subs, stats }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subcontractor | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [specialty, setSpecialty] = useState<"all" | SubcontractorSpecialty>(
    "all",
  );
  const [query, setQuery] = useState("");

  const statsById = useMemo(() => {
    const map = new Map<string, SubcontractorStats>();
    for (const s of stats) map.set(s.subcontractor_id, s);
    return map;
  }, [stats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((s) => {
      if (filter === "active" && !s.active) return false;
      if (filter === "inactive" && s.active) return false;
      if (specialty !== "all" && s.specialty !== specialty) return false;
      if (q) {
        const haystack = `${s.name} ${s.company_name ?? ""} ${
          s.specialty_detail ?? ""
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [subs, filter, specialty, query]);

  const activeCount = subs.filter((s) => s.active).length;
  const preferredCount = subs.filter((s) => s.active && s.preferred).length;
  const totalPaidEver = stats.reduce(
    (sum, s) => sum + Number(s.total_value_paid),
    0,
  );

  // Alertas: licença/seguro vencendo em ≤30 dias ou já vencido (entre ativos)
  const today = new Date();
  const expiringCount = subs.filter((s) => {
    if (!s.active) return false;
    const dates = [s.license_expires_at, s.insurance_expires_at].filter(
      (d): d is string => d !== null,
    );
    return dates.some((d) => {
      const days =
        (new Date(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    });
  }).length;

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-5 px-4 md:px-6">
      {/* Header */}
      <header className="flex flex-col gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jcn-gold-500/15 text-jcn-gold-300">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
              Subempreiteiros
            </h1>
            <p className="text-xs text-jcn-ice/55">
              Eletricista, encanador, pintor e outros fornecedores externos.
              Cadastro global. Use no detalhe de cada job pra contratar.
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="h-10 font-semibold">
          <Plus className="h-4 w-4" />
          Adicionar subempreiteiro
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ativos" value={`${activeCount}`} accent="green" />
        <Kpi
          label="Preferidos"
          value={`${preferredCount}`}
          accent={preferredCount > 0 ? "gold" : "neutral"}
          icon={Star}
        />
        <Kpi
          label="Pago histórico"
          value={formatCurrency(totalPaidEver)}
          accent={totalPaidEver > 0 ? "gold" : "neutral"}
        />
        <Kpi
          label="Documentos a vencer"
          value={`${expiringCount}`}
          accent={expiringCount > 0 ? "red" : "neutral"}
          icon={expiringCount > 0 ? AlertTriangle : undefined}
        />
      </div>

      {/* Filtros + busca */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              placeholder="Buscar por nome ou empresa"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-10 pr-3 text-sm text-jcn-ice outline-none placeholder:text-jcn-ice/35 focus:border-jcn-gold-400/40"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SpecialtyChip
            active={specialty === "all"}
            onClick={() => setSpecialty("all")}
            label="Todas especialidades"
          />
          {SUBCONTRACTOR_SPECIALTIES.map((sp) => (
            <SpecialtyChip
              key={sp}
              active={specialty === sp}
              onClick={() => setSpecialty(sp)}
              label={SUBCONTRACTOR_SPECIALTY_LABEL[sp]}
            />
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          filtered.map((s) => (
            <SubRow
              key={s.id}
              sub={s}
              stats={statsById.get(s.id) ?? null}
              onClick={() => setEditTarget(s)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <AddSubDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />
      {editTarget && (
        <EditSubDialog
          sub={editTarget}
          stats={statsById.get(editTarget.id) ?? null}
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

function SpecialtyChip({
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
        "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/15 text-jcn-gold-200"
          : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
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
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: "gold" | "green" | "red" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const accentClass = {
    gold: "border-jcn-gold-400/30 bg-jcn-gold-500/10 text-jcn-gold-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    red: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    neutral: "border-white/[0.08] bg-white/[0.03] text-jcn-ice",
  }[accent];

  return (
    <div
      className={cn("rounded-2xl border p-3 backdrop-blur-xl", accentClass)}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="mt-1.5 text-lg font-black tracking-tight">{value}</div>
    </div>
  );
}

function SubRow({
  sub,
  stats,
  onClick,
}: {
  sub: Subcontractor;
  stats: SubcontractorStats | null;
  onClick: () => void;
}) {
  const today = new Date();
  const isExpiring = (d: string | null) => {
    if (!d) return false;
    const days =
      (new Date(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  };
  const licenseAlert = isExpiring(sub.license_expires_at);
  const insuranceAlert = isExpiring(sub.insurance_expires_at);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-2xl border bg-white/[0.025] p-4 text-left transition hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between",
        sub.active
          ? "border-white/[0.06]"
          : "border-white/[0.04] opacity-60",
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            sub.active
              ? "bg-jcn-gold-500/15 text-jcn-gold-300"
              : "bg-white/[0.05] text-jcn-ice/45",
          )}
        >
          {sub.active ? (
            <Wrench className="h-5 w-5" />
          ) : (
            <UserMinus className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {sub.preferred && (
              <Star
                className="h-4 w-4 fill-jcn-gold-300 text-jcn-gold-300"
                aria-label="Preferido"
              />
            )}
            <span className="text-base font-bold text-jcn-ice">
              {sub.name}
            </span>
            {sub.company_name && (
              <span className="text-xs text-jcn-ice/55">
                · {sub.company_name}
              </span>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                SPECIALTY_ACCENT[sub.specialty],
              )}
            >
              {SUBCONTRACTOR_SPECIALTY_LABEL[sub.specialty]}
            </Badge>
            {sub.active ? (
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
            {(licenseAlert || insuranceAlert) && (
              <Badge
                variant="outline"
                className="border-rose-400/30 bg-rose-500/10 text-[10px] font-semibold text-rose-300"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                {licenseAlert && insuranceAlert
                  ? "Licença e seguro"
                  : licenseAlert
                    ? "Licença"
                    : "Seguro"}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jcn-ice/55">
            {sub.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatPhone(sub.phone)}
              </span>
            )}
            {sub.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {sub.email}
              </span>
            )}
            {sub.specialty_detail && (
              <span className="italic opacity-80">{sub.specialty_detail}</span>
            )}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        {stats && stats.total_jobs > 0 ? (
          <>
            <div className="text-base font-black text-jcn-gold-300">
              {formatCurrency(Number(stats.total_value_paid))}
            </div>
            <div className="mt-0.5 text-[11px] text-jcn-ice/55">
              {stats.completed_jobs} de {stats.total_jobs} jobs
              {stats.last_hired_at && (
                <>
                  {" · último em "}
                  {format(new Date(stats.last_hired_at), "d 'de' MMM", {
                    locale: ptBR,
                  })}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs italic text-jcn-ice/40">
            Nenhum job ainda
          </div>
        )}
      </div>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
      <Wrench className="mx-auto h-10 w-10 text-jcn-ice/30" />
      <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
        Nenhum subempreiteiro aqui ainda
      </p>
      <p className="mt-1 text-xs text-jcn-ice/40">
        Cadastre eletricista, encanador, pintor e outros pra contratar em
        qualquer job.
      </p>
      <Button onClick={onAdd} variant="outline" className="mt-5">
        <Plus className="h-4 w-4" />
        Adicionar primeiro
      </Button>
    </div>
  );
}
