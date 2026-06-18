import type { NextRequest } from "next/server";
import { buildAuthorizeUrl, isOAuthConfigured } from "@/lib/freelancerAuth";

/**
 * Inicia o fluxo OAuth2 do Freelancer. Recebe ?userId= e redireciona o
 * usuário para a tela de autorização do Freelancer.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  if (!isOAuthConfigured()) {
    return Response.json(
      {
        error:
          "OAuth do Freelancer não configurado. Preencha FREELANCER_CLIENT_ID " +
          "e FREELANCER_CLIENT_SECRET no .env.",
      },
      { status: 503 },
    );
  }
  return Response.redirect(buildAuthorizeUrl(userId));
}
