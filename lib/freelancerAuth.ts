import { prisma } from "./db";
import { encryptString, decryptString } from "./credsCrypto";

/** Lê o JSON de credenciais (decifra se estiver cifrado; aceita legado em texto puro). */
function parseCreds(raw?: string | null): StoredCreds {
  if (!raw) return {};
  try {
    return JSON.parse(decryptString(raw));
  } catch {
    return {};
  }
}

const OAUTH_BASE =
  process.env.FREELANCER_OAUTH_BASE ?? "https://accounts.freelancer.com";

function cfg() {
  return {
    clientId: process.env.FREELANCER_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.FREELANCER_CLIENT_SECRET?.trim() ?? "",
    redirectUri:
      process.env.FREELANCER_REDIRECT_URI?.trim() ??
      "http://localhost:3000/api/freelancer/callback",
  };
}

export function isOAuthConfigured(): boolean {
  const { clientId, clientSecret } = cfg();
  return Boolean(clientId && clientSecret);
}

interface StoredCreds {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // epoch ms
  scope?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // segundos
  scope?: string;
  token_type?: string;
}

/** URL de autorização para iniciar o fluxo (redireciona o usuário). */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = cfg();
  const url = new URL(`${OAUTH_BASE}/oauth/authorise`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "basic");
  url.searchParams.set("prompt", "select_account consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function postToken(
  body: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Token endpoint falhou (${res.status}): ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return json as TokenResponse;
}

/** Troca o authorization code pelo access token. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = cfg();
  return postToken({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
}

async function refresh(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = cfg();
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
}

function credsFromResponse(t: TokenResponse, prev?: StoredCreds): StoredCreds {
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? prev?.refresh_token,
    expires_at: t.expires_in
      ? Date.now() + t.expires_in * 1000
      : prev?.expires_at,
    scope: t.scope ?? prev?.scope,
  };
}

/** Guarda as credenciais no canal "freelancer" do usuário. */
export async function storeToken(
  userId: string,
  t: TokenResponse,
): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
  });
  const prev: StoredCreds = parseCreds(channel?.credenciais);
  const creds = credsFromResponse(t, prev);
  const enc = encryptString(JSON.stringify(creds));
  await prisma.channel.upsert({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
    update: { credenciais: enc, modo: "auto" },
    create: {
      userId,
      tipo: "freelancer",
      modo: "auto",
      credenciais: enc,
    },
  });
}

/**
 * Token de acesso do perfil — APENAS a conexão PRÓPRIA (usada só para DAR LANCE).
 * A busca de vagas é pública e não passa por aqui. Sem conexão própria → null
 * (não usa conta de ninguém; o usuário conecta a sua para poder dar lance).
 */
export async function getValidToken(userId: string): Promise<string | null> {
  const channel = await prisma.channel.findUnique({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
  });
  const creds: StoredCreds = parseCreds(channel?.credenciais);

  if (creds.access_token) {
    const expiring =
      creds.expires_at && creds.expires_at < Date.now() + 60_000;
    if (expiring && creds.refresh_token && isOAuthConfigured()) {
      try {
        const t = await refresh(creds.refresh_token);
        await storeToken(userId, t);
        return t.access_token;
      } catch {
        // se o refresh falhar, segue com o token atual (pode ainda valer)
      }
    }
    return creds.access_token;
  }

  return null;
}

export async function isConnected(userId: string): Promise<boolean> {
  return Boolean(await getValidToken(userId));
}

/** Remove a conexão PRÓPRIA do perfil (limpa o token salvo). Não apaga o canal
 *  (evita cascata nos jobs) — só zera as credenciais. */
export async function disconnect(userId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
  });
  if (!channel) return;
  await prisma.channel.update({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
    data: { credenciais: encryptString(JSON.stringify({})) },
  });
}

export type ConnectionKind = "own" | "none";

/** Diz se o perfil tem conexão PRÓPRIA ("own", pra dar lance) ou não ("none"). */
export async function getConnectionKind(
  userId: string,
): Promise<ConnectionKind> {
  const channel = await prisma.channel.findUnique({
    where: { userId_tipo: { userId, tipo: "freelancer" } },
  });
  const creds = parseCreds(channel?.credenciais);
  return creds.access_token ? "own" : "none";
}
