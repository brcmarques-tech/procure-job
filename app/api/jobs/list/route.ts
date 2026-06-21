import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { prisma } from "@/lib/db";
import { denyIfNotOwner } from "@/lib/authGuard";

/** Lista as vagas salvas/acompanhadas do usuário (área "Minhas vagas"). */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;
  try {
    const [jobs, portfoliosVaga] = await Promise.all([
      prisma.job.findMany({
        where: { userId },
        include: {
          channel: { select: { tipo: true } },
          application: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.portfolioVaga.findMany({
        where: { userId },
        select: { jobId: true, publicSlug: true },
      }),
    ]);
    const pvByJob = new Map(portfoliosVaga.map((p) => [p.jobId, p.publicSlug]));
    const result = jobs.map((j) => ({
      id: j.id,
      externalId: j.externalId,
      titulo: j.titulo,
      descricao: j.descricao,
      budget: j.budget,
      skills: j.skills ? (JSON.parse(j.skills) as string[]) : [],
      score: j.score,
      statusVaga: j.statusVaga,
      fonte: j.channel.tipo, // freelancer | remotive | ...
      portfolioVagaSlug: pvByJob.get(j.id) ?? null,
      createdAt: j.createdAt,
      application: j.application
        ? {
            id: j.application.id,
            status: j.application.status,
            modoEnvio: j.application.modoEnvio,
            propostaTexto: j.application.propostaTexto,
            valorSugerido: j.application.valorSugerido,
            prazoSugerido: j.application.prazoSugerido,
            enviadaEm: j.application.enviadaEm,
          }
        : null,
    }));
    return Response.json({ jobs: result });
  } catch (e) {
    logError("api/jobs/list", e);
    return Response.json(
      { error: "Falha ao listar vagas: " + (e as Error).message },
      { status: 500 },
    );
  }
}
