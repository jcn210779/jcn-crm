/**
 * POST /api/deposito/rotate
 *
 * Regenera o token de compartilhamento do depósito. Quem chama precisa
 * estar logado (José). Token novo é gerado via DEFAULT gen_random_uuid().
 */

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function POST() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("store_share")
    .update({
      token: crypto.randomUUID(),
      rotated_at: new Date().toISOString(),
      last_used_at: null,
    })
    .eq("id", true)
    .select("token, rotated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token: data?.token, rotated_at: data?.rotated_at });
}
