import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

// Criptografia das credenciais guardadas no banco (Channel.credenciais).
// AES-256-GCM. Chave em CREDS_KEY (hex de 64 chars = 32 bytes, ou qualquer
// string — derivada por sha256). Formato: "enc:v1:<iv>:<tag>:<ct>" (base64).
//
// IMPORTANTE: local e produção compartilham o MESMO banco, então CREDS_KEY
// precisa ser IGUAL nos dois — senão o que um cifra o outro não decifra.

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const k = process.env.CREDS_KEY?.trim();
  if (!k) return null;
  if (/^[0-9a-fA-F]{64}$/.test(k)) return Buffer.from(k, "hex");
  return createHash("sha256").update(k).digest(); // deriva 32 bytes de qualquer texto
}

/** Diz se um valor guardado já está cifrado. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Cifra um texto. Sem CREDS_KEY, devolve o texto como está (modo aberto/local). */
export function encryptString(plain: string): string {
  const k = key();
  if (!k) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ct].map((b) => b.toString("base64")).join(":");
}

/** Decifra um valor. Texto puro (legado, sem prefixo) é devolvido como veio. */
export function decryptString(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const k = key();
  if (!k) throw new Error("CREDS_KEY ausente para decifrar as credenciais.");
  const [, , ivB64, tagB64, ctB64] = stored.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    k,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
