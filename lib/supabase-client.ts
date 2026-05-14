"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config";
import type { Database } from "./types";

/**
 * Cliente Supabase pra Client Components (browser).
 *
 * Usa anon key publica + cookies do browser pra manter sessao do magic link.
 * Cada chamada cria um novo client (barato, e Singleton fica preso a SSR/hydration).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
