/**
 * Página pública do depósito pro "menino do depósito" (sem auth).
 * URL: /deposito/<token-uuid>
 *
 * Permissões: ver + ajustar quantidade (entrada/saída com job obrigatório).
 * NÃO pode: criar, editar nome, apagar items.
 *
 * Token único, regenerável pelo José no /store. Sem login.
 */

import Image from "next/image";

import { WarehouseView } from "@/components/store/warehouse-view";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { StoreItemStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Depósito JCN",
  robots: { index: false, follow: false },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JobOption = { id: string; label: string };

export default async function DepositoPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  if (!UUID_RE.test(token)) return <NotFound />;

  const supabase = createSupabaseAdminClient();

  // Valida token
  const { data: share } = await supabase
    .from("store_share")
    .select("token")
    .single();

  if (!share || share.token !== token) {
    return <NotFound />;
  }

  // Marca last_used_at (analytics simples)
  await supabase
    .from("store_share")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", true);

  // Items
  const { data: itemsRaw } = await supabase
    .from("v_store_items_stats")
    .select("*")
    .order("name", { ascending: true });

  const items = (itemsRaw ?? []) as StoreItemStats[];

  // Jobs ativos pra dropdown
  const { data: jobsRaw } = await supabase
    .from("jobs")
    .select("id, lead:leads(name)")
    .neq("current_phase", "completed");

  type JobRow = { id: string; lead?: { name?: string } | null };
  const jobs: JobOption[] = ((jobsRaw ?? []) as unknown as JobRow[]).map(
    (j) => ({
      id: j.id,
      label: j.lead?.name ?? "Job sem nome",
    }),
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-jcn-midnight text-jcn-ice">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(166,130,64,0.14),_transparent_60%)]"
      />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <div className="mb-5 flex items-center justify-center">
          <Image
            src="/brand/jcn-logo-gold.png"
            alt="JCN Construction"
            width={140}
            height={42}
            className="h-auto w-32 object-contain"
            priority
          />
        </div>

        <WarehouseView token={token} initialItems={items} jobs={jobs} />

        <footer className="mt-10 pb-4 text-center text-[11px] text-white/35">
          JCN Construction — Depósito interno · Acesso por link
        </footer>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-jcn-midnight text-jcn-ice">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-black text-white">Link inválido</h1>
        <p className="mt-2 text-sm text-white/65">
          Este link expirou ou foi regenerado. Peça um link novo pro José.
        </p>
      </div>
    </main>
  );
}
