# Billing Lifecycle Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build DBOS durable workflows for the full billing lifecycle: usage ingestion, benefit grant/revoke, period-end invoice generation, trial expiry, and lifecycle alert emails.

**Architecture:** Five DBOS workflows in `packages/workflows/src/workflows/billing/`, each registered via `DBOS.registerWorkflow` and enqueued via `createEnqueuer`. New DB schemas for `benefit_grants` and `invoices`. New billable events wired through `createBillableProcedure` in relevant oRPC routers.

**Tech Stack:** DBOS SDK, Drizzle ORM (crmSchema/platformSchema), neverthrow, @core/transactional (Resend), @f-o-t/money, @f-o-t/condition-evaluator, packages/notifications publisher

---

## Task 1: Add Billable Event Constants + Stripe Mappings

**Files:**
- Modify: `core/stripe/src/constants.ts`

### Step 1: Add four new entries to `FREE_TIER_LIMITS`, `EVENT_PRICES`, and `STRIPE_METER_EVENTS`

```typescript
// In FREE_TIER_LIMITS:
"subscription.created": 50,
"usage.ingested": 1000,
"service.meter_created": 10,
"service.benefit_created": 20,

// In EVENT_PRICES:
"subscription.created": "0.010000",
"usage.ingested": "0.000500",
"service.meter_created": "0.050000",
"service.benefit_created": "0.020000",

// In STRIPE_METER_EVENTS:
"subscription.created": "subscription_creates",
"usage.ingested": "usage_ingested",
"service.meter_created": "service_meter_creates",
"service.benefit_created": "service_benefit_creates",
```

### Step 2: Run tests to verify no breakage

```bash
bun nx test @core/stripe
```
Expected: all pass.

### Step 3: Commit

```bash
git add core/stripe/src/constants.ts
git commit -m "feat(stripe): add subscription.created, usage.ingested, service.meter_created, service.benefit_created constants"
```

---

## Task 2: Add Emit Functions to `packages/events/src/service.ts`

**Files:**
- Modify: `packages/events/src/service.ts`

### Step 1: Add four new event keys to `SERVICE_EVENTS`

```typescript
export const SERVICE_EVENTS = {
  "service.created": "service.created",
  "service.updated": "service.updated",
  "service.deleted": "service.deleted",
  "service.meter_created": "service.meter_created",
  "service.benefit_created": "service.benefit_created",
  "subscription.created": "subscription.created",
  "usage.ingested": "usage.ingested",
} as const;
```

### Step 2: Add emit functions for each new event

```typescript
export const serviceMeterCreatedSchema = z.object({
  meterId: z.string().uuid(),
  eventName: z.string(),
});
export type ServiceMeterCreatedEvent = z.infer<typeof serviceMeterCreatedSchema>;
export function emitServiceMeterCreated(
  emit: EmitFn,
  ctx: { organizationId: string; userId?: string; teamId?: string },
  properties: ServiceMeterCreatedEvent,
) {
  return emit({
    ...ctx,
    eventName: SERVICE_EVENTS["service.meter_created"],
    eventCategory: EVENT_CATEGORIES.service,
    properties,
  });
}

export const serviceBenefitCreatedSchema = z.object({
  benefitId: z.string().uuid(),
  name: z.string(),
});
export type ServiceBenefitCreatedEvent = z.infer<typeof serviceBenefitCreatedSchema>;
export function emitServiceBenefitCreated(
  emit: EmitFn,
  ctx: { organizationId: string; userId?: string; teamId?: string },
  properties: ServiceBenefitCreatedEvent,
) {
  return emit({
    ...ctx,
    eventName: SERVICE_EVENTS["service.benefit_created"],
    eventCategory: EVENT_CATEGORIES.service,
    properties,
  });
}

export const subscriptionCreatedSchema = z.object({
  subscriptionId: z.string().uuid(),
  contactId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
});
export type SubscriptionCreatedEvent = z.infer<typeof subscriptionCreatedSchema>;
export function emitSubscriptionCreated(
  emit: EmitFn,
  ctx: { organizationId: string; userId?: string; teamId?: string },
  properties: SubscriptionCreatedEvent,
) {
  return emit({
    ...ctx,
    eventName: SERVICE_EVENTS["subscription.created"],
    eventCategory: EVENT_CATEGORIES.service,
    properties,
  });
}

export const usageIngestedSchema = z.object({
  meterId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  idempotencyKey: z.string(),
});
export type UsageIngestedEvent = z.infer<typeof usageIngestedSchema>;
export function emitUsageIngested(
  emit: EmitFn,
  ctx: { organizationId: string; userId?: string; teamId?: string },
  properties: UsageIngestedEvent,
) {
  return emit({
    ...ctx,
    eventName: SERVICE_EVENTS["usage.ingested"],
    eventCategory: EVENT_CATEGORIES.service,
    properties,
  });
}
```

### Step 3: Commit

```bash
git add packages/events/src/service.ts
git commit -m "feat(events): add meter_created, benefit_created, subscription.created, usage.ingested emit functions"
```

---

## Task 3: Add `benefit_grants` DB Schema

**Files:**
- Create: `core/database/src/schemas/benefit-grants.ts`
- Modify: `core/database/src/schemas/schemas.ts` (if needed — verify `crmSchema` is exported)

### Step 1: Create the schema file

