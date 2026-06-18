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
