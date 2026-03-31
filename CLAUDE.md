# Montte - Claude Code Guidelines

AI-powered ERP built as an Nx monorepo with Bun. Provides AI-assisted workflows, analytics, automation, and team collaboration.

---

## Commands

```bash
# Development
bun dev              # Seed event catalog (local) then start web app
bun dev:all          # Start all apps and packages
bun dev:worker       # Worker only

# ⚠️ bun dev seeds the event catalog on every start (--env local).
# If seeding fails, the dev server won't launch. Run the seed manually to debug:
# bun run scripts/seed-event-catalog.ts run --env local

# Build & Quality
bun run build        # Build all (Nx cached)
bun run typecheck    # TypeScript checks
bun run check        # oxlint
bun run format       # oxfmt format
bun run format:check # oxfmt check
bun run test         # Tests with parallelization

# ⚠️ NEVER use NODE_OPTIONS to increase memory for builds
# If builds run out of memory, fix the root cause (dependencies, bundle size, etc.)
# Do NOT add NODE_OPTIONS='--max-old-space-size=...' to build commands

# Database
bun run db:push      # Push schema changes
bun run db:studio:local  # Drizzle Studio (local)
bun run db:studio:prod   # Drizzle Studio (production)

# Scripts (all in root scripts/ directory)
bun run scripts/seed-default-dashboard.ts run [--env production] [--dry-run]
bun run scripts/seed-event-catalog.ts run [--env production] [--dry-run]
bun run scripts/doctor.ts check
```

---

## Monorepo Structure

```
montte-nx/
├── core/
│   ├── database/        # Drizzle ORM schemas & repositories
│   ├── authentication/  # Better Auth setup
│   ├── environment/     # Zod-validated env vars
│   ├── redis/           # Redis singleton
│   ├── logging/         # Pino logger
│   ├── files/           # MinIO file storage singleton
│   ├── posthog/         # PostHog server/client setup
│   ├── stripe/          # Stripe singleton and helpers
│   ├── transactional/   # Resend + email utilities
│   └── utils/           # Shared utilities + error classes
├── apps/
│   ├── web/             # React/Vite SPA — main dashboard + oRPC routers
│   ├── server/          # Elysia API server for SDK consumers
│   └── worker/          # BullMQ background job processor (plain Bun process) — queues + processors in apps/worker/src/
├── packages/
│   ├── agents/          # Mastra AI agents (planning, research, editing)
│   ├── analytics/       # Analytics engine
│   ├── events/          # Event catalog, schemas, emit, credits
│   ├── feedback/        # Product feedback primitives
│   └── ui/              # Radix + Tailwind + CVA components
├── libraries/
│   └── sdk/             # TypeScript SDK for Montte API
└── tooling/
    ├── oxc/             # oxlint + oxfmt configs
    └── typescript/      # Shared TypeScript configs
```

---

## API Layer — oRPC (NOT tRPC)

Routers live in `apps/web/src/integrations/orpc/router/`. Uses `@orpc/server`, NOT tRPC.

**Available routers:** account, agent, analytics, bank-accounts, billing, bills, budget-goals, categories, chat, contacts, credit-cards, dashboards, early-access, feedback, insights, inventory, onboarding, organization, search, services, services-bills, session, tags, team, transactions, webhooks

**Router pattern:**

```typescript
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../server";

export const getAll = protectedProcedure
   .input(z.object({ teamId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      // context: { db, posthog?, organizationId, userId, session, auth, headers, request, stripeClient? }
   });
```

**Errors in routers:** Use `ORPCError` — NOT native `Error`, NOT `APIError`/`AppError`:

```typescript
throw new ORPCError("NOT_FOUND", { message: "Transaction not found" });
throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
```

**Errors in repositories** (`core/database/src/repositories/`): Use `AppError` + `propagateError()` from `@core/utils/errors`.

**Bulk operations must have a dedicated router procedure.** Never loop `mutateAsync` N times from the client for bulk actions — this fires N success/error callbacks and N cache invalidations. Create a `bulkRemove` (or `bulkXxx`) procedure that accepts `ids: z.array(z.string().uuid()).min(1)` and runs the operation server-side. The client calls it once, then shows a single summary toast after the mutation resolves.

```typescript
// ✅ Router — dedicated bulk procedure
export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const results = await Promise.allSettled(
         input.ids.map(async (id) => {
            await ensureOwnership(context.db, id, context.teamId);
            await deleteRecord(context.db, id);
         }),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", { message: `${failed} item(s) failed.` });
      }
      return { deleted: input.ids.length };
   });

// ✅ Client — one call, one toast
const bulkDeleteMutation = useMutation(orpc.resource.bulkRemove.mutationOptions({ onError: ... }));

onAction: async () => {
   await bulkDeleteMutation.mutateAsync({ ids: selectedIds });
   toast.success(`${selectedIds.length} items excluídos com sucesso.`);
   onClear();
};

// ❌ Never — fires N toasts and N invalidations
await Promise.all(selectedIds.map((id) => deleteMutation.mutateAsync({ id })));
```

