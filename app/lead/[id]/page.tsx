import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { LeadDetail } from "@/components/lead/lead-detail";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  ActivityLogRow,
  Lead,
  StageHistoryRow,
  Task,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

export default async function LeadDetailPage({ params }: Props) {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<Lead>();

  if (error || !lead) {
    notFound();
  }

  const [activityRes, historyRes, tasksRes] = await Promise.all([
    supabase
      .from("activity_log")
      .select("*")
      .eq("lead_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("stage_history")
      .select("*")
      .eq("lead_id", params.id)
      .order("changed_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("lead_id", params.id)
      .order("due_date", { ascending: true }),
  ]);

  const activities = (activityRes.data ?? []) as ActivityLogRow[];
  const history = (historyRes.data ?? []) as StageHistoryRow[];
  const tasks = (tasksRes.data ?? []) as Task[];

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Lead"
      />
      <LeadDetail
        lead={lead}
        activities={activities}
        history={history}
        tasks={tasks}
        userEmail={user.email ?? ""}
      />
    </main>
  );
}
