# Settings Page Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the settings module pages (Financeiro, Estoque, Contatos, Assistente IA) with meaningful TanStack Form + Zod forms, create the Rubi IA settings page with full config, and wire up feature stage badges in the sidebar for module nav items.

**Architecture:** Each module settings page follows the existing `estoque.tsx` pattern (Suspense + `useSuspenseQuery` + `useMutation`) but migrates local `useState` forms to TanStack Form with Zod schemas. The Assistente IA page requires new DB schema, repository, and oRPC procedures following the `inventory_settings` pattern. Stage badges are shown in the sidebar for module items using a new `stage` field added to `SettingsNavItemDef`.

**Tech Stack:** TanStack Form (`@tanstack/react-form`), Zod, oRPC (`@orpc/server`), Drizzle ORM, TanStack Query (`useSuspenseQuery`, `useMutation`), `@packages/ui/components/feature-stage-badge`

---

### Task 1: Add stage badges to module nav items in the sidebar

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/settings-nav-items.ts`
- Modify: `apps/web/src/layout/dashboard/ui/settings-sidebar.tsx`

**Step 1: Add `stage` field to `SettingsNavItemDef` type**

In `settings-nav-items.ts`, add `stage` to the type and populate it on each module child:

```typescript
export type SettingsNavItemDef = {
   id: string;
   title: string;
   href: string;
   icon?: LucideIcon;
   external?: boolean;
   danger?: boolean;
   earlyAccessFlag?: string;
   earlyAccessStage?: "alpha" | "beta" | "concept" | "general-availability";
   stage?: "alpha" | "beta" | "concept" | "general-availability"; // always-visible badge
   children?: SettingsNavItemDef[];
};
```

Then add `stage` to each module item:

```typescript
{ id: "module-financeiro", title: "Financeiro", ..., stage: "general-availability" },
{ id: "module-estoque", title: "Estoque", ..., stage: "beta" },
{ id: "module-contatos", title: "Contatos", ..., stage: "beta" },
{ id: "module-assistente-ia", title: "Assistente IA", ..., stage: "alpha" },
```

**Step 2: Update sidebar to show `stage` badge on sub-items (even without earlyAccessFlag)**

In `settings-sidebar.tsx`, in the `visibleChildren.map()` inside the `hasChildren` branch, update the badge logic:

```typescript
// Before (only shows when earlyAccessFlag + enrolled):
const earlyStage =
   child.earlyAccessFlag && isEnrolled(child.earlyAccessFlag)
      ? getFeatureStage(child.earlyAccessFlag)
      : null;

// After (shows direct stage OR falls back to earlyAccess-derived stage):
const earlyStage =
   child.stage ??
   (child.earlyAccessFlag && isEnrolled(child.earlyAccessFlag)
      ? getFeatureStage(child.earlyAccessFlag)
      : null);
```

**Step 3: Skip badge for `general-availability` stage (it's stable, no badge needed)**

```typescript
{earlyStage && earlyStage !== "general-availability" && (
   <FeatureStageBadge
      aria-hidden="true"
      className="ml-auto text-[10px] px-1 py-0"
      showIcon={false}
      stage={earlyStage}
   />
)}
```

**Step 4: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/settings-nav-items.ts \
        apps/web/src/layout/dashboard/ui/settings-sidebar.tsx
git commit -m "feat(settings): add stage badges to module sidebar nav items"
```

---

### Task 2: Create DB schema for agent (Rubi IA) settings

**Files:**
- Create: `core/database/src/schemas/agents.ts`
- Modify: `core/database/src/drizzle.config.ts` or wherever the schema glob is (check with `grep -rn "schemas" core/database/drizzle.config.ts`)

**Step 1: Check how schemas are registered in Drizzle config**

```bash
cat core/database/drizzle.config.ts
grep -rn "schemas\|glob" core/database/src/ --include="*.ts" | grep -v ".d.ts" | head -10
```

Understand how tables are discovered — usually a glob `"./src/schemas/*.ts"` or explicit imports in a `schema.ts` barrel.

**Step 2: Create `core/database/src/schemas/agents.ts`**

