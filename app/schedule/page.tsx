import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Job, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agenda — CRM JCN",
};

type JobRow = Job & { lead?: Pick<Lead, "id" | "name" | "city"> | null };

export default async function SchedulePage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("jobs")
    .select("*, lead:leads(id, name, city)")
    .order("expected_start", { ascending: true, nullsFirst: false });

  if (error) {
    return (
      <main className="relative min-h-screen pb-24">
        <DecorBackground />
        <AppHeader
          userEmail={user.email ?? ""}
          showNewLead={false}
          title="Agenda"
        />
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-center text-rose-200">
          <p className="font-bold">Erro ao carregar agenda</p>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      </main>
    );
  }

  const jobs = (data ?? []) as JobRow[];

  // Busca approved_extras_value por job pra somar valor efetivo na agenda
  const { data: margins } = await supabase
    .from("v_job_margin")
    .select("job_id, approved_extras_value");
  const extrasByJob = new Map<string, number>(
    (margins ?? []).map((m) => [
      m.job_id as string,
      Number(m.approved_extras_value ?? 0),
    ]),
  );
  const jobsWithExtras = jobs.map((j) => ({
    ...j,
    approved_extras_value: extrasByJob.get(j.id) ?? 0,
  }));

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Agenda"
      />
      <ScheduleView jobs={jobsWithExtras} />
    </main>
  );
}
