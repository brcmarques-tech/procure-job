# Procure.job — Plano do MVP

Ferramenta que automatiza o ciclo de busca de trabalho freelancer: entende o
usuário, gera um portfólio, encontra vagas compatíveis, escreve propostas
naturais e candidata — no modelo **copiloto** (automação total onde há API
oficial; 1-clique do usuário onde a automação seria arriscada).

## Princípio: modelo copiloto (dentro dos Termos de Uso)

- 🟢 **Auto total** — canais com API oficial. Ex.: **Freelancer.com** (`place_bid`).
- 🟡 **Copiloto (1-clique)** — sem API. A IA prepara tudo; o usuário revisa e envia.
  Ex.: Upwork (o próprio ToS endossa "IA prepara, humano envia"), Workana, 99Freelas.
- 🔴 **Assistido** — alto risco/anti-bot. A IA prepara e avisa. Ex.: LinkedIn.

## Módulos

1. **Onboarding** → perfil canônico (`lib/profile.ts`)
2. **Gerador de portfólio** HTML/CSS (`lib/portfolio.ts`)
3. **Caça de vagas** + scoring (`lib/freelancer.ts`, `lib/jobs.ts`)
4. **Motor de proposta** — o coração (`lib/proposals.ts`)
5. **Envio** — auto (Freelancer API) ou fila copiloto
6. **Tracker + notificações** (`lib/notify.ts`)

## Stack

- **Next.js (TS)** — app + dashboard + API routes
- **Claude API** — `opus-4-8` (propostas/portfólio), `haiku-4-5` (perfil/score)
- **Prisma + SQLite** — persistência (troca para Postgres depois)
- **node-cron** — poll de vagas e respostas (vira fila de verdade na v2)

## Marcos — MVP concluído ✅

| Marco | Entrega | Status |
|---|---|---|
| M1 | Onboarding + perfil canônico | ✅ |
| M2 | Gerador de portfólio + preview/edição | ✅ |
| M3 | Caça de vagas + scoring (Freelancer; mock sem token) | ✅ |
| M4 | Motor de proposta (vagas de exemplo) | ✅ |
| M5 | Fluxo copiloto: preparar → enviar candidatura | ✅ |
| M6 | Tracker (funil) + notificação de resposta | ✅ |

Fluxo completo rodando ponta a ponta: perfil → portfólio → caça de vagas →
preparar candidatura → enviar → acompanhar → notificar.

## Caminho para produção (pós-MVP)

- `FREELANCER_OAUTH_TOKEN` real → caça de vagas ao vivo (canal 🟢).
- Provedor de e-mail real (Resend/Gmail API) no lugar do stub `lib/notify.ts`.
- Canais 🟡: extensão de navegador (1-clique na sessão do usuário) — ver issue
  de decisão de arquitetura (API > extensão > Playwright).
- `ANTHROPIC_API_KEY` para uso multiusuário (ver ToS) em vez do Claude Code.
- Autenticação/multiusuário, Postgres no lugar do SQLite, deploy.

## Pré-requisitos externos

1. Conta dev no Freelancer.com → app OAuth2 → `FREELANCER_OAUTH_TOKEN`
2. Chave da Claude API → `ANTHROPIC_API_KEY`
3. E-mail para notificações (Gmail/Resend)

## Setup local

```bash
npm install
cp .env.example .env   # preencher as chaves
npx prisma db push     # cria o banco SQLite
npm run dev
```
