# MON-185: Billing Pay-As-You-Go Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate billing to 100% pay-as-you-go: Stripe Meters as single source of truth, Redis hash per org (not per-event keys), remove materialized views and reconciliation cron, expand event catalog with all billable events from the issue spec.

**Architecture:** Redis hash `usage:{organizationId}` with field per event name for free-tier gating (fail open if Redis down). Stripe Meters bill overages. Billing UI reads Stripe API directly — no DB materialized views. Worker cron drops reconcile + refresh-views jobs.

**Tech Stack:** Drizzle ORM, ioredis, Stripe SDK, oRPC, React/Vite, node-cron, Vitest

---

## Task 1: Migrate Redis from per-event keys to hash per org

**Files:**

- Modify: `packages/events/src/credits.ts`

Currently uses separate Redis string keys `usage:{orgId}:{eventName}`. Migrate to a single Redis hash `usage:{orgId}` with fields per event name. TTL is set on the hash key itself.

**Step 1: Update `credits.ts`**

Replace the file contents with:

```typescript
import type { Redis } from "@core/redis/connection";
import { FREE_TIER_LIMITS } from "@core/stripe/constants";

function usageHashKey(organizationId: string): string {
   return `usage:${organizationId}`;
}

function msUntilEndOfMonth(): number {
   const now = new Date();
   const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
   return new Date(next.getTime() + 86_400_000).getTime() - now.getTime();
}

export async function isWithinFreeTier(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<boolean> {
   if (!redis) return true;

   const limit = FREE_TIER_LIMITS[eventName];
   if (limit === undefined) return true;

   const raw = await redis.hget(usageHashKey(organizationId), eventName);
   if (raw === null) return true;

   return Number(raw) < limit;
}

export async function incrementUsage(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<void> {
   if (!redis) return;

   const key = usageHashKey(organizationId);
   const newValue = await redis.hincrby(key, eventName, 1);

   if (newValue === 1) {
      await redis.pexpire(key, msUntilEndOfMonth());
   }
}

export async function getCurrentUsage(
   organizationId: string,
   eventName: string,
   redis?: Redis,
): Promise<{ used: number; limit: number; withinFreeTier: boolean }> {
   const limit = FREE_TIER_LIMITS[eventName] ?? 0;

   if (!redis) return { used: 0, limit, withinFreeTier: true };

   const raw = await redis.hget(usageHashKey(organizationId), eventName);
   const used = raw ? Number(raw) : 0;

   return { used, limit, withinFreeTier: used < limit };
}

export async function getAllUsage(
   organizationId: string,
   redis?: Redis,
): Promise<Record<string, number>> {
   if (!redis) return {};

   const data = await redis.hgetall(usageHashKey(organizationId));
   return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, Number(v)]),
   );
}
```

**Step 2: Commit**

```bash
git add packages/events/src/credits.ts
git commit -m "refactor(events): migrate Redis usage tracking to hash per org"
```

---

## Task 2: Update FREE_TIER_LIMITS, EVENT_PRICES, STRIPE_METER_EVENTS in constants

**Files:**

- Modify: `core/stripe/src/constants.ts`

Remove `nfe.emitted` and `document.signed` (not yet implemented). Add all new events from MON-185 spec.

**Step 1: Replace constants.ts**

