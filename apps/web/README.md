# @montte/web

Aplicação principal do Montte — ERP com dashboard, rotas SSR via TanStack Start e API via oRPC.

## Importante

Esta aplicação **não executa workflows DBOS**. Enfileira jobs via `DBOSClient` (durável, PostgreSQL-backed):

```ts
import { enqueueClassifyTransactionsBatchWorkflow } from "@modules/classification/workflows/enqueue";
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
| Jobs          | `DBOSClient` → `apps/worker` (DBOS queues nativas)             |
| Testes        | Vitest + PGlite (Postgres in-memory)                           |

## Desenvolvimento local

```bash
# Containers (Postgres, Redis, MinIO)
cd apps/web && docker compose up -d

# Na raiz do monorepo (inicia web + worker em paralelo)
bun dev
```

## Desktop local (Tauri)

O desktop inicial e um shell Tauri em `apps/web/src-tauri` que carrega o runtime web do TanStack Start/Nitro. Nesta fase ele nao reescreve auth, cookies, uploads ou oRPC para APIs nativas do desktop.

Pre-requisitos locais:

- Rust/Cargo instalados.
- Dependencias de sistema do Tauri instaladas para o seu sistema operacional.
- Envs normais do web em `apps/web/.env.local` ou via shell. O desktop usa o mesmo runtime web, entao segue o schema de `core/environment/src/web.ts`.
- Containers locais prontos quando a rota usada depender de Postgres, Redis ou MinIO.
- Hyprland/Wayland: o shell define `GDK_BACKEND=wayland,x11` quando a sessao e Wayland, define `WEBKIT_DISABLE_DMABUF_RENDERER=1` quando detecta Hyprland e remove a decoracao nativa da janela no Hyprland. As variaveis respeitam valores ja definidos no shell. Para testar outro comportamento de renderizacao, exporte esses valores antes do comando.

Comandos:

```bash
# Na raiz, abre o shell desktop e deixa o Tauri subir o dev server web em http://localhost:3000
bun run web:desktop:dev

# Na raiz, abre desktop + worker + landing com o mesmo bootstrap do bun dev
bun run dev:desktop

# Equivalente direto no projeto web
bun nx run web:desktop:dev

# Gera o binario desktop inicial sem instalador
bun run web:desktop:build
```

Decisoes e limitacoes iniciais:

- SSR/Nitro: em dev o shell aponta para `http://localhost:3000`. No build, o Tauri empacota `apps/web/.output/public` apenas como shell inicial; rotas SSR, server functions e APIs Nitro ainda dependem de uma decisao posterior entre sidecar local, backend remoto ou adaptacao desktop especifica.
- Auth/cookies: Better Auth continua no runtime web. Persistencia de sessao, cookies seguros e callbacks externos precisam de validacao no WebView antes de liberar distribuicao.
- Deep links: nao ha protocolo customizado registrado nesta fase. Convites, magic link e callbacks continuam assumindo rotas HTTP.
- Uploads: continuam passando pelas rotas Nitro/MinIO existentes. Permissoes nativas de filesystem/dialog ficam pendentes.
- oRPC: chamadas continuam HTTP contra o runtime web; nao existe bridge Tauri nativa para procedures.
- Distribuicao, instaladores, auto-update, code signing e variaveis de ambiente de empacotamento ficam pendentes para a proxima fase.

## Scripts

```bash
bun run dev          # dev server (porta 3000)
bun run dev:staging  # dev contra serviços de staging
bun run desktop:dev  # shell Tauri apontando para o dev server web
bun run desktop:build # build desktop Tauri sem instalador
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
