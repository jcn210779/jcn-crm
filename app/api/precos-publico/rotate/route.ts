/**
 * POST /api/precos-publico/rotate — owner-only.
 * Regenera token do sub_price_catalog_share.
 */

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST() {
  await requireUser();
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("sub_price_catalog_share")
    .update({
      token: crypto.randomUUID(),
      rotated_at: new Date().toISOString(),
      last_used_at: null,
    })
    .eq("id", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
