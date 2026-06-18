/**
 * Módulo 6 — Notificações ao usuário (ex.: "a empresa X respondeu").
 * MVP: stub que loga no console. Plugar Gmail API ou Resend depois.
 */
export async function notifyUser(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  // TODO: integrar Gmail API ou Resend.
  console.log(`[NOTIFY] -> ${params.to}: ${params.subject}\n${params.body}`);
}
