/**
 * Configuracao publica do projeto Supabase `jcn-crm`.
 *
 * Migrado em 2026-05-14 do sistema legacy (anon/service_role JWT) pro novo
 * sistema de API keys (publishable/secret). Publishable key e publica por
 * design — sozinha NAO acessa nada sem RLS policy permissiva.
 *
 * Fonte de verdade: `wiki/operations/supabase-jcn-crm-config.md`.
 * Secret key (sb_secret_*) NUNCA mora aqui — fica nas Apple Notes do Jose.
 */
export const SUPABASE_URL = "https://zlrtodnkypncqwdjfbsl.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_VNDbFfie_MvT_70ZzhIErQ_wfPEgyH5";

// Alias retrocompativel — clientes Supabase JS chamam de `anonKey` na config.
// O novo formato `sb_publishable_*` e aceito no mesmo parametro.
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
