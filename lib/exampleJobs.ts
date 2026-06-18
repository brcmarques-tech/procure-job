/**
 * Vagas de exemplo para testar o motor de proposta (M4) sem depender
 * de integração com plataformas. Cobrem áreas distintas de propósito.
 */
export interface ExampleJob {
  id: string;
  titulo: string;
  descricao: string;
  budget: string;
  skills: string[];
}

export const EXAMPLE_JOBS: ExampleJob[] = [
  {
    id: "ex-react-dashboard",
    titulo: "Desenvolvedor(a) React para dashboard de analytics",
    descricao:
      "Precisamos finalizar um painel de analytics em React + Next.js. Já temos a API pronta (REST) e o design no Figma. " +
      "Faltam ~8 telas: gráficos, filtros por data, tabela com paginação e exportação CSV. " +
      "Buscamos alguém que entregue componentes limpos e responsivos, com atenção a performance. " +
      "Projeto de ~3 semanas, possibilidade de continuidade.",
    budget: "R$ 6.000 - R$ 9.000",
    skills: ["React", "Next.js", "TypeScript", "Recharts", "REST API"],
  },
  {
    id: "ex-traducao-en-pt",
    titulo: "Tradução técnica EN→PT de documentação de software",
    descricao:
      "Temos ~40 páginas de documentação de um produto SaaS (inglês) para traduzir para português do Brasil. " +
      "O conteúdo é técnico (APIs, integrações, termos de engenharia). Procuramos tradutor(a) com domínio técnico, " +
      "que mantenha consistência de terminologia e tom natural, sem soar como tradução automática. " +
      "Entrega em lotes semanais.",
    budget: "R$ 2.000 - R$ 3.500",
    skills: ["Tradução EN-PT", "Localização", "Terminologia técnica", "Revisão"],
  },
  {
    id: "ex-design-landing",
    titulo: "Designer UI para landing page de startup fintech",
    descricao:
      "Startup de pagamentos buscando designer para criar a landing page de lançamento. " +
      "Precisamos de uma identidade moderna e confiável, foco em conversão (CTA claro, prova social, seção de preços). " +
      "Entregáveis: design no Figma (desktop + mobile) e um guia rápido de estilo. " +
      "Bônus se tiver experiência com fintech/SaaS.",
    budget: "R$ 3.000 - R$ 5.000",
    skills: ["UI Design", "Figma", "Landing Page", "Conversão", "Design System"],
  },
];

export function findExampleJob(id: string): ExampleJob | undefined {
  return EXAMPLE_JOBS.find((j) => j.id === id);
}
