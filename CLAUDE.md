# Montte - Claude Code Guidelines

AI-powered ERP, Nx monorepo with Bun. Brazilian Portuguese (pt-BR).

---

## Commands

```bash
bun dev              # Seed event catalog (local) then start web app
bun dev:all          # Start all apps and packages
bun dev:worker       # Worker only
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

**⚠️ Gotchas:**

- `bun dev` seeds event catalog on every start. If seeding fails, dev won't launch — run `bun run scripts/seed-event-catalog.ts run --env local` to debug.
- Typecheck fails with "Module has no exported member"? Dist is stale — `cd core/<package> && bun run build`.
- NEVER use `NODE_OPTIONS` to increase memory for builds — fix the root cause.

---

## Monorepo Structure

```
montte-nx/
├── core/
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
│   ├── web/             # TanStack Start (SSR) — dashboard + oRPC routers
│   ├── server/          # Elysia API (SDK consumers)
│   └── worker/          # BullMQ processor (queues + processors in src/)
├── packages/
│   ├── agents/          # Mastra AI agents
│   ├── analytics/       # Analytics engine
│   ├── events/          # Event catalog, schemas, emit, credits
│   ├── feedback/        # Product feedback primitives
│   └── ui/              # Radix + Tailwind + CVA components
├── libraries/sdk/       # TypeScript SDK
└── tooling/             # oxc (lint/fmt), typescript configs
```

---

## API Layer — oRPC (NOT tRPC)

Routers: `apps/web/src/integrations/orpc/router/`
Available: account, agent, analytics, bank-accounts, billing, bills, budget-goals, categories, chat, contacts, credit-cards, dashboards, early-access, feedback, insights, inventory, onboarding, organization, search, services, services-bills, session, tags, team, transactions, webhooks

```typescript
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "../server";

export const getAll = protectedProcedure
   .input(z.object({ teamId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      // context: { db, posthog?, organizationId, userId, session, auth, headers, request, stripeClient? }
   });
```

**Errors in routers** — use `WebAppError` (NOT `ORPCError`, NOT `Error`, NOT `AppError`):

```typescript
throw WebAppError.notFound("Not found");
throw WebAppError.forbidden("...");
throw WebAppError.unauthorized("...");
throw WebAppError.badRequest("...");
throw WebAppError.conflict("...");
throw WebAppError.internal("...");
throw WebAppError.tooManyRequests("...");
throw WebAppError.fromAppError(appError); // convert from repository
```

**Errors in repositories** (`core/database/src/repositories/`) — use `AppError` + `propagateError()`:

```typescript
try {
   const [row] = await db.insert(...).returning();
   if (!row) throw AppError.database("Failed");
   return row;
} catch (err) {
   propagateError(err); // re-throws AppError as-is
   throw AppError.database("Failed");
}
```

Available factories: `database`, `validation`, `notFound`, `unauthorized`, `forbidden`, `conflict`, `tooManyRequests`, `internal`.

**Bulk operations** — dedicated procedure, never loop `mutateAsync` on the client:

```typescript
export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const results = await Promise.allSettled(input.ids.map(async (id) => { ... }));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) throw WebAppError.internal(`${failed} item(s) failed.`);
      return { deleted: input.ids.length };
   });
// Client calls once, shows one summary toast
```

---

## Client-Side Patterns (oRPC + TanStack Query)

- Use `useSuspenseQuery` (not `useQuery`) — guarantees data is defined.
- `input` goes INSIDE `queryOptions()`.
- Mutation callbacks go INSIDE `mutationOptions()`.
- Wrap suspense components in `<Suspense>` at route/layout level.
- Global `MutationCache` in `root-provider.tsx` invalidates all queries after every mutation — per-mutation invalidation only needed for cross-tree queries. Do NOT report missing per-mutation invalidations as bugs.

**Type inference** — never define manual interfaces for router data:

```typescript
import type { Inputs, Outputs } from "@/integrations/orpc/client";
type CnpjData = NonNullable<
   Inputs["onboarding"]["createWorkspace"]["cnpjData"]
