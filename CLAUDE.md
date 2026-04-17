# Montte - Claude Code Guidelines

AI-powered ERP, Nx monorepo with Bun. Brazilian Portuguese (pt-BR).

---

## Commands

```bash
bun dev              # Seed event catalog (local) then start web app
bun dev:all          # Start all apps and packages
bun run build        # Build all (Nx cached)
bun run typecheck    # TypeScript checks
bun run check        # oxlint
bun run format       # oxfmt format
bun run test         # Tests with parallelization
bun run db:push      # Push schema changes
bun run db:studio:local
bun run db:studio:prod
bun run scripts/seed-default-dashboard.ts run [--env production] [--dry-run]
bun run scripts/seed-event-catalog.ts run [--env production] [--dry-run]
bun run scripts/doctor.ts check
```

**First-time setup:**

```bash
bun run setup                           # Interactive env setup wizard
cd apps/web && docker compose up -d     # Start Postgres (ParadeDB), Redis, MinIO
bun run db:push && bun run seed:addons && bun run setup:stripe
```

**Other useful:**

```bash
bun run check-boundaries  # Enforce monorepo layer import rules
bun run clean             # Remove all build artifacts
bun run clean:cache       # Clear Nx cache only
bun run auth:generate     # Regenerate Better Auth DB schema
bun run web:start         # Start production build locally
```

**⚠️ Gotchas:**

- `bun dev` seeds event catalog on every start — if seeding fails, dev won't launch. Debug: `bun run scripts/seed-event-catalog.ts run --env local`
- Typecheck "Module has no exported member"? Dist is stale — `cd core/<package> && bun run build`
- NEVER use `NODE_OPTIONS` to increase memory for builds — fix the root cause
- `apps/web/src/routeTree.gen.ts` is auto-generated — never edit manually

---

## Agent Skills — How to Use

Skills live in `.agents/skills/<name>/SKILL.md`. Each section below calls out its skill inline (e.g., "Use the `tanstack-store` skill..."). Open that `SKILL.md` before writing code in the domain — it has the full API, Montte conventions, and pitfalls. Skill supersedes stale assumptions from prior conversations.

CI checks → `monitor-ci` skill (prefer over `gh`/`glab`). Linear tickets (MON-*) → `linear-cli` skill.

---

## Monorepo Structure

```
montte-nx/
├── core/
│   ├── agents/          # AI agents
│   ├── database/        # Drizzle ORM schemas & repositories
│   ├── authentication/  # Better Auth setup
│   ├── environment/     # Zod-validated env vars
│   ├── redis/           # Redis singleton
│   ├── logging/         # Pino logger + error classes
│   ├── files/           # MinIO singleton
│   ├── posthog/         # PostHog server/client + config
│   ├── stripe/          # Stripe singleton
│   ├── transactional/   # Resend + email
│   └── utils/           # Shared utilities
├── apps/
│   └── web/             # TanStack Start (SSR) — dashboard + oRPC routers + DBOS workflows
├── packages/
│   ├── analytics/       # Analytics engine
│   ├── events/          # Event catalog, schemas, emit, credits
│   ├── notifications/   # Job notification types & schema (used by DBOS workflows)
│   └── ui/              # Radix + Tailwind + CVA components
├── libraries/
│   ├── cli/             # @montte/cli — TanStack Intent skills + CLI tooling
│   └── hyprpay/         # @montte/hyprpay — HyprPay SDK
└── tooling/             # oxc (lint/fmt), typescript configs
```

---

## API Layer — oRPC (NOT tRPC)

Repository/router error handling → use the `neverthrow` skill. Schema/query code → `postgres-drizzle` skill.

Routers: `apps/web/src/integrations/orpc/router/`
Available: account, agent-settings, analytics, api-keys, bank-accounts, billing, bills, budget-goals, categories, contact-settings, contacts, credit-cards, dashboards, financial-settings, insights, inventory, notifications, onboarding, organization, services, services-bills, session, tags, team, transactions

```typescript
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "../server";

export const getAll = protectedProcedure
   .input(z.object({ teamId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      // context: { db, posthog?, organizationId, userId, session, auth, headers, request, stripeClient? }
   });
```

**Router errors** — `WebAppError` only (NOT `ORPCError`, `Error`, `AppError`):
`notFound` · `forbidden` · `unauthorized` · `badRequest` · `conflict` · `internal` · `tooManyRequests` · `fromAppError(appError)`

**Repository errors** (`core/database/src/repositories/`) — `neverthrow` + `AppError`. Return `ResultAsync<T, AppError>` via `fromPromise`:

