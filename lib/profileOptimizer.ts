import { generateJSON } from "./claude";
import type { ProfileDraft } from "./profile";
import type { FreelancerSelf } from "./freelancer";

export interface ProfileOptimization {
  headline: string;
  bio: string;
  /** Nomes de skills sugeridas para adicionar (resolvidas em IDs depois). */
  skillsToAdd: string[];
  /** O que mudou e por quê (para mostrar ao usuário). */
  resumoMudancas: string[];
}

/**
 * Gera uma versão otimizada do perfil do Freelancer a partir do perfil
 * estruturado (Procure.job) + o perfil atual na plataforma.
 *
 * REGRA: melhora a APRESENTAÇÃO (headline forte, bio escaneável, CTA) e sugere
 * skills que a pessoa CLARAMENTE tem mas não cadastrou — nunca inventa fatos.
 */
export async function optimizeFreelancerProfile(
  procure: ProfileDraft,
  current: FreelancerSelf,
): Promise<ProfileOptimization> {
  const currentSkills = current.jobs.map((j) => j.name);

  return generateJSON<ProfileOptimization>({
    model: "smart",
    maxTokens: 2000,
    system:
      "Você é especialista em perfis de freelancer de alta conversão na " +
      "Freelancer.com. Melhore a APRESENTAÇÃO sem inventar fatos: use somente o " +
      "que está nos dados fornecidos. A headline deve ser curta e forte " +
      "(stack + especialidade). A bio deve ser escaneável (valor primeiro, " +
      "bullets curtos, 1-2 emojis sutis) e terminar com um CTA. Sugira skills " +
      "que a pessoa CLARAMENTE possui (citadas na bio/perfil) mas faltam na " +
      "lista atual — sem repetir as que já existem. " +
      'Responda APENAS com JSON {"headline":string,"bio":string,' +
      '"skillsToAdd":string[],"resumoMudancas":string[]}.',
    user:
      `PERFIL ESTRUTURADO (Procure.job):\n${JSON.stringify(procure, null, 2)}\n\n` +
      `PERFIL ATUAL NO FREELANCER:\n` +
      `Headline: ${current.tagline ?? "(vazio)"}\n` +
      `Bio: ${current.profileDescription ?? "(vazio)"}\n` +
      `Skills atuais: ${currentSkills.join(", ") || "(nenhuma)"}\n\n` +
      `Gere a versão otimizada em português. skillsToAdd = nomes de skills do ` +
      `Freelancer que faltam (não repita as atuais). resumoMudancas = 3 a 5 ` +
      `frases curtas explicando o que melhorou e por quê.`,
  });
}