```typescript
import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const agentSettings = pgTable("agent_settings", {
   teamId: uuid("team_id").primaryKey(),
   modelId: varchar("model_id", { length: 255 }).notNull().default("openrouter/moonshotai/kimi-k2.5"),
   language: varchar("language", { length: 10 }).notNull().default("pt-BR"),
   tone: varchar("tone", { length: 50 }).notNull().default("formal"),
   dataSourceTransactions: boolean("data_source_transactions").notNull().default(true),
   dataSourceContacts: boolean("data_source_contacts").notNull().default(true),
   dataSourceInventory: boolean("data_source_inventory").notNull().default(true),
   dataSourceServices: boolean("data_source_services").notNull().default(true),
   createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AgentSettings = typeof agentSettings.$inferSelect;
export type NewAgentSettings = typeof agentSettings.$inferInsert;
```

**Step 3: Register schema if not auto-discovered by glob**

If Drizzle uses explicit imports (not a glob), find the schema barrel file and add:
```typescript
export * from "./agents";
```

If it uses a glob `"./src/schemas/*.ts"`, no action needed — the new file is picked up automatically.

**Step 4: Push schema to DB**

```bash
bun run db:push
```

Expected output: `agent_settings` table created, no errors.

**Step 5: Commit**

```bash
git add core/database/src/schemas/agents.ts
git commit -m "feat(db): add agent_settings table for Rubi IA configuration"
```

---

### Task 3: Create repository functions for agent settings

**Files:**
- Create: `core/database/src/repositories/agent-settings-repository.ts`

**Step 1: Look at an existing repository for exact import shape**

```bash
head -10 core/database/src/repositories/inventory-repository.ts
```

The correct type import is `DatabaseInstance` from `@core/database/client`, not `Database`.

**Step 2: Create `core/database/src/repositories/agent-settings-repository.ts`**

Mirror the exact pattern from `inventory-repository.ts`:

```typescript
import { AppError, propagateError } from "@core/utils/errors";
import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { agentSettings } from "@core/database/schemas/agents";

export async function getAgentSettings(db: DatabaseInstance, teamId: string) {
   try {
      const [settings] = await db
         .select()
         .from(agentSettings)
         .where(eq(agentSettings.teamId, teamId));
      return settings ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get agent settings");
   }
}

export async function upsertAgentSettings(
   db: DatabaseInstance,
   teamId: string,
   data: Omit<typeof agentSettings.$inferInsert, "teamId" | "createdAt" | "updatedAt">,
) {
   try {
      const [settings] = await db
         .insert(agentSettings)
         .values({ teamId, ...data })
         .onConflictDoUpdate({
            target: agentSettings.teamId,
            set: { ...data, updatedAt: new Date() },
         })
         .returning();
      if (!settings) throw AppError.database("Failed to upsert agent settings");
      return settings;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert agent settings");
   }
}
```

**Step 3: Commit**

```bash
git add core/database/src/repositories/agent-settings-repository.ts
git commit -m "feat(db): add agent settings repository functions"
```

---

### Task 4: Add getSettings / upsertSettings to agent oRPC router

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/agent.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts` (verify the router is exported)

**Step 1: Check AVAILABLE_MODELS shape**

```bash
grep -n "AVAILABLE_MODELS\|export.*ModelId\|as const" core/agents/src/models.ts | head -20
```

Determine if `AVAILABLE_MODELS` is a `readonly string[]` or a `Record`. The Zod schema needs an array of string literals — if it's a record, use `Object.keys(AVAILABLE_MODELS)`.

**Step 2: Check existing imports at top of `agent.ts`**

```bash
head -20 apps/web/src/integrations/orpc/router/agent.ts
```

Add the repository import and schema definition after the existing imports.

**Step 3: Add to `agent.ts`**

```typescript
import { getAgentSettings, upsertAgentSettings } from "@core/database/repositories/agent-settings-repository";

const agentSettingsSchema = z.object({
   modelId: z.string().min(1),
   language: z.enum(["pt-BR", "en-US", "es-ES"]),
   tone: z.enum(["formal", "casual", "technical"]),
   dataSourceTransactions: z.boolean(),
   dataSourceContacts: z.boolean(),
   dataSourceInventory: z.boolean(),
   dataSourceServices: z.boolean(),
});

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   return getAgentSettings(context.db, context.teamId);
});

