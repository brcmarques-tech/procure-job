import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getValidToken } from "@/lib/freelancerAuth";
import { getSelfProfile, resolveJobIds } from "@/lib/freelancer";
import { optimizeFreelancerProfile } from "@/lib/profileOptimizer";
import type { ProfileDraft } from "@/lib/profile";

export const maxDuration = 120;

const schema = z.object({ userId: z.string().min(1) });

/**
 * Gera a otimização do perfil do Freelancer com IA: headline + bio (para o
 * usuário colar) e skills sugeridas já resolvidas em IDs (para aplicar via API).
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId } = parsed.data;

  const token = await getValidToken(userId);
  if (!token) {
    return Response.json(
      { error: "Conecte sua conta do Freelancer primeiro." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || !user.profile) {
    return Response.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  const procure: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  try {
    const current = await getSelfProfile(token);
    const opt = await optimizeFreelancerProfile(procure, current);

    // Resolve nomes -> IDs e remove o que o usuário já tem.
    const resolved = await resolveJobIds(token, opt.skillsToAdd);
    const haveIds = new Set(current.jobs.map((j) => j.id));
    const skills = resolved.filter((s) => !haveIds.has(s.id));

    return Response.json({
      headline: opt.headline,
      bio: opt.bio,
      resumoMudancas: opt.resumoMudancas,
      skills, // [{id, name}] prontas para aplicar
      current: {
        tagline: current.tagline,
        bio: current.profileDescription,
      },
    });
  } catch (e) {
    return Response.json(
      { error: "Falha ao otimizar: " + (e as Error).message },
      { status: 502 },
    );
  }
}
