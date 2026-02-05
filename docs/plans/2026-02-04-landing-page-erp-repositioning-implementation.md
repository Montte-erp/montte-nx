# Landing Page ERP Repositioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Montte landing page from "finance tracker" to comprehensive ERP with 4-variant A/B testing via PostHog

**Architecture:** Client-side PostHog feature flag evaluation with localStorage persistence, variant-aware React components for copy, scroll tracking with Intersection Observer, problem-solution structured sections replacing feature carousels

**Tech Stack:** Astro, React, PostHog, TypeScript, Tailwind CSS

**Design Document:** `docs/plans/2026-02-04-landing-page-erp-repositioning-design.md`

---

## Phase 1: A/B Testing Infrastructure

### Task 1: Create Variant Types & Constants

**Files:**
- Create: `apps/landing-page/src/lib/variants.ts`

**Step 1: Create variant types and constants**

Create the TypeScript types and constants for the 4 copy variants:

```typescript
// apps/landing-page/src/lib/variants.ts
export type LandingPageVariant = 'variant-a' | 'variant-b' | 'variant-c' | 'variant-d' | null;

export const VARIANT_STORAGE_KEY = 'montte-landing-variant';
export const POSTHOG_FLAG_KEY = 'landing-page-positioning';

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

export const VARIANT_COPY: Record<Exclude<LandingPageVariant, null>, VariantCopy> = {
  'variant-a': {
    homepage: {
      headline: 'Gerencie seu negócio inteiro em um só lugar',
      subheadline: 'Finanças, estoque, automações e relatórios. Tudo que você precisa para crescer sem complicação.',
    },
    pricing: {
      headline: 'Uma plataforma. Todas as ferramentas.',
      subheadline: 'Grátis para uso pessoal. Planos empresariais com recursos ilimitados.',
    },
    enterprise: {
      headline: 'Plataforma completa de gestão empresarial',
      subheadline: 'Substitua múltiplas ferramentas por uma solução integrada e moderna.',
    },
  },
  'variant-b': {
    homepage: {
      headline: 'ERP que não precisa de manual',
      subheadline: 'Gestão empresarial simples o suficiente para uso pessoal, poderosa o suficiente para seu negócio crescer.',
    },
    pricing: {
      headline: 'ERP sem complicação. Sem mensalidade para sempre.',
      subheadline: 'Comece grátis e escale conforme cresce. Sem pegadinhas.',
    },
    enterprise: {
      headline: 'ERP moderno para equipes que não querem perder tempo',
      subheadline: 'Configure em minutos. Use em segundos. Cresça sem limites.',
    },
  },
  'variant-c': {
    homepage: {
      headline: 'Gestão empresarial que não parece software de 2005',
      subheadline: 'Interface linda, experiência rápida, recursos poderosos. O ERP que você realmente vai querer usar.',
    },
    pricing: {
      headline: 'ERP bonito. E funcional.',
      subheadline: 'Porque ferramentas de gestão não precisam ser feias e complicadas.',
    },
    enterprise: {
      headline: 'Software de gestão que seu time vai adorar usar',
      subheadline: 'UX moderna, onboarding rápido, produtividade desde o primeiro dia.',
    },
  },
  'variant-d': {
    homepage: {
      headline: 'Do estoque ao caixa, tudo conectado',
      subheadline: 'Controle produtos, movimentações e finanças em tempo real. Decisões mais inteligentes para seu negócio.',
    },
    pricing: {
      headline: 'Gestão financeira + controle de estoque integrados',
      subheadline: 'A única ferramenta que conecta seu inventário às suas finanças.',
    },
    enterprise: {
      headline: 'Visibilidade total: do estoque ao resultado financeiro',
      subheadline: 'Rastreie produtos, custos e margens em uma única plataforma.',
    },
  },
};
```

**Step 2: Commit variant types**

```bash
git add apps/landing-page/src/lib/variants.ts
git commit -m "feat(landing): add variant types and copy constants for A/B testing"
```

---

### Task 2: Create Analytics Utility

**Files:**
- Create: `apps/landing-page/src/lib/analytics.ts`

**Step 1: Create analytics tracking utility**

```typescript
// apps/landing-page/src/lib/analytics.ts
import type { LandingPageVariant } from './variants';

declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, properties?: Record<string, unknown>) => void;
      isFeatureEnabled: (flagKey: string) => boolean;
      getFeatureFlag: (flagKey: string) => string | boolean | undefined;
    };
  }
}

export interface TrackingContext {
  variant: LandingPageVariant;
  page: string;
}

export function trackVariantAssigned(variant: LandingPageVariant, page: string) {
  if (!window.posthog) return;

  window.posthog.capture('landing_variant_assigned', {
    variant,
    page,
    timestamp: new Date().toISOString(),
  });
}

export function trackHeroCtaClicked(context: TrackingContext, ctaText: string) {
  if (!window.posthog) return;

  window.posthog.capture('hero_cta_clicked', {
    variant: context.variant,
    cta_text: ctaText,
    page: context.page,
  });
}

export function trackSectionViewed(
  context: TrackingContext,
  sectionName: string,
  scrollDepthPercent: number
) {
  if (!window.posthog) return;

  window.posthog.capture('section_viewed', {
    variant: context.variant,
    section_name: sectionName,
    scroll_depth_percent: scrollDepthPercent,
    page: context.page,
  });
}

export function trackFeatureCtaClicked(
  context: TrackingContext,
  sectionName: string,
  ctaText: string
) {
  if (!window.posthog) return;

  window.posthog.capture('feature_cta_clicked', {
    variant: context.variant,
    section_name: sectionName,
    cta_text: ctaText,
    page: context.page,
  });
}

export function trackPageExit(
  context: TrackingContext,
  timeOnPageSeconds: number,
  maxScrollDepth: number
) {
  if (!window.posthog) return;

  window.posthog.capture('page_exit', {
    variant: context.variant,
    time_on_page_seconds: timeOnPageSeconds,
    max_scroll_depth: maxScrollDepth,
    page: context.page,
  });
}
```

