"use client";

import { CalendarDays, Users } from "lucide-react";
import { useState } from "react";

import { TeamList } from "@/components/team/team-list";
import {
  TeamPayrollWeekly,
  type HoursRow,
  type JobOption,
} from "@/components/team/team-payroll-weekly";
import type { TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "members" | "payroll";

type Props = {
  members: TeamMember[];
  hours: HoursRow[];
  jobs: JobOption[];
};

export function TeamPage({ members, hours, jobs }: Props) {
  const [tab, setTab] = useState<Tab>("payroll");

  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-5 px-4 md:px-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <TabButton
          active={tab === "payroll"}
          onClick={() => setTab("payroll")}
          icon={CalendarDays}
          label="Folha semanal"
        />
        <TabButton
          active={tab === "members"}
          onClick={() => setTab("members")}
          icon={Users}
          label="Funcionários"
        />
      </div>

      {tab === "members" && <TeamList members={members} />}
      {tab === "payroll" && (
        <TeamPayrollWeekly members={members} hours={hours} jobs={jobs} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
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
    </button>
  );
}
