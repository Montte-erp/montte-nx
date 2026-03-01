# Budget Goals Module (Metas)

**Date:** 2026-03-01
**Scope:** Spending goals per category/subcategory, monthly, with alert system

---

## Summary

Add a "Metas" feature to the Finance section. Users define spending limits per category or subcategory for a given month. The page supports card + table views, month navigation, copy-from-previous-month, and a single alert threshold that triggers a visual indicator, in-app PWA notification, and email when spending reaches x% of the limit.

---

## Design Decisions

- Goals are **expense-only**, scoped per **month/year** and per **category or subcategory**
- A category goal includes transactions of its subcategories (aggregate)
- A subcategory goal is independent of its parent category goal
- **One goal per category per month** (unique constraint)
- **One alert threshold** per goal (0–100%) — once sent, `alertSentAt` prevents re-sending until month resets
- History is preserved — new months start empty, user copies from previous month manually
- Alerts delivered via: visual badge, PWA push notification, email (Resend)
- Alert checking triggered as a BullMQ job on transaction create/update

---

## Step 1 — Database Schema

**File:** `packages/database/src/schemas/budget-goals.ts`

```typescript
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { subcategories } from "./subcategories";

export const budgetGoals = pgTable(
  "budget_goals",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    subcategoryId: uuid("subcategory_id").references(() => subcategories.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),       // 1–12
    year: integer("year").notNull(),
    limitAmount: numeric("limit_amount", { precision: 12, scale: 2 }).notNull(),
    alertThreshold: integer("alert_threshold"), // 0–100, nullable = no alert
    alertSentAt: timestamp("alert_sent_at", { withTimezone: true }), // null = not sent yet
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("budget_goals_team_id_idx").on(table.teamId),
    uniqueIndex("budget_goals_team_category_month_unique")
      .on(table.teamId, table.categoryId, table.month, table.year)
      .where(sql`${table.categoryId} IS NOT NULL`),
    uniqueIndex("budget_goals_team_subcategory_month_unique")
      .on(table.teamId, table.subcategoryId, table.month, table.year)
      .where(sql`${table.subcategoryId} IS NOT NULL`),
  ],
);

export type BudgetGoal = typeof budgetGoals.$inferSelect;
export type NewBudgetGoal = typeof budgetGoals.$inferInsert;
```

**Export in `packages/database/src/schemas/index.ts`** (or wherever schemas are re-exported for `db:push`).

---

## Step 2 — Repository

**File:** `packages/database/src/repositories/budget-goals-repository.ts`

Functions:

```typescript
// List goals for a month, with spentAmount computed via SQL SUM
export async function listBudgetGoals(
  db: DatabaseInstance,
  { teamId, month, year }: { teamId: string; month: number; year: number }
): Promise<BudgetGoalWithProgress[]>
// Returns each goal enriched with:
//   category: { id, name, icon, color } | null
//   subcategory: { id, name, categoryId } | null
//   spentAmount: number (sum of expense transactions for that category/subcategory in month/year)
//   percentUsed: number (spentAmount / limitAmount * 100)

// Spent is computed with a subquery:
// - For category goal: SUM of transactions WHERE type='expense' AND (categoryId = goal.categoryId OR subcategoryId IN subcategories of that category) AND month/year match
// - For subcategory goal: SUM of transactions WHERE type='expense' AND subcategoryId = goal.subcategoryId AND month/year match

export async function getBudgetGoal(db, { id, teamId }): Promise<BudgetGoal | null>

export async function createBudgetGoal(db, data: NewBudgetGoal): Promise<BudgetGoal>

export async function updateBudgetGoal(db, { id, teamId }, data: Partial<NewBudgetGoal>): Promise<BudgetGoal>

export async function deleteBudgetGoal(db, { id, teamId }): Promise<void>

export async function copyPreviousMonth(
  db: DatabaseInstance,
  { teamId, fromMonth, fromYear, toMonth, toYear }: CopyMonthInput
): Promise<number> // returns count of copied goals
// Copies all goals from source month, skipping any where a goal already exists in the target month
// Copies: categoryId, subcategoryId, limitAmount, alertThreshold
// Sets alertSentAt = null on all copied goals

export async function getGoalsNeedingAlertCheck(
  db: DatabaseInstance,
  { month, year }: { month: number; year: number }
): Promise<BudgetGoalWithProgress[]>
// Returns goals where alertThreshold IS NOT NULL AND alertSentAt IS NULL AND percentUsed >= alertThreshold
```

