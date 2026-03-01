# Services Module (Assinaturas e Planos)

**Date:** 2026-03-01
**Status:** Draft
**Stage:** Alpha (feature flag: `services`)

---

## Summary

A subscription management module for SaaS owners. Users define plans (e.g. Basic R$99/mo, Pro R$299/mo), subscribe clients (from the `contacts` table) to those plans, and track active subscriptions + revenue. A row action on the subscriptions table registers a payment (linked to a finance transaction).

---

## Design Decisions

- **Two-level model**: Plans (catalog) → Subscriptions (one contact per plan instance).
- **Single list page** (`/services`) shows subscriptions as the primary view. Plans are managed via a sheet/credenza.
- **Client link** — subscriptions reference `contacts.id` (type `cliente | ambos`).
- **Finance integration** — "Registrar Pagamento" row action creates a finance transaction (type `income`) and marks the subscription's last payment date.
- **Billing period**: `mensal`, `trimestral`, `semestral`, `anual`, `unico`.
- **Subscription status**: `ativa`, `pausada`, `cancelada`, `trial`.
- **Revenue dashboard**: KPI tiles + chart using dedicated oRPC queries.
- Contacts module must be deployed before subscriptions can link to clients.

---

## Step 1 — Database Schema

**File:** `packages/database/src/schemas/services.ts`

```typescript
import { sql } from "drizzle-orm";
import {
  index, numeric, pgEnum, pgTable,
  text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { transactions } from "./transactions";

export const serviceBillingPeriodEnum = pgEnum("service_billing_period", [
  "mensal", "trimestral", "semestral", "anual", "unico",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ativa", "pausada", "cancelada", "trial",
]);

// ─── Plans ────────────────────────────────────────────────────────────────────

export const servicePlans = pgTable(
  "service_plans",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    billingPeriod: serviceBillingPeriodEnum("billing_period").notNull().default("mensal"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    color: text("color").notNull().default("#6b7280"),
    isActive: text("is_active").notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("service_plans_team_idx").on(t.teamId),
    uniqueIndex("service_plans_team_name_unique").on(t.teamId, t.name),
  ],
);

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull(),
    planId: uuid("plan_id").notNull().references(() => servicePlans.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("ativa"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
    endDate: timestamp("end_date", { withTimezone: true }),          // null = ongoing
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
    nextBillingAt: timestamp("next_billing_at", { withTimezone: true }),
    customPrice: numeric("custom_price", { precision: 12, scale: 2 }), // override plan price per client
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("subscriptions_team_idx").on(t.teamId),
    index("subscriptions_plan_idx").on(t.planId),
    index("subscriptions_contact_idx").on(t.contactId),
  ],
);

// ─── Payments ─────────────────────────────────────────────────────────────────

export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull(),
    subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscription_payments_team_idx").on(t.teamId),
    index("subscription_payments_sub_idx").on(t.subscriptionId),
  ],
);

export type ServicePlan = typeof servicePlans.$inferSelect;
export type NewServicePlan = typeof servicePlans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert;
```

Register in `packages/database/src/schema.ts`.

---

## Step 2 — Repository

**File:** `packages/database/src/repositories/services-repository.ts`

```typescript
// SubscriptionWithDetails: Subscription + { plan: ServicePlan; contact: Contact; lastPayment?: SubscriptionPayment }

export async function listServicePlans(db, { teamId }): Promise<ServicePlan[]>
export async function createServicePlan(db, data: NewServicePlan): Promise<ServicePlan>
export async function updateServicePlan(db, { id, teamId }, data): Promise<ServicePlan>
export async function deleteServicePlan(db, { id, teamId }): Promise<void>
  // blocks if plan has active subscriptions

export async function listSubscriptions(db, { teamId, planId?, status?, contactId? }): Promise<SubscriptionWithDetails[]>
export async function getSubscription(db, { id, teamId }): Promise<SubscriptionWithDetails | null>
export async function createSubscription(db, data: NewSubscription): Promise<Subscription>
export async function updateSubscription(db, { id, teamId }, data): Promise<Subscription>
export async function cancelSubscription(db, { id, teamId }): Promise<Subscription>

export async function listSubscriptionPayments(db, { teamId, subscriptionId, limit? }): Promise<SubscriptionPayment[]>
export async function registerPayment(db, data: NewSubscriptionPayment): Promise<SubscriptionPayment>

// Dashboard queries
export async function getServiceStats(db, { teamId }): Promise<{
  activeSubscriptions: number;
  mrr: number;          // Monthly Recurring Revenue
  churnedThisMonth: number;
  newThisMonth: number;
}>
export async function getRevenueChart(db, { teamId, months?: number }): Promise<
  { month: string; revenue: number; newSubscriptions: number }[]
>
export async function getTopPlansByRevenue(db, { teamId }): Promise<
  { plan: ServicePlan; activeCount: number; monthlyRevenue: number }[]
>
```

