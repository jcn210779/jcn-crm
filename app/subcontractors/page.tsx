import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { SubcontractorsList } from "@/components/subcontractors/subcontractors-list";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Subcontractor, SubcontractorStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SubcontractorsPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const [subsRes, statsRes] = await Promise.all([
    supabase
      .from("subcontractors")
      .select("*")
      .order("active", { ascending: false })
      .order("preferred", { ascending: false })
      .order("name", { ascending: true }),
    supabase.from("v_subcontractor_stats").select("*"),
  ]);

  const subs = (subsRes.data ?? []) as Subcontractor[];
  const stats = (statsRes.data ?? []) as SubcontractorStats[];

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Subs"
      />
      {subsRes.error ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-jcn-ice">
            Erro ao carregar subempreiteiros
          </h2>
          <p className="mt-2 text-sm text-jcn-ice/55">{subsRes.error.message}</p>
        </div>
      ) : (
        <SubcontractorsList subs={subs} stats={stats} />
      )}
    </main>
  );
}
