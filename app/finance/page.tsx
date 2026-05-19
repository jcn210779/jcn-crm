import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { FinanceView } from "@/components/finance/finance-view";
import type { ReceivableRow } from "@/components/finance/finance-receivable-tab";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  AccountBalance,
  BusinessExpense,
  FinanceMonthly,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type PaidPaymentRow = {
  job_id: string;
  amount: number;
  status: string;
};

export default async function FinancePage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  // 13 meses + business + balance + a receber
  const [
    { data: monthlyData, error: monthlyError },
    { data: businessData, error: businessError },
    { data: balanceData, error: balanceError },
    { data: pendingData, error: pendingError },
    { data: paidData, error: paidError },
  ] = await Promise.all([
    supabase.from("v_finance_monthly").select("*").limit(13),
    supabase
      .from("business_expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("v_account_balance").select("*").limit(1).maybeSingle(),
    supabase
      .from("job_payments")
      .select(
        "*, job:jobs(id, value, current_phase, lead:leads(id, name, city))",
      )
      .eq("status", "pending")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("job_payments").select("job_id, amount, status").eq("status", "paid"),
  ]);

  const monthly = (monthlyData ?? []) as FinanceMonthly[];
  const businessExpenses = (businessData ?? []) as BusinessExpense[];
  const accountBalance = (balanceData ?? null) as AccountBalance | null;
  const receivablePending = (pendingData ?? []) as unknown as ReceivableRow[];

  // Soma recebido por job_id (pra calcular % pago de cada)
  const receivedByJob: Record<string, number> = {};
  for (const p of (paidData ?? []) as PaidPaymentRow[]) {
    receivedByJob[p.job_id] = (receivedByJob[p.job_id] ?? 0) + Number(p.amount);
  }

  const error =
    monthlyError ?? businessError ?? balanceError ?? pendingError ?? paidError;

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
        <FinanceView
          monthly={monthly}
          businessExpenses={businessExpenses}
          accountBalance={accountBalance}
          receivablePending={receivablePending}
          receivedByJob={receivedByJob}
        />
      )}
    </main>
  );
}
