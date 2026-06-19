/**
 * Cliente da API oficial do Freelancer.com (REST + OAuth2).
 * Docs: https://developers.freelancer.com/
 *
 * MVP: usa um access token via env (FREELANCER_OAUTH_TOKEN).
 * O fluxo OAuth2 completo (authorize + refresh) entra na v2.
 */

const BASE_URL = process.env.FREELANCER_API_BASE ?? "https://www.freelancer.com/api";

function authHeaders(token: string) {
  return {
    "Freelancer-OAuth-V1": token,
    "Content-Type": "application/json",
  };
}

export interface FreelancerProject {
  id: number;
  title: string;
  description: string;
  budget?: { minimum?: number; maximum?: number };
  currency?: { code?: string };
  jobs?: { name: string }[];
}

/**
 * Busca projetos ativos por palavras-chave. (canal 🟢)
 * `limit` evita puxar as 100 vagas padrão da API por busca — pontuar tudo
 * com IA é caro/lento, e só interessam as mais recentes/compatíveis.
 */
export async function searchActiveProjects(
  token: string,
  query: string,
  limit = 20,
): Promise<FreelancerProject[]> {
  const url = new URL(`${BASE_URL}/projects/0.1/projects/active/`);
  url.searchParams.set("query", query);
  url.searchParams.set("job_details", "true");
  url.searchParams.set("full_description", "true");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new Error(`searchActiveProjects falhou: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data?.result?.projects ?? [];
}

/** Envia um lance (bid) num projeto — automação total do canal 🟢. */
export async function placeBid(
  token: string,
  params: {
    projectId: number;
    bidderId: number;
    amount: number;
    period: number; // dias
    description: string;
    milestonePercentage?: number; // % do valor pedido em milestone (escrow)
  },
): Promise<{ id: number }> {
  // A API de lances usa JSON e exige milestone_percentage.
  const res = await fetch(`${BASE_URL}/projects/0.1/bids/`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: params.projectId,
      bidder_id: params.bidderId,
      amount: params.amount,
      period: params.period,
      milestone_percentage: params.milestonePercentage ?? 100,
      description: params.description,
    }),
  });
  if (!res.ok) {
    throw new Error(`placeBid falhou: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data?.result;
}

export interface FreelancerBid {
  id: number;
  award_status: string | null; // pending | awarded | rejected | revoked
  shortlisted: boolean;
}

/** Lê o status atual de um conjunto de lances (para sincronizar resultados). */
export async function getBids(
  token: string,
  bidIds: number[],
): Promise<FreelancerBid[]> {
  if (!bidIds.length) return [];
  const url = new URL(`${BASE_URL}/projects/0.1/bids/`);
  for (const id of bidIds) url.searchParams.append("bids[]", String(id));
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new Error(`getBids falhou: ${res.status} ${await res.text()}`);
  }
  const bids = (await res.json())?.result?.bids ?? [];
  // O endpoint pode devolver array ou objeto indexado por id.
  const arr = Array.isArray(bids) ? bids : Object.values(bids);
  return arr.map((b: { id: number; award_status?: string; shortlisted?: boolean }) => ({
    id: b.id,
    award_status: b.award_status ?? null,
    shortlisted: Boolean(b.shortlisted),
  }));
}

export interface FreelancerSelf {
  id: number;
  username: string;
  tagline: string | null;
  profileDescription: string | null;
  hourlyRate: number | null;
  jobs: { id: number; name: string }[];
}

/** Lê o perfil do próprio usuário (headline, bio, skills). */
export async function getSelfProfile(token: string): Promise<FreelancerSelf> {
  const url = new URL(`${BASE_URL}/users/0.1/self/`);
  url.searchParams.set("profile_description", "true");
  url.searchParams.set("jobs", "true");
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new Error(`getSelfProfile falhou: ${res.status} ${await res.text()}`);
  }
  const r = (await res.json())?.result ?? {};
  return {
    id: r.id,
    username: r.username,
    tagline: r.tagline ?? null,
    profileDescription: r.profile_description ?? null,
    hourlyRate: r.hourly_rate ?? null,
    jobs: (r.jobs ?? []).map((j: { id: number; name: string }) => ({
      id: j.id,
      name: j.name,
    })),
  };
}

