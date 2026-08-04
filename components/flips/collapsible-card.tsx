"use client";

/**
 * Card com header clicavel pra expandir/colapsar.
 * Estado persistido em localStorage por `storageKey` — se abrir uma vez,
 * fica aberto ate fechar manual. Se `storageKey` nao for passado, nao persiste.
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  id?: string;
  variant?: "default" | "gold";
};

export function CollapsibleCard({
  title,
  subtitle,
  right,
  icon,
  children,
  storageKey,
  defaultOpen = false,
  id,
  variant = "default",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setHydrated(true);
      return;
    }
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setOpen(true);
      else if (v === "0") setOpen(false);
    } catch {
      // ignore (SSR / privacy mode)
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
    }
  }

  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-3xl border backdrop-blur-xl transition-shadow scroll-mt-24",
        variant === "gold"
          ? "border-jcn-gold-400/30 bg-gradient-to-br from-jcn-gold-500/[0.08] to-white/[0.02]"
          : "border-white/[0.06] bg-white/[0.025]",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03] md:px-6"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-jcn-gold-300" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-jcn-ice/45" />
          )}
          {icon}
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "truncate text-xs font-bold uppercase tracking-[0.18em]",
                variant === "gold" ? "text-jcn-gold-300" : "text-white/55",
              )}
            >
              {title}
            </h2>
            {subtitle && (
              <div className="mt-0.5 text-[11px] text-jcn-ice/50">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {right && (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {right}
          </div>
        )}
      </button>

      {hydrated && open && (
        <div className="border-t border-white/[0.05] px-5 pb-5 pt-4 md:px-6 md:pb-6">
          {children}
        </div>
      )}
    </section>
  );
}