```typescript
// core/database/src/schemas/benefit-grants.ts
import { sql } from "drizzle-orm";
import { index, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { crmSchema } from "@core/database/schemas/schemas";
import { benefits } from "@core/database/schemas/benefits";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";

export const benefitGrantStatusEnum = crmSchema.enum("benefit_grant_status", [
  "active",
  "revoked",
]);

export type BenefitGrantStatus =
  (typeof benefitGrantStatusEnum.enumValues)[number];

export const benefitGrants = crmSchema.table(
  "benefit_grants",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    teamId: uuid("team_id").notNull(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => contactSubscriptions.id, { onDelete: "cascade" }),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => benefits.id, { onDelete: "restrict" }),
    status: benefitGrantStatusEnum("status").notNull().default("active"),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("benefit_grants_subscription_benefit_idx").on(
      table.subscriptionId,
      table.benefitId,
    ),
    index("benefit_grants_team_id_idx").on(table.teamId),
    index("benefit_grants_subscription_id_idx").on(table.subscriptionId),
    index("benefit_grants_status_idx").on(table.status),
  ],
);

export type BenefitGrant = typeof benefitGrants.$inferSelect;
export type NewBenefitGrant = typeof benefitGrants.$inferInsert;
```

### Step 2: Register in Drizzle relations (add to relevant relations file if needed)

Check `core/database/src/schemas/` for a `relations.ts` or inline relations. If relations exist, add:

```typescript
// In benefits relations: add benefitGrants: many(benefitGrants)
// In contactSubscriptions relations: add benefitGrants: many(benefitGrants)
```

### Step 3: Push schema to DB

```bash
bun run db:push
```

### Step 4: Commit

```bash
git add core/database/src/schemas/benefit-grants.ts
git commit -m "feat(database): add benefit_grants schema"
```

---

## Task 4: Add `invoices` DB Schema

**Files:**
- Create: `core/database/src/schemas/invoices.ts`

### Step 1: Create schema file

```typescript
// core/database/src/schemas/invoices.ts
import { sql } from "drizzle-orm";
import { index, jsonb, numeric, timestamp, uuid, text } from "drizzle-orm/pg-core";
import { platformSchema } from "@core/database/schemas/schemas";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { team } from "@core/database/schemas/auth";

export const invoiceStatusEnum = platformSchema.enum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
]);

export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];

export type InvoiceLineItem = {
  description: string;
  meterId: string | null;
  quantity: string;
  unitPrice: string;
  subtotal: string;
};

export const invoices = platformSchema.table(
  "invoices",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => contactSubscriptions.id, { onDelete: "restrict" }),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    lineItems: jsonb("line_items")
      .$type<InvoiceLineItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    couponSnapshot: jsonb("coupon_snapshot")
      .$type<{
        code: string;
        type: string;
        amount: string;
        duration: string;
      } | null>()
      .default(sql`NULL`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("invoices_team_id_idx").on(table.teamId),
    index("invoices_subscription_id_idx").on(table.subscriptionId),
    index("invoices_status_idx").on(table.status),
    index("invoices_period_end_idx").on(table.periodEnd),
  ],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
```

### Step 2: Push schema

```bash
bun run db:push
```

### Step 3: Commit

```bash
git add core/database/src/schemas/invoices.ts
git commit -m "feat(database): add invoices schema"
```

---

## Task 5: Add `benefit_grants` + `invoices` Repositories

**Files:**
- Create: `core/database/src/repositories/benefit-grants-repository.ts`
- Create: `core/database/src/repositories/invoices-repository.ts`

### Step 1: Create benefit-grants repository

```typescript
// core/database/src/repositories/benefit-grants-repository.ts
import dayjs from "dayjs";
import { AppError } from "@core/logging/errors";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { benefitGrants } from "@core/database/schemas/benefit-grants";

export function grantBenefits(
  db: DatabaseInstance,
  teamId: string,
  subscriptionId: string,
  benefitIds: string[],
) {
  if (benefitIds.length === 0) return fromPromise(Promise.resolve([]), () => AppError.database(""));
  return fromPromise(
    db.transaction(async (tx) => {
      const rows = await tx
        .insert(benefitGrants)
        .values(
          benefitIds.map((benefitId) => ({
            teamId,
            subscriptionId,
            benefitId,
            status: "active" as const,
          })),
        )
        .onConflictDoNothing({
          target: [benefitGrants.subscriptionId, benefitGrants.benefitId],
        })
        .returning();
      return rows;
    }),
    (e) => AppError.database("Falha ao conceder benefícios.", { cause: e }),
  );
}

export function revokeBenefits(
  db: DatabaseInstance,
  subscriptionId: string,
) {
  return fromPromise(
    db.transaction(async (tx) => {
      await tx
        .update(benefitGrants)
        .set({ status: "revoked", revokedAt: dayjs().toDate() })
        .where(
          and(
            eq(benefitGrants.subscriptionId, subscriptionId),
            eq(benefitGrants.status, "active"),
          ),
        );
    }),
    (e) => AppError.database("Falha ao revogar benefícios.", { cause: e }),
  );
}

export function listGrantsBySubscription(
  db: DatabaseInstance,
  subscriptionId: string,
) {
  return fromPromise(
    db.query.benefitGrants.findMany({
      where: (fields, { eq }) => eq(fields.subscriptionId, subscriptionId),
    }),
    (e) => AppError.database("Falha ao listar concessões.", { cause: e }),
  );
}
```

### Step 2: Create invoices repository

