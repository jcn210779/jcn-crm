import { AppHeader } from "@/components/app-header";
import { StoreView } from "@/components/store/store-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { StoreItemStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Depósito — CRM JCN",
};

export default async function StorePage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("v_store_items_stats")
    .select("*")
    .order("name", { ascending: true });

  const items = (data ?? []) as StoreItemStats[];

  return (
    <main className="relative min-h-screen pb-24">
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Depósito"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <StoreView initialItems={items} />
      </div>
    </main>
  );
}
