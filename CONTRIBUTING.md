# Contribuindo com o Montte

Montte e uma plataforma operacional com IA em um monorepo Nx. O produto principal roda em `apps/web`, a landing publica roda em `apps/landing`, os workflows duraveis rodam em `apps/worker`, a infraestrutura compartilhada fica em `core/` e os dominios de produto ficam em `modules/`.

Este guia descreve o estado atual do repositorio. Para detalhes de implementacao e regras de agente, leia tambem `AGENTS.md`.

## Pre-requisitos

- [Bun](https://bun.sh) >= 1.x
- [Node.js](https://nodejs.org) >= 22.12
- [Docker](https://www.docker.com) ou [Podman](https://podman.io) com Compose
- [Git](https://git-scm.com)

## Setup inicial

```bash
git clone https://github.com/Montte-erp/montte-nx.git
cd montte-nx
bun install
bun run setup
```

`bun run setup` cria `apps/web/.env.local`, sobe containers locais e aplica o schema quando o ambiente ja esta preenchido. Depois disso, o comando diario e:

```bash
bun dev
```

`bun dev` roda `scripts/dev-init.ts`, garante `.env.local`, instala dependencias se necessario, tenta subir os containers, roda `db:push` e inicia `web`, `worker` e `landing`.

Se o ambiente falhar antes de iniciar os apps, rode:

```bash
bun run doctor
```

## Comandos

```bash
bun dev                  # dev-init + web + worker + landing
bun dev:staging          # web em modo staging
bun dev:all              # todos os apps e pacotes com target dev
bun run build            # build via Nx cache
bun run typecheck        # typecheck via Nx
bun run check            # oxlint
bun run format           # oxfmt --write
bun run format:check     # oxfmt --check
bun run test             # testes via Nx
bun run test:coverage    # testes via Nx com coverage
bun run e2e              # Playwright
bun run e2e:ui           # Playwright UI
bun run db:push          # aplica schema no banco local
bun run db:push:prod     # aplica schema em producao
bun run db:studio:local  # Drizzle Studio local
bun run db:studio:prod   # Drizzle Studio producao
bun run check-boundaries # valida regras de importacao
bun run doctor           # diagnostico do ambiente
bun run clean            # limpeza segura
bun run clean:cache      # limpa cache
bun run auth:generate    # regenera schema do Better Auth
bun run landing:build    # build da landing Astro
bun run landing:start    # preview da landing
```

Scripts de workspace ficam em `scripts/`: `setup.ts`, `dev-init.ts`, `doctor.ts`, `clean.ts`, `db-push.ts`, `ensure-database.ts`, `ensure-schemas.ts`, `check-env.ts`, `env-setup.ts`, `set-bucket-cors.ts`, `backfill-category-icons.ts` e scripts auxiliares similares.

## Estrutura

```text
montte-nx/
├── apps/
│   ├── landing/         # Astro publico: site, blog, waitlist e PostHog
│   ├── web/             # TanStack Start SSR + agregador oRPC
│   ├── web-e2e/         # Playwright E2E
│   └── worker/          # runtime DBOS para workflows duraveis
├── core/                # infraestrutura compartilhada, sem regra de dominio
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
├── modules/             # dominios de produto atuais
│   ├── account/         # perfil, org, times, sessoes, API keys, onboarding
│   ├── agents/          # Montte AI, threads, tools e workflows de chat
│   ├── classification/  # categorias, centros de custo e classificacao
│   ├── finance/         # contas, transacoes, cartoes, parcelas, recorrencias
│   ├── inbox/           # inbox operacional e SSE
│   └── insights/        # relatorios
├── packages/
│   └── ui/              # shadcn primitives e componentes compartilhados
└── tooling/             # boundaries, oxc, Tailwind e tsconfigs
```

Novos dominios devem nascer em `modules/<nome>` como pacote `@modules/<nome>`. Cada modulo e dono de seus `router/`, `services/`, `workflows/`, `contracts/` e `sse/` quando existirem.

`apps/web` hospeda a UI e agrega routers em `apps/web/src/integrations/orpc/router/index.ts`. `apps/worker` importa workflows dos modulos e executa DBOS fora do processo web. Hoje o worker registra workflows de `classification` e `agents`.

## Produto atual

O app web tem telas para inbox, transacoes, contas bancarias, cartoes, categorias, centros de custo, relatorios, chat do Montte AI e configuracoes.

O repositorio tambem contem schemas para servicos, medidores, precos, assinaturas, itens de assinatura, cupons, beneficios, invoices e uso. Isso representa a base de recorrencia/cobrancas, mas ainda nao existe `@modules/billing` no workspace atual.

As integracoes oficiais sao PostHog e Twenty. Nao adicione outra integracao oficial sem decisao explicita de produto.

## Padroes de codigo

- Conteudo de produto e mensagens visiveis ao usuario devem ser pt-BR.
- Montte e masculino: use "o Montte", "do Montte" e "no Montte".
- oRPC usa `WebAppError`; nao use `ORPCError`, `Error` cru ou strings em handlers.
- Queries e schemas de banco ficam em Drizzle; schemas sempre usam namespaces, nunca `pgTable` cru.
- Escritas no banco ficam dentro de `db.transaction(async (tx) => ...)`.
- Nao crie repository layer para routers; consulte `context.db` diretamente.
- Em codigo novo de dominio, prefira `better-result` para erros esperados. Modulos legados que ja usam `neverthrow` podem continuar com ele, mas nao misture os dois no mesmo modulo.
- Evite `try/catch` fora de testes e scripts.
- Nao use casts com `as`; corrija o tipo na origem.
- Datas usam `dayjs`; evite `new Date()` fora das excecoes documentadas em `AGENTS.md`.
- Frontend chama oRPC via TanStack Query; componentes nao devem chamar `orpc.*` diretamente.
- Componentes usam `QueryBoundary` com `useSuspenseQuery` por padrao.
- Modais, sheets e drawers de formulario usam `useSheet`; confirmacoes destrutivas usam `useAlertDialog`.
- Tags no produto sao sempre chamadas de **Centro de Custo**.
- `apps/web/src/routeTree.gen.ts` e gerado; nao edite manualmente.

## Skills

Antes de mexer em um dominio, abra o skill correspondente. O conteudo do skill tem precedencia sobre instrucoes antigas.

Skills do repositorio ficam em `.agents/skills/<nome>/SKILL.md`.

Mapa rapido:

- Novo dominio, Payments/Vault ou erro de dominio: `better-result`
- Codigo legado oRPC/erros ainda em `neverthrow`: `neverthrow`
- oRPC client e TanStack Query: `tanstack-query`
- Banco, schemas e queries: `postgres-drizzle`
- Busca/BM25: `paradedb-skill`
- Redis: `redis-best-practices`
- DBOS e workflows: `dbos-typescript`
- Better Auth: `better-auth-best-practices`
- Formularios: `tanstack-form`
- Rotas e loaders: `tanstack-router`, `tanstack-start`
- Tabelas: `tanstack-table`, `tanstack-virtual`
- shadcn e UI primitives: `shadcn`
- UI/UX e acessibilidade: `ui-ux-expert`, `wcag-audit-patterns`
- Nx workspace: `nx-workspace`
- Geradores Nx: `nx-generate`
- Tarefas Nx: `nx-run-tasks`
- CI Nx Cloud: `monitor-ci`
- Linear: `linear-cli`

Para skills TanStack Intent, siga o bloco de mapeamento em `AGENTS.md` e carregue com:

```bash
npx @tanstack/intent@latest load <use>
```

## Testes e verificacao

Use Nx ou os scripts que ja chamam Nx:

```bash
bun run format
bun run check
bun run typecheck
bun run test
```

Para validacao focada:

```bash
bun nx run @modules/finance:test
bun nx run @modules/finance:typecheck
bun nx run web:typecheck
bun nx run landing:build
```

Testes unitarios e de integracao vivem em `core/*`, `modules/*`, `packages/*` e `__tests__/` de workspace. E2E vive em `apps/web-e2e/tests/`.

Nao adicione testes unitarios, integracao ou snapshots em `apps/*`. Para UI e fluxos reais, use Playwright em `apps/web-e2e`.

## Fluxo de PR

1. Atualize `master` antes de iniciar trabalho novo.
2. Crie branch com o identificador da issue quando existir: `manoelnetocarvalho03/mon-123-descricao-curta`.
3. Use worktree quando houver outras mudancas locais em andamento.
4. Mantenha o PR pequeno e focado.
5. Atualize documentacao junto com mudancas de fluxo, comandos, arquitetura ou comportamento publico.
6. Rode as verificacoes relevantes antes de abrir o PR.
7. Abra PR contra `master` com titulo objetivo, resumo do que mudou e validacoes executadas.
8. Declare riscos conhecidos e validacoes que nao foram rodadas.

Commits devem ser curtos e descritivos, por exemplo:

```text
docs: atualizar readme e contributing
```

## Problemas e sugestoes

- Bugs: inclua passos para reproduzir, comportamento esperado, comportamento atual e ambiente.
- Features: descreva o caso de uso, impacto esperado e restricoes conhecidas.
- Duvidas: verifique `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, issues e PRs existentes antes de abrir algo novo.
