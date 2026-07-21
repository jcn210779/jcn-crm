import { AppHeader } from "@/components/app-header";
import { PlaybookTree } from "@/components/playbook/playbook-tree";
import type { PlaybookData } from "@/components/playbook/playbook-tree";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Playbook do Flip — CRM JCN",
};

export default async function PlaybookPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data: row } = await supabase
    .from("flip_playbook")
    .select("data, updated_at")
    .eq("id", true)
    .single();

  const initialData = (row?.data ?? null) as PlaybookData | null;

  return (
    <main className="relative min-h-screen pb-24">
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Playbook do Flip"
      />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <PlaybookTree initialData={initialData} />
      </div>
    </main>
  );
}
