import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { FinanceView } from "@/components/finance/finance-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  BusinessExpense,
  FinanceMonthly,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  // 13 meses (12 atrás + atual). View já está em ordem desc.
  const [
    { data: monthlyData, error: monthlyError },
    { data: businessData, error: businessError },
  ] = await Promise.all([
    supabase.from("v_finance_monthly").select("*").limit(13),
    supabase
      .from("business_expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const monthly = (monthlyData ?? []) as FinanceMonthly[];
  const businessExpenses = (businessData ?? []) as BusinessExpense[];
  const error = monthlyError ?? businessError;

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Financeiro"
      />
      {error ? (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-jcn-ice">
            Erro ao carregar financeiro
          </h2>
          <p className="mt-2 text-sm text-jcn-ice/55">{error.message}</p>
        </div>
      ) : (
        <FinanceView monthly={monthly} businessExpenses={businessExpenses} />
      )}
    </main>
  );
}
