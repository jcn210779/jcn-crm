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
 * Idempotência: cron verifica se já existe follow_up do mesmo kind pro mesmo
 * lead/job pra não criar duplicado.
 *
 * Auth: token no header `Authorization: Bearer ${CRON_SECRET}` (Vercel padrão).
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  generateTemplate,
  type TemplateInput,
} from "@/lib/follow-up-templates";
import type {
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
  | "city"
  | "service_interest"
  | "stage"
  | "created_at"
>;

type JobRow = {
  id: string;
  current_phase: string;
  updated_at: string;
  lead: Pick<Lead, "id" | "name" | "email"> | null;
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
  // Auth via Vercel cron (Bearer token)
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  let created = 0;
  let skipped = 0;

  // ============================================================
  // 1) NEW LEAD 4H — leads stage='novo' criados há +4h, sem visit_scheduled
  // ============================================================
  const { data: newLeads } = await supabase
    .from("leads")
    .select("id, name, email, city, service_interest, stage, created_at")
    .eq("stage", "novo")
    .is("visit_scheduled_at", null);

  for (const lead of ((newLeads ?? []) as LeadRow[])) {
    if (!lead.email) continue;
    if (hoursBetween(lead.created_at) < 4) continue;

    const exists = await checkExistingFollowUp(
      supabase,
      lead.id,
      null,
      "new_lead_4h",
    );
    if (exists) {
      skipped++;
      continue;
    }

    const { subject, body } = generateTemplate("new_lead_4h", {
      name: lead.name,
      service: SERVICE_LABEL[lead.service_interest],
      city: lead.city,
    });

    await supabase.from("follow_ups").insert({
      lead_id: lead.id,
      job_id: null,
      kind: "new_lead_4h",
      draft_subject: subject,
      draft_body: body,
      to_email: lead.email,
      to_name: lead.name,
    } satisfies FollowUpInsert);
    created++;
  }

  // ============================================================
  // 2-4) ESTIMATE SENT — 3d, 7d, 14d
  // ============================================================
  const { data: estimateLeads } = await supabase
    .from("leads")
    .select("id, name, email, city, service_interest, stage, updated_at, created_at")
    .eq("stage", "estimate_enviado");

  const ESTIMATE_TRIGGERS: Array<{ kind: FollowUpKind; days: number }> = [
    { kind: "estimate_sent_3d", days: 3 },
    { kind: "estimate_sent_7d", days: 7 },
    { kind: "estimate_sent_14d", days: 14 },
  ];

  for (const lead of ((estimateLeads ?? []) as Array<
    LeadRow & { updated_at: string }
  >)) {
    if (!lead.email) continue;
    const daysSinceUpdate = daysBetween(lead.updated_at);

    for (const trigger of ESTIMATE_TRIGGERS) {
      if (daysSinceUpdate < trigger.days) continue;
      // Verifica se este kind já foi criado pra esse lead
      const exists = await checkExistingFollowUp(
        supabase,
        lead.id,
        null,
        trigger.kind,
      );
      if (exists) {
        skipped++;
        continue;
      }

      const { subject, body } = generateTemplate(trigger.kind, {
        name: lead.name,
        service: SERVICE_LABEL[lead.service_interest],
        daysSince: daysSinceUpdate,
      } satisfies TemplateInput);

      await supabase.from("follow_ups").insert({
        lead_id: lead.id,
        job_id: null,
        kind: trigger.kind,
        draft_subject: subject,
        draft_body: body,
        to_email: lead.email,
        to_name: lead.name,
      } satisfies FollowUpInsert);
      created++;
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
        "id, current_phase, updated_at, lead:leads(id, name, email)",
      )
      .in("id", Array.from(recentJobIds));

    for (const job of ((jobs ?? []) as unknown as JobRow[])) {
      if (!job.lead?.email) continue;

      const exists = await checkExistingFollowUpJobPhase(supabase, job.id);
      if (exists) {
        skipped++;
        continue;
      }

      const { subject, body } = generateTemplate("job_phase_changed", {
        name: job.lead.name,
        jobPhase: PHASE_LABEL[job.current_phase] ?? job.current_phase,
      });

      await supabase.from("follow_ups").insert({
        lead_id: null,
        job_id: job.id,
        kind: "job_phase_changed",
        draft_subject: subject,
        draft_body: body,
        to_email: job.lead.email,
        to_name: job.lead.name,
        notes: `Phase: ${job.current_phase}`,
      } satisfies FollowUpInsert);
      created++;
    }
  }

  return NextResponse.json({ ok: true, created, skipped });
}

async function checkExistingFollowUp(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  leadId: string | null,
  jobId: string | null,
  kind: FollowUpKind,
): Promise<boolean> {
  let query = supabase.from("follow_ups").select("id").eq("kind", kind);
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
  // (independente do phase específico). Evita spam quando phase muda 2x em 1 dia.
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