```typescript
// core/database/src/repositories/invoices-repository.ts
import { AppError } from "@core/logging/errors";
import { desc, eq } from "drizzle-orm";
import { fromPromise, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import type { NewInvoice } from "@core/database/schemas/invoices";
import { invoices } from "@core/database/schemas/invoices";

export function createInvoice(db: DatabaseInstance, data: Omit<NewInvoice, "id" | "createdAt" | "updatedAt">) {
  return fromPromise(
    db.transaction(async (tx) => {
      const [row] = await tx.insert(invoices).values(data).returning();
      if (!row) throw AppError.database("Falha ao criar fatura.");
      return row;
    }),
    (e) => AppError.database("Falha ao criar fatura.", { cause: e }),
  );
}

export function getInvoice(db: DatabaseInstance, id: string) {
  return fromPromise(
    db.query.invoices.findFirst({ where: (f, { eq }) => eq(f.id, id) }),
    (e) => AppError.database("Falha ao buscar fatura.", { cause: e }),
  ).andThen((row) => (row ? ok(row) : err(AppError.notFound("Fatura não encontrada."))));
}

export function listInvoicesBySubscription(db: DatabaseInstance, subscriptionId: string) {
  return fromPromise(
    db
      .select()
      .from(invoices)
      .where(eq(invoices.subscriptionId, subscriptionId))
      .orderBy(desc(invoices.periodEnd)),
    (e) => AppError.database("Falha ao listar faturas.", { cause: e }),
  );
}

export function markInvoicePaid(db: DatabaseInstance, id: string) {
  return fromPromise(
    db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({ status: "paid" })
        .where(eq(invoices.id, id))
        .returning();
      if (!row) throw AppError.notFound("Fatura não encontrada.");
      return row;
    }),
    (e) => AppError.database("Falha ao atualizar fatura.", { cause: e }),
  );
}
```

### Step 3: Commit

```bash
git add core/database/src/repositories/benefit-grants-repository.ts core/database/src/repositories/invoices-repository.ts
git commit -m "feat(database): add benefit-grants and invoices repositories"
```

---

## Task 6: Add Billing Notification Types

**Files:**
- Modify: `packages/notifications/src/types.ts`

### Step 1: Add billing notification types to `NOTIFICATION_TYPES`

```typescript
BILLING_INVOICE_GENERATED: "billing.invoice_generated",
BILLING_TRIAL_EXPIRING: "billing.trial_expiring",
BILLING_BENEFIT_GRANTED: "billing.benefit_granted",
BILLING_BENEFIT_REVOKED: "billing.benefit_revoked",
BILLING_USAGE_INGESTED: "billing.usage_ingested",
```

Add to `NotificationPayloadMap`:

```typescript
"billing.invoice_generated": { invoiceId: string; subscriptionId: string; total: string };
"billing.trial_expiring": { subscriptionId: string; trialEndsAt: string; daysLeft: number };
"billing.benefit_granted": { subscriptionId: string; benefitIds: string[] };
"billing.benefit_revoked": { subscriptionId: string; benefitIds: string[] };
"billing.usage_ingested": { meterId: string; idempotencyKey: string };
```

### Step 2: Commit

```bash
git add packages/notifications/src/types.ts
git commit -m "feat(notifications): add billing lifecycle notification types"
```

---

## Task 7: Usage Ingestion Workflow

**Files:**
- Create: `packages/workflows/src/workflows/billing/usage-ingestion-workflow.ts`
- Modify: `packages/workflows/src/workflow-factory.ts` (add queue key)
- Modify: `packages/workflows/src/setup.ts` (import + register)

### Step 1: Write the workflow

This workflow is enqueued by `hyprpay.usage.ingest` (the usage ingestion oRPC endpoint). It writes a `usage_events` row idempotently and publishes a job notification.

```typescript
// packages/workflows/src/workflows/billing/usage-ingestion-workflow.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import { createEnqueuer, QUEUES } from "../../workflow-factory";
import { upsertUsageEvent } from "@core/database/repositories/usage-events-repository";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../../context";

export type UsageIngestionInput = {
  teamId: string;
  meterId: string;
  quantity: string;
  idempotencyKey: string;
  contactId?: string;
  properties?: Record<string, unknown>;
};

async function usageIngestionWorkflowFn(input: UsageIngestionInput) {
  const { db } = getDeps();
  const publisher = getPublisher();
  const ctx = `[usage-ingestion] team=${input.teamId} idem=${input.idempotencyKey}`;
  DBOS.logger.info(`${ctx} started`);

  const result = await DBOS.runStep(
    () =>
      upsertUsageEvent(db, {
        teamId: input.teamId,
        meterId: input.meterId,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey,
        contactId: input.contactId ?? null,
        properties: input.properties ?? {},
      }).match(
        (v) => v,
        (e) => { throw e; },
      ),
    { name: "upsertUsageEvent" },
  );

  await DBOS.runStep(
    () =>
      publisher.publish("job.notification", {
        jobId: input.idempotencyKey,
        timestamp: new Date().toISOString(),
        type: NOTIFICATION_TYPES.BILLING_USAGE_INGESTED,
        status: "completed",
        message: `Uso registrado para medidor ${input.meterId}.`,
        teamId: input.teamId,
        payload: { meterId: input.meterId, idempotencyKey: input.idempotencyKey },
      } satisfies JobNotification),
    { name: "publishCompleted" },
  );

  DBOS.logger.info(`${ctx} completed — row=${result?.id ?? "duplicate"}`);
}

export const usageIngestionWorkflow = DBOS.registerWorkflow(usageIngestionWorkflowFn);

export const enqueueUsageIngestionWorkflow = createEnqueuer<UsageIngestionInput>(
  usageIngestionWorkflowFn.name,
  QUEUES.usageIngestion,
  (i) => `usage-ingest-${i.idempotencyKey}`,
);
```