>;
type WorkspaceResult = Outputs["onboarding"]["createWorkspace"];
```

Zod schemas belong in the backend. Frontend only imports inferred types via `Inputs`/`Outputs` — never imports backend schemas or `@core/*` packages.

---

## TanStack Form Pattern

### Rules

- **Schema at module level** — never define `z.object({...})` inside a component function; always declare at module scope to prevent recreation on every render.
- **`isInvalid` check** — use `field.state.meta.isTouched && field.state.meta.errors.length > 0` (not `!field.state.meta.isValid`).
- **Accessibility** — always set `id={field.name}`, `name={field.name}`, `aria-invalid={isInvalid}` on `<Input>`/`<PasswordInput>`/`<Textarea>`. Always set `htmlFor={field.name}` on `<FieldLabel>`.
- **`children` prop** — always use `children={(field) => ...}` as an explicit JSX prop, not `{(field) => ...}` as JSX children.

---

## Suspense, Error Boundaries & Empty States

### Suspense + ErrorBoundary

Every component that calls `useSuspenseQuery` must be wrapped in both `<Suspense>` and `<ErrorBoundary>` at the route or layout level.

```tsx
// ErrorBoundary is always the outer layer
<ErrorBoundary
   FallbackComponent={createErrorFallback({ errorTitle: "Erro ao carregar" })}
>
   <Suspense fallback={<MyPageSkeleton />}>
      <MyPageContent />{" "}
      {/* calls useSuspenseQuery — no isLoading checks inside */}
   </Suspense>
</ErrorBoundary>
```

- Always provide a meaningful skeleton — `fallback={null}` only for invisible-while-loading components (e.g. filter popovers).
- `createErrorFallback` from `@packages/ui/components/error-fallback`. Custom fallback only for complex retry logic.

### Empty States

Use the `Empty` family of components from `@packages/ui/components/empty` for all empty states. Never build custom empty states with raw `div` + `flex` + icon patterns.

```tsx
<Empty>
   <EmptyHeader>
      <EmptyMedia variant="icon">
         <SomeIcon />
      </EmptyMedia>{" "}
      {/* variant omitted = illustration */}
      <EmptyTitle>Nenhum item encontrado</EmptyTitle>
      <EmptyDescription>Crie o primeiro item para começar.</EmptyDescription>
   </EmptyHeader>
   <EmptyContent>{/* action buttons */}</EmptyContent>
