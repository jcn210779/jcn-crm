"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  HardHat,
  Plus,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddHoursWeeklyDialog } from "@/components/team/add-hours-weekly-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { JobHours, Lead, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export type HoursRow = JobHours & {
  job?: {
    id: string;
    lead?: Pick<Lead, "id" | "name"> | null;
  } | null;
};

export type JobOption = {
  id: string;
  label: string; // ex "Nick parke"
};

type Props = {
  members: TeamMember[];
  hours: HoursRow[];
  jobs: JobOption[];
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Retorna a segunda-feira da semana de uma data (UTC). */
function startOfWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0=Dom, 1=Seg, ..., 6=Sab
  const diff = day === 0 ? -6 : 1 - day; // Seg = day 1
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function TeamPayrollWeekly({ members, hours, jobs }: Props) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [addOpen, setAddOpen] = useState(false);
  const [presetMember, setPresetMember] = useState<TeamMember | null>(null);
  const [presetDate, setPresetDate] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);

  const days = useMemo<Date[]>(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = days[6] as Date;
  const fridayDate = days[4] as Date;
  const weekStartKey = dateKey(weekStart);
  const weekEndKey = dateKey(weekEnd);

  // Filtra horas da semana
  const weekHours = useMemo(() => {
    return hours.filter((h) => h.work_date >= weekStartKey && h.work_date <= weekEndKey);
  }, [hours, weekStartKey, weekEndKey]);

  // Agrupa horas por funcionário × dia
  const hoursByMemberDay = useMemo(() => {
    const map = new Map<string, Map<string, HoursRow[]>>();
    for (const h of weekHours) {
      if (!map.has(h.member_id)) map.set(h.member_id, new Map());
      const byDay = map.get(h.member_id)!;
      if (!byDay.has(h.work_date)) byDay.set(h.work_date, []);
      byDay.get(h.work_date)!.push(h);
    }
    return map;
  }, [weekHours]);

  // Funcionários ativos com horas na semana OU sempre ativos
  const activeMembers = useMemo(
    () => members.filter((m) => m.active),
    [members],
  );

  const isCurrentWeek = useMemo(() => {
    const todayStart = startOfWeek(today);
    return dateKey(todayStart) === weekStartKey;
  }, [weekStartKey, today]);

  const weekLabel = `${format(weekStart, "d MMM", { locale: ptBR })} – ${format(weekEnd, "d MMM yyyy", { locale: ptBR })}`;

  // Totais semana
  const weekTotalHours = weekHours.reduce((s, h) => s + Number(h.hours), 0);
  const weekTotalAmount = weekHours.reduce(
    (s, h) => s + Number(h.calculated_amount),
    0,
  );

  function navigate(weekDelta: number) {
    setWeekStart((prev) => addDays(prev, weekDelta * 7));
  }

  function goToCurrentWeek() {
    setWeekStart(startOfWeek(new Date()));
  }

  function openAddForCell(member: TeamMember | null, date: string | null) {
    setPresetMember(member);
    setPresetDate(date);
    setAddOpen(true);
  }

  async function handlePayAll() {
    if (weekTotalAmount === 0) {
      toast.info("Sem horas na semana pra pagar.");
      return;
    }

    // Agrupa por member: total a pagar
    const totalsByMember = new Map<string, { member: TeamMember; total: number }>();
    for (const h of weekHours) {
      const m = members.find((mm) => mm.id === h.member_id);
      if (!m) continue;
      const cur = totalsByMember.get(m.id);
      if (cur) {
        cur.total += Number(h.calculated_amount);
      } else {
        totalsByMember.set(m.id, { member: m, total: Number(h.calculated_amount) });
      }
    }

    const friday = dateKey(fridayDate);
    if (
      !confirm(
        `Lançar pagamento de folha da semana ${weekLabel}?\n\n` +
          Array.from(totalsByMember.values())
            .map((t) => `${t.member.name}: ${formatCurrency(t.total)}`)
            .join("\n") +
          `\n\nTotal: ${formatCurrency(weekTotalAmount)}\n\n` +
          `Vai criar 1 business_expense por funcionário, categoria 'payroll', data ${friday}.`,
      )
    ) {
      return;
    }

    setPayingAll(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const rows = Array.from(totalsByMember.values()).map((t) => ({
        expense_date: friday,
        category: "payroll" as const,
        description: `Folha semana ${weekLabel} — ${t.member.name}`,
        vendor: t.member.name,
        amount: t.total,
        payment_method: "check" as const,
      }));

      const { error } = await supabase.from("business_expenses").insert(rows);
      if (error) {
        toast.error(`Erro ao lançar folha: ${error.message}`);
        return;
      }
      toast.success(
        `Folha lançada: ${rows.length} pagamento${rows.length === 1 ? "" : "s"}, ${formatCurrency(weekTotalAmount)}`,
      );
      router.refresh();
    } finally {
      setPayingAll(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header semana */}
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jcn-gold-500/15 text-jcn-gold-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-jcn-ice md:text-xl">
                  {weekLabel}
                </h2>
                {isCurrentWeek && (
                  <Badge
                    variant="outline"
                    className="border-jcn-gold-400/40 bg-jcn-gold-500/15 text-[10px] font-bold text-jcn-gold-300"
                  >
                    ESTA SEMANA
                  </Badge>
                )}
              </div>
              <p className="text-xs text-jcn-ice/55">
                {weekTotalHours}h trabalhadas · {formatCurrency(weekTotalAmount)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentWeek}
              className="font-semibold"
            >
              Esta semana
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Button onClick={() => openAddForCell(null, null)}>
          <Plus className="h-4 w-4" />
          Adicionar horas
        </Button>
        <Button
          variant="outline"
          onClick={handlePayAll}
          disabled={payingAll || weekTotalAmount === 0}
          className={cn(
            "border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
            (payingAll || weekTotalAmount === 0) && "opacity-50",
          )}
        >
          <Wallet className="h-4 w-4" />
          {payingAll
            ? "Lançando..."
            : `Pagar tudo (sex ${format(fridayDate, "d MMM", { locale: ptBR })}) — ${formatCurrency(weekTotalAmount)}`}
        </Button>
      </div>

      {/* Grade */}
      {activeMembers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
          <HardHat className="mx-auto h-10 w-10 text-jcn-ice/30" />
          <p className="mt-4 text-sm font-semibold text-jcn-ice/65">
            Nenhum funcionário ativo
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-white/[0.06] bg-white/[0.02]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/55">
              <tr>
                <th className="px-3 py-3 text-left">Funcionário</th>
                {days.map((d, i) => (
                  <th
                    key={dateKey(d)}
                    className={cn(
                      "px-2 py-3 text-center",
                      i === 4 && "bg-jcn-gold-500/[0.06] text-jcn-gold-300",
                    )}
                  >
                    {WEEKDAY_LABELS[i]}
                    <div className="text-[10px] font-semibold text-jcn-ice/45">
                      {format(d, "d/M")}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => {
                const byDay = hoursByMemberDay.get(m.id);
                let memberTotalH = 0;
                let memberTotalAmount = 0;
                if (byDay) {
                  for (const arr of byDay.values()) {
                    for (const h of arr) {
                      memberTotalH += Number(h.hours);
                      memberTotalAmount += Number(h.calculated_amount);
                    }
                  }
                }

                return (
                  <tr
                    key={m.id}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-jcn-gold-500/15 text-jcn-gold-300">
                          <HardHat className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-jcn-ice">
                            {m.name}
                          </div>
                          <div className="text-[10px] text-jcn-ice/45">
                            {formatCurrency(Number(m.hourly_rate))}/h
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map((d, i) => {
                      const key = dateKey(d);
                      const entries = byDay?.get(key) ?? [];
                      const dayHours = entries.reduce(
                        (s, h) => s + Number(h.hours),
                        0,
                      );
                      const dayAmount = entries.reduce(
                        (s, h) => s + Number(h.calculated_amount),
                        0,
                      );
                      return (
                        <td
                          key={key}
                          className={cn(
                            "p-1 text-center align-top",
                            i === 4 && "bg-jcn-gold-500/[0.03]",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => openAddForCell(m, key)}
                            className={cn(
                              "h-14 w-full rounded-lg border border-transparent px-2 py-1.5 text-xs transition hover:border-jcn-gold-400/30 hover:bg-jcn-gold-500/[0.08]",
                              entries.length > 0
                                ? "bg-white/[0.04]"
                                : "text-jcn-ice/35",
                            )}
                            title={
                              entries.length === 0
                                ? "Adicionar horas"
                                : entries
                                    .map(
                                      (e) =>
                                        `${e.hours}h · ${e.job?.lead?.name ?? "?"} · ${formatCurrency(Number(e.calculated_amount))}`,
                                    )
                                    .join("\n")
                            }
                          >
                            {entries.length === 0 ? (
                              <Plus className="mx-auto h-3 w-3 text-jcn-ice/30" />
                            ) : (
                              <>
                                <div className="font-bold text-jcn-ice">
                                  {dayHours}h
                                </div>
                                <div className="text-[10px] font-semibold text-jcn-gold-300">
                                  {formatCurrency(dayAmount)}
                                </div>
                                {entries.length > 1 && (
                                  <div className="text-[9px] text-jcn-ice/40">
                                    {entries.length} jobs
                                  </div>
                                )}
                              </>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right">
                      <div className="text-sm font-black text-jcn-gold-300">
                        {formatCurrency(memberTotalAmount)}
                      </div>
                      <div className="text-[10px] text-jcn-ice/55">
                        {memberTotalH}h
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-white/[0.025] text-xs font-bold text-jcn-ice/85">
              <tr className="border-t border-white/[0.06]">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-jcn-ice/55">
                    <DollarSign className="h-3 w-3" />
                    Total semana
                  </div>
                </td>
                {days.map((d, i) => {
                  let dayTotal = 0;
                  for (const m of activeMembers) {
                    const entries = hoursByMemberDay.get(m.id)?.get(dateKey(d)) ?? [];
                    dayTotal += entries.reduce(
                      (s, h) => s + Number(h.calculated_amount),
                      0,
                    );
                  }
                  return (
                    <td
                      key={dateKey(d)}
                      className={cn(
                        "p-2 text-center text-[11px]",
                        i === 4 && "bg-jcn-gold-500/[0.05] text-jcn-gold-300",
                      )}
                    >
                      {dayTotal > 0 ? formatCurrency(dayTotal) : "—"}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right">
                  <div className="text-base font-black text-jcn-gold-300">
                    {formatCurrency(weekTotalAmount)}
                  </div>
                  <div className="text-[10px] text-jcn-ice/55">
                    {weekTotalHours}h
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Dialog adicionar horas */}
      <AddHoursWeeklyDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) {
            setPresetMember(null);
            setPresetDate(null);
          }
        }}
        members={activeMembers}
        jobs={jobs}
        presetMemberId={presetMember?.id ?? null}
        presetDate={presetDate}
        onDone={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
