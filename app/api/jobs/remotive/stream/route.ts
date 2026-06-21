import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { huntRemotiveJobs } from "@/lib/jobHunter";
import { denyIfNotOwner } from "@/lib/authGuard";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  userId: z.string().min(1),
  sources: z.array(z.string()).optional(),
});

/** Caça de vagas remotas (Remotive) com progresso ao vivo via SSE. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId, sources } = parsed.data;
  const deny = await denyIfNotOwner(req, userId);
  if (deny) return deny;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (e: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true; // cliente desconectou — para de tentar escrever
        }
      };

      const t0 = Date.now();
      const ticks = setInterval(
        () => send({ type: "tick", seconds: Math.round((Date.now() - t0) / 1000) }),
        1500,
      );

      try {
        const result = await huntRemotiveJobs(
          userId,
          (p) => send({ type: "status", ...p }),
          sources,
        );
        send({ type: "result", jobs: result.jobs });
      } catch (e) {
        logError("api/jobs/remotive/stream", e);
        send({ type: "error", message: (e as Error).message });
      } finally {
        clearInterval(ticks);
        send({ type: "done" });
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
