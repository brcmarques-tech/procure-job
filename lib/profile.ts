import { generateJSON } from "./claude";

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
  return generateJSON<ProfileDraft>({
    model: "fast",
    maxTokens: 2000,
    system:
      "Você extrai e estrutura o perfil profissional de um freelancer a partir de texto livre. " +
      "Responda APENAS com JSON válido no schema pedido, em português.",
    user:
      `Texto do usuário:\n"""${rawInput}"""\n\n` +
      `Devolva JSON: { "area": string, "skills": string[], "resumoBio": string, ` +
      `"experiencias": [{"titulo": string, "descricao": string, "periodo"?: string}], ` +
      `"keywordsBusca": string[] }. ` +
      `keywordsBusca = termos que usaríamos para buscar vagas compatíveis nas plataformas.`,
  });
}
