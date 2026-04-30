# Montte — Claude Code Guidelines

AI-powered ERP. Nx monorepo, Bun, TanStack Start (SSR), oRPC, TanStack Query, Drizzle ORM, PostgreSQL (ParadeDB). Brazilian Portuguese (pt-BR).

---

## Commands

```bash
bun dev                  # seeds event catalog (local) then starts web
bun dev:all              # all apps + packages
bun run build            # Nx-cached build
bun run typecheck
bun run check            # oxlint
bun run format           # oxfmt
bun run test             # parallel
bun run db:push
bun run db:studio:local       # or db:studio:prod
bun run check-boundaries # enforce import layer rules
bun run clean[:cache]
bun run auth:generate    # regen Better Auth schema
```

Scripts (`commander run|check`, `--env`, `--dry-run`): `scripts/seed-default-dashboard.ts`, `scripts/seed-event-catalog.ts`, `scripts/doctor.ts`.

First-time setup: `bun run setup` → `cd apps/web && docker compose up -d` → `bun run db:push && bun run seed:addons && bun run setup:stripe`.

**Gotchas:**

- `bun dev` re-seeds the event catalog every start; if it fails dev won't launch. Debug: `scripts/seed-event-catalog.ts run --env local`.
- "Module has no exported member" on typecheck → stale dist. `cd core/<pkg> && bun run build`.
- Never bump `NODE_OPTIONS` memory — fix the root cause.
- `apps/web/src/routeTree.gen.ts` is generated — never edit.

---

## Skills

Skills live in `.agents/skills/<name>/SKILL.md`. Open the SKILL.md before writing in that domain — skill content supersedes anything stale here. CI checks → `monitor-ci`. Linear (MON-\*) → `linear-cli`.

Domain → skill map (open before coding):

- oRPC handlers/errors → `neverthrow`. Schema/queries → `postgres-drizzle`. Search/BM25 → `paradedb-skill`. Redis → `redis-best-practices`.
- Client data → `tanstack-query`. Forms → `tanstack-form`. Tables → `tanstack-table` (+ `tanstack-virtual` for long lists). Routes → `tanstack-router`. Stores → `tanstack-store` (+ `tanstack-db`). SSR/server fns → `tanstack-start` (+ `tanstack-devtools`).
- AI agents → `tanstack-ai`. Durable workflows → `dbos-typescript`.
- Auth → `better-auth-best-practices` (sub-skills exist for email/2FA/orgs/scaffolding).
- shadcn primitives → `shadcn`. UI/UX review → `ui-ux-expert`. A11y → `wcag-audit-patterns`.

---

## Monorepo

```
core/         # agents, database, authentication, environment, redis, logging,
              # files, posthog, stripe, transactional, utils
apps/         # web (TanStack Start + oRPC), worker (DBOS)
packages/     # analytics, events, notifications, ui
tooling/      # oxc, tsconfigs
```

Catalogs (root `package.json`): `analytics-client`, `assistant-ui`, `astro`, `auth`, `database`, `development`, `dnd`, `environment`, `files`, `fot`, `logging`, `mastra`, `orpc`, `payments`, `react`, `search-providers`, `server`, `tanstack`, `tanstack-ai`, `telemetry`, `testing`, `transactional`, `ui`, `validation`, `vite`, `workers`. Internal: `"@core/database": "workspace:*"`.

Add a new dep → declare in the consuming package's `package.json` with the right catalog key.

---

## API — oRPC (NOT tRPC)

Routers in `apps/web/src/integrations/orpc/router/`. Context: `{ db, posthog?, organizationId, userId, session, auth, headers, request, stripeClient?, workflowClient }`.

**Rules:**

