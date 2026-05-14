"use client";

import { useEffect } from "react";

/**
 * Registra o service worker mínimo (`/sw.js`). Só em produção
 * pra nao atrapalhar HMR do dev.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[sw] register failed:", err);
    });
  }, []);

  return null;
}
