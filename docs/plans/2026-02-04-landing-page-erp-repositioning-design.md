# Landing Page ERP Repositioning & A/B Testing

## Overview

Transform Montte's landing page from "finance tracker" positioning to comprehensive ERP system with inventory and automation as key differentiators. Implement PostHog A/B testing with 4 copy variants and comprehensive analytics tracking.

## Target Audience

- **Primary:** Small businesses (1-50 employees) and individuals
- **Key Insight:** Dual positioning - simple enough for personal use, powerful enough for business
- **Differentiators:** Inventory management + Automation (these set us apart from competitors)

## A/B Testing Strategy

### Feature Flag Structure

**PostHog Feature Flag:** `landing-page-positioning`

**4 Multivariate Options:**
- `variant-a`: "All-in-one business platform"
- `variant-b`: "Simple ERP for everyone"
- `variant-c`: "Modern business management"
- `variant-d`: "Finance + Inventory together"

### Cross-Page Consistency

- Feature flag evaluated once on initial page load
- Variant stored in localStorage: `montte-landing-variant`
- Same variant across Homepage → Pricing → Enterprise → Feature pages
- No variant flickering on navigation

### Implementation Approach

1. PostHog script already injected in Landing.astro layout
2. Create client-side variant loader component
3. Each section conditionally renders copy based on variant
4. All events tracked with variant context

## Tracking Events & Metrics

### Custom PostHog Events

1. **`landing_variant_assigned`**
   - Properties: `variant`, `page`, `timestamp`

2. **`hero_cta_clicked`** - Primary conversion
   - Properties: `variant`, `cta_text`, `page`

3. **`section_viewed`** - Scroll depth
   - Properties: `variant`, `section_name`, `scroll_depth_percent`

4. **`feature_cta_clicked`** - Secondary conversions
   - Properties: `variant`, `section_name`, `cta_text`

5. **`page_exit`** - Engagement quality
   - Properties: `variant`, `time_on_page_seconds`, `max_scroll_depth`

### PostHog Dashboard

**Dashboard Name:** "Landing Page A/B Test - ERP Positioning"

**Panels:**
- Conversion Rate by Variant (Funnel)
- Engagement Heatmap (scroll depth)
- Secondary Conversions (feature CTA clicks)
- Time on Page Distribution (boxplot)
- Variant Performance Table (summary stats)

## Copy Variants

### Variant A: "All-in-one business platform"

**Homepage Hero:**
- Headline: `Gerencie seu negócio inteiro em um só lugar`
- Subheadline: `Finanças, estoque, automações e relatórios. Tudo que você precisa para crescer sem complicação.`

**Pricing Hero:**
- Headline: `Uma plataforma. Todas as ferramentas.`
- Subheadline: `Grátis para uso pessoal. Planos empresariais com recursos ilimitados.`

**Enterprise Hero:**
- Headline: `Plataforma completa de gestão empresarial`
- Subheadline: `Substitua múltiplas ferramentas por uma solução integrada e moderna.`

---

### Variant B: "Simple ERP for everyone"

**Homepage Hero:**
- Headline: `ERP que não precisa de manual`
- Subheadline: `Gestão empresarial simples o suficiente para uso pessoal, poderosa o suficiente para seu negócio crescer.`

**Pricing Hero:**
- Headline: `ERP sem complicação. Sem mensalidade para sempre.`
- Subheadline: `Comece grátis e escale conforme cresce. Sem pegadinhas.`

**Enterprise Hero:**
- Headline: `ERP moderno para equipes que não querem perder tempo`
- Subheadline: `Configure em minutos. Use em segundos. Cresça sem limites.`

---

### Variant C: "Modern business management"

**Homepage Hero:**
- Headline: `Gestão empresarial que não parece software de 2005`
- Subheadline: `Interface linda, experiência rápida, recursos poderosos. O ERP que você realmente vai querer usar.`

**Pricing Hero:**
- Headline: `ERP bonito. E funcional.`
- Subheadline: `Porque ferramentas de gestão não precisam ser feias e complicadas.`

**Enterprise Hero:**
- Headline: `Software de gestão que seu time vai adorar usar`
- Subheadline: `UX moderna, onboarding rápido, produtividade desde o primeiro dia.`

---

### Variant D: "Finance + Inventory together"

**Homepage Hero:**
- Headline: `Do estoque ao caixa, tudo conectado`
- Subheadline: `Controle produtos, movimentações e finanças em tempo real. Decisões mais inteligentes para seu negócio.`

**Pricing Hero:**
- Headline: `Gestão financeira + controle de estoque integrados`
- Subheadline: `A única ferramenta que conecta seu inventário às suas finanças.`

**Enterprise Hero:**
- Headline: `Visibilidade total: do estoque ao resultado financeiro`
- Subheadline: `Rastreie produtos, custos e margens em uma única plataforma.`

## Landing Page Structure Redesign

### Problem-Solution Framework

