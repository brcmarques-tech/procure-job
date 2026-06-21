import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { getValidToken } from "@/lib/freelancerAuth";
import { addJobs, removeJobs, getSelfProfile } from "@/lib/freelancer";
import { denyIfNotOwner } from "@/lib/authGuard";

const schema = z.object({
  userId: z.string().min(1),
  addIds: z.array(z.number()).optional(),
  removeIds: z.array(z.number()).optional(),
});

/** Aplica mudanças de skills no perfil do Freelancer (adiciona/remove). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, addIds, removeIds } = parsed.data;
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;

  const token = await getValidToken(userId);
  if (!token) {
    return Response.json(
      { error: "Conecte sua conta do Freelancer primeiro." },
      { status: 400 },
    );
  }

  try {
    await addJobs(token, addIds ?? []);
    await removeJobs(token, removeIds ?? []);
    const profile = await getSelfProfile(token);
    return Response.json({ ok: true, jobs: profile.jobs });
  } catch (e) {
    logError("api/freelancer/profile/skills", e);
    return Response.json(
      { error: "Falha ao aplicar skills: " + (e as Error).message },
      { status: 502 },
    );
  }
}