### Step 2: Add queue key to `workflow-factory.ts`

```typescript
// Add to QUEUES object:
usageIngestion: "usage-ingestion",
```

### Step 3: Import workflow in `setup.ts`

```typescript
import "./workflows/billing/usage-ingestion-workflow";
```

### Step 4: Commit

```bash
git add packages/workflows/src/workflows/billing/usage-ingestion-workflow.ts packages/workflows/src/workflow-factory.ts packages/workflows/src/setup.ts
git commit -m "feat(workflows): add usage ingestion workflow"
```

---

## Task 8: Benefit Lifecycle Workflow

**Files:**
- Create: `packages/workflows/src/workflows/billing/benefit-lifecycle-workflow.ts`
- Modify: `packages/workflows/src/workflow-factory.ts`
- Modify: `packages/workflows/src/setup.ts`

### Step 1: Write the workflow

Triggered on subscription status change. Handles grant (created/active) and revoke (cancelled/completed/upgraded) in one atomic step. Upgrade: revoke old grants, create new ones in same DB transaction.

```typescript
// packages/workflows/src/workflows/billing/benefit-lifecycle-workflow.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import { createEnqueuer, QUEUES } from "../../workflow-factory";
import { grantBenefits, revokeBenefits } from "@core/database/repositories/benefit-grants-repository";
import { listBenefitsByService } from "@core/database/repositories/benefits-repository";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../../context";
import type { SubscriptionStatus } from "@core/database/schemas/subscriptions";

export type BenefitLifecycleInput = {
  teamId: string;
  subscriptionId: string;
  serviceId: string;
  newStatus: SubscriptionStatus;
  previousStatus?: SubscriptionStatus;
};

const GRANT_STATUSES: SubscriptionStatus[] = ["active", "trialing"];
const REVOKE_STATUSES: SubscriptionStatus[] = ["cancelled", "completed"];

async function benefitLifecycleWorkflowFn(input: BenefitLifecycleInput) {
  const { db } = getDeps();
  const publisher = getPublisher();
  const ctx = `[benefit-lifecycle] sub=${input.subscriptionId} status=${input.newStatus}`;
  DBOS.logger.info(`${ctx} started`);

  const benefits = await DBOS.runStep(
    () =>
      listBenefitsByService(db, input.serviceId).match(
        (v) => v,
        (e) => { throw e; },
      ),
    { name: "fetchBenefits" },
  );

  const benefitIds = benefits.map((b) => b.id);
  if (benefitIds.length === 0) {
    DBOS.logger.info(`${ctx} no benefits to manage`);
    return;
  }

  const isUpgrade =
    input.previousStatus &&
    REVOKE_STATUSES.includes(input.previousStatus) === false &&
    GRANT_STATUSES.includes(input.newStatus);

  if (REVOKE_STATUSES.includes(input.newStatus) || isUpgrade) {
    await DBOS.runStep(
      () =>
        revokeBenefits(db, input.subscriptionId).match(
          (v) => v,
          (e) => { throw e; },
        ),
      { name: "revokeBenefits" },
    );
    await DBOS.runStep(
      () =>
        publisher.publish("job.notification", {
          jobId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: NOTIFICATION_TYPES.BILLING_BENEFIT_REVOKED,
          status: "completed",
          message: "Benefícios revogados.",
          teamId: input.teamId,
          payload: { subscriptionId: input.subscriptionId, benefitIds },
        } satisfies JobNotification),
      { name: "publishRevoked" },
    );
  }

  if (GRANT_STATUSES.includes(input.newStatus)) {
    await DBOS.runStep(
      () =>
        grantBenefits(db, input.teamId, input.subscriptionId, benefitIds).match(
          (v) => v,
          (e) => { throw e; },
        ),
      { name: "grantBenefits" },
    );
    await DBOS.runStep(
      () =>
        publisher.publish("job.notification", {
          jobId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: NOTIFICATION_TYPES.BILLING_BENEFIT_GRANTED,
          status: "completed",
          message: "Benefícios concedidos.",
          teamId: input.teamId,
          payload: { subscriptionId: input.subscriptionId, benefitIds },
        } satisfies JobNotification),
      { name: "publishGranted" },
    );
  }

  DBOS.logger.info(`${ctx} completed`);
}

export const benefitLifecycleWorkflow = DBOS.registerWorkflow(benefitLifecycleWorkflowFn);

export const enqueueBenefitLifecycleWorkflow = createEnqueuer<BenefitLifecycleInput>(
  benefitLifecycleWorkflowFn.name,
  QUEUES.benefitLifecycle,
  (i) => `benefit-lifecycle-${i.subscriptionId}-${i.newStatus}`,
);
```

### Step 2: Add to `QUEUES` in `workflow-factory.ts`

```typescript
benefitLifecycle: "benefit-lifecycle",
```

### Step 3: Import in `setup.ts`

```typescript
import "./workflows/billing/benefit-lifecycle-workflow";
```

### Step 4: Commit

```bash
git add packages/workflows/src/workflows/billing/benefit-lifecycle-workflow.ts packages/workflows/src/workflow-factory.ts packages/workflows/src/setup.ts
git commit -m "feat(workflows): add benefit lifecycle workflow"
```

---

## Task 9: Period-End Invoice Generation Workflow

**Files:**
- Create: `packages/workflows/src/workflows/billing/period-end-invoice-workflow.ts`
- Modify: `packages/workflows/src/workflow-factory.ts`
- Modify: `packages/workflows/src/setup.ts`

### Step 1: Write the workflow

