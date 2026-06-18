const BASE = "https://api.magnific.com";
// Seedream 4.5 Edit: trava a identidade do personagem entre as cenas
// (aceita até 5 imagens de referência). Bem melhor que o Flux p/ "mesma pessoa".
const SEEDREAM = "/v1/ai/text-to-image/seedream-v4-5-edit";

function apiKey(): string {
  const k = process.env.MAGNIFIC_API_KEY;
  if (!k) throw new Error("MAGNIFIC_API_KEY não configurada no .env.");
  return k;
}

export type AspectRatio =
  | "square_1_1"
  | "classic_4_3"
  | "traditional_3_4"
  | "widescreen_16_9"
  | "social_story_9_16"
  | "standard_3_2"
  | "portrait_2_3"
  | "horizontal_2_1"
  | "vertical_1_2"
  | "social_post_4_5";

interface TaskData {
  task_id: string;
  status: string; // CREATED | IN_PROGRESS | COMPLETED | FAILED
  generated: string[];
}

async function postSeedream(body: unknown): Promise<string> {
  const res = await fetch(`${BASE}${SEEDREAM}`, {
    method: "POST",
    headers: {
      "x-magnific-api-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Magnific POST falhou (${res.status}): ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  const task = json.data as TaskData;
  if (!task?.task_id) throw new Error("Magnific não retornou task_id.");
  return task.task_id;
}

async function pollSeedream(
  taskId: string,
  timeoutMs = 120_000,
): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${BASE}${SEEDREAM}/${taskId}`, {
      headers: { "x-magnific-api-key": apiKey() },
    });
    const json = await res.json();
    const data = json.data as TaskData;
    if (data?.status === "COMPLETED") {
      const url = data.generated?.[0];
      if (!url) throw new Error("Magnific concluiu sem imagem.");
      return url;
    }
    if (data?.status === "FAILED") {
      throw new Error("Geração no Magnific falhou.");
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error("Tempo esgotado aguardando o Magnific.");
}

/**
 * Gera uma imagem mantendo consistência com as fotos de referência.
 * @param referencesDataUri fotos do usuário como data URI base64 (até 4).
 * Retorna a URL efêmera do resultado (baixe e salve em seguida).
 */
export async function generateWithReferences(params: {
  prompt: string;
  referencesDataUri: string[];
  aspectRatio?: AspectRatio;
}): Promise<string> {
  const taskId = await postSeedream({
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio ?? "square_1_1",
    reference_images: params.referencesDataUri.slice(0, 5),
  });
  return pollSeedream(taskId);
}
