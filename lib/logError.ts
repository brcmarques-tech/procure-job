import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Registro central de erros. Loga no console do servidor E grava em
 * `data/errors.log` (gitignored) para revisão posterior — "sempre que dá erro".
 *
 * Uso: `logError("api/applications/send", e, { applicationId })`.
 */
export function logError(
  scope: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const msg = err instanceof Error ? err.message : String(err);
  const ctx = extra ? " " + JSON.stringify(extra) : "";
  const line = `[${new Date().toISOString()}] [${scope}] ${msg}${ctx}`;

  console.error("✖ " + line);

  // Grava em arquivo de forma não-bloqueante; nunca deixa o log derrubar a rota.
  void (async () => {
    try {
      const dir = join(process.cwd(), "data");
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, "errors.log"), line + "\n");
    } catch {
      /* se não der pra gravar em arquivo, o console já registrou */
    }
  })();
}