```typescript
import { fromPromise } from "neverthrow";

export function createItem(db: DatabaseInstance, data: CreateItemInput) {
   return fromPromise(
      (async () => {
         const [row] = await db.insert(...).values(data).returning();
         if (!row) throw AppError.database("Failed");
         return row;
      })(),
      (e) => (e instanceof AppError ? e : AppError.database("Failed", { cause: e })),
   );
}
```

**Router consumption** — `.match()` or `safeTry`, convert to `WebAppError`:

```typescript
return (await createItem(context.db, input)).match(
   (item) => item,
   (e) => { throw WebAppError.fromAppError(e); },
);
```

`AppError` factories: `database`, `validation`, `notFound`, `unauthorized`, `forbidden`, `conflict`, `tooManyRequests`, `internal`

**Bulk operations** — dedicated procedure, never loop `mutateAsync` on client:

```typescript
export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const results = await Promise.allSettled(input.ids.map(async (id) => { ... }));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw WebAppError.internal(`${failed} item(s) failed.`);
      return { deleted: input.ids.length };
   });
```

---

## Client-Side Patterns (oRPC + TanStack Query)

Use the `tanstack-query` skill for query/mutation API details, cache, invalidation, `experimental_liveOptions`.

- Always `useSuspenseQuery` — not `useQuery`. Exceptions: `experimental_liveOptions` and `skipToken` conditionals.
- `input` inside `queryOptions()`. Callbacks inside `mutationOptions()`.
- Global `MutationCache` invalidates all queries after every mutation. Opt out: `meta: { skipGlobalInvalidation: true }` on `mutationOptions()`.
- Never `useQuery + enabled` — use `skipToken` as input: `orpc.proc.queryOptions({ input: cond ? { ... } : skipToken })`.
- `skipToken` works with `useQuery` only — for conditional `useSuspenseQuery`, render a child component conditionally instead.
- `useSuspenseQueries` for 2+ independent queries in one component — avoids waterfall.
- `select` aggressively — derive the exact shape needed instead of storing derived state.
- URL search params over `useState` for filters, sort, pagination, active tabs, selected IDs — use `validateSearch` + `navigate({ search: (prev) => ({ ...prev, key: value }), replace: true })`.
- Always `orpc.procedure.mutationKey()` / `orpc.procedure.queryKey()` — never manual string arrays.

**Route slug hooks** — never raw `useParams`:

```typescript
import {
   useDashboardSlugs,
   useOrgSlug,
   useTeamSlug,
} from "@/hooks/use-dashboard-slugs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useActiveTeam } from "@/hooks/use-active-team";
```

**Hook selection:**

| Need                           | Hook                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| Single query                   | `useSuspenseQuery`                                                  |
| 2+ independent queries         | `useSuspenseQueries`                                                |
| Conditional query              | `useQuery` + `skipToken`, or child component for `useSuspenseQuery` |
| Partial query data             | `useSuspenseQuery` + `select`                                       |
| Prefetch                       | `queryClient.prefetchQuery` in route loader                         |
| Mutation state cross-component | `useMutationState` + `orpc.procedure.mutationKey()`                 |
| SSE / live stream              | `useQuery` + `experimental_liveOptions`                             |

**SSE / Live queries:**

```tsx
const { data } = useQuery(
   orpc.notifications.subscribe.experimental_liveOptions({ retry: true }),
);
useEffect(() => {
   if (!data) return; /* handle latest event */
}, [data]);
```

Never use `consumeEventIterator` + `useEffect` manually.

**Type inference** — never manual interfaces:

```typescript
import type { Inputs, Outputs } from "@/integrations/orpc/client";
type CnpjData = NonNullable<
   Inputs["onboarding"]["createWorkspace"]["cnpjData"]
>;
```

Frontend never imports backend schemas or `@core/*` packages.

---

## TanStack Form Pattern

Full API → `tanstack-form` skill.

- Schema at module level — never `z.object({...})` inside a component.
- `isInvalid`: `field.state.meta.isTouched && field.state.meta.errors.length > 0` for client fields. Drop `isTouched` for server-error fields (`onSubmitAsync` conflict).
- Always set `id`, `name`, `aria-invalid` on inputs; `htmlFor` on `<FieldLabel>`.
- Always `children={(field) => ...}` as explicit JSX prop.
- `onSubmitAsync` only when server conflict maps to a visible field. Generic CRUD → plain `onSubmit` + `toast.error`. Use `fromPromise` from `neverthrow`:
   ```tsx
   const result = await fromPromise(
      createMutation.mutateAsync(value),
      (e) => e,
   );
   if (result.isErr()) {
      if (result.error instanceof ORPCError && result.error.code === "CONFLICT")
         return {
            fields: { fieldName: "Já existe um registro com esse valor." },
         };
      return result.error instanceof Error ? result.error.message : "Erro inesperado.";
   }
   ```
