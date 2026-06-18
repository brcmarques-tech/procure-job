import { claude, MODELS, extractJson } from "./claude";
import type { ProfileDraft } from "./profile";

export interface PortfolioOutput {
  html: string;
  css: string;
}

/**
 * Módulo 2 — Gerador de portfólio.
 * Gera HTML/CSS responsivo a partir do perfil. `instrucoes` permite
 * regenerar com ajustes pedidos pelo usuário ("mais minimalista" etc.).
 */
export async function generatePortfolio(
  profile: ProfileDraft,
  instrucoes?: string,
): Promise<PortfolioOutput> {
  const msg = await claude.messages.create({
    model: MODELS.smart,
    max_tokens: 8000,
    system:
      "Você é designer/dev front-end. Gere um portfólio profissional, moderno e responsivo, " +
      "sem frameworks nem dependências externas. " +
      'Responda APENAS com JSON {"html": string, "css": string}.',
    messages: [
      {
        role: "user",
        content:
          `Perfil:\n${JSON.stringify(profile, null, 2)}\n\n` +
          (instrucoes ? `Ajustes pedidos pelo usuário: ${instrucoes}\n\n` : "") +
          `Gere o site. html e css separados; o html NÃO deve incluir a tag <style> ` +
          `(o css é injetado separadamente).`,
      },
    ],
  });
  return extractJson<PortfolioOutput>(msg);
}