- Errors: only `WebAppError` (factories: `notFound`, `forbidden`, `unauthorized`, `badRequest`, `conflict`, `tooManyRequests`, `internal`, `database`, `validation`, `fromAppError`). Never `ORPCError` / raw `Error` / strings. **Messages always pt-BR** — they render directly in toasts.
- **No repository layer.** Routers query `context.db` directly; workflows use `<module>DataSource.runTransaction`.
- All writes inside `db.transaction(async (tx) => …)`. Single reads exempt.
- Business-rule checks (conflict/notFound) **outside** the transaction. `mapErr` always to `WebAppError.internal`. Empty `returning()` → throw `WebAppError.internal` (specific) outside the tx.
- Ownership via middleware: fetch entity, check `teamId`, pass via `next({ context: { entity } })`. Handler never re-queries.
- Bulk ops: dedicated procedure + `Promise.allSettled` server-side. Never loop `mutateAsync` on the client.
- Cost-incurring procedures: use `billableProcedure` + `.meta({ billableEvent: "<name>" })`. Pure CRUD stays on `protectedProcedure`.

Canonical pattern:

```typescript
const itemByIdProcedure = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .use(async ({ context, input, next }) => {
      const result = await fromPromise(
         context.db.query.items.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((item) =>
         !item || item.teamId !== context.teamId
            ? err(WebAppError.notFound("Item não encontrado."))
            : ok(item),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { item: result.value } });
   });
```

Available routers: account, agent-settings, analytics, api-keys, bank-accounts, billing, bills, budget-goals, categories, contact-settings, contacts, credit-cards, dashboards, financial-settings, insights, notifications, onboarding, organization, services, services-bills, session, tags, team, transactions.

---

## Client (oRPC + TanStack Query)

- `useSuspenseQuery` by default. Wrap every use in `<QueryBoundary fallback={<Skel/>} errorTitle="…">` — never raw `ErrorBoundary + Suspense`.
- Conditional queries: `useQuery + skipToken`, **or** render a child `<Suspense>{cond && <Child id/>}</Suspense>` for `useSuspenseQuery`. Never `useQuery + enabled`.
- 2+ independent queries in one component → `useSuspenseQueries` (no waterfalls).
- `select` aggressively — derive shape, don't store derived state.
- `input` inside `queryOptions()`. Callbacks inside `mutationOptions()`. Always use `orpc.proc.queryKey()` / `mutationKey()` — never manual arrays.
- Global `MutationCache` invalidates all queries after every mutation. Opt out with `meta: { skipGlobalInvalidation: true }`.
- Filters / sort / pagination / tabs / selected ids → URL search params via `validateSearch` + `navigate({ search: prev => …, replace: true })`. Not `useState`.
- SSE → `useQuery + experimental_liveOptions`. Never `consumeEventIterator + useEffect`.
- Types: `import type { Inputs, Outputs } from "@/integrations/orpc/client"`. Frontend never imports `@core/*`.
- Slugs: use `useDashboardSlugs` / `useOrgSlug` / `useTeamSlug` / `useActiveOrganization` / `useActiveTeam`. Never raw `useParams`.
- Direct `orpc.*` calls only inside route loaders for prefetch — components always use `useMutation`/`useSuspenseQuery`.

---

## Forms (TanStack Form)

- Schema at module level, never inside the component.
- `isInvalid = isTouched && errors.length > 0`. Drop `isTouched` for server-error-bound fields (conflicts with `onSubmitAsync`).
- Always set `id`, `name`, `aria-invalid`; `htmlFor` on `<FieldLabel>`. `children={(field) => …}` as explicit prop.
- `onSubmitAsync` only when a server conflict maps to a visible field. Generic CRUD → `onSubmit` + `toast.error` (use `fromPromise`). Server-field error returns `{ fields: { fieldName: "…" } }`. No footer error paragraph.
- `form.Subscribe` selectors must be specific — never `state => state`.
- Multi-step forms: local React context via factory function; type via `ReturnType<typeof createMyForm>`.
- Nav guard: `useBlocker({ withResolver: true, disabled: isCreate })`.

---

## Routes (TanStack Start)

