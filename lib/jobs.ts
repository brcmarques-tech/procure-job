import { generateJSON } from "./claude";
import type { ProfileDraft } from "./profile";
import type { FreelancerProject } from "./freelancer";

export interface ScoredJob {
  score: number; // 0-100
  motivo: string;
}

type JobLite = Pick<FreelancerProject, "title" | "description" | "jobs">;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Módulo 3 — Caça de vagas (scoring com IA, em LOTE).
 * Em vez de uma chamada de IA por vaga (lento: N sessões do Claude Code),
 * manda TODAS as vagas num único prompt e recebe as notas de todas de uma
 * vez. Mesma inteligência do Claude para filtrar, mas 1 sessão em vez de N.
 *
 * Devolve um array alinhado por índice com `jobs` (vaga i → resultado i).
 */
export async function scoreJobsBatch(
  profile: ProfileDraft,
  jobs: JobLite[],
): Promise<ScoredJob[]> {
  if (!jobs.length) return [];

  const lista = jobs
    .map((j, i) => {
      const skills = (j.jobs ?? []).map((x) => x.name).join(", ");
      const desc = (j.description ?? "").replace(/\s+/g, " ").slice(0, 600);
      return `#${i} | ${j.title}\nSkills exigidas: ${skills || "—"}\n${desc}`;
    })
    .join("\n\n");

  const res = await generateJSON<{
    scores: { i: number; score: number; motivo: string }[];
  }>({
    model: "fast",
    maxTokens: 4000,
    system:
      "Você avalia o quanto CADA vaga combina com o perfil de um freelancer. " +
      "Considere área, skills e experiência. Nota alta só quando há real " +
      "compatibilidade técnica. " +
      "NUNCA se recuse a avaliar e NUNCA peça mais informações: mesmo que uma " +
      "vaga tenha pouca descrição, dê a nota com base no título e no que " +
      "houver — se faltar contexto, atribua nota mediana/baixa e diga isso no " +
      "motivo. Toda vaga DEVE receber uma nota. " +
      'Responda APENAS com JSON {"scores":[{"i":number,"score":number 0-100,"motivo":string}]} ' +
      "cobrindo TODAS as vagas, referenciando cada uma pelo índice #i. " +
      "Não escreva NENHUM texto fora do JSON. motivo = 1 frase curta em português.",
    user:
      `Perfil do freelancer:\n${JSON.stringify(
        { area: profile.area, skills: profile.skills, resumoBio: profile.resumoBio },
        null,
        2,
      )}\n\n` +
      `Vagas (avalie cada uma pelo índice #i):\n${lista}`,
  });

  const byIndex = new Map(res.scores?.map((s) => [s.i, s]) ?? []);
  return jobs.map((_, i) => {
    const s = byIndex.get(i);
    return s
      ? { score: clamp(s.score), motivo: s.motivo ?? "" }
      : { score: 0, motivo: "Sem avaliação da IA." };
  });
}