---

## Step 3 — oRPC Router

**File:** `apps/web/src/integrations/orpc/router/services.ts`

```typescript
// ── Plans ─────────────────────────────────────────────────────────────────────
export const getPlans = protectedProcedure.handler(...)
export const createPlan = protectedProcedure
  .input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    billingPeriod: z.enum(["mensal", "trimestral", "semestral", "anual", "unico"]).default("mensal"),
    price: z.string().min(1),
    color: z.string().optional(),
  }))
  .handler(...)
export const updatePlan = protectedProcedure.input(...).handler(...)
export const removePlan = protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(...)

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const getAll = protectedProcedure
  .input(z.object({
    planId: z.string().uuid().optional(),
    status: z.enum(["ativa", "pausada", "cancelada", "trial"]).optional(),
    contactId: z.string().uuid().optional(),
  }))
  .handler(...)

export const create = protectedProcedure
  .input(z.object({
    planId: z.string().uuid(),
    contactId: z.string().uuid(),
    status: z.enum(["ativa", "pausada", "cancelada", "trial"]).default("ativa"),
    startDate: z.string().optional(),
    trialEndsAt: z.string().optional(),
    customPrice: z.string().optional(),
    notes: z.string().optional(),
  }))
  .handler(async ({ context, input }) => {
    // Validate plan and contact belong to team
    // Compute nextBillingAt from plan.billingPeriod + startDate
    return createSubscription(context.db, { teamId: context.teamId, ...input });
  })

export const update = protectedProcedure.input(...).handler(...)
export const cancel = protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(...)

// ── Payments ──────────────────────────────────────────────────────────────────
export const getPayments = protectedProcedure
  .input(z.object({ subscriptionId: z.string().uuid(), limit: z.number().int().optional() }))
  .handler(...)

export const registerPayment = protectedProcedure
  .input(z.object({
    subscriptionId: z.string().uuid(),
    amount: z.string().min(1),
    date: z.string().optional(),
    notes: z.string().optional(),
    transactionId: z.string().uuid().optional(),
    createTransaction: z.boolean().optional(),
  }))
  .handler(async ({ context, input }) => {
    const sub = await getSubscription(context.db, { id: input.subscriptionId, teamId: context.teamId });
    if (!sub) throw new ORPCError("NOT_FOUND", { message: "Assinatura não encontrada." });

    let transactionId = input.transactionId;
    if (input.createTransaction) {
      // Create income transaction for sub.plan.name, amount, date
      // capture transactionId
    }

    const payment = await registerPayment(context.db, {
      teamId: context.teamId, transactionId, ...input,
    });

    // Update subscription.lastPaymentAt and nextBillingAt
    await updateSubscription(context.db, { id: sub.id, teamId: context.teamId }, {
      lastPaymentAt: new Date(input.date ?? Date.now()),
      nextBillingAt: computeNextBilling(sub.plan.billingPeriod, input.date),
    });

    return payment;
  })

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats = protectedProcedure.handler(...)
export const getRevenueChart = protectedProcedure.input(...).handler(...)
export const getTopPlans = protectedProcedure.input(...).handler(...)
```

**Register in `apps/web/src/integrations/orpc/router/index.ts`:**
```typescript
import * as services from "./services";
export const router = { ...existing, services };
```

---

## Step 4 — UI Components

```
apps/web/src/features/services/
├── ui/
│   ├── service-plan-form.tsx           # Credenza: create/edit plan
│   ├── subscription-form.tsx           # Sheet: create/edit subscription (contact + plan + dates)
│   ├── subscription-card.tsx           # Mobile card renderer
│   ├── subscriptions-columns.tsx       # DataTable columns + row actions
│   ├── subscription-payment-credenza.tsx  # Register payment credenza
│   └── subscription-payments-list.tsx  # Expandable row: payment history
```

### `subscriptions-columns.tsx`
Columns: Client (contact name + type badge), Plan (name + billing period badge), Status badge, Effective price, Next billing date, Last payment, Actions.

