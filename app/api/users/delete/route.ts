import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { deleteUser } from "@/lib/users";

const schema = z.object({ userId: z.string().min(1) });

/** Exclui um perfil e tudo dele (cascata). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  try {
    await deleteUser(parsed.data.userId);
    return Response.json({ ok: true });
  } catch (e) {
    logError("api/users/delete", e, { userId: parsed.data.userId });
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
