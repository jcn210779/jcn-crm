/**
 * Util pra gerar texto inicial do diário de obra baseado nos eventos do dia.
 *
 * Cruza:
 * - Horas registradas naquele dia (job_hours)
 * - Despesas com expense_date == dia (job_expenses)
 * - Fotos uploadadas naquele dia (job_photos)
 *
 * Retorna string formatada que o José edita por cima pra adicionar contexto
 * humano (problemas, próximos passos, observações).
 */

import type { JobHoursWithMember } from "./job-hours";
import { EXPENSE_CATEGORY_LABEL, PHOTO_CATEGORY_LABEL } from "./labels";
import type { JobExpense, JobPhoto } from "./types";

type Args = {
  date: string; // "YYYY-MM-DD"
  hours: JobHoursWithMember[];
  expenses: JobExpense[];
  photos: JobPhoto[];
};

/** Compara se uma string ISO (datetime ou date) bate com data alvo. */
function isSameDate(isoOrDate: string, targetDate: string): boolean {
  // Pega só YYYY-MM-DD da string ISO
  const sliced = isoOrDate.slice(0, 10);
  return sliced === targetDate;
}

export function buildDailyLogAutofill({
  date,
  hours,
  expenses,
  photos,
}: Args): string {
  const lines: string[] = [];

  // Horas do dia
  const dayHours = hours.filter((h) => isSameDate(h.work_date, date));
  if (dayHours.length > 0) {
    const totalHours = dayHours.reduce(
      (sum, h) => sum + Number(h.hours),
      0,
    );
    const breakdown = dayHours
      .map((h) => `${h.member?.name ?? "?"} ${Number(h.hours)}h`)
      .join(" + ");
    lines.push(`${totalHours}h registradas (${breakdown}).`);
  }

  // Despesas do dia
  const dayExpenses = expenses.filter((e) =>
    isSameDate(e.expense_date, date),
  );
  if (dayExpenses.length > 0) {
    const totalExp = dayExpenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );
    const byCat = dayExpenses
      .map(
        (e) =>
          `${EXPENSE_CATEGORY_LABEL[e.category]} $${Number(e.amount).toFixed(0)}${
            e.vendor ? ` (${e.vendor})` : ""
          }`,
      )
      .join(", ");
    lines.push(`$${totalExp.toFixed(0)} em despesas: ${byCat}.`);
  }

  // Fotos do dia (created_at — quando foi upload)
  const dayPhotos = photos.filter((p) =>
    isSameDate(p.created_at, date),
  );
  if (dayPhotos.length > 0) {
    const counts: Record<string, number> = {};
    for (const p of dayPhotos) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    const summary = Object.entries(counts)
      .map(
        ([cat, count]) =>
          `${count} em ${PHOTO_CATEGORY_LABEL[cat as keyof typeof PHOTO_CATEGORY_LABEL]}`,
      )
      .join(", ");
    lines.push(`${dayPhotos.length} foto${dayPhotos.length > 1 ? "s" : ""} nova${dayPhotos.length > 1 ? "s" : ""} (${summary}).`);
  }

  if (lines.length === 0) {
    return "Sem atividade registrada no CRM nesse dia. Anota aqui o que aconteceu.";
  }

  return lines.join("\n\n") + "\n\n";
}