export const upsertSettings = protectedProcedure
   .input(agentSettingsSchema.partial())
   .handler(async ({ context, input }) => {
      return upsertAgentSettings(context.db, context.teamId, {
         modelId: input.modelId ?? "openrouter/moonshotai/kimi-k2.5",
         language: input.language ?? "pt-BR",
         tone: input.tone ?? "formal",
         dataSourceTransactions: input.dataSourceTransactions ?? true,
         dataSourceContacts: input.dataSourceContacts ?? true,
         dataSourceInventory: input.dataSourceInventory ?? true,
         dataSourceServices: input.dataSourceServices ?? true,
      });
   });
```

**Step 4: Verify router index**

```bash
grep -n "agent" apps/web/src/integrations/orpc/router/index.ts
```

Confirm `agent` is already exported. It should be since `agent.test.ts` already exists. If `getSettings`/`upsertSettings` need to be re-exported explicitly, add them.

**Step 5: Typecheck**

```bash
bun run typecheck 2>&1 | grep "agent" | head -10
```

**Step 6: Commit**

```bash
git add apps/web/src/integrations/orpc/router/agent.ts
git commit -m "feat(orpc): add getSettings and upsertSettings to agent router"
```

---

### Task 4b: Write integration tests for agent settings procedures

**Files:**
- Modify: `apps/web/__tests__/integrations/orpc/router/agent.test.ts`

**Step 1: Add `agent_settings` cleanup to `beforeEach`**

The test file already has `beforeAll`/`afterAll` setup. Add a `beforeEach` block (or extend existing one) to clear the table:

```typescript
import { sql } from "drizzle-orm";

beforeEach(async () => {
   vi.clearAllMocks();
   vi.mocked(emitAiChatMessage).mockResolvedValue(undefined);
   await ctx.db.execute(sql`DELETE FROM agent_settings`);
});
```

**Step 2: Add `getSettings` tests at the bottom of the file**

```typescript
describe("getSettings", () => {
   it("returns null when no settings exist", async () => {
      const result = await call(agentRouter.getSettings, undefined, {
         context: ctx,
      });

      expect(result).toBeNull();
   });

   it("returns settings after upsert", async () => {
      await call(
         agentRouter.upsertSettings,
         { modelId: "openrouter/anthropic/claude-sonnet-4-5", language: "en-US" },
         { context: ctx },
      );

      const result = await call(agentRouter.getSettings, undefined, {
         context: ctx,
      });

      expect(result).not.toBeNull();
      expect(result?.modelId).toBe("openrouter/anthropic/claude-sonnet-4-5");
      expect(result?.language).toBe("en-US");
   });
});
```

**Step 3: Add `upsertSettings` tests**

```typescript
describe("upsertSettings", () => {
   it("creates settings and returns them with the calling team's id", async () => {
      const result = await call(
         agentRouter.upsertSettings,
         {},
         { context: ctx },
      );

      expect(result.teamId).toBe(ctx.session!.session.activeTeamId);
      expect(result.language).toBe("pt-BR");
      expect(result.tone).toBe("formal");
      expect(result.dataSourceTransactions).toBe(true);
   });

   it("updates existing settings on second call", async () => {
      await call(agentRouter.upsertSettings, { tone: "casual" }, { context: ctx });

      const updated = await call(
         agentRouter.upsertSettings,
         { tone: "technical" },
         { context: ctx },
      );

      expect(updated.tone).toBe("technical");
   });

   it("does not leak settings between teams", async () => {
      await call(
         agentRouter.upsertSettings,
         { tone: "casual" },
         { context: ctx },
      );

      const otherTeamResult = await call(agentRouter.getSettings, undefined, {
         context: ctx2,
      });

      expect(otherTeamResult).toBeNull();
   });
});
```

Note: `ctx2` requires a second authenticated context. Check if the existing `agent.test.ts` already declares `ctx2`. If not, add it in `beforeAll`:

```typescript
let ctx2: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({ organizationId: "auto", teamId: "auto" });
   ctx2 = await createAuthenticatedContext({ organizationId: "auto", teamId: "auto" });
});
```

**Step 4: Run the agent tests**

```bash
npx vitest run apps/web/__tests__/integrations/orpc/router/agent.test.ts
```

Expected: all tests pass including the new `getSettings` and `upsertSettings` suites.

**Step 5: Commit**

```bash
git add apps/web/__tests__/integrations/orpc/router/agent.test.ts
git commit -m "test(agent): add integration tests for getSettings and upsertSettings"
```

---

### Task 5: Create Rubi IA settings page (ai-agents.tsx)

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents.tsx`

