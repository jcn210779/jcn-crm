/**
 * GET /api/cron/follow-ups
 *
 * Endpoint chamado pelo Vercel Cron 1x/dia às 9am ET.
 * Escaneia leads/jobs e cria drafts em follow_ups baseado em 5 gatilhos:
 *
 * 1. new_lead_4h          — lead stage='novo' criado +4h atrás
 * 2. estimate_sent_3d     — lead stage='estimate_enviado' faz 3 dias
 * 3. estimate_sent_7d     — idem mas 7 dias
 * 4. estimate_sent_14d    — idem mas 14 dias (última tentativa)
 * 5. job_phase_changed    — job mudou phase nas últimas 24h
 *
 * Canais: pra cada gatilho qualificado, cria draft de EMAIL (se lead tem email)
 *         E/OU SMS (se lead tem phone). Idempotência por (lead_id, kind, channel).
 *
 * Auth: token no header `Authorization: Bearer ${CRON_SECRET}` (Vercel padrão).
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  generateSmsTemplate,
  generateTemplate,
  type TemplateInput,
} from "@/lib/follow-up-templates";
import type {
  FollowUpChannel,
  FollowUpInsert,
  FollowUpKind,
  Lead,
  ServiceType,
} from "@/lib/types";

type LeadRow = Pick<
  Lead,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "city"
  | "service_interest"
  | "stage"
  | "created_at"
>;

type JobRow = {
  id: string;
  current_phase: string;
  updated_at: string;
  lead: Pick<Lead, "id" | "name" | "email" | "phone"> | null;
};

const SERVICE_LABEL: Record<ServiceType, string> = {
  deck: "deck",
  siding: "siding",
  patio: "patio",
  multiple: "project",
  other: "project",
};

const PHASE_LABEL: Record<string, string> = {
  planning: "planning",
  permit_released: "permit released",
  materials_ordered: "materials ordered",
  materials_delivered: "materials delivered",
  work_in_progress: "work in progress",
  completed: "completed",
};

function daysBetween(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function hoursBetween(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60));
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  let created = 0;
  let skipped = 0;

  // Helper: cria drafts (email + sms) pra um lead se aplicável
  async function createForLead(
    lead: LeadRow,
    kind: FollowUpKind,
    extras: Partial<TemplateInput> = {},
  ) {
    const input: TemplateInput = {
      name: lead.name,
      service: SERVICE_LABEL[lead.service_interest],
      city: lead.city ?? undefined,
      ...extras,
    };

    // EMAIL
    if (lead.email) {
      const existsE = await checkExistingFollowUp(
        supabase,
        lead.id,
        null,
        kind,
        "email",
      );
      if (existsE) {
        skipped++;
      } else {
        const { subject, body } = generateTemplate(kind, input);
        await supabase.from("follow_ups").insert({
          lead_id: lead.id,
          job_id: null,
          kind,
          channel: "email",
          draft_subject: subject,
          draft_body: body,
          to_email: lead.email,
          to_phone: null,
          to_name: lead.name,
        } satisfies FollowUpInsert);
        created++;
      }
    }

    // SMS
    if (lead.phone) {
      const existsS = await checkExistingFollowUp(
        supabase,
        lead.id,
        null,
        kind,
        "sms",
      );
      if (existsS) {
        skipped++;
      } else {
        const smsBody = generateSmsTemplate(kind, input);
        await supabase.from("follow_ups").insert({
          lead_id: lead.id,
          job_id: null,
          kind,
          channel: "sms",
          draft_subject: smsBody.slice(0, 80), // preview
          draft_body: smsBody,
          to_email: null,
          to_phone: lead.phone,
          to_name: lead.name,
        } satisfies FollowUpInsert);
        created++;
      }
    }
  }

  // ============================================================
  // 1) NEW LEAD 4H
  // ============================================================
  const { data: newLeads } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, city, service_interest, stage, created_at",
    )
    .eq("stage", "novo")
    .is("visit_scheduled_at", null);

  for (const lead of ((newLeads ?? []) as LeadRow[])) {
    if (hoursBetween(lead.created_at) < 4) continue;
    await createForLead(lead, "new_lead_4h");
  }

  // ============================================================
  // 2-4) ESTIMATE SENT
  // ============================================================
  const { data: estimateLeads } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, city, service_interest, stage, updated_at, created_at",
    )
    .eq("stage", "estimate_enviado");

  const ESTIMATE_TRIGGERS: Array<{ kind: FollowUpKind; days: number }> = [
    { kind: "estimate_sent_3d", days: 3 },
    { kind: "estimate_sent_7d", days: 7 },
    { kind: "estimate_sent_14d", days: 14 },
  ];

  for (const lead of ((estimateLeads ?? []) as Array<
    LeadRow & { updated_at: string }
  >)) {
    const daysSinceUpdate = daysBetween(lead.updated_at);
    for (const trigger of ESTIMATE_TRIGGERS) {
      if (daysSinceUpdate < trigger.days) continue;
      await createForLead(lead, trigger.kind, { daysSince: daysSinceUpdate });
    }
  }

  // ============================================================
  // 5) JOB PHASE CHANGED — últimas 24h
  // ============================================================
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: phaseHistory } = await supabase
    .from("job_phase_history")
    .select("id, job_id, phase, started_at")
    .gte("started_at", since24h);

  const recentJobIds = new Set<string>(
    (phaseHistory ?? []).map((h) => (h as { job_id: string }).job_id),
  );

  if (recentJobIds.size > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select(
        "id, current_phase, updated_at, lead:leads(id, name, email, phone)",
      )
      .in("id", Array.from(recentJobIds));

    for (const job of ((jobs ?? []) as unknown as JobRow[])) {
      if (!job.lead) continue;
      const exists = await checkExistingFollowUpJobPhase(supabase, job.id);
      if (exists) {
        skipped++;
        continue;
      }

      const input: TemplateInput = {
        name: job.lead.name,
        jobPhase: PHASE_LABEL[job.current_phase] ?? job.current_phase,
      };

      if (job.lead.email) {
        const { subject, body } = generateTemplate("job_phase_changed", input);
        await supabase.from("follow_ups").insert({
          lead_id: null,
          job_id: job.id,
          kind: "job_phase_changed",
          channel: "email",
          draft_subject: subject,
          draft_body: body,
          to_email: job.lead.email,
          to_phone: null,
          to_name: job.lead.name,
          notes: `Phase: ${job.current_phase}`,
        } satisfies FollowUpInsert);
        created++;
      }
      if (job.lead.phone) {
        const smsBody = generateSmsTemplate("job_phase_changed", input);
        await supabase.from("follow_ups").insert({
          lead_id: null,
          job_id: job.id,
          kind: "job_phase_changed",
          channel: "sms",
          draft_subject: smsBody.slice(0, 80),
          draft_body: smsBody,
          to_email: null,
          to_phone: job.lead.phone,
          to_name: job.lead.name,
          notes: `Phase: ${job.current_phase}`,
        } satisfies FollowUpInsert);
        created++;
      }
    }
  }

  return NextResponse.json({ ok: true, created, skipped });
}

async function checkExistingFollowUp(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  leadId: string | null,
  jobId: string | null,
  kind: FollowUpKind,
  channel: FollowUpChannel,
): Promise<boolean> {
  let query = supabase
    .from("follow_ups")
    .select("id")
    .eq("kind", kind)
    .eq("channel", channel);
  if (leadId) query = query.eq("lead_id", leadId);
  if (jobId) query = query.eq("job_id", jobId);
  const { data } = await query.limit(1).maybeSingle();
  return !!data;
}

async function checkExistingFollowUpJobPhase(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
): Promise<boolean> {
  // Pra phase_changed, considera "já existe" se tem follow_up criado nas últimas 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("follow_ups")
    .select("id")
    .eq("job_id", jobId)
    .eq("kind", "job_phase_changed")
    .gte("created_at", since24h)
    .limit(1)
    .maybeSingle();
  return !!data;
}
