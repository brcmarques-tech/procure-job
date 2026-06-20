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

/**
 * LinkedIn — endpoint público "guest" de busca de vagas (o mesmo que carrega
 * a lista quando você navega vagas SEM estar logado). NÃO exige login nem
 * conta, não é bot: é descoberta de vaga pública; o usuário se candidata no
 * próprio LinkedIn (modelo copiloto). Uso em volume baixo — o LinkedIn pode
 * limitar por IP, e nesse caso a busca só volta vazia (degrada sem quebrar).
 */
const LI_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Extrai o 1º grupo de uma regex de um bloco HTML, já limpo. */
function pick(block: string, re: RegExp): string {
  const m = block.match(re);
  return m ? stripHtml(m[1]) : "";
}

/** Busca a descrição de uma vaga pelo endpoint guest (sem login). */
async function linkedInDescription(jobId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`,
      { headers: { "User-Agent": LI_UA, "Accept-Language": "en,pt;q=0.9" } },
    );
    if (!res.ok) return "";
    const html = await res.text();
    const m = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/);
    return m ? stripHtml(m[1]).slice(0, 1200) : "";
  } catch {
    return "";
  }
}

async function fromLinkedIn(query: string): Promise<RemoteJob[]> {
  try {
    const url = new URL(
      "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
    );
    url.searchParams.set("keywords", query);
    url.searchParams.set("f_TPR", "r2592000"); // último mês (vagas mais ativas)
    url.searchParams.set("start", "0");
    const res = await fetch(url, {
      headers: { "User-Agent": LI_UA, "Accept-Language": "en,pt;q=0.9" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const cards = html.match(/<li>[\s\S]*?<\/li>/g) ?? [];
    const jobs: RemoteJob[] = [];
    for (const c of cards) {
      const link =
        (c.match(
          /href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"?]+)/,
        ) ?? [])[1] ?? "";
      const urn =
        (c.match(/urn:li:jobPosting:(\d+)/) ?? [])[1] ??
        (link.match(/-(\d+)(?:\?|$)/) ?? [])[1] ??
        "";
      const title = pick(c, /base-search-card__title">([\s\S]*?)<\/h3>/);
      const company = pick(c, /base-search-card__subtitle">([\s\S]*?)<\/h4>/);
      const location = pick(c, /job-search-card__location">([\s\S]*?)<\/span>/);
      if (!title || !link) continue;
      jobs.push({
        source: "LinkedIn",
        id: `li-${urn || link}`,
        title,
        company,
        description: location, // enriquecido abaixo p/ as primeiras
        url: link.split("?")[0],
      });
    }
    // Enriquece a descrição das primeiras (melhora o filtro da IA) sem
    // estourar requests; falha em uma só deixa título+local.
    const top = jobs.slice(0, 12);
    await Promise.all(
      top.slice(0, 8).map(async (j) => {
        const id = j.id.replace(/^li-/, "");
        if (!/^\d+$/.test(id)) return;
        const desc = await linkedInDescription(id);
        if (desc)
          j.description = j.description ? `${j.description} — ${desc}` : desc;
      }),
    );
    return top;
  } catch {
    return [];
  }
}

/** Busca agregada nas fontes abertas. Devolve vagas com link, sem duplicatas. */
export async function searchRemoteJobs(
  keywords: string[],
): Promise<RemoteJob[]> {
  const query = keywords.slice(0, 2).join(" ") || keywords[0] || "developer";
  const [rmt, rok, arb, wwr, li] = await Promise.all([
    fromRemotive(query),
    fromRemoteOK(),
    fromArbeitnow(),
    fromWWR(),
    fromLinkedIn(query),
  ]);

  const merged = [
    ...li, // LinkedIn já veio filtrado pela busca (keywords server-side)
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