**Step 1: Check available models list for Select options**

```bash
grep -n "AVAILABLE_MODELS\|modelId\|label\|name" core/agents/src/models.ts | head -30
```

Use model IDs and labels for the Select dropdown.

**Step 2: Create the route file**

Follow the exact same structure as `estoque.tsx` — Suspense wrapper + inner form component with `useSuspenseQuery` + `useMutation` from oRPC. Use TanStack Form + Zod instead of `useState`.

```typescript
import { useForm } from "@tanstack/react-form";
import { Button } from "@packages/ui/components/button";
import { Label } from "@packages/ui/components/label";
import {
   Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Separator } from "@packages/ui/components/separator";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import { AVAILABLE_MODELS } from "@core/agents/models"; // verify this import path works from web app — if not, hardcode model IDs

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents",
)({ component: AiAgentsSettingsPage });

const agentSettingsSchema = z.object({
   modelId: z.string().min(1),
   language: z.enum(["pt-BR", "en-US", "es-ES"]),
   tone: z.enum(["formal", "casual", "technical"]),
   dataSourceTransactions: z.boolean(),
   dataSourceContacts: z.boolean(),
   dataSourceInventory: z.boolean(),
   dataSourceServices: z.boolean(),
});

type AgentSettingsValues = z.infer<typeof agentSettingsSchema>;

const LANGUAGE_OPTIONS = [
   { value: "pt-BR", label: "Português (BR)" },
   { value: "en-US", label: "English (US)" },
   { value: "es-ES", label: "Español" },
];

const TONE_OPTIONS = [
   { value: "formal", label: "Formal" },
   { value: "casual", label: "Casual" },
   { value: "technical", label: "Técnico" },
];

function AiAgentsSettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.agent.getSettings.queryOptions({}),
   );

   const mutation = useMutation(
      orpc.agent.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações da Rubi salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         modelId: settings?.modelId ?? "openrouter/moonshotai/kimi-k2.5",
         language: (settings?.language ?? "pt-BR") as AgentSettingsValues["language"],
         tone: (settings?.tone ?? "formal") as AgentSettingsValues["tone"],
         dataSourceTransactions: settings?.dataSourceTransactions ?? true,
         dataSourceContacts: settings?.dataSourceContacts ?? true,
         dataSourceInventory: settings?.dataSourceInventory ?? true,
         dataSourceServices: settings?.dataSourceServices ?? true,
      } satisfies AgentSettingsValues,
      onSubmit: async ({ value }) => {
         const parsed = agentSettingsSchema.safeParse(value);
         if (!parsed.success) return;
         mutation.mutate(parsed.data);
      },
   });

   return (
      <div className="flex flex-col gap-6 max-w-lg">
         <div>
            <h3 className="text-lg font-medium">Assistente IA (Rubi)</h3>
            <p className="text-sm text-muted-foreground">
               Configure o comportamento e as permissões de dados da Rubi para este espaço.
            </p>
         </div>

         <form
            className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}
         >
            {/* Model */}
            <form.Field name="modelId">
               {(field) => (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor={field.name}>Modelo</Label>
                     <Select value={field.state.value} onValueChange={field.handleChange}>
                        <SelectTrigger id={field.name}>
                           <SelectValue placeholder="Selecionar modelo…" />
                        </SelectTrigger>
                        <SelectContent>
                           {/* List AVAILABLE_MODELS — if not importable from web, hardcode the known models */}
                           <SelectItem value="openrouter/moonshotai/kimi-k2.5">Kimi K2.5 (padrão)</SelectItem>
                           <SelectItem value="openrouter/anthropic/claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                           <SelectItem value="openrouter/google/gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               )}
            </form.Field>

            {/* Language */}
            <form.Field name="language">
               {(field) => (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor={field.name}>Idioma das respostas</Label>
                     <Select value={field.state.value} onValueChange={field.handleChange}>
                        <SelectTrigger id={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {LANGUAGE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               )}
            </form.Field>

            {/* Tone */}
            <form.Field name="tone">
               {(field) => (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor={field.name}>Tom das respostas</Label>
                     <Select value={field.state.value} onValueChange={field.handleChange}>
                        <SelectTrigger id={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {TONE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               )}
            </form.Field>

            <Separator />

            {/* Data sources */}
            <div className="flex flex-col gap-2">
               <Label>Fontes de dados permitidas</Label>
               <p className="text-xs text-muted-foreground">
                  Controle quais dados do espaço a Rubi pode acessar ao responder.
               </p>
            </div>

            {(
               [
                  { name: "dataSourceTransactions", label: "Transações financeiras" },
                  { name: "dataSourceContacts", label: "Contatos" },
                  { name: "dataSourceInventory", label: "Estoque" },
                  { name: "dataSourceServices", label: "Serviços" },
               ] as const
            ).map(({ name, label }) => (
               <form.Field key={name} name={name}>
                  {(field) => (
                     <div className="flex items-center justify-between">
                        <Label htmlFor={field.name} className="font-normal">{label}</Label>
                        <Switch
                           id={field.name}
                           checked={field.state.value}
                           onCheckedChange={field.handleChange}
                        />
                     </div>
                  )}
               </form.Field>
            ))}

            <Button className="self-start" disabled={mutation.isPending} type="submit">
               {mutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
               Salvar configurações
            </Button>
         </form>
      </div>
   );
}

function AiAgentsSettingsPage() {
   return (
      <Suspense
         fallback={
            <div className="flex flex-col gap-4 max-w-lg">
               {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton className="h-10 w-full" key={`skel-${i + 1}`} />
               ))}
            </div>
         }
      >
         <AiAgentsSettingsForm />
      </Suspense>
   );
}
```

