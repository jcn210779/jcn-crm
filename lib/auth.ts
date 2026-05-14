import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "./supabase-server";

/**
 * Pega o usuario atual em Server Components.
 * Retorna `null` se nao autenticado.
 */
export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Garante usuario autenticado em pagina protegida. Se nao tiver, redireciona
 * pra /login. O middleware ja faz isso, mas usar aqui evita prop drilling.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
