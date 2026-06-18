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

/** Busca projetos ativos por palavras-chave. (canal 🟢) */
export async function searchActiveProjects(
  token: string,
  query: string,
): Promise<FreelancerProject[]> {
  const url = new URL(`${BASE_URL}/projects/0.1/projects/active/`);
  url.searchParams.set("query", query);
  url.searchParams.set("job_details", "true");
  url.searchParams.set("full_description", "true");

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
  },
): Promise<{ id: number }> {
  const res = await fetch(`${BASE_URL}/projects/0.1/bids/`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: params.projectId,
      bidder_id: params.bidderId,
      amount: params.amount,
      period: params.period,
      description: params.description,
    }),
  });
  if (!res.ok) {
    throw new Error(`placeBid falhou: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data?.result;
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
