import { generateJSON } from "./claude";

export interface ProfileDraft {
  area: string;
  skills: string[];
  resumoBio: string;
  experiencias: { titulo: string; descricao: string; periodo?: string }[];
  keywordsBusca: string[];
}

/** Resultado do onboarding: o perfil + perguntas de follow-up quando o input é fraco. */
export interface ProfileBuildResult extends ProfileDraft {
  /**
   * Perguntas curtas e específicas para puxar mais informação REAL do usuário
   * quando o texto enviado é raso. Vazio quando o perfil já está completo.
   */
  lacunas: string[];
}

/**
 * Módulo 1 — Onboarding.
 * Recebe texto livre (CV colado ou respostas do onboarding) e estrutura
 * o perfil canônico do usuário.
 *
 * A IA PODE enriquecer a *apresentação* (melhorar a redação da bio, sugerir
 * skills claramente correlatas, propor uma headline forte) — mas é PROIBIDA
 * de fabricar fatos (empregos, clientes, projetos, certificações, datas que
 * o usuário não informou). Quando faltam dados para um perfil competitivo,
 * devolve `lacunas` com perguntas específicas em vez de inventar.
 */
export async function buildProfile(
  rawInput: string,
): Promise<ProfileBuildResult> {
  return generateJSON<ProfileBuildResult>({
    model: "fast",
    maxTokens: 2000,
    system:
      "Você estrutura o perfil profissional de um freelancer a partir de texto livre. " +
      "REGRA DE OURO: você pode melhorar a REDAÇÃO (escrever uma bio forte e clara) e " +
      "sugerir skills claramente correlatas ao que a pessoa disse, mas NUNCA invente " +
      "FATOS: nada de empregos, clientes, projetos, certificações, números ou datas que " +
      "o usuário não tenha informado. Inventar experiência queima o freelancer com o " +
      "contratante. Quando faltar informação para um perfil competitivo, NÃO preencha " +
      "com suposições — registre o que falta em 'lacunas'. " +
      "Responda APENAS com JSON válido no schema pedido, em português.",
    user:
      `Texto do usuário:\n"""${rawInput}"""\n\n` +
      `Devolva JSON: { "area": string, "skills": string[], "resumoBio": string, ` +
      `"experiencias": [{"titulo": string, "descricao": string, "periodo"?: string}], ` +
      `"keywordsBusca": string[], "lacunas": string[] }.\n` +
      `- skills: as informadas + correlatas ÓBVIAS (sem exagerar).\n` +
      `- experiencias: SOMENTE as que o usuário mencionou. Se ele não citou nenhuma, ` +
      `devolva [] (não invente).\n` +
      `- keywordsBusca: termos que usaríamos para buscar vagas compatíveis nas plataformas.\n` +
      `- lacunas: 2 a 4 perguntas curtas e específicas para o usuário completar o perfil ` +
      `(ex.: nível do idioma, exemplos de trabalho mesmo informais, tipo de vaga desejada). ` +
      `Use lacunas QUANDO o input for raso ou faltarem experiências/dados concretos. ` +
      `Se o perfil já estiver completo e forte, devolva lacunas: [].`,
  });
}
