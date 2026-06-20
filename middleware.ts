import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "pj_auth";

/**
 * Login simples por senha compartilhada (env APP_PASSWORD).
 * - Portfólios públicos (/p/...) e assets ficam SEMPRE abertos.
 * - O resto (ferramenta + APIs) exige estar logado.
 * - Se APP_PASSWORD não estiver definido, o login fica DESATIVADO (app aberto),
 *   pra dar pra deployar o código sem travar nada antes de configurar a senha.
 */
export function middleware(req: NextRequest) {
  const senha = process.env.APP_PASSWORD;
  if (!senha) return NextResponse.next(); // login desativado

  const ok = req.cookies.get(COOKIE)?.value === senha;
  if (ok) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Roda em tudo, EXCETO: portfólios públicos, login, e estáticos.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|p/|illustrations/|generated/|login|api/login).*)",
  ],
};
