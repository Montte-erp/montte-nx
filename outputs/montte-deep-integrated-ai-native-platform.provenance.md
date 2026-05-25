# Provenance — Montte deep-integrated AI-native platform

Data: 2026-05-25

## Pedido

Usuário pediu novo deep research focado em conectar tudo que existe na plataforma e roadmap com AI-native, garantindo que todos os módulos/features conversem entre si como algo coeso. Usuário reforçou que gosta muito do PostHog como referência de plataforma.

## Artefatos usados

- `outputs/skill-first-ai-native-architecture.md`
- `outputs/erp-billing-ai-native-roadmap.md`
- `outputs/montte-ai-architecture-consolidated.md`
- `notes/cohesive-ai-platform-external-research.md`
- `notes/cohesive-ai-platform-current-state.md`
- `notes/cohesive-ai-platform-architecture-plan.md`

## Skills carregadas

- `/home/yorizel/.feynman/agent/skills/deep-research/SKILL.md`
- `/home/yorizel/Documents/montte-nx/.agents/skills/implementation/SKILL.md`

## Repo checks

Comandos/inspeções executadas:

- `find modules core apps/web/src/routes/_authenticated -maxdepth 3 -type f`
- `find modules -maxdepth 2 -type f ...`
- `rg` em pacotes/rotas/schemas em etapa anterior da conversa
- subagent scout inspecionou routers, schemas, agents, workflows, DBOS, pg-boss, PostHog e outputs existentes.

Observações principais:

- Domínios ativos: finance/cashbook, relationships, workflows, agents, inbox, reports, cards/classification/account.
- `modules/agents` já usa TanStack AI, PostHog Prompts, tools financeiras e OTEL.
- `modules/agents/src/skills.ts` ainda possui skill simples `financeiro`.
- DBOS e pg-boss existem, mas não há abstração comum de async work para AI.
- Não existem módulos fonte ativos para contracts/billing/payments/fiscal/open-finance/integrations/extensions.
- Não há event spine universal nem approval/receipt primitives.

## Web/current research

Pesquisas executadas:

- `AI native ERP architecture business process layer agentic workflows 2026`
- `ERP composable architecture event-driven business capability map AI agents integration layer`
- `PostHog AI architecture context engineering product analytics LLM evals prompts`

Fontes mantidas:

- PostHog AI platform — https://posthog.com/handbook/engineering/ai/ai-platform
- PostHog AI platform architecture — https://posthog.com/handbook/engineering/ai/architecture
- PostHog AI products — https://posthog.com/handbook/engineering/ai/products
- PostHog agent-first product engineering — https://posthog.com/newsletter/agent-first-product-engineering
- PostHog Evaluations — https://posthog.com/docs/llm-analytics/evaluations.md
- SAP AI-native Vision — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision
- SAP Process Layer — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- SAP Integration, Security, Ethics & Governance — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance
- SAP Event-Driven Applications — https://architecture.learning.sap.com/docs/ref-arch/fbdc46aaae
- Microsoft Fabric Business Events — https://learn.microsoft.com/en-us/fabric/real-time-hub/business-events/business-events-overview

## Subagents

Executados em paralelo:

1. `researcher` → `notes/cohesive-ai-platform-external-research.md`
2. `scout` → `notes/cohesive-ai-platform-current-state.md`
3. `planner` → `notes/cohesive-ai-platform-architecture-plan.md`

## Decisions encoded

- PostHog é referência de plataforma: uma AI platform compartilhada, não widgets isolados.
- Montte deve usar one main AI + domain skills.
- Deep integration significa schema + procedures + events + context pack + approvals + receipts + inbox/workflow hooks + evals.
- Business event spine é o primeiro grande PR estrutural.
- Inbox deve virar cockpit operacional cross-domain.
- Contract Writer/PlateJS é superfície de contratos, mas termos executáveis continuam separados e aprovados.
- Fiscal mira engine própria, com providers só fallback/benchmark.

## Blocked / not verified

- Nenhum código implementado.
- Sem migration/test/typecheck.
- Sem spike real com PlateJS, AbacatePay, SEFAZ/NFS-e Nacional ou Open Finance.

## Update — pricing Free + PAYG + addon R$400 e Montte no Montte

Usuário esclareceu:

- Montte terá dois tipos de precificação: pay-as-you-go e addons, inspirado no PostHog.
- Haverá apenas um addon inicialmente, de R$ 400.
- Quer um plano Free “bem legal”.
- Billing integrado para cobrar PAYG/addon só deve ser implementado quando AbacatePay estiver integrado como primeiro provider, para “integrar o Montte no Montte”.

Web/current research adicional:

- `PostHog pricing free tier add-ons pay as you go 2026`
- `PostHog pricing add-ons products pay-as-you-go free tier current`
- `PostHog billing pricing docs free tier addons spending limits`

Fontes adicionadas:

- PostHog pricing — https://posthog.com/pricing
- PostHog add-ons — https://posthog.com/addons
- PostHog billing limits and alerts — https://posthog.com/docs/billing/limits-alerts
- PostHog estimating usage and costs — https://posthog.com/docs/billing/estimating-usage-costs

Applied changes:

- Added section `Pricing e self-billing: pay-as-you-go + addon` to `outputs/montte-deep-integrated-ai-native-platform.md`.
- Updated `outputs/erp-billing-ai-native-roadmap.md` with pricing decision and AbacatePay/self-billing gate.
- Added rule: public billing remains preview/sandbox until `modules/billing` + `modules/payments` + AbacatePay can bill Montte itself.
