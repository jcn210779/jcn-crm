import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "./lib/supabase-middleware";

/**
 * Middleware de auth.
 *
 * Roda em toda rota exceto assets estaticos. Renova sessao Supabase e redireciona:
 *  - sem sessao + rota privada  -> /login
 *  - com sessao + /login        -> /
 *
 * Rotas publicas: /login, /auth/*
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/api/cron/") || // Vercel cron chama sem sessão
    pathname.startsWith("/api/permits/") || // Scraper Python chama sem sessão (auth via Bearer)
    pathname.startsWith("/confirmar/") || // Página pública de confirmação de visita (auth via token opaco)
    pathname.startsWith("/api/confirm/") || // API de confirmação (auth via token opaco no path)
    pathname === "/privacy" || // Privacy Policy pública (Twilio A2P 10DLC valida)
    pathname === "/terms" || // Terms and Conditions pública (Twilio A2P 10DLC valida)
    pathname.startsWith("/projeto/") || // Página pública do job pro cliente (auth via token opaco)
    pathname.startsWith("/deposito/") || // Link público do depósito pro menino do depósito (token opaco)
    (pathname.startsWith("/api/deposito/") &&
      !pathname.startsWith("/api/deposito/rotate")) || // API pública do depósito (rotate é interna)
    pathname.startsWith("/precos-publico/"); // Tabela pública de preços de sub (mig 0050, read-only)

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  // Roda em tudo menos assets do Next e arquivos com extensao (imagens, etc).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