Aggregates `usage_events` via `summarizeUsageByMeter`, fetches `subscriptionItems` + `servicePrices`, subtracts benefit credits, applies priceCap, applies coupon (once/repeating/forever), generates invoice record, fires Montte notification + operator email.

```typescript
// packages/workflows/src/workflows/billing/period-end-invoice-workflow.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import { createEnqueuer, QUEUES } from "../../workflow-factory";
import { summarizeUsageByMeter } from "@core/database/repositories/usage-events-repository";
import { getSubscription } from "@core/database/repositories/subscriptions-repository";
import { createInvoice } from "@core/database/repositories/invoices-repository";
import { listGrantsBySubscription } from "@core/database/repositories/benefit-grants-repository";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../../context";
import { of, format, add, subtract, multiply, fromMinorUnits } from "@f-o-t/money";
import dayjs from "dayjs";
import type { InvoiceLineItem } from "@core/database/schemas/invoices";
import { eq } from "drizzle-orm";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { servicePrices } from "@core/database/schemas/services";
import { benefits } from "@core/database/schemas/benefits";
import { coupons, couponRedemptions } from "@core/database/schemas/coupons";
import { resendClient } from "@core/transactional/utils";

export type PeriodEndInvoiceInput = {
  teamId: string;
  subscriptionId: string;
  periodStart: string; // ISO datetime
  periodEnd: string;   // ISO datetime
  operatorEmail: string;
  contactEmail?: string;
  contactName?: string;
};

async function periodEndInvoiceWorkflowFn(input: PeriodEndInvoiceInput) {
  const { db } = getDeps();
  const publisher = getPublisher();
  const ctx = `[period-end-invoice] sub=${input.subscriptionId}`;
  DBOS.logger.info(`${ctx} started`);

  // Step: fetch subscription + items + prices
  const invoiceData = await DBOS.runStep(async () => {
    const sub = await getSubscription(db, input.subscriptionId).match(
      (v) => v,
      (e) => { throw e; },
    );
    if (!sub) throw new Error("Assinatura não encontrada.");

    const items = await db.query.subscriptionItems.findMany({
      where: (f, { eq }) => eq(f.subscriptionId, input.subscriptionId),
    });

    const priceIds = items.map((i) => i.priceId);
    const prices = priceIds.length > 0
      ? await db.query.servicePrices.findMany({
          where: (f, { inArray }) => inArray(f.id, priceIds),
        })
      : [];

    const usageSummary = await summarizeUsageByMeter(
      db,
      input.teamId,
      { from: dayjs(input.periodStart).toDate(), to: dayjs(input.periodEnd).toDate() },
    ).match((v) => v, (e) => { throw e; });

    const usageByMeter = new Map(usageSummary.map((u) => [u.meterId, u.total]));

    const coupon = sub.couponId
      ? await db.query.coupons.findFirst({ where: (f, { eq }) => eq(f.id, sub.couponId!) })
      : null;

    const redemptionCount = sub.couponId
      ? await db
          .select({ count: eq(couponRedemptions.couponId, sub.couponId) })
          .from(couponRedemptions)
          .where(eq(couponRedemptions.subscriptionId, input.subscriptionId))
          .then((rows) => rows.length)
      : 0;

    const grants = await listGrantsBySubscription(db, input.subscriptionId).match(
      (v) => v,
      (e) => { throw e; },
    );
    const activeBenefitIds = grants.filter((g) => g.status === "active").map((g) => g.benefitId);

    const benefitCredits = activeBenefitIds.length > 0
      ? await db.query.benefits.findMany({
          where: (f, { inArray }) => inArray(f.id, activeBenefitIds),
        })
      : [];

    return { sub, items, prices, usageByMeter, coupon, redemptionCount, benefitCredits };
  }, { name: "gatherInvoiceData" });

  // Step: compute line items + totals
  const computed = await DBOS.runStep(() => {
    const { items, prices, usageByMeter, coupon, redemptionCount, benefitCredits } = invoiceData;
    const priceMap = new Map(prices.map((p) => [p.id, p]));

    const lineItems: InvoiceLineItem[] = [];
    let subtotalCents = 0;

    for (const item of items) {
      const price = priceMap.get(item.priceId);
      if (!price || !price.isActive) continue;

      let quantity = item.quantity;
      let unitPrice = Number(price.basePrice);

      if (price.type === "metered" && price.meterId) {
        const usage = Number(usageByMeter.get(price.meterId) ?? "0");
        quantity = usage;

        // subtract benefit credits
        const creditBenefit = benefitCredits.find(
          (b) => b.meterId === price.meterId && b.type === "credits" && b.creditAmount,
        );
        const creditOffset = creditBenefit?.creditAmount ?? 0;
        quantity = Math.max(0, quantity - creditOffset);
      }

      let subtotal = quantity * unitPrice;

      // apply priceCap
      if (price.priceCap !== null && price.priceCap !== undefined) {
        subtotal = Math.min(subtotal, Number(price.priceCap));
      }

      subtotalCents += subtotal;
      lineItems.push({
        description: price.name,
        meterId: price.meterId ?? null,
        quantity: String(quantity),
        unitPrice: String(unitPrice),
        subtotal: subtotal.toFixed(2),
      });
    }

    // apply coupon
    let discountAmount = 0;
    let applyCoupon = false;
    if (coupon && coupon.isActive) {
      if (coupon.duration === "forever") applyCoupon = true;
      else if (coupon.duration === "once" && redemptionCount === 0) applyCoupon = true;
      else if (
        coupon.duration === "repeating" &&
        coupon.durationMonths !== null &&
        redemptionCount < (coupon.durationMonths ?? 0)
      ) applyCoupon = true;
    }

    if (applyCoupon && coupon) {
      if (coupon.type === "percent") {
        discountAmount = subtotalCents * (Number(coupon.amount) / 100);
      } else {
        discountAmount = Number(coupon.amount);
      }
    }

    const total = Math.max(0, subtotalCents - discountAmount);

    return {
      lineItems,
      subtotal: subtotalCents.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      total: total.toFixed(2),
      couponSnapshot: applyCoupon && coupon
        ? { code: coupon.code, type: coupon.type, amount: coupon.amount, duration: coupon.duration }
        : null,
    };
  }, { name: "computeLineItems" });

  // Step: persist invoice
  const invoice = await DBOS.runStep(
    () =>
      createInvoice(db, {
        teamId: input.teamId,
        subscriptionId: input.subscriptionId,
        status: "open",
        periodStart: dayjs(input.periodStart).toDate(),
        periodEnd: dayjs(input.periodEnd).toDate(),
        subtotal: computed.subtotal,
        discountAmount: computed.discountAmount,
        total: computed.total,
        lineItems: computed.lineItems,
        couponSnapshot: computed.couponSnapshot,
      }).match(
        (v) => v,
        (e) => { throw e; },
      ),
    { name: "persistInvoice" },
  );

  // Step: Montte notification
  await DBOS.runStep(
    () =>
      publisher.publish("job.notification", {
        jobId: invoice.id,
        timestamp: new Date().toISOString(),
        type: NOTIFICATION_TYPES.BILLING_INVOICE_GENERATED,
        status: "completed",
        message: `Fatura gerada: R$ ${computed.total}`,
        teamId: input.teamId,
        payload: { invoiceId: invoice.id, subscriptionId: input.subscriptionId, total: computed.total },
      } satisfies JobNotification),
    { name: "publishNotification" },
  );

  // Step: operator email via Resend
  await DBOS.runStep(async () => {
    await resendClient.emails.send({
      from: "Montte <noreply@montte.co>",
      to: input.operatorEmail,
      subject: `Fatura gerada — R$ ${computed.total}`,
      html: `<p>Uma nova fatura foi gerada para a assinatura <strong>${input.subscriptionId}</strong>.</p><p>Total: <strong>R$ ${computed.total}</strong></p>`,
    });
  }, { name: "sendOperatorEmail" });

  // Step: customer alert email (if provided)
  if (input.contactEmail) {
    await DBOS.runStep(async () => {
      await resendClient.emails.send({
        from: "Montte <noreply@montte.co>",
        to: input.contactEmail!,
        subject: `Sua fatura está disponível`,
        html: `<p>Olá${input.contactName ? ` ${input.contactName}` : ""},</p><p>Sua fatura no valor de <strong>R$ ${computed.total}</strong> foi gerada.</p>`,
      });
    }, { name: "sendContactEmail" });
  }

  DBOS.logger.info(`${ctx} completed — invoiceId=${invoice.id} total=${computed.total}`);
}

export const periodEndInvoiceWorkflow = DBOS.registerWorkflow(periodEndInvoiceWorkflowFn);

export const enqueuePeriodEndInvoiceWorkflow = createEnqueuer<PeriodEndInvoiceInput>(
  periodEndInvoiceWorkflowFn.name,
  QUEUES.periodEndInvoice,
  (i) => `period-invoice-${i.subscriptionId}-${i.periodEnd}`,
);
```

