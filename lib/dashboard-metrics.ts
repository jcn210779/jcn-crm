/**
 * Util de cálculo de KPIs do Dashboard (Fase 5.1).
 *
 * Cruza leads + jobs + ad_spend pra produzir CAC, conversion rate e ROAS
 * por fonte e por mês. Tudo puro (zero IO) — fácil de testar e reutilizar
 * em Server Component, Client Component ou Edge Function.
 *
 * Decisão MVP: ROAS é "atribuído" (revenue de jobs vindos de leads daquele
 * mês ÷ spend daquele mês). NÃO é ROAS de fluxo (jobs assinados no mês).
 * Isso porque lead típico demora 1-3 meses pra virar job — ROAS de fluxo
 * misturaria spend novo com jobs vindos de leads antigos.
 */

import type { AdSpend, Job, Lead, LeadSource } from "./types";
import { LEAD_SOURCES } from "./types";

export type MonthKey = string; // "2026-05"

export type SourceMetrics = {
  source: LeadSource;
  spend: number;
  leads: number;
  won: number;
  lost: number;
  active: number;
  revenue: number;
  /** Custo por lead. null quando leads=0 (não há denominador). */
  cac: number | null;
  /** Won / (won + lost). 0 quando não há leads decididos. */
  conversionRate: number;
  /** Revenue / spend. null quando spend=0. */
  roas: number | null;
};

export type DashboardMetrics = {
  month: MonthKey;
  bySource: SourceMetrics[];
  total: {
    spend: number;
    leads: number;
    won: number;
    lost: number;
    active: number;
    revenue: number;
    cac: number | null;
    conversionRate: number;
    roas: number | null;
  };
};

/**
 * Converte um timestamp/data ISO em MonthKey (YYYY-MM).
 * Aceita tanto "2026-05-15T..." quanto "2026-05-01".
 */
export function toMonthKey(iso: string): MonthKey {
  return iso.slice(0, 7);
}

/**
 * Converte MonthKey em date string YYYY-MM-01 (formato da coluna ad_spend.month).
 */
export function monthKeyToFirstDay(month: MonthKey): string {
  return `${month}-01`;
}

/**
 * Lista os últimos N meses (mais recente primeiro), incluindo o mês atual.
 * Ex: lastNMonths(3, "2026-05") -> ["2026-05", "2026-04", "2026-03"]
 */
