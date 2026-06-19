import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { huntJobs } from "@/lib/jobHunter";

const schema = z.object({ userId: z.string().min(1) });

/**
 * M3 — dispara a caça de vagas no Freelancer.com para o usuário.
 * Sem FREELANCER_OAUTH_TOKEN, roda em modo "mock" para testar o pipeline.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const result = await huntJobs(parsed.data.userId);
    return Response.json(result);
  } catch (e) {
    logError("api/jobs/hunt", e);
    return Response.json(
      { error: "Falha na caça de vagas: " + (e as Error).message },
      { status: 502 },
    );
  }
}