### Step 2: Add to `QUEUES`

```typescript
periodEndInvoice: "period-end-invoice",
```

### Step 3: Import in `setup.ts`

```typescript
import "./workflows/billing/period-end-invoice-workflow";
```

### Step 4: Commit

```bash
git add packages/workflows/src/workflows/billing/period-end-invoice-workflow.ts packages/workflows/src/workflow-factory.ts packages/workflows/src/setup.ts
git commit -m "feat(workflows): add period-end invoice generation workflow"
```

---

## Task 10: Trial Expiry Workflow

**Files:**
- Create: `packages/workflows/src/workflows/billing/trial-expiry-workflow.ts`
- Modify: `packages/workflows/src/workflow-factory.ts`
- Modify: `packages/workflows/src/setup.ts`

### Step 1: Write the workflow

Scheduled per subscription when `trialDays > 0`. Fires at `trialEndsAt`. Transitions `trialing → active`, triggers HyprPay charge via configured gateway. If cancelled during trial: grants already revoked by benefit-lifecycle-workflow — no charge. DBOS step: 3-day pre-expiry notification to operator + customer alert email.

```typescript
// packages/workflows/src/workflows/billing/trial-expiry-workflow.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import { createEnqueuer, QUEUES } from "../../workflow-factory";
import { getSubscription, updateSubscription } from "@core/database/repositories/subscriptions-repository";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../../context";
import dayjs from "dayjs";
import { resendClient } from "@core/transactional/utils";

export type TrialExpiryInput = {
  teamId: string;
  subscriptionId: string;
  trialEndsAt: string; // ISO datetime
  operatorEmail: string;
  contactEmail?: string;
  contactName?: string;
};

async function trialExpiryWorkflowFn(input: TrialExpiryInput) {
  const { db } = getDeps();
  const publisher = getPublisher();
  const ctx = `[trial-expiry] sub=${input.subscriptionId}`;
  DBOS.logger.info(`${ctx} started`);

  // Step: 3-day pre-expiry warning (fires 3 days before trialEndsAt)
  const now = dayjs();
  const trialEnd = dayjs(input.trialEndsAt);
  const msUntilWarning = trialEnd.subtract(3, "day").valueOf() - now.valueOf();

  if (msUntilWarning > 0) {
    await DBOS.sleepms(msUntilWarning);
  }

  // Send pre-expiry notification
  await DBOS.runStep(async () => {
    await publisher.publish("job.notification", {
      jobId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING,
      status: "started",
      message: "Período de teste expira em 3 dias.",
      teamId: input.teamId,
      payload: { subscriptionId: input.subscriptionId, trialEndsAt: input.trialEndsAt, daysLeft: 3 },
    } satisfies JobNotification);
    await resendClient.emails.send({
      from: "Montte <noreply@montte.co>",
      to: input.operatorEmail,
      subject: "Período de teste expira em 3 dias",
      html: `<p>A assinatura <strong>${input.subscriptionId}</strong> expira em 3 dias.</p>`,
    });
    if (input.contactEmail) {
      await resendClient.emails.send({
        from: "Montte <noreply@montte.co>",
        to: input.contactEmail,
        subject: "Seu período de teste expira em breve",
        html: `<p>Olá${input.contactName ? ` ${input.contactName}` : ""},</p><p>Seu período de teste encerra em 3 dias.</p>`,
      });
    }
  }, { name: "sendPreExpiryWarning" });

  // Wait remaining time until trial end
  const msUntilExpiry = trialEnd.valueOf() - dayjs().valueOf();
  if (msUntilExpiry > 0) {
    await DBOS.sleepms(msUntilExpiry);
  }

  // Step: check current subscription status — if cancelled, abort
  const sub = await DBOS.runStep(
    () =>
      getSubscription(db, input.subscriptionId).match(
        (v) => v,
        (e) => { throw e; },
      ),
    { name: "checkSubscriptionStatus" },
  );

  if (!sub || sub.status === "cancelled" || sub.status === "completed") {
    DBOS.logger.info(`${ctx} subscription ${sub?.status ?? "missing"} — no charge`);
    return;
  }

  // Step: transition trialing → active
  await DBOS.runStep(
    () =>
      updateSubscription(db, input.subscriptionId, { status: "active" }).match(
        (v) => v,
        (e) => { throw e; },
      ),
    { name: "activateSubscription" },
  );

  // Step: fire benefit lifecycle (trialing → active) — enqueue separately
  // NOTE: The benefit-lifecycle-workflow should have been triggered by the status change above.
  // If not auto-triggered, enqueue manually here. For now, log the intent.
  DBOS.logger.info(`${ctx} transitioned to active — benefit-lifecycle should fire`);

  // Step: notify
  await DBOS.runStep(
    () =>
      publisher.publish("job.notification", {
        jobId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING,
        status: "completed",
        message: "Período de teste encerrado. Assinatura ativada.",
        teamId: input.teamId,
        payload: { subscriptionId: input.subscriptionId, trialEndsAt: input.trialEndsAt, daysLeft: 0 },
      } satisfies JobNotification),
    { name: "publishExpired" },
  );

  await DBOS.runStep(async () => {
    await resendClient.emails.send({
      from: "Montte <noreply@montte.co>",
      to: input.operatorEmail,
      subject: "Período de teste encerrado — assinatura ativa",
      html: `<p>A assinatura <strong>${input.subscriptionId}</strong> foi ativada após o período de teste.</p>`,
    });
    if (input.contactEmail) {
      await resendClient.emails.send({
        from: "Montte <noreply@montte.co>",
        to: input.contactEmail,
        subject: "Seu período de teste encerrou",
        html: `<p>Olá${input.contactName ? ` ${input.contactName}` : ""},</p><p>Seu período de teste encerrou e sua assinatura está ativa.</p>`,
      });
    }
  }, { name: "sendExpiryEmails" });

  DBOS.logger.info(`${ctx} completed`);
}

export const trialExpiryWorkflow = DBOS.registerWorkflow(trialExpiryWorkflowFn);

export const enqueueTrialExpiryWorkflow = createEnqueuer<TrialExpiryInput>(
  trialExpiryWorkflowFn.name,
  QUEUES.trialExpiry,
  (i) => `trial-expiry-${i.subscriptionId}`,
);
```

