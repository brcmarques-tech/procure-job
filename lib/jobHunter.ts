import { prisma } from "./db";
import {
  searchActiveProjects,
  bidRestriction,
  MOCK_PROJECTS,
  type FreelancerProject,
} from "./freelancer";
import { scoreJobsBatch } from "./jobs";
import { getValidToken } from "./freelancerAuth";
import { searchRemoteJobs } from "./remoteSources";
import type { ProfileDraft } from "./profile";

/** Score mínimo para uma vaga ser considerada elegível para candidatura. */
export const SCORE_THRESHOLD = 60;

/** Teto de vagas pontuadas por busca — controla custo de IA e tempo. */
const MAX_TO_SCORE = 40;
/** Quantas pontuações de IA rodam ao mesmo tempo. */
const SCORE_CONCURRENCY = 8;

/** map com limite de concorrência (evita disparar N chamadas de IA de uma vez). */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return out;
}

export interface HuntedJob {
  externalId: string;
  titulo: string;
  budget: string | null;
  score: number;
  motivo: string;
  elegivel: boolean;
  url?: string | null; // link para aplicar (canais copiloto, ex.: Remotive)
  empresa?: string | null;
  fonte?: string | null; // quadro de origem (Remotive, RemoteOK, ...)
  restrita?: boolean; // não dá pra dar lance (conta gratuita)
  restricaoMotivo?: string | null; // por quê (ex.: só Preferred Freelancers)
}

/** Evento de progresso emitido durante a caça (para a UI ao vivo). */
export interface HuntProgress {
  phase: "search" | "searched" | "scoring" | "scored" | "persist";
  message: string;
  count?: number;
}

/**
 * M3 — Caça de vagas (Freelancer.com).
 * Busca projetos (API real com token, ou mock sem token), pontua a
 * compatibilidade com o perfil, persiste e devolve ordenado por score.
 */
