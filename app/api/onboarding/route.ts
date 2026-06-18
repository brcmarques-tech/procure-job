import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildProfile } from "@/lib/profile";

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
    return Response.json(
      { error: "Falha ao gerar o perfil: " + (e as Error).message },
      { status: 502 },
    );
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { nome },
    create: { nome, email },
  });

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

  return Response.json({ userId: user.id, profile: draft });
}
