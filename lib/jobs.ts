import { claude, MODELS, extractJson } from "./claude";
import type { ProfileDraft } from "./profile";
import type { FreelancerProject } from "./freelancer";

export interface ScoredJob {
  score: number; // 0-100
  motivo: string;
}

/**
 * Módulo 3 — Caça de vagas (parte de scoring).
 * Pontua a compatibilidade entre uma vaga e o perfil do usuário.
 * Só vira candidatura quem passa do limiar definido no orquestrador.
 */
export async function scoreJob(
  profile: ProfileDraft,
  job: Pick<FreelancerProject, "title" | "description" | "jobs">,
): Promise<ScoredJob> {
  const msg = await claude.messages.create({
    model: MODELS.fast,
    max_tokens: 500,
    system:
      "Você avalia o quanto uma vaga combina com o perfil de um freelancer. " +
      'Responda APENAS com JSON {"score": number (0-100), "motivo": string}.',
    messages: [
      {
        role: "user",
        content:
          `Perfil: ${JSON.stringify({ area: profile.area, skills: profile.skills })}\n\n` +
          `Vaga: ${job.title}\n${job.description}\n` +
          `Skills da vaga: ${(job.jobs ?? []).map((j) => j.name).join(", ")}`,
      },
    ],
  });
  return extractJson<ScoredJob>(msg);
}