Required on every route: `head()` (`"Page — Montte"` pt-BR), `pendingMs: 300` + `pendingComponent` when loader prefetches, `errorComponent` when loader uses blocking `ensureQueryData`, `validateSearch` fields use `.catch()` (never `.optional()`), `loaderDeps` whenever the loader reads search params.

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
   loader: ({ context, deps }) =>
      context.queryClient.prefetchQuery(
         orpc.feature.getAll.queryOptions({ input: deps }),
      ),
   pendingMs: 300,
   pendingComponent: FeatureSkeleton,
   head: () => ({ meta: [{ title: "Feature — Montte" }] }),
   component: FeaturePage,
});
```

Vite plugin order is critical: `tanstackStart({ router: { autoCodeSplitting: true } })` → `nitro({ preset: "bun" })` → `viteReact()`.

`createServerFn` only for HTTP-pure ops needing `process.env` or request context — not a replacement for oRPC. **Never `VITE_*` / `import.meta.env`** for public env vars (breaks Railway skipped builds) — read `process.env` from a server fn and pass via loader. Theme: `theme` cookie read in root loader, applied as `<html className>` (no `dangerouslySetInnerHTML`). Devtools always inside `<ClientOnly>` + `import.meta.env.DEV`.

---

## Database (Drizzle + ParadeDB)

Schemas in `core/database/src/schemas/`. **Always namespace** — never raw `pgTable(...)`:

- `financeSchema` → transactions, bank-accounts, bills, credit-cards, financial-goals, financial-settings
- `crmSchema` → contacts, contact-settings, tags
- `platformSchema` → dashboards, insights, event-catalog, webhooks, subscriptions, agents
- `auth` → Better Auth managed, **read-only** (use `additionalFields` in auth config)

Local DB image is `paradedb/paradedb` — don't swap.

---

## Auth (Better Auth)

Config: `core/authentication/src/server.ts`. Plugins: Magic Link, Email OTP, 2FA, Anonymous, HyprPay.

- Auth schema is read-only; extend via `additionalFields`.
- Queries → oRPC (`orpc.organization.*`). Mutations → `authClient` directly (never `useMutation`).
- `member.id ≠ user.id` — `member.id` for Better Auth APIs, `member.userId` for DB.
- Loading state: `useTransition`, not `useState<boolean>`.

---

## Worker / DBOS

DBOS runs in `apps/worker` — never the web process. Web enqueues via `context.workflowClient` (`DBOSClient`, PostgreSQL-backed). Each workflow file declares its own `WorkflowQueue`; DBOS processes them automatically.

**Workflow rules:**

- Use `<module>DataSource = new DrizzleDataSource<DatabaseInstance>(...)` per module. Inside steps: `dataSource.runTransaction(async () => { const tx = <module>DataSource.client; … }, { name })`. Generic gives a typed `client` — never cast. Never use plain `db` or repositories.
- Worker startup, in this order, per module: `await DrizzleDataSource.initializeDBOSSchema({ connectionString })` → init context store → create queues → side-effect import workflow files. All `setup<Module>Workflows(deps)` awaited before `launchDBOS()`. `initOtel()` before `launchDBOS()`. Without `initializeDBOSSchema` the `transaction_completion` table is missing and `runTransaction` throws.
- Logging: `DBOS.logger` only (string interpolation). Never replace with `getWorkerLogger` inside workflows — loses workflow context.
- Scheduling per-instance waits: `enqueueOptions.delaySeconds` on enqueue / self-reschedule (`DELAYED` status, no slot held). `DBOS.sleepms` may hold the slot — avoid for long waits. Reserve `@DBOS.scheduled` for fixed cron only.
- Self-rescheduling: re-check status in tx → do work → compute next wake **inside `DBOS.runStep`** → `DBOS.startWorkflow(self, { workflowID: "<deterministic-per-period>", queueName, enqueueOptions: { delaySeconds } })`.
- Workflow inputs always carry both `teamId` and `organizationId` — don't look them up inside steps.

Existing queues: `workflow:categorize` (10), `workflow:derive-keywords` (5), `workflow:benefit-lifecycle`, `workflow:period-end-invoice`, `workflow:trial-expiry`.

**Testing:** mock `@dbos-inc/dbos-sdk` with `vi.hoisted` + `dbosSdkMockFactory` / `drizzleDataSourceMockFactory` from `@core/dbos/testing/mock-dbos` — `registerWorkflow` must return the function directly. pglite-backed `setupTestDb()` for assertions. Time-mocked: `vi.useFakeTimers()` + `vi.setSystemTime(T0)`. End-to-end real-runtime smoke: `__tests__/integration/dbos-smoke.test.ts` (pglite + `@electric-sql/pglite-socket`). Example: `__tests__/workflows/period-end-invoice.test.ts`.

---

## AI Agents

Always `@tanstack/ai` + `@tanstack/ai-openrouter` (`catalog:tanstack-ai`). Never the Vercel AI SDK (`ai`, `@openrouter/ai-sdk-provider`).

```typescript
const result = await chat({
   adapter: openRouterText("liquid/lfm2-8b-a1b", { apiKey: env.OPENROUTER_API_KEY }),
   messages: [{ role: "user", content: [{ type: "text", content: prompt }] }],
   outputSchema: z.object({ … }),
   stream: false,
});
```

Single agent `rubiAgent` via `mastra.getAgent("rubiAgent")` + `createRequestContext({ userId, teamId, organizationId, model, language: "pt-BR" })` from `@packages/agents`.

---

## Billing (HyprPay)

100% usage-based. Customer = Better Auth organization (`externalId = organization.id`). Subscriptions support seats via item `quantity`. Stripe is legacy-only — `@core/stripe` will be removed.

**Bill only what costs us** (AI calls, email, storage, webhook egress). UI/CRUD/listings are free.

Two ingestion paths converge on `ingestUsageEvent`:

1. **Workflow steps** — call `ingestUsageEvent` inside `DBOS.runStep` after the cost-incurring action succeeds.
2. **Router-triggered costs** — `billableProcedure` + `.meta({ billableEvent })` → `onSuccess` middleware ingests one event per success.

Event names live in module `constants.ts` (e.g. `CLASSIFICATION_USAGE_EVENTS`, `TRANSACTIONAL_USAGE_EVENTS`). `ingestUsageEvent` is no-op without a configured meter and never throws — failed ingestion logs only, never rolls back the work. Always pass an `idempotencyKey`.

---

## Code Style

- TypeScript: **never `as`** in any form (including `[] as string[]`) — fix the source type. No redundant return types Claude can infer. No unused params (delete; no `_foo`). No JSDoc / section comments / inline rationale. No barrel files. No relative imports in `core/` — `@core/<pkg>/*`. No dynamic imports.
- Errors: **no `try/catch`** — use `neverthrow` (`fromPromise`, `fromThrowable`, `ok`, `err`, `Result`, `ResultAsync`, `safeTry`). Patterns: early return on `isErr`, `andThen` chains, no `match(v=>v, e=>throw)`, no `Promise.reject` inside `match`, fire-and-forget uses `.catch(log)`. Exception: tests and scripts.
- Control flow: early returns, never `else` after `return`. Minimize `useEffect` — derive state or use event handlers; `useEffect` only for external sync. Use `useCallback`, never `useStableHandler`.
- Dates: always `dayjs`. Never `new Date()` (exceptions: Drizzle `.$onUpdate()`, test fixtures). `.toDate()` for Drizzle, `.toISOString()` for ISO, `.format("YYYY-MM-DD")` for date strings.
- Naming: files kebab-case. Components PascalCase `[Feature][Action][Type]`. Hooks `use[Feature][Action]`.
- Tailwind: **no margin utilities** (`m-`, `mt-`, `mx-`, `space-x-*`, `space-y-*`) — use `gap-*`. Only `gap-2` or `gap-4`. Spacing/sizing only `2` and `4` suffixes (`p-*`, `px-*`, `size-*`).
- oxlint suppress: `// oxlint-ignore <rule>`. Array index keys: `` `step-${index + 1}` ``.
- Domain naming: tags are always **"Centro de Custo"**.

---

## UI Conventions

- Modals/sheets/drawers: **always `useCredenza`**. Destructive confirmation: `useAlertDialog`. Never import Sheet/Dialog/Drawer/AlertDialog/Credenza directly. `useSheet` is unused.
- Empty states: `Empty / EmptyHeader / EmptyMedia / EmptyTitle / EmptyDescription / EmptyContent` from `@packages/ui/components/empty`.
- DataTable (`@packages/ui/components/data-table`): never wrap in `Card`. Required props: `getRowId`, `sorting`, `onSortingChange`, `columnFilters`, `onColumnFiltersChange`, `tableState`, `onTableStateChange`. Column defs **must** be memoized. `manualSorting`/`manualFiltering` already wired internally. Per usage: a module-level `createLocalStorageState<DataTableStoredState | null>("montte:datatable:<feature>", null)` + `validateSearch` with `sorting` + `columnFilters` arrays. `ColumnMeta`: `label`, `filterVariant` (`"text"|"select"|"range"|"date"`), `align`, `exportable`. View toggle via `useViewSwitch("feature:view", VIEWS)` — never `renderMobileCard`.
- Animations: Tailwind-first. Framer Motion only for state-dependent enter/exit, `layoutId`, gestures — client components only, wrap shadcn primitives in `motion.div` (never modify them). Animate only `transform` and `opacity`.

**Component colocation:**

- Single-route → `-[name]/` next to the route (TanStack Router ignores `-` prefix). Relative imports allowed.
- Shared → `features/[name]/` (flat — no `hooks/`/`ui/`/`utils/`).

---

## Singletons

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

## State / Storage / Pacing

- Stores: `@tanstack/store` + `@tanstack/react-store` only. Never Zustand/Jotai/React-context for shared mutable state. `createStore()` (not `new Store()`). Object selectors always pass `shallow`. Derived → `createAtom`. Async → `createAsyncAtom`. Persisted → `createPersistedStore` from `@/lib/store`. Cross-store → `createStoreEffect`. Multi-store updates → `batch()`. Never store `ReactNode` (use render fns). Per-instance stores inside `useState` may use `new Store()`. SSR safety: `createClientOnlyFn` / `createIsomorphicFn` — never `typeof window` guards.
- All localStorage keys prefixed `montte:`.
- SSR-safe hooks via `foxact` subpaths — never `@uidotdev/usehooks`. Common: `foxact/use-local-storage`, `foxact/create-local-storage-state`, `foxact/use-session-storage`, `foxact/use-media-query`, `foxact/invariant`, `foxact/merge-refs`, `foxact/use-isomorphic-layout-effect`.
- Debounce/throttle/rate-limit: `@tanstack/react-pacer`. Never `foxact/use-debounced-value`. Async/`mutateAsync` → always `useAsyncDebouncedCallback`. Options object: `{ wait: 350 }`.

---

## F-O-T Libraries (`catalog:fot`)

| Library                      | Use for                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@f-o-t/money`               | All money — `toMajorUnitsString(of(decimal, "BRL"))` to normalize, `format(of("1500.00","BRL"), "pt-BR")` to display |
| `@f-o-t/csv`                 | CSV parse/generate — UI uses `useCsvFile` (never `FileReader.readAsText`)                                            |
| `@f-o-t/ofx`                 | OFX — `readAsArrayBuffer` + `parseBufferOrThrow(new Uint8Array(buffer))`, never `readAsText`                         |
| `@f-o-t/condition-evaluator` | Rule eval — `weight` lives on `ConditionGroup`, not `Condition`                                                      |

XLSX in UI: `useXlsxFile` from `@/hooks/use-xlsx-file`.

---

## Inputs (Maskito)

`@maskito/core` + `@maskito/react` for all structured inputs. `onInput` (not `onChange`), `defaultValue` (not `value`). `MaskitoOptions` at module scope; dynamic (CPF/CNPJ) via `useMemo`. Strip before API: `value.replace(/\D/g, "")`. Currency → `MoneyInput` from `@packages/ui/components/money-input`.

| Field    | Mask                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Telefone | `["(", /\d/, /\d/, ")", " ", /\d/, /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/, /\d/, /\d/]`                   |
| CPF      | `[/\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "-", /\d/, /\d/]`                        |
| CNPJ     | `[/\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "/", /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/]` |
| Agência  | `mask: /^\d{0,4}(-\d{0,1})?$/`                                                                             |
| Conta    | `mask: /^\d{0,12}(-\d{0,1})?$/`                                                                            |

---

## PostHog

All config in `@core/posthog/config` — never duplicate in `apps/web`.

```typescript
import { POSTHOG_SURVEYS, FEATURE_FLAG_KEYS } from "@core/posthog/config";
```

Import `usePostHog` from `posthog-js/react` directly — never re-export. `posthog.identify` + `posthog.group` only in `_dashboard.tsx` loader. `opt_in_site_apps: true` for `renderSurvey()`. Early-access stages from `getEarlyAccessFeatures()` — never hardcoded.

Surveys: `bugReport`, `featureRequest`, `featureFeedback`, `feedbackContatos`, `feedbackGestaoServicos`, `feedbackAnalisesAvancadas`, `feedbackDados`. Flags: `contatos`, `gestao-de-servicos`, `analises-avancadas`, `dados`.

---

## Environment

`SCREAMING_SNAKE_CASE`, Zod-validated in `core/environment/src/server.ts`. `.env*` lives in `apps/web/`. Public vars only via server fn → loader data (never `VITE_*` / `import.meta.env`).

---

## Onboarding

- Org: `organization.onboardingCompleted`
- Project: `team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`
- Procedures: `apps/web/src/integrations/orpc/router/onboarding.ts`

---

## Testing

```bash
bun run test
npx vitest run <file>
```

Tests live in `core/*` and `packages/*` — non-trivial logic only (Zod transforms, date/math, analytics, credits, repository queries). **No unit/integration tests in `apps/*`** (E2E pending, not yet introduced). Never test routers/components/hooks/singletons/file existence.

---

## Nx

- Always run via `nx`/`bun nx run|run-many|affected` — not the underlying tool.
- Plugin docs at `node_modules/@nx/<plugin>/PLUGIN.md` when present.
- Use Nx MCP tools when available. Never guess flags — check `nx_docs` or `--help`.
- Skill triage: scaffolding → `nx-generate`. Run tasks → `nx-run-tasks`. New package + `TS2307` for `@core/*`/`@packages/*`/`@montte/*` → `link-workspace-packages`. New plugin → `nx-plugins`. Importing repos → `nx-import`.

---

## Releases

Produto único (`apps/web`) — **CalVer** `YYYY.MM.DD` (tag `vYYYY.MM.DD`). Workflow `.github/workflows/release-weekly.yml` roda toda sexta 21:00 UTC: coleta commits + PRs mergeados desde a última tag, opencode bot gera release notes em pt-BR, cria tag + GitHub Release + Linear Release. Manual via `workflow_dispatch` (com `dry_run` opcional). Sem libraries publicadas — todo código vive no monorepo.

---

## TanStack Intent Skill Mappings

Load `use` with `npx @tanstack/intent@latest load <use>` when a task matches `when`. Sub-skills auto-load via parent.

If no mapping fits, run `npx @tanstack/intent@latest list` for less common local skills.

<!-- intent-skills:start -->

# Skill mappings - load `use` with `npx @tanstack/intent@latest load <use>`.

skills:

- when: "Working on the Rubi AI agent — chat endpoints, tools, middleware, structured outputs, adapter configuration, debug logging"
  use: "@tanstack/ai#ai-core"
- when: "Writing or debugging fixtures for AI / OpenRouter HTTP responses in classification or agent tests"
  use: "@copilotkit/aimock#write-fixtures"
- when: "TanStack Router routes, loaders, search params, navigation, code splitting, type safety, auth guards, SSR, errors"
  use: "@tanstack/router-core#router-core"
- when: "TanStack Start setup — server functions, server routes, middleware, deployment, execution model, isomorphic boundaries"
  use: "@tanstack/start-client-core#start-core"
- when: "React-specific TanStack Start — createStart, StartClient, StartServer, useServerFn, RSC"
  use: "@tanstack/react-start#react-start"
- when: "TanStack Devtools setup, plugin panels, marketplace, production stripping"
  use: "@tanstack/devtools#devtools-app-setup"
- when: "Working with .env files, dotenv config, encrypted env, variable expansion"
use: "dotenv#dotenv"
 <!-- intent-skills:end -->
