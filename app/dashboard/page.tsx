import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DecorBackground } from "@/components/decor-background";
import { requireUser } from "@/lib/auth";
import {
  calculateMetrics,
  lastNMonths,
  type DashboardMetrics,
} from "@/lib/dashboard-metrics";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AdSpend, Job, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — CRM JCN",
};

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Dashboard"
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardLoader />
      </Suspense>
    </main>
  );
}

async function DashboardLoader() {
  const supabase = createSupabaseServerClient();

  // Fetch paralelo dos 3 conjuntos. Banco JCN é pequeno (10s de leads, 2 jobs,
  // poucas dezenas de ad_spend) — varredura full é OK por enquanto. Se crescer,
  // adicionar filtro por created_at >= últimos 12 meses.
  const [leadsRes, jobsRes, spendsRes] = await Promise.all([
    supabase.from("leads").select("*"),
    supabase.from("jobs").select("*"),
    supabase.from("ad_spend").select("*"),
  ]);

  const firstError = leadsRes.error ?? jobsRes.error ?? spendsRes.error;
  if (firstError) {
    return (
      <div className="mx-auto mt-16 max-w-md px-6 text-center">
        <h2 className="text-xl font-bold text-white">
          Erro ao carregar dashboard
        </h2>
        <p className="mt-2 text-sm text-white/55">{firstError.message}</p>
      </div>
    );
  }

  const leads: Lead[] = leadsRes.data ?? [];
  const jobs: Job[] = jobsRes.data ?? [];
  const spends: AdSpend[] = spendsRes.data ?? [];

  // Calcula métricas pros 12 últimos meses (do mais recente pro mais antigo)
  const months = lastNMonths(12);
  const metricsByMonth: DashboardMetrics[] = months.map((m) =>
    calculateMetrics({ month: m, leads, jobs, spends }),
  );

  return (
    <DashboardClient
      metricsByMonth={metricsByMonth}
      currentSpends={spends}
    />
  );
}