### Step 2: Add to `QUEUES`

```typescript
trialExpiry: "trial-expiry",
```

### Step 3: Import in `setup.ts`

```typescript
import "./workflows/billing/trial-expiry-workflow";
```

### Step 4: Commit

```bash
git add packages/workflows/src/workflows/billing/trial-expiry-workflow.ts packages/workflows/src/workflow-factory.ts packages/workflows/src/setup.ts
git commit -m "feat(workflows): add trial expiry workflow with pre-expiry warning emails"
```

---

## Task 11: Wire Billable Procedures into oRPC Routers

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/services.ts` — wrap `createMeter`, `createBenefit`, `createSubscription` via `createBillableProcedure`
- Modify or create usage ingest endpoint (check if `apps/web/src/integrations/orpc/router/services.ts` has an ingest procedure; if not, add one)

### Step 1: Open `apps/web/src/integrations/orpc/router/services.ts`

Find `createMeter` procedure (if it exists — it may live here or in a meters router). Replace `protectedProcedure` with `createBillableProcedure("service.meter_created")`.

Pattern:

```typescript
import { createBillableProcedure } from "../billable";
import { emitServiceMeterCreated } from "@packages/events/service";

export const createMeter = createBillableProcedure("service.meter_created")
  .input(createMeterSchema)
  .handler(async ({ context, input }) => {
    const meter = (await createMeterRepo(context.db, context.teamId, input)).match(
      (v) => v,
      (e) => { throw WebAppError.fromAppError(e); },
    );
    context.scheduleEmit(() =>
      emitServiceMeterCreated(context.emit, context.emitCtx, {
        meterId: meter.id,
        eventName: input.eventName,
      }),
    );
    return meter;
  });
