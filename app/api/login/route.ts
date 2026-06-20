import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ senha: z.string().min(1) });

/** Login simples — confere a senha (env APP_PASSWORD) e grava o cookie. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const esperada = process.env.APP_PASSWORD;
  if (!esperada || parsed.data.senha !== esperada) {
    return Response.json({ error: "Senha incorreta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("pj_auth", esperada, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
