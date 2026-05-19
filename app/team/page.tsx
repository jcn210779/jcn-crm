import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { TeamPage } from "@/components/team/team-page";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { JobHours, Lead, TeamMember, TeamPayable } from "@/lib/types";

export const dynamic = "force-dynamic";

type HoursRow = JobHours & {
  job?: {
    id: string;
    lead?: Pick<Lead, "id" | "name"> | null;
  } | null;
};

type JobRow = {
  id: string;
  current_phase: string;
  lead?: Pick<Lead, "id" | "name"> | null;
};

export default async function Page() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  // Últimas 8 semanas de horas (filtra client-side)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const [
    { data: membersData, error: membersError },
    { data: hoursData, error: hoursError },
    { data: jobsData, error: jobsError },
    { data: payablesData, error: payablesError },
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("job_hours")
      .select("*, job:jobs(id, lead:leads(id, name))")
      .gte("work_date", cutoffStr)
      .order("work_date", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, current_phase, lead:leads(id, name)")
      .neq("current_phase", "completed")
      .order("contract_signed_at", { ascending: false }),
    supabase
      .from("team_payables")
      .select("*")
      .eq("status", "pending")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  const members = (membersData ?? []) as TeamMember[];
  const hours = (hoursData ?? []) as unknown as HoursRow[];
  const jobs = ((jobsData ?? []) as unknown as JobRow[]).map((j) => ({
    id: j.id,
    label: j.lead?.name ?? "Sem cliente",
  }));
  const payables = (payablesData ?? []) as TeamPayable[];

  const error = membersError ?? hoursError ?? jobsError ?? payablesError;

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Team"
      />
      {error ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-jcn-ice">
            Erro ao carregar
          </h2>
          <p className="mt-2 text-sm text-jcn-ice/55">{error.message}</p>
        </div>
      ) : (
        <TeamPage
          members={members}
          hours={hours}
          jobs={jobs}
          payables={payables}
        />
      )}
    </main>
  );
}
