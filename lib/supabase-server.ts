import { createServerClient, type CookieOptions } from "@supabase/ssr";
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
