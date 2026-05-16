import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { JobDetail } from "@/components/jobs/job-detail";
import { requireUser } from "@/lib/auth";
import { getSignedReceiptUrls } from "@/lib/job-expenses";
import { getSignedExtraUrls } from "@/lib/job-extras";
import type { JobHoursWithMember, TeamMemberLite } from "@/lib/job-hours";
import { getSignedPhotoUrls } from "@/lib/job-photos";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  Job,
  JobExpense,
  JobExtra,
  JobPayment,
  JobPhaseHistoryRow,
  JobPhoto,
  Lead,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

export default async function JobDetailPage({ params }: Props) {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<Job>();

  if (error || !job) {
    notFound();
  }

  const [
    leadRes,
    historyRes,
    paymentsRes,
    photosRes,
    expensesRes,
    hoursRes,
    activeMembersRes,
    extrasRes,
  ] = await Promise.all([
    supabase.from("leads").select("*").eq("id", job.lead_id).maybeSingle<Lead>(),
    supabase
      .from("job_phase_history")
      .select("*")
      .eq("job_id", job.id)
      .order("started_at", { ascending: true }),
    supabase
      .from("job_payments")
      .select("*")
      .eq("job_id", job.id)
      .order("display_order", { ascending: true }),
    supabase
      .from("job_photos")
      .select("*")
      .eq("job_id", job.id)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("job_expenses")
      .select("*")
      .eq("job_id", job.id)
      .order("expense_date", { ascending: false }),
    supabase
      .from("job_hours")
      .select("*, member:team_members(id, name, role)")
      .eq("job_id", job.id)
      .order("work_date", { ascending: false }),
    supabase
      .from("team_members")
      .select("id, name, role, hourly_rate")
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("job_extras")
      .select("*")
      .eq("job_id", job.id)
      .order("proposed_at", { ascending: false }),
  ]);

  const lead = leadRes.data ?? null;
  const history = (historyRes.data ?? []) as JobPhaseHistoryRow[];
  const payments = (paymentsRes.data ?? []) as JobPayment[];
  const photos = (photosRes.data ?? []) as JobPhoto[];
  const expenses = (expensesRes.data ?? []) as JobExpense[];
  const hours = (hoursRes.data ?? []) as JobHoursWithMember[];
  const activeMembers = (activeMembersRes.data ?? []) as TeamMemberLite[];
  const extras = (extrasRes.data ?? []) as JobExtra[];

  // Signed URLs em batch (TTL 1h) — server-side pra primeira renderização
  const photoSignedUrls = await getSignedPhotoUrls({
    supabase,
    storagePaths: photos.map((p) => p.storage_path),
    expiresIn: 3600,
  });
  const receiptSignedUrls = await getSignedReceiptUrls({
    supabase,
    storagePaths: expenses
      .map((e) => e.receipt_path)
      .filter((p): p is string => p !== null),
    expiresIn: 3600,
  });
  // Extras podem ter ATÉ 2 anexos cada (approval + contract) — junta tudo
  const extraAttachmentPaths = extras.flatMap((e) =>
    [e.approval_attachment_path, e.contract_attachment_path].filter(
      (p): p is string => p !== null,
    ),
  );
  const extraSignedUrls = await getSignedExtraUrls({
    supabase,
    storagePaths: extraAttachmentPaths,
    expiresIn: 3600,
  });

  // Signed URL do contrato principal do job (se houver) — mesmo bucket job-extras
  const contractSignedUrl = job.contract_path
    ? ((
        await supabase.storage
          .from("job-extras")
          .createSignedUrl(job.contract_path, 3600)
      ).data?.signedUrl ?? null)
    : null;

  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader userEmail={user.email ?? ""} showNewLead={false} title="Job" />
      <JobDetail
        job={job}
        lead={lead}
        history={history}
        payments={payments}
        photos={photos}
        photoSignedUrls={photoSignedUrls}
        expenses={expenses}
        receiptSignedUrls={receiptSignedUrls}
        hours={hours}
        activeMembers={activeMembers}
        extras={extras}
        contractSignedUrl={contractSignedUrl}
        extraSignedUrls={extraSignedUrls}
        userEmail={user.email ?? ""}
      />
    </main>
  );
}
