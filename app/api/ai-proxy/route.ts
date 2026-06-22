import type { NextRequest } from "next/server";
import { generateTextLocal } from "@/lib/claude";
import { safeEqual } from "@/lib/session";
import { logError } from "@/lib/logError";

export const runtime = "nodejs";
export const maxDuration = 300; // a IA pode demorar (sessão da assinatura)

/**
 * Proxy de IA — chamado pelo app ONLINE (Render) e executado no Claude LOCAL
 * do dono (assinatura). Protegido por um segredo compartilhado (AI_PROXY_SECRET).
 * Roda generateTextLocal direto (nunca re-encaminha), evitando loop.
 */
export async function POST(req: NextRequest) {
  // Falha FECHADA: sem segredo configurado (ou header ausente/errado) → 401.
  // Comparação timing-safe pra não vazar o segredo por tempo de resposta.
  const secret = process.env.AI_PROXY_SECRET;
  const provided = req.headers.get("x-ai-proxy-secret");
  if (!secret || !provided || !safeEqual(provided, secret)) {
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
    logError("api/ai-proxy", e);
    return Response.json({ error: "Falha na IA local." }, { status: 502 });
  }
}
