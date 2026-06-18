import type { NextRequest } from "next/server";
import { exchangeCode, storeToken } from "@/lib/freelancerAuth";

/**
 * Callback do OAuth2: recebe ?code=&state=<userId>, troca pelo access token,
 * guarda no canal do usuário e redireciona de volta para a tela de vagas.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const base = process.env.APP_BASE_URL ?? req.nextUrl.origin;

  if (error) {
    return Response.redirect(
      `${base}/vagas/${userId ?? ""}?freelancer=erro`,
    );
  }
  if (!code || !userId) {
    return Response.redirect(`${base}/vagas/${userId ?? ""}?freelancer=erro`);
  }

  try {
    const token = await exchangeCode(code);
    await storeToken(userId, token);
    return Response.redirect(`${base}/vagas/${userId}?freelancer=ok`);
  } catch {
    return Response.redirect(`${base}/vagas/${userId}?freelancer=erro`);
  }
}
