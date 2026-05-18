# Montte — Claude Code Guidelines

AI-powered ERP. Nx monorepo, Bun, TanStack Start (SSR), oRPC, TanStack Query, Drizzle ORM, PostgreSQL (ParadeDB). Brazilian Portuguese (pt-BR).

---

## Commands

```bash
bun dev                  # dev-init (env.local, install, containers, db:push) then web + worker + landing
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
bun run landing:build    # build Astro landing page
bun run landing:start    # preview landing on Railway-compatible host/port
```

Scripts: `scripts/dev-init.ts`, `scripts/setup.ts`, `scripts/doctor.ts`, `scripts/clean.ts`, `scripts/db-push.ts`, `scripts/ensure-schemas.ts`, `scripts/check-env.ts`, `scripts/env-setup.ts`, `scripts/seed-default-dashboard.ts`, `scripts/backfill-category-icons.ts`.

First-time setup: `bun run setup` (creates `apps/web/.env.local`, starts containers, runs `db:push`). After that, `bun dev` is the daily driver.

**Gotchas:**

- `bun dev` runs `scripts/dev-init.ts` (ensures `.env.local`, installs deps, starts local containers, `db:push`), then `nx run-many` for `web`, `worker`, `landing`. If containers fail it warns but continues — verify with `bun run doctor`.
- "Module has no exported member" on typecheck → stale dist. `cd core/<pkg> && bun run build`.
- Never bump `NODE_OPTIONS` memory — fix the root cause.
- `apps/web/src/routeTree.gen.ts` is generated — never edit.

---

## Skills

Skills live in `.agents/skills/<name>/SKILL.md`. Open the SKILL.md before writing in that domain — skill content supersedes anything stale here. CI checks → `monitor-ci`. Linear (MON-\*) → `linear-cli`.

Domain → skill map (open before coding):

- New Payments/Vault/domain errors → `better-result`. Legacy oRPC handlers/errors still using `neverthrow` → `neverthrow`. Schema/queries → `postgres-drizzle`. Search/BM25 → `paradedb-skill`. Redis → `redis-best-practices`.
- Client data → `tanstack-query`. Forms → `tanstack-form`. Tables → `tanstack-table` (+ `tanstack-virtual` for long lists). Routes → `tanstack-router`. Stores → `tanstack-store` (+ `tanstack-db`). SSR/server fns → `tanstack-start` (+ `tanstack-devtools`).
- AI agents → `tanstack-ai`. Durable workflows → `dbos-typescript`.
- Auth → `better-auth-best-practices` (sub-skills exist for email/2FA/orgs/scaffolding).
- shadcn primitives → `shadcn`. UI/UX review → `ui-ux-expert`. A11y → `wcag-audit-patterns`.

---

## Monorepo

```
core/         # ai, authentication, database, dbos, environment, files, logging,
              # notifications, orpc, posthog, redis, sse, utils
modules/      # account, agents, billing, classification, finance, insights
              # — domain modules (router, services, workflows per module; not every module has all three)
apps/         # web (TanStack Start + oRPC), worker (DBOS), landing (Astro)
packages/     # ui (shadcn primitives + Montte components)
tooling/      # boundary, css (Tailwind), oxc, typescript
```

`apps/landing` is the public Astro landing page. It imports `@tooling/css/globals.css`, can server-render static shadcn components from `@packages/ui`, uses `public/favicon.svg`, and runs on port `3001` in development.

Catalogs (root `package.json`): `analytics-client`, `assistant-ui`, `astro`, `auth`, `database`, `development`, `dnd`, `environment`, `files`, `fot`, `logging`, `mastra`, `notifications`, `orpc`, `payments`, `react`, `search-providers`, `server`, `tanstack`, `tanstack-ai`, `telemetry`, `testing`, `ui`, `validation`, `vite`, `workers`. Internal: `"@core/database": "workspace:*"`.

Add a new dep → declare in the consuming package's `package.json` with the right catalog key.

