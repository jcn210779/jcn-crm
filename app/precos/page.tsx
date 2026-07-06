import { AppHeader } from "@/components/app-header";
import { PrecosView } from "@/components/precos/precos-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SubPriceCatalog } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Preços de sub — CRM JCN",
};

export default async function PrecosPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("sub_price_catalog")
    .select("*")
    .order("category")
    .order("display_order")
    .order("service_name");

  const items = (data ?? []) as SubPriceCatalog[];

  return (
    <main className="relative min-h-screen pb-24">
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Preços de sub"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <PrecosView initialItems={items} />
      </div>
    </main>
  );
}
