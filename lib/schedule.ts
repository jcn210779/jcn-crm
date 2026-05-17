/**
 * Util pra organizar jobs em meses no calendário/agenda de obras.
 *
 * Critério de "ativo no mês X":
 *   start <= último_dia_mes_X  AND  end >= primeiro_dia_mes_X
 *
 * Usa actual_start/actual_end se houver, senão expected_start/expected_end.
 * Job sem nenhuma data fica em "Sem cronograma".
 */

import type { Job, Lead } from "./types";

export type JobWithLead = Job & {
  lead?: Pick<Lead, "id" | "name" | "city"> | null;
};

export type MonthKey = string; // "2026-05"

export type MonthBucket = {
  monthKey: MonthKey;
  year: number;
  monthIndex: number; // 0-11
  monthLabel: string; // "Maio 2026"
  jobs: JobWithLead[];
  totalValue: number;
};

const MONTH_NAMES_PT = [
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

export function monthKey(year: number, monthIndex: number): MonthKey {
  return `${year}-${(monthIndex + 1).toString().padStart(2, "0")}`;
}

export function monthLabelPT(year: number, monthIndex: number): string {
  return `${MONTH_NAMES_PT[monthIndex] ?? "?"} ${year}`;
}

/** Pega a data efetiva (actual se houver, senão expected). */
function effectiveStart(job: Job): string | null {
  return job.actual_start ?? job.expected_start;
}
function effectiveEnd(job: Job): string | null {
  return job.actual_end ?? job.expected_end;
}

/** Retorna [firstDay, lastDay] do mês como Date objects (UTC). */
function monthRange(year: number, monthIndex: number): [Date, Date] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59));
  return [first, last];
}

/** Job está ativo no mês X se intervalo [start, end] toca o mês X. */
export function isJobActiveInMonth(
  job: Job,
  year: number,
  monthIndex: number,
): boolean {
  const start = effectiveStart(job);
  const end = effectiveEnd(job);
  if (!start && !end) return false;

  const [first, last] = monthRange(year, monthIndex);

  // Se só tem start, considera ativo do start em diante (até fase=completed)
  if (start && !end) {
    return new Date(start) <= last;
  }
  // Se só tem end, considera ativo até o end
  if (!start && end) {
    return new Date(end) >= first;
  }
  // Tem ambos
  return new Date(start!) <= last && new Date(end!) >= first;
}

/** Calcula % completo do job no mês de referência (passado/atual/futuro). */
export function calculateJobProgress(job: Job): number | null {
  const start = effectiveStart(job);
  const end = effectiveEnd(job);
  if (!start || !end) return null;

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (endTime <= startTime) return 100;

  const now = Date.now();
  if (now <= startTime) return 0;
  if (now >= endTime) return 100;
  return Math.round(((now - startTime) / (endTime - startTime)) * 100);
}

/** Dias restantes (negativo se atrasado). */
export function daysRemaining(job: Job): number | null {
  const end = effectiveEnd(job);
  if (!end) return null;
  const endTime = new Date(end).getTime();
  const now = Date.now();
  return Math.ceil((endTime - now) / (1000 * 60 * 60 * 24));
}

/** Gera buckets de meses com jobs distribuídos. */
export function buildMonthBuckets({
  jobs,
  centerYear,
  centerMonth,
  monthsBack,
  monthsForward,
  includeCompleted,
}: {
  jobs: JobWithLead[];
  centerYear: number;
  centerMonth: number; // 0-11
  monthsBack: number;
  monthsForward: number;
  includeCompleted: boolean;
}): MonthBucket[] {
  const buckets: MonthBucket[] = [];

  for (let offset = -monthsBack; offset <= monthsForward; offset++) {
    const date = new Date(Date.UTC(centerYear, centerMonth + offset, 1));
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();

    const monthJobs = jobs.filter((j) => {
      if (!includeCompleted && j.current_phase === "completed") return false;
      return isJobActiveInMonth(j, year, monthIndex);
    });

    const totalValue = monthJobs.reduce(
      (sum, j) => sum + Number(j.value),
      0,
    );

    buckets.push({
      monthKey: monthKey(year, monthIndex),
      year,
      monthIndex,
      monthLabel: monthLabelPT(year, monthIndex),
      jobs: monthJobs,
      totalValue,
    });
  }

  return buckets;
}

/** Jobs sem nenhuma data (start nem end). */
export function jobsWithoutSchedule(
  jobs: JobWithLead[],
  includeCompleted: boolean,
): JobWithLead[] {
  return jobs.filter((j) => {
    if (!includeCompleted && j.current_phase === "completed") return false;
    return !j.expected_start && !j.expected_end && !j.actual_start && !j.actual_end;
  });
}