---

## Client-Side Patterns (oRPC + TanStack Query)

```typescript
// Queries — use useSuspenseQuery, NOT useQuery (guarantees data defined)
const { data } = useSuspenseQuery(
   orpc.transactions.getAll.queryOptions({ input: { page: 1, pageSize: 20 } })
);

// Mutations — callbacks go INSIDE mutationOptions()
const mutation = useMutation(
   orpc.transactions.create.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(...) },
   })
);
```

**Rules:**

- `input` goes INSIDE `queryOptions()`, not as a separate argument
- Only use `useQuery` for optional/polling/conditional queries
- Wrap suspense components in `<Suspense fallback={...}>` at route/layout level
- NEVER dynamically import hooks (`await import("@tanstack/react-query")` breaks React rules)

**Global cache invalidation:** `apps/web/src/integrations/tanstack-query/root-provider.tsx` configures a `MutationCache` with a global `onSuccess` that calls `queryClient.invalidateQueries()` (no filter) after **every** successful mutation. This invalidates all active queries automatically — per-mutation `invalidateQueries` calls are only needed when you need to invalidate queries that belong to a different component tree or before the mutation resolves. Do NOT report missing per-mutation invalidations as bugs.

---

## Type Inference from oRPC Router

Never define manual TypeScript interfaces for data that flows through the router. Use `Inputs` and `Outputs` exported from `apps/web/src/integrations/orpc/client.ts` to infer types on the frontend.

```typescript
import type { Inputs, Outputs } from "@/integrations/orpc/client";

// Infer input type of a specific field
type CnpjData = NonNullable<Inputs["onboarding"]["createWorkspace"]["cnpjData"]>;

// Infer output type of a procedure
type WorkspaceResult = Outputs["onboarding"]["createWorkspace"];
```

**Zod schemas belong in the backend** (routers or core packages like `@core/authentication/server`). The frontend never imports Zod schemas or core backend packages — it only imports the inferred TypeScript types via `Inputs`/`Outputs`.

```typescript
// ✅ Backend — define schema once
export const cnpjDataSchema = z.object({ ... });
export type CnpjData = z.infer<typeof cnpjDataSchema>;

// ✅ Router — use schema for input validation
.input(z.object({ cnpjData: cnpjDataSchema.nullable().optional() }))

// ✅ Frontend — infer from router, never import backend
type CnpjData = NonNullable<Inputs["onboarding"]["createWorkspace"]["cnpjData"]>;

// ❌ Never import backend schemas or types into frontend components
import { cnpjDataSchema } from "@core/authentication/server";
```

---

## Code Style

**No type casting.** Never use `as`, `as unknown as`, or any other type assertion to force TypeScript to accept a type. If you need to cast, the types are wrong — fix the source types instead. Type assertions hide bugs and break refactoring safety.

```typescript
// ❌ Never — hides type errors
const categories = result as unknown as CategoryRow[];
const value = foo as string;

// ✅ Fix the types at the source
const categories: CategoryRow[] = result;
```

**Prefer URL search params over local state for UI state.** Filters, sort order, pagination, toggles, and any state that should survive a refresh or be shareable must live in URL search params via `validateSearch` on the route. Use `useState` only for ephemeral UI state that has no value being bookmarked or shared (e.g. a debounced input buffer before it commits to the URL).

```typescript
// ❌ Never use useState for filter/sort state
const [filters, setFilters] = useState({ type: undefined, includeArchived: false });

// ✅ Put it in the URL schema
const featureSearchSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  includeArchived: z.boolean().optional().default(false),
});
export const Route = createFileRoute("...")({ validateSearch: featureSearchSchema });

// ✅ Read and write via useSearch + useNavigate
const { type, includeArchived } = Route.useSearch();
const navigate = Route.useNavigate();
navigate({ search: (prev) => ({ ...prev, type: "income" }) });
```

**Files:** kebab-case (`transactions-table.tsx`, `use-transactions.ts`)
**Components:** PascalCase `[Feature][Action][Type]` (`TransactionsTable`, `AgentSettingsSection`)
**Hooks:** `use[Feature][Action]` (`useTransactions`, `useCreateTransaction`)

**No comments in code.** Never add comments, JSDoc, section dividers, or inline explanations. Code should be self-documenting.

