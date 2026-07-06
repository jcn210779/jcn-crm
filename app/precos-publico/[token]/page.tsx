/**
 * Página pública read-only da tabela de preços de sub.
 * Auth via token opaco (uuid) na URL. Sem login.
 * Padrão idêntico a /deposito/[token] e /projeto/[token].
 */

import { notFound } from "next/navigation";

import { PrecosPublicView } from "@/components/precos/precos-public-view";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { SubPriceCatalog } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = {
  title: "Preços JCN",
};

export default async function PrecosPublicoPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  if (!UUID_RE.test(token)) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: share } = await supabase
    .from("sub_price_catalog_share")
    .select("token")
    .single();

  if (!share || share.token !== token) notFound();

  // Marca last_used_at (best-effort, não bloqueia)
  await supabase
    .from("sub_price_catalog_share")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", true);

  const { data } = await supabase
    .from("sub_price_catalog")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("display_order")
    .order("service_name");

  const items = (data ?? []) as SubPriceCatalog[];

  return (
    <main className="min-h-screen bg-jcn-midnight text-jcn-ice">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            Tabela de preços JCN
          </h1>
          <p className="mt-1 text-xs text-jcn-ice/55">
            Referência interna de preço justo por serviço · read-only
          </p>
        </header>
        <PrecosPublicView items={items} />
      </div>
    </main>
  );
}
