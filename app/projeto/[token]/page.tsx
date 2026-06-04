/**
 * Página pública do projeto pro cliente — /projeto/<token>
 *
 * Cliente recebe link via SMS/WhatsApp/email e abre.
 * Token opaco UUID em jobs.client_token é a única proteção (sem auth).
 *
 * MOSTRA: timeline visual + journal + galeria de fotos + pagamentos + contato.
 * NÃO MOSTRA: margem, despesas, custos internos, subs, P&L, notas internas.
 *
 * Mobile-first. Inglês (cliente final US).
 * Paleta JCN: jcn-midnight + jcn-gold + jcn-ice (igual /confirmar/[token]).
 */

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CloudRain,
  Eye,
  Globe,
  HardHat,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sun,
  User,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type {
  DailyLogType,
  JobPhase,
  JobPermitStatus,
  ServiceType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your project — JCN Construction",
  robots: { index: false, follow: false },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Permit deixou de ser fase (migration 0040) — virou card separado.
const PHASE_ORDER: JobPhase[] = [
  "planning",
  "materials_ordered",
  "materials_delivered",
  "work_in_progress",
  "completed",
];

const PHASE_LABEL_EN: Record<JobPhase, string> = {
  planning: "Planning",
  permit_released: "Permit released (legacy)", // não aparece na timeline nova
  materials_ordered: "Materials ordered",
  materials_delivered: "Materials delivered",
  work_in_progress: "Work in progress",
  completed: "Completed",
};

const SERVICE_LABEL_EN: Record<ServiceType, string> = {
  deck: "Deck",
  siding: "Siding",
  patio: "Stone Patio",
  multiple: "Multiple Services",
  other: "Project",
};

const LOG_TYPE_LABEL_EN: Record<DailyLogType, string> = {
  progress: "Progress",
  problem: "Issue",
  blocker: "Blocker",
  observation: "Note",
  inspection: "Inspection",
  client_visit: "Your visit",
};

function logTypeIcon(t: DailyLogType) {
  switch (t) {
    case "progress":
      return {
        Icon: HardHat,
        color: "text-emerald-300",
        bg: "bg-emerald-500/15",
        border: "border-emerald-400/30",
      };
    case "problem":
      return {
        Icon: AlertTriangle,
        color: "text-amber-300",
        bg: "bg-amber-500/15",
        border: "border-amber-400/30",
      };
    case "blocker":
      return {
        Icon: AlertTriangle,
        color: "text-rose-300",
        bg: "bg-rose-500/15",
        border: "border-rose-400/30",
      };
    case "observation":
      return {
        Icon: Eye,
        color: "text-white/65",
        bg: "bg-white/[0.06]",
        border: "border-white/[0.08]",
      };
    case "inspection":
      return {
        Icon: CheckCircle2,
        color: "text-sky-300",
        bg: "bg-sky-500/15",
        border: "border-sky-400/30",
      };
    case "client_visit":
      return {
        Icon: User,
        color: "text-jcn-gold-300",
        bg: "bg-jcn-gold-500/15",
        border: "border-jcn-gold-400/30",
      };
    default:
      return {
        Icon: Circle,
        color: "text-white/55",
        bg: "bg-white/[0.04]",
        border: "border-white/[0.08]",
      };
  }
}

const PHONE = "+1 857-237-5602";
const EMAIL = "info@jcnconstructioninc.com";
const WEBSITE = "https://jcnconstructioninc.com";

type JobData = {
  id: string;
  value: number;
  current_phase: JobPhase;
  expected_start: string | null;
  expected_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  permit_status: JobPermitStatus;
  permit_released_at: string | null;
  lead: {
    name: string;
    address: string | null;
    city: string;
    state: string | null;
    service_interest: ServiceType;
  } | null;
};

type Photo = { id: string; storage_path: string; category: string; caption: string | null };
type Payment = { amount: number; received_at: string };
type LogEntry = {
  id: string;
  log_date: string;
  content: string;
  entry_type: DailyLogType;
  weather: string | null;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

function formatCurrencyUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function nextStep(job: JobData): string {
  const phase = job.current_phase;
  const expStart = formatDate(job.expected_start);
  const expEnd = formatDate(job.expected_end);
  // Permit phase (legado) — trata como planning
  switch (phase) {
    case "planning":
    case "permit_released":
      if (job.permit_status === "pending") {
        return "We're finalizing the project plan and waiting on the permit from the town.";
      }
      return "We're finalizing the project plan. Materials coming up next.";
    case "materials_ordered":
      return "Materials are ordered. You'll get a heads up once they're delivered to your address.";
    case "materials_delivered":
      return expStart
        ? `Materials are at the site. Work begins ${expStart} at 8am.`
        : "Materials are at the site. Work begins shortly.";
    case "work_in_progress":
      return expEnd
        ? `Work is in progress. Estimated completion: ${expEnd}.`
        : "Work is in progress. We'll update you as we move forward.";
    case "completed":
      return "Your project is complete. Thank you for choosing JCN Construction!";
    default:
      return "We'll keep you updated as the project progresses.";
  }
}

export default async function ProjetoPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  if (!UUID_RE.test(token)) return <NotFound />;

  const supabase = createSupabaseAdminClient();

  const { data: jobRaw } = await supabase
    .from("jobs")
    .select(
      `id, value, current_phase, expected_start, expected_end, actual_start, actual_end,
       permit_status, permit_released_at,
       lead:leads(name, address, city, state, service_interest)`,
    )
    .eq("client_token", token)
    .maybeSingle();

  if (!jobRaw) return <NotFound />;
  const job = jobRaw as unknown as JobData;

  // Fotos
  const { data: photosRaw } = await supabase
    .from("job_photos")
    .select("id, storage_path, category, caption")
    .eq("job_id", job.id)
    .order("created_at", { ascending: false })
    .limit(12);
  const photos: Photo[] = (photosRaw ?? []) as Photo[];

  const photoUrls: Array<{ url: string; caption: string | null; category: string }> = [];
  for (const p of photos) {
    const { data } = await supabase.storage
      .from("job-photos")
      .createSignedUrl(p.storage_path, 3600);
    if (data?.signedUrl) {
      photoUrls.push({
        url: data.signedUrl,
        caption: p.caption,
        category: p.category,
      });
    }
  }

  // Journal
  const { data: logsRaw } = await supabase
    .from("job_daily_logs")
    .select("id, log_date, content, entry_type, weather")
    .eq("job_id", job.id)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(15);
  const logs: LogEntry[] = (logsRaw ?? []) as LogEntry[];

  // Pagamentos
  const { data: payments } = await supabase
    .from("job_payments")
    .select("amount, received_at")
    .eq("job_id", job.id)
    .eq("status", "paid");

  const totalReceived = (payments as Payment[] | null ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const totalValue = Number(job.value);
  const pending = Math.max(0, totalValue - totalReceived);
  const pctReceived = totalValue > 0 ? Math.round((totalReceived / totalValue) * 100) : 0;

  const customerFirstName = job.lead ? firstName(job.lead.name) : "there";
  const address = job.lead?.address
    ? `${job.lead.address}, ${job.lead.city}${job.lead.state ? ", " + job.lead.state : ""}`
    : job.lead?.city ?? "";
  const service = job.lead ? SERVICE_LABEL_EN[job.lead.service_interest] : "Project";
  const currentPhaseIdx = PHASE_ORDER.indexOf(job.current_phase);

  const smsBody = encodeURIComponent(
    `Hi Jose, this is ${customerFirstName} about my ${service.toLowerCase()} project at ${address}. `,
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-jcn-midnight text-jcn-ice">
      {/* Profundidade: radial gold + grid sutil (identidade JCN) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(166,130,64,0.14),_transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]"
      />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/brand/jcn-logo-gold.png"
            alt="JCN Construction"
            width={180}
            height={54}
            className="h-auto w-44 object-contain"
            priority
          />
        </div>

        {/* HERO */}
        <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-jcn-gold-300">
            Your project
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.02em] text-white md:text-4xl">
            Hi {customerFirstName}
          </h1>
          <p className="mt-3 text-sm text-white/75">
            {service} {address ? `at ${address}` : ""}
          </p>
        </section>

        {/* NEXT STEP */}
        <section className="mt-5 rounded-3xl border border-jcn-gold-400/30 bg-jcn-gold-500/10 p-5 backdrop-blur-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-jcn-gold-300">
            What&apos;s next
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white">{nextStep(job)}</p>
        </section>

        {/* PERMIT BADGE */}
        {job.permit_status !== "not_needed" && (
          <section className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl">
            {job.permit_status === "released" ? (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
                    Permit
                  </p>
                  <p className="text-sm font-bold text-emerald-300">
                    Released{" "}
                    {job.permit_released_at &&
                      new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(job.permit_released_at))}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/15">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
                    Permit
                  </p>
                  <p className="text-sm font-bold text-amber-300">
                    Pending approval from town
                  </p>
                </div>
              </>
            )}
          </section>
        )}

        {/* TIMELINE */}
        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            Project progress
          </p>
          <ol className="space-y-3">
            {PHASE_ORDER.map((phase, idx) => {
              const done = idx < currentPhaseIdx;
              const current = idx === currentPhaseIdx;
              return (
                <li key={phase} className="flex items-start gap-3">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  ) : current ? (
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-jcn-gold-400 bg-jcn-gold-500/30">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-jcn-gold-300" />
                    </div>
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-white/25" />
                  )}
                  <div className="flex-1">
                    <div
                      className={
                        current
                          ? "font-bold text-jcn-gold-300"
                          : done
                            ? "font-semibold text-white/85"
                            : "text-white/35"
                      }
                    >
                      {PHASE_LABEL_EN[phase]}
                    </div>
                    {current && (
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-jcn-gold-400/80">
                        Current stage
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* JOURNAL */}
        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            Project journal
          </p>
          {logs.length > 0 ? (
            <ol className="space-y-4">
              {logs.map((log) => {
                const { Icon, color, bg, border } = logTypeIcon(log.entry_type);
                const date = new Date(log.log_date + "T12:00:00");
                const dateStr = new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(date);
                return (
                  <li key={log.id} className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${bg} ${border}`}
                    >
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
                          {dateStr}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${bg} ${color} ${border}`}
                        >
                          {LOG_TYPE_LABEL_EN[log.entry_type]}
                        </span>
                        {log.weather && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/55">
                            {log.weather === "rainy" ? (
                              <CloudRain className="h-3 w-3" />
                            ) : (
                              <Sun className="h-3 w-3" />
                            )}
                            {log.weather}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                        {log.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-8 text-center">
              <p className="text-sm font-semibold text-white/75">No updates yet</p>
              <p className="mt-1 text-xs text-white/45">
                Daily progress notes will appear here as work moves forward.
              </p>
            </div>
          )}
        </section>

        {/* PHOTOS */}
        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            Project photos
          </p>
          {photoUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoUrls.map((p, i) => (
                <a
                  key={i}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-square overflow-hidden rounded-xl border border-white/[0.08] transition hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption ?? `Photo ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-jcn-gold-500/15">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-jcn-gold-300"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/75">Photos coming soon</p>
              <p className="mt-1 text-xs text-white/45">
                We&apos;ll update this gallery as work progresses on your project.
              </p>
            </div>
          )}
        </section>

        {/* PAYMENTS */}
        {totalValue > 0 && (
          <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
              Payments
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/65">Project total</span>
                <span className="font-bold text-white">
                  {formatCurrencyUSD(totalValue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/65">Received</span>
                <span className="font-bold text-emerald-300">
                  {formatCurrencyUSD(totalReceived)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
                <span className="text-sm font-semibold text-white/85">Balance due</span>
                <span className="text-lg font-black text-jcn-gold-300">
                  {formatCurrencyUSD(pending)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                  style={{ width: `${pctReceived}%` }}
                />
              </div>
              <div className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                {pctReceived}% paid
              </div>
            </div>
          </section>
        )}

        {/* CONTACT */}
        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            Questions? Get in touch
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a
              href={`tel:${PHONE.replace(/[^\d+]/g, "")}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-jcn-gold-500 px-4 py-3 font-bold uppercase tracking-[0.08em] text-jcn-midnight shadow-[0_12px_40px_-12px_rgba(166,130,64,0.7)] transition active:scale-[0.98]"
            >
              <Phone className="h-4 w-4" />
              Call
            </a>
            <a
              href={`sms:${PHONE.replace(/[^\d+]/g, "")}&body=${smsBody}`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 font-bold uppercase tracking-[0.08em] text-jcn-ice transition active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" />
              Text
            </a>
            <a
              href={`mailto:${EMAIL}?subject=Project at ${address}`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 font-bold uppercase tracking-[0.08em] text-jcn-ice transition active:scale-[0.98]"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-10 pb-2 text-center text-xs text-white/35">
          <div className="mb-2 flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3" />
            JCN Construction Inc. · Licensed General Contractor · Woburn, MA
          </div>
          <a
            href={WEBSITE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-white/55 transition hover:text-jcn-gold-300"
          >
            <Globe className="h-3 w-3" />
            jcnconstructioninc.com
          </a>
        </footer>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-jcn-midnight text-jcn-ice">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(166,130,64,0.14),_transparent_60%)]"
      />
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-black text-white">Project not found</h1>
        <p className="mt-2 text-sm text-white/65">
          This link is invalid or has been removed. Please contact JCN
          Construction at{" "}
          <a href="tel:+18572375602" className="text-jcn-gold-300 underline">
            (857) 237-5602
          </a>{" "}
          if you need help.
        </p>
      </div>
    </main>
  );
}