**Step 2: Commit analytics utility**

```bash
git add apps/landing-page/src/lib/analytics.ts
git commit -m "feat(landing): add PostHog analytics tracking utility"
```

---

### Task 3: Create Variant Loader Hook

**Files:**
- Create: `apps/landing-page/src/lib/use-variant.ts`

**Step 1: Create variant loading hook**

```typescript
// apps/landing-page/src/lib/use-variant.ts
import { useEffect, useState } from 'react';
import { trackVariantAssigned } from './analytics';
import {
  POSTHOG_FLAG_KEY,
  VARIANT_STORAGE_KEY,
  type LandingPageVariant
} from './variants';

export function useVariant(pageName: string) {
  const [variant, setVariant] = useState<LandingPageVariant>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage first for consistency across pages
    const storedVariant = localStorage.getItem(VARIANT_STORAGE_KEY) as LandingPageVariant;

    if (storedVariant && storedVariant !== 'null') {
      setVariant(storedVariant);
      setLoading(false);
      return;
    }

    // If not in localStorage, evaluate feature flag
    const evaluateFlag = () => {
      if (!window.posthog) {
        setLoading(false);
        return;
      }

      const flagValue = window.posthog.getFeatureFlag(POSTHOG_FLAG_KEY);

      if (flagValue && typeof flagValue === 'string') {
        const resolvedVariant = flagValue as LandingPageVariant;
        setVariant(resolvedVariant);
        localStorage.setItem(VARIANT_STORAGE_KEY, resolvedVariant);
        trackVariantAssigned(resolvedVariant, pageName);
      }

      setLoading(false);
    };

    // PostHog might not be loaded yet, wait for it
    if (window.posthog) {
      evaluateFlag();
    } else {
      // Retry after a short delay
      const timeout = setTimeout(evaluateFlag, 500);
      return () => clearTimeout(timeout);
    }
  }, [pageName]);

  return { variant, loading };
}
```

**Step 2: Commit variant loader hook**

```bash
git add apps/landing-page/src/lib/use-variant.ts
git commit -m "feat(landing): add variant loading hook with localStorage persistence"
```

---

### Task 4: Create Variant Text Component

**Files:**
- Create: `apps/landing-page/src/components/VariantText.tsx`

**Step 1: Create variant-aware text component**

```typescript
// apps/landing-page/src/components/VariantText.tsx
import { useVariant } from '@/lib/use-variant';
import type { LandingPageVariant } from '@/lib/variants';

interface VariantTextProps {
  variantA: string;
  variantB: string;
  variantC: string;
  variantD: string;
  fallback?: string;
  pageName: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export function VariantText({
  variantA,
  variantB,
  variantC,
  variantD,
  fallback,
  pageName,
  className,
  as: Component = 'span',
}: VariantTextProps) {
  const { variant, loading } = useVariant(pageName);

  if (loading) {
    return <Component className={className}>{fallback || variantA}</Component>;
  }

  const textMap: Record<Exclude<LandingPageVariant, null>, string> = {
    'variant-a': variantA,
    'variant-b': variantB,
    'variant-c': variantC,
    'variant-d': variantD,
  };

  const text = variant ? textMap[variant] : fallback || variantA;

  return <Component className={className}>{text}</Component>;
}
```

**Step 2: Commit variant text component**

```bash
git add apps/landing-page/src/components/VariantText.tsx
git commit -m "feat(landing): add VariantText component for A/B tested copy"
```

---

### Task 5: Create Scroll Tracker

**Files:**
- Create: `apps/landing-page/src/lib/scroll-tracker.ts`

**Step 1: Create scroll tracking utility**

```typescript
// apps/landing-page/src/lib/scroll-tracker.ts
import { trackSectionViewed } from './analytics';
import type { TrackingContext } from './analytics';

const SCROLL_THRESHOLD = [0.1, 0.25, 0.5, 0.75, 0.9];
const DEBOUNCE_MS = 300;

export class ScrollTracker {
  private context: TrackingContext;
  private observers: Map<string, IntersectionObserver> = new Map();
  private viewedSections: Set<string> = new Set();
  private maxScrollDepth = 0;
  private debounceTimer: number | null = null;

  constructor(context: TrackingContext) {
    this.context = context;
  }

  trackSection(element: HTMLElement, sectionName: string) {
    if (this.observers.has(sectionName)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.viewedSections.has(sectionName)) {
            this.viewedSections.add(sectionName);

            const scrollDepth = this.calculateScrollDepth();
            this.maxScrollDepth = Math.max(this.maxScrollDepth, scrollDepth);

            if (this.debounceTimer) {
              clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = window.setTimeout(() => {
              trackSectionViewed(this.context, sectionName, scrollDepth);
            }, DEBOUNCE_MS);
          }
        });
      },
      { threshold: SCROLL_THRESHOLD }
    );

    observer.observe(element);
    this.observers.set(sectionName, observer);
  }

  private calculateScrollDepth(): number {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    return Math.round((scrollTop / docHeight) * 100);
  }

  getMaxScrollDepth(): number {
    return this.maxScrollDepth;
  }

  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
```

**Step 2: Commit scroll tracker**

```bash
git add apps/landing-page/src/lib/scroll-tracker.ts
git commit -m "feat(landing): add scroll tracking with Intersection Observer"
```

---

## Phase 2: Update Homepage with Problem-Solution Sections

### Task 6: Create Problem Section 1 - Manual Work

**Files:**
- Create: `apps/landing-page/src/sections/home/ProblemManualWork.astro`

**Step 1: Create manual work problem section**