**Step 3: Verify the route is picked up by TanStack Router**

```bash
bun run typecheck 2>&1 | grep "ai-agents" | head -5
```

The route file name matches the href `...products/ai-agents` so it should be auto-detected.

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents.tsx
git commit -m "feat(settings): add Rubi IA settings page with model, language, tone, and data source config"
```

---

### Task 6: Migrate Estoque settings form to TanStack Form + Zod

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque.tsx`

**Step 1: Add TanStack Form imports and Zod schema**

Replace `useState` with `useForm`. Keep all existing Select fields — just wire through TanStack Form fields instead of manual state.

Remove: `import { useCallback, useState } from "react";`
Add: `import { useForm } from "@tanstack/react-form";`
Add: `import { z } from "zod";`

```typescript
const estoqueSeetingsSchema = z.object({
   purchaseBankAccountId: z.string().nullable(),
   purchaseCreditCardId: z.string().nullable(),
   purchaseCategoryId: z.string().nullable(),
   saleCategoryId: z.string().nullable(),
   wasteCategoryId: z.string().nullable(),
});
```

**Step 2: Replace `useState` + `handleSave` with `useForm`**

```typescript
const form = useForm({
   defaultValues: {
      purchaseBankAccountId: settings?.purchaseBankAccountId ?? null,
      purchaseCreditCardId: settings?.purchaseCreditCardId ?? null,
      purchaseCategoryId: settings?.purchaseCategoryId ?? null,
      saleCategoryId: settings?.saleCategoryId ?? null,
      wasteCategoryId: settings?.wasteCategoryId ?? null,
   },
   onSubmit: async ({ value }) => {
      mutation.mutate(value);
   },
});
```

**Step 3: Wrap in `<form>` and use `form.Field` for each Select**

Each Select field becomes:
```tsx
<form.Field name="purchaseBankAccountId">
   {(field) => (
      <div className="flex flex-col gap-2">
         <Label htmlFor={field.name}>Conta bancária padrão (compras)</Label>
         <Select
            value={field.state.value ?? ""}
            onValueChange={(v) => field.handleChange(v || null)}
         >
            <SelectTrigger id={field.name}>
               <SelectValue placeholder="Selecionar conta…" />
            </SelectTrigger>
            <SelectContent>
               {bankAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
               ))}
            </SelectContent>
         </Select>
      </div>
   )}
</form.Field>
```

Repeat for all 5 fields. Replace `<Button onClick={handleSave}>` with `type="submit"` on the button and `onSubmit` on the form wrapper.

