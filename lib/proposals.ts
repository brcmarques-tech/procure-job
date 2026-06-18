import { claude, MODELS, extractJson } from "./claude";
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
 */
export async function writeProposal(params: {
  profile: ProfileDraft;
  portfolioUrl: string;
  jobTitle: string;
  jobDescription: string;
}): Promise<ProposalOutput> {
  const msg = await claude.messages.create({
    model: MODELS.smart,
    max_tokens: 1500,
    system: [
      "Você escreve propostas de freelancer que conseguem ENTREVISTAS.",
      "Regras:",
      "- Escreva em 1ª pessoa, no tom natural do profissional.",
      "- Abra referenciando algo ESPECÍFICO da vaga (nada genérico).",
      "- Sem template, sem jargão de IA, sem frases batidas.",
      "- Tamanho humano e direto. Varie a estrutura entre propostas.",
      "- Mencione o portfólio de forma orgânica.",
      "Responda APENAS com JSON no schema pedido.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content:
          `Perfil:\n${JSON.stringify(params.profile, null, 2)}\n\n` +
          `Portfólio: ${params.portfolioUrl}\n\n` +
          `VAGA:\nTítulo: ${params.jobTitle}\nDescrição: ${params.jobDescription}\n\n` +
          `Devolva JSON: {"proposta": string, "valorSugerido": string, ` +
          `"prazoSugerido": string, "pontosFortes": string[]}.`,
      },
    ],
  });
  return extractJson<ProposalOutput>(msg);
}
