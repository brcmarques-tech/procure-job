import { generateJSON } from "./claude";
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
  return generateJSON<PortfolioOutput>({
    model: "smart",
    maxTokens: 8000,
    system:
      "Você é designer/dev front-end. Gere um portfólio profissional, moderno e responsivo, " +
      "sem frameworks nem dependências externas. " +
      'Responda APENAS com JSON {"html": string, "css": string}.',
    user:
      `Perfil:\n${JSON.stringify(profile, null, 2)}\n\n` +
      (instrucoes ? `Ajustes pedidos pelo usuário: ${instrucoes}\n\n` : "") +
      `Gere o site. html e css separados; o html NÃO deve incluir a tag <style> ` +
      `(o css é injetado separadamente).`,
  });
}