```astro
---
// apps/landing-page/src/sections/home/ProblemManualWork.astro
import { FeatureCarousel } from "@/components/feature-carousel";

const features = [
   {
      id: "editor-visual-regras",
      title: "Editor Visual de Regras",
      description:
         "Crie workflows arrastar-e-soltar sem código. Interface React Flow intuitiva para montar automações complexas.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Editor+Visual",
      width: "narrow" as const,
   },
   {
      id: "categorizacao-automatica",
      title: "Categorização Automática",
      description:
         "Regras aprendem e categorizam transações automaticamente. Configure uma vez, economize horas toda semana.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Auto+Categoria",
      width: "wide" as const,
   },
   {
      id: "importacao-csv-ofx",
      title: "Importação CSV/OFX",
      description:
         "Importe extratos bancários com detecção de duplicatas. Compatível com todos os bancos brasileiros.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Importar",
      width: "narrow" as const,
   },
   {
      id: "notificacoes-inteligentes",
      title: "Notificações Inteligentes",
      description:
         "Alertas automáticos de vencimentos e metas. Push notifications e email configuráveis por regra.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Notificacoes",
      width: "wide" as const,
   },
   {
      id: "templates-reutilizaveis",
      title: "Templates Reutilizáveis",
      description:
         "Crie modelos para transações e contas recorrentes. Um clique para lançar despesas fixas mensais.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Templates",
      width: "narrow" as const,
   },
];
---

<section id="problem-manual-work" class="py-16 md:py-24 overflow-hidden relative">
   <div class="container mx-auto max-w-7xl px-4 mb-12">
      <div class="max-w-3xl">
         <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Cansado de planilhas e trabalho manual?
         </h2>
         <p class="text-lg text-muted-foreground mb-8">
            Horas perdidas digitando dados, erros de fórmula, versões conflitantes. Seu tempo vale mais do que isso.
         </p>
         <div class="border-l-4 border-primary pl-6">
            <h3 class="text-2xl font-semibold text-foreground mb-2">
               Automatize o que for repetitivo
            </h3>
            <p class="text-muted-foreground">
               Da categorização inteligente de transações às regras de workflow visuais. Menos digitação, mais controle.
            </p>
         </div>
      </div>
   </div>

   <FeatureCarousel
      items={features}
      badge="Automação Inteligente"
      title="Configure uma vez. Economize horas toda semana."
      subtitle="Elimine tarefas repetitivas com automações inteligentes que trabalham para você."
      ctaText="Ver automações"
      ctaHref="/features/automation"
      benefitText="Seu time focado no que importa, não em tarefas manuais."
      client:load
   />
</section>
```

**Step 2: Commit problem section 1**

```bash
git add apps/landing-page/src/sections/home/ProblemManualWork.astro
git commit -m "feat(landing): add manual work problem-solution section"
```

---

### Task 7: Create Problem Section 2 - Disconnected Tools

**Files:**
- Create: `apps/landing-page/src/sections/home/ProblemDisconnectedTools.astro`

**Step 1: Create disconnected tools problem section**

```astro
---
// apps/landing-page/src/sections/home/ProblemDisconnectedTools.astro
import { FeatureCarousel } from "@/components/feature-carousel";

const features = [
   {
      id: "gestao-financeira-completa",
      title: "Gestão Financeira Completa",
      description:
         "Transações, contas a pagar/receber, fluxo de caixa em tempo real. Tudo conectado em uma única plataforma.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Gestao+Fin",
      width: "narrow" as const,
   },
   {
      id: "estoque-integrado",
      title: "Controle de Estoque Integrado",
      description:
         "Movimentações financeiras automaticamente vinculadas com entrada/saída de produtos. Custo real em tempo real.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Estoque+Integrado",
      width: "wide" as const,
   },
   {
      id: "multiplas-organizacoes",
      title: "Múltiplas Organizações",
      description:
         "Separe pessoal de empresarial em workspaces isolados. Alterne com um clique sem misturar dados.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Multi+Org",
      width: "narrow" as const,
   },
   {
      id: "centro-custos",
      title: "Centro de Custos",
      description:
         "Aloque despesas por projeto, departamento ou cliente. Relatórios detalhados de lucratividade por área.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Centro+Custos",
      width: "wide" as const,
   },
   {
      id: "dashboards-unificados",
      title: "Dashboards Unificados",
      description:
         "Veja tudo em tempo real: caixa, estoque, metas. Uma única fonte de verdade para todas as decisões.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Dashboards",
      width: "narrow" as const,
   },
];
---

<section id="problem-disconnected-tools" class="py-16 md:py-24 overflow-hidden relative">
   <div class="container mx-auto max-w-7xl px-4 mb-12">
      <div class="max-w-3xl">
         <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ferramentas desconectadas matam sua produtividade?
         </h2>
         <p class="text-lg text-muted-foreground mb-8">
            Finanças em um app, estoque em outro, relatórios em planilhas. Perde-se tempo copiando dados entre sistemas e nunca se tem uma visão completa.
         </p>
         <div class="border-l-4 border-primary pl-6">
            <h3 class="text-2xl font-semibold text-foreground mb-2">
               Tudo integrado em uma plataforma
            </h3>
            <p class="text-muted-foreground">
               Transações conectadas ao estoque, contas vinculadas a fornecedores, relatórios sempre atualizados. Uma única fonte de verdade.
            </p>
         </div>
      </div>
   </div>

   <FeatureCarousel
      items={features}
      badge="Plataforma Unificada"
      title="Uma plataforma. Todos os dados conectados."
      subtitle="Pare de copiar dados entre ferramentas. Montte integra tudo automaticamente."
      ctaText="Ver módulos integrados"
      ctaHref="/features/financial-management"
      benefitText="Decisões mais rápidas com dados sempre sincronizados."
      client:load
   />
</section>
```

