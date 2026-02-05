// apps/landing-page/src/lib/variants.ts
export type LandingPageVariant =
   | "variant-a"
   | "variant-b"
   | "variant-c"
   | "variant-d"
   | null;

export const VARIANT_STORAGE_KEY = "montte-landing-variant";
export const POSTHOG_FLAG_KEY = "landing-page-positioning";

export interface VariantCopy {
   homepage: {
      headline: string;
      subheadline: string;
   };
   pricing: {
      headline: string;
      subheadline: string;
   };
   enterprise: {
      headline: string;
      subheadline: string;
   };
}

export const VARIANT_COPY: Record<
   Exclude<LandingPageVariant, null>,
   VariantCopy
> = {
   "variant-a": {
      homepage: {
         headline: "Gerencie seu negócio inteiro em um só lugar",
         subheadline:
            "Finanças, estoque, automações e relatórios. Tudo que você precisa para crescer sem complicação.",
      },
      pricing: {
         headline: "Uma plataforma. Todas as ferramentas.",
         subheadline:
            "Grátis para uso pessoal. Planos empresariais com recursos ilimitados.",
      },
      enterprise: {
         headline: "Plataforma completa de gestão empresarial",
         subheadline:
            "Substitua múltiplas ferramentas por uma solução integrada e moderna.",
      },
   },
   "variant-b": {
      homepage: {
         headline: "ERP que não precisa de manual",
         subheadline:
            "Gestão empresarial simples o suficiente para uso pessoal, poderosa o suficiente para seu negócio crescer.",
      },
      pricing: {
         headline: "ERP sem complicação. Sem mensalidade para sempre.",
         subheadline: "Comece grátis e escale conforme cresce. Sem pegadinhas.",
      },
      enterprise: {
         headline: "ERP moderno para equipes que não querem perder tempo",
         subheadline:
            "Configure em minutos. Use em segundos. Cresça sem limites.",
      },
   },
   "variant-c": {
      homepage: {
         headline: "Gestão empresarial que não parece software de 2005",
         subheadline:
            "Interface linda, experiência rápida, recursos poderosos. O ERP que você realmente vai querer usar.",
      },
      pricing: {
         headline: "ERP bonito. E funcional.",
         subheadline:
            "Porque ferramentas de gestão não precisam ser feias e complicadas.",
      },
      enterprise: {
         headline: "Software de gestão que seu time vai adorar usar",
         subheadline:
            "UX moderna, onboarding rápido, produtividade desde o primeiro dia.",
      },
   },
   "variant-d": {
      homepage: {
         headline: "Do estoque ao caixa, tudo conectado",
         subheadline:
            "Controle produtos, movimentações e finanças em tempo real. Decisões mais inteligentes para seu negócio.",
      },
      pricing: {
         headline: "Gestão financeira + controle de estoque integrados",
         subheadline:
            "A única ferramenta que conecta seu inventário às suas finanças.",
      },
      enterprise: {
         headline: "Visibilidade total: do estoque ao resultado financeiro",
         subheadline:
            "Rastreie produtos, custos e margens em uma única plataforma.",
      },
   },
};
