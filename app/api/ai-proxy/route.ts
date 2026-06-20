import type { NextRequest } from "next/server";
import { generateTextLocal } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 300; // a IA pode demorar (sessão da assinatura)

/**
 * Proxy de IA — chamado pelo app ONLINE (Render) e executado no Claude LOCAL
 * do dono (assinatura). Protegido por um segredo compartilhado (AI_PROXY_SECRET).
 * Roda generateTextLocal direto (nunca re-encaminha), evitando loop.
 */
export async function POST(req: NextRequest) {
  if (
    req.headers.get("x-ai-proxy-secret") !== (process.env.AI_PROXY_SECRET ?? "")
  ) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.system || !body?.user || !body?.model) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  try {
    const text = await generateTextLocal({
      system: String(body.system),
      user: String(body.user),
      model: String(body.model),
      maxTokens: Number(body.maxTokens) || 2000,
    });
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
