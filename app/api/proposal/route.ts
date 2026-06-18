import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeProposal } from "@/lib/proposals";
import { findExampleJob } from "@/lib/exampleJobs";
import type { ProfileDraft } from "@/lib/profile";

const schema = z.object({
  userId: z.string().min(1),
  jobId: z.string().min(1),
});

/**
 * M4 — Motor de proposta.
 * Estuda a vaga (de exemplo) e escreve uma proposta personalizada,
 * salvando-a como rascunho de candidatura (Channel → Job → Application).
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, jobId } = parsed.data;

  const job = findExampleJob(jobId);
  if (!job) {
    return Response.json({ error: "Vaga de exemplo não encontrada." }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, portfolio: true },
  });
  if (!user || !user.profile) {
    return Response.json(
      { error: "Perfil não encontrado. Gere o perfil primeiro." },
      { status: 404 },
    );
  }

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const portfolioUrl = user.portfolio
    ? `${base}/p/${user.portfolio.publicSlug}`
    : "(portfólio ainda não gerado)";

  let proposal;
  try {
    proposal = await writeProposal({
      profile,
      portfolioUrl,
      jobTitle: job.titulo,
      jobDescription: job.descricao,
    });
  } catch (e) {
    return Response.json(
      { error: "Falha ao gerar a proposta: " + (e as Error).message },
      { status: 502 },
    );
  }

  // Persiste como rascunho: Channel (exemplo) → Job → Application.
  const channel = await prisma.channel.upsert({
    where: { userId_tipo: { userId, tipo: "exemplo" } },
    update: {},
    create: { userId, tipo: "exemplo", modo: "copiloto" },
  });

  const savedJob = await prisma.job.upsert({
    where: { channelId_externalId: { channelId: channel.id, externalId: job.id } },
    update: { titulo: job.titulo, descricao: job.descricao, budget: job.budget },
    create: {
      channelId: channel.id,
      externalId: job.id,
      titulo: job.titulo,
      descricao: job.descricao,
      budget: job.budget,
      skills: JSON.stringify(job.skills),
      statusVaga: "elegivel",
    },
  });

  const application = await prisma.application.upsert({
    where: { jobId: savedJob.id },
    update: {
      propostaTexto: proposal.proposta,
      valorSugerido: proposal.valorSugerido,
      prazoSugerido: proposal.prazoSugerido,
      status: "rascunho",
    },
    create: {
      jobId: savedJob.id,
      propostaTexto: proposal.proposta,
      valorSugerido: proposal.valorSugerido,
      prazoSugerido: proposal.prazoSugerido,
      status: "rascunho",
      modoEnvio: "copiloto",
    },
  });

  return Response.json({ applicationId: application.id, job, proposal });
}
