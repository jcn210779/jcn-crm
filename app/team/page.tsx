import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { TeamList } from "@/components/team/team-list";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  const members = (data ?? []) as TeamMember[];

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
            Erro ao carregar funcionários
          </h2>
          <p className="mt-2 text-sm text-jcn-ice/55">{error.message}</p>
        </div>
      ) : (
        <TeamList members={members} />
      )}
    </main>
  );
}
