# @montte/web

Aplicação principal do Montte — ERP com dashboard, rotas SSR via TanStack Start e API via oRPC.

## Importante

Esta aplicação **não executa workflows DBOS**. Ela apenas enfileira jobs via Redis:

```ts
import { enqueueCategorizationWorkflow } from "@packages/workflows/queue";
await enqueueCategorizationWorkflow(context.redis, input);
```

O processamento em background é feito pelo serviço `apps/worker`.

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
| Testes        | Vitest + PGlite (Postgres in-memory)                           |

## Desenvolvimento local

```bash
# Containers (Postgres, Redis, MinIO)
cd apps/web && docker compose up -d

# Na raiz do monorepo
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
│   └── orpc/
│       ├── router/    # Handlers dos procedures oRPC
│       ├── server.ts  # Setup do servidor oRPC
│       └── client.ts  # Client oRPC + inferência de tipos
├── layout/            # Layout do dashboard, sidebar, navegação
├── lib/               # Utilitários (persisted-store, etc.)
├── routes/            # Rotas file-based do TanStack Router
└── routeTree.gen.ts   # Auto-gerado — nunca editar manualmente
```

## Variáveis de ambiente

Ver `core/environment/src/web.ts` para o schema completo.
