import type { NextRequest } from "next/server";
import { generatePortfolioImages } from "@/lib/portfolioImages";

export const maxDuration = 300; // geração pode levar ~1 min

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por foto

/**
 * Recebe as fotos de referência do usuário (multipart, campo "files",
 * 1 a 4 imagens) + userId, e gera as 3 imagens do portfólio mantendo a
 * mesma pessoa. Retorna a lista de imagens geradas.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  const userId = form.get("userId");
  if (typeof userId !== "string" || !userId) {
    return Response.json({ error: "userId é obrigatório." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length < 1) {
    return Response.json(
      { error: "Envie ao menos 1 foto (ideal: 3)." },
      { status: 400 },
    );
  }
  if (files.length > 4) {
    return Response.json(
      { error: "Máximo de 4 fotos de referência." },
      { status: 400 },
    );
  }

  const referencesDataUri: string[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      return Response.json(
        { error: "Todos os arquivos devem ser imagens." },
        { status: 400 },
      );
    }
    if (f.size > MAX_BYTES) {
      return Response.json(
        { error: `Foto muito grande (máx. 8 MB): ${f.name}` },
        { status: 400 },
      );
    }
    const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    referencesDataUri.push(`data:${f.type};base64,${b64}`);
  }

  try {
    const images = await generatePortfolioImages(userId, referencesDataUri);
    return Response.json({ images });
  } catch (e) {
    return Response.json(
      { error: "Falha ao gerar imagens: " + (e as Error).message },
      { status: 502 },
    );
  }
}
