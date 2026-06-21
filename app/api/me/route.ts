import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAccountId, authEnabled } from "@/lib/authGuard";

export const runtime = "nodejs";

/** Conta logada (para mostrar nome + botão Sair). nome=null no modo aberto. */
export async function GET(req: NextRequest) {
  if (!authEnabled()) return Response.json({ nome: null });
  const accountId = await getAccountId(req);
  if (!accountId) return Response.json({ nome: null });
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { nome: true },
  });
  return Response.json({ nome: account?.nome ?? null });
}
