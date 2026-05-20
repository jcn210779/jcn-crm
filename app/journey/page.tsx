import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { JourneyView } from "@/components/journey/journey-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Job, JourneyMilestone, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Jornada — CRM JCN",
};

type JobRow = Job & {
  lead: Pick<Lead, "id" | "name" | "city" | "phone" | "email" | "stage"> | null;
};

export default async function Page() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const [
    { data: jobsData, error: jobsErr },
    { data: leadsData, error: leadsErr },
    { data: milestonesData, error: milestonesErr },
  ] = await Promise.all([
    // Todos os jobs com lead
    supabase
      .from("jobs")
      .select("*, lead:leads(id, name, city, phone, email, stage)")
      .order("contract_signed_at", { ascending: false }),
    // Todos os leads (vamos filtrar client-side os que já têm job)
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false }),
    // Todos milestones
    supabase.from("journey_milestones").select("*"),
  ]);

  const jobs = (jobsData ?? []) as unknown as JobRow[];
  const allLeads = (leadsData ?? []) as Lead[];
  const milestones = (milestonesData ?? []) as JourneyMilestone[];

  // IDs de leads que JÁ viraram job — ficam na seção de Vendidos/Entregues
  const leadIdsWithJob = new Set(jobs.map((j) => j.lead?.id).filter(Boolean));
  const leadsWithoutJob = allLeads.filter((l) => !leadIdsWithJob.has(l.id));

  const error = jobsErr ?? leadsErr ?? milestonesErr;

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Jornada"
      />
      {error ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-jcn-ice">Erro ao carregar</h2>
          <p className="mt-2 text-sm text-jcn-ice/55">{error.message}</p>
        </div>
      ) : (
        <JourneyView
          jobs={jobs}
          leadsWithoutJob={leadsWithoutJob}
          milestones={milestones}
        />
      )}
    </main>
  );
}
