import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { NewFlipButton } from "@/components/flips/new-flip-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FlipPnL } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Flips — CRM JCN",
};

type FlipRow = {
  job_id: string;
  flip_id: string;
  property_address: string | null;
  property_city: string | null;
  arv_total: number;
  profit_projected: number;
  units_count: number;
  units_sold: number;
};

export default async function FlipsPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  // Pega todos os flips com P&L agregado
  const { data: pnlRows } = await supabase
    .from("v_flip_pnl")
    .select("*");

  const { data: details } = await supabase
    .from("flip_details")
    .select(
      "id, job_id, property_address, property_city, property_state",
    );

  const pnlByJob = new Map<string, FlipPnL>();
  for (const p of (pnlRows ?? []) as FlipPnL[]) {
    pnlByJob.set(p.job_id, p);
  }

  const rows: FlipRow[] = (details ?? []).map((d) => {
    const p = pnlByJob.get(d.job_id);
    return {
      job_id: d.job_id,
      flip_id: d.id,
      property_address: d.property_address,
      property_city: d.property_city,
      arv_total: Number(p?.arv_total ?? 0),
      profit_projected: Number(p?.profit_projected ?? 0),
      units_count: Number(p?.units_count ?? 0),
      units_sold: Number(p?.units_sold ?? 0),
    };
  });

  return (
    <main className="relative min-h-screen pb-24">
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Flips"
      />

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-jcn-ice md:text-3xl">
              Flips
            </h1>
            <p className="mt-1 text-sm text-jcn-ice/55">
              Investimentos próprios (compra → reforma → revenda).{" "}
              {rows.length === 0
                ? "Comece criando seu primeiro flip."
                : `${rows.length} flip${rows.length === 1 ? "" : "s"} ativo${rows.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <NewFlipButton />
        </div>

        {rows.length === 0 ? (
          <Card className="border-white/[0.06] bg-white/[0.025] p-10 text-center backdrop-blur-xl">
            <h2 className="text-lg font-bold text-jcn-ice">
              Nenhum flip cadastrado ainda
            </h2>
            <p className="mt-2 text-sm text-jcn-ice/55">
              Clique em &ldquo;Novo Flip&rdquo; pra cadastrar o primeiro
              (Flip 001 — Somerville).
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rows.map((r) => (
              <Link
                key={r.flip_id}
                href={`/job/${r.job_id}`}
                className="block rounded-3xl border border-jcn-gold-400/30 bg-gradient-to-br from-jcn-gold-500/[0.08] to-white/[0.02] p-5 backdrop-blur-xl transition hover:border-jcn-gold-400/60 hover:from-jcn-gold-500/[0.12]"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant="outline"
                    className="border-jcn-gold-400/40 bg-jcn-gold-500/15 text-[10px] font-bold tracking-[0.15em] text-jcn-gold-300"
                  >
                    FLIP
                  </Badge>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-jcn-ice/45">
                    {r.units_sold}/{r.units_count} unidades vendidas
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-black text-jcn-ice">
                  {r.property_address ?? "Endereço não preenchido"}
                </h3>
                <p className="text-xs text-jcn-ice/55">
                  {r.property_city ?? "—"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/45">
                      ARV total
                    </p>
                    <p className="text-base font-black text-jcn-ice">
                      {formatCurrency(r.arv_total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-ice/45">
                      Lucro projetado
                    </p>
                    <p
                      className={`text-base font-black ${
                        r.profit_projected >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {formatCurrency(r.profit_projected)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