**No barrel files.** Never create `index.ts` re-exports. Import directly from source files using package.json exports:

```typescript
// Good
import { Button } from "@packages/ui/components/button";
import { emitEvent } from "@packages/events/emit";

// Bad — bypasses exports
import { Button } from "@packages/ui/src/components/button";
import { emitEvent } from "@packages/events";
```

**No relative imports in core/.** Core packages must use `@core/<package>/*` path aliases for all internal imports. Relative imports (`./`, `../`) are banned by oxlint (`no-restricted-imports` in `tooling/oxc/core.json`). Each package has `"@core/<package>/*": ["./src/*"]` in its `tsconfig.json`.

```typescript
// ✅ Good — path alias
import { createSafeLogger } from "@core/logging";
import type { Logger } from "@core/logging/types";
import { categories } from "@core/database/schemas/categories";

// ❌ Bad — relative import (oxlint error)
import { createSafeLogger } from "./logger";
import type { Logger } from "../types";
import { categories } from "./categories";
```

**oxlint suppression:** Place `// oxlint-ignore <rule-name>` or `// oxlint-ignore -- <reason>` directly above the triggering line. For JSX props, place above the prop, not the element.

**Array index keys:** Prefer `key={\`step-${index + 1}\`}`over suppressing`noArrayIndexKey`.

**No dynamic imports.** Never use `await import(...)` for project modules. Always use static `import` at the top of the file. Dynamic imports break tree-shaking and are unnecessary in this codebase.

**Dates:** Always use `dayjs` for all date manipulation (parsing, formatting, arithmetic). Never use raw `Date` math or manual string formatting for dates.

**No `useStableHandler`.** Never use `foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired`. Use `useCallback` instead. The only exception is `use-event-listener.ts` which uses a `useRef` + `useIsomorphicLayoutEffect` pattern internally.

**No margin utilities.** Never use `m-`, `mt-`, `mb-`, `ml-`, `mr-`, `mx-`, `my-`, `space-x-*`, or `space-y-*` for spacing between sibling elements. Always use `gap-*` with `flex` or `grid` instead. The Button component already applies `gap-2` internally — never add `mr-*` or `ml-*` to icons inside buttons.

```tsx
// ❌ Never
<div className="space-y-4">...</div>
<Spinner className="size-4 mr-2" />
<div className="mt-4">...</div>

// ✅ Always
<div className="flex flex-col gap-4">...</div>
<Spinner className="size-4" />  {/* Button already has gap-2 */}
```

**Minimize `useEffect`.** Avoid `useEffect` unless truly necessary. Prefer: derived state (compute directly from props/state), event handlers, `useIsomorphicLayoutEffect` for DOM sync, or ref patterns. Only use `useEffect` for syncing with external systems (subscriptions, timers, non-React APIs) or post-commit DOM work that cannot happen during render or in event handlers. Never use `useEffect` to sync one piece of state to another — derive instead.

---

## PostHog

PostHog is the analytics, feature flags, and survey platform. All PostHog configuration (survey IDs, feature flag keys) lives in `@core/posthog/config` — never hardcode survey IDs as magic strings.

```typescript
import { POSTHOG_SURVEYS, FEATURE_FLAG_KEYS } from "@core/posthog/config";

// Render a native PostHog survey
posthog.renderSurvey(POSTHOG_SURVEYS.bugReport.id, "body");

// Use typed feature flag keys
const FLAG_KEYS = new Set(FEATURE_FLAG_KEYS);
```

**Rules:**

- Import `usePostHog` directly from `posthog-js/react` — never re-export it from `client.tsx`
- Import `posthog` default from `posthog-js` for imperative calls (`posthog.identify`, `posthog.renderSurvey`, etc.)
- Never hardcode survey IDs or feature flag keys — always use `POSTHOG_SURVEYS.*` and `FEATURE_FLAG_KEYS` from `@core/posthog/config`
- PostHog identity (`posthog.identify` + `posthog.group`) is called in the `_dashboard.tsx` route loader — not in hooks or effects
- Telemetry opt-out uses PostHog native APIs: `posthog.opt_out_capturing()` / `posthog.opt_in_capturing()` / `posthog.has_opted_out_capturing()` — no DB field
- `opt_in_site_apps: true` is required in the PostHog config for `posthog.renderSurvey()` to work
- Early access feature stages come exclusively from PostHog `getEarlyAccessFeatures()` — never hardcode `stage` in static feature definitions
- Per-feature feedback surveys are linked to their feature flag in PostHog dashboard (project `359458`)

**Survey keys (`POSTHOG_SURVEYS`):** `bugReport`, `featureRequest`, `featureFeedback`, `feedbackContatos`, `feedbackProdutosEstoque`, `feedbackGestaoServicos`, `feedbackAnalisesAvancadas`, `feedbackDados`

