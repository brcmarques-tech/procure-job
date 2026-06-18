import type { NextRequest } from "next/server";
import { isConnected, isOAuthConfigured } from "@/lib/freelancerAuth";

/** Diz se o usuário já está conectado ao Freelancer e se o OAuth está configurado. */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  return Response.json({
    configured: isOAuthConfigured(),
    connected: await isConnected(userId),
  });
}
