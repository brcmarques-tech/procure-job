import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { generateJSON } from "./claude";
import { generateWithReferences, type AspectRatio } from "./magnific";
import type { ProfileDraft } from "./profile";

export interface PortfolioImage {
  role: "hero" | "sobre" | "trabalho";
  url: string; // caminho público local (ex.: /generated/<userId>/hero.jpg)
  prompt: string;
}

interface ScenePlan {
  role: PortfolioImage["role"];
  prompt: string;
  aspectRatio: AspectRatio;
}

/**
 * Usa a IA para criar 3 descrições de cena fotorrealistas, coerentes com a
 * área/skills do freelancer — mantendo a MESMA pessoa das fotos de referência.
 */
async function planScenes(profile: ProfileDraft): Promise<ScenePlan[]> {
  const plan = await generateJSON<{ cenas: { role: string; prompt: string }[] }>(
    {
      model: "fast",
      maxTokens: 1200,
      system:
        "Você cria prompts em INGLÊS para um gerador de imagem fotorrealista. " +
        "As fotos de referência são da MESMA pessoa; os prompts devem retratá-la " +
        "em contexto profissional coerente com a área dela. Sempre inclua " +
        "'same person as reference, photorealistic, natural lighting'. " +
        "Responda APENAS com JSON.",
      user:
        `Área: ${profile.area}\nSkills: ${profile.skills.join(", ")}\n` +
        `Bio: ${profile.resumoBio}\n\n` +
        `Gere JSON {"cenas":[{"role":"hero","prompt":"..."},` +
        `{"role":"sobre","prompt":"..."},{"role":"trabalho","prompt":"..."}]}. ` +
        `hero = retrato profissional confiante (close/meia-distância). ` +
        `sobre = a pessoa em ambiente de trabalho condizente com a área. ` +
        `trabalho = a pessoa em ação executando o ofício dela. ` +
        `Prompts em inglês, ~30-45 palavras cada, fotorrealistas.`,
    },
  );

  const aspect: Record<string, AspectRatio> = {
    hero: "portrait_2_3",
    sobre: "standard_3_2",
    trabalho: "widescreen_16_9",
  };
  const roles: PortfolioImage["role"][] = ["hero", "sobre", "trabalho"];
  return roles.map((role) => {
    const found = plan.cenas.find((c) => c.role === role);
    return {
      role,
      prompt:
        (found?.prompt ?? `professional ${profile.area}, photorealistic`) +
        ". Keep the EXACT same face, hair and identity as the person in the " +
        "reference photos. Photorealistic, natural lighting, high detail.",
      aspectRatio: aspect[role],
    };
  });
}

async function downloadTo(url: string, destAbs: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destAbs, buf);
}

/**
 * Gera as 3 imagens do portfólio a partir das fotos de referência do usuário,
 * salva em /public/generated/<userId>/ e persiste a lista no Portfolio.
 */
export async function generatePortfolioImages(
  userId: string,
  referencesDataUri: string[],
): Promise<PortfolioImage[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, portfolio: true },
  });
  if (!user?.profile) throw new Error("Perfil não encontrado.");

  const profile: ProfileDraft = {
    area: user.profile.area,
    skills: JSON.parse(user.profile.skills),
    resumoBio: user.profile.resumoBio,
    experiencias: JSON.parse(user.profile.experiencias),
    keywordsBusca: JSON.parse(user.profile.keywordsBusca),
  };

  const scenes = await planScenes(profile);

  const outDir = path.join(process.cwd(), "public", "generated", userId);
  await mkdir(outDir, { recursive: true });

  const images: PortfolioImage[] = [];
  for (const scene of scenes) {
    const ephemeralUrl = await generateWithReferences({
      prompt: scene.prompt,
      referencesDataUri,
      aspectRatio: scene.aspectRatio,
    });
    const fileName = `${scene.role}.jpg`;
    await downloadTo(ephemeralUrl, path.join(outDir, fileName));
    images.push({
      role: scene.role,
      url: `/generated/${userId}/${fileName}`,
      prompt: scene.prompt,
    });
  }

  // Garante que exista um Portfolio para anexar as imagens.
  const slug =
    user.portfolio?.publicSlug ??
    `${user.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${userId.slice(-4)}`;
  await prisma.portfolio.upsert({
    where: { userId },
    update: { images: JSON.stringify(images) },
    create: { userId, publicSlug: slug, images: JSON.stringify(images) },
  });

  return images;
}