**Step 2: Commit problem section 2**

```bash
git add apps/landing-page/src/sections/home/ProblemDisconnectedTools.astro
git commit -m "feat(landing): add disconnected tools problem-solution section"
```

---

### Task 8: Create Problem Section 3 - No Visibility

**Files:**
- Create: `apps/landing-page/src/sections/home/ProblemNoVisibility.astro`

**Step 1: Create no visibility problem section**

```astro
---
// apps/landing-page/src/sections/home/ProblemNoVisibility.astro
import { FeatureCarousel } from "@/components/feature-carousel";

const features = [
   {
      id: "rastreamento-produtos",
      title: "Rastreamento de Produtos",
      description:
         "SKU, múltiplas unidades de medida, produtos/materiais/ativos. Controle completo de cada item do inventário.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Rastreamento",
      width: "narrow" as const,
   },
   {
      id: "movimentacoes-detalhadas",
      title: "Movimentações Detalhadas",
      description:
         "Entrada, saída, ajustes com motivo e histórico completo. Saiba exatamente onde cada produto foi e quando.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Movimentacoes",
      width: "wide" as const,
   },
   {
      id: "avaliacao-fifo-media",
      title: "Avaliação FIFO/Média Ponderada",
      description:
         "Escolha o método de valorização por item. Cálculo automático de custo para relatórios precisos.",
      image: "https://placehold.co/350x478/151925/22c55e?text=FIFO",
      width: "narrow" as const,
   },
   {
      id: "alertas-reposicao",
      title: "Alertas de Reposição",
      description:
         "Defina pontos mínimos e receba notificações quando estoque baixar. Nunca mais perca vendas por falta de produto.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Alertas",
      width: "wide" as const,
   },
   {
      id: "integracao-fornecedores",
      title: "Integração com Fornecedores",
      description:
         "Catálogo de preços, prazos de entrega, histórico de compras por item. Facilita reordenação e negociação.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Fornecedores",
      width: "narrow" as const,
   },
];
---

<section id="problem-no-visibility" class="py-16 md:py-24 overflow-hidden relative">
   <div class="container mx-auto max-w-7xl px-4 mb-12">
      <div class="max-w-3xl">
         <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Vendendo às cegas sem controle de estoque?
         </h2>
         <p class="text-lg text-muted-foreground mb-8">
            Não sabe o que tem em estoque, perde vendas por falta de produto, descobre custos reais só no fim do mês. Decisões no escuro.
         </p>
         <div class="border-l-4 border-primary pl-6">
            <h3 class="text-2xl font-semibold text-foreground mb-2">
               Visibilidade total do negócio em tempo real
            </h3>
            <p class="text-muted-foreground">
               Rastreie cada produto, calcule custos automaticamente, receba alertas de reposição. Decisões baseadas em dados, não em achismos.
            </p>
         </div>
      </div>
   </div>

   <FeatureCarousel
      items={features}
      badge="Inventário Inteligente"
      title="Do fornecedor ao cliente. Tudo rastreado."
      subtitle="Controle total de estoque com rastreamento em tempo real e alertas automáticos."
      ctaText="Ver gestão de estoque"
      ctaHref="/features/inventory"
      benefitText="Nunca mais perca vendas por falta de estoque."
      client:load
   />
</section>
```

**Step 2: Commit problem section 3**

```bash
git add apps/landing-page/src/sections/home/ProblemNoVisibility.astro
git commit -m "feat(landing): add no visibility problem-solution section"
```

---

### Task 9: Create Problem Section 4 - Complex ERPs

**Files:**
- Create: `apps/landing-page/src/sections/home/ProblemComplexERPs.astro`

**Step 1: Create complex ERPs problem section**

```astro
---
// apps/landing-page/src/sections/home/ProblemComplexERPs.astro
import { FeatureCarousel } from "@/components/feature-carousel";

const features = [
   {
      id: "gratis-para-sempre",
      title: "Grátis para Sempre",
      description:
         "Plano pessoal completo sem custo, sem cartão de crédito. Todos os recursos básicos inclusos permanentemente.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Gratis",
      width: "wide" as const,
   },
   {
      id: "setup-minutos",
      title: "Setup em Minutos",
      description:
         "Cadastre sua empresa e comece a usar imediatamente. Sem consultores, sem treinamento, sem complicação.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Setup+Rapido",
      width: "narrow" as const,
   },
   {
      id: "interface-moderna",
      title: "Interface Moderna",
      description:
         "UX pensada para 2026, não para 2005. Design limpo, responsivo, que funciona em qualquer dispositivo.",
      image: "https://placehold.co/725x478/151925/22c55e?text=Interface",
      width: "wide" as const,
   },
   {
      id: "colaboracao-inclusa",
      title: "Colaboração Inclusa",
      description:
         "Convide time ilimitado, defina permissões granulares, trabalhem juntos. Sem custo extra por usuário.",
      image: "https://placehold.co/350x478/151925/22c55e?text=Time",
      width: "narrow" as const,
   },
];
---

<section id="problem-complex-erps" class="py-16 md:py-24 overflow-hidden relative">
   <div class="container mx-auto max-w-7xl px-4 mb-12">
      <div class="max-w-3xl">
         <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
            ERPs tradicionais são caros e complicados demais?
         </h2>
         <p class="text-lg text-muted-foreground mb-8">
            Mensalidades absurdas, meses de implementação, consultores caríssimos, interface da década de 90. ERP não precisa ser assim.
         </p>
         <div class="border-l-4 border-primary pl-6">
            <h3 class="text-2xl font-semibold text-foreground mb-2">
               ERP moderno que você vai querer usar
            </h3>
            <p class="text-muted-foreground">
               Grátis para sempre no plano pessoal. Configure em minutos, não em meses. Interface linda que não precisa de treinamento.
            </p>
         </div>
      </div>
   </div>

   <FeatureCarousel
      items={features}
      badge="Simples e Acessível"
      title="ERP que não precisa de manual."
      subtitle="Software de gestão empresarial simples o suficiente para uso pessoal, poderoso para negócios."
      ctaText="Ver planos"
      ctaHref="/pricing"
      benefitText="Comece grátis. Cresça sem limites. Sem pegadinhas."
      client:load
   />
</section>
```

