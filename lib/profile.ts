import { claude, MODELS, extractJson } from "./claude";

export interface ProfileDraft {
  area: string;
  skills: string[];
  resumoBio: string;
  experiencias: { titulo: string; descricao: string; periodo?: string }[];
  keywordsBusca: string[];
}

/**
 * Módulo 1 — Onboarding.
 * Recebe texto livre (CV colado ou respostas do onboarding) e estrutura
 * o perfil canônico do usuário.
 */
export async function buildProfile(rawInput: string): Promise<ProfileDraft> {
  const msg = await claude.messages.create({
    model: MODELS.fast,
    max_tokens: 2000,
    system:
      "Você extrai e estrutura o perfil profissional de um freelancer a partir de texto livre. " +
      "Responda APENAS com JSON válido no schema pedido, em português.",
    messages: [
      {
        role: "user",
        content:
          `Texto do usuário:\n"""${rawInput}"""\n\n` +
          `Devolva JSON: { "area": string, "skills": string[], "resumoBio": string, ` +
          `"experiencias": [{"titulo": string, "descricao": string, "periodo"?: string}], ` +
          `"keywordsBusca": string[] }. ` +
          `keywordsBusca = termos que usaríamos para buscar vagas compatíveis nas plataformas.`,
      },
    ],
  });
  return extractJson<ProfileDraft>(msg);
}
