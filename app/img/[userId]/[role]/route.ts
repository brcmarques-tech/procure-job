import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** Serve a imagem do portfólio guardada no banco (pública, durável). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string; role: string }> },
) {
  const { userId, role } = await params;
  const img = await prisma.generatedImage.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!img) {
    return new Response("Imagem não encontrada.", { status: 404 });
  }
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
