"use client";

import { CalendarCheck2, Wrench } from "lucide-react";
import { useState } from "react";

import { RepairsList } from "@/components/tasks/repairs-list";
import { TasksList } from "@/components/tasks/tasks-list";
import type { Lead, Repair, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "tasks" | "repairs";

type Props = {
  tasks: Task[];
  leads: Lead[];
  repairs: Repair[];
  userEmail: string;
};

export function TasksPageWrapper({ tasks, leads, repairs, userEmail }: Props) {
  const [tab, setTab] = useState<Tab>("tasks");

  const openRepairs = repairs.filter(
    (r) => r.status !== "completed" && r.status !== "cancelled",
  ).length;

  return (
    <div className="mx-auto mt-6 max-w-5xl space-y-5 px-4 md:px-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <TabButton
          active={tab === "tasks"}
          onClick={() => setTab("tasks")}
          icon={CalendarCheck2}
          label="Tasks"
          count={tasks.length}
        />
        <TabButton
          active={tab === "repairs"}
          onClick={() => setTab("repairs")}
          icon={Wrench}
          label="Reparos"
          count={openRepairs}
        />
      </div>

      {tab === "tasks" && (
        <TasksList tasks={tasks} leads={leads} userEmail={userEmail} />
      )}
      {tab === "repairs" && <RepairsList repairs={repairs} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition",
        active
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/10 text-jcn-gold-300"
          : "border-white/[0.06] bg-white/[0.02] text-jcn-ice/55 hover:text-jcn-ice",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold normal-case">
        {count}
      </span>
    </button>
  );
}