---

## API — oRPC (NOT tRPC)

Routers live in `modules/<module>/src/router/<name>.ts` and are aggregated in `apps/web/src/integrations/orpc/router/index.ts` (only `notifications.ts` still lives at the aggregator). Context: `{ db, posthog?, organizationId, userId, session, auth, headers, request, workflowClient }`.

**Rules:**

- Errors: expected domain/router failures use `better-result` with owner-local `TaggedError` carrying an evlog catalog error with `status`. Handlers may throw those tagged errors directly; the global oRPC middleware maps them to the typed `.errors(...)` constructors. `@core/orpc` configures `Registry.throwableError = Error` following oRPC's no-throw-literal best practice, so never throw literals, raw strings, or plain objects. Do not use `WebAppError`, `AppError`, direct `ORPCError`, raw `Error`, strings, or wrapper factories. **Messages always pt-BR** — they render directly in toasts.
- **No repository layer.** Routers query `context.db` directly; workflows use `<module>DataSource.runTransaction`.
- All writes inside `db.transaction(async (tx) => …)`. Single reads exempt.
- Business-rule checks (conflict/notFound) **outside** the transaction. Empty `returning()` → return/throw the local tagged catalog error outside the tx.
- Ownership via middleware: fetch entity, check `teamId`, pass via `next({ context: { entity } })`. Handler never re-queries.
- Bulk ops: dedicated procedure + `Promise.allSettled` server-side. Never loop `mutateAsync` on the client.
- Cost-incurring procedures: use `billableProcedure` + `.meta({ billableEvent: "<name>" })`. Pure CRUD stays on `protectedProcedure`.

Canonical pattern:

```typescript
const itemByIdProcedure = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .use(async ({ context, input, next }) => {
      const result = await Result.gen(async function* () {
         const item = yield* Result.await(
            Result.tryPromise({
               try: () =>
                  context.db.query.items.findFirst({
                     where: (f, { eq }) => eq(f.id, input.id),
                  }),
               catch: () =>
                  new ItemRouterError({
                     error: itemRouterErrors.PERMISSION_CHECK_FAILED(),
                     message: "Falha ao verificar permissão.",
                  }),
            }),
         );

         if (!item || item.teamId !== context.teamId) {
            yield* new ItemRouterError({
               error: itemRouterErrors.NOT_FOUND(),
               message: "Item não encontrado.",
            });
         }

         return Result.ok(item);
      });
      if (Result.isError(result)) throw result.error;
      return next({ context: { item: result.value } });
   });
```

Available routers (aggregated keys): account, agentSettings, analytics, apiKeys, bankAccounts, benefits, categories, categoriesBulk, cnpj, contactSettings, contacts, coupons, creditCards, customerPortal, dashboards, financialSettings, insights, meters, notifications, onboarding, organization, prices, agent, services, session, subscriptionItems, subscriptions, tags, team, threads, transactions, usage.

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
- Types: `import type { Inputs, Outputs } from "@/integrations/orpc/client"`. Frontend never imports `@core/*`, except pure helpers from `@core/utils/*`.
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

Router config (`apps/web/src/router.tsx`) sets `defaultPendingMs: 0` and `defaultPendingMinMs: 0` so navigations swap instantly — without this the old route stays visible up to ~1s waiting for loaders. Page-transition animation lives in `apps/web/src/routes/auth/-auth/route-transition.tsx` for auth pages: keyed `motion.div` with **enter-only** animation (no `AnimatePresence` / `exit`) — exit animations cause overlapping h1s and visible flicker. Regression covered by `apps/web-e2e/tests/auth-route-transition.spec.ts`.

`createServerFn` only for HTTP-pure ops needing `process.env` or request context — not a replacement for oRPC. **Never `VITE_*` / `import.meta.env`** for public env vars (breaks Railway skipped builds) — read `process.env` from a server fn and pass via loader. Theme: `theme` cookie read in root loader, applied as `<html className>` (no `dangerouslySetInnerHTML`). Devtools always inside `<ClientOnly>` + `import.meta.env.DEV`.

