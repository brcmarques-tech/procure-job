import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { denyIfNotOwner } from "@/lib/authGuard";

const schema = z.object({
  userId: z.string().min(1),
  jobId: z.string().min(1),
});

/** Exclui uma vaga salva (apaga do banco; cascata remove candidatura/eventos). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, jobId } = parsed.data;
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });
    if (!job || job.userId !== userId) {
      return Response.json({ error: "Vaga não encontrada." }, { status: 404 });
    }
    await prisma.job.delete({ where: { id: jobId } });
    return Response.json({ ok: true });
  } catch (e) {
    logError("api/jobs/delete", e);
    return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