</Empty>
```

---

## Code Style

- **No type casting** — never use `as` or `as unknown as`. Fix the source types.
- **No comments** — no JSDoc, section dividers, or inline explanations.
- **No barrel files** — never create `index.ts` re-exports. Import directly from source.
- **No relative imports in `core/`** — use `@core/<package>/*` aliases (oxlint enforced).
- **No dynamic imports** — always use static `import`.
- **No `useStableHandler`** — use `useCallback` instead.
- **No margin utilities** — never `m-`, `mt-`, `mb-`, `ml-`, `mr-`, `mx-`, `my-`, `space-x-*`, `space-y-*`. Use `gap-*` with flex/grid.
- **Gap values** — only `gap-2` and `gap-4`. Never `gap-1`, `gap-3`, `gap-6`, etc.
- **Spacing & sizing scale** — only `2` and `4` suffixes for `p-*`, `px-*`, `py-*`, `size-*`. Never `py-8`, `size-6`, etc.
- **Early returns over if/else** — always guard and return early; never use `else` after a `return`.
- **Minimize `useEffect`** — derive state, use event handlers. Only for external system sync.
- **Dates** — always `dayjs`. Never raw `Date` math or manual string formatting.
- **URL search params over local state** — filters, sort, pagination live in `validateSearch` on the route. `useState` only for ephemeral input buffers.
- **Files:** kebab-case. **Components:** PascalCase `[Feature][Action][Type]`. **Hooks:** `use[Feature][Action]`.
- **oxlint suppression:** `// oxlint-ignore <rule-name>` above the triggering line.
- **Array index keys:** `key={\`step-${index + 1}\`}`over suppressing`noArrayIndexKey`.

---

## Domain Naming

Tags are always **"Centro de Custo"** — app is business-only. Use this label in UI text, variable names, and router procedures.

---

## PostHog

All config (survey IDs, feature flag keys) in `@core/posthog/config` — never hardcode.

```typescript
import { POSTHOG_SURVEYS, FEATURE_FLAG_KEYS } from "@core/posthog/config";
```

- Import `usePostHog` from `posthog-js/react` directly — never re-export.
- Import `posthog` default from `posthog-js` for imperative calls.
- Identity (`posthog.identify` + `posthog.group`) called in `_dashboard.tsx` loader only.
- Opt-out: `posthog.opt_out_capturing()` / `posthog.opt_in_capturing()` — no DB field.
- `opt_in_site_apps: true` required for `posthog.renderSurvey()`.
- Early access stages from `getEarlyAccessFeatures()` only — never hardcode `stage`.

**Surveys:** `bugReport`, `featureRequest`, `featureFeedback`, `feedbackContatos`, `feedbackProdutosEstoque`, `feedbackGestaoServicos`, `feedbackAnalisesAvancadas`, `feedbackDados`
**Feature flags:** `contatos`, `produtos-estoque`, `gestao-de-servicos`, `analises-avancadas`, `dados`

---

## Data Table Pattern

Use `DataTable` from `@packages/ui/components/data-table`. Never wrap in `Card`/`CardContent`.

Required props: `getRowId`, `sorting`, `onSortingChange`, `columnFilters`, `onColumnFiltersChange`, `tableState`, `onTableStateChange`.

Every usage needs:

1. `createLocalStorageState<DataTableStoredState | null>("montte:datatable:<feature>", null)` at module level.
2. `validateSearch` on the route with `sorting` + `columnFilters` arrays (or `useState` for non-route components).

**Card view** — pass `view` prop (`"table" | "card"`). Never use `renderMobileCard` (removed). Never write inline `if (view === "card")` blocks — DataTable handles it.

**View switch pattern:**

```typescript
const { currentView, setView, views } = useViewSwitch("feature:view", VIEWS);
<DefaultHeader viewSwitch={{ options: views, currentView, onViewChange: setView }} />
<DataTable view={currentView} ... />
```

---

## Core Singletons

Import directly — never create factory functions or re-export wrapper files:

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

Use `catalog:<name>` for existing catalogs, not pinned versions:

```json
"@orpc/server": "catalog:orpc",
"react": "catalog:react"
```

Available: `analytics-client`, `assistant-ui`, `astro`, `auth`, `database`, `development`, `dnd`, `environment`, `files`, `fot`, `logging`, `mastra`, `orpc`, `payments`, `react`, `search-providers`, `server`, `tanstack`, `telemetry`, `testing`, `transactional`, `ui`, `validation`, `vite`, `workers`

Internal packages: `"@core/database": "workspace:*"`.

---

## AI Agents

Single agent: `rubiAgent`. Usage in routers:

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

- Single-route code → colocate in `-[name]/` folder next to the route (TanStack Router ignores `-` prefix).
- Shared code → `features/[name]/` (flat — no `hooks/`, `ui/`, `utils/` subfolders).
- Import colocated files with relative paths: `import { Foo } from "./-onboarding/foo"`.

---

## Routes (TanStack Router — file-based)

```
apps/web/src/routes/
├── auth/                  # sign-in, sign-up, forgot-password, magic-link
├── _authenticated/$slug/$teamSlug/_dashboard/
│   ├── transactions.tsx, bank-accounts.tsx, bills.tsx, inventory/, ...
└── api/
```

Conventions: kebab-case, `$` for dynamic segments, `_` for layout routes.

---

## Database (Drizzle ORM + PostgreSQL)

Schemas: `core/database/src/schemas/` — bank-accounts, bills, budget-goals, categories, contacts, credit-cards, dashboards, insights, inventory, services, transactions, webhooks, auth.

Repository pattern: `core/database/src/repositories/` — always use `validateInput()`, `AppError`, and `propagateError()` (see API Layer section).

---

## Authentication (Better Auth)

Config: `core/authentication/src/server.ts`. Plugins: Google OAuth, Magic Link, Email OTP, 2FA, Anonymous.

**⚠️ Auth tables are read-only.** Never edit `core/database/src/schemas/auth.ts` directly. Tables: `user`, `session`, `account`, `verification`, `organization`, `team`, `member`, `teamMember`, `invitation`, `twoFactor`. To add custom fields to `user`/`session`/`organization`/`team`, use `additionalFields` in the auth config.

**Query/mutation split:**

- Queries → always oRPC (`orpc.organization.*`) — enriches raw Better Auth data with DB fields.
- Mutations → `authClient` directly. Never wrap in `useMutation`.

**member.id ≠ user.id** — use `member.id` for Better Auth APIs (`removeMember`, `updateMemberRole`); use `member.userId` for user-keyed table queries. `getMembers` must expose both.

**Client authClient pattern** — use `useTransition`, not `useState<boolean>` for loading:

```typescript
const [isPending, startTransition] = useTransition();
// In onClick or form onSubmit:
startTransition(async () => { await authClient.method(...); });
```

---

## Global UI Hooks (TanStack Store)

**ALWAYS use these — never import Sheet/Dialog/Drawer/AlertDialog/Credenza components directly.**

| Hook             | Use For                                         |
| ---------------- | ----------------------------------------------- |
| `useCredenza`    | All modals and overlays — creating/editing records, selecting agents, export formats, any overlay UI |
| `useAlertDialog` | Destructive confirmations                       |

> **Note:** `useSheet` is NOT used in this project. Always use `useCredenza`.

---

## Input Masking (Maskito)

Use `@maskito/core` + `@maskito/react` for all structured text inputs. Never build manual mask handlers or use `onChange` + `replace(/\D/g, '')` patterns for formatted inputs.

- Always use `onInput` (not `onChange`) — Maskito fires before React's synthetic event.
- Use `defaultValue` (not `value`) — controlled `value` conflicts with Maskito's DOM manipulation.
- Define `MaskitoOptions` at **module scope**, not inside components.
- For dynamic masks (e.g. CPF vs CNPJ), use `useMemo` to compute options.
- Strip formatting before API calls: `value.replace(/\D/g, "")`.
- `inputMode="numeric"` on digit-only inputs.
- For currency inputs, use `MoneyInput` from `@packages/ui/components/money-input`.

---

## F-O-T Libraries (`catalog:fot`)

Use these libraries for their respective domains — never roll custom implementations.

| Library                      | Use for                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@f-o-t/money`               | All money operations: parsing, formatting, arithmetic, conversion                                                                                                |
| `@f-o-t/csv`                 | CSV parsing (`parseOrThrow(content, { hasHeaders: true, trimFields: true })`) and generation (`generateFromObjects`)                                             |
| `@f-o-t/ofx`                 | OFX parsing (`parseBufferOrThrow(new Uint8Array(buffer))` — always use buffer, not string, for Brazilian bank encoding) and generation (`generateBankStatement`) |
| `@f-o-t/condition-evaluator` | Rule/condition evaluation with weighted scoring (`evaluateConditionGroup` with `scoringMode: "weighted"`)                                                        |

**Money usage:**

```typescript
import { of, format, parse, toMajorUnitsString } from "@f-o-t/money";

// Parse any currency string (handles R$ 1.234,56 and 1500.00)
const normalized = toMajorUnitsString(of(decimalStr, "BRL"));

// Format for display
format(of("1500.00", "BRL"), "pt-BR"); // "R$ 1.500,00"
```

**CSV parsing — always use `parseBufferOrThrow` with raw bytes (handles encoding automatically):**

```typescript
import { parseBufferOrThrow, generateFromObjects } from "@f-o-t/csv";
reader.readAsArrayBuffer(file); // NOT readAsText — let the library handle encoding
const doc = parseBufferOrThrow(new Uint8Array(buffer), {
   hasHeaders: true,
   trimFields: true,
});
// doc.headers → string[], doc.rows[n].fields → string[]
```

**OFX — always use ArrayBuffer:**

```typescript
import { parseBufferOrThrow, getTransactions } from "@f-o-t/ofx";
reader.readAsArrayBuffer(file); // NOT readAsText — handles Windows-1252 auto-detection
const doc = parseBufferOrThrow(new Uint8Array(buffer));
const txs = getTransactions(doc); // OFXTransaction[]
```

**Condition evaluator — weights go on nested ConditionGroups, not individual conditions:**

```typescript
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
// weight is on ConditionGroup, not Condition — wrap each in a sub-group
{
  id: "amount-group", operator: "AND", weight: 3,
  conditions: [{ id: "amount", type: "string", field: "amount", operator: "eq", value: "..." }],
}
```

**Common masks:**
| Field | Mask pattern |
|-------|-------------|
| Telefone | `["(", /\d/, /\d/, ")", " ", /\d/, /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/, /\d/, /\d/]` |
| CPF | `[/\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "-", /\d/, /\d/]` |
| CNPJ | `[/\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "/", /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/]` |
| Agência | `mask: /^\d{0,4}(-\d{0,1})?$/` |
| Conta | `mask: /^\d{0,12}(-\d{0,1})?$/` |

---

## Foxact Hooks

SSR-safe hook library — import each from its own subpath. Never use `@uidotdev/usehooks` (server-unsafe).

| Need                                 | Import                                |
| ------------------------------------ | ------------------------------------- |
| localStorage (dynamic key)           | `foxact/use-local-storage`            |
| localStorage (fixed key, syncs tabs) | `foxact/create-local-storage-state`   |
| sessionStorage                       | `foxact/use-session-storage`          |
| Media queries                        | `foxact/use-media-query`              |
| Debounce (derived values only)       | `foxact/use-debounced-value`          |
| Context guard                        | `foxact/invariant`                    |
| Merge refs                           | `foxact/merge-refs`                   |
| SSR-safe layout effect               | `foxact/use-isomorphic-layout-effect` |

- All localStorage keys prefixed `montte:` (e.g. `montte:sidebar-collapsed`).
- Use `useMediaQuery("(max-width: 767px)")` directly — no `useIsMobile` wrapper.
- Context always created with `null` default so `invariant` guard is meaningful.
- Prefer `createClientOnlyFn` / `createIsomorphicFn` from `@tanstack/react-start` over `typeof window === 'undefined'` guards.
- For debouncing callbacks (side effects), use `useDebouncedCallback` from `@tanstack/react-pacer` — not `foxact/use-debounced-value`.

---

## Events & Credits

File-per-category in `packages/events/`: `finance.ts`, `ai.ts`, `contact.ts`, `inventory.ts`, `service.ts`, `nfe.ts`, `document.ts`, `webhook.ts`, `emit.ts`, `credits.ts`

- `emitEvent()` is non-throwing.
- `enforceCreditBudget()` throws — wrap as `WebAppError.forbidden(...)` in routers.
- In generators, emit/track BEFORE final yield.

---

## Testing

```bash
bun run test
npx vitest run apps/web/__tests__/integrations/orpc/router/transactions.test.ts
```

### What to test

**Three layers, nothing else:**

1. **oRPC router integration tests** (`apps/web/__tests__/integrations/orpc/router/`) — every procedure that touches the DB. Real DB, real inputs, real auth/ownership checks. Highest ROI.
2. **Repository tests** (`core/database/__tests__/repositories/`) — non-trivial queries, aggregations, multi-table operations. Skip if the repo is a plain `db.insert`.
3. **Pure logic unit tests** — functions with no React/oRPC/DB/external imports: Zod schemas with complex transforms, date/math utilities, analytics compute functions, event credits logic.

**Decision rule:** would a bug here be invisible until a user reports it in production? Yes → test it. No → TypeScript + integration tests cover it.

### What NOT to test

- React components — jsdom ≠ browser; TypeScript catches prop errors; router tests cover mutation/query behavior
- Hooks that wrap `useSuspenseQuery` or `usePostHog` — mocking 100% of behavior tests nothing
- Singleton initialization — unless it has real config validation logic
- File existence checks (`existsSync`)

**⚠️ Gotcha — `member` and `team` tables have no `.defaultNow()` on `createdAt`.** Always provide `createdAt: new Date()` explicitly in test inserts.

Use the `orpc-testing` skill when writing new oRPC procedure tests.

---

## Scripts

All scripts in root `scripts/`. Required: `commander` with `run`+`check` commands, `--env`, `--dry-run`, `chalk`, env from `apps/web/.env*`.

---

## Environment Variables

SCREAMING*SNAKE_CASE, Zod-validated in `core/environment/src/{server,worker}.ts`. Client-side: `VITE*`prefix. Env files in`apps/web/`.

---

## Onboarding

1. **Organization onboarding** — `organization.onboardingCompleted`
2. **Project onboarding** — `team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`

Procedures: `apps/web/src/integrations/orpc/router/onboarding.ts`.

---

## Billing Model

100% usage-based via Stripe meter events. Free tier per event (Redis counters, monthly TTL). Usage above free tier → Stripe meter events. Optional addon subscriptions (Boost, Scale, Enterprise). Redis tracks real-time; materialized views reconcile hourly (worker cron).

---

## TanStack Intent (Agent Skills)

Ships versioned AI agent skills alongside the `@montte/cli` npm package so tools like Claude Code and Cursor can auto-discover correct CLI usage from `node_modules`.

**Setup in `package.json`:**
```json
{
  "keywords": ["tanstack-intent"],
  "files": ["dist", "skills", "!skills/_artifacts"]
}
```

**Skill file structure** — `skills/<domain>/SKILL.md`:
```yaml
---
name: "@montte/cli/<domain>"
description: >
  Use when <specific triggering condition — what the agent is doing, not a summary>.
type: core | sub-skill | framework | lifecycle | composition | security
library: "@montte/cli"
library_version: "0.1.0"
sources:
  - "Montte-erp/montte-nx:libraries/cli/src/<file>.ts"
---
```

**Rules:**
- `name` must match the directory slug (e.g. `@montte/cli/auth` for `skills/auth/SKILL.md`)
- `description` is used by agents to decide whether to load the skill — write it as a triggering condition ("use when..."), never a summary
- Max 500 lines per SKILL.md
- `sources` enables staleness detection in CI: run `npx @tanstack/intent@latest stale` after modifying source files
- `skills/_artifacts/` is generated locally by the registry tool — never commit it, exclude from npm `files`

**Validate before publishing:**
```bash
npx @tanstack/intent@latest validate
```

---

## TanStack Config (`@tanstack/vite-config`)

Used in `libraries/cli` to produce dual ESM+CJS output for npm publishing.

**`vite.config.ts`** — single entry only:
```ts
import { tanstackViteConfig } from "@tanstack/vite-config";
export default tanstackViteConfig({ entry: "./src/index.ts", srcDir: "./src" });
```

**Multi-entry limitation:** `tanstackViteConfig` only accepts one `entry` string. You cannot override `build.lib.entry` via `mergeConfig` — the internal plugin's `config` hook resets it at build time. For additional entries (e.g. a `./contract` subpath), use a separate esbuild script run after the main build:
```ts
// scripts/build-contract.ts
import { build } from "esbuild";
await Promise.all([
  build({ entryPoints: [...], outdir: "dist/esm/contract", format: "esm", bundle: false }),
  build({ entryPoints: [...], outdir: "dist/cjs/contract", format: "cjs", outExtension: { ".js": ".cjs" }, bundle: false }),
]);
```

**Build script:**
```json
"build": "vite build && bun run scripts/build-contract.ts && publint --strict"
```

**`package.json` exports map** — matches `dist/esm/` + `dist/cjs/` output:
```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/esm/index.d.ts", "default": "./dist/esm/index.js" },
      "require": { "types": "./dist/cjs/index.d.cts", "default": "./dist/cjs/index.cjs" }
    },
    "./package.json": "./package.json"
  }
}
```

**`publint --strict`** validates the exports map on every build — fix all errors before publishing.

**Notes:**
- `moduleResolution: "bundler"` is required in `tsconfig.json` (already set in `@tooling/typescript/base.json`)
- Include `vite.config.ts` in `tsconfig.json` `include` array
- `@tanstack/vite-config` is being sunset in favor of `tsdown` — acceptable for current use, but new packages should consider `tsdown` instead
