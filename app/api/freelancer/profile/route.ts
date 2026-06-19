import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { getValidToken } from "@/lib/freelancerAuth";
import { getSelfProfile } from "@/lib/freelancer";

/** Lê o perfil atual do usuário no Freelancer (headline, bio, skills). */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  const token = await getValidToken(userId);
  if (!token) {
    return Response.json({ connected: false });
  }
  try {
    const profile = await getSelfProfile(token);
    return Response.json({ connected: true, profile });
  } catch (e) {
    logError("api/freelancer/profile", e);
    return Response.json(
      { error: "Falha ao ler o perfil: " + (e as Error).message },
      { status: 502 },
    );
  }
}
