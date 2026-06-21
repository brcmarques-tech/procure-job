import type { NextRequest } from "next/server";
import { isOAuthConfigured, getConnectionKind } from "@/lib/freelancerAuth";
import { denyIfNotOwner } from "@/lib/authGuard";

/** Diz se o usuário já está conectado ao Freelancer e se o OAuth está configurado. */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;
  const kind = await getConnectionKind(userId);
  return Response.json({
    configured: isOAuthConfigured(),
    connected: kind !== "none",
    own: kind === "own", // conexão própria (vs. ponte do .env)
  });
}
