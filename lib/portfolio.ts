import { generateJSON } from "./claude";
import type { ProfileDraft } from "./profile";

export interface PortfolioOutput {
  html: string;
  css: string;
}

export interface PortfolioImageRef {
  role: "hero" | "sobre" | "trabalho";
  url: string;
}

export interface PortfolioContato {
  whatsapp?: string | null;
  email?: string | null;
  linkedin?: string | null;
}

/** Monta as URLs de contato (WhatsApp/email/LinkedIn) a partir do usuário. */
export function buildContato(p: {
  nome?: string;
  email?: string | null;
  telefone?: string | null;
  linkedin?: string | null;
}): PortfolioContato {
  const digits = (p.telefone || "").replace(/\D/g, "");
  const primeiro = p.nome ? p.nome.trim().split(/\s+/)[0] : "";
  const msg = encodeURIComponent(
    `Oi${primeiro ? " " + primeiro : ""}, vi seu portfólio e queria conversar sobre um projeto.`,
  );
  return {
    whatsapp: digits.length >= 10 ? `https://wa.me/${digits}?text=${msg}` : null,
    email: p.email
      ? `mailto:${p.email}?subject=${encodeURIComponent("Contato pelo portfólio")}`
      : null,
    linkedin: p.linkedin || null,
  };
}

/**
 * Design system de referência (inspirado no template "Shop.co"):
 * clean, claro, tipografia display preta em caixa-alta, cantos bem
 * arredondados, painéis cinza-claro, botões "pill" pretos e faixa preta
 * arredondada no rodapé. Monocromático com muito respiro.
 */
const DESIGN_SYSTEM = `
ESTÉTICA DE REFERÊNCIA — "clean premium" (estilo Shop.co):
- Visual minimalista, claro, com MUITO espaço em branco e respiro generoso.
- Paleta: fundo #FFFFFF; painéis/cards em cinza-claro #F2F0F1; texto #000000;
  texto secundário rgba(0,0,0,0.6). Acento único e discreto (use #000 como
  padrão; só introduza outra cor se as instruções do usuário pedirem).
- Tipografia (carregue via @import do Google Fonts no TOPO do CSS):
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  - Títulos/hero: 'Archivo Black', sans-serif — SEMPRE em CAIXA-ALTA,
    bem grandes (hero ~clamp(40px,7vw,72px)), letter-spacing levemente negativo.
  - Corpo e labels: 'Plus Jakarta Sans', sans-serif.
- Formas: cantos MUITO arredondados — cards/painéis border-radius 20px;
  botões em formato "pill" (border-radius 9999px). Botão primário: fundo
  preto, texto branco; secundário: borda 1px preta, fundo transparente.
- Sombras sutis (ex.: 0 4px 20px rgba(0,0,0,0.05)); evite sombras pesadas.
- Layout: container central max-width ~1240px, padding lateral 24px; seções
  com padding vertical ~72px; grids responsivos (auto-fit, minmax).
- Microinterações em CSS puro: transições suaves em hover (cards sobem um
  pouco, botões mudam de opacidade), fade-in discreto. Nada de JS.

ESTRUTURA DO PORTFÓLIO (adapte ao perfil do freelancer — NÃO é uma loja):
1. Header fixo simples: nome/logo à esquerda, links âncora à direita,
   botão pill "Contato" preto.
2. HERO em painel cinza-claro arredondado: H1 gigante em caixa-alta com o
   nome ou a proposta (ex.: "DESIGNER QUE TRANSFORMA IDEIAS EM PRODUTO"),
   parágrafo curto (resumoBio), dois botões pill (primário "Ver trabalhos",
   secundário "Falar comigo"), e uma linha de ESTATÍSTICAS separadas por
   divisórias (ex.: anos de experiência, projetos, tecnologias) derivadas do
   perfil. Se houver dados de imagem ausentes, NÃO use <img> quebrada —
   prefira blocos geométricos/iniciais.
3. Faixa de "skills" em destaque (chips/pílulas ou logos), estilo a barra de
   marcas do Shop.co.
4. Seção "EXPERIÊNCIAS" / "PROJETOS": título centralizado em caixa-alta,
   grid de cards arredondados cinza-claro (título, período, descrição),
   hover sutil.
5. Seção de skills detalhada agrupada, em cards.
6. CTA final + RODAPÉ em faixa PRETA arredondada (texto branco) com contato.

REGRAS:
- HTML semântico, responsivo (mobile-first, funciona em 390px e 1440px).
- Sem frameworks, sem JS, sem dependências externas EXCETO o Google Fonts
  acima. Não use imagens externas (sem URLs de placeholder).
- Conteúdo 100% em português, fiel ao perfil. Nada de "lorem ipsum".
- NUNCA invente dados para preencher uma seção (experiências, clientes,
  números, depoimentos). Use APENAS o que está no perfil.
- SEÇÕES VAZIAS: se uma seção não tem dados reais no perfil, OMITA-A por
  completo (não renderize título solto, card vazio, "em breve" nem
  placeholder). O site deve parecer intencional e completo mesmo enxuto —
  melhor poucas seções bem-feitas do que buracos. Idem para a linha de
  estatísticas do hero: só inclua números que existam de fato no perfil;
  se não houver, troque por um CTA ou remova a linha.
- Deve parecer feito por um designer humano — natural, não cara de template
  genérico nem "feito por IA".
`;

