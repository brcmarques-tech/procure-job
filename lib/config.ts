import { prisma } from "./db";

/** URL atual do túnel pro Claude local (ou null se o notebook está offline). */
export async function getAiProxyUrl(): Promise<string | null> {
  const c = await prisma.appConfig.findUnique({ where: { id: "singleton" } });
  return c?.aiProxyUrl ?? null;
}

/** O notebook publica aqui a URL do túnel ao ligar (ou null ao desligar). */
export async function setAiProxyUrl(url: string | null): Promise<void> {
  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: { aiProxyUrl: url },
    create: { id: "singleton", aiProxyUrl: url },
  });
}
