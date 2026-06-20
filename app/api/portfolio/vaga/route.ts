import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { prepareJobPortfolio } from "@/lib/jobPortfolio";

export const maxDuration = 120;

const schema = z.object({
  userId: z.string().min(1),
  externalId: z.string().min(1),
  tipo: z.string().optional(),
});

/** Gera/atualiza uma versão temporária do portfólio focada numa vaga. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, externalId, tipo } = parsed.data;
  try {
    const r = await prepareJobPortfolio(userId, externalId, tipo ?? "freelancer");
    return Response.json(r);
  } catch (e) {
    logError("api/portfolio/vaga", e, { userId, externalId, tipo });
    return Response.json(
      { error: "Falha ao gerar o portfólio da vaga: " + (e as Error).message },
      { status: 502 },
    );
  }
}
