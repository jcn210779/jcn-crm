import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { PermitsView } from "@/components/permits/permits-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Permit, PermitSummaryRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Permits — CRM JCN",
};

export default async function Page() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const [
    { data: permitsData, error: permitsErr },
    { data: summaryData, error: summaryErr },
  ] = await Promise.all([
    supabase
      .from("permits")
      .select("*")
      .order("issued_at", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase
      .from("v_permits_summary")
      .select("*"),
  ]);

  const permits = (permitsData ?? []) as Permit[];
  const summary = (summaryData ?? []) as PermitSummaryRow[];

  const error = permitsErr ?? summaryErr;

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Permits"
      />
      {error ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-jcn-ice">Erro ao carregar</h2>
          <p className="mt-2 text-sm text-jcn-ice/55">{error.message}</p>
        </div>
      ) : (
        <PermitsView permits={permits} summary={summary} />
      )}
    </main>
  );
}
