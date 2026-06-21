// Cria a conta "principal" e liga TODOS os perfis órfãos (accountId null) a ela.
// Rodar UMA vez, depois do `prisma db push`:
//   node --env-file=.env scripts/seed-principal-account.mjs "<nome>" "<senha>"
// (ou via env PRINCIPAL_NOME / PRINCIPAL_SENHA)

import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const nome = process.argv[2] || process.env.PRINCIPAL_NOME;
const senha = process.argv[3] || process.env.PRINCIPAL_SENHA;

if (!nome || !senha) {
  console.error(
    'Uso: node --env-file=.env scripts/seed-principal-account.mjs "<nome>" "<senha>"',
  );
  process.exit(1);
}

// Mesmo formato de hash do lib/password.ts ("salt:hash" com scrypt).
function hashPassword(s) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(s, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const prisma = new PrismaClient();
try {
  let account = await prisma.account.findUnique({ where: { nome } });
  if (!account) {
    account = await prisma.account.create({
      data: { nome, senhaHash: hashPassword(senha) },
    });
    console.log(`✓ Conta criada: "${nome}" (${account.id})`);
  } else {
    console.log(`• Conta já existia: "${nome}" (${account.id})`);
  }

  const res = await prisma.user.updateMany({
    where: { accountId: null },
    data: { accountId: account.id },
  });
  console.log(`✓ Perfis órfãos ligados à conta principal: ${res.count}`);
} finally {
  await prisma.$disconnect();
}
