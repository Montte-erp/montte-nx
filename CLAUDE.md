# Contentta - Claude Code Guidelines

AI-powered CMS built as an Nx monorepo with Bun. Provides AI-assisted content creation, SERP analysis, content optimization, and team collaboration.

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
bun run check        # Biome lint/format
bun run test         # Tests with parallelization

# ⚠️ NEVER use NODE_OPTIONS to increase memory for builds
# If builds run out of memory, fix the root cause (dependencies, bundle size, etc.)
# Do NOT add NODE_OPTIONS='--max-old-space-size=...' to build commands

# Database
bun run db:push      # Push schema changes
bun run db:studio    # Drizzle Studio GUI

# Scripts (all in root scripts/ directory)
bun run scripts/seed-default-dashboard.ts run [--env production] [--dry-run]
bun run scripts/seed-event-catalog.ts run [--env production] [--dry-run]
bun run scripts/reindex-content.ts
```

---

## Monorepo Structure

```
contentta-nx/
├── apps/
│   ├── web/             # React/Vite SPA — main dashboard + oRPC routers
│   ├── server/          # Elysia API server for SDK consumers
│   └── worker/          # BullMQ background job processor (plain Bun process)
├── packages/
│   ├── agents/          # Mastra AI agents (planning, research, editing)
│   ├── analytics/       # Analytics engine
│   ├── arcjet/          # Rate limiting & DDoS protection
│   ├── authentication/  # Better Auth setup
│   ├── database/        # Drizzle ORM schemas & repositories
│   ├── environment/     # Zod-validated env vars (server/worker/client)
│   ├── events/          # Event catalog, schemas, emit, credits
│   ├── files/           # MinIO & file utilities
│   ├── logging/         # Pino logger
│   ├── posthog/         # Analytics client
│   ├── queue/           # BullMQ abstractions (producer side)
│   ├── redis/           # Redis singleton (getRedisConnection())
│   ├── search/          # Web search providers (Tavily/Exa/Firecrawl)
│   ├── stripe/          # Stripe SDK wrapper
│   ├── transactional/   # Email templates (React Email + Resend)
│   ├── ui/              # Radix + Tailwind + CVA components
│   └── utils/           # Shared utilities + error classes
├── libraries/
│   └── sdk/             # TypeScript SDK for Contentta API
└── tooling/
    └── typescript/      # Shared TypeScript configs
```

---

## API Layer — oRPC (NOT tRPC)

Routers live in `apps/web/src/integrations/orpc/router/`. Uses `@orpc/server`, NOT tRPC.

**Available routers:** account, actions, agent, analytics, annotations, api-keys, billing, chat, content, content-analytics, dashboards, data-sources, event-catalog, forms, insights, onboarding, organization, personal-api-key, property-definitions, sdk-usage, session, team, usage, webhooks

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
throw new ORPCError("NOT_FOUND", { message: "Content not found" });
throw new ORPCError("FORBIDDEN", { message: "Insufficient credits" });
```

**Errors in repositories** (`packages/database/src/repositories/`): Use `AppError` + `propagateError()` from `@packages/utils/errors`.

---

## Client-Side Patterns (oRPC + TanStack Query)

```typescript
// Queries — use useSuspenseQuery, NOT useQuery (guarantees data defined)
const { data } = useSuspenseQuery(
   orpc.content.getAll.queryOptions({ input: { teamId } })
);

// Mutations — callbacks go INSIDE mutationOptions()
const mutation = useMutation(
   orpc.content.create.mutationOptions({
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

**Files:** kebab-case (`content-editor.tsx`, `use-content.ts`)
**Components:** PascalCase `[Feature][Action][Type]` (`ContentEditor`, `AgentSettingsSection`)
**Hooks:** `use[Feature][Action]` (`useContent`, `useCreateContent`)

**No barrel files.** Never create `index.ts` re-exports. Import directly from source files using package.json exports:

```typescript
// Good
import { Button } from "@packages/ui/components/button";
import { emitEvent } from "@packages/events/emit";

// Bad — bypasses exports
import { Button } from "@packages/ui/src/components/button";
import { emitEvent } from "@packages/events";
```

**Biome lint suppression:** Place `// biome-ignore lint/[category]/[rule]: [reason]` directly above the triggering line. For JSX props, place above the prop, not the element.

