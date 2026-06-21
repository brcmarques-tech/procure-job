import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { signSession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/authGuard";

export const runtime = "nodejs";

const schema = z.object({
  master: z.string().min(1),
  nome: z.string().trim().min(2, "Nome muito curto."),
  senha: z.string().min(4, "Senha muito curta (mín. 4)."),
});

/**
 * Cadastro de conta — protegido pela senha mestre (env MASTER_PASSWORD).
 * Cria a conta com senha em hash e já loga (seta o cookie de sessão).
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error?.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { master, nome, senha } = parsed.data;

  const esperada = process.env.MASTER_PASSWORD;
  if (!esperada || master !== esperada) {
    return Response.json({ error: "Senha mestre incorreta." }, { status: 401 });
  }

  const existe = await prisma.account.findUnique({ where: { nome } });
  if (existe) {
    return Response.json(
      { error: "Já existe uma conta com esse nome." },
      { status: 409 },
    );
  }

  const account = await prisma.account.create({
    data: { nome, senhaHash: hashPassword(senha) },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(account.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