**Feature flag keys (`FEATURE_FLAG_KEYS`):** `contatos`, `produtos-estoque`, `gestao-de-servicos`, `analises-avancadas`, `dados`

---

## Data Table Pattern

Use `DataTable` from `@packages/ui/components/data-table` for all tabular lists.

**Rules:**

- Prefer `DataTable` over manual `Table` primitives for list views.
- Do not wrap `DataTable` in `Card`/`CardContent` containers.
- All features are always enabled — column reorder, column visibility, row selection. No feature flags.
- `getRowId`, `sorting`, `onSortingChange`, `columnFilters`, `onColumnFiltersChange`, `tableState`, `onTableStateChange` are **required** props.

### Required call site setup

Every DataTable usage requires two things at module level:

**1. localStorage state** — created once per feature with a fixed key:

```typescript
import { createLocalStorageState } from "foxact/create-local-storage-state";
import type { DataTableStoredState } from "@packages/ui/components/data-table";

const [useFeatureTableState] = createLocalStorageState<DataTableStoredState | null>(
  "montte:datatable:<feature>",
  null,
);
```

**2. URL search params** — for route files, add `validateSearch` to the route:

```typescript
import { z } from "zod";

const featureSearchSchema = z.object({
  sorting: z
    .array(z.object({ id: z.string(), desc: z.boolean() }))
    .optional()
    .default([]),
  columnFilters: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .optional()
    .default([]),
});

export const Route = createFileRoute("...")({
  validateSearch: featureSearchSchema,
  ...
});
```

For non-route components (e.g. billing panels), use local `useState` instead of URL params.

### Wiring in the component

```typescript
import type { OnChangeFn, SortingState, ColumnFiltersState } from "@tanstack/react-table";

function FeatureList() {
  const navigate = Route.useNavigate();
  const { sorting, columnFilters } = Route.useSearch();
  const [tableState, setTableState] = useFeatureTableState();

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(sorting as SortingState) : updater;
      navigate({ search: (prev) => ({ ...prev, sorting: next }) });
    },
    [sorting, navigate],
  );

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(columnFilters as ColumnFiltersState) : updater;
      navigate({ search: (prev) => ({ ...prev, columnFilters: next }) });
    },
    [columnFilters, navigate],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      sorting={sorting as SortingState}
      onSortingChange={handleSortingChange}
      columnFilters={columnFilters as ColumnFiltersState}
      onColumnFiltersChange={handleColumnFiltersChange}
      tableState={tableState}
      onTableStateChange={setTableState}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
      renderActions={({ row }) => { ... }}
    />
  );
}
```

**Open issues for remaining call sites:** MON-193 through MON-198.

### Card View (`view` prop)

DataTable supports a `view` prop (`"table" | "card"`). When `view="card"`, it dynamically renders visible columns as Card components — **no hand-crafted card templates**.

- **Never** use `renderMobileCard` — it was removed. There is no mobile card prop.
- **Never** write inline `if (view === "card") { return <grid>... }` blocks in page components. Always pass `view` to DataTable and let it handle the layout.
- Card layout uses the same column definitions, column visibility, row selection, and `renderActions` as the table view.

**Card structure:**

- `CardHeader` — 1st column as `CardTitle`, 2nd column as `CardDescription`
- `CardAction` — Row selection checkbox (when `enableRowSelection` is true)
- `CardContent` — Remaining columns in a 2-column grid with uppercase labels
- `CardFooter` — `renderActions` output, right-aligned

**Do not override** Card component default styles (padding, gap, text sizes). Use the Card as-is — only add `gap-4` on the root Card.

**Page integration pattern:**

```typescript
// 1. Define view config
const VIEWS: [ViewConfig<"table" | "card">, ViewConfig<"table" | "card">] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// 2. Use hook
const { currentView, setView, views } = useViewSwitch("feature:view", VIEWS);

// 3. Pass to header
<DefaultHeader viewSwitch={{ options: views, currentView, onViewChange: setView }} />
// or <PageHeader panelViewSwitch={{ options: views, currentView, onViewChange: setView }} />

// 4. Pass view to DataTable
<DataTable columns={columns} data={data} view={currentView} renderActions={...} />
```

---

## Core Singletons

Core packages export ready-to-use singletons that read from `@core/environment` directly. Never create factory functions that receive env values as parameters — import the singleton instead.

