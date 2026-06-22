import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session";

const COOKIE = "pj_session";

/**
 * Gate de acesso por conta (login = nome + senha; cookie de sessão assinado).
 * - Portfólios públicos (/p/...), imagens (/img/...) e assets ficam SEMPRE abertos.
 * - O resto (ferramenta + APIs) exige sessão válida.
 * - /cadastro e /api/accounts/register ficam abertos (são protegidos pela
 *   senha mestre no próprio handler).
 * - Se SESSION_SECRET não estiver definido, o login fica DESATIVADO (app aberto),
 *   pra dar pra deployar sem travar nada antes de configurar os segredos.
 */
export async function middleware(req: NextRequest) {
  if (!process.env.SESSION_SECRET) return NextResponse.next(); // login desativado

  const accountId = await verifySession(req.cookies.get(COOKIE)?.value);
  if (accountId) return NextResponse.next();

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
  // Roda em tudo, EXCETO: portfólios públicos, login/cadastro, e estáticos.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|icon.svg|icon-app.svg|manifest.json|p/|img/|illustrations/|generated/|login|cadastro|api/login|api/accounts/register|api/ai-proxy).*)",
  ],
};
