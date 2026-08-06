import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { FinancasFlipsView } from "@/components/financas-flips/financas-flips-view";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FlipDetails } from "@/lib/types";

export const dynamic = "force-dynamic";

const OUTFLOW_KINDS = new Set([
  "mortgage",
  "expense_house",
  "expense_cottage",
  "expense_general",
  "salary",
]);

export type FlipFinanceRow = {
  flip: FlipDetails;
  requerimento: number; // SUM(flip_draws.amount) onde source='bank_draw'
  gasto: number; // SUM(flip_draw_item_transactions.amount) onde kind in OUTFLOW_KINDS
  lucro: number; // requerimento - gasto
};

export default async function FinancasFlipsPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data: flipsRaw } = await supabase
    .from("flip_details")
    .select("*")
    .order("purchase_closed_at", { ascending: false, nullsFirst: false });

  const flips = (flipsRaw ?? []) as FlipDetails[];
  const flipIds = flips.map((f) => f.id);

  // Requerimento total por flip
  const requerimentoByFlip = new Map<string, number>();
  if (flipIds.length > 0) {
    const { data: drawsRaw } = await supabase
      .from("flip_draws")
      .select("flip_id,amount")
      .in("flip_id", flipIds)
      .eq("source", "bank_draw");
    for (const d of (drawsRaw ?? []) as { flip_id: string; amount: number }[]) {
      const cur = requerimentoByFlip.get(d.flip_id) ?? 0;
      requerimentoByFlip.set(d.flip_id, cur + Number(d.amount));
    }
  }

  // Gasto por flip (via join draws -> items -> transactions filtrando outflows)
  const gastoByFlip = new Map<string, number>();
  if (flipIds.length > 0) {
    const { data: drawsRaw } = await supabase
      .from("flip_draws")
      .select("id,flip_id")
      .in("flip_id", flipIds);
    const drawFlip = new Map<string, string>();
    for (const d of (drawsRaw ?? []) as { id: string; flip_id: string }[]) {
      drawFlip.set(d.id, d.flip_id);
    }
    const drawIds = Array.from(drawFlip.keys());
    if (drawIds.length > 0) {
      const { data: itemsRaw } = await supabase
        .from("flip_draw_items")
        .select("id,draw_id")
        .in("draw_id", drawIds);
      const itemFlip = new Map<string, string>();
      for (const it of (itemsRaw ?? []) as { id: string; draw_id: string }[]) {
        const fid = drawFlip.get(it.draw_id);
        if (fid) itemFlip.set(it.id, fid);
      }
      const itemIds = Array.from(itemFlip.keys());
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
          if (!OUTFLOW_KINDS.has(t.kind)) continue;
          const fid = itemFlip.get(t.draw_item_id);
          if (!fid) continue;
          const cur = gastoByFlip.get(fid) ?? 0;
          gastoByFlip.set(fid, cur + Number(t.amount));
        }
      }
    }
  }

  const rows: FlipFinanceRow[] = flips.map((f) => {
    const requerimento = requerimentoByFlip.get(f.id) ?? 0;
    const gasto = gastoByFlip.get(f.id) ?? 0;
    return { flip: f, requerimento, gasto, lucro: requerimento - gasto };
  });

  return (
    <>
      <DecorBackground />
      <div className="relative min-h-screen">
        <AppHeader userEmail={user.email ?? ""} />
        <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
          <FinancasFlipsView rows={rows} />
        </main>
      </div>
    </>
  );
}
