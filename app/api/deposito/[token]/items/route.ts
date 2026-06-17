/**
 * GET /api/deposito/[token]/items
 *
 * Retorna lista atualizada de items pro warehouse-view fazer reload
 * após uma movimentação. Valida token via service_role.
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: share } = await supabase
    .from("store_share")
    .select("token")
    .single();

  if (!share || share.token !== token) {
    return NextResponse.json({ error: "Token expirado" }, { status: 401 });
  }

  const { data: items } = await supabase
    .from("v_store_items_stats")
    .select("*")
    .order("name", { ascending: true });

  return NextResponse.json({ items: items ?? [] });
}