Row actions:
- **Registrar Pagamento** → `SubscriptionPaymentCredenza`
- **Editar** → `SubscriptionForm` sheet
- **Cancelar** → `useAlertDialog` → calls `services.cancel`

Expandable row: `<SubscriptionPaymentsList subscriptionId={row.id} />`

### `subscription-payment-credenza.tsx`
Fields:
- **Valor** — MoneyInput (pre-filled with plan price or custom price)
- **Data** — DatePicker
- **Notas** — Textarea
- **Transação** — Toggle: "Nenhuma" | "Vincular existente" | "Criar automático" (creates income transaction)

### `service-plan-form.tsx`
Opened via "Gerenciar Planos" button in page header. Credenza with plan list + inline create/edit.

---

## Step 5 — Route

**File:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/services/index.tsx`

```
<DefaultHeader
  title="Assinaturas"
  description="Gerencie os planos e assinaturas dos seus clientes"
  actions={
    <>
      <Button variant="outline" onClick={openManagePlans}>
        <Settings /> Planos
      </Button>
      <Button onClick={openCreateSubscription}>
        <Plus /> Nova Assinatura
      </Button>
    </>
  }
/>

{/* Status filter */}
<Tabs value={statusFilter} onValueChange={setStatusFilter}>
  <TabsList>
    <TabsTrigger value="all">Todas</TabsTrigger>
    <TabsTrigger value="ativa">Ativas</TabsTrigger>
    <TabsTrigger value="trial">Trial</TabsTrigger>
    <TabsTrigger value="cancelada">Canceladas</TabsTrigger>
  </TabsList>
</Tabs>

<Suspense fallback={<Skeleton />}>
  <SubscriptionsTable statusFilter={statusFilter} />
</Suspense>
```

Loader prefetches `orpc.services.getAll` and `orpc.services.getPlans`.

---

## Step 6 — Dashboard Integration

Seed a "Assinaturas" dashboard when the `services` flag is active. Default tiles:
- **MRR** — total monthly recurring revenue
- **Assinaturas ativas** — count of active subscriptions
- **Novas este mês** — new subscriptions started this month
- **Canceladas este mês** — churned subscriptions
- **Receita por plano** — bar chart breakdown
- **Tendência de receita** — line chart last 6 months

---

## Step 7 — Sidebar + Early Access

### Sidebar
```typescript
{
  id: "services",
  label: "Assinaturas",
  items: [
    {
      id: "services",
      label: "Assinaturas",
      icon: Repeat,
      route: "/$slug/$teamSlug/services",
      earlyAccessFlag: "services",
    },
  ],
},
```

### Billing overview
```typescript
services: {
  label: "Assinaturas",
  description: "Gestão de planos e assinaturas dos seus clientes",
  icon: <Repeat className="size-5" />,
  priceLabel: "Alpha",
  unit: "acesso gratuito",
  fallbackStage: "alpha",
},
```

### PostHog
Create early access feature flag `services` with stage `alpha`.

---

## File Checklist

| File | Action |
|------|--------|
| `packages/database/src/schemas/services.ts` | Create |
| `packages/database/src/schema.ts` | Edit |
| `packages/database/src/repositories/services-repository.ts` | Create |
| `apps/web/src/integrations/orpc/router/services.ts` | Create |
| `apps/web/src/integrations/orpc/router/index.ts` | Edit |
| `apps/web/src/features/services/ui/service-plan-form.tsx` | Create |
| `apps/web/src/features/services/ui/subscription-form.tsx` | Create |
| `apps/web/src/features/services/ui/subscription-card.tsx` | Create |
| `apps/web/src/features/services/ui/subscriptions-columns.tsx` | Create |
| `apps/web/src/features/services/ui/subscription-payment-credenza.tsx` | Create |
| `apps/web/src/features/services/ui/subscription-payments-list.tsx` | Create |
| `apps/web/src/routes/.../services/index.tsx` | Create |
| `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts` | Edit |
| `apps/web/src/features/billing/ui/billing-overview.tsx` | Edit |
| `packages/database/src/default-insights.ts` | Edit |
| `scripts/seed-default-dashboard.ts` | Edit |

---

## Out of Scope (alpha)

- Automated billing / dunning
- Client self-service portal
- Proration on plan changes
- Trial-to-paid conversion flow
- Churn prediction
- Webhook notifications on status changes