---

## Database (Drizzle + ParadeDB)

Schemas in `core/database/src/schemas/`. **Always namespace** — never raw `pgTable(...)`:

- `financeSchema` → transactions, transaction-items, bank-accounts, credit-cards, credit-card-statements, credit-card-statement-totals, categories
- `crmSchema` → contacts, contact-settings, contact-subscriptions, services, service-prices, service-benefits, benefits, benefit-grants, meters, subscription-items, coupons, coupon-redemptions, resources, tags
- `platformSchema` → dashboards, insights, agent-settings, invoices, usage-events
- `settingsSchema` → financial config
- `agentsSchema` → threads
- `authSchema` → Better Auth managed (user, session, account, organization, team, member, invitation, twoFactor, apikey) — **read-only** (extend via `additionalFields` in auth config)

Local DB image is `paradedb/paradedb` — don't swap.

---

## Auth (Better Auth)

Config: `core/authentication/src/server.ts`. Plugins: Magic Link, Email OTP, 2FA, Organization, API Key.

- Auth schema is read-only; extend via `additionalFields`.
- Queries → oRPC (`orpc.organization.*`). Mutations → `authClient` directly (never `useMutation`).
- `member.id ≠ user.id` — `member.id` for Better Auth APIs, `member.userId` for DB.
- Loading state: `useTransition`, not `useState<boolean>`.

---

## Worker / DBOS

DBOS runs in `apps/worker` — never the web process. Web enqueues via `context.workflowClient` (`DBOSClient`, PostgreSQL-backed). Each workflow file declares its own `WorkflowQueue`; DBOS processes them automatically.

**DBOS vs pg-boss:**

- Use DBOS for durable/crítico workflows: billing, ledger, entitlement, invoice period closing, multi-step state machines, deterministic self-rescheduling, DBOS transactions/steps, and anything where replay/observability of a business workflow is part of the correctness model.
- Use pg-boss for simple operational jobs: one-shot background work, retries, DLQ, singleton/debounce behavior, queueing from a Drizzle transaction, and non-critical side effects that can be retried or manually inspected. Current default candidate: `agent-title`.
- pg-boss consumers run only in `apps/worker`. Web may enqueue through the oRPC context `pgBoss` promise and the package helper, but must not run workers/consumers.
- pg-boss jobs log through `@core/logging` (`evlog`) with structured fields (`module`, `message`, ids, tenant scope). Do not use DBOS.logger in pg-boss jobs.
- pg-boss jobs should use the platform features directly instead of local throttling logic: `retryLimit`, `retryDelay`, `retryBackoff`, `expireInSeconds`, `retentionSeconds`, `deadLetter`, `singletonKey`, `singletonSeconds`, `singletonNextSlot`, `sendDebounced`, `sendThrottled`, and `group` when the queue semantics need them. For `key_strict_fifo`, always provide a stable `singletonKey`.
- Every pg-boss job needs a Zod input schema, a typed `Result` return, a typed `TaggedError` union carrying evlog catalog errors, queue registration helpers, and a worker handler that validates `job.data` before doing work. Empty/missing pg-boss job ids are errors, not successful no-ops.
- If a job needs DBOS steps, workflow replay, deterministic scheduling, or is financially/security critical, keep it in DBOS instead of porting it to pg-boss.

**Workflow rules:**

