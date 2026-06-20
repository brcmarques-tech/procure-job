import { prisma } from "./db";
import {
  generatePortfolio,
  buildContato,
  type PortfolioImageRef,
} from "./portfolio";
import { slugify } from "./slug";
import type { ProfileDraft } from "./profile";

/**
 * Gera (ou regenera) uma versão TEMPORÁRIA do portfólio focada numa vaga.
 * Reaproveita o perfil e as MESMAS imagens do portfólio principal (não gera
 * imagem nova) e pede pra IA reorganizar/enfatizar o que casa com a vaga.
 * Idempotente por (usuário, vaga): regenerar atualiza a mesma versão.
 */
export async function prepareJobPortfolio(
  userId: string,
  externalId: string,
  tipo: string = "freelancer",
): Promise<{ slug: string; focoVaga: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, portfolio: true },
  });
  if (!user || !user.profile) throw new Error("Perfil não encontrado.");
  if (!user.portfolio)
    throw new Error("Gere o portfólio principal primeiro.");

  const channel = await prisma.channel.findUnique({
    where: { userId_tipo: { userId, tipo } },
  });
  if (!channel) throw new Error("Vaga não encontrada (canal inexistente).");

  const job = await prisma.job.findUnique({
    where: { channelId_externalId: { channelId: channel.id, externalId } },
  });
  if (!job) throw new Error("Vaga não encontrada.");

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  // Reusa as imagens do portfólio principal — nada de gerar imagem nova.
  const images: PortfolioImageRef[] = user.portfolio.images
    ? JSON.parse(user.portfolio.images)
    : [];
  const jobSkills: string[] = job.skills ? JSON.parse(job.skills) : [];

  const foco =
    `Esta é uma versão do portfólio FOCADA numa vaga específica. Reorganize e ` +
    `ENFATIZE as experiências e skills do perfil mais relevantes para esta vaga; ` +
    `ajuste o headline/hero para conversar diretamente com o que a vaga pede; ` +
    `reordene as seções para evidenciar o match. NÃO invente nada — apenas ` +
    `priorize e destaque o que já existe no perfil.\n` +
    `VAGA-ALVO:\n- Título: ${job.titulo}\n` +
    `- Skills pedidas: ${jobSkills.join(", ") || "—"}\n` +
    `- Descrição: ${(job.descricao || "").replace(/\s+/g, " ").slice(0, 800)}`;

  const contato = buildContato({
    nome: user.nome,
    email: user.email,
    telefone: user.telefone,
    linkedin: user.linkedin,
  });
  const out = await generatePortfolio(profile, foco, images, contato);

  // Slug estável por vaga (regenerar mantém a mesma URL).
  const slug = `${slugify(user.nome)}-vaga-${job.id.slice(-6)}`;
  const data = {
    focoVaga: job.titulo,
    html: out.html,
    css: out.css,
    publicSlug: slug,
    images: user.portfolio.images,
  };

  await prisma.portfolioVaga.upsert({
    where: { userId_jobId: { userId, jobId: job.id } },
    update: data,
    create: { userId, jobId: job.id, ...data },
  });

  return { slug, focoVaga: job.titulo };
}

/** Exclui a versão de portfólio focada numa vaga (botão no Acompanhamento). */
export async function deleteJobPortfolio(
  userId: string,
  jobId: string,
): Promise<void> {
  await prisma.portfolioVaga.deleteMany({ where: { userId, jobId } });
}
