/**
 * POST /api/send-sms
 *
 * Envia um follow-up via Twilio Messaging API. O cliente passa follow_up_id +
 * body + to_phone. O backend:
 * 1. Carrega o follow_up do banco
 * 2. Valida que está pending e channel=sms
 * 3. Chama Twilio REST API direto (sem SDK pra não inflar bundle)
 * 4. Atualiza status='sent' + twilio_message_sid + sent_at
 *    OU status='failed' + error_message se falhou
 *
 * Auth: RLS owner-only por email já protege. Server route só executa
 *       se o usuário logado for o owner.
 *
 * Twilio config esperado no Vercel env:
 *   - TWILIO_ACCOUNT_SID (ACxxxxxxxxxxxxxxxxxxx)
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_MESSAGING_SERVICE_SID (MGxxxxxxxxxxxxx — preferido pra A2P 10DLC)
 *     OU TWILIO_FROM_NUMBER (+15551234567)
 */

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type Body = {
  follow_up_id: string;
  body: string;
  to_phone: string;
};

/** Normaliza telefone pra formato E.164 (+1XXXXXXXXXX). */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export async function POST(req: Request) {
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

  const { follow_up_id, body, to_phone } = payload;
  if (!follow_up_id || !body?.trim() || !to_phone?.trim()) {
    return NextResponse.json(
      { error: "Campos obrigatórios faltando (follow_up_id, body, to_phone)" },
      { status: 400 },
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      {
        error:
          "Twilio não configurado. Falta TWILIO_ACCOUNT_SID e/ou TWILIO_AUTH_TOKEN no Vercel.",
      },
      { status: 500 },
    );
  }

  if (!messagingServiceSid && !fromNumber) {
    return NextResponse.json(
      {
        error:
          "Twilio sem remetente. Configure TWILIO_MESSAGING_SERVICE_SID (preferido) ou TWILIO_FROM_NUMBER no Vercel.",
      },
      { status: 500 },
    );
  }

  const e164 = normalizePhone(to_phone);
  if (!e164) {
    return NextResponse.json(
      { error: `Telefone inválido: "${to_phone}". Esperado 10 dígitos ou +1XXXXXXXXXX.` },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();

  // Validar status atual
  const { data: fu, error: fetchError } = await supabase
    .from("follow_ups")
    .select("id, status, channel")
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

  if (fu.channel !== "sms") {
    return NextResponse.json(
      { error: `Follow-up é channel=${fu.channel}, não SMS. Use /api/send-email.` },
      { status: 400 },
    );
  }

  // Chamar Twilio REST API
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.set("To", e164);
  params.set("Body", body.trim());
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    params.set("From", fromNumber);
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await twilioRes.json()) as {
      sid?: string;
      status?: string;
      message?: string;
      code?: number;
    };

    if (!twilioRes.ok || !data.sid) {
      const errMsg = data.message ?? `Twilio retornou ${twilioRes.status}`;
      await supabase
        .from("follow_ups")
        .update({
          status: "failed",
          error_message: `[Twilio ${data.code ?? twilioRes.status}] ${errMsg}`,
        })
        .eq("id", follow_up_id);

      return NextResponse.json(
        { error: errMsg, code: data.code },
        { status: twilioRes.status },
      );
    }

    // Marcar como sent
    const { error: updError } = await supabase
      .from("follow_ups")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        twilio_message_sid: data.sid,
        to_phone: e164,
        draft_body: body.trim(),
      })
      .eq("id", follow_up_id);

    if (updError) {
      console.error("SMS enviado mas falha ao atualizar BD:", updError);
    }

    return NextResponse.json({ ok: true, message_sid: data.sid, status: data.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("follow_ups")
      .update({ status: "failed", error_message: msg })
      .eq("id", follow_up_id);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
