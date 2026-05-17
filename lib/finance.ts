/**
 * Helpers do módulo Financeiro (Fase 4.2K).
 *
 * Centraliza formatação de moeda/percentual e cálculos de comparação
 * entre períodos pra views da página /finance.
 */

import type { FinanceMonthly } from "./types";

/** Formata número como moeda USD pt-BR. Ex: 1234.56 -> "$1.234,56". */
export function formatUSD(value: number | null | undefined): string {
  const v = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/** Formata número como moeda USD compacta. Ex: 1234567 -> "$1,23 mi". */
export function formatUSDCompact(value: number | null | undefined): string {
  const v = typeof value === "number" ? value : 0;
  if (Math.abs(v) < 10000) return formatUSD(v);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

/** Formata data ISO -> "16 mai 2026". */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Formata month "YYYY-MM" -> "Maio 2026". */
export function formatMonthLabel(monthStr: string): string {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthNumStr);
  if (!year || !monthNum) return monthStr;
  const d = new Date(year, monthNum - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Compara valor do período atual com o anterior.
 * Retorna delta absoluto, percentual e direção.
 */
export type PeriodComparison = {
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPercent: number | null;
  direction: "up" | "down" | "flat";
};

export function comparePeriod(
  current: number,
  previous: number,
): PeriodComparison {
  const deltaAbs = current - previous;
  let deltaPercent: number | null = null;
  if (previous !== 0) {
    deltaPercent = (deltaAbs / Math.abs(previous)) * 100;
  } else if (current !== 0) {
    deltaPercent = null; // anterior zero, percentual indefinido
  } else {
    deltaPercent = 0;
  }
  let direction: "up" | "down" | "flat" = "flat";
  if (deltaAbs > 0.01) direction = "up";
  else if (deltaAbs < -0.01) direction = "down";
  return { current, previous, deltaAbs, deltaPercent, direction };
}

/** Formata percentual de delta. Ex: 12.34 -> "+12,3%". */
export function formatDeltaPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}

/**
 * Acha o mês na lista de FinanceMonthly. month no formato "YYYY-MM" ou
 * "YYYY-MM-DD".
 */
export function findMonth(
  rows: FinanceMonthly[],
  monthKey: string,
): FinanceMonthly | undefined {
  const normalized = monthKey.length >= 7 ? monthKey.slice(0, 7) : monthKey;
  return rows.find((r) => r.month_label === normalized);
}

/** Retorna mês imediatamente anterior à linha dada (ou undefined). */
export function previousMonth(
  rows: FinanceMonthly[],
  current: FinanceMonthly,
): FinanceMonthly | undefined {
  const [year, month] = current.month_label.split("-").map(Number);
  if (!year || !month) return undefined;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevLabel = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  return rows.find((r) => r.month_label === prevLabel);
}

/** Gera lista de meses no formato "YYYY-MM" pros últimos N meses, mais recente primeiro. */
export function lastNMonths(n: number, reference: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return out;
}

/** Total de 1 ou mais meses (útil pra agregação em "Tabela"). */
export function sumMonths(rows: FinanceMonthly[]): {
  sold: number;
  received: number;
  paid: number;
  balance: number;
} {
  return rows.reduce(
    (acc, r) => ({
      sold: acc.sold + Number(r.sold ?? 0),
      received: acc.received + Number(r.received ?? 0),
      paid: acc.paid + Number(r.total_paid_out ?? 0),
      balance: acc.balance + Number(r.cash_balance ?? 0),
    }),
    { sold: 0, received: 0, paid: 0, balance: 0 },
  );
}