**Step 2: Commit problem section 4**

```bash
git add apps/landing-page/src/sections/home/ProblemComplexERPs.astro
git commit -m "feat(landing): add complex ERPs problem-solution section"
```

---

### Task 10: Update Homepage Hero with A/B Testing

**Files:**
- Modify: `apps/landing-page/src/sections/home/HomeHero.astro`

**Step 1: Update hero with variant-aware copy**

Replace the existing hero content with variant-aware headlines:

```astro
---
import { Button } from "@packages/ui/components/button";
import dashboardsDark from "@/assets/hero-carousel/dashboards-dark.png";
import dashboardsLight from "@/assets/hero-carousel/dashboards-light.png";
import transactionsDark from "@/assets/hero-carousel/transactions-dark.png";
import transactionsLight from "@/assets/hero-carousel/transactions-light.png";
import { HeroCarousel } from "@/components/hero-carousel";
import LogoCloud from "@/components/LogoCloud.astro";
import LogoWithText from "@/components/LogoWithText.astro";
import { VariantText } from "@/components/VariantText";

const heroSlides = [
   {
      id: "transactions",
      label: "Gerencie transações e estoque de forma inteligente",
      imageLightUrl: transactionsLight.src,
      imageDarkUrl: transactionsDark.src,
   },
   {
      id: "dashboards",
      label: "Visualize seus dados com dashboards personalizados",
      imageLightUrl: dashboardsLight.src,
      imageDarkUrl: dashboardsDark.src,
   },
];
---

<section class="relative px-8 py-18 md:py-28 flex flex-col gap-12 items-center container max-w-7xl mx-auto overflow-hidden">
   <div class="w-full flex flex-col md:flex-row gap-12 items-center md:justify-between z-10">
      <div class="text-center md:text-left flex flex-col gap-12">
         <div class="flex md:hidden w-full justify-center">
            <LogoWithText size="md" />
         </div>

         <VariantText
            as="h1"
            className="inline-block font-semibold tracking-tight text-3xl sm:text-4xl lg:text-5xl leading-tight max-w-3xl text-foreground"
            variantA="Gerencie seu negócio inteiro em um só lugar"
            variantB="ERP que não precisa de manual"
            variantC="Gestão empresarial que não parece software de 2005"
            variantD="Do estoque ao caixa, tudo conectado"
            fallback="Gerencie seu negócio inteiro em um só lugar"
            pageName="homepage"
            client:load
         />

         <VariantText
            as="p"
            className="sm:text-xl max-w-sm sm:max-w-xl text-foreground/70"
            variantA="Finanças, estoque, automações e relatórios. Tudo que você precisa para crescer sem complicação."
            variantB="Gestão empresarial simples o suficiente para uso pessoal, poderosa o suficiente para seu negócio crescer."
            variantC="Interface linda, experiência rápida, recursos poderosos. O ERP que você realmente vai querer usar."
            variantD="Controle produtos, movimentações e finanças em tempo real. Decisões mais inteligentes para seu negócio."
            fallback="Finanças, estoque, automações e relatórios. Tudo que você precisa para crescer sem complicação."
            pageName="homepage"
            client:load
         />

         <div>
            <a href="https://app.montte.co/auth/sign-in" target="_blank" rel="noopener noreferrer">
               <Button size="lg">
                  <span>Começar Grátis</span>
               </Button>
            </a>
         </div>
      </div>

      <div class="w-full max-w-lg md:max-w-2xl">
         <HeroCarousel items={heroSlides} client:load />
      </div>
   </div>
   <LogoCloud />
</section>
```

**Step 2: Commit hero updates**

```bash
git add apps/landing-page/src/sections/home/HomeHero.astro
git commit -m "feat(landing): add A/B tested variant copy to homepage hero"
```

---

### Task 11: Update Homepage Index Page

**Files:**
- Modify: `apps/landing-page/src/pages/index.astro`

**Step 1: Replace sections with new problem-solution structure**

```astro
---
export const prerender = true;

import { Separator } from "@packages/ui/components/separator";
import CTA from "@/components/CTA.astro";
import Footer from "@/components/Footer.astro";
import StickyNavbar from "@/components/StickyNavbar.astro";
import Layout from "@/layouts/Landing.astro";
import Hero from "@/sections/home/HomeHero.astro";
import ProblemManualWork from "@/sections/home/ProblemManualWork.astro";
import ProblemDisconnectedTools from "@/sections/home/ProblemDisconnectedTools.astro";
import ProblemNoVisibility from "@/sections/home/ProblemNoVisibility.astro";
import ProblemComplexERPs from "@/sections/home/ProblemComplexERPs.astro";
---

<Layout>
   <div class="flex flex-col">
      <StickyNavbar />
      <Hero />
      <Separator className="bg-gradient-to-r from-transparent via-primary/20 to-transparent"/>
      <ProblemManualWork />
      <Separator className="bg-gradient-to-r from-transparent via-primary/20 to-transparent"/>
      <ProblemDisconnectedTools />
      <Separator className="bg-gradient-to-r from-transparent via-primary/20 to-transparent"/>
      <ProblemNoVisibility />
      <Separator className="bg-gradient-to-r from-transparent via-primary/20 to-transparent"/>
      <ProblemComplexERPs />
      <Separator className="bg-gradient-to-r from-transparent via-primary/20 to-transparent"/>
      <CTA title={["Pronto para crescer?", "Comece grátis hoje"]} buttonText="Começar Grátis" />
      <Footer />
   </div>
</Layout>
```

