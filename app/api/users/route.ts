import type { NextRequest } from "next/server";
import { logError } from "@/lib/logError";
import { listUsers } from "@/lib/users";
import { getAccountId, authEnabled } from "@/lib/authGuard";

/** Lista os perfis da conta logada (central de perfis na tela inicial). */
export async function GET(req: NextRequest) {
  try {
    const accountId = authEnabled() ? await getAccountId(req) : undefined;
    const users = await listUsers(accountId);
    return Response.json({ users });
  } catch (e) {
    logError("api/users", e);
    return Response.json(
      { error: "Falha ao listar perfis: " + (e as Error).message },
      { status: 500 },
    );
  }
}
