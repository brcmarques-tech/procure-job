import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { sendApplication } from "@/lib/applications";

const schema = z.object({
  applicationId: z.string().min(1),
  amount: z.number().positive().optional(),
  period: z.number().int().positive().optional(),
  propostaTexto: z.string().optional(),
});

/** M5 — envia a candidatura (lance real no Freelancer quando há token). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { applicationId, amount, period, propostaTexto } = parsed.data;
  try {
    const result = await sendApplication(applicationId, {
      amount,
      period,
      propostaTexto,
    });
    console.log(
      `[send] OK app=${applicationId} bid=${result.bidId ?? "-"} real=${result.real}`,
    );
    return Response.json(result);
  } catch (e) {
    logError("api/applications/send", e, { applicationId, amount, period });
    return Response.json(
      { error: "Falha ao enviar lance: " + (e as Error).message },
      { status: 502 },
    );
  }
}
