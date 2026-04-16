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
│   └── worker/          # BullMQ background job processor (plain Bun process)
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

## Code Style

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

---

## Data Table Pattern

Use `DataTable` from `@packages/ui/components/data-table` for all tabular lists.

**Rules:**

- Prefer `DataTable` over manual `Table` primitives for list views.
- Tables should be expandable via row click using `renderSubComponent`.
- Do not wrap `DataTable` in `Card`/`CardContent` containers.

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

## Package Exports

Packages use explicit `package.json` exports. Always match the export path exactly:

```typescript
// Core packages use @core/* prefix
import { db } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { createBankAccount } from "@core/database/repositories/bank-accounts-repository";
import { auth } from "@core/authentication/server";
import { env } from "@core/environment/server";
import { redis } from "@core/redis/connection";
import { posthog } from "@core/posthog/server";
import { stripeClient } from "@core/stripe";
import { resendClient } from "@core/transactional/utils";
import { minioClient } from "@core/files/client";
import { AppError } from "@core/logging/errors";

// Feature packages use @packages/* prefix
import { emitEvent } from "@packages/events/emit";
import { Button } from "@packages/ui/components/button";
```

Common patterns: `.` (root), `./client`, `./server`, `./schemas/*`, `./repositories/*`, `./components/*`

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
   requestContext: context,
});
```

**Agent IDs (Mastra registration):**

- `rubiAgent` — finance assistant and ERP workflows

---

## Feature Folder Structure (in apps/web/src/features/)

```
features/[name]/
├── hooks/     use-[feature]-context.tsx, use-[feature]-[action].ts
├── ui/        [feature]-[action]-credenza.tsx, [feature]-section.tsx
└── utils/     (when needed)
```

Features: access-control, analytics, bank-accounts, billing, bills, budget-goals, categories, contacts, credit-cards, feedback, file-upload, inventory, onboarding, organization, rubi-chat, search, services, settings, tags, transactions, webhooks

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
      const [account] = await db
         .insert(bankAccounts)
         .values({ ...validated, teamId })
         .returning();
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
// ✅ Mutations — authClient only
authClient.organization.create({ name, slug });
authClient.organization.update({ data: { name }, organizationId });
authClient.organization.delete({ organizationId });
authClient.organization.inviteMember({ email, role, organizationId });
authClient.organization.removeMember({ memberIdOrEmail, organizationId });
authClient.organization.updateMemberRole({ memberId, role, organizationId });
authClient.organization.cancelInvitation({ invitationId });
authClient.organization.setActive({ organizationId });
authClient.organization.createTeam({ name, organizationId });
authClient.organization.setActiveTeam({ teamId });

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
         {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
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

## SSR-Safe Browser Hooks

`@uidotdev/usehooks` hooks that access browser APIs (`useMediaQuery`, `useLocalStorage`) crash on the server. Use project-local SSR-safe wrappers instead.

**Wrappers:**

- `useSafeMediaQuery(query)` → `@packages/ui/hooks/use-media-query`
- `useSafeLocalStorage<T>(key, initialValue)` → `@/hooks/use-local-storage` (apps/web only)

Both use `useIsomorphicLayoutEffect` from `@dnd-kit/utilities` (runs as `useLayoutEffect` on client, `useEffect` on server — eliminates flash between SSR value and real value).

**Pattern rules:**

```typescript
// ✅ Viewport breakpoint checks → use useIsMobile() (single source of truth)
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
const isMobile = useIsMobile();
const isDesktop = !isMobile; // inverse of (max-width: 767px)

// ✅ Non-breakpoint media queries (PWA display-mode, prefers-color-scheme, etc.)
import { useSafeMediaQuery } from "@packages/ui/hooks/use-media-query";
const isStandalone = useSafeMediaQuery("(display-mode: standalone)");

// ✅ localStorage persistence
import { useSafeLocalStorage } from "@/hooks/use-local-storage";
const [value, setValue] = useSafeLocalStorage("my-key", defaultValue);

// ❌ Never use these directly — SSR-unsafe
import { useMediaQuery, useLocalStorage } from "@uidotdev/usehooks";
```

**Safe to use directly from `@uidotdev/usehooks`** (no browser APIs during render):

- `useDebounce` — pure JS timing
- `useCopyToClipboard` — only called in event handlers

**Navigator/window checks in hooks:** wrap in `useIsomorphicLayoutEffect` from `@dnd-kit/utilities`, never in render body.

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

---

## Scripts

All scripts go in root `scripts/` directory. NEVER in `packages/*/` or `apps/*/`.

Required patterns: `commander` CLI with `run` + `check` commands, `--env` flag, `--dry-run` flag, `chalk` for colored output, env loaded from `core/database/.env*`.

See existing scripts in `scripts/` for the standard template.

---

## Environment Variables

- SCREAMING_SNAKE_CASE naming
- Validated with Zod in `core/environment/src/{server,worker}.ts`
- Client-side: `VITE_` prefix
- Env files in `core/database/` (`.env`, `.env.local`, `.env.production`)

---

## Onboarding (Two Flows)

1. **Organization onboarding** — one-time workspace setup (`organization.onboardingCompleted`)
2. **Project onboarding** — per-team setup (`team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`)

Procedures in `apps/web/src/integrations/orpc/router/onboarding.ts`.

---

## Billing Model

100% usage-based billing via Stripe meter events. No fixed plans or credit pools. Each billable event has a free tier (enforced via Redis counters with monthly TTL). Usage above the free tier is reported to Stripe as meter events and billed automatically. Optional addon subscriptions (Boost, Scale, Enterprise) unlock additional features. Redis tracks real-time usage; materialized views reconcile hourly (worker cron).

---

## Billing Page — Early Access Feature Cards

`apps/web/src/features/billing/ui/billing-overview.tsx`

The billing overview renders product cards driven by two config objects. **Adding a new early access feature = one entry in the right config.**

### Event-based categories (usage from API)

```typescript
// EARLY_ACCESS_CATEGORY_GATES: Record<categoryKey, { flag, fallbackStage }>
// Category must also exist in CATEGORY_CONFIG.
// When enrolled → card visible + stage badge shown.
// When not enrolled → card hidden entirely.
nfe:      { flag: "nfe", fallbackStage: "alpha" },
document: { flag: "document-signing", fallbackStage: "alpha" },
```

### Coming soon categories (no enroll CTA)

```typescript
// COMING_SOON_CATEGORIES are rendered as "Em breve".
// Current values:
new Set(["nfe", "document"]);
```

### Stage resolution

Stage is resolved from PostHog's early access feature config at runtime (`features.find(f => f.flagKey === key)?.stage`), falling back to `fallbackStage` in the local config. No manual sync needed — PostHog is the source of truth.

### Flag keys (from billing-overview.tsx)

| Feature            | Flag key           | Stage |
| ------------------ | ------------------ | ----- |
| NF-e               | `nfe`              | alpha |
| Assinatura Digital | `document-signing` | alpha |

### Other early-access flag keys (from sidebar-nav-items.ts + early-access.ts)

| Feature    | Flag key             | Where used                            |
| ---------- | -------------------- | ------------------------------------- |
| Contatos   | `contacts`           | Sidebar gating, onboarding enrollment |
| Estoque    | `inventory`          | Sidebar gating, onboarding enrollment |
| Serviços   | `services`           | Sidebar gating, onboarding enrollment |
| Dashboards | `advanced-analytics` | Sidebar gating, onboarding enrollment |
| Dados      | `data-management`    | Sidebar gating, onboarding enrollment |


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

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->