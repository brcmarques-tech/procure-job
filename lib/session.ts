// Sessão assinada (HMAC-SHA256 via Web Crypto) — funciona tanto no edge
// (middleware) quanto no node (rotas). O cookie guarda "<accountId>.<hmacHex>";
// a assinatura prova que o accountId foi emitido pelo servidor, sem consultar
// o banco. Usa o segredo em SESSION_SECRET.

const enc = new TextEncoder();

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
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Gera o token de sessão assinado para um accountId. */
export async function signSession(accountId: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado.");
  const key = await keyFor(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(accountId));
  return `${accountId}.${toHex(sig)}`;
}

/** Valida o token e devolve o accountId, ou null se inválido/ausente. */
export async function verifySession(
  token: string | undefined | null,
): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const accountId = token.slice(0, i);
  const sigHex = token.slice(i + 1);
  const key = await keyFor(secret);
  const expected = toHex(
    await crypto.subtle.sign("HMAC", key, enc.encode(accountId)),
  );
  return safeEqual(sigHex, expected) ? accountId : null;
}
