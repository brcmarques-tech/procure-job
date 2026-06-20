import { prisma } from "./db";
import { notifyUser } from "./notify";

export interface TrackerItem {
  id: string;
  jobId: string;
  titulo: string;
  canal: string;
  status: string;
  modoEnvio: string;
  valorSugerido: string | null;
  prazoSugerido: string | null;
  enviadaEm: string | null;
  respostaRecebidaEm: string | null;
  portfolioVagaSlug: string | null; // versão do portfólio focada nesta vaga
}

/**
 * M6 — Tracker.
 * Lista as candidaturas do usuário e monta o funil por status.
 */
export async function listApplications(userId: string): Promise<{
  funnel: Record<string, number>;
  items: TrackerItem[];
}> {
  const apps = await prisma.application.findMany({
    where: { job: { channel: { userId } } },
    include: { job: { include: { channel: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Portfólios focados em vaga (para mostrar "ver/excluir" no acompanhamento).
  const pvs = await prisma.portfolioVaga.findMany({
    where: { userId },
    select: { jobId: true, publicSlug: true },
  });
  const slugByJob = new Map(pvs.map((p) => [p.jobId, p.publicSlug]));

  const items: TrackerItem[] = apps.map((a) => ({
    id: a.id,
    jobId: a.jobId,
    titulo: a.job.titulo,
    canal: a.job.channel.tipo,
    status: a.status,
    modoEnvio: a.modoEnvio,
    valorSugerido: a.valorSugerido,
    prazoSugerido: a.prazoSugerido,
    enviadaEm: a.enviadaEm?.toISOString() ?? null,
    respostaRecebidaEm: a.respostaRecebidaEm?.toISOString() ?? null,
    portfolioVagaSlug: slugByJob.get(a.jobId) ?? null,
  }));

  const funnel = {
    aguardando_envio: 0,
    enviada: 0,
    shortlist: 0,
    aceita: 0,
    recusada: 0,
  };
  for (const i of items) {
    if (i.status in funnel) funnel[i.status as keyof typeof funnel]++;
  }

  return { funnel, items };
}

/**
 * M6 — registra a resposta de uma empresa e notifica o usuário.
 * No MVP é acionado manualmente (simulação); em produção viria do
 * monitoramento de respostas (API do canal / caixa de e-mail).
 */
export async function registerResponse(applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { include: { channel: { include: { user: true } } } } },
  });
  if (!app) throw new Error("Candidatura não encontrada.");

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: "respondida", respostaRecebidaEm: new Date() },
  });

  await prisma.event.create({
    data: {
      applicationId,
      tipo: "respondida",
      payload: JSON.stringify({ origem: "simulado" }),
    },
  });

  const user = app.job.channel.user;
  await notifyUser({
    to: user.email,
    subject: `📩 Resposta na vaga: ${app.job.titulo}`,
    body:
      `Boa notícia, ${user.nome}! A empresa respondeu sua candidatura para ` +
      `"${app.job.titulo}". Acesse o painel para dar sequência.`,
  });

  return { applicationId: updated.id, status: updated.status };
}
