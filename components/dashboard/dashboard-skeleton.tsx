/**
 * Skeleton do Dashboard. Mantém layout visual idêntico ao carregado
 * pra evitar CLS (Cumulative Layout Shift). Usado no Suspense fallback.
 */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto mt-6 max-w-7xl px-4 md:px-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="h-9 w-48 animate-pulse rounded-md bg-white/[0.05]" />
        <div className="h-10 w-40 animate-pulse rounded-md bg-white/[0.05]" />
      </div>

      {/* KPI cards skeleton */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
          />
        ))}
      </div>

      {/* Tabela skeleton */}
      <div className="mt-8 h-72 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />

      {/* Histórico skeleton */}
      <div className="mt-8 h-64 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
    </div>
  );
}
