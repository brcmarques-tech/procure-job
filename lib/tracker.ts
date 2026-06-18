import { prisma } from "./db";
import { notifyUser } from "./notify";

export interface TrackerItem {
  id: string;
  titulo: string;
  canal: string;
  status: string;
  modoEnvio: string;
  enviadaEm: string | null;
  respostaRecebidaEm: string | null;
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

  const items: TrackerItem[] = apps.map((a) => ({
    id: a.id,
    titulo: a.job.titulo,
    canal: a.job.channel.tipo,
    status: a.status,
    modoEnvio: a.modoEnvio,
    enviadaEm: a.enviadaEm?.toISOString() ?? null,
    respostaRecebidaEm: a.respostaRecebidaEm?.toISOString() ?? null,
  }));

  const funnel = {
    rascunho: 0,
    aguardando_envio: 0,
    enviada: 0,
    respondida: 0,
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