```typescript
// ✅ Import singletons directly from core
import { db } from "@core/database/client";
import { auth } from "@core/authentication/server";
import { redis } from "@core/redis/connection";
import { posthog } from "@core/posthog/server";
import { stripeClient } from "@core/stripe";
import { resendClient } from "@core/transactional/utils";
import { minioClient } from "@core/files/client";
import { env } from "@core/environment/server";

// ❌ Never create factory functions that receive env
const db = createDb({ databaseUrl: env.DATABASE_URL });
const redis = createRedisConnection(env.REDIS_URL);
const posthog = getPosthogConfig(env);
```

**No re-export wrapper files.** Apps should import singletons directly from `@core/*`. Never create intermediate files like `integrations/database.ts` that just re-export a core singleton.

---

## Dependency Catalogs (Bun Workspaces)

Version pinning uses named catalogs in the root `package.json`. When adding a dependency that belongs to an existing catalog, use `catalog:<name>` instead of a version string.

```json
// ✅ Reference a catalog
"@orpc/server": "catalog:orpc",
"react": "catalog:react",
"drizzle-orm": "catalog:database"

// ❌ Don't pin directly if a catalog exists
"@orpc/server": "^1.13.13"
```

**Available catalogs:** `analytics-client`, `assistant-ui`, `astro`, `auth`, `database`, `development`, `dnd`, `environment`, `files`, `fot`, `logging`, `mastra`, `orpc`, `payments`, `react`, `search-providers`, `server`, `tanstack`, `telemetry`, `testing`, `transactional`, `ui`, `validation`, `vite`, `workers`

Internal packages use `workspace:*`: `"@core/database": "workspace:*"`, `"@packages/ui": "workspace:*"`

---

## AI Agents (packages/agents/)

Current Mastra setup registers a single domain agent: `rubiAgent`.

**Usage in routers:**

```typescript
import { mastra, createRequestContext } from "@packages/agents";

const agent = mastra.getAgent("rubiAgent");
const context = createRequestContext({
   userId: "user-id",
   teamId: "team-id",
   organizationId: "organization-id",
   model: "openrouter/moonshotai/kimi-k2.5",
   language: "pt-BR",
});

const result = await agent.generate("Summarize this month's transactions", {
   requestContext: context
});
```

**Agent IDs (Mastra registration):**

- `rubiAgent` — finance assistant and ERP workflows

---

## Component Colocation Strategy

**Rule:** If a component, hook, or utility is only used by a single route, colocate it next to that route file in a `-[name]/` private folder. The `features/` folder is reserved for code shared across multiple routes.

### Route-colocated private folders

Use a `-` prefix so TanStack Router ignores the folder as a route segment:

```
routes/_authenticated/
├── onboarding.tsx
└── -onboarding/              # only used by onboarding.tsx
    ├── onboarding-wizard.tsx
    ├── cnpj-step.tsx
    ├── profile-step.tsx
    └── step-handle.ts

routes/_authenticated/$slug/$teamSlug/_dashboard/home/
├── index.tsx
└── -home/                    # only used by home/index.tsx
    ├── quick-start-checklist.tsx
    ├── quick-start-task.tsx
    ├── task-definitions.ts
    ├── use-complete-task.ts
    └── use-onboarding-status.ts
```

- Hooks flatten into the same `-[name]/` folder — no `hooks/` subfolder
- Import using relative paths: `import { Foo } from "./-onboarding/foo"`

### Feature folder (shared across routes)

Feature folders are **flat** — no `hooks/`, `ui/`, or `utils/` subfolders. All files live directly in `features/[name]/`:

```
features/[name]/
├── constants.ts          shared keys, enums, config
├── use-[feature].ts      hooks
├── [feature]-form.tsx    components
└── [feature]-columns.tsx columns/utils
```

**Rule:** Never create `ui/`, `hooks/`, or `utils/` subdirectories inside a feature folder. If a component or hook is only used by a single route, colocate it in a `-[name]/` private folder next to that route instead.

Features (shared): access-control, analytics, bank-accounts, billing, bills, budget-goals, categories, contacts, credit-cards, feedback, file-upload, inventory, organization, rubi-chat, search, services, settings, tags, transactions, webhooks

---

## Routes (TanStack Router — file-based)

```
apps/web/src/routes/
├── auth/                  # sign-in, sign-up, forgot-password, magic-link
├── _authenticated/
│   └── $slug/
│       └── $teamSlug/     # team-scoped dashboard routes
│           └── _dashboard/
│               ├── transactions.tsx
│               ├── bank-accounts.tsx
│               ├── bills.tsx
│               └── inventory/
└── api/                   # API routes
```

Conventions: kebab-case files, `$` for dynamic segments, `_` for layout routes.

---

## Database (Drizzle ORM + PostgreSQL)

