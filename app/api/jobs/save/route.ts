import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { saveJob } from "@/lib/applications";
import { denyIfNotOwner } from "@/lib/authGuard";

const schema = z.object({
  userId: z.string().min(1),
  tipo: z.string().default("freelancer"),
  job: z.object({
    externalId: z.string().min(1),
    titulo: z.string().min(1),
    descricao: z.string().default(""),
    budget: z.string().nullish(),
    skills: z.array(z.string()).optional(),
    score: z.number().optional(),
    elegivel: z.boolean().optional(),
  }),
});

/** Salva/curte uma vaga escolhida pelo usuário (persiste com userId). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, parsed.data.userId);
  if (deny) return deny;
  try {
    const job = await saveJob(parsed.data.userId, parsed.data.tipo, {
      ...parsed.data.job,
      budget: parsed.data.job.budget ?? null,
    });
    return Response.json({ ok: true, jobId: job.id });
  } catch (e) {
    logError("api/jobs/save", e);
    return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
