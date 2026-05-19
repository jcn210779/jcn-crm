import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config";
import type { Database } from "./types";

/**
 * Cliente Supabase pra Server Components, Route Handlers e Server Actions.
 *
 * Le e escreve cookies de sessao via next/headers. Anon key publica — RLS
 * autenticada e o que blinda. Em Server Actions / Route Handlers o set/remove
 * funcionam; em Server Components puros o set/remove sao no-op (Next nao deixa
 * mutar response naquele contexto), o que e esperado.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Component — Next nao permite mutar cookies aqui.
          // Tudo bem, middleware ou Server Action vai cuidar.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // mesmo motivo do set()
        }
      },
    },
  });
}

/**
 * Cliente Supabase com service_role (bypass RLS). USAR APENAS em cron jobs
 * ou route handlers de sistema que não têm sessão de usuário (Vercel cron).
 *
 * Lê SUPABASE_SERVICE_ROLE_KEY do env. Se não estiver setado, lança erro.
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no env (necessária pra cron)",
    );
  }
  return createClient<Database>(SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
