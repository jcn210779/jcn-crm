import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Route handler do magic link.
 *
 * Supabase redireciona pra ca apos o usuario clicar no email. Trocamos o code
 * por uma sessao (sets cookies) e mandamos pro destino original (`next`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") ?? "/";

  // Valida que `next` e path interno (impede open redirect).
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Falhou — manda pra login com flag de erro.
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "magic_link_invalid");
  return NextResponse.redirect(loginUrl);
}
