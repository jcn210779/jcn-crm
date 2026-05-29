"use client";

import { Check, CalendarClock, Loader2 } from "lucide-react";
import { useState } from "react";

type Status = {
  visit_confirmed_at: string | null;
  reschedule_requested_at: string | null;
};

type Props = {
  token: string;
  initial: Status;
};

/**
 * Botões públicos de confirmação (inglês — cliente final de Massachusetts).
 * Chama /api/confirm/<token> e reflete o novo estado sem reload. Estados
 * "confirmado" e "remarcar" escondem os botões e mostram a mensagem final.
 */
export function ConfirmActions({ token, initial }: Props) {
  const [status, setStatus] = useState<Status>(initial);
  const [pending, setPending] = useState<null | "confirm" | "reschedule">(null);
  const [error, setError] = useState<string | null>(null);

  const confirmed = Boolean(status.visit_confirmed_at);
  const rescheduled = Boolean(status.reschedule_requested_at);

  async function act(action: "confirm" | "reschedule") {
    setPending(action);
    setError(null);
    try {
      const res = await fetch(`/api/confirm/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        throw new Error("request failed");
      }
      const data = (await res.json()) as Status;
      setStatus({
        visit_confirmed_at: data.visit_confirmed_at ?? null,
        reschedule_requested_at: data.reschedule_requested_at ?? null,
      });
    } catch {
      setError("Something went wrong. Please try again or call us.");
    } finally {
      setPending(null);
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-6 w-6 text-emerald-300" />
        </div>
        <p className="mt-3 text-lg font-bold text-emerald-200">
          You&apos;re confirmed!
        </p>
        <p className="mt-1 text-sm text-emerald-100/70">
          See you soon. We&apos;ll be in touch if anything changes.
        </p>
      </div>
    );
  }

  if (rescheduled) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
          <CalendarClock className="h-6 w-6 text-amber-300" />
        </div>
        <p className="mt-3 text-lg font-bold text-amber-200">
          We received your reschedule request
        </p>
        <p className="mt-1 text-sm text-amber-100/70">
          We&apos;ll reach out shortly to find a new time that works for you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => act("confirm")}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-jcn-gold-500 px-5 py-4 text-base font-bold uppercase tracking-[0.08em] text-jcn-midnight shadow-[0_12px_40px_-12px_rgba(166,130,64,0.7)] transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending === "confirm" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Check className="h-5 w-5" />
        )}
        Confirm my appointment
      </button>

      <button
        type="button"
        disabled={pending !== null}
        onClick={() => act("reschedule")}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-base font-semibold text-white/85 transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending === "reschedule" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <CalendarClock className="h-5 w-5" />
        )}
        Need to reschedule
      </button>

      {error ? (
        <p className="text-center text-sm font-medium text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
