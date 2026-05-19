import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { FollowUpsView } from "@/components/follow-ups/follow-ups-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FollowUp } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Follow-ups — CRM JCN",
};

export default async function Page() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const followUps = (data ?? []) as FollowUp[];

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Follow-ups"
      />
      {error ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-jcn-ice">
            Erro ao carregar
          </h2>
          <p className="mt-2 text-sm text-jcn-ice/55">{error.message}</p>
        </div>
      ) : (
        <FollowUpsView followUps={followUps} />
      )}
    </main>
  );
}
