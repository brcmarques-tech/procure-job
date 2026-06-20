// Abre um túnel (cloudflared) pro app local e publica a URL no banco, pra o
// app online (Render) usar o Claude LOCAL via /api/ai-proxy. Rode com:
//   node --env-file=.env scripts/tunnel.mjs
// Mantenha a janela aberta enquanto quiser a IA online. Feche pra desligar.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FALLBACK_CF =
  "C:/Users/luana/AppData/Local/Microsoft/WinGet/Links/cloudflared.exe";
const CF = existsSync(FALLBACK_CF) ? FALLBACK_CF : "cloudflared";

async function publish(url) {
  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: { aiProxyUrl: url },
    create: { id: "singleton", aiProxyUrl: url },
  });
}

console.log("Abrindo túnel pro Claude local (http://localhost:3000)...");
const cf = spawn(CF, ["tunnel", "--url", "http://localhost:3000"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let published = false;
function handle(buf) {
  const s = buf.toString();
  const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !published) {
    published = true;
    const url = m[0] + "/api/ai-proxy";
    publish(url)
      .then(() =>
        console.log(
          `\n✅ IA ONLINE ATIVA.\n   Túnel: ${m[0]}\n   Deixe esta janela aberta. Feche para desligar a IA online.\n`,
        ),
      )
      .catch((e) => console.log("erro ao publicar URL:", e.message));
  }
}
cf.stdout.on("data", handle);
cf.stderr.on("data", handle);

let down = false;
async function shutdown() {
  if (down) return;
  down = true;
  try {
    await publish(null);
    console.log("IA online desligada (URL limpa no banco).");
  } catch {}
  try {
    cf.kill();
  } catch {}
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
cf.on("exit", shutdown);
