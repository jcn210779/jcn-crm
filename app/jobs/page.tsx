import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { JobsBoardClient, type JobWithLead } from "@/components/jobs/jobs-board-client";
import { KanbanSkeleton } from "@/components/kanban/kanban-skeleton";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Job, Lead } from "@/lib/types";
import { getViewMode } from "@/lib/view-mode";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireUser();
  const viewMode = getViewMode();
  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title={viewMode === "flip" ? "Jobs (Flip)" : "Jobs"}
        viewMode={viewMode}
      />
      <Suspense fallback={<KanbanSkeleton />}>
        <JobsLoader isFlipMode={viewMode === "flip"} />
      </Suspense>
    </main>
  );
}

async function JobsLoader({ isFlipMode }: { isFlipMode: boolean }) {
  const supabase = createSupabaseServerClient();

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_flip", isFlipMode)
    .order("contract_signed_at", { ascending: false });

  if (jobsError) {
    return (
      <div className="mx-auto mt-16 max-w-md px-6 text-center">
        <h2 className="text-xl font-bold text-white">Erro ao carregar jobs</h2>
        <p className="mt-2 text-sm text-white/55">{jobsError.message}</p>
      </div>
    );
  }

  const jobList: Job[] = jobs ?? [];
  const leadIds = jobList.map((j) => j.lead_id);

  let leadsById = new Map<string, Lead>();
  if (leadIds.length > 0) {
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .in("id", leadIds);

    if (leadsError) {
      return (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-white">Erro ao carregar leads vinculados</h2>
          <p className="mt-2 text-sm text-white/55">{leadsError.message}</p>
        </div>
      );
    }

    leadsById = new Map((leads ?? []).map((l) => [l.id, l as Lead]));
  }

  // Busca approved_extras_value por job pra somar no valor efetivo do card
  const { data: margins } = await supabase
    .from("v_job_margin")
    .select("job_id, approved_extras_value");
  const extrasByJob = new Map<string, number>(
    (margins ?? []).map((m) => [
      m.job_id as string,
      Number(m.approved_extras_value ?? 0),
    ]),
  );

  const enriched: JobWithLead[] = jobList.map((j) => ({
    ...j,
    lead: leadsById.get(j.lead_id) ?? null,
    approved_extras_value: extrasByJob.get(j.id) ?? 0,
  }));

  return <JobsBoardClient initialJobs={enriched} />;
}
