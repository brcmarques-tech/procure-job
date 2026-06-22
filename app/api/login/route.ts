import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { signSession, SESSION_TTL_SECONDS } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/authGuard";

export const runtime = "nodejs";

const schema = z.object({
  nome: z.string().min(1),
  senha: z.string().min(1),
});

/** Login por conta: confere nome + senha e grava o cookie de sessão assinado. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { nome, senha } = parsed.data;

  const account = await prisma.account.findUnique({ where: { nome } });
  if (!account || !verifyPassword(senha, account.senhaHash)) {
    return Response.json(
      { error: "Nome ou senha incorretos." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(account.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS, // 30 dias (igual à expiração da assinatura)
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
