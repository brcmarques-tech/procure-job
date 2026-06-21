import { prisma } from "./db";
import {
  searchActiveProjects,
  bidRestriction,
  MOCK_PROJECTS,
  type FreelancerProject,
} from "./freelancer";
import { scoreJobsBatch } from "./jobs";
import { searchRemoteJobs, REMOTE_SOURCES } from "./remoteSources";
import type { ProfileDraft } from "./profile";

/** Score mínimo para uma vaga ser considerada elegível para candidatura. */
export const SCORE_THRESHOLD = 60;

/** Teto de vagas pontuadas por busca — controla custo de IA e tempo. */
const MAX_TO_SCORE = 40;

export interface HuntedJob {
  externalId: string;
  titulo: string;
  descricao: string; // p/ salvar/preparar sem reconsultar a plataforma
  skills: string[];
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

  let projects: FreelancerProject[] = [];
  let mode: "api" | "mock" = "api";

  emit({ phase: "search", message: "Buscando vagas no Freelancer..." });

  // Busca PÚBLICA — não usa conta de ninguém. O token (conexão própria) só é
  // necessário pra DAR LANCE, não pra pesquisar.
  try {
    const keywords = profile.keywordsBusca.slice(0, 3);
    const results = await Promise.all(
      keywords.map((k) => searchActiveProjects(k).catch(() => [])),
    );
    const byId = new Map<number, FreelancerProject>();
    for (const p of results.flat()) byId.set(p.id, p);
    projects = [...byId.values()];
  } catch {
    projects = [];
  }
  // Sem resultados (ou API fora do ar) → cai no modo demonstração.
  if (projects.length === 0) {
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
    message: `Claude avaliou ${scores.length} vagas em ${segundos}s.`,
  });

  // A busca NÃO persiste — só pontua e devolve. O Job só vai pro banco quando o
  // usuário curte ou prepara candidatura (lib/applications.saveJob).
  const hunted: HuntedJob[] = projects.map((p, i) => {
    const scored = scores[i];
    const elegivel = scored.score >= SCORE_THRESHOLD;
    const restricaoMotivo = bidRestriction(p.upgrades);
    const budget = p.budget
      ? `${p.budget.minimum ?? "?"} - ${p.budget.maximum ?? "?"}`
      : null;
    return {
      externalId: String(p.id),
      titulo: p.title,
      descricao: p.description,
      skills: (p.jobs ?? []).map((j) => j.name),
      budget,
      score: scored.score,
      motivo: scored.motivo,
      elegivel,
      restrita: Boolean(restricaoMotivo),
      restricaoMotivo,
    };
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
  sources?: string[],
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

  const escolhidas =
    sources && sources.length ? sources : REMOTE_SOURCES.map((s) => s.id);
  const labels = REMOTE_SOURCES.filter((s) => escolhidas.includes(s.id))
    .map((s) => s.label)
    .join(", ");
  emit({
    phase: "search",
    message: `Buscando vagas (${labels})...`,
  });

  let vagas = await searchRemoteJobs(profile.keywordsBusca, sources);
  const total = vagas.length;
  vagas = vagas.slice(0, MAX_TO_SCORE);
  emit({
    phase: "searched",
    message: `${total} vagas remotas encontradas — avaliando as ${vagas.length} mais relevantes.`,
    count: vagas.length,
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
  emit({ phase: "scored", message: `Avaliação concluída.` });

  // Não persiste — só pontua e devolve (salva ao curtir/preparar).
  const hunted: HuntedJob[] = vagas.map((v, i) => {
    const scored = scores[i];
    const elegivel = scored.score >= SCORE_THRESHOLD;
    return {
      externalId: String(v.id),
      titulo: v.title,
      descricao: v.description,
      skills: [],
      budget: v.budget ?? null,
      score: scored.score,
      motivo: scored.motivo,
      elegivel,
      url: v.url,
      empresa: v.company,
      fonte: v.source,
    };
  });

  hunted.sort((a, b) => b.score - a.score);
  return { jobs: hunted };
}
