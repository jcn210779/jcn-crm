"use client";

import { Building2, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/view-mode";

type Props = {
  initialMode: ViewMode;
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export function ModeToggle({ initialMode }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>(initialMode);

  // Sincroniza state com cookie ao mount (caso outro tab tenha mudado)
  useEffect(() => {
    const cookieMode = document.cookie
      .split("; ")
      .find((c) => c.startsWith("view-mode="))
      ?.split("=")[1];
    if (cookieMode === "flip" || cookieMode === "jcn") {
      setMode(cookieMode);
    }
  }, []);

  function toggle() {
    const next: ViewMode = mode === "jcn" ? "flip" : "jcn";
    document.cookie = `view-mode=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    setMode(next);
    router.refresh();
  }

  const isFlip = mode === "flip";
  const Icon = isFlip ? Home : Building2;

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Modo atual: ${isFlip ? "Flip" : "JCN"}. Click pra alternar.`}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition",
        isFlip
          ? "border-jcn-gold-400/40 bg-jcn-gold-500/20 text-jcn-gold-200 shadow-[0_0_12px_rgba(212,175,55,0.25)]"
          : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.07]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {isFlip ? "Modo Flip" : "Modo JCN"}
      </span>
    </button>
  );
}
