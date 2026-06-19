import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { registerResponse } from "@/lib/tracker";

const schema = z.object({ applicationId: z.string().min(1) });

/** M6 — simula/recebe a resposta de uma empresa e notifica o usuário. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  try {
    const result = await registerResponse(parsed.data.applicationId);
    return Response.json(result);
  } catch (e) {
    logError("api/applications/respond", e);
    return Response.json(
      { error: "Falha ao registrar resposta: " + (e as Error).message },
      { status: 502 },
    );
  }
}
