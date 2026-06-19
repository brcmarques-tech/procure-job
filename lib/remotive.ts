/**
 * Cliente da API pública da Remotive (vagas remotas) — grátis, sem login.
 * Docs: https://remotive.com/api/remote-jobs
 */

export interface RemotiveJob {
  id: number;
  title: string;
  company: string;
  description: string; // texto limpo (sem HTML)
  url: string;
  jobType: string;
}

/** Remove tags HTML da descrição (a Remotive devolve HTML). */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca vagas remotas por palavra-chave. */
export async function searchRemotiveJobs(
  query: string,
  limit = 20,
): Promise<RemotiveJob[]> {
  const url = new URL("https://remotive.com/api/remote-jobs");
  if (query) url.searchParams.set("search", query);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Remotive falhou: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.jobs ?? []).map(
    (j: {
      id: number;
      title: string;
      company_name: string;
      description?: string;
      url: string;
      job_type?: string;
    }) => ({
      id: j.id,
      title: j.title,
      company: j.company_name,
      description: stripHtml(j.description ?? ""),
      url: j.url,
      jobType: j.job_type ?? "",
    }),
  );
}
