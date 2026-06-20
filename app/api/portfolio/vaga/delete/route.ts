import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { deleteJobPortfolio } from "@/lib/jobPortfolio";

const schema = z.object({
  userId: z.string().min(1),
  jobId: z.string().min(1),
});

/** Exclui a versão de portfólio focada numa vaga (Acompanhamento). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, jobId } = parsed.data;
  try {
    await deleteJobPortfolio(userId, jobId);
    return Response.json({ ok: true });
  } catch (e) {
    logError("api/portfolio/vaga/delete", e, { userId, jobId });
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
