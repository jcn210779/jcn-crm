/**
 * POST /api/confirm/[token]
 *
 * Endpoint PÚBLICO (sem login) usado pela página /confirmar/<token>. O cliente
 * final confirma presença na visita ou pede pra remarcar. Como a base é RLS
 * owner-only, este handler usa service_role e identifica o lead SÓ pelo token
 * opaco — nenhum outro lead é tocado nem exposto.
 *
 * Body: { action: "confirm" | "reschedule" }
 *
 * Response 200: { ok: true, visit_confirmed_at, reschedule_requested_at }
 * Response 400: body/token inválido
 * Response 404: token não encontrado
 * Response 500: erro interno (sem vazar detalhe)
 *
 * SEGURANÇA: o token é a única credencial. Retorna apenas o novo estado dos
 * dois timestamps — nunca name, phone, endereço, ou qualquer dado do lead.
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// uuid v4 (formato do confirm_token). Valida antes de ir ao banco.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Action = "confirm" | "reschedule";

export async function POST(
  req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  if (action !== "confirm" && action !== "reschedule") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Confirma que o token existe ANTES de escrever (pra responder 404 limpo).
    const { data: existing, error: lookupErr } = await supabase
      .from("leads")
      .select("id")
      .eq("confirm_token", token)
      .maybeSingle<{ id: string }>();

    if (lookupErr) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const patch =
      action === "confirm"
        ? { visit_confirmed_at: now, updated_at: now }
        : { reschedule_requested_at: now, updated_at: now };

    const { data: updated, error: updateErr } = await supabase
      .from("leads")
      .update(patch)
      .eq("confirm_token", token)
      .select("visit_confirmed_at, reschedule_requested_at")
      .maybeSingle<{
        visit_confirmed_at: string | null;
        reschedule_requested_at: string | null;
      }>();

    if (updateErr || !updated) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      visit_confirmed_at: updated.visit_confirmed_at,
      reschedule_requested_at: updated.reschedule_requested_at,
    });
  } catch {
    // Nunca vaza stack/detalhe interno pro cliente.
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
