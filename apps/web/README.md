# @montte/web

Aplicação principal do Montte — ERP com dashboard, rotas SSR via TanStack Start e API via oRPC.

## Importante

Esta aplicação **não executa workflows DBOS**. Enfileira jobs via `DBOSClient` (durável, PostgreSQL-backed):

```ts
import { enqueueClassifyTransactionsBatchWorkflow } from "@modules/classification/workflows/classification-workflow";
await enqueueClassifyTransactionsBatchWorkflow(context.workflowClient, input);
```

`workflowClient` é um `DBOSClient` resolvido no middleware oRPC (`singletons.ts`). O processamento em background é feito pelo serviço `apps/worker`.

## Stack

| Concern       | Tecnologia                                                     |
| ------------- | -------------------------------------------------------------- |
| Framework     | TanStack Start (SSR), TanStack Router, React 19                |
| API           | oRPC (routers type-safe)                                       |
| Data fetching | TanStack Query (`useSuspenseQuery`, `useSuspenseQueries`)      |
| Formulários   | TanStack Form + Zod                                            |
| Estado        | TanStack Store (global), URL search params (filtros/sort/tabs) |
| UI            | `@packages/ui` (Radix + Tailwind + CVA)                        |
| Auth          | Better Auth (`@core/authentication`)                           |
| AI            | TanStack AI + OpenRouter                                       |
| Jobs          | `DBOSClient` → `apps/worker` (DBOS queues nativas)            |
| Testes        | Vitest + PGlite (Postgres in-memory)                           |

## Desenvolvimento local

```bash
# Containers (Postgres, Redis, MinIO)
cd apps/web && docker compose up -d

# Na raiz do monorepo (inicia web + worker em paralelo)
bun dev
```

## Scripts

```bash
bun run dev          # dev server (porta 3000)
bun run dev:staging  # dev contra serviços de staging
bun run build        # build de produção
bun run start        # inicia build de produção
bun run test         # Vitest + PGlite
bun run typecheck
bun run check        # oxlint
```

## Produção (Railway)

**Build command:** `NODE_ENV=production vite build`

**Start command:** `bun .output/server/index.mjs`

## Estrutura

```
src/
├── features/          # Componentes e hooks por feature
├── hooks/             # Hooks compartilhados
├── integrations/
│   ├── orpc/
│   │   ├── router/    # Handlers dos procedures oRPC
│   │   ├── server.ts  # Setup do servidor + contexto (workflowClient, redis, db...)
│   │   └── client.ts  # Client oRPC + inferência de tipos
│   └── singletons.ts  # Singletons do processo (db, redis, workflowClient, auth...)
├── layout/            # Layout do dashboard, sidebar, navegação
├── lib/               # Utilitários (persisted-store, etc.)
├── routes/            # Rotas file-based do TanStack Router
└── routeTree.gen.ts   # Auto-gerado — nunca editar manualmente
```

## Variáveis de ambiente

Ver `core/environment/src/web.ts` para o schema completo.
