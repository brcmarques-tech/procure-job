import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { updateUserContact } from "@/lib/users";
import { denyIfNotOwner } from "@/lib/authGuard";

const schema = z.object({
  userId: z.string().min(1),
  nome: z.string().min(1).optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  linkedin: z.string().optional(),
});

/** Atualiza o contato de um perfil (nome, email, telefone, LinkedIn). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, ...data } = parsed.data;
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;
  try {
    await updateUserContact(userId, data);
    return Response.json({ ok: true });
  } catch (e) {
    // email duplicado (constraint unique)
    if ((e as { code?: string }).code === "P2002") {
      return Response.json(
        { error: "Esse email já está em uso por outro perfil." },
        { status: 409 },
      );
    }
    logError("api/users/update", e, { userId });
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