**Step 2: Delete old sections**

```bash
# Remove old unused sections
rm apps/landing-page/src/sections/home/Showcase.astro
rm apps/landing-page/src/sections/home/BillTracking.astro
rm apps/landing-page/src/sections/home/Budgeting.astro
rm apps/landing-page/src/sections/home/Workspaces.astro
rm apps/landing-page/src/sections/home/Analytics.astro
rm apps/landing-page/src/components/UseCases.astro
```

**Step 3: Commit homepage structure changes**

```bash
git add apps/landing-page/src/pages/index.astro
git add -u # Stage deletions
git commit -m "feat(landing): replace homepage with problem-solution structure"
```

---

## Phase 3: Update Pricing & Enterprise Pages

### Task 12: Update Pricing Hero

**Files:**
- Modify: `apps/landing-page/src/sections/pricing-page/PricingHero.astro`

**Step 1: Add variant-aware copy to pricing hero**

Update the pricing hero to use A/B tested copy:

```astro
---
import { Image } from "astro:assets";
import pricingHeroDark from "@/assets/background/pricing-hero-dark.png";
import pricingHeroLight from "@/assets/background/pricing-hero-light.png";
import { BillingToggle } from "@/components/BillingToggle";
import { VariantText } from "@/components/VariantText";
---

<link rel="preload" as="image" href={pricingHeroLight.src} type="image/png">
<link rel="preload" as="image" href={pricingHeroDark.src} type="image/png">

<section class="relative py-18 md:py-28 overflow-hidden">
   <!-- Background Images -->
   <div class="absolute inset-0">
      <Image
         src={pricingHeroLight}
         alt="Pricing hero background"
         class="absolute inset-0 w-full h-full object-cover opacity-100 dark:opacity-0 transition-opacity duration-300"
         priority={true}
      />
      <Image
         src={pricingHeroDark}
         alt="Pricing hero background"
         class="absolute inset-0 w-full h-full object-cover opacity-0 dark:opacity-100 transition-opacity duration-300"
         priority={true}
      />
      <div class="absolute inset-0 bg-background/80 dark:bg-background/85 pointer-events-none"></div>
      <div class="absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-gradient-to-b from-transparent to-background"></div>
   </div>

   <!-- Content -->
   <div class="relative z-10 px-8 container max-w-7xl mx-auto flex flex-col gap-12 items-center">
      <p class="text-base uppercase font-bold text-center tracking-[0.20em]">
         <span class="text-primary">Planos</span> e Preços
      </p>

      <VariantText
         as="h1"
         className="inline-block font-semibold tracking-tight text-center text-4xl sm:text-6xl lg:text-7xl leading-tight max-w-3xl text-foreground"
         variantA="Uma plataforma. Todas as ferramentas."
         variantB="ERP sem complicação. Sem mensalidade para sempre."
         variantC="ERP bonito. E funcional."
         variantD="Gestão financeira + controle de estoque integrados"
         fallback="Uma plataforma. Todas as ferramentas."
         pageName="pricing"
         client:load
      />

      <VariantText
         as="p"
         className="sm:text-xl text-center max-w-sm sm:max-w-xl text-foreground/70"
         variantA="Grátis para uso pessoal. Planos empresariais com recursos ilimitados."
         variantB="Comece grátis e escale conforme cresce. Sem pegadinhas."
         variantC="Porque ferramentas de gestão não precisam ser feias e complicadas."
         variantD="A única ferramenta que conecta seu inventário às suas finanças."
         fallback="Grátis para uso pessoal. Planos pagos para equipes e empresas."
         pageName="pricing"
         client:load
      />

      <BillingToggle client:load id="pricing-toggle" showDiscount={true} />
   </div>
</section>
```

**Step 2: Commit pricing hero updates**

```bash
git add apps/landing-page/src/sections/pricing-page/PricingHero.astro
git commit -m "feat(landing): add A/B tested copy to pricing page hero"
```

---

### Task 13: Update Enterprise Hero

**Files:**
- Modify: `apps/landing-page/src/sections/enterprise/EnterpriseHero.astro`

**Step 1: Add variant-aware copy to enterprise hero**

```astro
---
import { Image } from "astro:assets";
import { MessageSquare } from "@lucide/astro";
import { Button } from "@packages/ui/components/button";
import enterpriseHeroDark from "@/assets/background/enterprise-hero-dark.png";
import enterpriseHeroLight from "@/assets/background/enterprise-hero-light.png";
import LogoCloud from "@/components/LogoCloud.astro";
import { VariantText } from "@/components/VariantText";
---

<link rel="preload" as="image" href={enterpriseHeroLight.src} type="image/png">
<link rel="preload" as="image" href={enterpriseHeroDark.src} type="image/png">

<div class="absolute inset-0 z-10">
   <Image
      src={enterpriseHeroLight}
      alt="Enterprise hero background"
      class="absolute inset-0 w-full h-full object-cover opacity-100 dark:opacity-0 transition-opacity duration-300"
      priority={true}
   />
   <Image
      src={enterpriseHeroDark}
      alt="Enterprise hero background"
      class="absolute inset-0 w-full h-full object-cover opacity-0 dark:opacity-100 transition-opacity duration-300"
      priority={true}
   />
   <div class="absolute inset-0 bg-background/80 dark:bg-background/85 pointer-events-none"></div>
   <div class="absolute inset-x-0 bottom-0 h-40 md:h-56 pointer-events-none bg-gradient-to-b from-transparent to-background dark:to-background/85"></div>
</div>

<section class="relative px-8 py-18 md:py-28 flex flex-col gap-12 items-center container max-w-7xl mx-auto overflow-hidden">
   <div class="flex flex-col gap-12 items-center z-10">
      <p class="text-base uppercase font-bold text-center tracking-[0.20em]">
         <span class="text-primary">Montte</span> Empresas
      </p>

      <VariantText
         as="h1"
         className="inline-block font-semibold tracking-tight text-center text-4xl sm:text-6xl lg:text-7xl leading-tight max-w-3xl text-foreground"
         variantA="Plataforma completa de gestão empresarial"
         variantB="ERP moderno para equipes que não querem perder tempo"
         variantC="Software de gestão que seu time vai adorar usar"
         variantD="Visibilidade total: do estoque ao resultado financeiro"
         fallback="Plataforma completa de gestão empresarial"
         pageName="enterprise"
         client:load
      />

      <VariantText
         as="p"
         className="sm:text-xl text-center max-w-sm sm:max-w-xl text-foreground/70"
         variantA="Substitua múltiplas ferramentas por uma solução integrada e moderna."
         variantB="Configure em minutos. Use em segundos. Cresça sem limites."
         variantC="UX moderna, onboarding rápido, produtividade desde o primeiro dia."
         variantD="Rastreie produtos, custos e margens em uma única plataforma."
         fallback="Membros ilimitados, automações inteligentes e dashboards avançados."
         pageName="enterprise"
         client:load
      />

      <Button className="flex items-center gap-2 w-full sm:w-2/6" size="lg">
         <MessageSquare class="size-4" />
         Fale conosco
      </Button>
   </div>
   <div class="z-10">
      <LogoCloud />
   </div>
</section>
```

