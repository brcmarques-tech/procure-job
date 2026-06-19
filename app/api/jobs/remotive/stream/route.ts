import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { z } from "zod";
import { huntRemotiveJobs } from "@/lib/jobHunter";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({ userId: z.string().min(1) });

/** Caça de vagas remotas (Remotive) com progresso ao vivo via SSE. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { userId } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (e: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };

      const t0 = Date.now();
      const ticks = setInterval(
        () => send({ type: "tick", seconds: Math.round((Date.now() - t0) / 1000) }),
        1500,
      );

      try {
        const result = await huntRemotiveJobs(userId, (p) =>
          send({ type: "status", ...p }),
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