**Schemas** at `core/database/src/schemas/`: bank-accounts, bills, budget-goals, categories, contacts, credit-cards, dashboards, insights, inventory, services, transactions, webhooks, auth, etc.

**Repository pattern** at `core/database/src/repositories/`:

```typescript
export async function createBankAccount(
   teamId: string,
   data: CreateBankAccountInput,
) {
   const validated = validateInput(createBankAccountSchema, data);
   try {
      const [account] = await db.insert(bankAccounts).values({ ...validated, teamId }).returning();
      if (!account) throw AppError.database("Failed to create bank account");
      return account;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bank account");
   }
}
```

---

## Authentication (Better Auth)

Config at `core/authentication/src/server.ts`. Plugins: Google OAuth, Magic Link, Email OTP, 2FA, Anonymous sessions.

**⚠️ CRITICAL: Auth Tables Are Read-Only**

Better Auth fully manages these tables in `core/database/src/schemas/auth.ts`:

- `user`, `session`, `account`, `verification`
- `organization`, `team`, `member`, `teamMember`
- `invitation`, `twoFactor`

**Rules:**

- **NEVER** edit these Drizzle schema definitions directly (fields, defaults, constraints)
- **NEVER** add/remove/modify columns in these tables manually
- To add custom fields to `user`, `session`, `organization`, or `team`:
   - **ALWAYS** use `additionalFields` in `core/authentication/src/server.ts`
   - Schema changes must go through Better Auth's config
- Other tables (`member`, `invitation`, `twoFactor`, etc.) have NO `additionalFields` support
   - These are entirely managed by Better Auth core
   - Cannot be customized — use separate related tables if needed

```typescript
// core/authentication/src/server.ts
organization({
   schema: {
      team: {
         additionalFields: {
            onboardingProducts: {
               type: "json",
               defaultValue: null,
               validator: {
                  input: z
                     .array(z.enum(["content", "forms", "analytics"]))
                     .nullable(),
               },
            },
         },
      },
   },
});
```

Field types: `"string"` (TEXT), `"boolean"` (BOOLEAN), `"number"` (INTEGER), `"string[]"` (TEXT[]), `"json"` (JSONB + Zod validator)

**Query/Mutation split for Better Auth**

- **Queries** (read operations) → always use oRPC (`orpc.organization.*`), even for Better Auth-owned data like members, teams, and invitations. oRPC procedures enrich the raw Better Auth data with DB fields (plans, credits, slugs, etc.) that the raw client cannot provide.
- **Mutations** (write operations) → use `authClient` directly. Never wrap these in oRPC.

```typescript
// ✅ Mutations — authClient only (organization.*, team.*, user.*)
authClient.organization.create({ name, slug });
authClient.organization.inviteMember({ email, role, organizationId });
authClient.organization.removeMember({ memberIdOrEmail, organizationId });

// ✅ Queries — always oRPC (even for Better Auth data)
orpc.organization.getMembers.queryOptions({});
orpc.organization.getOrganizationTeams.queryOptions({});
orpc.organization.getActiveOrganization.queryOptions({});
orpc.organization.getMemberTeams.queryOptions({ input: { userId } });
```

**member.id vs user.id**
`member.id` (member record ID, PK of the member table) and `user.id` (user UUID) are different values and must never be used interchangeably.

- Use `member.id` for Better Auth mutation APIs (`removeMember`, `updateMemberRole`).
- Use `member.userId` for queries against user-keyed tables (`teamMember.userId`, isSelf checks).
- `getMembers` must expose both: `id` (member record ID) and `userId` (user ID).

**Client-side authClient usage rules:**

- **NEVER** wrap `authClient` calls inside `useMutation` — call them directly
- Most authClient calls live inside TanStack Form's `onSubmit` handler
- For loading state use `useTransition` — NOT `useState<boolean>`
- `startTransition(async () => { ... })` wraps the async authClient call (React 19 supports async transitions)
- `isPending` from `useTransition` drives button `disabled` and spinner

```typescript
// ✅ Correct — TanStack Form + useTransition
const [isPending, startTransition] = useTransition();

const form = useForm({
   defaultValues: { name: "" },
   onSubmit: async ({ value }) => {
      const { error } = await authClient.updateUser({ name: value.name });
      if (error) { toast.error(error.message ?? "Erro"); return; }
      toast.success("Salvo!");
   },
   validators: { onBlur: schema },
});

const handleSubmit = useCallback((e: FormEvent) => {
   e.preventDefault();
   e.stopPropagation();
   startTransition(async () => { await form.handleSubmit(); });
}, [form, startTransition]);

// Button uses isPending + form.Subscribe for canSubmit
<form.Subscribe>
   {(formState) => (
      <Button disabled={!formState.canSubmit || isPending} type="submit">
         {isPending && <Loader2 className="size-4 animate-spin" />}
         Salvar
      </Button>
   )}
</form.Subscribe>

// ❌ Wrong — never wrap authClient in useMutation
const mutation = useMutation({ mutationFn: () => authClient.updateUser({ name }) });
```

