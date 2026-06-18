import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  // Não lança no import para não quebrar o build; quem usa trata a ausência.
  console.warn("ANTHROPIC_API_KEY não definida — preencha o .env antes de usar a IA.");
}

export const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Modelos centralizados — troque aqui se precisar.
export const MODELS = {
  smart: "claude-opus-4-8", // tarefas criativas: propostas, portfólio
  fast: "claude-haiku-4-5-20251001", // tarefas baratas: extração de perfil, score
} as const;

/** Extrai o primeiro objeto JSON do texto retornado pelo Claude. */
export function extractJson<T>(message: Anthropic.Message): T {
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Resposta da IA não continha JSON: " + text.slice(0, 200));
  }
  return JSON.parse(match[0]) as T;
}