```typescript
export enum AddonName {
   BOOST = "boost",
   SCALE = "scale",
   ENTERPRISE = "enterprise",
}

export const FREE_TIER_LIMITS: Record<string, number> = {
   "finance.transaction_created": 1000,
   "finance.recurring_processed": 200,
   "finance.bill_auto_generated": 100,
   "finance.statement_imported": 10,
   "finance.reconciliation_run": 10,
   "ai.keyword_derived": 100,
   "ai.chat_message": 30,
   "ai.tool_call": 50,
   "ai.whatsapp_reply": 20,
   "ai.workflow_run": 5,
   "workflow.step_executed": 200,
   "workflow.run": 50,
   "contact.created": 200,
   "crm.deal_created": 100,
   "crm.whatsapp_sent": 30,
   "crm.charge_created": 20,
   "document.created": 20,
   "inventory.item_created": 200,
   "service.created": 100,
   "coworking.checkin": 200,
   "coworking.booking_created": 100,
   "webhook.delivered": 1000,
   "webhook.received": 1000,
   "payment.subscription_billed": 10,
   "payment.processed": 10,
};

export const EVENT_PRICES: Record<string, string> = {
   "finance.transaction_created": "0.001000",
   "finance.recurring_processed": "0.002000",
   "finance.bill_auto_generated": "0.005000",
   "finance.statement_imported": "0.020000",
   "finance.reconciliation_run": "0.050000",
   "ai.keyword_derived": "0.010000",
   "ai.chat_message": "0.020000",
   "ai.tool_call": "0.030000",
   "ai.whatsapp_reply": "0.050000",
   "ai.workflow_run": "0.100000",
   "workflow.step_executed": "0.010000",
   "workflow.run": "0.020000",
   "contact.created": "0.010000",
   "crm.deal_created": "0.010000",
   "crm.whatsapp_sent": "0.030000",
   "crm.charge_created": "0.050000",
   "document.created": "0.020000",
   "inventory.item_created": "0.010000",
   "service.created": "0.010000",
   "coworking.checkin": "0.002000",
   "coworking.booking_created": "0.005000",
   "webhook.delivered": "0.000500",
   "webhook.received": "0.001000",
   "payment.subscription_billed": "0.020000",
   "payment.processed": "0.050000",
};

export const STRIPE_METER_EVENTS: Record<string, string> = {
   "finance.transaction_created": "finance_transactions",
   "finance.recurring_processed": "finance_recurring_processed",
   "finance.bill_auto_generated": "finance_bill_auto_generated",
   "finance.statement_imported": "finance_statement_imported",
   "finance.reconciliation_run": "finance_reconciliation_run",
   "ai.keyword_derived": "ai_keyword_derived",
   "ai.chat_message": "ai_chat_messages",
   "ai.tool_call": "ai_tool_calls",
   "ai.whatsapp_reply": "ai_whatsapp_replies",
   "ai.workflow_run": "ai_workflow_runs",
   "workflow.step_executed": "workflow_steps_executed",
   "workflow.run": "workflow_runs",
   "contact.created": "contact_creates",
   "crm.deal_created": "crm_deals_created",
   "crm.whatsapp_sent": "crm_whatsapp_sent",
   "crm.charge_created": "crm_charges_created",
   "document.created": "document_creates",
   "inventory.item_created": "inventory_creates",
   "service.created": "service_creates",
   "coworking.checkin": "coworking_checkins",
   "coworking.booking_created": "coworking_bookings_created",
   "webhook.delivered": "webhook_deliveries",
   "webhook.received": "webhook_received",
   "payment.subscription_billed": "payment_subscriptions_billed",
   "payment.processed": "payment_processed",
};
```

**Step 2: Commit**

```bash
git add core/stripe/src/constants.ts
git commit -m "feat(stripe): expand event catalog constants for pay-as-you-go model"
```

---

## Task 3: Remove materialized views from schema

**Files:**

- Modify: `core/database/src/schemas/event-views.ts`
- Modify: `core/database/src/schema.ts`

The billing-specific views to delete: `currentMonthUsageByCategory`, `currentMonthStorageCost`, `dailyUsageByEvent`, `currentMonthUsageByEvent`. Keep `monthlyAiUsage` and `dailyEventCounts` only if they're used outside billing — check first.

**Step 1: Check if monthlyAiUsage and dailyEventCounts are used elsewhere**

```bash
grep -r "monthlyAiUsage\|dailyEventCounts" apps/ packages/ --include="*.ts" --include="*.tsx" -l
```

If they only appear in `event-views.ts`, `refresh-views.ts`, and `reconcile.ts` → delete them too. Otherwise keep.

**Step 2: Delete the four billing materialized views from `event-views.ts`**

Remove the exports for: `dailyUsageByEvent`, `currentMonthUsageByEvent`, `currentMonthUsageByCategory`, `currentMonthStorageCost`. If `monthlyAiUsage` and `dailyEventCounts` are unused outside billing, remove those too — potentially deleting the entire file.

**Step 3: Remove the export from `core/database/src/schema.ts`**

If the file is empty after removals:

```typescript
// Remove this line from schema.ts:
export * from "@core/database/schemas/event-views";
```

If keeping some views, keep the export.

**Step 4: Commit**

```bash
git add core/database/src/schemas/event-views.ts core/database/src/schema.ts
git commit -m "feat(database): remove billing materialized views (Stripe is source of truth)"
```

---

## Task 4: Remove reconcile logic and refresh-views logic

**Files:**

