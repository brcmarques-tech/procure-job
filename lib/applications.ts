import { prisma } from "./db";
import { writeProposal } from "./proposals";
import { getValidToken } from "./freelancerAuth";
import { placeBid, getSelfProfile, getBids } from "./freelancer";
import type { ProfileDraft } from "./profile";

/**
 * Base PÚBLICA do app (deploy no Render) — usada nos links de portfólio que
 * vão dentro das propostas/lances. NUNCA mandar localhost para o cliente.
 * Configurável via env (PUBLIC_BASE_URL) caso a URL do Render mude.
 */
const PUBLIC_BASE =
  process.env.PUBLIC_BASE_URL ?? "https://procure-job.onrender.com";

/** Troca qualquer URL localhost/127.0.0.1 pela base pública. */
function publicizeUrls(text: string): string {
  return text.replace(
    /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/g,
    PUBLIC_BASE,
  );
}

/** Extrai o valor numérico de uma string como "R$ 1.500" -> 1500. */
function parseValor(s?: string | null): number {
  if (!s) return 0;
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/** Extrai o prazo em dias de uma string como "7 dias" / "2 semanas" -> 7 / 14. */
function parsePrazo(s?: string | null): number {
  if (!s) return 7;
  const n = Number((s.match(/\d+/) ?? ["7"])[0]);
  if (/semana/i.test(s)) return n * 7;
  if (/m[eê]s/i.test(s)) return n * 30;
  return n || 7;
}

/** Dados de uma vaga vindos da busca (a UI reenvia ao curtir/preparar). */
export interface JobInput {
  externalId: string;
  titulo: string;
  descricao: string;
  budget?: string | null;
  skills?: string[];
  score?: number;
  elegivel?: boolean;
}

/**
 * Persiste (ou atualiza) uma vaga ESCOLHIDA pelo usuário, ligada ao userId.
 * A busca não salva nada; um Job só existe via aqui (curtir/salvar) ou ao
 * preparar candidatura. Garante o Channel da plataforma (por userId+tipo).
 */
export async function saveJob(userId: string, tipo: string, job: JobInput) {
  const channel = await prisma.channel.upsert({
    where: { userId_tipo: { userId, tipo } },
    update: {},
    create: {
      userId,
      tipo,
      modo: tipo === "freelancer" ? "auto" : "copiloto",
    },
  });
  const data = {
    userId,
    titulo: job.titulo,
    descricao: job.descricao,
    budget: job.budget ?? null,
    skills: JSON.stringify(job.skills ?? []),
    score: job.score ?? 0,
    statusVaga: job.elegivel === false ? "descartada" : "elegivel",
  };
  return prisma.job.upsert({
    where: {
      channelId_externalId: {
        channelId: channel.id,
        externalId: job.externalId,
      },
    },
    update: data,
    create: { channelId: channel.id, externalId: job.externalId, ...data },
  });
}

/**
 * M5 — Fluxo copiloto.
 * Conecta a caça de vagas (M3) ao motor de proposta (M4): a partir de uma
 * vaga elegível, gera a proposta e deixa a candidatura "aguardando_envio".
 */
export async function prepareApplication(
  userId: string,
  jobInput: JobInput,
  tipo: string = "freelancer",
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, portfolio: true },
  });
  if (!user || !user.profile) throw new Error("Perfil não encontrado.");

  // Persiste a vaga escolhida (com userId) e garante o canal.
  const job = await saveJob(userId, tipo, jobInput);
  const channel = await prisma.channel.findUnique({
    where: { userId_tipo: { userId, tipo } },
  });

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  const portfolioUrl = user.portfolio
    ? `${PUBLIC_BASE}/p/${user.portfolio.publicSlug}`
    : "(portfólio ainda não gerado)";

  const jobSkills: string[] = job.skills ? JSON.parse(job.skills) : [];
  const proposal = await writeProposal({
    profile,
    portfolioUrl,
    jobTitle: job.titulo,
    jobDescription: job.descricao,
    budget: job.budget,
    jobSkills,
    // Freelancer rejeita proposta acima de 1500 caracteres.
    maxChars: tipo === "freelancer" ? 1500 : 2500,
  });

  const modoEnvio = channel?.modo === "auto" ? "auto" : "copiloto";

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
    externalId: job.externalId,
    titulo: job.titulo,
    modoEnvio,
    proposta: proposal.proposta,
    valorSugerido: proposal.valorSugerido,
    prazoSugerido: proposal.prazoSugerido,
    pontosFortes: proposal.pontosFortes,
    status: application.status,
  };
}

/**
 * Canal universal (copiloto) — vaga de qualquer plataforma sem API.
 * O usuário cola a vaga (LinkedIn, Workana, Upwork...), a IA escreve a
 * proposta sob medida e a candidatura entra no acompanhamento. O envio é
 * manual (o usuário aplica no site), pois essas plataformas não têm API.
 */
