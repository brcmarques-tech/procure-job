import { prisma } from "./db";
import {
  searchActiveProjects,
  MOCK_PROJECTS,
  type FreelancerProject,
} from "./freelancer";
import { scoreJob } from "./jobs";
import { getValidToken } from "./freelancerAuth";
import type { ProfileDraft } from "./profile";

/** Score mínimo para uma vaga ser considerada elegível para candidatura. */
export const SCORE_THRESHOLD = 60;

export interface HuntedJob {
  externalId: string;
  titulo: string;
  budget: string | null;
  score: number;
  motivo: string;
  elegivel: boolean;
}

/**
 * M3 — Caça de vagas (Freelancer.com).
 * Busca projetos (API real com token, ou mock sem token), pontua a
 * compatibilidade com o perfil, persiste e devolve ordenado por score.
 */
export async function huntJobs(
  userId: string,
): Promise<{ mode: "api" | "mock"; jobs: HuntedJob[] }> {
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

  const channel = await prisma.channel.upsert({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
    update: {},
    create: { userId, tipo: "freelancer", modo: "auto" },
  });

  const hunted: HuntedJob[] = [];
  for (const p of projects) {
    const scored = await scoreJob(profile, {
      title: p.title,
      description: p.description,
      jobs: p.jobs,
    });
    const elegivel = scored.score >= SCORE_THRESHOLD;
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

    hunted.push({
      externalId: String(p.id),
      titulo: p.title,
      budget,
      score: scored.score,
      motivo: scored.motivo,
      elegivel,
    });
  }

  hunted.sort((a, b) => b.score - a.score);
  return { mode, jobs: hunted };
}
