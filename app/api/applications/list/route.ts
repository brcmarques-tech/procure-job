import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { listApplications } from "@/lib/tracker";
import { denyIfNotOwner } from "@/lib/authGuard";

/** M6 — lista as candidaturas do usuário + funil. */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;
  try {
    const result = await listApplications(userId);
    return Response.json(result);
  } catch (e) {
    logError("api/applications/list", e);
    return Response.json(
      { error: "Falha ao listar candidaturas: " + (e as Error).message },
      { status: 500 },
    );
  }
}