**Step 4: Remove unused imports** (`useCallback`, `useState`)

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque.tsx
git commit -m "refactor(settings): migrate estoque form to TanStack Form + Zod"
```

---

### Task 7: Build Financeiro settings form

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro.tsx`
- Modify: `apps/web/src/integrations/orpc/router/` — check if a `financeiro` or general team settings router exists; if not, add procedures to `team.ts`
- Possibly: `core/database/src/schemas/` — check if `financial_settings` table exists

**Step 1: Check for existing financial settings table/router**

```bash
grep -rn "financialSettings\|financial_settings\|FinancialSettings" core/database/src/schemas/
grep -rn "getFinancialSettings\|financialSettings" apps/web/src/integrations/orpc/router/
```

If none exists, follow the same pattern as Tasks 2–4 to create:
- `financial_settings` table in `core/database/src/schemas/financial.ts` (or add to existing finance schema)
- Repository in `core/database/src/repositories/financial-settings.ts`
- Procedures `getSettings` / `upsertSettings` added to a relevant router (create `apps/web/src/integrations/orpc/router/financial.ts` if needed, and export from `index.ts`)

**Step 2: Fields for the financial settings table**

```typescript
export const financialSettings = pgTable("financial_settings", {
   teamId: uuid("team_id").primaryKey(),
   defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("BRL"),
   fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1), // 1 = January
   defaultPaymentDueDays: integer("default_payment_due_days").notNull().default(30),
   autoCategorizationEnabled: boolean("auto_categorization_enabled").notNull().default(true),
   defaultIncomeBankAccountId: uuid("default_income_bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
   defaultExpenseBankAccountId: uuid("default_expense_bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
   createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

**Step 3: Build the form page in `financeiro.tsx`**

Fields to display:
- **Moeda padrão** — Select: BRL, USD, EUR
- **Início do ano fiscal** — Select: months (Janeiro–Dezembro, using dayjs locale names)
- **Prazo padrão de vencimento** — Select: 7, 14, 30, 45, 60 days
- **Categorização automática** — Switch toggle
- **Conta padrão para receitas** — Select from bank accounts
- **Conta padrão para despesas** — Select from bank accounts

Follow the same Suspense + `useSuspenseQuery` + `useMutation` + TanStack Form pattern used in Tasks 5–6.

**Step 4: Run typecheck and fix errors**

```bash
bun run typecheck 2>&1 | grep "financeiro" | head -10
```

**Step 5: Commit**

```bash
git add core/database/src/schemas/ \
        core/database/src/repositories/financial-settings.ts \
        apps/web/src/integrations/orpc/router/financial.ts \
        apps/web/src/integrations/orpc/router/index.ts \
        apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro.tsx
git commit -m "feat(settings): implement Financeiro module settings with meaningful form fields"
```

---

### Task 8: Build Contatos settings form

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos.tsx`
- Same pattern: check for existing schema → create if needed → repository → oRPC procedures → form

**Step 1: Check for existing contacts settings**

```bash
grep -rn "contactSettings\|contact_settings\|ContactSettings" core/database/src/schemas/
grep -rn "getContactSettings\|upsertContactSettings" apps/web/src/integrations/orpc/router/
```

**Step 2: Fields for contacts settings table**

```typescript
export const contactSettings = pgTable("contact_settings", {
   teamId: uuid("team_id").primaryKey(),
   defaultContactType: varchar("default_contact_type", { length: 10 }).notNull().default("pj"), // "pf" | "pj"
   duplicateDetectionEnabled: boolean("duplicate_detection_enabled").notNull().default(true),
   requireTaxId: boolean("require_tax_id").notNull().default(false),
   defaultTagId: uuid("default_tag_id").references(() => tags.id, { onDelete: "set null" }),
   createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

(Import `tags` from the tags schema.)

**Step 3: Build the form page in `contatos.tsx`**

Fields to display:
- **Tipo de contato padrão** — Select: Pessoa Física (PF), Pessoa Jurídica (PJ)
- **Detecção de duplicatas** — Switch toggle (quando ativo, alerta ao criar contato com mesmo CNPJ/CPF)
- **CPF/CNPJ obrigatório** — Switch toggle
- **Tag padrão (Centro de Custo)** — Select from existing tags (query `orpc.tags.getAll` or equivalent)

Follow Suspense + TanStack Form + Zod pattern.

**Step 4: Run typecheck**

```bash
bun run typecheck 2>&1 | grep "contatos" | head -10
```

**Step 5: Commit**

```bash
git add core/database/src/schemas/ \
        core/database/src/repositories/contact-settings.ts \
        apps/web/src/integrations/orpc/router/contacts.ts \
        apps/web/src/integrations/orpc/router/index.ts \
        apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos.tsx
