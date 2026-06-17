/**
 * POST /api/deposito/[token]/movement
 *
 * Endpoint público usado pela página /deposito/[token] (menino do depósito).
 * Valida token e cria store_movement via service_role (bypass RLS).
 *
 * Permissões aceitas:
 *   - kind: 'in' (com job opcional) | 'out' (com job OBRIGATÓRIO)
 *   - NÃO aceita 'adjustment' (só José faz isso pelo /store interno)
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  item_id: string;
  kind: "in" | "out";
  quantity: number;
  job_id: string | null;
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

  // Valida token
  const { data: share } = await supabase
    .from("store_share")
    .select("token")
    .single();

  if (!share || share.token !== token) {
    return NextResponse.json({ error: "Token expirado ou inválido" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.item_id || !UUID_RE.test(body.item_id)) {
    return NextResponse.json({ error: "item_id inválido" }, { status: 400 });
  }
  if (body.kind !== "in" && body.kind !== "out") {
    return NextResponse.json({ error: "kind deve ser 'in' ou 'out'" }, { status: 400 });
  }
  if (!body.quantity || body.quantity <= 0) {
    return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
  }
  if (body.kind === "out" && !body.job_id) {
    return NextResponse.json(
      { error: "Toda saída precisa indicar a obra (job)" },
      { status: 400 },
    );
  }
  if (body.job_id && !UUID_RE.test(body.job_id)) {
    return NextResponse.json({ error: "job_id inválido" }, { status: 400 });
  }

  // Valida que tem estoque suficiente pra saída
  if (body.kind === "out") {
    const { data: item } = await supabase
      .from("store_items")
      .select("quantity, name")
      .eq("id", body.item_id)
      .single();
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    if (Number(item.quantity) < body.quantity) {
      return NextResponse.json(
        {
          error: `Estoque insuficiente. Tem ${item.quantity}, pedido ${body.quantity}`,
        },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase.from("store_movements").insert({
    item_id: body.item_id,
    kind: body.kind,
    quantity: body.quantity,
    job_id: body.job_id,
    notes: body.notes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Marca uso do token
  await supabase
    .from("store_share")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", true);

  return NextResponse.json({ ok: true });
}
