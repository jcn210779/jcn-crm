"use client";

/**
 * Central operacional — visão de tudo que precisa de ação AGORA.
 *
 * 8 cards organizados por urgência (críticos primeiro):
 * 1. Obras em andamento
 * 2. Permits faltando/pendentes
 * 3. Inspeções próximas (7 dias)
 * 4. Pagamentos a receber (vencidos/vencendo)
 * 5. Subs com saldo a pagar
 * 6. Estimates sem resposta (>7 dias)
 * 7. Tarefas do dia
 * 8. Alertas de estoque baixo
 */

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  DollarSign,
  HardHat,
  Home,
  Mail,
  Package,
  Users,
} from "lucide-react";
import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

// ============================================================================
// Types de props (dados vêm do server component)
// ============================================================================

export type ActiveJob = {
  id: string;
  lead_name: string;
  lead_city: string | null;
  current_phase: string;
  value: number;
  is_flip: boolean;
  actual_start: string | null;
  expected_end: string | null;
};

export type PermitAlert = {
  job_id: string;
  lead_name: string;
  status: string | null; // null se não tem permit_cards
  current_phase: string;
};

export type UpcomingInspection = {
  id: string;
  flip_id: string;
  job_id: string;
  flip_address: string | null;
  name: string;
  type: string;
  scheduled_date: string;
  status: string;
};

export type PaymentDue = {
  id: string;
  job_id: string;
  lead_name: string;
  label: string;
  amount: number;
  due_date: string | null;
  daysOverdue: number;
};

export type SubBalance = {
  id: string;
  job_id: string;
  lead_name: string;
  sub_name: string;
  service: string;
  agreed_value: number;
  amount_paid: number;
  remaining: number;
};

export type EstimateStale = {
  id: string;
  name: string;
  city: string | null;
  estimated_value: number | null;
  daysSince: number;
};

export type PendingTask = {
  id: string;
  title: string;
  due_date: string | null;
  daysOverdue: number;
  job_id: string | null;
};

export type LowStock = {
  id: string;
  name: string;
  quantity: number;
  min_quantity: number;
  unit: string | null;
};

type Props = {
  activeJobs: ActiveJob[];
  permitAlerts: PermitAlert[];
  upcomingInspections: UpcomingInspection[];
  paymentsDue: PaymentDue[];
  subBalances: SubBalance[];
  estimatesStale: EstimateStale[];
  pendingTasks: PendingTask[];
  lowStock: LowStock[];
};

const PHASE_LABEL: Record<string, string> = {
  planning: "Planejamento",
  materials_ordered: "Material pedido",
  materials_delivered: "Material entregue",
  work_in_progress: "Em obra",
  completed: "Concluído",
  permit_released: "Permit liberado",
};