export async function prepareManualApplication(
  userId: string,
  input: { plataforma: string; titulo: string; descricao: string; link?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, portfolio: true },
  });
  if (!user || !user.profile) throw new Error("Perfil não encontrado.");

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  const channel = await prisma.channel.upsert({
    where: { userId_tipo: { userId, tipo: input.plataforma } },
    update: {},
    create: { userId, tipo: input.plataforma, modo: "copiloto" },
  });

  const externalId = input.link?.trim() || `manual-${crypto.randomUUID()}`;
  const job = await prisma.job.upsert({
    where: { channelId_externalId: { channelId: channel.id, externalId } },
    update: { userId, titulo: input.titulo, descricao: input.descricao },
    create: {
      channelId: channel.id,
      userId,
      externalId,
      titulo: input.titulo,
      descricao: input.descricao,
      statusVaga: "elegivel",
    },
  });

  const portfolioUrl = user.portfolio
    ? `${PUBLIC_BASE}/p/${user.portfolio.publicSlug}`
    : "(portfólio ainda não gerado)";

  const proposal = await writeProposal({
    profile,
    portfolioUrl,
    jobTitle: input.titulo,
    jobDescription: input.descricao,
    maxChars: 2500,
  });

  const application = await prisma.application.upsert({
    where: { jobId: job.id },
    update: {
      propostaTexto: proposal.proposta,
      valorSugerido: proposal.valorSugerido,
      prazoSugerido: proposal.prazoSugerido,
      status: "aguardando_envio",
      modoEnvio: "copiloto",
    },
    create: {
      jobId: job.id,
      propostaTexto: proposal.proposta,
      valorSugerido: proposal.valorSugerido,
      prazoSugerido: proposal.prazoSugerido,
      status: "aguardando_envio",
      modoEnvio: "copiloto",
    },
  });

  return {
    applicationId: application.id,
    plataforma: input.plataforma,
    titulo: input.titulo,
    proposta: proposal.proposta,
    valorSugerido: proposal.valorSugerido,
    prazoSugerido: proposal.prazoSugerido,
    pontosFortes: proposal.pontosFortes,
  };
}

/**
 * Envia a candidatura.
 * - Com token do Freelancer: submete o LANCE REAL via API (placeBid), usando o
 *   valor/prazo confirmados pelo usuário (copiloto 1-clique). Só marca como
 *   "enviada" se o lance for aceito pela plataforma.
 * - Sem token: apenas registra o envio (modo manual/copiar-e-colar).
 */
export async function sendApplication(
  applicationId: string,
  opts?: { amount?: number; period?: number; propostaTexto?: string },
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { include: { channel: true } } },
  });
  if (!application) throw new Error("Candidatura não encontrada.");

  // Usa o texto editado pelo usuário (se veio) e garante que nenhum link de
  // portfólio aponte para localhost — sempre a base pública (Render).
  const propostaFinal = publicizeUrls(
    (opts?.propostaTexto?.trim() || application.propostaTexto) ?? "",
  );

  const job = application.job;
  const userId = job.channel.userId;
  // Lance real só no Freelancer (tem API). Outros canais são copiloto: o
  // usuário aplica no site e a gente só registra o envio.
  const isFreelancer = job.channel.tipo === "freelancer";
  const token = isFreelancer ? await getValidToken(userId) : null;

  let bidId: number | null = null;
  if (token) {
    const projectId = Number(job.externalId);
    if (!Number.isFinite(projectId)) {
      throw new Error("ID do projeto inválido para envio de lance.");
    }
    const amount = opts?.amount ?? parseValor(application.valorSugerido);
    const period = opts?.period ?? parsePrazo(application.prazoSugerido);
    if (!amount || amount <= 0) {
      throw new Error("Informe um valor de lance maior que zero.");
    }
    const self = await getSelfProfile(token);
    const bid = await placeBid(token, {
      projectId,
      bidderId: self.id,
      amount,
      period: period > 0 ? period : 7,
      description: propostaFinal,
    });
    bidId = bid?.id ?? null;
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: "enviada",
      enviadaEm: new Date(),
      propostaTexto: propostaFinal,
      ...(bidId ? { bidExternalId: String(bidId) } : {}),
    },
  });

  return {
    applicationId: updated.id,
    status: updated.status,
    bidId,
    real: Boolean(token),
  };
}

/** Remove uma candidatura do acompanhamento (não mexe no Freelancer). */
export async function deleteApplication(applicationId: string) {
  await prisma.application.delete({ where: { id: applicationId } });
  return { ok: true };
}

/**
 * Sincroniza o status dos lances enviados com o Freelancer (polling).
 * Lê o award_status de cada lance e atualiza a candidatura + registra eventos.
 * Tudo leitura — não consome cota de bids.
 */
export async function syncBidStatuses(userId: string) {
  const token = await getValidToken(userId);
  if (!token) return { synced: 0, updated: 0 };

  const apps = await prisma.application.findMany({
    where: {
      job: { channel: { userId } },
      bidExternalId: { not: null },
      status: { in: ["enviada", "shortlist"] },
    },
  });
  if (!apps.length) return { synced: 0, updated: 0 };

  const bidIds = apps
    .map((a) => Number(a.bidExternalId))
    .filter((n) => Number.isFinite(n));
  const bids = await getBids(token, bidIds);
  const byId = new Map(bids.map((b) => [b.id, b]));

  let updated = 0;
  for (const app of apps) {
    const b = byId.get(Number(app.bidExternalId));
    if (!b) continue;

    let novo = app.status;
    if (b.award_status === "awarded") novo = "aceita";
    else if (b.award_status === "rejected" || b.award_status === "revoked")
      novo = "recusada";
    else if (b.shortlisted) novo = "shortlist";

    if (novo !== app.status) {
      await prisma.application.update({
        where: { id: app.id },
        data: {
          status: novo,
          respostaRecebidaEm: new Date(),
          events: {
            create: {
              tipo: novo,
              payload: JSON.stringify({
                award_status: b.award_status,
                shortlisted: b.shortlisted,
              }),
            },
          },
        },
      });
      updated++;
    }
  }

  return { synced: apps.length, updated };
}