- Use `<module>DataSource = new DrizzleDataSource<DatabaseInstance>(...)` per module. Inside steps: `dataSource.runTransaction(async () => { const tx = <module>DataSource.client; … }, { name })`. Generic gives a typed `client` — never cast. Never use plain `db` or repositories.
- Worker startup: `initOtel()` first, then `await setup<Module>Workflows(deps)` for every module, then `DBOS.launch()`. Each module's `setup<Module>Workflows` (in `modules/<m>/src/workflows/setup.ts`) is async and is responsible for: `await DrizzleDataSource.initializeDBOSSchema({ connectionString })` → init context store → create queues → side-effect import workflow files. The worker only wires deps and ordering. Without `initializeDBOSSchema` the `transaction_completion` table is missing and `runTransaction` throws.
- Logging: `DBOS.logger` only (string interpolation). Never replace with `getWorkerLogger` inside workflows — loses workflow context.
- Scheduling per-instance waits: `enqueueOptions.delaySeconds` on enqueue / self-reschedule (`DELAYED` status, no slot held). `DBOS.sleepms` may hold the slot — avoid for long waits. Reserve `@DBOS.scheduled` for fixed cron only.
- Self-rescheduling: re-check status in tx → do work → compute next wake **inside `DBOS.runStep`** → `DBOS.startWorkflow(self, { workflowID: "<deterministic-per-period>", queueName, enqueueOptions: { delaySeconds } })`.
- Workflow inputs always carry both `teamId` and `organizationId` — don't look them up inside steps.

Existing queues (modules with workflows: `classification`): `workflow:classify`, `workflow:derive-keywords` (classification). Agent title/suggestions are pg-boss jobs, not DBOS workflows. Worker startup (`apps/worker/src/index.ts`): `initOtel` → `setupClassificationWorkflows(deps)` → `setup<Module>Workflows(deps)` for modules that truly own DBOS workflows → `DBOS.setConfig` → `DBOS.launch()`; then start pg-boss and register job consumers such as `agent-title` / `agent-suggestions`. Each `setup<Module>Workflows` registers that module's current and future DBOS queues/workflows; pg-boss queues are registered separately.

**Testing:** mock `@dbos-inc/dbos-sdk` with `vi.hoisted` + `dbosSdkMockFactory` / `drizzleDataSourceMockFactory` from `@core/dbos/testing/mock-dbos` — `registerWorkflow` must return the function directly. pglite-backed `setupTestDb()` for assertions. Time-mocked: `vi.useFakeTimers()` + `vi.setSystemTime(T0)`. End-to-end real-runtime smoke: `__tests__/integration/dbos-smoke.test.ts` (pglite + `@electric-sql/pglite-socket`). Example: `__tests__/workflows/period-end-invoice.test.ts`.

---

## Logging

`@core/logging` is backed by `evlog`. The official wide-event drain is PostHog Logs via `createPostHogDrain({ mode: "logs" })`; do not add a parallel evlog OTLP drain. OTLP remains reserved for DBOS/TanStack AI observability (`initOtel` / future AI middleware) and should still drain into PostHog endpoints.

Web uses the Nitro v3 evlog module in `apps/web/nitro.config.ts` with `experimental.asyncContext`. Request context is available as `useRequest().context.log`; pass that logger into oRPC/server handlers instead of adding Pino plugins or standalone request loggers. Better Auth identity is attached in the evlog request hook with masked emails.

Request telemetry belongs in the evlog wide event and leaves through the PostHog Logs drain. Do not duplicate normal oRPC request telemetry with `captureServerEvent`; reserve direct PostHog capture for product analytics and identity/group calls.

No standalone health heartbeat/logger in `@core/logging`: Railway health stays on `/api/ping`, and service/request telemetry belongs to evlog or OTEL/TanStack AI. Do not keep unused SDK oRPC procedure layers; API key auth should live in the active oRPC middleware path when needed.

