import { searchRemotiveJobs } from "./remotive";

/**
 * Agregador de quadros de vagas remotas (APIs abertas, grátis).
 * Junta Remotive, RemoteOK, Arbeitnow e WeWorkRemotely numa busca só.
 * Fontes sem busca server-side são filtradas por palavra-chave localmente.
 */

export interface RemoteJob {
  source: string;
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
}

const UA = "procure-job/1.0 (+job search)";

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function matchesKeywords(job: RemoteJob, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const hay = norm(`${job.title} ${job.company} ${job.description}`);
  return keywords.some((k) => k && hay.includes(norm(k)));
}

/** Remotive — tem busca server-side. */
async function fromRemotive(query: string): Promise<RemoteJob[]> {
  const jobs = await searchRemotiveJobs(query, 15).catch(() => []);
  return jobs.map((j) => ({
    source: "Remotive",
    id: `rmt-${j.id}`,
    title: j.title,
    company: j.company,
    description: j.description,
    url: j.url,
  }));
}

/** RemoteOK — sem busca; devolve os mais recentes (filtramos depois). */
async function fromRemoteOK(): Promise<RemoteJob[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const arr = await res.json();
    return (Array.isArray(arr) ? arr : [])
      .filter((j) => j && j.id && j.position)
      .map((j) => ({
        source: "RemoteOK",
        id: `rok-${j.id}`,
        title: j.position,
        company: j.company ?? "",
        description: `${stripHtml(j.description ?? "")} ${(j.tags ?? []).join(" ")}`,
        url: j.url ?? "",
      }));
  } catch {
    return [];
  }
}

/** Arbeitnow — sem busca; filtra só remotas (board é bem europeu). */
async function fromArbeitnow(): Promise<RemoteJob[]> {
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = (await res.json())?.data ?? [];
    return (data as Array<Record<string, unknown>>)
      .filter((j) => j.remote)
      .map((j) => ({
        source: "Arbeitnow",
        id: `arb-${j.slug}`,
        title: String(j.title ?? ""),
        company: String(j.company_name ?? ""),
        description: `${stripHtml(String(j.description ?? ""))} ${((j.tags as string[]) ?? []).join(" ")}`,
        url: String(j.url ?? ""),
      }));
  } catch {
    return [];
  }
}

/** WeWorkRemotely — feed RSS (programação). */
async function fromWWR(): Promise<RemoteJob[]> {
  try {
    const res = await fetch(
      "https://weworkremotely.com/categories/remote-programming-jobs.rss",
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const tag = (block: string, t: string) => {
      const m = block.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
      return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    };
    return items
      .map((it) => {
        const rawTitle = tag(it, "title"); // "Empresa: Vaga"
        const sep = rawTitle.indexOf(": ");
        const company = sep > -1 ? rawTitle.slice(0, sep) : "";
        const title = sep > -1 ? rawTitle.slice(sep + 2) : rawTitle;
        const url = tag(it, "link");
        return {
          source: "WeWorkRemotely",
          id: `wwr-${url || rawTitle}`,
          title,
          company,
          description: stripHtml(tag(it, "description")),
          url,
        };
      })
      .filter((j) => j.title);
  } catch {
    return [];
  }
}

/** Busca agregada nas 4 fontes. Devolve vagas com link, sem duplicatas. */
export async function searchRemoteJobs(
  keywords: string[],
): Promise<RemoteJob[]> {
  const query = keywords.slice(0, 2).join(" ") || keywords[0] || "developer";
  const [rmt, rok, arb, wwr] = await Promise.all([
    fromRemotive(query),
    fromRemoteOK(),
    fromArbeitnow(),
    fromWWR(),
  ]);

  const merged = [
    ...rmt.slice(0, 15), // Remotive já veio filtrado pela busca
    ...rok.filter((j) => matchesKeywords(j, keywords)).slice(0, 12),
    ...arb.filter((j) => matchesKeywords(j, keywords)).slice(0, 8),
    ...wwr.filter((j) => matchesKeywords(j, keywords)).slice(0, 10),
  ];

  const seen = new Set<string>();
  const out: RemoteJob[] = [];
  for (const j of merged) {
    if (!j.url) continue; // sem link de aplicação não serve
    if (seen.has(j.url)) continue;
    seen.add(j.url);
    out.push(j);
  }
  return out;
}