/** Resolve nomes de skills em IDs de "job" do Freelancer (descarta o que não existe). */
export async function resolveJobIds(
  token: string,
  names: string[],
): Promise<{ id: number; name: string }[]> {
  if (!names.length) return [];
  const url = new URL(`${BASE_URL}/projects/0.1/jobs/`);
  for (const n of names) url.searchParams.append("job_names[]", n);
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) return [];
  const r = (await res.json())?.result ?? [];
  return r.map((j: { id: number; name: string }) => ({
    id: j.id,
    name: j.name,
  }));
}

/** Form-encoded helper para os endpoints de jobs (POST/DELETE). */
function formHeaders(token: string) {
  return {
    "Freelancer-OAuth-V1": token,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

/** Adiciona skills (jobs) ao perfil do usuário. */
export async function addJobs(token: string, ids: number[]): Promise<void> {
  if (!ids.length) return;
  const res = await fetch(`${BASE_URL}/users/0.1/self/jobs/`, {
    method: "POST",
    headers: formHeaders(token),
    body: ids.map((id) => `jobs[]=${id}`).join("&"),
  });
  if (!res.ok) {
    throw new Error(`addJobs falhou: ${res.status} ${await res.text()}`);
  }
}

/** Remove skills (jobs) do perfil do usuário. */
export async function removeJobs(token: string, ids: number[]): Promise<void> {
  if (!ids.length) return;
  const res = await fetch(`${BASE_URL}/users/0.1/self/jobs/`, {
    method: "DELETE",
    headers: formHeaders(token),
    body: ids.map((id) => `jobs[]=${id}`).join("&"),
  });
  if (!res.ok) {
    throw new Error(`removeJobs falhou: ${res.status} ${await res.text()}`);
  }
}

/**
 * Projetos-mock no formato da API do Freelancer.
 * Usados quando não há FREELANCER_OAUTH_TOKEN, para testar o pipeline de
 * caça+scoring sem depender da integração real. Inclui vagas fora do perfil
 * de propósito, para validar que o scoring as descarta.
 */
export const MOCK_PROJECTS: FreelancerProject[] = [
  {
    id: 90001,
    title: "Build a Next.js + TypeScript admin dashboard",
    description:
      "Looking for a React/Next.js developer to build an admin dashboard consuming our REST API. Charts, filters, role-based access. Clean, responsive components.",
    budget: { minimum: 1200, maximum: 2500 },
    jobs: [{ name: "React" }, { name: "Next.js" }, { name: "TypeScript" }],
  },
  {
    id: 90002,
    title: "Stripe payment integration for an e-commerce",
    description:
      "Need to integrate Stripe checkout and webhooks into an existing Node.js backend. Experience with payment flows required.",
    budget: { minimum: 500, maximum: 1000 },
    jobs: [{ name: "Node.js" }, { name: "Stripe" }, { name: "API" }],
  },
  {
    id: 90003,
    title: "Full stack developer for a PostgreSQL-backed SaaS",
    description:
      "Ongoing work on a SaaS product. Stack is Next.js, Node and PostgreSQL. Looking for someone reliable for features and bug fixes.",
    budget: { minimum: 2000, maximum: 4000 },
    jobs: [{ name: "Node.js" }, { name: "PostgreSQL" }, { name: "React" }],
  },
  {
    id: 90004,
    title: "Design a logo for a coffee brand",
    description:
      "We need a creative logo and brand colors for a new specialty coffee shop. Vector deliverables.",
    budget: { minimum: 80, maximum: 200 },
    jobs: [{ name: "Logo Design" }, { name: "Illustrator" }],
  },
  {
    id: 90005,
    title: "Manual data entry from PDFs to Excel",
    description:
      "Simple, repetitive data entry. Copy values from ~300 PDF invoices into a spreadsheet. No technical skills required.",
    budget: { minimum: 30, maximum: 80 },
    jobs: [{ name: "Data Entry" }, { name: "Excel" }],
  },
];
