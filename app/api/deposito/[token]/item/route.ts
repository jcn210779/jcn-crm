/**
 * POST /api/deposito/[token]/item
 *
 * Permite o menino do depósito CRIAR item novo via link público.
 * Valida token. Cria item com qty=0 e (opcionalmente) já lança movimento
 * 'in' com a qty inicial pra registrar entrada no histórico.
 *
 * Campos críticos (min_quantity, location) ficam pro José completar
 * depois pelo /store interno.
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  name: string;
  category: string | null;
  unit: string | null;
  initial_quantity: number;
  notes: string | null;
};

export async function POST(
  req: Request,
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  if (body.initial_quantity < 0) {
    return NextResponse.json({ error: "Qtd inválida" }, { status: 400 });
  }

  // 1) Cria item com qty=0
  const { data: created, error: createError } = await supabase
    .from("store_items")
    .insert({
      name: body.name.trim(),
      category: body.category?.trim() || null,
      unit: body.unit?.trim() || null,
      quantity: 0,
      notes: body.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return NextResponse.json(
      { error: createError?.message ?? "Falha ao criar" },
      { status: 500 },
    );
  }

  // 2) Lança movimento 'in' com qty inicial (trigger atualiza item.quantity)
  if (body.initial_quantity > 0) {
    await supabase.from("store_movements").insert({
      item_id: created.id,
      kind: "in",
      quantity: body.initial_quantity,
      notes: "Cadastro inicial",
    });
  }

  await supabase
    .from("store_share")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", true);

  return NextResponse.json({ ok: true, item_id: created.id });
}