export function CentralView(props: Props) {
  const {
    activeJobs,
    permitAlerts,
    upcomingInspections,
    paymentsDue,
    subBalances,
    estimatesStale,
    pendingTasks,
    lowStock,
  } = props;

  return (
    <div className="space-y-5">
      {/* Header com resumo geral */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Em obra"
          value={activeJobs.filter((j) => j.current_phase === "work_in_progress").length}
          icon={Home}
          tone="text-jcn-gold-300"
        />
        <Kpi
          label="Permits pendentes"
          value={permitAlerts.length}
          icon={Building2}
          tone={
            permitAlerts.length > 0 ? "text-rose-300" : "text-jcn-ice/55"
          }
        />
        <Kpi
          label="Inspeções 7d"
          value={upcomingInspections.length}
          icon={ClipboardCheck}
          tone="text-sky-300"
        />
        <Kpi
          label="A receber"
          value={paymentsDue.length}
          icon={DollarSign}
          tone={
            paymentsDue.some((p) => p.daysOverdue > 0)
              ? "text-rose-300"
              : "text-jcn-gold-300"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 1. Obras (separadas por status real) */}
        <Card title="Obras" icon={Home} count={activeJobs.length}>
          {activeJobs.length === 0 ? (
            <Empty>Nenhuma obra ativa</Empty>
          ) : (
            <div className="space-y-4">
              <JobGroup
                label="Em obra"
                tone="text-jcn-gold-300"
                jobs={activeJobs.filter(
                  (j) => j.current_phase === "work_in_progress",
                )}
              />
              <JobGroup
                label="Aguardando material"
                tone="text-sky-300"
                jobs={activeJobs.filter(
                  (j) =>
                    j.current_phase === "materials_ordered" ||
                    j.current_phase === "materials_delivered",
                )}
              />
              <JobGroup
                label="Planejamento"
                tone="text-jcn-ice/60"
                jobs={activeJobs.filter(
                  (j) => j.current_phase === "planning",
                )}
              />
            </div>
          )}
        </Card>

        {/* 2. Permits pendentes */}
        <Card
          title="Permits pendentes"
          icon={Building2}
          count={permitAlerts.length}
          alert={permitAlerts.length > 0}
        >
          {permitAlerts.length === 0 ? (
            <Empty>Todos os jobs em obra têm permit ativo</Empty>
          ) : (
            <ul className="space-y-2">
              {permitAlerts.map((p) => (
                <li key={p.job_id}>
                  <Link
                    href={`/job/${p.job_id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-rose-400/20 bg-rose-500/5 p-3 transition hover:bg-rose-500/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {p.lead_name}
                      </p>
                      <p className="text-[11px] text-rose-200/85">
                        {p.status
                          ? `Permit: ${p.status}`
                          : "Sem permit cadastrado"}
                        {" · "}
                        {PHASE_LABEL[p.current_phase] ?? p.current_phase}
                      </p>
                    </div>
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 3. Inspeções próximas */}
        <Card
          title="Inspeções próximas (7 dias)"
          icon={ClipboardCheck}
          count={upcomingInspections.length}
        >
          {upcomingInspections.length === 0 ? (
            <Empty>Nenhuma inspeção agendada</Empty>
          ) : (
            <ul className="space-y-2">
              {upcomingInspections.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/job/${i.job_id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 p-3 transition hover:bg-sky-500/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {i.name}
                      </p>
                      <p className="text-[11px] text-sky-200/85">
                        {i.type === "city" ? "Cidade" : "Interna"}
                        {i.flip_address && ` · ${i.flip_address}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-bold uppercase text-sky-200/70">
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(i.scheduled_date))}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 4. Pagamentos a receber */}
        <Card
          title="A receber (vencidos + 7d)"
          icon={DollarSign}
          count={paymentsDue.length}
          alert={paymentsDue.some((p) => p.daysOverdue > 0)}
        >
          {paymentsDue.length === 0 ? (
            <Empty>Nenhum pagamento vencido/vencendo</Empty>
          ) : (
            <ul className="space-y-2">
              {paymentsDue.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/job/${p.job_id}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border p-3 transition",
                      p.daysOverdue > 0
                        ? "border-rose-400/20 bg-rose-500/5 hover:bg-rose-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {p.lead_name}
                      </p>
                      <p className="text-[11px] text-jcn-ice/55">
                        {p.label}
                        {p.due_date && ` · vence ${p.due_date}`}
                        {p.daysOverdue > 0 && (
                          <span className="ml-1 font-bold text-rose-300">
                            ({p.daysOverdue}d atrás)
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-jcn-gold-300">
                      {formatCurrency(p.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 5. Subs com saldo a pagar */}
        <Card
          title="Subs a pagar (saldo)"
          icon={Users}
          count={subBalances.length}
        >
          {subBalances.length === 0 ? (
            <Empty>Nenhum sub com saldo a pagar</Empty>
          ) : (
            <ul className="space-y-2">
              {subBalances.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/job/${s.job_id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {s.sub_name}
                      </p>
                      <p className="truncate text-[11px] text-jcn-ice/55">
                        {s.lead_name} · {s.service}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-orange-300">
                        {formatCurrency(s.remaining)}
                      </p>
                      <p className="text-[9px] text-jcn-ice/45">
                        de {formatCurrency(s.agreed_value)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
              {subBalances.length > 8 && (
                <li className="text-center text-[10px] italic text-jcn-ice/40">
                  +{subBalances.length - 8} outros
                </li>
              )}
            </ul>
          )}
        </Card>

        {/* 6. Estimates sem resposta */}
        <Card
          title="Estimates sem resposta (>7d)"
          icon={Mail}
          count={estimatesStale.length}
        >
          {estimatesStale.length === 0 ? (
            <Empty>Nenhum estimate parado</Empty>
          ) : (
            <ul className="space-y-2">
              {estimatesStale.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/lead/${e.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {e.name}
                      </p>
                      <p className="text-[11px] text-jcn-ice/55">
                        {e.city && `${e.city} · `}
                        Enviado há {e.daysSince}d
                      </p>
                    </div>
                    {e.estimated_value && (
                      <span className="shrink-0 text-sm font-black text-jcn-gold-300">
                        {formatCurrency(e.estimated_value)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 7. Tarefas do dia */}
        <Card
          title="Tarefas do dia"
          icon={CheckSquare}
          count={pendingTasks.length}
        >
          {pendingTasks.length === 0 ? (
            <Empty>Nenhuma tarefa pra hoje</Empty>
          ) : (
            <ul className="space-y-2">
              {pendingTasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.job_id ? `/job/${t.job_id}` : "/tasks"}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border p-3 transition",
                      t.daysOverdue > 0
                        ? "border-amber-400/20 bg-amber-500/5 hover:bg-amber-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-jcn-ice">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-jcn-ice/55">
                        {t.due_date && `Vence ${t.due_date}`}
                        {t.daysOverdue > 0 && (
                          <span className="ml-1 font-bold text-amber-300">
                            ({t.daysOverdue}d atrás)
                          </span>
                        )}
                      </p>
                    </div>
                    <CalendarClock className="h-4 w-4 shrink-0 text-jcn-ice/40" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 8. Estoque baixo */}
        <Card title="Estoque baixo (Depósito)" icon={Package} count={lowStock.length}>
          {lowStock.length === 0 ? (
            <Empty>Todos os items acima do mínimo</Empty>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((s) => (
                <li key={s.id}>
                  <Link
                    href="/store"
                    className="flex items-center justify-between gap-2 rounded-xl border border-orange-400/20 bg-orange-500/5 p-3 transition hover:bg-orange-500/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-jcn-ice">
                        {s.name}
                      </p>
                      <p className="text-[11px] text-orange-200/85">
                        {s.quantity} {s.unit ?? ""} (mín {s.min_quantity})
                      </p>
                    </div>
                    <AlertTriangle className="h-4 w-4 shrink-0 text-orange-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Grupo de jobs (sub-seção dentro do card Obras)
// ============================================================================

function JobGroup({
  label,
  tone,
  jobs,
}: {
  label: string;
  tone: string;
  jobs: ActiveJob[];
}) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className={cn("text-[10px] font-bold uppercase tracking-[0.15em]", tone)}>
          {label}
        </span>
        <span className="text-[10px] text-jcn-ice/45">({jobs.length})</span>
      </div>
      <ul className="space-y-2">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link
              href={`/job/${j.id}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.06]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-jcn-ice">
                  {j.lead_name}
                  {j.is_flip && (
                    <span className="ml-1 text-xs text-jcn-gold-300">
                      🏠 FLIP
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-jcn-ice/55">
                  {j.lead_city && `${j.lead_city} · `}
                  {j.actual_start
                    ? `início ${formatDistanceToNow(new Date(j.actual_start), { locale: ptBR, addSuffix: true })}`
                    : "sem data de início"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black text-jcn-gold-300">
                {formatCurrency(j.value)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// UI helpers
// ============================================================================

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", tone)} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-jcn-ice/55">
          {label}
        </p>
      </div>
      <p className={cn("mt-1 text-2xl font-black", tone)}>{value}</p>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  count,
  alert = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border p-4 md:p-5",
        alert
          ? "border-rose-400/20 bg-rose-500/[0.03]"
          : "border-white/[0.06] bg-white/[0.025]",
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            alert ? "text-rose-300" : "text-jcn-gold-300",
          )}
        />
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-jcn-ice/75">
          {title}
        </h2>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[10px] font-black",
            alert
              ? "bg-rose-500/20 text-rose-200"
              : "bg-white/[0.06] text-jcn-ice/60",
          )}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-xs italic text-jcn-ice/40">
      ✓ {children}
    </p>
  );
}

// unused imports pra evitar lint
void HardHat;