export function lastNMonths(n: number, base?: MonthKey): MonthKey[] {
  const ref = base ? `${base}-01T00:00:00Z` : new Date().toISOString();
  const refDate = new Date(ref);
  const out: MonthKey[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(
      Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - i, 1),
    );
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/**
 * Calcula métricas de UM mês específico.
 *
 * Inputs:
 * - month: "2026-05"
 * - leads: array de leads (qualquer mês — filtra internamente)
 * - jobs: array de jobs (qualquer mês — só usa pra cruzar com leads)
 * - spends: entradas de ad_spend (qualquer mês — filtra internamente)
 *
 * Lógica:
 * 1. Filtra leads cujo created_at cai no mês (atribuição por origem)
 * 2. Filtra spend cujo month cai no mês
 * 3. Agrupa por source
 * 4. Pra cada source: conta won/lost/active, soma revenue dos jobs vindos
 *    dos leads daquele source + mês, calcula CAC e ROAS
 */
export function calculateMetrics(input: {
  month: MonthKey;
  leads: Lead[];
  jobs: Job[];
  spends: AdSpend[];
}): DashboardMetrics {
  const { month, leads, jobs, spends } = input;

  // Index de jobs por lead_id pra cruzar revenue
  const jobsByLeadId = new Map<string, Job[]>();
  for (const job of jobs) {
    const list = jobsByLeadId.get(job.lead_id) ?? [];
    list.push(job);
    jobsByLeadId.set(job.lead_id, list);
  }

  // Filtra leads do mês
  const monthLeads = leads.filter((l) => toMonthKey(l.created_at) === month);

  // Filtra spends do mês
  const monthSpends = spends.filter((s) => toMonthKey(s.month) === month);

  // Acumula por source
  const acc = new Map<
    LeadSource,
    {
      spend: number;
      leads: number;
      won: number;
      lost: number;
      active: number;
      revenue: number;
    }
  >();

  // Inicializa só sources que tem spend OU leads (evita poluir UI com sources vazios)
  const activeSources = new Set<LeadSource>();
  for (const l of monthLeads) activeSources.add(l.source);
  for (const s of monthSpends) activeSources.add(s.source);

  for (const src of activeSources) {
    acc.set(src, {
      spend: 0,
      leads: 0,
      won: 0,
      lost: 0,
      active: 0,
      revenue: 0,
    });
  }

  // Aplica spend
  for (const s of monthSpends) {
    const row = acc.get(s.source);
    if (row) row.spend += Number(s.amount);
  }

  // Aplica leads + revenue dos jobs vindos desses leads
  for (const lead of monthLeads) {
    const row = acc.get(lead.source);
    if (!row) continue;
    row.leads += 1;
    if (lead.stage === "ganho") row.won += 1;
    else if (lead.stage === "perdido") row.lost += 1;
    else row.active += 1;

    // Soma revenue dos jobs vinculados a este lead (mesmo que job tenha sido
    // assinado em outro mês — atribuição vai pro mês de origem do lead)
    const relatedJobs = jobsByLeadId.get(lead.id) ?? [];
    for (const j of relatedJobs) {
      row.revenue += Number(j.value);
    }
  }

  // Monta SourceMetrics ordenado pelo enum (consistência visual)
  const bySource: SourceMetrics[] = [];
  for (const src of LEAD_SOURCES) {
    const row = acc.get(src);
    if (!row) continue;
    const decided = row.won + row.lost;
    bySource.push({
      source: src,
      spend: row.spend,
      leads: row.leads,
      won: row.won,
      lost: row.lost,
      active: row.active,
      revenue: row.revenue,
      cac: row.leads > 0 ? row.spend / row.leads : null,
      conversionRate: decided > 0 ? row.won / decided : 0,
      roas: row.spend > 0 ? row.revenue / row.spend : null,
    });
  }

  // Totais
  const total = bySource.reduce(
    (t, r) => {
      t.spend += r.spend;
      t.leads += r.leads;
      t.won += r.won;
      t.lost += r.lost;
      t.active += r.active;
      t.revenue += r.revenue;
      return t;
    },
    { spend: 0, leads: 0, won: 0, lost: 0, active: 0, revenue: 0 },
  );

  const totalDecided = total.won + total.lost;

  return {
    month,
    bySource,
    total: {
      ...total,
      cac: total.leads > 0 ? total.spend / total.leads : null,
      conversionRate: totalDecided > 0 ? total.won / totalDecided : 0,
      roas: total.spend > 0 ? total.revenue / total.spend : null,
    },
  };
}

/**
 * Formata número em USD (sem decimais — granularidade $ basta pro dashboard).
 */
export function formatUSD(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formata ROAS como "3.2x" ou "—" se null.
 */
export function formatROAS(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}x`;
}

/**
 * Formata conversion rate como "32%".
 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Classifica ROAS em níveis de cor:
 * - verde: >= 3x (lucrativo)
 * - âmbar: 1x a 3x (paga ads mas pouco lucro)
 * - vermelho: < 1x (queimando dinheiro)
 * - neutro: sem spend ou sem dado
 */
export type RoasLevel = "ok" | "warn" | "danger" | "neutral";

export function roasLevel(value: number | null): RoasLevel {
  if (value === null) return "neutral";
  if (value >= 3) return "ok";
  if (value >= 1) return "warn";
  return "danger";
}

/**
 * Label legível do mês em PT-BR. Ex: "2026-05" -> "Maio 2026".
 */
const MONTH_NAMES_PT: readonly string[] = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function monthLabelPT(month: MonthKey): string {
  const parts = month.split("-");
  const yStr = parts[0];
  const mStr = parts[1];
  if (!yStr || !mStr) return month;
  const m = Number(mStr) - 1;
  if (m < 0 || m > 11) return month;
  const name = MONTH_NAMES_PT[m] ?? month;
  return `${name} ${yStr}`;
}