/**
 * Módulo 2 — Gerador de portfólio.
 * Gera HTML/CSS responsivo a partir do perfil, seguindo o design system
 * "clean premium". `instrucoes` permite regenerar com ajustes do usuário.
 */
export async function generatePortfolio(
  profile: ProfileDraft,
  instrucoes?: string,
  images?: PortfolioImageRef[],
  contato?: PortfolioContato,
): Promise<PortfolioOutput> {
  // Diz ao gerador, de forma explícita, quais seções têm dado real — para
  // ele OMITIR (não inventar nem deixar buraco) as que estão vazias.
  const temExperiencias = (profile.experiencias?.length ?? 0) > 0;
  const temSkills = (profile.skills?.length ?? 0) > 0;
  const secoesBlock =
    `\nDADOS REAIS DISPONÍVEIS NESTE PERFIL (omita seções sem dado):\n` +
    `- Experiências/projetos: ${temExperiencias ? `SIM (${profile.experiencias.length})` : "NÃO → OMITA a seção de experiências/projetos"}\n` +
    `- Skills: ${temSkills ? `SIM (${profile.skills.length})` : "NÃO → não faça a faixa/seção de skills"}\n` +
    `- Bio/resumo: ${profile.resumoBio?.trim() ? "SIM" : "NÃO → mantenha o hero curto, sem parágrafo inventado"}\n` +
    `Com poucos dados, faça um site mais curto e elegante (hero forte + ` +
    `contato), NÃO encha de seções vazias.\n`;

  const imgBlock =
    images && images.length
      ? `\nIMAGENS DISPONÍVEIS (use EXATAMENTE estas URLs em <img>, com object-fit:cover):\n` +
        images.map((i) => `- ${i.role}: ${i.url}`).join("\n") +
        `\nUse a imagem "hero" em destaque no topo (ao lado do título do hero), ` +
        `a "sobre" na seção de apresentação, e a "trabalho" numa seção de ` +
        `projetos/atuação. NÃO invente outras URLs de imagem.\n`
      : `\nNÃO use tags <img> (não há imagens disponíveis); use blocos ` +
        `geométricos/iniciais quando precisar de elementos visuais.\n`;

  const c = contato;
  const temContato = Boolean(c && (c.whatsapp || c.email || c.linkedin));
  const contatoBlock = temContato
    ? `\nCONTATO REAL — use EXATAMENTE estas URLs nos botões/links de contato (NUNCA href="#"):\n` +
      (c!.whatsapp ? `- WhatsApp (botão principal): ${c!.whatsapp}\n` : "") +
      (c!.email ? `- Email: ${c!.email}\n` : "") +
      (c!.linkedin ? `- LinkedIn: ${c!.linkedin}\n` : "") +
      `Todos os CTAs de contato ("Falar comigo", "Entrar em contato", "Contato") DEVEM levar a essas URLs com target="_blank". Na seção de contato, agrupe os botões num container FLEX centralizado, com LARGURA IGUAL entre eles e espaçamento uniforme — nunca botões de tamanhos diferentes.\n`
    : `\nSem contato configurado: NÃO crie botão de contato com href="#" (botão morto). Use um CTA textual simples, sem link quebrado.\n`;

  return generateJSON<PortfolioOutput>({
    model: "smart",
    maxTokens: 16000,
    system:
      "Você é um designer/dev front-end sênior, especialista em landing pages " +
      "premium. Gere um portfólio impecável seguindo À RISCA o design system " +
      "fornecido. Capriche no CSS (espaçamento, tipografia, hover). " +
      'Responda APENAS com JSON válido {"html": string, "css": string}.',
    user:
      `${DESIGN_SYSTEM}\n${secoesBlock}\n${imgBlock}\n${contatoBlock}\n` +
      `PERFIL DO FREELANCER:\n${JSON.stringify(profile, null, 2)}\n\n` +
      (instrucoes
        ? `AJUSTES PEDIDOS PELO USUÁRIO (têm prioridade): ${instrucoes}\n\n`
        : "") +
      `Gere o site agora. O campo "html" contém APENAS o conteúdo interno do ` +
      `body (sem <html>, <head>, <body> ou <style>). O campo "css" contém ` +
      `todo o CSS, começando pelo @import das fontes. Não corte o conteúdo.`,
  });
}