- Delete: `packages/events/src/reconcile.ts`
- Delete: `packages/events/src/refresh-views.ts`
- Delete: `apps/worker/src/jobs/reconcile-credits.ts`
- Delete: `apps/worker/src/jobs/refresh-views.ts`
- Modify: `apps/worker/src/scheduler.ts`

**Step 1: Delete the four files**

```bash
rm packages/events/src/reconcile.ts
rm packages/events/src/refresh-views.ts
rm apps/worker/src/jobs/reconcile-credits.ts
rm apps/worker/src/jobs/refresh-views.ts
```

**Step 2: Update scheduler.ts**

Remove imports and the hourly billing reconciliation task. Keep `insightsTask` and `billRecurrenceTask`.

```typescript
import * as cron from "node-cron";
import type { DatabaseInstance } from "@core/database/client";
import { emitCronLog } from "@core/logging/health";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "scheduler" });
import { generateBillOccurrences } from "./jobs/generate-bill-occurrences";
import { runRefreshInsights } from "./jobs/refresh-insights";

const SERVICE_NAME = "montte-worker";

async function runWithTelemetry(
   taskName: string,
   fn: () => Promise<void>,
): Promise<void> {
   const start = Date.now();
   emitCronLog({ serviceName: SERVICE_NAME, taskName, event: "started" });
   try {
      await fn();
      emitCronLog({
         serviceName: SERVICE_NAME,
         taskName,
         event: "completed",
         durationMs: Date.now() - start,
      });
   } catch (error) {
      emitCronLog({
         serviceName: SERVICE_NAME,
         taskName,
         event: "failed",
         durationMs: Date.now() - start,
         error: error instanceof Error ? error.message : String(error),
      });
      logger.error({ err: error, taskName }, "Scheduled task failed");
   }
}

export function startScheduler(db: DatabaseInstance): cron.ScheduledTask[] {
   const tasks: cron.ScheduledTask[] = [];

   const insightsTask = cron.schedule("0 */3 * * *", async () => {
      await runWithTelemetry("insight-cache-refresh", async () => {
         await runRefreshInsights(db);
      });
   });

   const billRecurrenceTask = cron.schedule("0 6 * * *", async () => {
      await runWithTelemetry("bill-recurrence-generation", async () => {
         await generateBillOccurrences();
      });
   });

   tasks.push(insightsTask, billRecurrenceTask);
   logger.info(
      "Cron jobs registered (3-hourly insight refresh, daily bill recurrence)",
   );

   return tasks;
}
```

**Step 3: Fix scheduler call sites** — search for where `startScheduler` is called and remove the `redis` argument:

```bash
grep -r "startScheduler" apps/ --include="*.ts" -n
```

Update the call to `startScheduler(db)` (no redis param).

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(worker): remove billing reconciliation cron and materialized view refresh"
```

---

## Task 5: Update billing oRPC router to query Stripe directly

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/billing.ts`

Remove `getCurrentUsage`, `getStorageUsage`, `getCategoryUsage`, `getDailyUsage` (all rely on materialized views). Replace with `getMeterUsage` that queries Stripe Meters API for current period usage per event.

**Step 1: Replace billing router**

Keep `getInvoices`, `getUpcomingInvoice`, `getPaymentStatus`. Remove the four materialized-view-based procedures. Add new `getMeterUsage`:

