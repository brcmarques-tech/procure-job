import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { generateJSON } from "./claude";
import { generateWithReferences, type AspectRatio } from "./magnific";
import type { ProfileDraft } from "./profile";

export type ImageRole = "hero" | "sobre" | "trabalho";
export const IMAGE_ROLES: ImageRole[] = ["hero", "sobre", "trabalho"];

export interface PortfolioImage {
  role: ImageRole;
  url: string; // caminho público local + ?v=<versão> para cache-busting
  prompt: string;
}

const ASPECT: Record<ImageRole, AspectRatio> = {
  hero: "portrait_2_3",
  sobre: "standard_3_2",
  trabalho: "widescreen_16_9",
};

function refsDir(userId: string) {
  // Pasta PRIVADA (fora de /public, não servida na web) com as fotos de
  // referência, para permitir regenerar uma imagem sem reenviar tudo.
  return path.join(process.cwd(), "data", "refs", userId);
}
function outDir(userId: string) {
  return path.join(process.cwd(), "public", "generated", userId);
}

function withIdentity(prompt: string): string {
  return (
    prompt +
    ". Keep the EXACT same face, hair and identity as the person in the " +
    "reference photos. Photorealistic, natural lighting, high detail."
  );
}

interface ScenePlan {
  role: ImageRole;
  prompt: string;
}

/** A IA cria 3 descrições de cena coerentes com a área do freelancer. */
async function planScenes(profile: ProfileDraft): Promise<ScenePlan[]> {
  const plan = await generateJSON<{ cenas: { role: string; prompt: string }[] }>(
    {
      model: "fast",
      maxTokens: 1200,
      system:
        "Você cria prompts em INGLÊS para um gerador de imagem fotorrealista. " +
        "As fotos de referência são da MESMA pessoa; os prompts devem retratá-la " +
        "em contexto profissional coerente com a área dela. Responda APENAS com JSON.",
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

  return IMAGE_ROLES.map((role) => {
    const found = plan.cenas.find((c) => c.role === role);
    return {
      role,
      prompt: withIdentity(
        found?.prompt ?? `professional ${profile.area}, photorealistic`,
      ),
    };
  });
}

async function downloadTo(url: string, destAbs: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destAbs, buf);
}

async function saveRefs(userId: string, refs: string[]): Promise<void> {
  const dir = refsDir(userId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "refs.json"), JSON.stringify(refs));
}

async function loadRefs(userId: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(refsDir(userId), "refs.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Gera uma cena, baixa o arquivo e devolve a entrada (URL com versão). */
async function genOne(
  userId: string,
  role: ImageRole,
  prompt: string,
  refs: string[],
  version: number,
): Promise<PortfolioImage> {
  const ephemeralUrl = await generateWithReferences({
    prompt,
    referencesDataUri: refs,
    aspectRatio: ASPECT[role],
  });
  await mkdir(outDir(userId), { recursive: true });
  await downloadTo(ephemeralUrl, path.join(outDir(userId), `${role}.jpg`));
  return { role, url: `/generated/${userId}/${role}.jpg?v=${version}`, prompt };
}

/**
 * Persiste a lista de imagens e atualiza o HTML do portfólio existente para
 * apontar para a nova versão (cache-busting), sem precisar regenerar o site.
 */
async function persist(
  userId: string,
  userNome: string,
  existingHtml: string | undefined,
  existingSlug: string | undefined,
  images: PortfolioImage[],
  version: number,
  rolesToPatch: ImageRole[],
): Promise<void> {
  const slug =
    existingSlug ??
    `${userNome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${userId.slice(-4)}`;

  const data: { images: string; html?: string } = {
    images: JSON.stringify(images),
  };

  if (existingHtml) {
    let html = existingHtml;
    for (const role of rolesToPatch) {
      const re = new RegExp(
        `(/generated/${userId}/${role}\\.jpg)(\\?v=\\d+)?`,
        "g",
      );
      html = html.replace(re, `$1?v=${version}`);
    }
    data.html = html;
  }

  await prisma.portfolio.upsert({
    where: { userId },
    update: data,
    create: { userId, publicSlug: slug, ...data },
  });
}

async function loadUser(userId: string) {
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
  return { user, profile };
}

/**
 * Gera as 3 imagens a partir das fotos do usuário, salva as referências
 * (para regeneração individual depois) e persiste tudo.
 */
export async function generatePortfolioImages(
  userId: string,
  referencesDataUri: string[],
): Promise<PortfolioImage[]> {
  const { user, profile } = await loadUser(userId);
  await saveRefs(userId, referencesDataUri);

  const scenes = await planScenes(profile);
  const version = Date.now();

  const images: PortfolioImage[] = [];
  for (const scene of scenes) {
    images.push(
      await genOne(userId, scene.role, scene.prompt, referencesDataUri, version),
    );
  }

  await persist(
    userId,
    user.nome,
    user.portfolio?.html,
    user.portfolio?.publicSlug,
    images,
    version,
    IMAGE_ROLES,
  );
  return images;
}

/**
 * Regenera UMA imagem (uma role), mantendo as outras. Reaproveita as fotos
 * de referência salvas e o prompt da cena já existente.
 */
export async function regenerateOneImage(
  userId: string,
  role: ImageRole,
): Promise<{ images: PortfolioImage[]; image: PortfolioImage }> {
  const refs = await loadRefs(userId);
  if (!refs.length) {
    throw new Error(
      "Fotos de referência não encontradas. Gere as imagens novamente enviando suas fotos.",
    );
  }

  const { user, profile } = await loadUser(userId);
  const current: PortfolioImage[] = user.portfolio?.images
    ? JSON.parse(user.portfolio.images)
    : [];

  // Reaproveita o prompt da cena; se não houver, replaneja.
  let prompt = current.find((i) => i.role === role)?.prompt;
  if (!prompt) {
    const scenes = await planScenes(profile);
    prompt = scenes.find((s) => s.role === role)!.prompt;
  }

  const version = Date.now();
  const novo = await genOne(userId, role, prompt, refs, version);

  const merged: PortfolioImage[] = IMAGE_ROLES.map((r) =>
    r === role ? novo : current.find((i) => i.role === r),
  ).filter((x): x is PortfolioImage => Boolean(x));

  await persist(
    userId,
    user.nome,
    user.portfolio?.html,
    user.portfolio?.publicSlug,
    merged,
    version,
    [role],
  );

  return { images: merged, image: novo };
}
