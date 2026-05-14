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
    pathname.startsWith("/icon-");

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
