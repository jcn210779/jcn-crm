import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { TasksList } from "@/components/tasks/tasks-list";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Lead, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  // Pega todas tasks pendentes (overdue também conta como pending até serem marcadas)
  const { data: tasksData, error: tasksErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  // Pega só os leads que aparecem nas tasks (pra mostrar nome + cidade)
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

  const tasks = (tasksData ?? []) as Task[];

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Tasks"
      />
      {tasksErr ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-white">Erro ao carregar tasks</h2>
          <p className="mt-2 text-sm text-white/55">{tasksErr.message}</p>
        </div>
      ) : (
        <TasksList
          tasks={tasks}
          leads={leads}
          userEmail={user.email ?? ""}
        />
      )}
    </main>
  );
}
