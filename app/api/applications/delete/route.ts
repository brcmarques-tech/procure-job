import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { deleteApplication } from "@/lib/applications";
import { denyIfNotOwnerByApplication } from "@/lib/authGuard";

const schema = z.object({ applicationId: z.string().min(1) });

/** M6 — descarta uma candidatura do acompanhamento. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const deny = await denyIfNotOwnerByApplication(req, parsed.data.applicationId);
  if (deny) return deny;
  try {
    const result = await deleteApplication(parsed.data.applicationId);
    return Response.json(result);
  } catch (e) {
    logError("api/applications/delete", e);
    return Response.json(
      { error: "Falha ao descartar: " + (e as Error).message },
      { status: 500 },
    );
  }
}
