import type { NextRequest } from "next/server";
import { extractPdfText } from "@/lib/pdf";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Onboarding — recebe um CV em PDF (multipart/form-data, campo "file"),
 * extrai o texto e devolve para preencher o campo de descrição do perfil.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return Response.json(
      { error: "Envie um arquivo PDF." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "PDF muito grande (máx. 10 MB)." },
      { status: 400 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = await extractPdfText(bytes);
    if (!text || text.length < 20) {
      return Response.json(
        {
          error:
            "Não consegui extrair texto do PDF (pode ser um PDF escaneado/imagem). " +
            "Cole o conteúdo manualmente.",
        },
        { status: 422 },
      );
    }
    return Response.json({ text, chars: text.length });
  } catch (e) {
    return Response.json(
      { error: "Falha ao ler o PDF: " + (e as Error).message },
      { status: 502 },
    );
  }
}