**Array index keys:** Prefer `key={\`step-${index + 1}\`}`over suppressing`noArrayIndexKey`.

**No dynamic imports.** Never use `await import(...)` for project modules. Always use static `import` at the top of the file. Dynamic imports break tree-shaking and are unnecessary in this codebase.

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

## Package Exports

Packages use explicit `package.json` exports. Always match the export path exactly:

```typescript
// Named: import { createDb } from "@packages/database/client"
// Wildcard: import { content } from "@packages/database/schemas/content"
// Wildcard: import { createContent } from "@packages/database/repositories/content-repository"
```

Common patterns: `.` (root), `./client`, `./server`, `./schemas/*`, `./repositories/*`, `./components/*`

---

## AI Agents (packages/agents/)

### Agent Network Hierarchy

```
platform-router-agent (top-level)
└── content-agent (content domain)
    ├── research-agent
    ├── writer-agent
    ├── seo-auditor-agent
    └── reviewer-agent
```

`platform-router-agent` is the entry point for all chat interactions. It routes requests to the appropriate domain agent (`content-agent`), which in turn delegates to specialized sub-agents.

**Usage in routers:**

```typescript
import { mastra, createRequestContext } from "@packages/agents";

const agent = mastra.getAgent("platformRouterAgent");
const context = createRequestContext({
   userId: "user-id",
   brandId: "brand-id",
   writerId: "writer-id",
   model: "openrouter/moonshotai/kimi-k2.5",
   language: "pt-BR",
   writerInstructions: [...],
});

const result = await agent.generate("Write a post about TypeScript", {
   requestContext: context
});
```

**Agent IDs (Mastra registration):**

- `platformRouterAgent` — top-level router
- `contentAgent` — content domain coordinator
- `researchAgent` — SERP, competitor, and fact research
- `writerAgent` — article writing and editing
- `seoAuditorAgent` — SEO analysis and optimization
- `reviewerAgent` — quality checks and feedback
- `fimAgent` — fill-in-the-middle autocomplete
- `inlineEditAgent` — real-time inline editing

### Specialized Agents

- **FIM Agent** (`fimAgent`) - Autocomplete and fill-in-the-middle
- **Inline Edit Agent** (`inlineEditAgent`) - Real-time inline editing

---

## Feature Folder Structure (in apps/web/src/features/)

```
features/[name]/
├── hooks/     use-[feature]-context.tsx, use-[feature]-[action].ts
├── ui/        [feature]-[action]-credenza.tsx, [feature]-section.tsx
└── utils/     (when needed)
```

Features: analytics, billing, content, editor, file-upload, forms, onboarding, organization, personal-api-keys, search, settings

---

## Routes (TanStack Router — file-based)

```
apps/web/src/routes/
├── auth/                  # sign-in, sign-up, forgot-password
├── _authenticated/
│   └── $slug/
│       ├── onboarding.tsx
│       └── $teamId/       # team-scoped dashboard routes
└── api/                   # API routes
```

Conventions: kebab-case files, `$` for dynamic segments, `_` for layout routes.

---

## Database (Drizzle ORM + PostgreSQL)

**Schemas** at `packages/database/src/schemas/`: content, writer, chat, forms, dashboards, insights, events, webhooks, auth, etc.

**Repository pattern** at `packages/database/src/repositories/`:

```typescript
export async function createContent(db: DatabaseInstance, data: NewContent) {
   try {
      const result = await db.insert(content).values(data).returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create content");
   }
}
```

---

## Authentication (Better Auth)

Config at `packages/authentication/src/server.ts`. Plugins: Google OAuth, Magic Link, Email OTP, 2FA, Anonymous sessions.

**⚠️ CRITICAL: Auth Tables Are Read-Only**

Better Auth fully manages these tables in `packages/database/src/schemas/auth.ts`:

- `user`, `session`, `account`, `verification`
- `organization`, `team`, `member`, `teamMember`
- `invitation`, `twoFactor`

**Rules:**

- **NEVER** edit these Drizzle schema definitions directly (fields, defaults, constraints)
- **NEVER** add/remove/modify columns in these tables manually
- To add custom fields to `user`, `session`, `organization`, or `team`:
   - **ALWAYS** use `additionalFields` in `packages/authentication/src/server.ts`
   - Schema changes must go through Better Auth's config
