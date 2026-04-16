# web

Main application — TanStack Start (SSR) dashboard with oRPC routers and DBOS durable workflows.

## Dev Commands

```bash
bun dev           # Auto-setup on first run, starts at http://localhost:3000
bun dev:staging   # Dev against staging cloud services
bun run build     # Production build
bun run start     # Run production build locally
bun run test      # Run tests (Vitest + PGlite)
bun run typecheck # TypeScript checks
bun run check     # oxlint
```

## Stack

| Concern       | Technology                                                     |
| ------------- | -------------------------------------------------------------- |
| Framework     | TanStack Start (SSR), TanStack Router, React 19                |
| API           | oRPC (type-safe routers)                                       |
| Data fetching | TanStack Query (`useSuspenseQuery`, `useSuspenseQueries`)      |
| Forms         | TanStack Form + Zod validation                                 |
| State         | TanStack Store (global), URL search params (filters/sort/tabs) |
| UI            | `@packages/ui` (Radix + Tailwind + CVA)                        |
| Auth          | Better Auth (`@core/authentication`)                           |
| Workflows     | DBOS (durable workflows, cron, retries)                        |
| AI            | TanStack AI + OpenRouter                                       |
| Testing       | Vitest + PGlite (in-memory Postgres)                           |

## Structure

```
src/
├── features/          # Feature-specific components and hooks
├── hooks/             # Shared hooks
├── integrations/
│   └── orpc/
│       ├── router/    # oRPC procedure handlers
│       ├── server.ts  # oRPC server setup
│       └── client.ts  # oRPC client + type inference
├── layout/            # Dashboard layout, sidebar, navigation
├── lib/               # Utilities (persisted-store, etc.)
├── routes/            # TanStack Router file-based routes
└── routeTree.gen.ts   # Auto-generated — never edit manually
```