git commit -m "feat(settings): implement Contatos module settings with meaningful form fields"
```

---

### Task 9: Final typecheck + db push

**Step 1: Push all new schema changes**

```bash
bun run db:push
```

**Step 2: Full typecheck**

```bash
bun run typecheck 2>&1 | head -50
```

Fix any remaining type errors before calling this done.

**Step 3: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(settings): address typecheck errors from settings refactor"
```

---

---

### Task 10: Replace DB-backed telemetry consent with PostHog native opt-out

**Context:** Currently `telemetryConsent` is stored as a Better Auth `additionalFields` on the `user` table, and `PostHogWrapper` reads it via `opt_out_capturing_by_default: !hasConsent`. The goal is to remove the DB field entirely and use PostHog's own `posthog.opt_out_capturing()` / `posthog.opt_in_capturing()` / `posthog.has_opted_out_capturing()` APIs (which persist to localStorage).

**Files:**
- Modify: `core/authentication/src/server.ts` — remove `telemetryConsent` from `additionalFields`
- Modify: `apps/web/src/integrations/posthog/client.tsx` — remove `hasConsent` prop from `PostHogWrapper`, remove `opt_out_capturing_by_default`
- Modify: wherever `PostHogWrapper` is rendered (find with `grep -rn "PostHogWrapper" apps/web/src/`) — remove `hasConsent` prop
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/customization.tsx` — replace mutation with PostHog hook calls

**Step 1: Find all `PostHogWrapper` usages**

```bash
grep -rn "PostHogWrapper\|hasConsent" apps/web/src/ | head -20
```

**Step 2: Remove `telemetryConsent` from Better Auth additionalFields**

In `core/authentication/src/server.ts`, remove:
```typescript
telemetryConsent: {
   defaultValue: false,
   input: true,
   required: true,
   type: "boolean",
},
```

**Step 3: Simplify `PostHogWrapper` — remove `hasConsent` prop**

In `apps/web/src/integrations/posthog/client.tsx`, remove the `hasConsent` parameter and `opt_out_capturing_by_default` from the options. PostHog will default to opted-in; the user's stored preference in localStorage takes over on next load.

```typescript
export function PostHogWrapper({
   children,
   env,
}: {
   children: React.ReactNode;
   env: PosthogEnv;
}) {
   return (
      <PostHogProvider
         apiKey={env.VITE_POSTHOG_KEY}
         options={{
            ...getReactPosthogConfig(env),
            disable_session_recording: !isClientProduction,
            persistence: "localStorage",
         }}
      >
         {children}
      </PostHogProvider>
   );
}
```

**Step 4: Update `customization.tsx` to use PostHog hook**

Replace the `updateConsentMutation` + `session` query with `usePostHog()`:

```typescript
import { usePostHog } from "@/integrations/posthog/client";

function PreferencesSectionContent() {
   const posthog = usePostHog();
   const hasConsent = !posthog.has_opted_out_capturing();
   const [isPending, setIsPending] = useState(false);

   function handleConsentChange(checked: boolean) {
      setIsPending(true);
      if (checked) {
         posthog.opt_in_capturing();
      } else {
         posthog.opt_out_capturing();
      }
      setIsPending(false);
   }
   // ... rest of the component unchanged
}
```

Remove: `useSuspenseQuery(orpc.session.getSession...)`, `useMutation(...)`, `authClient` import (if only used for consent).

**Step 5: Remove `hasConsent` prop from wherever `PostHogWrapper` is called**

From the grep in Step 1, update all call sites.

**Step 6: Run typecheck**

```bash
bun run typecheck 2>&1 | grep -E "telemetry|hasConsent|PostHogWrapper" | head -20
```

Fix any errors (likely just the removed prop references).

**Step 7: Commit**

```bash
git add core/authentication/src/server.ts \
        apps/web/src/integrations/posthog/client.tsx \
        apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/customization.tsx