Error direction: domain errors belong to the owning module, not `@core/logging` or transport helpers. Define a local `defineErrorCatalog("<bounded-context>", ...)` in the file/bounded context that owns the failure, register it through `declare module "evlog"`, and when recoverable errors need to flow through `Result`, use one `TaggedError("<Context>Error")<{ error: ReturnType<typeof catalog.SOME_ERROR>; ...payload }>` per bounded context. Do not add wrapper classes or factories around `TaggedError`: no `makeXError`, `xInternal`, `xNotFound`, `dbError`, or similar shortcuts that hide the concrete catalog code. Instantiate `new TaggedErrorClass({ error: catalog.CODE(), message, ...typedPayload })` directly at the failure owner. Do not create module-wide `errors.ts` files just to centralize errors; colocate the catalog with the router/job/runtime/tool that owns the contract. oRPC transport mapping is global in `@core/orpc` through typed `.errors(...)`; modules should not translate expected failures to transport errors.

Audit logs are not part of the current migration. Do not wire `auditEnricher`, `auditOnly`, signed filesystem journals, MinIO journals, or `log.audit()` until the audit phase is explicitly reopened.

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

`modules/agents` owns the agentic platform runtime: chat execution, prompts, tools, agent-owned thread state, OpenUI/AG-UI integration, AI telemetry, and agent operational jobs. Non-agentic CRUD/actions stay in the owning domain modules and may be exposed to the agent only through typed tools.

Preferred structure:

```text
modules/agents/src/
  router/chat.ts    # oRPC chat stream + thread procedures
  runtime/          # chat(), middleware, model config, prompt assembly
  threads/          # thread/message schemas and persistence use cases
  tools/            # agent tool registry and domain tool adapters
  openui/           # OpenUI component library, prompt spec, examples
  jobs/             # pg-boss jobs: title, suggestions, lightweight async work
  workflows/        # DBOS only for durable multi-step agentic workflows
  harness/          # feature state, acceptance criteria, run evidence
  telemetry/        # AI trace attributes and product analytics mapping
```

TanStack AI chat lifecycle logic belongs in `ChatMiddleware`, not endpoint/client callbacks. Keep the runtime middleware cohesive in `runtime/middleware/create-agent-runtime-middlewares.ts`; do not split one tiny file per side effect. Title and suggestions are pg-boss jobs triggered from middleware `onFinish`; keep them out of DBOS unless they become durable business workflows requiring replay/steps. Use `ctx.defer()` for non-blocking side effects, pg-boss singleton/debounce/retry/DLQ options for operational pacing, and wrap recoverable failures with `better-result` (`Result.tryPromise`, tagged errors), not raw `try/catch`.

Chat transport belongs in oRPC, not a hand-written `/api/chat` route. Expose the stream as a typed oRPC procedure returning an Event Iterator (`streamToEventIterator`) and consume it from the TanStack AI client through an RPC stream adapter. Exclude streaming procedures from oRPC batching.

Agents code uses Zod at every contract edge: HTTP body, forwarded props, tool input/output, OpenUI tool specs, job payloads, workflow inputs, message metadata, and persisted assistant parts. Do not let `unknown` cross the edge; parse or convert it into a typed catalog error immediately.

Agents error pattern:

- New agents/domain flows use `better-result` with `TaggedError` carrying evlog catalog errors and explicit pt-BR messages; do not import `WebAppError` or mix `neverthrow` into `modules/agents` code.
- Do not create a module-wide `errors.ts`. Define the evlog catalog inside the owner: `agents.thread` in `router/chat.ts`, `agents.runtime` in the runtime middleware, `agents.job.title` in the title job, `agents.job.suggestions` in the suggestions job, and tool-specific catalogs in the owning tool file.
- Use one `TaggedError` class per bounded context (`AgentThreadError`, `AgentRuntimeError`, job/tool error). The `error` catalog return type is the discriminator; do not create one class per catalog code.
- A `TaggedError` payload should include `error: ReturnType<typeof catalog.ERROR_CODE>` plus the typed ids that help operate the failure (`threadId`, `teamId`, `organizationId`, `jobId`, `messageCount`). Avoid generic `operation` strings when the catalog code already identifies the failure.
- Do not pass unknown `cause` through agents errors and do not add `toError` helpers. Every expected failure must be represented by a catalog code plus controlled `internal` metadata.
- oRPC handlers in `modules/agents` may throw these typed tagged errors directly; do not translate them to `WebAppError` inside the module.

