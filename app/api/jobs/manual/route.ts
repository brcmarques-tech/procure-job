import type { NextRequest } from "next/server";
import { z } from "zod";
import { prepareManualApplication } from "@/lib/applications";

export const maxDuration = 120;

const schema = z.object({
  userId: z.string().min(1),
  plataforma: z.string().min(1),
  titulo: z.string().min(3, "Informe o título da vaga."),
  descricao: z.string().min(20, "Cole a descrição da vaga (mais detalhes)."),
  link: z.string().optional(),
});

/**
 * Canal universal (copiloto) — recebe uma vaga colada de qualquer plataforma
 * e devolve a proposta escrita pela IA, já salva no acompanhamento.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  try {
    const result = await prepareManualApplication(parsed.data.userId, {
      plataforma: parsed.data.plataforma,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      link: parsed.data.link,
    });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: "Falha ao preparar candidatura: " + (e as Error).message },
      { status: 502 },
    );
  }
}
