import type { NextRequest } from "next/server";
import { listApplications } from "@/lib/tracker";

/** M6 — lista as candidaturas do usuário + funil. */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  try {
    const result = await listApplications(userId);
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: "Falha ao listar candidaturas: " + (e as Error).message },
      { status: 500 },
    );
  }
}