**Step 2: Commit enterprise hero updates**

```bash
git add apps/landing-page/src/sections/enterprise/EnterpriseHero.astro
git commit -m "feat(landing): add A/B tested copy to enterprise page hero"
```

---

## Phase 4: Rebrand Feature Pages

### Task 14: Rename smart-transactions to financial-management

**Files:**
- Rename: `apps/landing-page/src/pages/features/smart-transactions.astro` → `financial-management.astro`

**Step 1: Rename file**

```bash
git mv apps/landing-page/src/pages/features/smart-transactions.astro apps/landing-page/src/pages/features/financial-management.astro
```

**Step 2: Update content to financial management**

Update the renamed file with ERP-focused financial management copy:

```astro
---
// Update hero content
const title = "Controle financeiro completo para seu negócio";
const subtitle = "Das transações diárias aos relatórios fiscais. Gerencie receitas, despesas, contas a pagar e receber em um só lugar.";
---
```

**Step 3: Commit rename**

```bash
git commit -m "feat(landing): rebrand smart-transactions page to financial-management"
```

---

### Task 15: Rename budgeting to planning

**Files:**
- Rename: `apps/landing-page/src/pages/features/budgeting.astro` → `planning.astro`

**Step 1: Rename file**

```bash
git mv apps/landing-page/src/pages/features/budgeting.astro apps/landing-page/src/pages/features/planning.astro
```

**Step 2: Update content to planning & control**

```astro
---
const title = "Planejamento e Controle Empresarial";
const subtitle = "Orçamentos, metas, centros de custo e previsões. Planeje o futuro do seu negócio com dados confiáveis.";
---
```

**Step 3: Commit rename**

```bash
git commit -m "feat(landing): rebrand budgeting page to planning & control"
```

---

### Task 16: Rename collaboration to automation

**Files:**
- Rename: `apps/landing-page/src/pages/features/collaboration.astro` → `automation.astro`

**Step 1: Rename file**

```bash
git mv apps/landing-page/src/pages/features/collaboration.astro apps/landing-page/src/pages/features/automation.astro
```

**Step 2: Update content to automation & workflows**

```astro
---
const title = "Automação e Workflows Inteligentes";
const subtitle = "Regras visuais, categorização automática, notificações e integrações. Elimine trabalho manual com automações que funcionam.";
---
```

**Step 3: Commit rename**

```bash
git commit -m "feat(landing): rebrand collaboration page to automation & workflows"
```

---

### Task 17: Rename bill-tracking to inventory

**Files:**
- Rename: `apps/landing-page/src/pages/features/bill-tracking.astro` → `inventory.astro`

**Step 1: Rename file**

```bash
git mv apps/landing-page/src/pages/features/bill-tracking.astro apps/landing-page/src/pages/features/inventory.astro
```

**Step 2: Update content to inventory & operations**

```astro
---
const title = "Inventário e Gestão de Estoque";
const subtitle = "Controle completo de produtos, materiais e ativos. Rastreamento em tempo real, avaliação FIFO/Média, alertas automáticos.";
---
```

**Step 3: Commit rename**

```bash
git commit -m "feat(landing): rebrand bill-tracking page to inventory & operations"
```

---

### Task 18: Update analytics page

**Files:**
- Modify: `apps/landing-page/src/pages/features/analytics.astro`

**Step 1: Update analytics page with ERP positioning**

```astro
---
const title = "Analytics e Relatórios Gerenciais";
const subtitle = "Dashboards personalizados, relatórios DRE, gráficos interativos. Transforme dados em decisões estratégicas.";
---
```

**Step 2: Commit analytics update**

```bash
git commit -m "feat(landing): update analytics page with ERP positioning"
```

---

## Phase 5: Update Meta Tags & SEO

### Task 19: Update Landing Layout Meta Tags

**Files:**
- Modify: `apps/landing-page/src/layouts/Landing.astro`

**Step 1: Update meta description and keywords**

Find and replace the meta tags in Landing.astro:

```astro
---
const brandDescription =
   "ERP moderno e gratuito para pequenas empresas. Gestão financeira, controle de estoque, automações e relatórios em uma única plataforma.";
---

<!-- In the <head> section, update: -->
<meta
   name="description"
   content={brandDescription}
>
<meta
   name="keywords"
   content="ERP, gestão empresarial, controle de estoque, automação, gestão financeira, inventário, pequenas empresas, open source, FIFO, controle de produtos"
>
```

