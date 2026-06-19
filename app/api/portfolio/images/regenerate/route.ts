import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { regenerateOneImage } from "@/lib/portfolioImages";

export const maxDuration = 120;

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["hero", "sobre", "trabalho"]),
});

/**
 * Regenera UMA imagem do portfólio (mantendo as outras), reusando as fotos
 * de referência já enviadas. Atualiza o HTML do portfólio com cache-busting.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  try {
    const result = await regenerateOneImage(parsed.data.userId, parsed.data.role);
    return Response.json(result);
  } catch (e) {
    logError("api/portfolio/images/regenerate", e);
    return Response.json(
      { error: "Falha ao regenerar imagem: " + (e as Error).message },
      { status: 502 },
    );
  }
}
