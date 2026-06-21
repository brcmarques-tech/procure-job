import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { denyIfNotOwner } from "@/lib/authGuard";

/**
 * Carrega o usuário + perfil canônico (+ portfólio publicado, se houver)
 * por userId. Usado pelas telas /portfolio e /vagas para reidratar o estado
 * sem depender da memória da página anterior.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, portfolio: true },
  });
  if (!user || !user.profile) {
    return Response.json(
      { error: "Perfil não encontrado." },
      { status: 404 },
    );
  }

  return Response.json({
    userId: user.id,
    nome: user.nome,
    email: user.email,
    profile: {
      area: user.profile.area,
      skills: JSON.parse(user.profile.skills),
      resumoBio: user.profile.resumoBio,
      experiencias: JSON.parse(user.profile.experiencias),
      keywordsBusca: JSON.parse(user.profile.keywordsBusca),
    },
    portfolio: user.portfolio
      ? {
          slug: user.portfolio.publicSlug,
          html: user.portfolio.html,
          css: user.portfolio.css,
          images: user.portfolio.images
            ? JSON.parse(user.portfolio.images)
            : [],
        }
      : null,
  });
}
