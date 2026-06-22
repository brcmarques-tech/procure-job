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
  // Serve tanto o portfólio principal quanto as versões focadas em vaga.
  const portfolio =
    (await prisma.portfolio.findUnique({ where: { publicSlug: slug } })) ??
    (await prisma.portfolioVaga.findUnique({ where: { publicSlug: slug } }));

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
<style>
/* Baseline responsivo — blinda o layout no celular mesmo se o CSS gerado
   escorregar (sem overflow horizontal; imagens/mídia nunca estouram). */
*,*::before,*::after{box-sizing:border-box}
html{font-size:16px;-webkit-text-size-adjust:100%}
html,body{max-width:100%;overflow-x:hidden}
body{margin:0;padding:0}
img,svg,video,canvas,iframe{max-width:100%;height:auto}
/* Links/palavras longas nunca forçam scroll horizontal no celular. */
a,p,h1,h2,h3,li{overflow-wrap:anywhere}
</style>
<style>${portfolio.css}</style>
</head>
<body>${portfolio.html}</body>
</html>`;

  return new Response(doc, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