- Server field error → `{ fields: { fieldName: "message" } }` from `onSubmitAsync`. No footer error paragraph — use `toast.error` for generic errors.
- Multi-step forms: local React context via factory function (never `ReturnType<typeof useForm<T>>`):
   ```tsx
   function createMyForm() { return useForm({ ... }); }
   type MyFormApi = ReturnType<typeof createMyForm>;
   const FormCtx = createContext<MyFormApi | null>(null);
   ```
- `form.Subscribe` — always specific selector, never `selector={(state) => state}`.
- Navigation guard — `useBlocker` with `withResolver: true`. Optional chain `blocker.proceed?.()` / `blocker.reset?.()`. Set `disabled: isCreate`.

---

## Suspense, Error Boundaries & Empty States

Always wrap `useSuspenseQuery` in `<QueryBoundary>` — never raw `ErrorBoundary + Suspense`:

```tsx
<QueryBoundary fallback={<MyPageSkeleton />} errorTitle="Erro ao carregar">
   <MyPageContent />
</QueryBoundary>
```

Use `errorFallback` for custom fallback. `fallback={null}` only for invisible-while-loading.

Conditional `useSuspenseQuery` — child component pattern (not `skipToken`):

```tsx
function ItemDetails({ id }: { id: string }) {
   const { data } = useSuspenseQuery(
      orpc.procedure.queryOptions({ input: { id } }),
   );
   return <div>{data.name}</div>;
}
// Parent: {selectedId && <Suspense fallback={<Skeleton />}><ItemDetails id={selectedId} /></Suspense>}
```

Empty states — always `Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent` from `@packages/ui/components/empty`.

---

## Code Style

Error handling rules below use `neverthrow` — open the `neverthrow` skill for `Result`, `ResultAsync`, `fromPromise`, `fromThrowable`, `safeTry` patterns.

- No `as` casts — fix source types.
- No redundant type annotations — only function params and exported boundaries.
- No unused params — remove entirely, never `_foo`.
- No JSDoc, section comments, or inline explanations.
- No barrel files (`index.ts` re-exports) — import from source directly.
- No relative imports in `core/` — use `@core/<package>/*`.
- No dynamic imports — static only.
- No `useStableHandler` — use `useCallback`.
- No margin utilities (`m-`, `mt-`, `mb-`, `mx-`, `my-`, `space-x-*`, `space-y-*`) — use `gap-*`.
- Gap: `gap-2` or `gap-4` only. Spacing/sizing: `2` and `4` suffixes only (`p-*`, `px-*`, `py-*`, `size-*`).
- Early returns over if/else — never `else` after `return`.
- No `try/catch` — use `neverthrow` (`fromThrowable`, `fromPromise`, `ok`, `err`, `Result`, `ResultAsync`). Exception: test files and scripts.
- Minimize `useEffect` — derive state, use event handlers. Only for external system sync.
- Dates: always `dayjs`. Never `new Date()` (exception: Drizzle `.$onUpdate()` and test fixture inserts). `.toDate()` for Drizzle values, `.toISOString()` for ISO, `.format("YYYY-MM-DD")` for date strings.
- Files: kebab-case. Components: PascalCase `[Feature][Action][Type]`. Hooks: `use[Feature][Action]`.
- oxlint suppress: `// oxlint-ignore <rule-name>`. Array index keys: ``key={`step-${index + 1}`}``.

---

## Domain Naming

Tags are always **"Centro de Custo"** — app is business-only.

---

## PostHog

All config in `@core/posthog/config`:

```typescript
import { POSTHOG_SURVEYS, FEATURE_FLAG_KEYS } from "@core/posthog/config";
```

- Import `usePostHog` from `posthog-js/react` directly — never re-export.
- `posthog.identify` + `posthog.group` called in `_dashboard.tsx` loader only.
- `opt_in_site_apps: true` required for `posthog.renderSurvey()`.
- Early access stages from `getEarlyAccessFeatures()` only — never hardcode `stage`.

**Surveys:** `bugReport`, `featureRequest`, `featureFeedback`, `feedbackContatos`, `feedbackProdutosEstoque`, `feedbackGestaoServicos`, `feedbackAnalisesAvancadas`, `feedbackDados`
**Feature flags:** `contatos`, `produtos-estoque`, `gestao-de-servicos`, `analises-avancadas`, `dados`

