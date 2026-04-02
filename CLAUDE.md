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
│   ├── web/             # React/Vite SPA — dashboard + oRPC routers
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
type CnpjData = NonNullable<Inputs["onboarding"]["createWorkspace"]["cnpjData"]>;
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

### Correct Pattern

```tsx
const formSchema = z.object({
  name: z.string().min(1, "Campo obrigatório."),
});

function MyForm() {
  const form = useForm({
    defaultValues: { name: "" },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => { /* ... */ },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  aria-invalid={isInvalid}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />
      </FieldGroup>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            Salvar
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

---

## Suspense, Error Boundaries & Empty States

### Suspense + ErrorBoundary

Every component that calls `useSuspenseQuery` must be wrapped in both `<Suspense>` and `<ErrorBoundary>` at the route or layout level.

```tsx
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { createErrorFallback } from "@packages/ui/components/error-fallback";

function MyPage() {
   return (
      <ErrorBoundary FallbackComponent={createErrorFallback({ errorTitle: "Erro ao carregar" })}>
         <Suspense fallback={<MyPageSkeleton />}>
            <MyPageContent />
         </Suspense>
      </ErrorBoundary>
   );
}
```

**Rules:**
- `<ErrorBoundary>` wraps `<Suspense>` — error boundary is always the outer layer.
- `<Suspense fallback={...}>` — always provide a meaningful skeleton, never `fallback={null}` unless the component is genuinely invisible while loading (e.g. a filter popover loading option data).
- The inner component (`MyPageContent`) calls `useSuspenseQuery` — never add `isLoading` checks inside it.
- Never render inline loading spinners or skeletons inside suspense children — that's the fallback's job.
- Use `createErrorFallback({ errorTitle, errorDescription })` from `@packages/ui/components/error-fallback` for the `FallbackComponent`. Only write a custom fallback function for complex retry logic.

### Empty States

Use the `Empty` family of components from `@packages/ui/components/empty` for all empty states. Never build custom empty states with raw `div` + `flex` + icon patterns.

```tsx
import {
   Empty,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
   EmptyDescription,
   EmptyContent,
} from "@packages/ui/components/empty";
import { Button } from "@packages/ui/components/button";
import { SomeIcon } from "lucide-react";

function MyEmptyState({ onCreate }: { onCreate: () => void }) {
   return (
      <Empty>
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <SomeIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum item encontrado</EmptyTitle>
            <EmptyDescription>
               Crie o primeiro item para começar.
            </EmptyDescription>
         </EmptyHeader>
         <EmptyContent>
            <Button onClick={onCreate}>Criar item</Button>
         </EmptyContent>
      </Empty>
   );
}
```

**Rules:**
- `EmptyMedia variant="icon"` — for a lucide icon in a rounded box.
- `EmptyMedia` (no variant) — for illustrations or images.
- `EmptyContent` — for action buttons below the header.
- All text in pt-BR.
- Never define a local `EmptyState` function using raw HTML — always use the `Empty` primitives.

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
- **Early returns over if/else** — always guard and return early; never use `else` after a `return`.
- **Minimize `useEffect`** — derive state, use event handlers. Only for external system sync.
- **Dates** — always `dayjs`. Never raw `Date` math or manual string formatting.
- **URL search params over local state** — filters, sort, pagination live in `validateSearch` on the route. `useState` only for ephemeral input buffers.
- **Files:** kebab-case. **Components:** PascalCase `[Feature][Action][Type]`. **Hooks:** `use[Feature][Action]`.
- **oxlint suppression:** `// oxlint-ignore <rule-name>` above the triggering line.
- **Array index keys:** `key={\`step-${index + 1}\`}` over suppressing `noArrayIndexKey`.

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
const context = createRequestContext({ userId, teamId, organizationId, model: "openrouter/moonshotai/kimi-k2.5", language: "pt-BR" });
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

| Hook | Use For |
|------|---------|
| `useSheet` | Creating/editing records (side panel) |
| `useCredenza` | Selecting agents, export formats (modal/drawer) |
| `useAlertDialog` | Destructive confirmations |

---

## Input Masking (Maskito)

Use `@maskito/core` + `@maskito/react` for all structured text inputs. Never build manual mask handlers or use `onChange` + `replace(/\D/g, '')` patterns for formatted inputs.

```tsx
import { useMaskito } from "@maskito/react";
import type { MaskitoOptions } from "@maskito/core";

// Define masks at module scope (never inside component)
const phoneMaskOptions: MaskitoOptions = {
   mask: ["(", /\d/, /\d/, ")", " ", /\d/, /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/, /\d/, /\d/],
};
const cpfMaskOptions: MaskitoOptions = {
   mask: [/\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "-", /\d/, /\d/],
};
const cnpjMaskOptions: MaskitoOptions = {
   mask: [/\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "/", /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/],
};

function MyForm() {
   const phoneRef = useMaskito({ options: phoneMaskOptions });

   return (
      <Input
         ref={phoneRef}
         inputMode="numeric"
         onInput={(e) => field.handleChange((e.target as HTMLInputElement).value)}
         placeholder="(11) 99999-9999"
         defaultValue={field.state.value}
      />
   );
}
```

