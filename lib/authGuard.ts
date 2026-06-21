import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/session";

export const SESSION_COOKIE = "pj_session";

/** Se o login multi-conta está ativo (depende de SESSION_SECRET estar setado).
 *  Sem ele, o app roda em modo "aberto" (sem escopo), pra deployar sem travar. */
export function authEnabled(): boolean {
  return Boolean(process.env.SESSION_SECRET);
}

/** accountId da conta logada (cookie de sessão assinado). null se não logado. */
export async function getAccountId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** Garante que o userId pertence à conta logada; lança se não. No modo aberto
 *  (sem SESSION_SECRET) não escopa nada. */
export async function assertOwnsUser(
  accountId: string | null,
  userId: string,
): Promise<void> {
  if (!authEnabled()) return; // modo aberto
  if (!accountId) throw new Error("Não autenticado.");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountId: true },
  });
  if (!user || user.accountId !== accountId) {
    throw new Error("Perfil não pertence à conta.");
  }
}

/** Atalho pra usar nas rotas: confere posse do userId e, se não for dono,
 *  devolve um Response 403 pronto. Em caso de sucesso devolve null.
 *  Uso: `const deny = await denyIfNotOwner(req, userId); if (deny) return deny;` */
export async function denyIfNotOwner(
  req: NextRequest,
  userId: string,
): Promise<Response | null> {
  try {
    const accountId = await getAccountId(req);
    await assertOwnsUser(accountId, userId);
    return null;
  } catch {
    return Response.json(
      { error: "Acesso negado a este perfil." },
      { status: 403 },
    );
  }
}

/** Igual a denyIfNotOwner, mas resolve a posse a partir de um applicationId
 *  (Application → Job → Channel → userId). */
export async function denyIfNotOwnerByApplication(
  req: NextRequest,
  applicationId: string,
): Promise<Response | null> {
  if (!authEnabled()) return null; // modo aberto
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { job: { select: { channel: { select: { userId: true } } } } },
  });
  const userId = app?.job.channel.userId;
  if (!userId) {
    return Response.json(
      { error: "Candidatura não encontrada." },
      { status: 404 },
    );
  }
  return denyIfNotOwner(req, userId);
}
