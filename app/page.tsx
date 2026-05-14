import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { KanbanBoardClient } from "@/components/kanban/kanban-board-client";
import { KanbanSkeleton } from "@/components/kanban/kanban-skeleton";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader userEmail={user.email ?? ""} />
      <Suspense fallback={<KanbanSkeleton />}>
        <KanbanLoader userEmail={user.email ?? "jose"} />
      </Suspense>
    </main>
  );
}

async function KanbanLoader({ userEmail }: { userEmail: string }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-md px-6 text-center">
        <h2 className="text-xl font-bold text-white">Erro ao carregar leads</h2>
        <p className="mt-2 text-sm text-white/55">{error.message}</p>
      </div>
    );
  }

  const leads: Lead[] = data ?? [];
  return <KanbanBoardClient initialLeads={leads} userEmail={userEmail} />;
}
