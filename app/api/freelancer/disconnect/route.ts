import type { NextRequest } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/logError";
import { disconnect } from "@/lib/freelancerAuth";
import { denyIfNotOwner } from "@/lib/authGuard";

const schema = z.object({ userId: z.string().min(1) });

/** Desconecta a conta própria do Freelancer (limpa o token do perfil). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, parsed.data.userId);
  if (deny) return deny;
  try {
    await disconnect(parsed.data.userId);
    return Response.json({ ok: true });
  } catch (e) {
    logError("api/freelancer/disconnect", e);
    return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
