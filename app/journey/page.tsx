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
  lead: Pick<Lead, "id" | "name" | "city" | "phone" | "email" | "created_at" | "stage"> | null;
};

export default async function Page() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const [
    { data: jobsData, error: jobsErr },
    { data: milestonesData, error: milestonesErr },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "*, lead:leads(id, name, city, phone, email, created_at, stage)",
      )
      .order("contract_signed_at", { ascending: false }),
    supabase.from("journey_milestones").select("*"),
  ]);

  const jobs = (jobsData ?? []) as unknown as JobRow[];
  const milestones = (milestonesData ?? []) as JourneyMilestone[];

  const error = jobsErr ?? milestonesErr;

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
        <JourneyView jobs={jobs} milestones={milestones} />
      )}
    </main>
  );
}
