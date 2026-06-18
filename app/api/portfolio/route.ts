import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generatePortfolio } from "@/lib/portfolio";
import { slugify } from "@/lib/slug";
import type { ProfileDraft } from "@/lib/profile";

const schema = z.object({
  userId: z.string().min(1),
  instrucoes: z.string().optional(),
});

/**
 * M2 — Gerador de portfólio.
 * Carrega o perfil do usuário, gera HTML/CSS com a IA e publica num slug.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, instrucoes } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) {
    return Response.json(
      { error: "Perfil não encontrado. Gere o perfil primeiro." },
      { status: 404 },
    );
  }

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  let out;
  try {
    out = await generatePortfolio(profile, instrucoes);
  } catch (e) {
    return Response.json(
      { error: "Falha ao gerar o portfólio: " + (e as Error).message },
      { status: 502 },
    );
  }

  // Slug estável por usuário (não muda em regenerações).
  const existing = await prisma.portfolio.findUnique({ where: { userId } });
  const slug = existing?.publicSlug ?? `${slugify(user.nome)}-${userId.slice(-4)}`;

  const data = {
    html: out.html,
    css: out.css,
    publicSlug: slug,
    status: "publicado",
  };
  await prisma.portfolio.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return Response.json({ slug, html: out.html, css: out.css });
}
