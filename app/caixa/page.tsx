import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { CaixaView } from "@/components/caixa/caixa-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FinanceMonthly, FlipCashSummary, FlipDetails } from "@/lib/types";

export const dynamic = "force-dynamic";

type TxnAggRow = {
  flip_id: string;
  kind: string;
  amount: number;
};

const OUTFLOW_KINDS = new Set([
  "mortgage",
  "expense_house",
  "expense_cottage",
  "expense_general",
  "salary",
]);

export default async function CaixaPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const [{ data: flipsRaw }, { data: cashRaw }, { data: monthlyRaw }] =
    await Promise.all([
      supabase
        .from("flip_details")
        .select("*")
        .order("purchase_closed_at", { ascending: false, nullsFirst: false }),
      supabase.from("v_flip_cash_summary").select("*"),
      supabase
        .from("v_finance_monthly")
        .select("*")
        .order("month", { ascending: false })
        .limit(1),
    ]);

  const flips = (flipsRaw ?? []) as FlipDetails[];
  const cashByFlip = new Map<string, FlipCashSummary>();
  for (const c of (cashRaw ?? []) as FlipCashSummary[]) {
    cashByFlip.set(c.flip_id, c);
  }

  // Agrega transacoes por flip (recebido = withdrawals, gasto = outflows)
  const flipIds = flips.map((f) => f.id);
  const spentByFlip = new Map<string, { received: number; spent: number }>();
  if (flipIds.length > 0) {
    // Puxa draws (pra achar flip_id de cada draw), depois draw_items, depois transactions
    const { data: drawsRaw } = await supabase
      .from("flip_draws")
      .select("id,flip_id")
      .in("flip_id", flipIds);
    const drawFlipMap = new Map<string, string>();
    const drawIds: string[] = [];
    for (const d of (drawsRaw ?? []) as { id: string; flip_id: string }[]) {
      drawFlipMap.set(d.id, d.flip_id);
      drawIds.push(d.id);
    }

    let itemFlipMap = new Map<string, string>();
    let itemIds: string[] = [];
    if (drawIds.length > 0) {
      const { data: itemsRaw } = await supabase
        .from("flip_draw_items")
        .select("id,draw_id")
        .in("draw_id", drawIds);
      for (const it of (itemsRaw ?? []) as { id: string; draw_id: string }[]) {
        const fid = drawFlipMap.get(it.draw_id);
        if (fid) {
          itemFlipMap.set(it.id, fid);
          itemIds.push(it.id);
        }
      }
    }

    if (itemIds.length > 0) {
      const { data: txnsRaw } = await supabase
        .from("flip_draw_item_transactions")
        .select("draw_item_id,kind,amount")
        .in("draw_item_id", itemIds);
      for (const t of (txnsRaw ?? []) as {
        draw_item_id: string;
        kind: string;
        amount: number;
      }[]) {
        const fid = itemFlipMap.get(t.draw_item_id);
        if (!fid) continue;
        const cur = spentByFlip.get(fid) ?? { received: 0, spent: 0 };
        const amt = Number(t.amount);
        if (OUTFLOW_KINDS.has(t.kind)) cur.spent += amt;
        else cur.received += amt;
        spentByFlip.set(fid, cur);
      }
    }
  }

  const monthly = ((monthlyRaw ?? []) as FinanceMonthly[])[0] ?? null;

  return (
    <>
      <DecorBackground />
      <div className="relative min-h-screen">
        <AppHeader userEmail={user.email ?? ""} />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <CaixaView
            flips={flips}
            cashByFlip={Object.fromEntries(cashByFlip)}
            txnByFlip={Object.fromEntries(spentByFlip)}
            monthly={monthly}
          />
        </main>
      </div>
    </>
  );
}
