import Anthropic from "@anthropic-ai/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Modelos centralizados — troque aqui se precisar.
export const MODELS = {
  smart: "claude-opus-4-8", // tarefas criativas: propostas, portfólio
  fast: "claude-haiku-4-5-20251001", // tarefas baratas: extração de perfil, score
} as const;

type ModelKey = keyof typeof MODELS;

/**
 * Provider dual-mode:
 * - Com ANTHROPIC_API_KEY definida → usa a API oficial (pay-as-you-go, p/ produção).
 * - Sem a key → usa o login do Claude Code (assinatura) via Agent SDK (dev/local).
 */
const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

export const AI_MODE = anthropic ? "api-key" : "claude-code";

function extractJsonText<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Resposta da IA não continha JSON: " + text.slice(0, 200));
  }
  return JSON.parse(match[0]) as T;
}

/** Geração de texto LOCAL: API key (se houver) ou assinatura do Claude Code. */
export async function generateTextLocal(opts: {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
}): Promise<string> {
  if (anthropic) {
    const msg = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  // Sem API key → usa a autenticação do Claude Code (assinatura).
  let out = "";
  const t0 = Date.now();
  console.log(`[claude-code] iniciando sessão (${opts.model})...`);
  for await (const message of query({
    prompt: `${opts.system}\n\n${opts.user}`,
    // Sem ferramentas (geração de texto puro); maxTurns folgado para
    // respostas grandes (ex.: portfólio HTML/CSS) não estourarem o limite.
    options: { allowedTools: [], maxTurns: 8, model: opts.model },
  })) {
    const m = message as { type?: string; subtype?: string; result?: string };
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `[claude-code] +${dt}s ${m.type ?? "?"}${m.subtype ? "/" + m.subtype : ""}`,
    );
    if (typeof m.result === "string") out = m.result;
  }
  return out;
}

/**
 * Geração de texto. Se AI_PROXY_URL estiver definido (caso do app no Render),
 * encaminha pro Claude LOCAL do dono (notebook + túnel) — assim a IA online usa
 * a assinatura, sem API key. Sem AI_PROXY_URL, gera localmente.
 */
async function generateText(opts: {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
}): Promise<string> {
  const proxyUrl = process.env.AI_PROXY_URL?.trim();
  if (proxyUrl) {
    try {
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-proxy-secret": process.env.AI_PROXY_SECRET ?? "",
        },
        body: JSON.stringify(opts),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      return data.text ?? "";
    } catch (e) {
      throw new Error(
        "Claude local indisponível — ligue o notebook e o túnel (ou configure a " +
          "ANTHROPIC_API_KEY no Render). Detalhe: " +
          (e as Error).message,
      );
    }
  }
  return generateTextLocal(opts);
}

/** Gera e devolve um objeto JSON validado a partir de um prompt. */
export async function generateJSON<T>(opts: {
  system: string;
  user: string;
  model: ModelKey;
  maxTokens?: number;
}): Promise<T> {
  const run = (extra: string) =>
    generateText({
      system: opts.system + extra,
      user: opts.user,
      model: MODELS[opts.model],
      maxTokens: opts.maxTokens ?? 2000,
    });

  const text = await run("");
  try {
    return extractJsonText<T>(text);
  } catch {
    // Às vezes o modelo responde em prosa (ex.: "não consigo avaliar...").
    // Reforça a instrução e tenta uma vez antes de desistir.
    const retry = await run(
      "\n\nIMPORTANTE: responda SOMENTE com o objeto JSON pedido, " +
        "sem nenhum texto antes ou depois e sem se recusar.",
    );
    return extractJsonText<T>(retry);
  }
}