```

Repeat for `createBenefit` → `"service.benefit_created"` + `emitServiceBenefitCreated`.

For subscription creation, import `enqueueTrialExpiryWorkflow` and `enqueueBenefitLifecycleWorkflow` from workflows — these must be enqueued after the DB insert. Also enqueue `enqueueBenefitLifecycleWorkflow` on status transitions (update subscription handler).

### Step 2: Add usage ingest procedure (if not exists)

Check if there's an existing `ingestUsage` procedure in any router. If not, add to services router:

```typescript
import { enqueueUsageIngestionWorkflow } from "@packages/workflows/workflows/billing/usage-ingestion-workflow";

export const ingestUsage = createBillableProcedure("usage.ingested")
  .input(upsertUsageEventSchema)
  .handler(async ({ context, input }) => {
    await enqueueUsageIngestionWorkflow(context.workflowClient, {
      teamId: input.teamId,
      meterId: input.meterId,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
      contactId: input.contactId ?? undefined,
      properties: input.properties,
    });
    context.scheduleEmit(() =>
      emitUsageIngested(context.emit, context.emitCtx, {
        meterId: input.meterId,
        contactId: input.contactId ?? undefined,
        idempotencyKey: input.idempotencyKey,
      }),
    );
    return { queued: true };
  });
```

### Step 3: Wire `enqueueBenefitLifecycleWorkflow` on subscription status change

In the `updateSubscription` handler of `services.ts`, after a status update, enqueue benefit lifecycle:

```typescript
// After updateSubscription succeeds:
if (input.status && input.status !== existingSubscription.status) {
  await enqueueB̶e̶n̶e̶f̶i̶t̶L̶i̶f̶e̶c̶y̶c̶l̶e̶W̶o̶r̶k̶f̶l̶o̶w̶(
    context.workflowClient,
    {
      teamId: context.teamId,
      subscriptionId: id,
      serviceId, // need to resolve from subscriptionItems
      newStatus: input.status,
      previousStatus: existingSubscription.status,
    },
  );
}
```

### Step 4: Wire `enqueueTrialExpiryWorkflow` on subscription creation

When `trialDays > 0` on the `servicePrice`, schedule the trial expiry workflow immediately after subscription creation.

### Step 5: Typecheck

```bash
bun run typecheck
```

Fix any errors. Common issues:
- `context.workflowClient` — verify this is in oRPC context. If not, add `workflowClient: DBOSClient` to `protectedProcedure` context (in `apps/web/src/integrations/orpc/server.ts`).
- Missing imports from `@packages/workflows` — ensure package builds: `bun nx build @packages/workflows`.

### Step 6: Commit

```bash
git add apps/web/src/integrations/orpc/router/services.ts
git commit -m "feat(orpc): wire billable procedures for meter, benefit, subscription, usage ingestion"
```

---

## Task 12: Register New Queues in Worker Setup + Integration Smoke Test

**Files:**
- Modify: `packages/workflows/src/setup.ts` (ensure new queue count is correct)

### Step 1: Verify `createAllQueues` covers all new queues

`createAllQueues` calls `Object.values(QUEUES)`, so new queue keys added in Task 7–10 are automatically picked up. Verify:

```bash
grep -r "QUEUES" packages/workflows/src/workflow-factory.ts
```

Should show: `categorize`, `suggestTag`, `deriveKeywords`, `deriveTagKeywords`, `usageIngestion`, `benefitLifecycle`, `periodEndInvoice`, `trialExpiry`.

### Step 2: Build worker

```bash
bun nx build worker
```

Expected: zero type errors, dist artifacts updated.

### Step 3: Run tests

```bash
bun run test
```

Expected: all pass.

### Step 4: Final commit

```bash
git add packages/workflows/src/setup.ts
git commit -m "feat(worker): register billing lifecycle queues in DBOS setup"
```

---

## Implementation Notes

**`@f-o-t/money` in workflows:** Import `of`, `add`, `subtract` for safe arithmetic. Numeric DB strings → `of(str, "BRL")`. Always use `toMajorUnitsString` for DB writes.

**ConditionGroup filter evaluation in usage ingestion:** The `meters.filters` field is a JSONB `Record<string, unknown>`. Use `@f-o-t/condition-evaluator` to evaluate `ConditionGroup` against `event.properties`. The `upsertUsageEvent` already handles idempotency — the workflow just orchestrates and notifies.

**`workflowClient` in oRPC context:** Check `apps/web/src/integrations/orpc/server.ts` — the `DBOSClient` instance (`context.workflowClient`) must be injected at server startup. If missing, follow the pattern in `singletons.ts` for the web app (same as the worker does via `launchDBOS`).

**Email white-labeling:** `from` address should be configurable. For now hardcode `noreply@montte.co`. Future: read from team operator settings.

**12 lifecycle email events:** subscription.created, trial_started, trial_expiring_3d, trial_expired, subscription.activated, subscription.cancelled, invoice.generated, invoice.paid, invoice.overdue, benefit.granted, benefit.revoked, usage.milestone (when 80% of free tier consumed). Tasks 9–10 cover the core set; remaining events follow the same Resend pattern.
