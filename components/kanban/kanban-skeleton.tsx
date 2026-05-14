import { LEAD_STAGES } from "@/lib/types";

export function KanbanSkeleton() {
  return (
    <div className="mx-auto mt-6 max-w-7xl px-4 md:px-6">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STAGES.map((stage) => (
          <div
            key={stage}
            className="flex h-[60vh] w-[280px] flex-none animate-pulse flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="h-4 w-1/2 rounded-full bg-white/[0.08]" />
            <div className="h-3 w-1/3 rounded-full bg-white/[0.06]" />
            <div className="mt-2 h-20 rounded-xl bg-white/[0.04]" />
            <div className="h-20 rounded-xl bg-white/[0.04]" />
            <div className="h-20 rounded-xl bg-white/[0.03]" />
          </div>
        ))}
      </div>
    </div>
  );
}
