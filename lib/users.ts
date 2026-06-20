import { prisma } from "./db";

export interface UserListItem {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  linkedin: string | null;
  area: string | null;
  temPortfolio: boolean;
  portfolioSlug: string | null;
  atualizadoEm: string;
}

/** Lista todos os perfis criados (para a central de perfis na tela inicial). */
export async function listUsers(): Promise<UserListItem[]> {
  const users = await prisma.user.findMany({
    include: { profile: true, portfolio: true },
    orderBy: { createdAt: "desc" },
  });
  return users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone,
    linkedin: u.linkedin,
    area: u.profile?.area ?? null,
    temPortfolio: Boolean(u.portfolio),
    portfolioSlug: u.portfolio?.publicSlug ?? null,
    atualizadoEm: (u.profile?.updatedAt ?? u.createdAt).toISOString(),
  }));
}

/** Atualiza os dados de contato de um perfil (nome, email, telefone, LinkedIn). */
export async function updateUserContact(
  userId: string,
  data: {
    nome?: string;
    email?: string;
    telefone?: string | null;
    linkedin?: string | null;
  },
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.nome !== undefined ? { nome: data.nome } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.telefone !== undefined
        ? { telefone: data.telefone || null }
        : {}),
      ...(data.linkedin !== undefined
        ? { linkedin: data.linkedin || null }
        : {}),
    },
  });
}

/** Exclui um perfil e TUDO dele (portfólio, vagas, candidaturas — cascata). */
export async function deleteUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
