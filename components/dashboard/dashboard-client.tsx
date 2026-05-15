"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Plus,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EditSpendDialog } from "@/components/dashboard/edit-spend-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatPercent,
  formatROAS,
  formatUSD,
  monthLabelPT,
  roasLevel,
  type DashboardMetrics,
  type MonthKey,
  type RoasLevel,
} from "@/lib/dashboard-metrics";
import { SOURCE_LABEL } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { AdSpend, LeadSource } from "@/lib/types";

type Props = {
  metricsByMonth: DashboardMetrics[]; // [0] = mês mais recente
  currentSpends: AdSpend[];
};

export function DashboardClient({ metricsByMonth, currentSpends }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const months = useMemo(
    () => metricsByMonth.map((m) => m.month),
    [metricsByMonth],
  );
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(
    months[0] ?? new Date().toISOString().slice(0, 7),
  );
  const [editOpen, setEditOpen] = useState(false);

  const selected = useMemo(
    () =>
      metricsByMonth.find((m) => m.month === selectedMonth) ??
      metricsByMonth[0],
    [metricsByMonth, selectedMonth],
  );

  // Realtime: re-busca quando algo mudar em ad_spend, leads ou jobs.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("dashboard_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_spend" },
        () => startTransition(() => router.refresh()),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => startTransition(() => router.refresh()),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => startTransition(() => router.refresh()),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  if (!selected) {
    return (
      <div className="mx-auto mt-16 max-w-md px-6 text-center">
        <h2 className="text-xl font-bold text-white">Nenhum dado ainda</h2>
        <p className="mt-2 text-sm text-white/55">
          Cadastre o gasto mensal de Ads pra ver as métricas aparecerem aqui.
        </p>
      </div>
    );
  }

  const hasAnyData =
    selected.total.spend > 0 || selected.total.leads > 0;

  return (
    <div className="mx-auto mt-6 max-w-7xl px-4 md:px-6">
      {/* Header: título + seletor mês + botão editar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
            {monthLabelPT(selected.month)}
          </h1>
          <p className="mt-1 text-xs font-medium text-white/45">
            ROAS atribuído = revenue de jobs vindos de leads deste mês ÷ spend
            deste mês.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedMonth}
            onValueChange={(v) => setSelectedMonth(v as MonthKey)}
          >
            <SelectTrigger className="h-10 w-44 border-white/[0.08] bg-white/[0.04] text-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabelPT(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setEditOpen(true)}
            size="sm"
            className="h-10 font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Editar spend</span>
          </Button>
        </div>
      </div>

      {/* KPI cards do mês selecionado */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Gasto em Ads"
          value={formatUSD(selected.total.spend)}
          accent="amber"
        />
        <KpiCard
          icon={Users}
          label="Leads novos"
          value={String(selected.total.leads)}
          sub={
            selected.total.cac !== null
              ? `CAC ${formatUSD(selected.total.cac)}`
              : "sem spend"
          }
          accent="sky"
        />
        <KpiCard
          icon={Trophy}
          label="Leads ganho"
          value={String(selected.total.won)}
          sub={`Conv ${formatPercent(selected.total.conversionRate)}`}
          accent="emerald"
        />
        <KpiCard
          icon={TrendingUp}
          label="ROAS geral"
          value={formatROAS(selected.total.roas)}
          sub={formatUSD(selected.total.revenue) + " revenue"}
          accent={roasAccent(roasLevel(selected.total.roas))}
        />
      </section>

      {/* Tabela por fonte */}
      <section className="mt-8 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-white/55" />
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white/75">
              Por fonte
            </h2>
          </div>
          <span className="text-xs font-medium text-white/45">
            {selected.bySource.length} fonte
            {selected.bySource.length === 1 ? "" : "s"} com atividade
          </span>
        </header>

        {selected.bySource.length === 0 ? (
          <EmptySources onClick={() => setEditOpen(true)} hasData={hasAnyData} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
                  <th className="px-5 py-3">Fonte</th>
                  <th className="px-3 py-3 text-right">Gasto</th>
                  <th className="px-3 py-3 text-right">Leads</th>
                  <th className="px-3 py-3 text-right">CAC</th>
                  <th className="px-3 py-3 text-right">Conv.</th>
                  <th className="px-3 py-3 text-right">Ganhos</th>
                  <th className="px-3 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {selected.bySource.map((row, i) => {
                  const level = roasLevel(row.roas);
                  return (
                    <tr
                      key={row.source}
                      className={
                        (i % 2 === 1 ? "bg-white/[0.02] " : "") +
                        "border-t border-white/[0.04] transition-colors hover:bg-white/[0.04]"
                      }
                    >
                      <td className="px-5 py-3 font-semibold text-white">
                        {SOURCE_LABEL[row.source]}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-white/85">
                        {formatUSD(row.spend)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-white/85">
                        {row.leads}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-white/75">
                        {formatUSD(row.cac)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-white/75">
                        {formatPercent(row.conversionRate)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-white/85">
                        {row.won}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-white/85">
                        {formatUSD(row.revenue)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RoasPill level={level} value={row.roas} />
                      </td>
                    </tr>
                  );
                })}

                {/* Total */}
                <tr className="border-t border-white/[0.08] bg-white/[0.03] font-bold">
                  <td className="px-5 py-3 text-white">Total</td>
                  <td className="px-3 py-3 text-right font-mono text-white">
                    {formatUSD(selected.total.spend)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-white">
                    {selected.total.leads}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-white">
                    {formatUSD(selected.total.cac)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-white">
                    {formatPercent(selected.total.conversionRate)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-white">
                    {selected.total.won}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-white">
                    {formatUSD(selected.total.revenue)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RoasPill
                      level={roasLevel(selected.total.roas)}
                      value={selected.total.roas}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Histórico 12 meses */}
      <HistoryTable metricsByMonth={metricsByMonth} />

      {/* Dialog */}
      <EditSpendDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        month={selectedMonth}
        existingSpends={currentSpends}
      />
    </div>
  );
}

// ============================================================================
// Sub-componentes
// ============================================================================

type Accent = "amber" | "sky" | "emerald" | "rose" | "neutral";

function roasAccent(level: RoasLevel): Accent {
  if (level === "ok") return "emerald";
  if (level === "warn") return "amber";
  if (level === "danger") return "rose";
  return "neutral";
}

type KpiCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: Accent;
};

const ACCENT_GLOW: Record<Accent, string> = {
  amber: "shadow-[0_0_30px_-12px_rgba(250,204,21,0.45)]",
  sky: "shadow-[0_0_30px_-12px_rgba(56,189,248,0.4)]",
  emerald: "shadow-[0_0_30px_-12px_rgba(52,211,153,0.4)]",
  rose: "shadow-[0_0_30px_-12px_rgba(244,63,94,0.4)]",
  neutral: "",
};

const ACCENT_ICON_BG: Record<Accent, string> = {
  amber: "bg-amber-400/10 text-amber-300",
  sky: "bg-sky-400/10 text-sky-300",
  emerald: "bg-emerald-400/10 text-emerald-300",
  rose: "bg-rose-400/10 text-rose-300",
  neutral: "bg-white/[0.06] text-white/55",
};

function KpiCard({ icon: Icon, label, value, sub, accent }: KpiCardProps) {
  return (
    <div
      className={
        "group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.05] " +
        ACCENT_GLOW[accent]
      }
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
          {label}
        </span>
        <span
          className={
            "flex h-7 w-7 items-center justify-center rounded-lg " +
            ACCENT_ICON_BG[accent]
          }
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
        {value}
      </div>

      {sub && (
        <div className="mt-1 text-xs font-medium text-white/55">{sub}</div>
      )}
    </div>
  );
}

type RoasPillProps = {
  level: RoasLevel;
  value: number | null;
};

function RoasPill({ level, value }: RoasPillProps) {
  const palette: Record<RoasLevel, string> = {
    ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    danger: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    neutral: "border-white/[0.08] bg-white/[0.04] text-white/55",
  };
  const Icon = level === "danger" ? ArrowDownRight : ArrowUpRight;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs font-bold " +
        palette[level]
      }
    >
      {level !== "neutral" && <Icon className="h-3 w-3" />}
      {formatROAS(value)}
    </span>
  );
}

function EmptySources({
  onClick,
  hasData,
}: {
  onClick: () => void;
  hasData: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
        <Target className="h-5 w-5 text-white/55" />
      </div>
      <h3 className="text-base font-bold text-white">
        {hasData ? "Sem fonte com atividade" : "Mês ainda vazio"}
      </h3>
      <p className="max-w-sm text-sm text-white/55">
        {hasData
          ? "Houve dados mas nenhuma fonte teve spend nem leads atribuídos."
          : "Cadastre o gasto de Ads deste mês pra começar a medir CAC, conversão e ROAS por fonte."}
      </p>
      <Button onClick={onClick} className="mt-2 font-semibold">
        <Plus className="h-4 w-4" />
        Adicionar spend
      </Button>
    </div>
  );
}

// ============================================================================
// Histórico 12 meses — tabela mês × fonte
// ============================================================================

function HistoryTable({
  metricsByMonth,
}: {
  metricsByMonth: DashboardMetrics[];
}) {
  // Quais fontes apareceram em qualquer mês? (evita colunas vazias)
  const activeSources = useMemo(() => {
    const set = new Set<LeadSource>();
    for (const m of metricsByMonth) {
      for (const r of m.bySource) {
        if (r.spend > 0 || r.leads > 0) set.add(r.source);
      }
    }
    return Array.from(set);
  }, [metricsByMonth]);

  if (activeSources.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-white/55" />
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white/75">
            Histórico 12 meses · gasto por fonte
          </h2>
        </div>
        <span className="text-xs font-medium text-white/45">
          MVP: spend bruto. Em breve: gráfico interativo.
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
              <th className="px-5 py-3">Mês</th>
              {activeSources.map((s) => (
                <th key={s} className="px-3 py-3 text-right">
                  {SOURCE_LABEL[s]}
                </th>
              ))}
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {metricsByMonth.map((m, i) => {
              const cellBySource = new Map<LeadSource, number>(
                m.bySource.map((r) => [r.source, r.spend]),
              );
              return (
                <tr
                  key={m.month}
                  className={
                    (i % 2 === 1 ? "bg-white/[0.02] " : "") +
                    "border-t border-white/[0.04] transition-colors hover:bg-white/[0.04]"
                  }
                >
                  <td className="px-5 py-3 font-semibold text-white">
                    {monthLabelPT(m.month)}
                  </td>
                  {activeSources.map((s) => {
                    const v = cellBySource.get(s) ?? 0;
                    return (
                      <td
                        key={s}
                        className={
                          "px-3 py-3 text-right font-mono " +
                          (v > 0 ? "text-white/85" : "text-white/25")
                        }
                      >
                        {v > 0 ? formatUSD(v) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3 text-right font-mono font-bold text-white">
                    {m.total.spend > 0 ? formatUSD(m.total.spend) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
