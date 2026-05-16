import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { JobDetail } from "@/components/jobs/job-detail";
import { requireUser } from "@/lib/auth";
import { getSignedPhotoUrls } from "@/lib/job-photos";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  Job,
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

  const [leadRes, historyRes, paymentsRes, photosRes] = await Promise.all([
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
  ]);

  const lead = leadRes.data ?? null;
  const history = (historyRes.data ?? []) as JobPhaseHistoryRow[];
  const payments = (paymentsRes.data ?? []) as JobPayment[];
  const photos = (photosRes.data ?? []) as JobPhoto[];

  // Signed URLs em batch (TTL 1h) — server-side pra primeira renderização
  const photoSignedUrls = await getSignedPhotoUrls({
    supabase,
    storagePaths: photos.map((p) => p.storage_path),
    expiresIn: 3600,
  });

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
        userEmail={user.email ?? ""}
      />
    </main>
  );
}