---

## Data Table Pattern

Pair with `tanstack-table` skill (column defs, sorting, filtering). Long lists → `tanstack-virtual` skill. Adding/debugging shadcn primitives → `shadcn` skill.

Use `DataTable` from `@packages/ui/components/data-table`. Never wrap in `Card`/`CardContent`.

Required props: `getRowId`, `sorting`, `onSortingChange`, `columnFilters`, `onColumnFiltersChange`, `tableState`, `onTableStateChange`.

Every usage needs:

1. `createLocalStorageState<DataTableStoredState | null>("montte:datatable:<feature>", null)` at module level
2. `validateSearch` on route with `sorting` + `columnFilters` arrays

- Column defs must be memoized: `const columns = useMemo(() => buildColumns(), [])`.
- `manualSorting` + `manualFiltering` already set internally — don't configure at call site.
- Column pinning: pass `columnPinning` in `tableState`.
- `ColumnMeta`: `label`, `filterVariant` (`"text"|"select"|"range"|"date"`), `align` (`"left"|"center"|"right"`), `exportable`.
- Card view: `view` prop (`"table"|"card"`). Never `renderMobileCard` (removed).
- View switch: `const { currentView, setView, views } = useViewSwitch("feature:view", VIEWS)`.

---

## Core Singletons

```typescript
import { db } from "@core/database/client";
import { auth } from "@core/authentication/server";
import { redis } from "@core/redis/connection";
import { posthog } from "@core/posthog/server";
import { stripeClient } from "@core/stripe";
import { resendClient } from "@core/transactional/utils";
import { minioClient } from "@core/files/client";
import { env } from "@core/environment/server";
```

---

## Dependency Catalogs

```json
"@orpc/server": "catalog:orpc",
"react": "catalog:react"
```

Available: `analytics-client`, `assistant-ui`, `astro`, `auth`, `database`, `development`, `dnd`, `environment`, `files`, `fot`, `logging`, `mastra`, `orpc`, `payments`, `react`, `search-providers`, `server`, `tanstack`, `telemetry`, `testing`, `transactional`, `ui`, `validation`, `vite`, `workers`

Internal: `"@core/database": "workspace:*"`

---

## AI Agents

Use the `tanstack-ai` skill. Durable execution (DBOS workflows, steps, queues, `DBOSClient`) → `dbos-typescript` skill.

Always `@tanstack/ai` + `@tanstack/ai-openrouter` (`catalog:tanstack-ai`). Never Vercel AI SDK (`ai`, `@openrouter/ai-sdk-provider`).

```typescript
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";

const result = await chat({
   adapter: openRouterText("liquid/lfm2-8b-a1b", { apiKey: env.OPENROUTER_API_KEY }),
   messages: [{ role: "user", content: [{ type: "text", content: prompt }] }],
   outputSchema: z.object({ ... }),
   stream: false,
});
```

**DBOS workflows** — always use repositories (`@core/database/repositories/*`). Never raw `db` in workflow steps.

Single agent `rubiAgent`:

```typescript
import { mastra, createRequestContext } from "@packages/agents";
const agent = mastra.getAgent("rubiAgent");
const context = createRequestContext({
   userId,
   teamId,
   organizationId,
   model: "openrouter/moonshotai/kimi-k2.5",
   language: "pt-BR",
});
const result = await agent.generate("...", { requestContext: context });
```

---

## Component Colocation

- Single-route → `-[name]/` folder next to route (TanStack Router ignores `-` prefix)
- Shared → `features/[name]/` (flat — no `hooks/`, `ui/`, `utils/` subfolders)
- Relative imports for colocated: `import { Foo } from "./-onboarding/foo"`

---

## TanStack Start

Use the `tanstack-start` skill for SSR, server functions, streaming, plugin order, `createServerFn`, `createClientOnlyFn`, `createIsomorphicFn`. Devtools panel → `tanstack-devtools` skill.

Vite config — plugin order critical:

```typescript
plugins: [
   tanstackStart({ router: { autoCodeSplitting: true } }), // MUST be first
   nitro({ preset: "bun" }),
   viteReact(),
];
```

`createServerFn` for HTTP-pure ops needing `process.env` or request context. NOT a replacement for oRPC domain queries.

**Public env vars** — never `VITE_*` / `import.meta.env` (inlined at build, breaks Railway skipped builds). Use `createServerFn` reading `process.env`, passed through loader data.