---

## Step 3 — Events & Queue Job

**File:** `packages/events/src/finance.ts` (or new `budget.ts`)

Add event: `budget.alert_triggered` — tracks when a budget alert is fired.

**File:** `apps/worker/src/jobs/check-budget-alerts.ts` (new BullMQ job)

Job payload: `{ teamId: string; month: number; year: number }`

Logic:
1. Call `getGoalsNeedingAlertCheck()`
2. For each goal over threshold:
   a. Send email via Resend (import from `@packages/transactional`)
   b. Send PWA push notification via Web Push API
   c. Set `alertSentAt = new Date()` on the goal
   d. `emitEvent("budget.alert_triggered", { ... })`

**Trigger:** In `apps/web/src/integrations/orpc/router/transactions.ts`, after `create` and `update` handlers enqueue a `check-budget-alerts` job with the transaction's teamId + the month/year of the transaction date.

---

## Step 4 — oRPC Router

**File:** `apps/web/src/integrations/orpc/router/budget-goals.ts`

```typescript
export const getAll = protectedProcedure
  .input(z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }))
  .handler(async ({ context, input }) => {
    return listBudgetGoals(context.db, { teamId: context.teamId, ...input });
  });

export const create = protectedProcedure
  .input(z.object({
    categoryId: z.string().uuid().optional(),
    subcategoryId: z.string().uuid().optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int(),
    limitAmount: z.string(), // numeric string for NUMERIC column
    alertThreshold: z.number().int().min(0).max(100).optional(),
  }).refine(d => !!(d.categoryId ?? d.subcategoryId), {
    message: "Either categoryId or subcategoryId is required",
  }))
  .handler(async ({ context, input }) => {
    // Validate category/subcategory belongs to team
    return createBudgetGoal(context.db, { teamId: context.teamId, ...input });
  });

export const update = protectedProcedure
  .input(z.object({
    id: z.string().uuid(),
    limitAmount: z.string().optional(),
    alertThreshold: z.number().int().min(0).max(100).nullable().optional(),
  }))
  .handler(async ({ context, input }) => {
    const existing = await getBudgetGoal(context.db, { id: input.id, teamId: context.teamId });
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada" });
    return updateBudgetGoal(context.db, { id: input.id, teamId: context.teamId }, input);
  });

export const remove = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const existing = await getBudgetGoal(context.db, { id: input.id, teamId: context.teamId });
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada" });
    await deleteBudgetGoal(context.db, { id: input.id, teamId: context.teamId });
  });

export const copyFromPreviousMonth = protectedProcedure
  .input(z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }))
  .handler(async ({ context, input }) => {
    // Compute previous month
    const prevMonth = input.month === 1 ? 12 : input.month - 1;
    const prevYear = input.month === 1 ? input.year - 1 : input.year;
    const count = await copyPreviousMonth(context.db, {
      teamId: context.teamId,
      fromMonth: prevMonth, fromYear: prevYear,
      toMonth: input.month, toYear: input.year,
    });
    return { count };
  });
```

Register in `apps/web/src/integrations/orpc/router/index.ts`:
```typescript
import * as budgetGoals from "./budget-goals";
export const router = { ..., budgetGoals };
```

---

## Step 5 — UI Components

### 5a. Sheet Form
**File:** `apps/web/src/features/budget-goals/ui/budget-goal-sheet.tsx`

Fields:
- **Tipo de meta** — ToggleGroup: "Categoria" | "Subcategoria"
- **Categoria** — Combobox (filtered to expense categories only, shows icon + color)
- **Subcategoria** — Combobox (shown only when type = "Subcategoria", loads from selected category)
- **Limite** — MoneyInput (BRL)
- **Alerta** — Toggle (on/off) + number input `__% da meta` (shown when enabled)

Uses `useSheet` / `useCredenza` global hook — never import Sheet/Credenza manually.

### 5b. Goal Card
**File:** `apps/web/src/features/budget-goals/ui/budget-goal-card.tsx`

```
┌────────────────────────────────────────┐
│ [icon][color] Casa          [⋮ menu]  │
│ R$ 1.200 gasto de R$ 2.000            │
│ ████████░░░░░░  60%                   │
│ 🔔 Alerta: 80%                        │
└────────────────────────────────────────┘
```

