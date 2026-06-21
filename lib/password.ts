import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Hash de senha com scrypt (nativo do node — sem dependência nova). Guardado
// como "salt:hash" (hex). Use só em rotas node (login/cadastro), nunca no edge.

/** Gera o hash "salt:hash" de uma senha. */
export function hashPassword(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Confere a senha contra o hash guardado (comparação timing-safe). */
export function verifyPassword(senha: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(senha, salt, 64);
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== test.length) return false;
  return timingSafeEqual(hashBuf, test);
}