export async function huntJobs(
  userId: string,
  onEvent?: (e: HuntProgress) => void,
): Promise<{ mode: "api" | "mock"; jobs: HuntedJob[] }> {
  const emit = (e: HuntProgress) => onEvent?.(e);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) throw new Error("Perfil não encontrado.");

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  const token = await getValidToken(userId);
  let projects: FreelancerProject[] = [];
  let mode: "api" | "mock";

  emit({
    phase: "search",
    message: token
      ? "Buscando vagas reais no Freelancer..."
      : "Buscando vagas (modo demonstração)...",
  });

  if (token) {
    mode = "api";
    const keywords = profile.keywordsBusca.slice(0, 3);
    const results = await Promise.all(
      keywords.map((k) => searchActiveProjects(token, k).catch(() => [])),
    );
    const byId = new Map<number, FreelancerProject>();
    for (const p of results.flat()) byId.set(p.id, p);
    projects = [...byId.values()];
  } else {
    mode = "mock";
    projects = MOCK_PROJECTS;
  }

  // Não pontua tudo: limita ao teto para não gastar IA em centenas de vagas.
  const totalEncontradas = projects.length;
  projects = projects.slice(0, MAX_TO_SCORE);
  emit({
    phase: "searched",
    message: `${totalEncontradas} vagas encontradas — avaliando as ${projects.length} mais relevantes.`,
    count: projects.length,
  });

  const channel = await prisma.channel.upsert({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
    update: {},
    create: { userId, tipo: "freelancer", modo: "auto" },
  });

  // Pontua TODAS as vagas com IA numa ÚNICA chamada (1 sessão, não N).
  emit({
    phase: "scoring",
    message: `Claude está avaliando ${projects.length} vagas contra o seu perfil...`,
    count: projects.length,
  });
  console.log(
    `[hunt] modo=${mode} — ${projects.length} vagas buscadas; pontuando com IA...`,
  );
  const t0 = Date.now();
  const scores = await scoreJobsBatch(
    profile,
    projects.map((p) => ({
      title: p.title,
      description: p.description,
      jobs: p.jobs,
    })),
  );
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[hunt] IA pontuou ${scores.length} vagas em ${segundos}s`);
  emit({
    phase: "scored",
    message: `Claude avaliou ${scores.length} vagas em ${segundos}s. Salvando...`,
  });

  // Persiste em paralelo (lotes) — agora só I/O de banco, sem IA por vaga.
  const hunted = await mapPool(
    projects.map((p, i) => ({ p, scored: scores[i] })),
    SCORE_CONCURRENCY,
    async ({ p, scored }) => {
    const elegivel = scored.score >= SCORE_THRESHOLD;
    const restricaoMotivo = bidRestriction(p.upgrades);
    const budget = p.budget
      ? `${p.budget.minimum ?? "?"} - ${p.budget.maximum ?? "?"}`
      : null;

    await prisma.job.upsert({
      where: {
        channelId_externalId: {
          channelId: channel.id,
          externalId: String(p.id),
        },
      },
      update: {
        score: scored.score,
        statusVaga: elegivel ? "elegivel" : "descartada",
      },
      create: {
        channelId: channel.id,
        externalId: String(p.id),
        titulo: p.title,
        descricao: p.description,
        budget,
        skills: JSON.stringify((p.jobs ?? []).map((j) => j.name)),
        score: scored.score,
        statusVaga: elegivel ? "elegivel" : "descartada",
      },
    });

    return {
      externalId: String(p.id),
      titulo: p.title,
      budget,
      score: scored.score,
      motivo: scored.motivo,
      elegivel,
      restrita: Boolean(restricaoMotivo),
      restricaoMotivo,
    } satisfies HuntedJob;
  });

  hunted.sort((a, b) => b.score - a.score);
  return { mode, jobs: hunted };
}

/**
 * Caça de vagas REMOTAS (Remotive — API aberta, grátis).
 * Busca, pontua com IA e persiste sob o canal "remotive" (copiloto: o usuário
 * aplica no link da vaga). Mesma experiência ao vivo da caça do Freelancer.
 */
export async function huntRemotiveJobs(
  userId: string,
  onEvent?: (e: HuntProgress) => void,
): Promise<{ jobs: HuntedJob[] }> {
  const emit = (e: HuntProgress) => onEvent?.(e);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) throw new Error("Perfil não encontrado.");

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  emit({
    phase: "search",
    message:
      "Buscando vagas (LinkedIn, Remotive, RemoteOK, Arbeitnow, WeWorkRemotely)...",
  });

  let vagas = await searchRemoteJobs(profile.keywordsBusca);
  const total = vagas.length;
  vagas = vagas.slice(0, MAX_TO_SCORE);
  emit({
    phase: "searched",
    message: `${total} vagas remotas encontradas — avaliando as ${vagas.length} mais relevantes.`,
    count: vagas.length,
  });

  const channel = await prisma.channel.upsert({
    where: { userId_tipo: { userId, tipo: "remotive" } },
    update: {},
    create: { userId, tipo: "remotive", modo: "copiloto" },
  });

  emit({
    phase: "scoring",
    message: `Claude está avaliando ${vagas.length} vagas remotas contra o seu perfil...`,
    count: vagas.length,
  });
  const scores = await scoreJobsBatch(
    profile,
    vagas.map((v) => ({ title: v.title, description: v.description })),
  );
  emit({ phase: "scored", message: `Avaliação concluída. Salvando...` });

  const hunted = await mapPool(
    vagas.map((v, i) => ({ v, scored: scores[i] })),
    SCORE_CONCURRENCY,
    async ({ v, scored }) => {
      const elegivel = scored.score >= SCORE_THRESHOLD;
      await prisma.job.upsert({
        where: {
          channelId_externalId: {
            channelId: channel.id,
            externalId: String(v.id),
          },
        },
        update: {
          score: scored.score,
          statusVaga: elegivel ? "elegivel" : "descartada",
        },
        create: {
          channelId: channel.id,
          externalId: String(v.id),
          titulo: v.title,
          descricao: v.description,
          budget: null,
          skills: "[]",
          score: scored.score,
          statusVaga: elegivel ? "elegivel" : "descartada",
        },
      });
      return {
        externalId: String(v.id),
        titulo: v.title,
        budget: null,
        score: scored.score,
        motivo: scored.motivo,
        elegivel,
        url: v.url,
        empresa: v.company,
        fonte: v.source,
      } satisfies HuntedJob;
    },
  );

  hunted.sort((a, b) => b.score - a.score);
  return { jobs: hunted };
}