- Other tables (`member`, `invitation`, `twoFactor`, etc.) have NO `additionalFields` support
   - These are entirely managed by Better Auth core
   - Cannot be customized — use separate related tables if needed

```typescript
// packages/authentication/src/server.ts
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
| `useSheet`       | Side panel forms                  | Creating/editing content, agents, brands, invites |
| `useCredenza`    | Modal (desktop) / Drawer (mobile) | Selecting agents, export formats                  |
| `useAlertDialog` | Destructive confirmations         | Deleting content, revoking access                 |

**⚠️ ALWAYS use these hooks — NEVER import Credenza, Dialog, Sheet, Drawer, or AlertDialog components manually.**

These hooks are backed by a global TanStack Store and render portals at the root layout. Using them ensures correct z-index stacking, consistent animations, and mobile responsiveness without any local component state.

```typescript
// ✅ Correct — use the global hook
const { openCredenza } = useCredenza();
openCredenza({ children: <SelectAgentForm /> });

const { openSheet, closeSheet } = useSheet();
openSheet({ children: <CreateContentForm onSuccess={closeSheet} /> });

const { openAlertDialog } = useAlertDialog();
openAlertDialog({
   title: "Delete content?",
   description: "This action cannot be undone.",
   onAction: () => deleteContent(id),
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

File-per-category pattern: `content.ts`, `ai.ts`, `forms.ts`, `seo.ts`, `emit.ts`, `credits.ts`

- `emitEvent()` is non-throwing (inner try-catch)
- `enforceCreditBudget()` throws plain Error — wrap as `ORPCError("FORBIDDEN")` in routers
- In generators, emit/track BEFORE final yield (post-yield code may not run)

---

## Testing

Tests live at `apps/web/__tests__/integrations/orpc/router/`. Run with Vitest.

```bash
bun run test                          # Run all tests (Nx parallelized)
npx vitest run apps/web/__tests__/integrations/orpc/router/content.test.ts  # Single file
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

Required patterns: `commander` CLI with `run` + `check` commands, `--env` flag, `--dry-run` flag, `chalk` for colored output, env loaded from `packages/database/.env*`.

See existing scripts in `scripts/` for the standard template.

---

## Environment Variables

- SCREAMING_SNAKE_CASE naming
- Validated with Zod in `packages/environment/src/{server,worker}.ts`
- Client-side: `VITE_` prefix
- Env files in `packages/database/` (`.env`, `.env.local`, `.env.production`)

---

## Onboarding (Two Flows)

1. **Organization onboarding** — one-time workspace setup (`organization.onboardingCompleted`)
2. **Project onboarding** — per-team setup (`team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`)

Procedures in `apps/web/src/integrations/orpc/router/onboarding.ts`.

---

## Subscription Plans

| Plan | Credits                   |
| ---- | ------------------------- |
| FREE | R$5 (AI + Platform pools) |
| LITE | R$50                      |
| PRO  | R$100                     |

Credit tracking: Redis real-time, materialized views reconcile hourly (worker cron).

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
experiment: { flag: "experiments", fallbackStage: "alpha" },
form:        { flag: "forms-beta", fallbackStage: "beta"  },
```

### Volume-based features (non-event, e.g. storage)

```typescript
// VOLUME_FEATURE_CONFIG: Record<flagKey, { label, description, icon, priceLabel, unit, fallbackStage }>
// Renders a VolumeFeatureCard showing per-unit pricing.
// Visible only when isEnrolled(flagKey).
"asset-bank": {
   label: "Banco de Imagens",
   priceLabel: "R$ 1,50",   // Railway cost: $0.15/GB — charged at R$ 1,50/GB
   unit: "GB/mês",
   fallbackStage: "alpha",
},
```

### Stage resolution

Stage is resolved from PostHog's early access feature config at runtime (`features.find(f => f.flagKey === key)?.stage`), falling back to `fallbackStage` in the local config. No manual sync needed — PostHog is the source of truth.

### Flag keys (from sidebar-nav-items.ts)

| Feature          | Flag key          | Stage |
| ---------------- | ----------------- | ----- |
| Banco de Imagens | `asset-bank`      | alpha |
| Conteúdo         | `content`         | alpha |
| Experimentos     | `experiments`     | alpha |
| Formulários      | `forms-beta`      | beta  |
| Dashboards       | `dashboards`      | beta  |
| Insights         | `insights`        | beta  |
| Dados            | `data-management` | beta  |