- Theme: read from `theme` cookie in root loader, applied as `className` on `<html>`. No `dangerouslySetInnerHTML`.
- Streaming SSR: active by default via `defaultStreamHandler`. To disable: swap for `defaultRenderHandler`.
- Devtools: always guard with `import.meta.env.DEV` inside `<ClientOnly>`.
- `createMiddleware` (Start) → HTTP-level concerns. oRPC middleware → domain logic with typed context.

---

## Routes

Use the `tanstack-router` skill for `validateSearch`, `loaderDeps`, `createFileRoute`, pending/error boundaries, search params.

```
apps/web/src/routes/
├── auth/                  # sign-in, sign-up, forgot-password, magic-link
├── _authenticated/$slug/$teamSlug/_dashboard/
│   ├── transactions.tsx, bank-accounts.tsx, bills.tsx, inventory/, ...
└── api/
```

Required on every route:

- `head()` — format: `"Page Name — Montte"` in Brazilian Portuguese
- `pendingMs: 300` + `pendingComponent` when loader does `prefetchQuery`
- `errorComponent` when loader uses blocking `ensureQueryData`
- `validateSearch` fields use `.catch()` not `.optional()` — prevents parse errors from bad URL params
- `loaderDeps` mandatory when loader reads search params

Pagination: `page` + `pageSize` in `validateSearch` with `.catch()` defaults. `loaderDeps` to make loader reactive. Navigate to change page.

**Full route pattern:**

```typescript
export const Route = createFileRoute("/feature")({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .catch([])
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .catch([])
         .default([]),
      page: z.number().int().min(1).catch(1).default(1),
      pageSize: z.number().int().catch(20).default(20),
   }),
   loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.feature.getAll.queryOptions({
            input: { page: deps.page, pageSize: deps.pageSize },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: FeatureSkeleton,
   head: () => ({ meta: [{ title: "Feature — Montte" }] }),
   component: FeaturePage,
});
```

---

## Database (Drizzle ORM + PostgreSQL)

Use the `postgres-drizzle` skill for schemas, queries, relations, joins, transactions, JSONB, indexes, RLS. Full-text search / BM25 → `paradedb-skill`. Redis caching/TTL → `redis-best-practices` skill.

Schemas: `core/database/src/schemas/`

**PostgreSQL schema namespaces** — never `pgTable(...)` directly:

```typescript
import {
   financeSchema,
   crmSchema,
   inventorySchema,
   platformSchema,
} from "@core/database/schemas/schemas";
// finance → transactions, bank-accounts, bills, credit-cards, financial-goals, financial-settings
// crm → contacts, contact-settings, tags
// inventory → inventory items
// platform → dashboards, insights, event-catalog, webhooks, subscriptions, agents
// auth → Better Auth managed — read-only
```

**Local Postgres image** — `paradedb/paradedb` (not plain postgres). Do not swap locally.

Repositories: `core/database/src/repositories/` — always `validateInput()`, `AppError`, `propagateError()`.

---

## Authentication (Better Auth)

Use `better-auth-best-practices` skill for server/client config, adapters, sessions, plugins. Email/password flows → `email-and-password-best-practices`. 2FA (TOTP, OTP, backup codes) → `two-factor-authentication-best-practices`. Multi-tenant orgs/teams/invitations/RBAC → `organization-best-practices`. Scaffolding auth from scratch (OAuth providers, route handlers, UI pages) → `create-auth-skill`.

Config: `core/authentication/src/server.ts`. Plugins: Google OAuth, Magic Link, Email OTP, 2FA, Anonymous.

- **Auth tables read-only.** Never edit `core/database/src/schemas/auth.ts` — use `additionalFields` in auth config.
- Queries → oRPC (`orpc.organization.*`). Mutations → `authClient` directly, never `useMutation`.
- `member.id ≠ user.id` — `member.id` for Better Auth APIs, `member.userId` for DB queries.
- Loading state: `useTransition`, not `useState<boolean>`.

---

## Global UI Hooks

Design review, screen/flow design, responsive patterns → `ui-ux-expert` skill. Accessibility/WCAG 2.2 audits → `wcag-audit-patterns` skill. Adding or debugging shadcn primitives → `shadcn` skill.

**Never import Sheet/Dialog/Drawer/AlertDialog/Credenza directly.**

| Hook             | Use For                   |
| ---------------- | ------------------------- |
| `useCredenza`    | All modals and overlays   |
| `useAlertDialog` | Destructive confirmations |

`useSheet` is NOT used. Always `useCredenza`.

---

