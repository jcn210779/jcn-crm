/**
 * POST /api/send-email
 *
 * Envia um follow-up via Resend. O cliente passa `follow_up_id` + subject + body
 * (que pode ter sido editado em relação ao draft original). O backend:
 * 1. Carrega o follow_up do banco
 * 2. Valida que está pending
 * 3. Chama Resend.emails.send()
 * 4. Atualiza status='sent' + resend_email_id + sent_at
 *    OU status='failed' + error_message se falhou
 *
 * Auth: RLS owner-only por email já protege. Server route só executa
 *       se o usuário logado for o owner.
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";

import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const FROM = "JCN Construction <info@jcnconstructioninc.com>";

type Body = {
  follow_up_id: string;
  subject: string;
  body: string;
  to_email: string;
};

export async function POST(req: Request) {
  // Auth: garante que é o José
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { follow_up_id, subject, body, to_email } = payload;
  if (!follow_up_id || !subject?.trim() || !body?.trim() || !to_email?.trim()) {
    return NextResponse.json(
      { error: "Campos obrigatórios faltando" },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY não configurada no Vercel" },
      { status: 500 },
    );
  }

  const supabase = createSupabaseServerClient();

  // Buscar pra validar status
  const { data: fu, error: fetchError } = await supabase
    .from("follow_ups")
    .select("id, status")
    .eq("id", follow_up_id)
    .single();

  if (fetchError || !fu) {
    return NextResponse.json(
      { error: "Follow-up não encontrado" },
      { status: 404 },
    );
  }

  if (fu.status !== "pending") {
    return NextResponse.json(
      { error: `Follow-up já está com status ${fu.status}` },
      { status: 409 },
    );
  }

  // Enviar via Resend
  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({
      from: FROM,
      to: [to_email.trim()],
      subject: subject.trim(),
      text: body.trim(),
    });

    if (result.error || !result.data?.id) {
      // Marcar como failed
      await supabase
        .from("follow_ups")
        .update({
          status: "failed",
          error_message: result.error?.message ?? "Sem ID retornado pela Resend",
        })
        .eq("id", follow_up_id);

      return NextResponse.json(
        { error: result.error?.message ?? "Falha desconhecida" },
        { status: 500 },
      );
    }

    // Marcar como sent
    const { error: updError } = await supabase
      .from("follow_ups")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_email_id: result.data.id,
        draft_subject: subject.trim(),
        draft_body: body.trim(),
      })
      .eq("id", follow_up_id);

    if (updError) {
      // Email já saiu, mas registro falhou. Loga e retorna sucesso.
      console.error("Email enviado mas falha ao atualizar BD:", updError);
    }

    return NextResponse.json({ ok: true, email_id: result.data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("follow_ups")
      .update({ status: "failed", error_message: msg })
      .eq("id", follow_up_id);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
