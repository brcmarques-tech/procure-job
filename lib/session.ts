// Sessão assinada (HMAC-SHA256 via Web Crypto) — funciona tanto no edge
// (middleware) quanto no node (rotas). O cookie guarda "<accountId>.<hmacHex>";
// a assinatura prova que o accountId foi emitido pelo servidor, sem consultar
// o banco. Usa o segredo em SESSION_SECRET.

const enc = new TextEncoder();

/** Tempo de vida da sessão (assinatura E cookie usam este mesmo valor). */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

async function keyFor(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compara duas strings em tempo (quase) constante. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Gera o token de sessão assinado para um accountId, com expiração embutida.
 *  Formato: "<accountId>.<exp>.<hmacHex>" — a assinatura cobre "<accountId>.<exp>". */
export async function signSession(accountId: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado.");
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${accountId}.${exp}`;
  const key = await keyFor(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${toHex(sig)}`;
}

/** Valida o token (assinatura + expiração) e devolve o accountId, ou null se
 *  inválido/ausente/expirado. Tokens no formato antigo (sem exp) são recusados. */
export async function verifySession(
  token: string | undefined | null,
): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;

  // Separa pela direita: "<...payload...>.<hmacHex>", payload = "<accountId>.<exp>".
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const payload = token.slice(0, lastDot);
  const sigHex = token.slice(lastDot + 1);
  const expDot = payload.lastIndexOf(".");
  if (expDot <= 0) return null;
  const accountId = payload.slice(0, expDot);
  const expStr = payload.slice(expDot + 1);

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const key = await keyFor(secret);
  const expected = toHex(
    await crypto.subtle.sign("HMAC", key, enc.encode(payload)),
  );
  return safeEqual(sigHex, expected) ? accountId : null;
}