**Step 2: Commit meta tag updates**

```bash
git add apps/landing-page/src/layouts/Landing.astro
git commit -m "feat(landing): update meta tags for ERP positioning"
```

---

## Phase 6: PostHog Dashboard Setup

### Task 20: Create PostHog Dashboard Configuration

**Files:**
- Create: `docs/posthog-dashboard-config.md`

**Step 1: Document PostHog dashboard setup**

```markdown
# PostHog Landing Page A/B Test Dashboard Setup

## Dashboard Name
Landing Page A/B Test - ERP Positioning

## Required Insights

### 1. Conversion Funnel by Variant
**Type:** Funnel
**Events:**
1. landing_variant_assigned
2. hero_cta_clicked

**Breakdowns:** variant
**Description:** Primary conversion metric - CTR from variant assignment to CTA click

### 2. Scroll Engagement Heatmap
**Type:** Trends (Line chart)
**Event:** section_viewed
**Breakdown:** section_name, variant
**Y-axis:** Average scroll_depth_percent
**Description:** Shows which sections users engage with by variant

### 3. Secondary Conversions Table
**Type:** Table
**Event:** feature_cta_clicked
**Breakdowns:** variant, section_name, cta_text
**Metrics:** Total count
**Description:** Track feature page CTA clicks by section

### 4. Time on Page Distribution
**Type:** Trends (Bar chart)
**Event:** page_exit
**Y-axis:** Average time_on_page_seconds
**Breakdown:** variant
**Description:** Engagement quality metric

### 5. Variant Performance Summary
**Type:** Table
**Multiple events aggregated
**Columns:**
- Variant
- Total Visitors (landing_variant_assigned)
- Hero CTR (hero_cta_clicked / landing_variant_assigned)
- Avg Scroll Depth (avg scroll_depth_percent from section_viewed)
- Avg Time on Page (avg time_on_page_seconds from page_exit)

## Feature Flag Setup

**Flag Key:** `landing-page-positioning`
**Type:** Multivariate
**Variants:**
- variant-a (25%)
- variant-b (25%)
- variant-c (25%)
- variant-d (25%)

**Rollout:** 100% of users

## Instructions

1. Log into PostHog dashboard
2. Navigate to Feature Flags
3. Create new flag: `landing-page-positioning`
4. Set as multivariate with 4 equal variants
5. Enable at 100%
6. Create new dashboard: "Landing Page A/B Test - ERP Positioning"
7. Add the 5 insights documented above
8. Share dashboard with team

## Analysis Schedule

- **Daily:** Check for technical issues (events firing correctly)
- **Weekly:** Review trends and early signals
- **After 2 weeks:** Statistical analysis and variant selection
- **After winner declared:** Remove losing variants from code
```

**Step 2: Commit dashboard documentation**

```bash
git add docs/posthog-dashboard-config.md
git commit -m "docs: add PostHog dashboard setup for A/B testing"
```

---

## Verification

### Manual Testing Checklist

**Homepage:**
- [ ] Visit homepage in incognito
- [ ] Verify variant is assigned and stored in localStorage
- [ ] Refresh page - same variant should persist
- [ ] Check PostHog events in network tab (landing_variant_assigned)
- [ ] Click hero CTA - verify hero_cta_clicked event
- [ ] Scroll through sections - verify section_viewed events
- [ ] Click feature CTA - verify feature_cta_clicked event
- [ ] Navigate away - verify page_exit event

**Cross-Page Consistency:**
- [ ] Visit homepage → pricing → enterprise
- [ ] Verify same variant shows across all pages
- [ ] Check localStorage persists

**Feature Pages:**
- [ ] Navigate to /features/financial-management (renamed from smart-transactions)
- [ ] Navigate to /features/planning (renamed from budgeting)
- [ ] Navigate to /features/automation (renamed from collaboration)
- [ ] Navigate to /features/inventory (renamed from bill-tracking)
- [ ] Navigate to /features/analytics (unchanged)
- [ ] Verify all pages load without 404s

**Variant Testing:**
- [ ] Clear localStorage and cookies
- [ ] Refresh multiple times to see different variants (may take several tries)
- [ ] Verify all 4 variants render correctly

**Build & Deploy:**
```bash
# Build landing page
cd apps/landing-page
bun run build

# Check for TypeScript errors
bun run typecheck

# Run locally
bun run preview
```

### PostHog Verification

1. Log into PostHog dashboard
2. Go to Live Events
3. Filter by event names:
   - landing_variant_assigned
   - hero_cta_clicked
   - section_viewed
   - feature_cta_clicked
   - page_exit
4. Verify events have correct properties (variant, page, etc.)
5. Check feature flag `landing-page-positioning` is active

---

## Rollout Plan

### Phase 1: Soft Launch (Day 1-3)
- Deploy to staging
- QA team tests all variants
- Fix any issues

### Phase 2: Production Deploy (Day 4)
- Deploy to production
- Monitor error rates
- Verify events flowing to PostHog

### Phase 3: Data Collection (Day 5-18)
- Let test run for 2 weeks
- Monitor daily for technical issues
- Track visitor count per variant (need 1000+ each)

### Phase 4: Analysis (Day 19-21)
- Statistical analysis of results
- Identify winning variant
- Document findings

### Phase 5: Winner Implementation (Day 22+)
- Remove losing variants from code
- Make winner permanent
- Update documentation

---

## Notes

- All sections use placeholder images - replace with real screenshots before production
- PostHog feature flag must be created in PostHog dashboard manually
- Minimum 1000 visitors per variant needed for statistical significance
- Test should run for at least 2 weeks to account for weekly patterns
- Consider A/A test first to validate tracking infrastructure