## Input Masking (Maskito)

`@maskito/core` + `@maskito/react` for all structured inputs. Never manual handlers.

- `onInput` not `onChange`. `defaultValue` not `value`.
- `MaskitoOptions` at module scope. Dynamic (CPF/CNPJ): `useMemo`.
- Strip before API: `value.replace(/\D/g, "")`.
- Currency: `MoneyInput` from `@packages/ui/components/money-input`.

| Field    | Mask                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Telefone | `["(", /\d/, /\d/, ")", " ", /\d/, /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/, /\d/, /\d/]`                   |
| CPF      | `[/\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "-", /\d/, /\d/]`                        |
| CNPJ     | `[/\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "/", /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/]` |
| Agência  | `mask: /^\d{0,4}(-\d{0,1})?$/`                                                                             |
| Conta    | `mask: /^\d{0,12}(-\d{0,1})?$/`                                                                            |

---

## F-O-T Libraries (`catalog:fot`)

| Library                      | Use for                                                |
| ---------------------------- | ------------------------------------------------------ |
| `@f-o-t/money`               | All money: parsing, formatting, arithmetic, conversion |
| `@f-o-t/csv`                 | CSV parsing + generation                               |
| `@f-o-t/ofx`                 | OFX parsing + generation                               |
| `@f-o-t/condition-evaluator` | Rule/condition evaluation                              |

- CSV in UI: `useCsvFile` from `@/hooks/use-csv-file` — never `FileReader.readAsText`.
- XLSX in UI: `useXlsxFile` from `@/hooks/use-xlsx-file` — never manual `FileReader`.
- OFX: `readAsArrayBuffer` + `parseBufferOrThrow(new Uint8Array(buffer))` — never `readAsText`.
- Money: `toMajorUnitsString(of(decimalStr, "BRL"))` to normalize; `format(of("1500.00", "BRL"), "pt-BR")` to display.
- Condition evaluator: `weight` on `ConditionGroup`, not individual `Condition`.

---

## TanStack Store

Use the `tanstack-store` skill for full API (`createStore`, `useStore`, `createAtom`, `createPersistedStore`, `createStoreEffect`, `batch`, `createAsyncAtom`). Reactive collections / live queries / optimistic mutations → `tanstack-db` skill.

`@tanstack/store` + `@tanstack/react-store` for all client-side global state. Never Zustand, Jotai, or React context for shared mutable state.

**Store creation** — always `createStore()`, never `new Store()`:
```typescript
import { createStore } from "@tanstack/react-store";

const myStore = createStore<MyState>({ count: 0, name: "" });
```

**Reading in React** — `useStore` with selector. Primitive selectors need no comparator. Object selectors always pass `shallow`:
```typescript
import { useStore, shallow } from "@tanstack/react-store";

const count = useStore(myStore, (s) => s.count);
const { count, name } = useStore(myStore, (s) => ({ count: s.count, name: s.name }), shallow);
```

**Updating:**
```typescript
myStore.setState((s) => ({ ...s, count: s.count + 1 }));
```

**Derived state** — `createAtom` for computed values, never inline derivation in components:
```typescript
import { createStore, createAtom } from "@tanstack/react-store";

const store = createStore<{ items: Item[]; filter: string }>({ items: [], filter: "" });

const filteredItemsAtom = createAtom(() => {
   const { items, filter } = store.state;
   return items.filter((i) => i.name.includes(filter));
});

// Atoms chain — activeTabMetaAtom depends on allTabMetasAtom
const allTabMetasAtom = createAtom(() => { /* reads store.state */ });
const activeTabMetaAtom = createAtom(() => {
   const all = allTabMetasAtom.get(); // reactive dependency
   const { activeId } = store.state;
   return all.find((t) => t.id === activeId) ?? all[0] ?? null;
});

// In component — useStore works with atoms directly
const filtered = useStore(filteredItemsAtom, (s) => s);
const active = useStore(activeTabMetaAtom, (s) => s);
```

**Persisted store** — `createPersistedStore` from `@/lib/store`. Uses `createClientOnlyFn` for SSR safety. Hydrates from localStorage, auto-persists on change, cross-tab sync via `storage` event. No hook needed:
```typescript
import { createPersistedStore } from "@/lib/store";

const sidebarStore = createPersistedStore<SidebarState>("montte:sidebar", { isCollapsed: false });

// Use like any other store — persistence is automatic
const isCollapsed = useStore(sidebarStore, (s) => s.isCollapsed);
```

