import { Globe, Instagram, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { ServiceType } from "@/lib/types";

import { ConfirmActions } from "./confirm-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your appointment — JCN Construction",
  robots: { index: false, follow: false },
};

// Prova social da página pública. IDs de vídeo do YouTube (só o ID).
const TESTIMONIAL_VIDEOS = ["zdZ9SmVVwCU"];
const INSTAGRAM_HANDLE = "jcnconstructioninc";
const WEBSITE_URL = "https://jcnconstructioninc.com";

// Rótulos de serviço em INGLÊS (página é pro cliente final de Massachusetts).
const SERVICE_LABEL_EN: Record<ServiceType, string> = {
  deck: "Deck",
  siding: "Siding",
  patio: "Stone Patio",
  multiple: "Multiple Services",
  other: "Project",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VisitRow = {
  name: string;
  visit_scheduled_at: string | null;
  address: string | null;
  city: string;
  service_interest: ServiceType;
  visit_confirmed_at: string | null;
  reschedule_requested_at: string | null;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

// "Thursday, June 5 at 2:00 PM" — formatado em en-US, timezone de Boston.
function formatVisit(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);
  return { date, time };
}

export default async function ConfirmPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;

  let visit: VisitRow | null = null;
  if (UUID_RE.test(token)) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("leads")
      // SÓ os campos estritamente necessários — nunca o lead inteiro.
      .select(
        "name, visit_scheduled_at, address, city, service_interest, visit_confirmed_at, reschedule_requested_at",
      )
      .eq("confirm_token", token)
      .maybeSingle<VisitRow>();
    visit = data ?? null;
  }

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

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
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

        {visit ? (
          <VisitContent token={token} visit={visit} />
        ) : (
          <NotFound />
        )}

        {/* Prova social — sempre visível */}
        <SocialProof />

        <footer className="mt-10 pb-2 text-center text-xs text-white/35">
          JCN Construction Inc. · Licensed General Contractor · Woburn, MA
        </footer>
      </div>
    </main>
  );
}

function VisitContent({ token, visit }: { token: string; visit: VisitRow }) {
  const when = formatVisit(visit.visit_scheduled_at);

  return (
    <>
      <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-jcn-gold-300">
          Your appointment
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.02em] text-white">
          Hi {firstName(visit.name)}!
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/70">
          Thanks for choosing JCN Construction. Here are the details for your
          visit. Please let us know if it works for you.
        </p>

        <dl className="mt-6 space-y-3">
          {when ? (
            <DetailLine
              label="When"
              value={`${when.date} at ${when.time}`}
            />
          ) : (
            <DetailLine label="When" value="To be confirmed" />
          )}
          {(visit.address || visit.city) && (
            <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-jcn-gold-400" />
              <div className="text-[15px] font-semibold leading-snug text-white">
                {visit.address ? <div>{visit.address}</div> : null}
                <div className="text-white/70">{visit.city}, MA</div>
              </div>
            </div>
          )}
          <DetailLine
            label="Service"
            value={SERVICE_LABEL_EN[visit.service_interest]}
          />
        </dl>
      </section>

      <div className="mt-6">
        <ConfirmActions
          token={token}
          initial={{
            visit_confirmed_at: visit.visit_confirmed_at,
            reschedule_requested_at: visit.reschedule_requested_at,
          }}
        />
      </div>
    </>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-[0.15em] text-white/45">
        {label}
      </dt>
      <dd className="text-right text-[15px] font-semibold text-white">
        {value}
      </dd>
    </div>
  );
}

function NotFound() {
  return (
    <section className="mt-12 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-xl">
      <h1 className="text-2xl font-black tracking-tight text-white">
        Link not found or expired
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">
        We couldn&apos;t find an appointment for this link. It may have expired
        or been mistyped. Please reach out to us and we&apos;ll get you sorted.
      </p>
      <a
        href={WEBSITE_URL}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-jcn-gold-500 px-5 py-3 text-sm font-bold uppercase tracking-[0.08em] text-jcn-midnight"
      >
        <Globe className="h-4 w-4" />
        Visit our website
      </a>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="mt-12">
      <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-jcn-gold-300">
        What our clients say
      </p>

      <div className="mt-5 space-y-4">
        {TESTIMONIAL_VIDEOS.map((id) => (
          <div
            key={id}
            className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40"
          >
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${id}`}
              title="Client testimonial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <a
          href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          <Instagram className="h-4 w-4 text-jcn-gold-400" />
          Instagram
        </a>
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          <Globe className="h-4 w-4 text-jcn-gold-400" />
          Website
        </a>
      </div>
    </section>
  );
}
