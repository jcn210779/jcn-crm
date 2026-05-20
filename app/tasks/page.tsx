import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { TasksPageWrapper } from "@/components/tasks/tasks-page-wrapper";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Lead, Repair, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data: tasksData, error: tasksErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  const leadIds = Array.from(
    new Set(
      ((tasksData ?? []) as Task[])
        .map((t) => t.lead_id)
        .filter((id): id is string => id !== null && id !== undefined),
    ),
  );

  let leads: Lead[] = [];
  if (leadIds.length > 0) {
    const { data: leadsData } = await supabase
      .from("leads")
      .select("*")
      .in("id", leadIds);
    leads = (leadsData ?? []) as Lead[];
  }

  const { data: repairsData, error: repairsErr } = await supabase
    .from("repairs")
    .select("*")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const tasks = (tasksData ?? []) as Task[];
  const repairs = (repairsData ?? []) as Repair[];

  const error = tasksErr ?? repairsErr;

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Tasks"
      />
      {error ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-white">Erro ao carregar</h2>
          <p className="mt-2 text-sm text-white/55">{error.message}</p>
        </div>
      ) : (
        <TasksPageWrapper
          tasks={tasks}
          leads={leads}
          repairs={repairs}
          userEmail={user.email ?? ""}
        />
      )}
    </main>
  );
}
