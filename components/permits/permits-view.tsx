"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  Phone,
  Search,
  Star,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { SERVICE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  Permit,
  PermitSummaryRow,
  ServiceType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  permits: Permit[];
  summary: PermitSummaryRow[];
};

type ReviewFilter = "all" | "unreviewed" | "interesting" | "discarded";
type ServiceFilter = ServiceType | "all";

export function PermitsView({ permits, summary }: Props) {
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("unreviewed");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [minValue, setMinValue] = useState("");
  const [list, setList] = useState<Permit[]>(permits);

  const cities = useMemo(() => {
    const set = new Set(list.map((p) => p.source_city));
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minValue ? Number(minValue.replace(/[^0-9.]/g, "")) : 0;
    return list.filter((p) => {
      if (reviewFilter === "unreviewed" && p.reviewed) return false;
      if (reviewFilter === "interesting" && p.interesting !== true) return false;
      if (reviewFilter === "discarded" && p.interesting !== false) return false;
      if (serviceFilter !== "all" && p.service_type !== serviceFilter) return false;
      if (cityFilter !== "all" && p.source_city !== cityFilter) return false;
      if (min > 0 && (p.estimated_value ?? 0) < min) return false;
      if (q) {
        const haystack = [
          p.address,
          p.city,
          p.owner_name,
          p.permit_number,
          p.contractor_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [list, query, reviewFilter, serviceFilter, cityFilter, minValue]);

  const counts = useMemo(() => {
    return {
      all: list.length,
      unreviewed: list.filter((p) => !p.reviewed).length,
      interesting: list.filter((p) => p.interesting === true).length,
      discarded: list.filter((p) => p.interesting === false).length,
    };
  }, [list]);

  async function setInteresting(
    permitId: string,
    value: boolean | null,
  ) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("permits")
      .update({
        interesting: value,
        reviewed: value !== null,
        reviewed_at: value !== null ? new Date().toISOString() : null,
      })
      .eq("id", permitId);

    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }

    setList((prev) =>
      prev.map((p) =>
        p.id === permitId
          ? {
              ...p,
              interesting: value,
              reviewed: value !== null,
              reviewed_at:
                value !== null ? new Date().toISOString() : null,
            }
          : p,
      ),
    );
    toast.success(
      value === true
        ? "Marcado como interessante ⭐"
        : value === false
          ? "Descartado"
          : "Voltou pra fila",
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-7xl space-y-5 px-4 md:px-6">
      {/* Header */}
      <header className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jcn-gold-500/15 text-jcn-gold-300">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
                Permits
              </h1>
              <p className="text-xs text-jcn-ice/55">
                Catálogo de oportunidades scraped. Avalia, marca estrela
                e cria lead manual se quiser atacar.
              </p>
            </div>
          </div>
        </div>

        {/* Summary por cidade */}
        {summary.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {summary.map((s) => (
              <div
                key={s.source_city}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
                  {s.source_city}
                </div>
                <div className="mt-1 text-lg font-black text-jcn-ice">
                  {s.total}
                </div>
                <div className="mt-0.5 text-[10px] text-jcn-ice/55">
                  {s.unreviewed} novos · {s.interesting_count} ⭐ ·{" "}
                  {s.converted_count} viraram lead
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Filtros */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
        {/* Status review */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/45">
            <Filter className="h-3 w-3" />
            Status
          </div>
          <FilterChip
            active={reviewFilter === "unreviewed"}
            onClick={() => setReviewFilter("unreviewed")}
            label="Pra revisar"
            count={counts.unreviewed}
          />
          <FilterChip
            active={reviewFilter === "interesting"}
            onClick={() => setReviewFilter("interesting")}
            label="⭐ Interessantes"
            count={counts.interesting}
          />
          <FilterChip
            active={reviewFilter === "discarded"}
            onClick={() => setReviewFilter("discarded")}
            label="Descartados"
            count={counts.discarded}
          />
          <FilterChip
            active={reviewFilter === "all"}
            onClick={() => setReviewFilter("all")}
            label="Tudo"
            count={counts.all}
          />
        </div>

        {/* Outros filtros */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jcn-ice/45" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar endereço, owner, contractor..."
              className="h-9 pl-10"
            />
          </div>
          <select
            value={serviceFilter}
            onChange={(e) =>
              setServiceFilter(e.target.value as ServiceFilter)
            }
            className="h-9 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-jcn-ice outline-none focus:border-jcn-gold-400/40"
          >
            <option value="all">Todos serviços</option>
            <option value="deck">{SERVICE_LABEL.deck}</option>
            <option value="siding">{SERVICE_LABEL.siding}</option>
            <option value="patio">{SERVICE_LABEL.patio}</option>
            <option value="multiple">{SERVICE_LABEL.multiple}</option>
            <option value="other">{SERVICE_LABEL.other}</option>
          </select>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-9 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-jcn-ice outline-none focus:border-jcn-gold-400/40"
          >
            <option value="all">Todas cidades</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-jcn-ice/45">
              ≥
            </span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="valor min"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="h-9 w-32 pl-7"
            />
          </div>
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            {list.length === 0
              ? "Nenhum permit no banco ainda"
              : "Nenhum permit nesse filtro"}
          </p>
          {list.length === 0 && (
            <p className="mt-1 text-xs text-jcn-ice/40">
              Quando o scraper Python rodar, os permits aparecem aqui.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PermitCard
              key={p.id}
              permit={p}
              onMarkInteresting={() => setInteresting(p.id, true)}
              onDiscard={() => setInteresting(p.id, false)}
              onResetReview={() => setInteresting(p.id, null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
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
      {label}
      <span className="rounded-full bg-white/[0.08] px-1.5 py-0 text-[10px] font-bold normal-case">
        {count}
      </span>
    </button>
  );
}

function PermitCard({
  permit,
  onMarkInteresting,
  onDiscard,
  onResetReview,
}: {
  permit: Permit;
  onMarkInteresting: () => void;
  onDiscard: () => void;
  onResetReview: () => void;
}) {
  const isInteresting = permit.interesting === true;
  const isDiscarded = permit.interesting === false;

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 backdrop-blur-xl",
        isInteresting
          ? "border-jcn-gold-400/30 bg-jcn-gold-500/[0.06]"
          : isDiscarded
            ? "border-white/[0.04] bg-white/[0.015] opacity-65"
            : "border-white/[0.06] bg-white/[0.025]",
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-jcn-ice">
              {permit.address}
            </span>
            <Badge
              variant="outline"
              className="border-jcn-gold-400/30 bg-jcn-gold-500/10 text-[10px] font-semibold text-jcn-gold-300"
            >
              {SERVICE_LABEL[permit.service_type]}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/[0.1] bg-white/[0.04] text-[10px] font-semibold text-jcn-ice/65"
            >
              {permit.source_city}
            </Badge>
            {permit.estimated_value && (
              <Badge
                variant="outline"
                className="border-emerald-400/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-300"
              >
                {formatCurrency(Number(permit.estimated_value))}
              </Badge>
            )}
            {isInteresting && (
              <Badge
                variant="outline"
                className="border-jcn-gold-400/50 bg-jcn-gold-500/20 text-[10px] font-bold text-jcn-gold-300"
              >
                <Star className="mr-1 h-3 w-3 fill-current" />
                Interessante
              </Badge>
            )}
            {isDiscarded && (
              <Badge
                variant="outline"
                className="border-rose-400/30 bg-rose-500/10 text-[10px] font-semibold text-rose-300"
              >
                Descartado
              </Badge>
            )}
          </div>

          {permit.service_description && (
            <p className="mt-1.5 text-xs text-jcn-ice/75 line-clamp-2">
              {permit.service_description}
            </p>
          )}

          <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-jcn-ice/55 md:grid-cols-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {permit.city}, {permit.state}
              {permit.zip && ` ${permit.zip}`}
            </div>
            {permit.issued_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Emitido{" "}
                {format(new Date(permit.issued_at), "d MMM yyyy", {
                  locale: ptBR,
                })}{" "}
                (
                {formatDistanceToNow(new Date(permit.issued_at), {
                  locale: ptBR,
                  addSuffix: true,
                })}
                )
              </div>
            )}
            {permit.owner_name && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                {permit.owner_name}
              </div>
            )}
            {permit.owner_phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                <a
                  href={`tel:${permit.owner_phone}`}
                  className="hover:text-jcn-gold-300"
                >
                  {permit.owner_phone}
                </a>
              </div>
            )}
            {permit.owner_email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                <a
                  href={`mailto:${permit.owner_email}`}
                  className="truncate hover:text-jcn-gold-300"
                >
                  {permit.owner_email}
                </a>
              </div>
            )}
            {permit.contractor_name && (
              <div className="flex items-center gap-1.5 text-amber-300">
                <Wrench className="h-3 w-3" />
                GC: {permit.contractor_name}
              </div>
            )}
            {permit.permit_number && permit.source_url && (
              <a
                href={permit.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-jcn-gold-300 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {permit.permit_number}
              </a>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-row items-center gap-2 md:flex-col md:items-end">
          {!isInteresting && (
            <Button
              size="sm"
              variant="outline"
              onClick={onMarkInteresting}
              className="border-jcn-gold-400/40 bg-jcn-gold-500/15 text-jcn-gold-300 hover:bg-jcn-gold-500/25"
            >
              <Star className="h-3.5 w-3.5" />
              Interessante
            </Button>
          )}
          {!isDiscarded && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDiscard}
              className="text-jcn-ice/55 hover:text-rose-300"
            >
              <XCircle className="h-3.5 w-3.5" />
              Descartar
            </Button>
          )}
          {(isInteresting || isDiscarded) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onResetReview}
              className="text-xs text-jcn-ice/55 hover:text-jcn-ice"
            >
              Voltar pra fila
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