```typescript
import { WebAppError } from "@core/logging/errors";
import {
   FREE_TIER_LIMITS,
   EVENT_PRICES,
   STRIPE_METER_EVENTS,
} from "@core/stripe/constants";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const getInvoices = protectedProcedure
   .input(
      z
         .object({ limit: z.number().min(1).max(100).optional().default(10) })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, stripeClient, userId } = context;
      if (!stripeClient)
         throw WebAppError.internal("Stripe client not configured");

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });
      if (!userRecord?.stripeCustomerId) return [];

      try {
         const invoices = await stripeClient.invoices.list({
            customer: userRecord.stripeCustomerId,
            limit: input?.limit ?? 10,
         });
         return invoices.data.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            amountPaid: invoice.amount_paid,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            status: invoice.status,
            created: invoice.created,
            periodStart: invoice.period_start,
            periodEnd: invoice.period_end,
            invoicePdf: invoice.invoice_pdf ?? null,
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
         }));
      } catch {
         throw WebAppError.internal("Failed to fetch invoices");
      }
   });

export const getUpcomingInvoice = protectedProcedure.handler(
   async ({ context }) => {
      const { db, stripeClient, userId } = context;
      if (!stripeClient)
         throw WebAppError.internal("Stripe client not configured");

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });
      if (!userRecord?.stripeCustomerId) return null;

      try {
         const upcoming = await stripeClient.invoices.createPreview({
            customer: userRecord.stripeCustomerId,
         });
         return {
            amountDue: upcoming.amount_due,
            currency: upcoming.currency,
            periodStart: upcoming.period_start,
            periodEnd: upcoming.period_end,
            nextPaymentAttempt: upcoming.next_payment_attempt,
            lines: upcoming.lines.data.map((line) => ({
               description: line.description,
               amount: line.amount,
               quantity: line.quantity,
            })),
         };
      } catch {
         return null;
      }
   },
);

export const getPaymentStatus = protectedProcedure.handler(
   async ({ context }) => {
      const { db, stripeClient, userId } = context;
      if (!stripeClient) return { hasPaymentMethod: false };

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });
      if (!userRecord?.stripeCustomerId) return { hasPaymentMethod: false };

      try {
         const paymentMethods = await stripeClient.paymentMethods.list({
            customer: userRecord.stripeCustomerId,
            type: "card",
            limit: 1,
         });
         return { hasPaymentMethod: paymentMethods.data.length > 0 };
      } catch {
         return { hasPaymentMethod: false };
      }
   },
);

export const getMeterUsage = protectedProcedure.handler(async ({ context }) => {
   const { db, stripeClient, userId } = context;

   if (!stripeClient) {
      return buildLocalUsageFallback();
   }

   const userRecord = await db.query.user.findFirst({
      where: (fields, { eq }) => eq(fields.id, userId),
   });

   if (!userRecord?.stripeCustomerId) {
      return buildLocalUsageFallback();
   }

   try {
      const now = Math.floor(Date.now() / 1000);
      const startOfMonth = Math.floor(
         new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
         ).getTime() / 1000,
      );

      const meterEventNames = Object.values(STRIPE_METER_EVENTS);
      const meters = await stripeClient.billing.meters.list({ limit: 100 });

      const meterByEventName = new Map(
         meters.data.map((m) => [m.event_name, m.id]),
      );

      const usageByEvent = await Promise.all(
         Object.entries(STRIPE_METER_EVENTS).map(
            async ([eventName, meterEventName]) => {
               const meterId = meterByEventName.get(meterEventName);
               if (!meterId) {
                  return {
                     eventName,
                     used: 0,
                     freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
                     pricePerEvent: EVENT_PRICES[eventName] ?? "0",
                  };
               }

               try {
                  const summary =
                     await stripeClient.billing.meters.listEventSummaries(
                        meterId,
                        {
                           customer: userRecord.stripeCustomerId!,
                           start_time: startOfMonth,
                           end_time: now,
                           value_grouping_window: "month",
                        },
                     );
                  const used = summary.data[0]?.aggregated_value ?? 0;
                  return {
                     eventName,
                     used,
                     freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
                     pricePerEvent: EVENT_PRICES[eventName] ?? "0",
                  };
               } catch {
                  return {
                     eventName,
                     used: 0,
                     freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
                     pricePerEvent: EVENT_PRICES[eventName] ?? "0",
                  };
               }
            },
         ),
      );

      return usageByEvent;
   } catch {
      throw WebAppError.internal("Failed to fetch meter usage");
   }
});

function buildLocalUsageFallback() {
   return Object.keys(FREE_TIER_LIMITS).map((eventName) => ({
      eventName,
      used: 0,
      freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
      pricePerEvent: EVENT_PRICES[eventName] ?? "0",
   }));
}
```

**Step 2: Check that the billing router is exported in the main router index**

```bash
grep -n "billing" apps/web/src/integrations/orpc/router/index.ts
```