Replace feature-centric carousels with problem-solution sections that lead with customer pain points.

**New Homepage Flow:**

1. **Hero** (A/B tested variants)
2. **Problem #1:** Spreadsheet chaos → Solution: Automations
3. **Problem #2:** Disconnected tools → Solution: All-in-One Platform
4. **Problem #3:** No stock visibility → Solution: Inventory Management
5. **Problem #4:** Complex ERPs → Solution: Simple but Powerful
6. **Final CTA**
7. **Footer**

**Removed Sections:**
- UseCases.astro ("Para quem é o Montte?") - DELETED
- Social proof - Not implemented yet

### Problem Section Structure

Each section follows this pattern:

```
┌─────────────────────────────────────────┐
│ PROBLEM HEADLINE (emotional hook)       │
│ Problem description (pain detail)       │
├─────────────────────────────────────────┤
│ SOLUTION HEADLINE                        │
│ Solution description (how we fix it)    │
├─────────────────────────────────────────┤
│ FEATURE CAROUSEL                         │
│ 3-5 specific features with proof        │
└─────────────────────────────────────────┘
```

### Problem Section 1: Manual Work

**File:** `apps/landing-page/src/sections/home/ProblemManualWork.astro`

- **Problem:** `Cansado de planilhas e trabalho manual?`
- **Problem Detail:** `Horas perdidas digitando dados, erros de fórmula, versões conflitantes. Seu tempo vale mais do que isso.`
- **Solution:** `Automatize o que for repetitivo`
- **Solution Detail:** `Da categorização inteligente de transações às regras de workflow visuais. Menos digitação, mais controle.`
- **Badge:** `Automação Inteligente`
- **CTA:** `Ver automações` → `/features/automation`

**Feature Carousel:**
1. Editor Visual de Regras - Crie workflows arrastar-e-soltar sem código
2. Categorização Automática - Regras aprendem e categorizam transações automaticamente
3. Importação CSV/OFX - Importe extratos bancários com detecção de duplicatas
4. Notificações Inteligentes - Alertas automáticos de vencimentos e metas
5. Templates Reutilizáveis - Crie modelos para transações e contas recorrentes

---

### Problem Section 2: Disconnected Tools

**File:** `apps/landing-page/src/sections/home/ProblemDisconnectedTools.astro`

- **Problem:** `Ferramentas desconectadas matam sua produtividade?`
- **Problem Detail:** `Finanças em um app, estoque em outro, relatórios em planilhas. Perde-se tempo copiando dados entre sistemas e nunca se tem uma visão completa.`
- **Solution:** `Tudo integrado em uma plataforma`
- **Solution Detail:** `Transações conectadas ao estoque, contas vinculadas a fornecedores, relatórios sempre atualizados. Uma única fonte de verdade.`
- **Badge:** `Plataforma Unificada`
- **CTA:** `Ver módulos integrados` → `/features/financial-management`

**Feature Carousel:**
1. Gestão Financeira Completa - Transações, contas a pagar/receber, fluxo de caixa
2. Controle de Estoque Integrado - Movimentações financeiras linked com entrada/saída de produtos
3. Múltiplas Organizações - Separe pessoal de empresarial em workspaces isolados
4. Centro de Custos - Aloque despesas por projeto, departamento ou cliente
5. Dashboards Unificados - Veja tudo em tempo real: caixa, estoque, metas

---

### Problem Section 3: No Visibility

**File:** `apps/landing-page/src/sections/home/ProblemNoVisibility.astro`

- **Problem:** `Vendendo às cegas sem controle de estoque?`
- **Problem Detail:** `Não sabe o que tem em estoque, perde vendas por falta de produto, descobre custos reais só no fim do mês. Decisões no escuro.`
- **Solution:** `Visibilidade total do negócio em tempo real`
- **Solution Detail:** `Rastreie cada produto, calcule custos automaticamente, receba alertas de reposição. Decisões baseadas em dados, não em achismos.`
- **Badge:** `Inventário Inteligente`
- **CTA:** `Ver gestão de estoque` → `/features/inventory`

**Feature Carousel:**
1. Rastreamento de Produtos - SKU, múltiplas UoM, produtos/materiais/ativos
2. Movimentações Detalhadas - Entrada, saída, ajustes com motivo e histórico completo
3. Avaliação FIFO/Média - Escolha o método, cálculo automático de custo
4. Alertas de Reposição - Defina pontos mínimos e receba notificações
5. Integração com Fornecedores - Catálogo de preços, prazos, histórico de compras

---

### Problem Section 4: Complex ERPs

**File:** `apps/landing-page/src/sections/home/ProblemComplexERPs.astro`

- **Problem:** `ERPs tradicionais são caros e complicados demais?`
- **Problem Detail:** `Mensalidades absurdas, meses de implementação, consultores caríssimos, interface da década de 90. ERP não precisa ser assim.`
- **Solution:** `ERP moderno que você vai querer usar`
- **Solution Detail:** `Grátis para sempre no plano pessoal. Configure em minutos, não em meses. Interface linda que não precisa de treinamento.`
- **Badge:** `Simples e Acessível`
- **CTA:** `Ver planos` → `/pricing`

