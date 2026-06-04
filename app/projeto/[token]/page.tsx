/**
 * Página pública do projeto pro cliente — /projeto/<token>
 *
 * Cliente recebe link via SMS/WhatsApp/email e abre.
 * Token opaco UUID em jobs.client_token é a única proteção (sem auth).
 *
 * MOSTRA: timeline visual + galeria de fotos + pagamentos resumo + contato.
 * NÃO MOSTRA: margem, despesas, custos internos, subs, P&L, notas internas.
 *
 * Mobile-first. Inglês (cliente final US).
 */

import {
  Calendar,
  CheckCircle2,
  Circle,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { JobPhase, ServiceType } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your project — JCN Construction",
  robots: { index: false, follow: false },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHASE_ORDER: JobPhase[] = [
  "planning",
  "permit_released",
  "materials_ordered",
  "materials_delivered",
  "work_in_progress",
  "completed",
];

const PHASE_LABEL_EN: Record<JobPhase, string> = {
  planning: "Planning",
  permit_released: "Permit released",
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

/**
 * Próximo passo descritivo baseado na fase atual + datas.
 */
function nextStep(job: JobData): string {
  const phase = job.current_phase;
  const expStart = formatDate(job.expected_start);
  const expEnd = formatDate(job.expected_end);
  switch (phase) {
    case "planning":
      return "We're finalizing the project plan. Permit application coming up.";
    case "permit_released":
      return expStart
        ? `Permit is approved. We'll order materials and aim to start work on ${expStart}.`
        : "Permit is approved. We're ordering materials next.";
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

  if (!UUID_RE.test(token)) return NotFound();

  const supabase = createSupabaseAdminClient();

  // 1) Job + lead
  const { data: jobRaw } = await supabase
    .from("jobs")
    .select(
      `id, value, current_phase, expected_start, expected_end, actual_start, actual_end,
       lead:leads(name, address, city, state, service_interest)`,
    )
    .eq("client_token", token)
    .maybeSingle();

  if (!jobRaw) return NotFound();
  const job = jobRaw as unknown as JobData;

  // 2) Fotos (apenas as 12 mais recentes pra performance)
  const { data: photosRaw } = await supabase
    .from("job_photos")
    .select("id, storage_path, category, caption")
    .eq("job_id", job.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const photos: Photo[] = (photosRaw ?? []) as Photo[];

  // 2.1) Signed URLs pras fotos (válidas por 1h)
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

  // 3) Pagamentos recebidos
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

  // SMS pré-pronto pra cliente clicar
  const smsBody = encodeURIComponent(
    `Hi Jose, this is ${customerFirstName} about my ${service.toLowerCase()} project at ${address}. `,
  );

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* HERO */}
      <section className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest opacity-80">
            JCN Construction Inc.
          </div>
          <h1 className="text-3xl font-black leading-tight">
            Hi {customerFirstName}, here&apos;s your project.
          </h1>
          <p className="mt-2 text-base opacity-95">
            {service} {address ? `at ${address}` : ""}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
        {/* NEXT STEP */}
        <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">
            What&apos;s next
          </div>
          <p className="text-base leading-relaxed text-zinc-900">{nextStep(job)}</p>
        </section>

        {/* TIMELINE */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Project progress
          </div>
          <ol className="space-y-3">
            {PHASE_ORDER.map((phase, idx) => {
              const done = idx < currentPhaseIdx;
              const current = idx === currentPhaseIdx;
              return (
                <li key={phase} className="flex items-start gap-3">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : current ? (
                    <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-amber-500 bg-amber-100 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    </div>
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-300" />
                  )}
                  <div className="flex-1">
                    <div
                      className={
                        current
                          ? "font-bold text-amber-700"
                          : done
                            ? "font-semibold text-zinc-700"
                            : "text-zinc-400"
                      }
                    >
                      {PHASE_LABEL_EN[phase]}
                    </div>
                    {current && (
                      <div className="text-[11px] font-medium uppercase tracking-wider text-amber-600">
                        Current stage
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* PHOTOS */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Project photos
          </div>
          {photoUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoUrls.map((p, i) => (
                <a
                  key={i}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 transition hover:opacity-90"
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
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
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
                  className="text-amber-600"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-zinc-700">Photos coming soon</p>
              <p className="mt-1 text-xs text-zinc-500">
                We&apos;ll update this gallery as work progresses on your project.
              </p>
            </div>
          )}
        </section>

        {/* PAYMENTS SUMMARY */}
        {totalValue > 0 && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Payments
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Project total</span>
                <span className="font-bold text-zinc-900">{formatCurrencyUSD(totalValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Received</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrencyUSD(totalReceived)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
                <span className="text-sm font-semibold text-zinc-700">Balance due</span>
                <span className="text-lg font-black text-amber-700">
                  {formatCurrencyUSD(pending)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pctReceived}%` }}
                />
              </div>
              <div className="text-center text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {pctReceived}% paid
              </div>
            </div>
          </section>
        )}

        {/* CONTACT */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Questions? Get in touch
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a
              href={`tel:${PHONE.replace(/[^\d+]/g, "")}`}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 font-bold text-emerald-700 transition hover:bg-emerald-100"
            >
              <Phone className="h-4 w-4" />
              Call
            </a>
            <a
              href={`sms:${PHONE.replace(/[^\d+]/g, "")}&body=${smsBody}`}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-3 font-bold text-blue-700 transition hover:bg-blue-100"
            >
              <MessageCircle className="h-4 w-4" />
              Text
            </a>
            <a
              href={`mailto:${EMAIL}?subject=Project at ${address}`}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-300 bg-zinc-50 px-4 py-3 font-bold text-zinc-700 transition hover:bg-zinc-100"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pt-4 text-center text-xs text-zinc-500">
          <div className="mb-2 flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3" />
            JCN Construction Inc. — Licensed General Contractor (MA)
          </div>
          <a
            href={WEBSITE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
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
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Project not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This link is invalid or has been removed. Please contact JCN Construction
          at (857) 237-5602 if you need help.
        </p>
      </div>
    </main>
  );
}