Agents pg-boss pattern:

- Title and suggestions are simple operational jobs, not DBOS workflows. Enqueue from `ChatMiddleware.onFinish` with `ctx.defer()` so chat response streaming does not wait for title/suggestion generation.
- Title generation uses a stable per-thread singleton/debounce window so repeated messages do not create competing title jobs.
- Suggestions use `sendDebounced` keyed by `threadId` so only the latest eligible message window wins.
- Job files own the queue names, dead-letter queues, queue creation, enqueue helper, Zod payload schema, handler, catalog, and tagged error type. Keep that cohesion in one job file unless the job grows into multiple real subdomains.
- Consumers live in `apps/worker`; web only enqueues through the `pgBoss` context promise and package helpers.

TanStack AI streams AG-UI events. For assistant-ui, prefer the native AG-UI runtime once the endpoint speaks the AG-UI contract: `@assistant-ui/react-ag-ui` + `HttpAgent` from `@ag-ui/client` + `useAgUiRuntime({ agent })`. It parses `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `THINKING_*`/`REASONING_*`, `STATE_SNAPSHOT`, `STATE_DELTA`, `RUN_ERROR`, and cancellation into assistant-ui state. While Montte keeps external thread state in TanStack DB/Query, `useExternalStoreRuntime` may remain as a transition adapter, but do not build a second custom AG-UI parser in the app.

OpenUI is the generative UI layer, not a replacement for AG-UI transport. Backend prompt assembly should include the OpenUI component/tool spec and ask the model for OpenUI Lang; the frontend renders OpenUI content with the OpenUI renderer inside assistant-ui message parts. Keep OpenUI component definitions and tool specs in `modules/agents/src/openui`, and generate/update the prompt spec as part of the agents package workflow.

No Mastra, no `@packages/agents`, no Vercel AI SDK.

---

## Billing (HyprPay)

100% usage-based. Customer = Better Auth organization. Subscriptions support seats via item `quantity`.

**Bill only what costs us** (AI calls, email, storage, webhook egress). UI/CRUD/listings are free.

Routers tag cost-incurring procedures with `billableProcedure` + `.meta({ billableEvent: "<name>" })` (`core/orpc/src/server.ts` — `BillableMeta`). Pure CRUD stays on `protectedProcedure`. Workflows write usage rows directly to the `usage-events` schema; the period-end-invoice workflow aggregates them via `summarizeUsageByMeter`. HyprPay ingestion middleware is planned but not wired yet — don't reference helpers that aren't in the codebase.

---

## Code Style

- TypeScript: **never `as`** in any form (including `[] as string[]`) — fix the source type. No redundant return types Claude can infer. No unused params (delete; no `_foo`). No JSDoc / section comments / inline rationale. No barrel files. No relative imports in `core/` — `@core/<pkg>/*`. No dynamic imports.
- `core/utils` is subpath-only and intentionally small: `@core/utils/dates`, `@core/utils/hash`, and `@core/utils/text` may be imported from apps, modules, core packages, and shared packages when the helper is pure and shared. No root barrel, no domain/UI helpers, no logging/redaction helpers, and no dependencies on logger, db, redis, PostHog, auth, or other infrastructure.
- Errors: **no `try/catch`** — for new Payments/Vault/domain code use `better-result` with tagged expected errors, Zod at contract edges, no `unknown` leakage, and serialization across workflow/API boundaries when needed. Legacy modules still on `neverthrow` may keep `fromPromise`, `fromThrowable`, `ok`, `err`, `Result`, `ResultAsync`, `safeTry`; do not mix both libraries inside one module. Exception: tests and scripts.
- Control flow: early returns, never `else` after `return`. Minimize `useEffect` — derive state or use event handlers; `useEffect` only for external sync. Use `useCallback`, never `useStableHandler`.
- Dates: always `dayjs`. Never `new Date()` (exceptions: Drizzle `.$onUpdate()`, test fixtures). `.toDate()` for Drizzle, `.toISOString()` for ISO, `.format("YYYY-MM-DD")` for date strings.
- Naming: files kebab-case. Components PascalCase `[Feature][Action][Type]`. Hooks `use[Feature][Action]`.
- Tailwind: **no margin utilities** (`m-`, `mt-`, `mx-`, `space-x-*`, `space-y-*`) — use `gap-*`. Only `gap-2` or `gap-4`. Spacing/sizing only `2` and `4` suffixes (`p-*`, `px-*`, `size-*`).
- oxlint suppress: `// oxlint-ignore <rule>`. Array index keys: `` `step-${index + 1}` ``.
- Domain naming: tags are always **"Centro de Custo"**.

---

## UI Conventions

- Modals/sheets/drawers: **forms always use `useSheet`**. Other modal flows use `useCredenza`. Destructive confirmation: `useAlertDialog`. Never import Dialog/Drawer/AlertDialog/Credenza primitives directly.
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
import { notificationsClient } from "@core/notifications/client";
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
- Step `features` is **multi-select** (PostHog-style). 2 options map 1:1 to `OnboardingProduct`: `finance` (Finanças), `contacts` (Negócios). URL search param: `features` (array). Empty selection is valid → `onboardingProducts: []`. **Don't add a "pick myself" option** — empty array already covers it.
- **Brand gender:** Montte é masculino. Sempre "no Montte" / "do Montte" / "o Montte" — nunca "na Montte".
- E2E coverage: `apps/web-e2e/tests/onboarding.spec.ts` + `multi-org-onboarding.spec.ts`. Helpers in `features/auth.ts` (`completeOnboarding`, `createAdditionalOrganization`, `pickFeature`).

---

## Testing

```bash
bun run test
npx vitest run <file>
```

Tests live in `core/*` and `packages/*` — non-trivial logic only (Zod transforms, date/math, analytics, credits, repository queries). **No unit/integration tests in `apps/*`** — never test routers/components/hooks/singletons/file existence.

Tests that exercise AI behavior must use `@copilotkit/aimock`/`LLMock` fixtures against the real TanStack AI call path. Do not mock local AI action functions just to bypass model calls; only mock surrounding queue/workflow boundaries when the AI behavior itself is not under test.

E2E tests live in `apps/web-e2e/tests/` (Playwright). Auth fixture in `fixtures.ts` injects authenticated `storageState`. For pages that require an unauthenticated session (e.g. `/auth/*`), use raw `import { test } from "@playwright/test"` + `test.use({ storageState: { cookies: [], origins: [] } })`.

E2E flow guidelines:

- Test real user flows, not implementation details. Prefer role/name locators and stable `data-testid` for unavoidable app chrome; never depend on generated classes or icon class names.
- Do not add `test.skip` to hide failures. If a flow is stale, update the test to current behavior and state why in code only when the reason is not obvious.
- Always clean up isolated Playwright resources. Any test that launches its own browser/context must close both in `finally`, using null checks or optional chaining.
- Keep flows deterministic. Avoid external API data in assertions; add local fallbacks, fixtures, or DB helpers when the app otherwise depends on network/cache state.
- Assert durable outcomes after UI actions: URL changes with `page.waitForURL`, persisted DB state via `helpers/db`, and visible user feedback when relevant.
- Preserve auth redirects across sign-in/sign-up/magic-link/email flows. When navigating between auth pages, pass the existing `redirect` search param instead of rebuilding it manually.
- For table/list flows, search or filter for records created by the test before asserting rows; do not assume pagination, ordering, or an empty shared team.
- E2E reliability comes before speed here: run web-e2e serially when tests share session/global DB state, and prefer explicit cleanup over parallel assumptions.

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

- when: "Working on the Montte AI agent — chat endpoints, tools, middleware, structured outputs, adapter configuration, debug logging"
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
