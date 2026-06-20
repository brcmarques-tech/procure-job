import { generateJSON } from "./claude";
import type { ProfileDraft } from "./profile";

export interface ProposalOutput {
  proposta: string;
  valorSugerido: string;
  prazoSugerido: string;
  pontosFortes: string[];
}

/**
 * Módulo 4 — Motor de proposta (o coração da ferramenta).
 * Estuda a vaga e escreve uma proposta personalizada e NATURAL (anti-robô),
 * com o objetivo de conseguir entrevistas.
 *
 * Recebe o BUDGET e as SKILLS da vaga (quando existem) para que o valor
 * sugerido caia dentro da faixa do cliente — sem isso a IA chutava valores
 * fora do mínimo do projeto (erros BID_AMOUNT_INVALID) — e a proposta é
 * escrita no MESMO IDIOMA da vaga (vaga em inglês → proposta em inglês).
 */
export async function writeProposal(params: {
  profile: ProfileDraft;
  portfolioUrl: string;
  jobTitle: string;
  jobDescription: string;
  budget?: string | null; // faixa do cliente, ex.: "1000 - 2500"
  jobSkills?: string[]; // skills exigidas pela vaga
}): Promise<ProposalOutput> {
  const budgetLinha = params.budget
    ? `Orçamento do cliente (faixa): ${params.budget}. O valorSugerido DEVE ` +
      `cair dentro dessa faixa (perto do meio, ajustado pelo escopo). ` +
      `Use a MESMA moeda/unidade que aparecer na faixa.`
    : `Orçamento não informado — proponha um valor coerente com o escopo da vaga.`;

  const skillsLinha =
    params.jobSkills && params.jobSkills.length
      ? `Skills exigidas pela vaga: ${params.jobSkills.join(", ")}. ` +
        `Conecte as do perfil que casam com essas.`
      : "";

  return generateJSON<ProposalOutput>({
    model: "smart",
    maxTokens: 1500,
    system: [
      "Você escreve propostas de freelancer que conseguem ENTREVISTAS.",
      "Regras:",
      "- Escreva a PROPOSTA no MESMO IDIOMA da vaga (título+descrição). Vaga em inglês → proposta em inglês; em português → em português.",
      "- Escreva em 1ª pessoa, no tom natural do profissional.",
      "- Abra referenciando algo ESPECÍFICO da vaga (nada genérico).",
      "- Use só experiências REAIS do perfil — nunca invente fatos.",
      "- Sem template, sem jargão de IA, sem frases batidas.",
      "- Tamanho humano e direto. Varie a estrutura entre propostas.",
      "- Mencione o portfólio de forma orgânica.",
      "- O valorSugerido deve respeitar o orçamento informado (mesma moeda/unidade da faixa).",
      "- pontosFortes: 2-4 bullets curtos de venda (no idioma da vaga).",
      "Responda APENAS com JSON no schema pedido.",
    ].join("\n"),
    user:
      `Perfil:\n${JSON.stringify(params.profile, null, 2)}\n\n` +
      `Portfólio: ${params.portfolioUrl}\n\n` +
      `VAGA:\nTítulo: ${params.jobTitle}\nDescrição: ${params.jobDescription}\n\n` +
      `${budgetLinha}\n${skillsLinha}\n\n` +
      `Devolva JSON: {"proposta": string, "valorSugerido": string, ` +
      `"prazoSugerido": string, "pontosFortes": string[]}.`,
  });
}
