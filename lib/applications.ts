import { prisma } from "./db";
import { writeProposal } from "./proposals";
import type { ProfileDraft } from "./profile";

/**
 * M5 — Fluxo copiloto.
 * Conecta a caça de vagas (M3) ao motor de proposta (M4): a partir de uma
 * vaga elegível, gera a proposta e deixa a candidatura "aguardando_envio".
 */
export async function prepareApplication(userId: string, externalId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, portfolio: true },
  });
  if (!user || !user.profile) throw new Error("Perfil não encontrado.");

  const channel = await prisma.channel.findUnique({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
  });
  if (!channel) throw new Error("Rode a caça de vagas primeiro.");

  const job = await prisma.job.findUnique({
    where: {
      channelId_externalId: { channelId: channel.id, externalId },
    },
  });
  if (!job) throw new Error("Vaga não encontrada.");

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

  const proposal = await writeProposal({
    profile,
    portfolioUrl,
    jobTitle: job.titulo,
    jobDescription: job.descricao,
  });

  const modoEnvio = channel.modo === "auto" ? "auto" : "copiloto";

  const application = await prisma.application.upsert({
    where: { jobId: job.id },
    update: {
      propostaTexto: proposal.proposta,
      valorSugerido: proposal.valorSugerido,
      prazoSugerido: proposal.prazoSugerido,
      status: "aguardando_envio",
      modoEnvio,
    },
    create: {
      jobId: job.id,
      propostaTexto: proposal.proposta,
      valorSugerido: proposal.valorSugerido,
      prazoSugerido: proposal.prazoSugerido,
      status: "aguardando_envio",
      modoEnvio,
    },
  });

  return {
    applicationId: application.id,
    externalId,
    titulo: job.titulo,
    modoEnvio,
    proposta: proposal.proposta,
    valorSugerido: proposal.valorSugerido,
    prazoSugerido: proposal.prazoSugerido,
    status: application.status,
  };
}

/**
 * Registra o envio de uma candidatura.
 * - Canal 🟢 auto com token: aqui entraria o bid real via API (v2 — exige o
 *   id do usuário no Freelancer e valores numéricos). Por ora registra o envio.
 * - Canal 🟡 copiloto: o usuário envia no navegador dele; só registramos.
 */
export async function sendApplication(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { include: { channel: true } } },
  });
  if (!application) throw new Error("Candidatura não encontrada.");

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: "enviada", enviadaEm: new Date() },
  });

  return { applicationId: updated.id, status: updated.status };
}
