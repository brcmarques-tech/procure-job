import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { prepareApplication } from "@/lib/applications";
import { denyIfNotOwner } from "@/lib/authGuard";

const schema = z.object({
  userId: z.string().min(1),
  externalId: z.string().min(1),
  tipo: z.string().optional(),
});

/** M5 — prepara a candidatura (gera proposta, deixa "aguardando_envio"). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, parsed.data.userId);
  if (deny) return deny;
  try {
    const result = await prepareApplication(
      parsed.data.userId,
      parsed.data.externalId,
      parsed.data.tipo,
    );
    return Response.json(result);
  } catch (e) {
    logError("api/applications/prepare", e);
    return Response.json(
      { error: "Falha ao preparar candidatura: " + (e as Error).message },
      { status: 502 },
    );
  }
}