For simple button actions (no form): `startTransition(async () => { await authClient.method(...) })` directly in the onClick handler.

---

## Global UI Hooks (TanStack Store)

| Hook             | Purpose                           | Use For                                           |
| ---------------- | --------------------------------- | ------------------------------------------------- |
| `useSheet`       | Side panel forms                  | Creating/editing records, agents, brands, invites |
| `useCredenza`    | Modal (desktop) / Drawer (mobile) | Selecting agents, export formats                  |
| `useAlertDialog` | Destructive confirmations         | Deleting records, revoking access                 |

**⚠️ ALWAYS use these hooks — NEVER import Credenza, Dialog, Sheet, Drawer, or AlertDialog components manually.**

These hooks are backed by a global TanStack Store and render portals at the root layout. Using them ensures correct z-index stacking, consistent animations, and mobile responsiveness without any local component state.

```typescript
// ✅ Correct — use the global hook
const { openCredenza } = useCredenza();
openCredenza({ children: <SelectAgentForm /> });

const { openSheet, closeSheet } = useSheet();
openSheet({ children: <CreateTransactionForm onSuccess={closeSheet} /> });

const { openAlertDialog } = useAlertDialog();
openAlertDialog({
   title: "Delete transaction?",
   description: "This action cannot be undone.",
   onAction: () => deleteTransaction(id),
});

// ❌ Wrong — never import and render these directly
import { Credenza, CredenzaContent } from "@packages/ui/components/credenza";
import { Sheet, SheetContent } from "@packages/ui/components/sheet";
import { AlertDialog } from "@packages/ui/components/alert-dialog";
```

---

## Foxact Hooks (catalog:ui)

`foxact` is the standard hook library. All hooks are SSR-safe and React 18+ Concurrent Rendering resilient. Import each hook from its own subpath. **Never use `@uidotdev/usehooks` for hooks that access browser APIs** — they crash on the server.

### Quick Reference

| Need | Import | Replaces |
|------|--------|----------|
| Per-component localStorage (dynamic key) | `foxact/use-local-storage` | `localStorage.getItem/setItem` |
| Per-component sessionStorage | `foxact/use-session-storage` | `sessionStorage.getItem/setItem` |
| Shared localStorage (fixed key, syncs tabs) | `foxact/create-local-storage-state` | — |
| Media queries | `foxact/use-media-query` | `@uidotdev/usehooks` useMediaQuery |
| Debounce a value | `foxact/use-debounced-value` | — |
| Lazy singleton ref | `foxact/use-singleton` | `useRef(new Foo())` |
| Clipboard copy | `foxact/use-clipboard` | — |
| SSR-safe layout effect | `foxact/use-isomorphic-layout-effect` | `useLayoutEffect` |
| Open new tab | `foxact/open-new-tab` | `window.open(url, "_blank")` |
| Empty stable function | `foxact/noop` | `() => {}` as default/fallback |
| Context guard + narrowing | `foxact/invariant` | `if (!ctx) throw new Error(...)` |
| Merge multiple refs | `foxact/merge-refs` | manual ref merge callbacks |

**All localStorage keys must be prefixed with `montte:`** (e.g. `montte:sidebar-collapsed`).

**No `useIsMobile` wrapper** — use `useMediaQuery("(max-width: 767px)")` directly.

### Shared localStorage state (fixed key)

```typescript
import { createLocalStorageState } from "foxact/create-local-storage-state";

// Define once at module level — key must be fixed
const [useThemeStorage] = createLocalStorageState<Theme>("montte:theme", "system");

// In any component — reactive, syncs across tabs
const [theme, setTheme] = useThemeStorage();
```

Use when multiple components need to read/write the same key reactively. For dynamic keys or local-only state, use `foxact/use-local-storage` directly.

### invariant (context guard)

```typescript
import { invariant } from "foxact/invariant";

invariant(context, "useX must be used within Provider");
return context; // TypeScript narrows to non-null
```

Always create context with `null` default so the guard is meaningful:

```typescript
const MyContext = createContext<MyContextType | null>(null); // ✅
const MyContext = createContext<MyContextType>(defaultValue); // ❌ invariant can never fire
```

### Rules