git commit -m "feat(telemetry): replace DB-backed consent with PostHog native opt-out/opt-in"
```

---

---

## Hook Patterns — Required Reading Before Writing Any Hook or Callback

### foxact hooks (preferred over React built-ins or @uidotdev/usehooks)

The project uses `foxact` for SSR-safe, performance-optimized hooks. These are **not optional** — use them instead of the React primitives they replace.

| Need | Use | Import |
|------|-----|--------|
| Stable callback reference | `useStableHandler` | `foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired` |
| localStorage read/write | `useLocalStorage` | `foxact/use-local-storage` |
| Media query | `useMediaQuery` | `foxact/use-media-query` |
| Browser API in effect (SSR-safe) | `useIsomorphicLayoutEffect` | `foxact/use-isomorphic-layout-effect` |

**`useStableHandler` instead of `useCallback`:** For event handlers and callbacks passed to child components or used as effect dependencies, use `useStableHandler` — it returns a stable reference that always calls the latest version of the function without needing a deps array.

```typescript
// ❌ useCallback — stale closure risk, deps array burden
const handleChange = useCallback((v: string) => {
   mutation.mutate({ tone: v });
}, [mutation]);

// ✅ useStableHandler — always fresh, no deps
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";
const handleChange = useStableHandler((v: string) => {
   mutation.mutate({ tone: v });
});
```

**`useLocalStorage` for persistent UI state:** If any settings page needs to remember UI state across page reloads (e.g., which section is expanded), use foxact's `useLocalStorage` — it is SSR-safe and avoids hydration flicker.

```typescript
import { useLocalStorage } from "foxact/use-local-storage";
const [expanded, setExpanded] = useLocalStorage<boolean>("agent-settings:expanded", true);
```

**`useIsomorphicLayoutEffect` for browser API access:** When a `useEffect` reads from `window`, `navigator`, or `document`, replace `useEffect` with `useIsomorphicLayoutEffect` to avoid SSR mismatches.

```typescript
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
useIsomorphicLayoutEffect(() => {
   setIsOptedOut(posthog.has_opted_out_capturing());
}, []);
```

### React hook rules (project-specific reminders)

- **`useSuspenseQuery` always** — never `useQuery` unless polling/optional. Data is guaranteed defined.
- **No `useMutation` wrapping `authClient`** — call authClient directly inside `onSubmit` or event handlers.
- **`useTransition` for async non-form actions** — e.g. toggle buttons that call authClient. Use `isPending` from `useTransition` for the loading state.
- **No dynamic `import()` of hooks** — all hook imports must be static at the top of the file.
- **`useIsMobile()` for breakpoints** — import from `@packages/ui/hooks/use-mobile`, never inline `useMediaQuery("(max-width: 767px)")`.

### Where these apply in this plan

- **Task 5 (ai-agents.tsx):** Use `useStableHandler` for the `onValueChange` callbacks on Select/Switch fields instead of inline arrow functions or `useCallback`.
- **Task 6 (estoque.tsx):** Same — `useStableHandler` for any callbacks extracted outside `form.Field` render props.
- **Task 10 (customization.tsx):** Use `useIsomorphicLayoutEffect` to read `posthog.has_opted_out_capturing()` on mount (browser API). Use `useStableHandler` for `handleConsentChange`.

---

## Notes for executor

- **Import `@tanstack/react-form`**: It uses `catalog:tanstack` — check the catalog before adding a version string to `package.json`.
- **`useForm` from TanStack Form**: Each field is accessed via `<form.Field name="...">` render prop. The form submit is `form.handleSubmit()` called from `onSubmit` on the `<form>` element.
- **`useSuspenseQuery` input**: Always pass `input` inside `queryOptions({ input: {} })`, not as a separate argument.
- **No `useQuery`**: Always `useSuspenseQuery` — components are wrapped in `<Suspense>`.
- **No comments in code**: Per project conventions, code must be self-documenting.
- **No barrel files**: Import directly from source using package.json exports.
- **DB push before testing** new tables: `bun run db:push` after every new schema.
- **`tags` table import path**: Find it via `grep -rn "export const tags" core/database/src/schemas/`.
