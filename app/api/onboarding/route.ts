import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildProfile } from "@/lib/profile";
import { getAccountId, authEnabled } from "@/lib/authGuard";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  email: z.email("E-mail inválido."),
  rawInput: z.string().min(20, "Descreva você/seu currículo com mais detalhes."),
});

/**
 * M1 — Onboarding.
 * Recebe nome/e-mail + texto livre, gera o perfil canônico com a IA
 * e persiste User + Profile. Devolve o perfil estruturado para revisão.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { nome, email, rawInput } = parsed.data;

  let draft;
  try {
    draft = await buildProfile(rawInput);
  } catch (e) {
    logError("api/onboarding", e);
    return Response.json(
      { error: "Falha ao gerar o perfil: " + (e as Error).message },
      { status: 502 },
    );
  }

  // Perfil pertence à conta logada (e-mail é único POR conta). Em modo aberto
  // (sem login), accountId fica null. findFirst+create/update evita o problema
  // de upsert com chave composta nullable.
  const accountId = authEnabled() ? await getAccountId(req) : null;
  const existing = await prisma.user.findFirst({ where: { email, accountId } });
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { nome } })
    : await prisma.user.create({ data: { nome, email, accountId } });

  const profileData = {
    area: draft.area,
    skills: JSON.stringify(draft.skills),
    resumoBio: draft.resumoBio,
    experiencias: JSON.stringify(draft.experiencias),
    keywordsBusca: JSON.stringify(draft.keywordsBusca),
  };

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: profileData,
    create: { userId: user.id, ...profileData },
  });

  return Response.json({
    userId: user.id,
    profile: draft,
    lacunas: draft.lacunas ?? [],
  });
}