```typescript
// ❌ Never — SSR-unsafe or replaced by foxact
import { useMediaQuery, useLocalStorage } from "@uidotdev/usehooks";
useLayoutEffect(...)             // → foxact/use-isomorphic-layout-effect
window.open(url, "_blank")       // → foxact/open-new-tab
useRef(new Foo())                // → foxact/use-singleton
() => {} as default/fallback     // → foxact/noop
if (!ctx) throw new Error(...)   // → foxact/invariant
localStorage.getItem/setItem     // → foxact/use-local-storage or create-local-storage-state

// ✅ Safe from @uidotdev/usehooks (event-handler only, no render-time browser API)
import { useCopyToClipboard } from "@uidotdev/usehooks";

// ❌ Never add typeof window === 'undefined' guards — Vite SPA, window is always defined
```

---

## Events & Credits (packages/events/)

File-per-category pattern: `finance.ts`, `ai.ts`, `contact.ts`, `inventory.ts`, `service.ts`, `nfe.ts`, `document.ts`, `webhook.ts`, `emit.ts`, `credits.ts`

- `emitEvent()` is non-throwing (inner try-catch)
- `enforceCreditBudget()` throws plain Error — wrap as `ORPCError("FORBIDDEN")` in routers
- In generators, emit/track BEFORE final yield (post-yield code may not run)

---

## Testing

Tests live at `apps/web/__tests__/integrations/orpc/router/`. Run with Vitest.

```bash
bun run test                          # Run all tests (Nx parallelized)
npx vitest run apps/web/__tests__/integrations/orpc/router/transactions.test.ts  # Single file
```

**Gotcha — Better Auth tables need explicit `createdAt`:**
`member` and `team` tables don't have `.defaultNow()` on `createdAt`. Tests that insert into these tables MUST provide `createdAt: new Date()` explicitly or the insert will fail.

```typescript
// ✅ Correct
await db.insert(member).values({ ...memberData, createdAt: new Date() });

// ❌ Will fail — createdAt has no DB default
await db.insert(member).values(memberData);
```

Use the `orpc-testing` skill when writing new oRPC procedure tests.

**Gotcha — `vite-tsconfig-paths` and self-referencing core packages:**

Four core packages use `@core/<name>/*` path aliases internally within their own source files: `authentication`, `database`, `files`, and `logging`. When `vite-tsconfig-paths` is configured with a `projects` list in a vitest config, it only resolves paths for files within those listed projects. If a transitive dependency file lives inside one of these self-referencing packages, Vite falls back to Node package resolution and fails with "Cannot find package '@core/…'".

**Fix:** Every `vitest.config.ts` in the monorepo must include the tsconfigs of all four self-referencing packages in its `projects` list (excluding itself):

```typescript
// From core/* packages (e.g., core/redis/vitest.config.ts)
viteTsConfigPaths({
   projects: [
      "./tsconfig.test.json",
      "../authentication/tsconfig.json", // self-referencing
      "../database/tsconfig.json",       // self-referencing
      "../files/tsconfig.json",          // self-referencing
      "../logging/tsconfig.json",        // self-referencing
   ],
})

// From packages/* or apps/* (e.g., packages/events/vitest.config.ts)
viteTsConfigPaths({
   projects: [
      "./tsconfig.test.json",
      "../../core/authentication/tsconfig.json",
      "../../core/database/tsconfig.json",
      "../../core/files/tsconfig.json",
      "../../core/logging/tsconfig.json",
   ],
})
```

If a new core package starts using `@core/<name>/*` self-references, add its tsconfig to all vitest configs in the monorepo.

---

## Scripts

All scripts go in root `scripts/` directory. NEVER in `packages/*/` or `apps/*/`.

Required patterns: `commander` CLI with `run` + `check` commands, `--env` flag, `--dry-run` flag, `chalk` for colored output, env loaded from `apps/web/.env*`.

See existing scripts in `scripts/` for the standard template.

---

## Environment Variables

- SCREAMING_SNAKE_CASE naming
- Validated with Zod in `core/environment/src/{server,worker}.ts`
- Client-side: `VITE_` prefix
- Env files in `apps/web/` (`.env`, `.env.local`, `.env.production`)

---

## Onboarding (Two Flows)

1. **Organization onboarding** — one-time workspace setup (`organization.onboardingCompleted`)
2. **Project onboarding** — per-team setup (`team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`)

Procedures in `apps/web/src/integrations/orpc/router/onboarding.ts`.

---

## Billing Model

100% usage-based billing via Stripe meter events. No fixed plans or credit pools. Each billable event has a free tier (enforced via Redis counters with monthly TTL). Usage above the free tier is reported to Stripe as meter events and billed automatically. Optional addon subscriptions (Boost, Scale, Enterprise) unlock additional features. Redis tracks real-time usage; materialized views reconcile hourly (worker cron).