**Rules:**
- Always use `onInput` (not `onChange`) for masked inputs — Maskito fires before React's synthetic event.
- Use `defaultValue` (not `value`) on masked inputs — controlled `value` conflicts with Maskito's DOM manipulation.
- `Input` from `@packages/ui/components/input` uses `forwardRef` — the ref will reach the DOM element.
- Use array masks `[/\d/, ".", /\d/]` for formatting (auto-inserts chars). Regex masks (`mask: /^regex$/`) only validate, they don't format.
- Define `MaskitoOptions` at **module scope**, not inside components.
- For dynamic masks (e.g. CPF vs CNPJ), use `useMemo` to compute options and pass to `useMaskito`.
- Strip formatting before API calls when the backend expects raw digits: `value.replace(/\D/g, "")`.
- `inputMode="numeric"` on digit-only inputs for mobile keyboard.
- For currency inputs, use `MoneyInput` from `@packages/ui/components/money-input` — it uses `@maskito/kit`'s number mask internally.

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

Standard hook library — SSR-safe. Import each hook from its own subpath. Never use `@uidotdev/usehooks` for browser-API hooks (server-unsafe).

| Need | Import |
|------|--------|
| localStorage (dynamic key) | `foxact/use-local-storage` |
| localStorage (fixed key, syncs tabs) | `foxact/create-local-storage-state` |
| sessionStorage | `foxact/use-session-storage` |
| Media queries | `foxact/use-media-query` |
| Debounce | `foxact/use-debounced-value` |
| Lazy singleton ref | `foxact/use-singleton` |
| SSR-safe layout effect | `foxact/use-isomorphic-layout-effect` |
| Context guard | `foxact/invariant` |
| Merge refs | `foxact/merge-refs` |
| Open new tab | `foxact/open-new-tab` |
| Noop | `foxact/noop` |

- All localStorage keys prefixed `montte:` (e.g. `montte:sidebar-collapsed`).
- Use `useMediaQuery("(max-width: 767px)")` directly — no `useIsMobile` wrapper.
- Context always created with `null` default so `invariant` guard is meaningful.
- Never `typeof window === 'undefined'` guards — Vite SPA, window always defined.

---

## Debouncing & Throttling (@tanstack/pacer)

Use `@tanstack/pacer` (framework-agnostic) for debouncing callbacks. Store the `Debouncer` instance in a `useRef` and call `maybeExecute()` to trigger it.

```tsx
import { Debouncer } from "@tanstack/pacer";
import { useRef, useCallback } from "react";

const debouncerRef = useRef<Debouncer<[string]> | null>(null);

if (!debouncerRef.current) {
   debouncerRef.current = new Debouncer(myAsyncFn, { wait: 400 });
}

const handleChange = useCallback((value: string) => {
   debouncerRef.current?.maybeExecute(value);
}, []);
```

- Never use `useDebouncedValue` from `foxact` for debouncing side effects — use `@tanstack/pacer` `Debouncer` instead.
- `foxact/use-debounced-value` is for reactive derived values (UI display), not for debouncing API calls.

---

## Events & Credits

File-per-category in `packages/events/`: `finance.ts`, `ai.ts`, `contact.ts`, `inventory.ts`, `service.ts`, `nfe.ts`, `document.ts`, `webhook.ts`, `emit.ts`, `credits.ts`

- `emitEvent()` is non-throwing.
- `enforceCreditBudget()` throws — wrap as `WebAppError.forbidden(...)` in routers.
- In generators, emit/track BEFORE final yield.

---

## Testing

Tests: `apps/web/__tests__/integrations/orpc/router/`. Run with Vitest.

```bash
bun run test
npx vitest run apps/web/__tests__/integrations/orpc/router/transactions.test.ts
```

**⚠️ Gotcha — `member` and `team` tables have no `.defaultNow()` on `createdAt`.** Always provide `createdAt: new Date()` explicitly in test inserts.

Use the `orpc-testing` skill when writing new oRPC procedure tests.

---

## Scripts

All scripts in root `scripts/`. Required: `commander` with `run`+`check` commands, `--env`, `--dry-run`, `chalk`, env from `apps/web/.env*`.

---

## Environment Variables

SCREAMING_SNAKE_CASE, Zod-validated in `core/environment/src/{server,worker}.ts`. Client-side: `VITE_` prefix. Env files in `apps/web/`.

---

## Onboarding

1. **Organization onboarding** — `organization.onboardingCompleted`
2. **Project onboarding** — `team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`

Procedures: `apps/web/src/integrations/orpc/router/onboarding.ts`.

---

## Billing Model

100% usage-based via Stripe meter events. Free tier per event (Redis counters, monthly TTL). Usage above free tier → Stripe meter events. Optional addon subscriptions (Boost, Scale, Enterprise). Redis tracks real-time; materialized views reconcile hourly (worker cron).
