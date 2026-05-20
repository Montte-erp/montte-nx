# Montte

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

**Montte** é a camada de billing que falta no SaaS brasileiro: cobranca recorrente, uso medido, faturamento e estado do cliente de um jeito que o founder nao precisa montar um ERP por fora.

Mentalmente o produto e uma mistura de **Autumn + Rillet**: o lado Autumn cuida do billing dev-facing (Customer como primitiva, `customers.state` agregando assinatura/uso/fatura/status numa chamada); o lado Rillet cuida do financeiro/contabil/ops AI-native (auto-categorizacao, conciliacao, dashboards). Junto fecha o ciclo sem empurrar o founder pra Omie, Bling ou Conta Azul.

O app ainda esta em pre-lancamento. A base de recorrencia/cobrancas ja aparece no modelo de dados e na direcao de produto, mas a superficie principal disponivel hoje e o dashboard web com financeiro, classificacao, inbox, relatorios, configuracoes, API keys e chat do Montte AI.

> **Status:** beta privado, sem garantia de estabilidade. Espere mudancas de schema, rotas e fluxos.

---

## Primeiros passos

### Requisitos

- [Bun](https://bun.sh/) >= 1.x
- [Node.js](https://nodejs.org/) >= 22.12
- [Docker](https://docs.docker.com/get-docker/) ou [Podman](https://podman.io/) com Compose

### Setup

```bash
git clone https://github.com/Montte-erp/montte-nx.git
cd montte-nx
bun install
bun run setup
```

Depois do setup inicial, use:

```bash
bun dev
```

`bun dev` roda `scripts/dev-init.ts`, garante `apps/web/.env.local`, instala dependencias quando necessario, tenta subir os containers locais, aplica o schema com `db:push` e inicia `web`, `worker` e `landing` em paralelo.

Para abrir o app desktop local via Tauri, use:

```bash
bun run dev:desktop
```

`bun run dev:desktop` roda o mesmo bootstrap, inicia `worker` e `landing`, e troca o `web:dev` por `web:desktop:dev`. O Tauri abre o shell desktop e sobe o runtime web em `http://localhost:3000`.

- App web: `http://localhost:3000`
- Landing Astro: `http://localhost:3001`
- Worker DBOS: processo separado em `apps/worker`

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para comandos, validacoes e padroes de contribuicao.

---

## O que existe hoje

### Web app (`apps/web`)

- Dashboard autenticado com TanStack Start, TanStack Router e oRPC.
- Rotas principais para inbox, transacoes, contas bancarias, cartoes, categorias, centros de custo, relatorios, chat e configuracoes.
- Agregador oRPC em `apps/web/src/integrations/orpc/router/index.ts`.
- OpenAPI/Scalar em `/api/openapi/docs` quando o app esta rodando.

### Landing (`apps/landing`)

- Landing publica em Astro.
- Blog, SEO, sitemap, waitlist e PostHog client-side.
- Build separado via `bun run landing:build`.

### Worker (`apps/worker`)

- Runtime DBOS separado do processo web.
- Inicializa observabilidade, Redis, PostHog e workflows dos modulos `classification` e `agents`.

### Financeiro (`@modules/finance`)

- Contas bancarias.
- Transacoes com criacao, listagem, filtros, status, bulk actions e importacao CSV/XLSX/OFX.
- Cartoes de credito, faturas e totais.
- Recorrencias e parcelas em servicos internos.

### Classificacao (`@modules/classification`)

- Categorias e subcategorias.
- Tags usadas no produto como **Centro de Custo**.
- Workflows de classificacao e derivacao de palavras-chave via DBOS.

### Inbox (`@modules/inbox`)

- Inbox operacional por time.
- Agregacao de pendencias como pagamentos a vencer e transacoes sem categoria.
- SSE para eventos operacionais e acoes de dismiss/snooze.

### Relatorios (`@modules/insights`)

- Relatorios persistidos e telas de detalhe.
- Base para analises financeiras e paineis internos.

### Conta, times e autenticacao (`@modules/account`, `@core/authentication`)

- Better Auth com Magic Link, Email OTP, 2FA, organizacoes, times e API keys.
- Perfil, sessoes, organizacao, times, onboarding, CNPJ e configuracoes financeiras.
- Dados isolados por organizacao/time.

### Montte AI (`@modules/agents`)

- Chat e threads dentro do dashboard.
- Ferramentas do agente chamam os mesmos procedimentos oRPC usados pela UI.
- TanStack AI + OpenRouter.
- Workflows para titulo de conversa e sugestoes.

### Recorrencia e cobrancas

Ainda nao existe um pacote `@modules/billing` no workspace atual. A base vive hoje em schemas do `@core/database`, como `services`, `meters`, `prices`, `subscriptions`, `subscription-items`, `coupons`, `benefits`, `invoices` e `usage-events`, alem de UI/copy da landing voltada para cobrancas recorrentes. A camada de produto e API dedicada ainda esta em construcao.

### Integracoes oficiais

- PostHog para analytics, surveys, feature flags, prompts e observabilidade.
- Twenty e o CRM externo planejado para a frente de waitlist/relacionamento.

---

## Stack

| Area | Tecnologias |
| :-- | :-- |
| Monorepo | Nx, Bun, TypeScript |
| Web | React 19, TanStack Start, TanStack Router, TanStack Query, TanStack DB, shadcn/ui, Tailwind CSS |
| Landing | Astro, React islands, sitemap, RSS/MDX quando aplicavel |
| API | oRPC, OpenAPI, Scalar |
| Banco | Drizzle ORM, PostgreSQL usando imagem local ParadeDB |
| Auth | Better Auth |
| Workflows | DBOS em `apps/worker` |
| IA | TanStack AI, OpenRouter, PostHog prompts |
| Realtime | Redis + `@core/sse` |
| Arquivos | MinIO via `@core/files` |
| Email | Resend + React Email |
| Observabilidade | PostHog, OpenTelemetry, Pino |
| Qualidade | oxlint, oxfmt, Vitest, Playwright |

---

## Estrutura

```text
montte-nx/
├── apps/
│   ├── landing/         # landing publica Astro
│   ├── web/             # app TanStack Start + agregador oRPC
│   ├── web-e2e/         # Playwright E2E
│   └── worker/          # runtime DBOS
├── core/                # infraestrutura compartilhada
│   ├── ai/
│   ├── authentication/
│   ├── database/
│   ├── dbos/
│   ├── environment/
│   ├── files/
│   ├── logging/
│   ├── orpc/
│   ├── posthog/
│   ├── redis/
│   ├── sse/
│   ├── transactional/
│   └── utils/
├── modules/             # dominios de produto
│   ├── account/
│   ├── agents/
│   ├── classification/
│   ├── finance/
│   ├── inbox/
│   └── insights/
├── packages/
│   └── ui/
└── tooling/
    ├── boundary/
    ├── css/
    ├── oxc/
    └── typescript/
```

`apps/web` hospeda a UI e agrega os routers dos modulos. `apps/worker` registra e executa workflows. `core/*` contem infra e singletons compartilhados. `modules/*` contem regras de dominio, routers, services, workflows e contratos quando existem.

---

## Comandos principais

```bash
bun dev                  # dev-init + web + worker + landing
bun run dev:desktop      # dev-init + desktop Tauri + worker + landing
bun dev:all              # todos os apps/pacotes com target dev
bun run build            # build via Nx
bun run typecheck        # typecheck via Nx
bun run check            # oxlint
bun run format           # oxfmt --write
bun run test             # testes via Nx
bun run db:push          # aplica schema local
bun run doctor           # diagnostico do ambiente
bun run check-boundaries # valida regras de importacao
bun run landing:build    # build da landing Astro
bun run e2e              # Playwright
```

Scripts operacionais ficam em `scripts/`, incluindo `setup.ts`, `dev-init.ts`, `doctor.ts`, `clean.ts`, `db-push.ts`, `ensure-database.ts`, `ensure-schemas.ts`, `check-env.ts`, `env-setup.ts`, `set-bucket-cors.ts` e `backfill-category-icons.ts`.

---

## API publica

Com o web app rodando, a referencia OpenAPI fica em:

```text
http://localhost:3000/api/openapi/docs
```

Para chamadas programaticas, crie uma chave em Configuracoes do projeto -> API Keys e envie `x-api-key`.

---

## Contribuicao

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir PR. O projeto usa padroes fortes para oRPC, Drizzle, TanStack Query, DBOS, UI e boundaries.

Roadmap e trabalho ativo vivem no Linear do Montte. Issues no GitHub sao bem-vindas para bugs e sugestoes publicas.

## Licenca

Apache-2.0. Veja [LICENSE.md](LICENSE.md).