Progress bar color logic:
- `percentUsed < alertThreshold` → `bg-emerald-500`
- `percentUsed >= alertThreshold && percentUsed < 100` → `bg-amber-500`
- `percentUsed >= 100` → `bg-destructive`

Dropdown menu: Editar / Excluir

### 5c. Table Columns
**File:** `apps/web/src/features/budget-goals/ui/budget-goals-columns.tsx`

Columns:
- Categoria/Subcategoria (icon + color dot + name)
- Limite (formatted BRL)
- Gasto (formatted BRL)
- % Usado (badge: green/amber/red)
- Alerta (badge showing threshold%, or "—" if none)
- Ações (edit, delete)

### 5d. Empty State

When no goals for the month: show `Empty` component with `Target` icon, title "Nenhuma meta" and description "Defina limites de gasto por categoria para controlar suas finanças."

---

## Step 6 — Route Page

**File:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/goals.tsx`

```typescript
export const Route = createFileRoute(
  "/_authenticated/$slug/$teamSlug/_dashboard/finance/goals",
)({ loader, component: GoalsPage });
```

Page structure:
```
<DefaultHeader
  title="Metas"
  description="Defina limites de gasto mensais por categoria"
  actions={
    <>
      {/* "Copiar mês anterior" — only shown when current month has no goals */}
      <Button variant="outline" onClick={handleCopyPreviousMonth}>
        <Copy /> Copiar mês anterior
      </Button>
      <Button onClick={handleCreate}>
        <Plus /> Nova Meta
      </Button>
    </>
  }
  viewSwitch={<ViewSwitchDropdown ... />}
/>

{/* Month navigation */}
<MonthNavigation month={month} year={year} onChange={setMonthYear} />

<Suspense fallback={<GoalsSkeleton />}>
  <GoalsList month={month} year={year} view={currentView} />
</Suspense>
```

**Month navigation component** — `◀ Março 2025 ▶` — simple prev/next buttons, stored in component state (defaults to current month/year).

**View switch key:** `"finance:goals:view"` — persists card/table preference.

**Loader:** prefetches `orpc.budgetGoals.getAll` for current month + `orpc.categories.getAll`.

---

## Step 7 — Sidebar

**File:** `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

Add to `finance` group after `tags`:
```typescript
{
  id: "goals",
  label: "Metas",
  icon: Target,
  route: "/$slug/$teamSlug/finance/goals",
},
```

Import `Target` from `lucide-react`.

---

## Step 8 — Email Template

**File:** `packages/transactional/src/emails/budget-alert.tsx`

Simple React Email template:
- Subject: `Alerta de meta: [Categoria] atingiu [X]% do limite`
- Body: category name, amount spent, limit, percentage, link to goals page

---

## Step 9 — Schema Export Registration

In `packages/database/src/schemas/` — ensure `budget-goals.ts` is included in the export map used by `db:push`. Check the existing pattern in `package.json` exports under `"./schemas/*"`.

---

## File Checklist

| File | Action |
|------|--------|
| `packages/database/src/schemas/budget-goals.ts` | Create |
| `packages/database/src/repositories/budget-goals-repository.ts` | Create |
| `apps/web/src/integrations/orpc/router/budget-goals.ts` | Create |
| `apps/web/src/integrations/orpc/router/index.ts` | Edit — register router |
| `apps/web/src/features/budget-goals/ui/budget-goal-sheet.tsx` | Create |
| `apps/web/src/features/budget-goals/ui/budget-goal-card.tsx` | Create |
| `apps/web/src/features/budget-goals/ui/budget-goals-columns.tsx` | Create |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/goals.tsx` | Create |
| `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts` | Edit — add Goals nav item |
| `packages/transactional/src/emails/budget-alert.tsx` | Create |
| `apps/worker/src/jobs/check-budget-alerts.ts` | Create |
| `apps/web/src/integrations/orpc/router/transactions.ts` | Edit — enqueue alert check job |
| `packages/events/src/finance.ts` | Edit — add budget.alert_triggered |

---

## Open Question (deferred)

- When a user has a goal for a **parent category** (e.g., "Casa"), should it aggregate spending from its subcategories? → Current plan: **yes, it aggregates**. To be confirmed with user.