**Store effects** — `createStoreEffect` from `@/lib/store` for store-to-store coordination outside React. Replaces `useEffect` bridges between stores with deterministic subscriptions:
```typescript
import { createStoreEffect } from "@/lib/store";

// Guarantee: when activeSection becomes null, searchQuery auto-clears
createStoreEffect(transientStore, (next, prev) => {
   if (prev.activeSection !== null && next.activeSection === null) {
      transientStore.setState((s) => ({ ...s, searchQuery: "" }));
   }
});
```
Effects run synchronously after `setState`, before React render. Guard with `prev !== next` comparisons to avoid infinite loops. Return a cleanup function from the effect callback if needed.

**Batch updates** — `batch()` groups multiple store updates into one notification cycle:
```typescript
import { batch } from "@tanstack/react-store";

batch(() => {
   storeA.setState((s) => ({ ...s, count: 1 }));
   storeB.setState((s) => ({ ...s, name: "foo" }));
});
// Subscribers notified once with final state
```

**Async derived** — `createAsyncAtom` for async computations:
```typescript
import { createAsyncAtom } from "@tanstack/react-store";

const asyncAtom = createAsyncAtom(async () => {
   const data = await fetchSomething(store.state.id);
   return data;
});
// Returns { status: "pending" | "done" | "error", data?, error? }
```

**Rules:**
- Never store `React.ReactNode` in store state — use render functions `() => React.ReactNode`.
- Never `useStore(store, (s) => s)` without `shallow` — full-state subscriptions re-render on any change.
- Prefer narrow selectors. Split monolithic hooks into focused sub-hooks.
- Derived state in `createAtom`, never computed inline in components.
- Per-instance stores (inside `useState`) can use `new Store()` — only global/module-level stores use `createStore()`.
- All localStorage keys prefixed `montte:`.
- SSR safety: `createClientOnlyFn` / `createIsomorphicFn` from `@tanstack/react-start` for browser-only code. Never `typeof window !== "undefined"`.

---

## Foxact Hooks

SSR-safe — import from subpaths. Never `@uidotdev/usehooks`.

| Need                                 | Import                                |
| ------------------------------------ | ------------------------------------- |
| localStorage (dynamic key)           | `foxact/use-local-storage`            |
| localStorage (fixed key, syncs tabs) | `foxact/create-local-storage-state`   |
| sessionStorage                       | `foxact/use-session-storage`          |
| Media queries                        | `foxact/use-media-query`              |
| Context guard                        | `foxact/invariant`                    |
| Merge refs                           | `foxact/merge-refs`                   |
| SSR-safe layout effect               | `foxact/use-isomorphic-layout-effect` |

All localStorage keys prefixed `montte:`. Prefer `createClientOnlyFn`/`createIsomorphicFn` over `typeof window` guards.

---

## TanStack Pacer

`@tanstack/react-pacer` for all debounce/throttle/rate-limiting. Never `foxact/use-debounced-value`.

| Hook                        | Use for                                                   |
| --------------------------- | --------------------------------------------------------- |
| `useDebouncedCallback`      | Sync callbacks                                            |
| `useAsyncDebouncedCallback` | Async callbacks / `mutateAsync` — handles race conditions |
| `useThrottledCallback`      | Limited frequency callbacks                               |
| `useThrottledValue`         | Throttled derived values                                  |
| `useRateLimiter`            | Hard action frequency limit                               |

- Async or `mutateAsync` → always `useAsyncDebouncedCallback`.
- Options: `{ wait: 350 }` (object, not positional).

---

## Events & Credits

Files in `packages/events/`: `finance.ts`, `ai.ts`, `contact.ts`, `inventory.ts`, `service.ts`, `nfe.ts`, `document.ts`, `webhook.ts`, `emit.ts`, `credits.ts`

- `emitEvent()` — non-throwing.
- `enforceCreditBudget()` — throws; wrap as `WebAppError.forbidden(...)` in routers.
- In generators: emit/track BEFORE final yield.

**Billable procedures** — `createBillableProcedure(eventName)` instead of base procedure:

```typescript
export const create = createBillableProcedure("finance.transaction_created")
   .input(CreateTransactionSchema)
   .handler(async ({ context, input }) => {
      const tx = await createTransaction(...);
      context.scheduleEmit(() => emitFinanceTransactionCreated(context.emit, context.emitCtx, { ... }));
      return mapTransaction(tx);
   });
```

Pre-handler enforces budget. Post-handler (success only) runs `scheduleEmit`.

**Free-tier limits** (from `@core/stripe/constants`): `finance.transaction_created` (500), `webhook.delivered` (500), `contact.created` (50), `inventory.item_created` (50), `service.created` (20), `finance.statement_imported` (10).

