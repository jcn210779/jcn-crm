import { AppHeader } from "@/components/app-header";
import {
  CentralView,
  type ActiveJob,
  type EstimateStale,
  type LowStock,
  type PaymentDue,
  type PendingInspection,
  type PendingSubInvoiceCard,
  type PendingTask,
  type PermitAlert,
  type SubBalance,
  type UpcomingInspection,
} from "@/components/central/central-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { JobPhase } from "@/lib/types";
import { getViewMode } from "@/lib/view-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Central — CRM JCN",
};

const ACTIVE_PHASES: JobPhase[] = [
  "planning",
  "materials_ordered",
  "materials_delivered",
  "work_in_progress",
];

function daysSince(iso: string): number {
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export default async function CentralPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();
  const viewMode = getViewMode();
  const isFlipMode = viewMode === "flip";

  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const in7dIso = in7d.toISOString();
  const nowDate = now.toISOString().slice(0, 10);
  const in7dDate = in7d.toISOString().slice(0, 10);

  // 1. Obras ativas (filtra por is_flip conforme modo)
  const activeJobsRes = await supabase
    .from("jobs")
    .select(
      "id, current_phase, value, is_flip, actual_start, expected_end, lead:leads(name, city)",
    )
    .in("current_phase", ACTIVE_PHASES)
    .eq("is_flip", isFlipMode)
    .order("actual_start", { ascending: true, nullsFirst: false });

  const activeJobs: ActiveJob[] = (activeJobsRes.data ?? []).map(
    (j: unknown) => {
      const job = j as {
        id: string;
        current_phase: string;
        value: number;
        is_flip: boolean;
        actual_start: string | null;
        expected_end: string | null;
        lead: { name: string; city: string | null } | null;
      };
      return {
        id: job.id,
        current_phase: job.current_phase,
        value: Number(job.value),
        is_flip: job.is_flip,
        actual_start: job.actual_start,
        expected_end: job.expected_end,
        lead_name: job.lead?.name ?? "?",
        lead_city: job.lead?.city ?? null,
      };
    },
  );

  // 2. Permits pendentes (jobs em obra sem permit released/not_needed)
  const permitRes = await supabase
    .from("jobs")
    .select("id, current_phase, permit_status, lead:leads(name)")
    .in("current_phase", ACTIVE_PHASES)
    .eq("is_flip", isFlipMode);

  const permitAlerts: PermitAlert[] = (permitRes.data ?? [])
    .map((j: unknown) => {
      const job = j as {
        id: string;
        current_phase: string;
        permit_status: string | null;
        lead: { name: string } | null;
      };
      return {
        job_id: job.id,
        current_phase: job.current_phase,
        status: job.permit_status,
        lead_name: job.lead?.name ?? "?",
      };
    })
    .filter(
      (p) => p.status !== "released" && p.status !== "not_needed",
    );

  // 3a. Inspeções de flip próximas 7 dias
  const flipInspRes = await supabase
    .from("flip_inspections")
    .select("id, name, type, scheduled_date, status, flip_id")
    .gte("scheduled_date", nowIso)
    .lte("scheduled_date", in7dIso)
    .in("status", ["scheduled", "rescheduled"])
    .order("scheduled_date");

  const flipInspList = (flipInspRes.data ?? []) as {
    id: string;
    name: string;
    type: string;
    scheduled_date: string;
    status: string;
    flip_id: string;
  }[];

  const flipIds = flipInspList.map((i) => i.flip_id);
  const flipDetailsMap = new Map<
    string,
    { job_id: string; property_address: string | null }
  >();
  if (flipIds.length > 0) {
    const flipsRes = await supabase
      .from("flip_details")
      .select("id, job_id, property_address")
      .in("id", flipIds);
    (flipsRes.data ?? []).forEach((f) => {
      const flip = f as {
        id: string;
        job_id: string;
        property_address: string | null;
      };
      flipDetailsMap.set(flip.id, {
        job_id: flip.job_id,
        property_address: flip.property_address,
      });
    });
  }

  // 3b. Inspeções de job regular (mig 0055) — próximas 7d + sem data
  const jobInspRes = await supabase
    .from("job_inspections")
    .select(
      "id, name, type, scheduled_date, status, job_id, job:jobs(lead:leads(name), current_phase)",
    )
    .in("status", ["pending", "scheduled"]);

  const jobInspList = (jobInspRes.data ?? []) as unknown as {
    id: string;
    name: string;
    type: string;
    scheduled_date: string | null;
    status: string;
    job_id: string;
    job: {
      lead: { name: string } | null;
      current_phase: string;
    } | null;
  }[];

  // Agendadas nos próximos 7 dias (flip + job juntos, ordenados)
  const upcomingInspections: UpcomingInspection[] = [
    ...flipInspList.map((i) => {
      const flip = flipDetailsMap.get(i.flip_id);
      return {
        id: i.id,
        source: "flip" as const,
        job_id: flip?.job_id ?? "",
        context: flip?.property_address ?? null,
        name: i.name,
        type: i.type,
        scheduled_date: i.scheduled_date,
        status: i.status,
      };
    }),
    ...jobInspList
      .filter(
        (i) =>
          i.scheduled_date &&
          i.scheduled_date >= nowIso &&
          i.scheduled_date <= in7dIso,
      )
      .map((i) => ({
        id: i.id,
        source: "job" as const,
        job_id: i.job_id,
        context: i.job?.lead?.name ?? null,
        name: i.name,
        type: i.type,
        scheduled_date: i.scheduled_date!,
        status: i.status,
      })),
  ].sort((a, b) =>
    a.scheduled_date < b.scheduled_date ? -1 : 1,
  );

  // Pendentes: inspeções de job REGULAR sem data marcada, em jobs ATIVOS
  const pendingInspections: PendingInspection[] = jobInspList
    .filter(
      (i) =>
        !i.scheduled_date &&
        i.status === "pending" &&
        i.job?.current_phase &&
        ACTIVE_PHASES.includes(i.job.current_phase as JobPhase),
    )
    .map((i) => ({
      id: i.id,
      job_id: i.job_id,
      lead_name: i.job?.lead?.name ?? "?",
      name: i.name,
    }));

  // 4. Pagamentos a receber vencidos ou vencendo em 7d
  const paymentsRes = await supabase
    .from("job_payments")
    .select(
      "id, label, amount, due_date, job:jobs(id, lead:leads(name))",
    )
    .eq("status", "pending")
    .lte("due_date", in7dDate)
    .order("due_date", { ascending: true, nullsFirst: true });

  const paymentsDue: PaymentDue[] = (paymentsRes.data ?? []).map(
    (p: unknown) => {
      const pay = p as {
        id: string;
        label: string;
        amount: number;
        due_date: string | null;
        job: {
          id: string;
          lead: { name: string } | null;
        } | null;
      };
      const days = pay.due_date
        ? Math.floor(
            (Date.now() - new Date(pay.due_date).getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : 0;
      return {
        id: pay.id,
        job_id: pay.job?.id ?? "",
        lead_name: pay.job?.lead?.name ?? "?",
        label: pay.label,
        amount: Number(pay.amount),
        due_date: pay.due_date,
        daysOverdue: days,
      };
    },
  );

  // 5. Subs com saldo a pagar (filtra por is_flip via join)
  const subsRes = await supabase
    .from("job_subcontractors")
    .select(
      "id, agreed_value, amount_paid, service_description, job:jobs!inner(id, is_flip, lead:leads(name)), sub:subcontractors(name)",
    )
    .neq("status", "cancelled")
    .eq("job.is_flip", isFlipMode);

  const subBalances: SubBalance[] = (subsRes.data ?? [])
    .map((s: unknown) => {
      const js = s as {
        id: string;
        agreed_value: number;
        amount_paid: number;
        service_description: string;
        job: {
          id: string;
          is_flip: boolean;
          lead: { name: string } | null;
        } | null;
        sub: { name: string } | null;
      };
      const remaining = Number(js.agreed_value) - Number(js.amount_paid ?? 0);
      return {
        id: js.id,
        job_id: js.job?.id ?? "",
        lead_name: js.job?.lead?.name ?? "?",
        sub_name: js.sub?.name ?? "?",
        service: js.service_description,
        agreed_value: Number(js.agreed_value),
        amount_paid: Number(js.amount_paid ?? 0),
        remaining,
      };
    })
    .filter((s) => s.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  // 5b. Invoices de sub recebidos aguardando pagamento (view v_pending_sub_invoices, mig 0064)
  const invRes = await supabase
    .from("v_pending_sub_invoices")
    .select("*")
    .eq("is_flip", isFlipMode);

  const pendingSubInvoices: PendingSubInvoiceCard[] = (invRes.data ?? []).map(
    (r: unknown) => {
      const row = r as {
        payment_id: string;
        job_id: string;
        sub_name: string;
        lead_name: string | null;
        service_description: string | null;
        amount: number;
        invoice_uploaded_at: string | null;
        is_flip: boolean;
      };
      return {
        payment_id: row.payment_id,
        job_id: row.job_id,
        sub_name: row.sub_name,
        lead_name: row.lead_name,
        service: row.service_description,
        amount: Number(row.amount),
        invoice_uploaded_at: row.invoice_uploaded_at,
        is_flip: row.is_flip,
      };
    },
  );

  // 6. Estimates enviados sem resposta há mais de 7 dias
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString();
  const estRes = await supabase
    .from("leads")
    .select("id, name, city, estimated_value, updated_at")
    .eq("stage", "estimate_enviado")
    .lte("updated_at", sevenDaysAgo)
    .order("updated_at");

  const estimatesStale: EstimateStale[] = (estRes.data ?? []).map(
    (l: unknown) => {
      const lead = l as {
        id: string;
        name: string;
        city: string | null;
        estimated_value: number | null;
        updated_at: string;
      };
      return {
        id: lead.id,
        name: lead.name,
        city: lead.city,
        estimated_value: lead.estimated_value
          ? Number(lead.estimated_value)
          : null,
        daysSince: daysSince(lead.updated_at),
      };
    },
  );

  // 7. Tarefas com due_date <= 7d + status != done
  const tasksRes = await supabase
    .from("tasks")
    .select("id, title, due_date, status, job_id")
    .neq("status", "done")
    .lte("due_date", in7dDate)
    .order("due_date");

  const pendingTasks: PendingTask[] = (tasksRes.data ?? []).map(
    (t: unknown) => {
      const task = t as {
        id: string;
        title: string;
        due_date: string | null;
        job_id: string | null;
      };
      const days = task.due_date
        ? Math.floor(
            (Date.now() - new Date(task.due_date).getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : 0;
      return {
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        daysOverdue: days,
        job_id: task.job_id,
      };
    },
  );

  // 8. Estoque baixo
  const stockRes = await supabase
    .from("store_items")
    .select("id, name, quantity, min_quantity, unit")
    .not("min_quantity", "is", null);

  const lowStock: LowStock[] = (stockRes.data ?? [])
    .map((s: unknown) => {
      const item = s as {
        id: string;
        name: string;
        quantity: number;
        min_quantity: number | null;
        unit: string | null;
      };
      return {
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        min_quantity: Number(item.min_quantity ?? 0),
        unit: item.unit,
      };
    })
    .filter((s) => s.quantity < s.min_quantity);

  // Ignorar nowDate no ts (não usado)
  void nowDate;

  return (
    <main className="relative min-h-screen pb-24">
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Central"
        viewMode={viewMode}
      />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-black tracking-tight text-jcn-ice">
            Central operacional
          </h1>
          <p className="mt-1 text-xs text-jcn-ice/55">
            O que precisa da sua atenção agora. Click nos cards vai direto pra
            ação.
          </p>
        </div>
        <CentralView
          activeJobs={activeJobs}
          permitAlerts={permitAlerts}
          upcomingInspections={upcomingInspections}
          pendingInspections={pendingInspections}
          paymentsDue={paymentsDue}
          subBalances={subBalances}
          pendingSubInvoices={pendingSubInvoices}
          estimatesStale={estimatesStale}
          pendingTasks={pendingTasks}
          lowStock={lowStock}
        />
      </div>
    </main>
  );
}