**Feature Carousel:**
1. Grátis para Sempre - Plano pessoal completo sem custo, sem cartão de crédito
2. Setup em Minutos - Cadastre sua empresa e comece a usar imediatamente
3. Interface Moderna - UX pensada para 2026, não para 2005
4. Colaboração Inclusa - Convide time, defina permissões, trabalhem juntos

## Feature Pages Rebrand

### ERP Module Structure

Rebrand 5 existing feature pages as ERP modules (no new pages added):

| Current File | New Name | New URL | Coverage |
|--------------|----------|---------|----------|
| `smart-transactions.astro` | **Financial Management** | `/features/financial-management` | Transactions, Bills, Receivables, Bank Accounts |
| `budgeting.astro` | **Planning & Control** | `/features/planning` | Budgets, Goals, Cost Centers, Forecasting |
| `analytics.astro` | **Analytics & Reporting** | `/features/analytics` | Dashboards, Reports, DRE, Charts, Exports |
| `collaboration.astro` | **Automation & Workflows** | `/features/automation` | Rules Engine, Auto-categorization, Notifications |
| `bill-tracking.astro` | **Inventory & Operations** | `/features/inventory` | Stock, Movements, Valuation, Suppliers, UoM |

### Feature Page Structure

Each module page has:
1. **Hero** (variant-aware, ERP positioned)
2. **"What you can do"** section (key capabilities)
3. **Feature showcase** (detailed features with visuals)
4. **CTA** to start free trial

**Example - Financial Management Hero:**
- Headline: `Controle financeiro completo para seu negócio`
- Subheadline: `Das transações diárias aos relatórios fiscais. Gerencie receitas, despesas, contas a pagar e receber em um só lugar.`

## Pages to Update

### Main Landing Pages (3)
1. **Homepage** (`/`) - Full redesign with 4 problem-solution sections
2. **Pricing** (`/pricing`) - Hero + feature summaries updated
3. **Enterprise** (`/enterprise`) - Hero + B2B-focused sections

### Feature Pages (5)
4. `/features/financial-management` (renamed from smart-transactions)
5. `/features/planning` (renamed from budgeting)
6. `/features/analytics` (stays same)
7. `/features/automation` (renamed from collaboration)
8. `/features/inventory` (renamed from bill-tracking)

### Meta Updates

**Landing.astro layout:**
- Update meta description to reflect ERP positioning
- Update keywords to include: ERP, gestão empresarial, controle de estoque, automação

**Current:**
```
gestão financeira, controle de gastos, orçamento pessoal, contas a pagar, contas a receber, open source, finanças, transações, importar OFX
```

**New:**
```
ERP, gestão empresarial, controle de estoque, automação, gestão financeira, inventário, pequenas empresas, open source, FIFO, controle de produtos
```

## Technical Implementation Notes

### Client-Side Variant Loading

Create: `apps/landing-page/src/lib/variant-loader.ts`
- Evaluate PostHog feature flag on mount
- Store in localStorage
- Dispatch custom event with variant data
- Handle SSG/SSR compatibility

### Analytics Utility

Create: `apps/landing-page/src/lib/analytics.ts`
- Wrapper functions for tracking events
- Automatic variant context injection
- Type-safe event properties
- Uses PostHog MCP for dashboard creation

### Variant-Aware Components

Create: `apps/landing-page/src/components/VariantText.tsx`
- React component that renders different text per variant
- Props: `variantA`, `variantB`, `variantC`, `variantD`
- Falls back to control if variant not loaded

### Scroll Tracking

Create: `apps/landing-page/src/lib/scroll-tracker.ts`
- Intersection Observer for section views
- Tracks scroll depth percentage
- Fires `section_viewed` events
- Debounced to avoid event spam

## Success Metrics

### Primary Metric
- **Hero CTA Click-Through Rate** by variant
- Target: >5% CTR improvement from best variant

### Secondary Metrics
- Average scroll depth (engagement)
- Feature CTA clicks (secondary conversions)
- Time on page (quality of traffic)
- Bounce rate reduction

### Statistical Significance
- Minimum 1000 visitors per variant
- 95% confidence level
- Run for minimum 2 weeks

## Rollout Plan

1. **Phase 1:** Implement A/B testing infrastructure
2. **Phase 2:** Update Homepage with problem-solution sections
3. **Phase 3:** Update Pricing and Enterprise pages
4. **Phase 4:** Rebrand feature pages
5. **Phase 5:** Set up PostHog dashboard
6. **Phase 6:** Launch test at 100% traffic
7. **Phase 7:** Analyze after 2 weeks, declare winner
8. **Phase 8:** Remove losing variants, make winner permanent