Ensure `getMeterUsage` is wired. If procedures are exported individually and auto-collected, no changes needed.

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/billing.ts
git commit -m "feat(billing): replace materialized view queries with Stripe Meter API"
```

---

## Task 6: Update billing UI to use getMeterUsage

**Files:**

- Modify: `apps/web/src/features/billing/ui/billing-usage.tsx`
- Modify: `apps/web/src/features/billing/ui/billing-overview.tsx` (check if it uses getCurrentUsage)

**Step 1: Check billing-overview.tsx for removed procedures**

```bash
grep -n "getCurrentUsage\|getStorageUsage\|getCategoryUsage\|getDailyUsage" apps/web/src/features/billing/ui/billing-overview.tsx
```

**Step 2: Update billing-usage.tsx**

Replace the `useQuery` call for `getDailyUsage` with `getMeterUsage`. Display a table of events grouped by category with: event name, used this month, free tier limit, price per event, overage count.

Key categories to display (map from event name prefix):

- `finance.*` → "Financeiro"
- `ai.*` → "Inteligência Artificial"
- `workflow.*` → "Automações"
- `contact.*` / `crm.*` → "Contatos & CRM"
- `document.*` → "Documentos"
- `inventory.*` → "Estoque"
- `service.*` → "Serviços"
- `coworking.*` → "Coworking"
- `webhook.*` → "Webhooks"
- `payment.*` → "Pagamentos"

For each event row show:

- Event display name (from event name, humanized)
- Used / Free limit (e.g. "150 / 1.000")
- Price per event (e.g. "R$ 0,001")
- Overage units billed to Stripe (max(0, used - freeLimit))

**Step 3: Update billing-overview.tsx**

Remove calls to `getCurrentUsage`, `getStorageUsage`. Replace with `getMeterUsage`. Compute total month-to-date cost as: sum over events where used > freeTierLimit of `(used - freeTierLimit) * pricePerEvent`.

**Step 4: Commit**

```bash
git add apps/web/src/features/billing/ui/
git commit -m "feat(billing): update billing UI to use Stripe Meter data"
```

---

## Task 7: Run typecheck and fix any broken imports

After all the deletions, there will be broken imports referencing deleted procedures and views.

**Step 1: Run typecheck**

```bash
bun run typecheck 2>&1 | head -60
```

**Step 2: Fix each error**

Common errors to expect:

- Imports of `currentMonthUsageByCategory`, `currentMonthStorageCost`, `dailyUsageByEvent`, `currentMonthUsageByEvent` from `@core/database/schema` — remove usages
- Imports of `reconcileUsageCounters` from `@packages/events/reconcile` — remove
- Imports of `refreshUsageViews` from `@packages/events/refresh-views` — remove
- `orpc.billing.getCurrentUsage`, `getCategoryUsage`, `getDailyUsage`, `getStorageUsage` in UI — remove or replace
- `startScheduler` call with `redis` arg — remove redis arg

**Step 3: Repeat until clean**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve type errors after billing migration"
```

---

## Task 8: Update seed-event-catalog.ts script

**Files:**

- Modify: `scripts/seed-event-catalog.ts`

The seed script needs to include all new events from the updated `FREE_TIER_LIMITS` / `EVENT_PRICES` constants. Verify it reads from constants rather than hardcoding — if it does, it may work automatically.

**Step 1: Check the script**

```bash
cat scripts/seed-event-catalog.ts | head -80
```

**Step 2: Ensure new events are seeded**

If the script derives from `FREE_TIER_LIMITS` and `EVENT_PRICES`, it's already correct after Task 2. If hardcoded, add the missing events.

**Step 3: Commit if changes needed**

```bash
git add scripts/seed-event-catalog.ts
git commit -m "feat(scripts): seed new billable events in event catalog"
```

---

## Task 9: Run tests and fix failures

**Step 1: Run full test suite**

```bash
bun run test 2>&1 | tail -40
```

**Step 2: Fix any failing tests**

Most likely failures: tests that import removed materialized views or call removed procedures.

**Step 3: Run tests again to confirm passing**

```bash
bun run test
```

**Step 4: Commit if test files changed**

```bash
git add -A
git commit -m "fix(tests): update tests after billing migration"
```

---

## Notes

- **Do NOT create Stripe Meters** — that's a manual Stripe dashboard task (noted in issue as separate task).
- **Feature Previews page** already exists at `settings/feature-previews.tsx` — no changes needed for now. The "coming soon" events aren't in scope for this PR.
- **`ai.agent_action` rename** — old constants used `ai.agent_action`. The new spec uses `ai.tool_call`. If existing DB events use the old name, the seed script will create both. The constants file is the single source of truth going forward.
- **`nfe.emitted` / `document.signed` removal** — these are removed from FREE_TIER_LIMITS/EVENT_PRICES since they're not yet implemented. The event catalog seed may have old entries — they remain in DB but will no longer be billed.
