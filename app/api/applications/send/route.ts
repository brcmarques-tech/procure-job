import type { NextRequest } from "next/server";
import { z } from "zod";
import { sendApplication } from "@/lib/applications";

const schema = z.object({ applicationId: z.string().min(1) });

/** M5 — registra o envio da candidatura. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  try {
    const result = await sendApplication(parsed.data.applicationId);
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: "Falha ao registrar envio: " + (e as Error).message },
      { status: 502 },
    );
  }
}
