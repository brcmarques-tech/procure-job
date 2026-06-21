import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { syncBidStatuses } from "@/lib/applications";
import { denyIfNotOwner } from "@/lib/authGuard";

const schema = z.object({ userId: z.string().min(1) });

/** M6 — sincroniza o status dos lances com o Freelancer (aceito/recusado/shortlist). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const deny = await denyIfNotOwner(req, parsed.data.userId);
  if (deny) return deny;
  try {
    const result = await syncBidStatuses(parsed.data.userId);
    return Response.json(result);
  } catch (e) {
    logError("api/applications/sync", e);
    return Response.json(
      { error: "Falha ao sincronizar status: " + (e as Error).message },
      { status: 502 },
    );
  }
}
