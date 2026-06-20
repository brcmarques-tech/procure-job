import { logError } from "@/lib/logError";
import { listUsers } from "@/lib/users";

/** Lista os perfis criados (central de perfis na tela inicial). */
export async function GET() {
  try {
    const users = await listUsers();
    return Response.json({ users });
  } catch (e) {
    logError("api/users", e);
    return Response.json(
      { error: "Falha ao listar perfis: " + (e as Error).message },
      { status: 500 },
    );
  }
}
