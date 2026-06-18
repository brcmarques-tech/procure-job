import { prisma } from "@/lib/db";

/**
 * Página pública do portfólio. Renderiza o HTML/CSS gerado como um
 * documento isolado (sem o layout/Tailwind do app), pronto para compartilhar.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const portfolio = await prisma.portfolio.findUnique({
    where: { publicSlug: slug },
  });

  if (!portfolio) {
    return new Response("Portfólio não encontrado.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const doc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portfólio</title>
<style>${portfolio.css}</style>
</head>
<body>${portfolio.html}</body>
</html>`;

  return new Response(doc, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