---

## Testing

```bash
bun run test
npx vitest run <path-to-test-file>
```

**Three layers:**

1. oRPC router integration tests (`apps/web/__tests__/integrations/orpc/router/`) — every DB procedure
2. Repository tests (`core/database/__tests__/repositories/`) — non-trivial queries only
3. Pure logic unit tests — Zod transforms, date/math utilities, analytics, credits logic

**Don't test:** React components, hooks wrapping `useSuspenseQuery`/`usePostHog`, singleton init, file existence.

**⚠️ Gotchas:**

- `member` and `team` tables have no `.defaultNow()` on `createdAt` — always provide `createdAt: new Date()` in test inserts.
- Tests use **PGlite** (in-memory Postgres) — no real DB needed. Pattern in `apps/web/__tests__/helpers/setup-integration-test.ts`.
- `vi.mock('@dbos-inc/dbos-sdk')` required in any test file importing workflow files.

Use the `orpc-testing` skill when writing new oRPC procedure tests.

---

## Scripts

All in root `scripts/`. Required: `commander` with `run`+`check` commands, `--env`, `--dry-run`, `chalk`, env from `apps/web/.env*`.

---

## Environment Variables

`SCREAMING_SNAKE_CASE`, Zod-validated in `core/environment/src/server.ts`. Env files in `apps/web/`.

Never `VITE_*` / `import.meta.env` for public vars — inlined at build, breaks Railway skipped builds. Use `createServerFn` + loader data instead.

---

## Onboarding

- Organization: `organization.onboardingCompleted`
- Project: `team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`

Procedures: `apps/web/src/integrations/orpc/router/onboarding.ts`

---

## Billing Model

100% usage-based via Stripe meter events. Free tier per event (Redis counters, monthly TTL). Above free tier → Stripe meter events. Optional addons (Boost, Scale, Enterprise). Redis tracks real-time; materialized views reconcile hourly (DBOS workflow).

---

## Montte CLI Skills (`@montte/cli` via TanStack Intent)

Skills *authored* by `libraries/cli/` and published as `@montte/cli`. Distinct from `.agents/skills/` (which are consumed in this repo). Built with TanStack Intent.

```json
{
   "keywords": ["tanstack-intent"],
   "files": ["dist", "skills", "!skills/_artifacts"]
}
```

Skill file `skills/<domain>/SKILL.md`:

```yaml
---
name: "@montte/cli/<domain>"
description: > Use when <specific triggering condition>.
type: core | sub-skill | framework | lifecycle | composition | security
library: "@montte/cli"
library_version: "0.1.0"
sources:
  - "Montte-erp/montte-nx:libraries/cli/src/<file>.ts"
---
```

`name` matches directory slug. `description` is triggering condition. Max 500 lines. Never commit `skills/_artifacts/`.

```bash
npx @tanstack/intent@latest validate   # before publishing
npx @tanstack/intent@latest stale      # after modifying source files
```

---

## TanStack Config (`@tanstack/vite-config`)

Used in `libraries/` for dual ESM+CJS output.

- Single `entry` string — cannot override via `mergeConfig`.
- Extra subpath entries: separate esbuild script after main build.
- `publint --strict` validates exports map.
- `moduleResolution: "bundler"` in `tsconfig.json`.
- Being sunset — new packages use `tsdown`.

---

## Library Releases (`libraries/`)

Auto-published when no GitHub tag exists. Requirements:

1. `package.json` not `"private": true`
2. `CHANGELOG.md` exists
3. Latest version heading matches `package.json` version

CI triggers on `master` pushes touching `libraries/**/CHANGELOG.md` or `libraries/**/package.json`. Always update `CHANGELOG.md` before merging.

---

## Animations

Tailwind-first (`transition-*`, `animate-*`). Framer Motion only for: state-dependent enter/exit, `layoutId` transitions, gesture-driven motion.

Only animate `transform` and `opacity` — never `width`, `height`, `top`, `left`, `margin`, `padding`.

Framer Motion components in client components only. Never modify shadcn/ui primitives — wrap with `motion.div` instead.


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools
- Running any workspace task (build/test/lint/serve) → `nx-run-tasks` skill
- New package created, getting `TS2307` / "cannot find module" for `@core/*`, `@packages/*`, `@montte/*` → `link-workspace-packages` skill
- Adding a new Nx plugin (new framework/tech) → `nx-plugins` skill
- Importing/merging another repo via `nx import` → `nx-import` skill

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->