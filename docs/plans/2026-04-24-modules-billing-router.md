# modules/billing Router Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `modules/billing` workspace package with billing, services, and coupons routers. Add a singleton `./server` export to `@core/orpc` so modules can import `protectedProcedure` directly. `apps/web` is untouched — wiring happens in a future PR.

**Architecture:** Monorepo singletons. `@core/orpc/server` instantiates and exports `protectedProcedure`, `authenticatedProcedure`, `publicProcedure` once. Module router files import from there directly — no factories, no contracts. `@core/orpc/billable` exports `createBillableMiddleware` for credit enforcement (HyprPay scaffold). `modules/billing/src/events.ts` is the module-owned catalog of billable events sent to HyprPay.

**Tech Stack:** `@orpc/server`, `@core/orpc/server` (protectedProcedure), `@core/orpc/billable` (createBillableMiddleware), `@core/database` (schemas + repos), `@packages/events`, `@packages/workflows`, zod, drizzle-orm, neverthrow, dayjs

---

### Task 1: Add `@core/orpc/src/server.ts` singleton

Instantiate and export oRPC procedure primitives as singletons so any module in the monorepo can import them directly.

**Files:**
- Modify: `core/orpc/package.json` — add `./server` export + `@core/dbos` dep
- Modify: `core/orpc/tsconfig.json` — add `@core/dbos` path + reference
- Create: `core/orpc/src/server.ts`

**Step 1: Add `./server` export and `@core/dbos` dep to `core/orpc/package.json`**

In `"exports"`, add after `"./sdk-procedure"`:
```json
"./server": {
   "types": "./dist/server.d.ts",
   "default": "./dist/server.js"
}
```

In `"dependencies"`, add:
```json
"@core/dbos": "workspace:*"
```

**Step 2: Update `core/orpc/tsconfig.json`**

In `"paths"`, add:
```json
"@core/dbos/*": ["../../core/dbos/src/*"]
```

In `"references"`, add:
```json
{ "path": "../dbos" }
```

**Step 3: Create `core/orpc/src/server.ts`**

```typescript
import { auth } from "@core/authentication/dist/server";
import { db } from "@core/database/client";
import { env } from "@core/environment/server";
import { posthog } from "@core/posthog/server";
import { redis } from "@core/redis/connection";
import { stripeClient } from "@core/stripe";
import { createWorkflowClient } from "@core/dbos/client";
import { createJobPublisher } from "@packages/notifications/publisher";
import { createORPCProcedures } from "./procedures";

const workflowClient = createWorkflowClient(env.DATABASE_URL);
const jobPublisher = createJobPublisher(redis);

export const { publicProcedure, authenticatedProcedure, protectedProcedure } =
   createORPCProcedures({
      auth,
      db,
      posthog,
      redis,
      stripeClient,
      workflowClient,
      jobPublisher,
   });
```

> **Note:** `@core/authentication` uses `dist/*` path (composite: false — cannot be a project reference). Check `core/orpc/tsconfig.json` — the path is already `"@core/authentication/*": ["../../core/authentication/dist/*"]`. Import as `@core/authentication/dist/server` or check what the dist export path is. If `@core/authentication` has a `./server` export pointing to `dist/server.js`, use `@core/authentication/server` directly.

> **Note:** Check `core/environment/src/server.ts` to find the correct env var name for the database URL (may be `DATABASE_URL`, `POSTGRES_URL`, or similar).

**Step 4: Build**

```bash
cd core/orpc && bun run build
```

Expected: success.

**Step 5: Commit**

```bash
git add core/orpc/src/server.ts core/orpc/package.json core/orpc/tsconfig.json
git commit -m "feat(core/orpc): add singleton server export with protectedProcedure"
```

---

### Task 2: Add `createBillableMiddleware` to `@core/orpc/billable`

Cross-cutting billing middleware. Takes a `BillableEvent` from the module's events catalog. Provides `scheduleEmit` + `emitCtx` on handler context. HyprPay enforcement is wired here — scaffold for now.

**Files:**
- Modify: `core/orpc/package.json` — add `./billable` export
- Create: `core/orpc/src/billable.ts`

**Step 1: Add `./billable` export to `core/orpc/package.json`**

In `"exports"`, add after `"./server"`:
```json
"./billable": {
   "types": "./dist/billable.d.ts",
   "default": "./dist/billable.js"
}
```

No new deps needed — `@orpc/server` already in `@core/orpc`.

**Step 2: Create `core/orpc/src/billable.ts`**

```typescript
import { ORPCError, os } from "@orpc/server";
import type { ORPCContextWithOrganization } from "./context";

export type BillableEvent = {
   name: string;
   freeTierLimit: number;
};

export type EmitCtx = {
   organizationId: string;
   teamId?: string;
   userId?: string;
};

export type BillableContextExtension = {
   emitCtx: EmitCtx;
   scheduleEmit: (fn: () => Promise<void>) => void;
};

export function createBillableMiddleware(event: BillableEvent) {
   return os.$context<ORPCContextWithOrganization>().middleware(
      async ({ context, next }) => {
         // TODO: enforce via HyprPay once plugin is configured
         // HyprPay checks free-tier limits and gates access here
         void event;

         const emitCtx: EmitCtx = {
            organizationId: context.organizationId,
            teamId: context.teamId,
            userId: context.userId,
         };

         let pendingEmit: (() => Promise<void>) | null = null;

         const result = await next({
            context: {
               emitCtx,
               scheduleEmit: (fn: () => Promise<void>) => {
                  pendingEmit = fn;
               },
            },
         });

         if (pendingEmit) {
            try {
               await pendingEmit();
            } catch {
               // emit failure must not roll back the already-committed mutation
            }
         }

         return result;
      },
   );
}
```

**Step 3: Build**

```bash
cd core/orpc && bun run build
```

Expected: success.

**Step 4: Commit**

```bash
git add core/orpc/src/billable.ts core/orpc/package.json
git commit -m "feat(core/orpc): add createBillableMiddleware to @core/orpc/billable"
```

---

### Task 3: Scaffold `modules/billing` package

**Files:**
- Create: `modules/billing/package.json`
- Create: `modules/billing/tsconfig.json`
- Modify: `tsconfig.json` (root)

**Step 1: Create `modules/billing/package.json`**

```json
{
   "name": "@modules/billing",
   "version": "0.1.0",
   "private": true,
   "license": "Apache-2.0",
   "type": "module",
   "exports": {
      "./router": {
         "types": "./dist/router/index.d.ts",
         "default": "./dist/router/index.js"
      },
      "./events": {
         "types": "./dist/events.d.ts",
         "default": "./dist/events.js"
      }
   },
   "scripts": {
      "build": "tsc --build",
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "test": "vitest run --passWithNoTests",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/database": "workspace:*",
      "@core/logging": "workspace:*",
      "@core/orpc": "workspace:*",
      "@core/stripe": "workspace:*",
      "@orpc/server": "catalog:orpc",
      "@packages/events": "workspace:*",
      "@packages/workflows": "workspace:*",
      "dayjs": "catalog:ui",
      "drizzle-orm": "catalog:database",
      "neverthrow": "catalog:validation",
      "zod": "catalog:validation"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "typescript": "catalog:development"
   }
}
```

**Step 2: Create `modules/billing/tsconfig.json`**

```json
{
   "extends": "@tooling/typescript/tsconfig.package.json",
   "compilerOptions": {
      "paths": {
         "@core/database": ["../../core/database/src/index.ts"],
         "@core/database/*": ["../../core/database/src/*"],
         "@core/logging": ["../../core/logging/src/logger.ts"],
         "@core/logging/*": ["../../core/logging/src/*"],
         "@core/orpc/*": ["../../core/orpc/src/*"],
         "@core/stripe": ["../../core/stripe/src/index.ts"],
         "@core/stripe/*": ["../../core/stripe/src/*"],
         "@packages/events/*": ["../../packages/events/src/*"],
         "@packages/workflows/*": ["../../packages/workflows/src/*"]
      }
   },
   "references": [
      { "path": "../../core/database" },
      { "path": "../../core/logging" },
      { "path": "../../core/orpc" },
      { "path": "../../core/stripe" },
      { "path": "../../packages/events" },
      { "path": "../../packages/workflows" }
   ],
   "include": ["src"]
}
```

**Step 3: Add to root `tsconfig.json` references**

After `{ "path": "./core/dbos" }`:
```json
{
   "path": "./modules/billing"
}
```

**Step 4: Create directory structure**

```bash
mkdir -p modules/billing/src/router
```

**Step 5: Commit**

```bash
git add modules/billing/package.json modules/billing/tsconfig.json tsconfig.json
git commit -m "feat(modules/billing): scaffold package"
```

---

### Task 4: `modules/billing/src/events.ts` — billable events catalog

The billing module owns the catalog of events it reports to HyprPay. This is the single source of truth for event names and free-tier limits — referenced by the router when applying the billable middleware.

**Files:**
- Create: `modules/billing/src/events.ts`

**Step 1: Create the file**

```typescript
import type { BillableEvent } from "@core/orpc/billable";

export const BILLING_EVENTS = {
   subscriptionCreated: {
      name: "subscription.created",
      freeTierLimit: 50,
   },
   usageIngested: {
      name: "usage.ingested",
      freeTierLimit: 1000,
   },
   meterCreated: {
      name: "service.meter_created",
      freeTierLimit: 10,
   },
   benefitCreated: {
      name: "service.benefit_created",
      freeTierLimit: 20,
   },
} as const satisfies Record<string, BillableEvent>;
```

**Step 2: Build**

```bash
cd modules/billing && bun run build
```

**Step 3: Commit**

```bash
git add modules/billing/src/events.ts
git commit -m "feat(modules/billing): add billable events catalog"
```

---

### Task 5: `modules/billing/src/router/billing.ts`

Port `apps/web/src/integrations/orpc/router/billing.ts`. Import `protectedProcedure` from `@core/orpc/server`. Logic is identical.

**Files:**
- Create: `modules/billing/src/router/billing.ts`

**Step 1: Create the file**

```typescript
import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { WebAppError } from "@core/logging/errors";
import {
   EVENT_PRICES,
   FREE_TIER_LIMITS,
   STRIPE_METER_EVENTS,
} from "@core/stripe/constants";
import { getAllUsage } from "@packages/events/credits";
import { protectedProcedure } from "@core/orpc/server";
import { z } from "zod";

function buildUsageFallback() {
   return Object.keys(FREE_TIER_LIMITS).map((eventName) => ({
      eventName,
      used: 0,
      freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
      pricePerEvent: EVENT_PRICES[eventName] ?? "0",
   }));
}

export const getInvoices = protectedProcedure
   .input(
      z
         .object({ limit: z.number().min(1).max(100).optional().default(10) })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, stripeClient, userId } = context;
      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });
      if (!userRecord?.stripeCustomerId) return [];
      const result = await fromPromise(
         stripeClient.invoices.list({
            customer: userRecord.stripeCustomerId,
            limit: input?.limit ?? 10,
         }),
         () => WebAppError.internal("Failed to fetch invoices"),
      );
      return result.match(
         (invoices) =>
            invoices.data.map((invoice) => ({
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
            })),
         (e) => {
            throw e;
         },
      );
   });

export const getUpcomingInvoice = protectedProcedure.handler(
   async ({ context }) => {
      const { db, stripeClient, userId } = context;
      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });
      if (!userRecord?.stripeCustomerId) return null;
      const result = await fromPromise(
         stripeClient.invoices.createPreview({
            customer: userRecord.stripeCustomerId,
         }),
         () => null,
      );
      return result.match(
         (upcoming) => ({
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
         }),
         () => null,
      );
   },
);

export const getPaymentStatus = protectedProcedure.handler(
   async ({ context }) => {
      const { db, stripeClient, userId } = context;
      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });
      if (!userRecord?.stripeCustomerId) return { hasPaymentMethod: false };
      const result = await fromPromise(
         stripeClient.paymentMethods.list({
            customer: userRecord.stripeCustomerId,
            type: "card",
            limit: 1,
         }),
         () => null,
      );
      return result.match(
         (paymentMethods) => ({
            hasPaymentMethod: paymentMethods.data.length > 0,
         }),
         () => ({ hasPaymentMethod: false }),
      );
   },
);

export const getMeterUsage = protectedProcedure.handler(async ({ context }) => {
   const { db, stripeClient, userId } = context;
   const userRecord = await db.query.user.findFirst({
      where: (fields, { eq }) => eq(fields.id, userId),
   });
   if (!userRecord?.stripeCustomerId) return buildUsageFallback();

   const now = Math.floor(Date.now() / 1000);
   const startOfMonth = Math.floor(dayjs().startOf("month").valueOf() / 1000);

   const metersResult = await fromPromise(
      stripeClient.billing.meters.list({ limit: 100 }),
      () => WebAppError.internal("Failed to fetch meter usage"),
   );
   if (metersResult.isErr()) throw metersResult.error;

   const meterByEventName = new Map(
      metersResult.value.data.map((m) => [m.event_name, m.id]),
   );

   const entries = Object.entries(STRIPE_METER_EVENTS);
   const concurrency = 5;
   const results: Array<{
      eventName: string;
      used: number;
      freeTierLimit: number;
      pricePerEvent: string;
   }> = [];

   for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
         batch.map(async ([eventName, meterEventName]) => {
            const meterId = meterByEventName.get(meterEventName);
            if (!meterId) {
               return {
                  eventName,
                  used: 0,
                  freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
                  pricePerEvent: EVENT_PRICES[eventName] ?? "0",
               };
            }
            const summary =
               await stripeClient.billing.meters.listEventSummaries(meterId, {
                  customer: userRecord.stripeCustomerId!,
                  start_time: startOfMonth,
                  end_time: now,
                  value_grouping_window: "day",
                  limit: 31,
               });
            const used = summary.data.reduce(
               (sum, s) => sum + s.aggregated_value,
               0,
            );
            return {
               eventName,
               used,
               freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
               pricePerEvent: EVENT_PRICES[eventName] ?? "0",
            };
         }),
      );
      for (const [j, result] of batchResults.entries()) {
         const eventName = batch[j]![0];
         if (result.status === "rejected") {
            results.push({
               eventName,
               used: 0,
               freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
               pricePerEvent: EVENT_PRICES[eventName] ?? "0",
            });
         } else {
            results.push(result.value);
         }
      }
   }
   return results;
});

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      const { db } = context;
      const result = await fromPromise(
         db
            .select()
            .from(eventCatalog)
            .orderBy(eventCatalog.category, eventCatalog.displayName),
         () => WebAppError.internal("Failed to fetch event catalog"),
      );
      return result.match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      );
   },
);

export const getUsageSummary = protectedProcedure.handler(
   async ({ context }) => {
      const { db, redis, organizationId, userId } = context;
      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });
      const stripeCustomerId = userRecord?.stripeCustomerId ?? null;
      const usageMap = await getAllUsage(organizationId, redis);
      return Object.entries(FREE_TIER_LIMITS).map(
         ([eventName, freeTierLimit]) => {
            const used = usageMap[eventName] ?? 0;
            return {
               eventName,
               used,
               freeTierLimit,
               pricePerEvent: EVENT_PRICES[eventName] ?? "0",
               overageEnabled: !!stripeCustomerId,
               withinFreeTier: used < freeTierLimit,
            };
         },
      );
   },
);
```

**Step 2: Build**

```bash
cd modules/billing && bun run build
```

**Step 3: Commit**

```bash
git add modules/billing/src/router/billing.ts
git commit -m "feat(modules/billing): add billing router"
```

---

### Task 6: `modules/billing/src/router/coupons.ts`

Port `apps/web/src/integrations/orpc/router/coupons.ts`.

**Files:**
- Create: `modules/billing/src/router/coupons.ts`

**Step 1: Create the file**

```typescript
import { WebAppError } from "@core/logging/errors";
import {
   createCouponSchema,
   updateCouponSchema,
} from "@core/database/schemas/coupons";
import {
   createCoupon,
   ensureCouponOwnership,
   getCoupon,
   getCouponByCode,
   listCoupons,
   updateCoupon,
} from "@core/database/repositories/coupons-repository";
import { protectedProcedure } from "@core/orpc/server";
import { z } from "zod";
import dayjs from "dayjs";

export const list = protectedProcedure.handler(async ({ context }) =>
   (await listCoupons(context.db, context.teamId)).match(
      (value) => value,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   ),
);

export const get = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      (
         await ensureCouponOwnership(context.db, input.id, context.teamId)
      ).match(
         () => {},
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return (await getCoupon(context.db, input.id)).match(
         (value) => value,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const create = protectedProcedure
   .input(createCouponSchema)
   .handler(async ({ context, input }) =>
      (await createCoupon(context.db, context.teamId, input)).match(
         (value) => value,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(updateCouponSchema))
   .handler(async ({ context, input }) => {
      (
         await ensureCouponOwnership(context.db, input.id, context.teamId)
      ).match(
         () => {},
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      const { id, ...data } = input;
      return (await updateCoupon(context.db, id, data)).match(
         (value) => value,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const deactivate = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      (
         await ensureCouponOwnership(context.db, input.id, context.teamId)
      ).match(
         () => {},
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return (
         await updateCoupon(context.db, input.id, { isActive: false })
      ).match(
         (value) => value,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const validate = protectedProcedure
   .input(
      z.object({
         code: z.string().min(1),
         priceId: z.string().uuid().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await getCouponByCode(
         context.db,
         context.teamId,
         input.code,
      );
      if (result.isErr()) throw WebAppError.fromAppError(result.error);

      const coupon = result.value;
      if (!coupon) return { valid: false as const, reason: "not_found" as const };
      if (!coupon.isActive)
         return { valid: false as const, reason: "inactive" as const };
      if (coupon.redeemBy && dayjs().isAfter(dayjs(coupon.redeemBy)))
         return { valid: false as const, reason: "expired" as const };
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
         return { valid: false as const, reason: "max_uses_reached" as const };
      if (
         coupon.scope === "price" &&
         input.priceId &&
         coupon.priceId !== input.priceId
      )
         return { valid: false as const, reason: "scope_mismatch" as const };

      return {
         valid: true as const,
         coupon: {
            id: coupon.id,
            code: coupon.code,
            type: coupon.type,
            amount: coupon.amount,
            duration: coupon.duration,
            durationMonths: coupon.durationMonths,
            scope: coupon.scope,
            priceId: coupon.priceId ?? null,
         },
      };
   });
```

**Step 2: Build**

```bash
cd modules/billing && bun run build
```

**Step 3: Commit**

```bash
git add modules/billing/src/router/coupons.ts
git commit -m "feat(modules/billing): add coupons router"
```

---

### Task 7: `modules/billing/src/router/services.ts`

Port `apps/web/src/integrations/orpc/router/services.ts`. Billable procedures apply `createBillableMiddleware` using events from `BILLING_EVENTS`.

**Files:**
- Create: `modules/billing/src/router/services.ts`

**Step 1: Create the file**

```typescript
import { ensureContactOwnership } from "@core/database/repositories/contacts-repository";
import {
   createBenefit as createBenefitRepo,
   updateBenefit,
   deleteBenefit,
   ensureBenefitOwnership,
   attachBenefitToService,
   detachBenefitFromService,
   listBenefitsByService,
} from "@core/database/repositories/benefits-repository";
import {
   createMeter as createMeterRepo,
   listMeters,
   updateMeter,
   deleteMeter,
   ensureMeterOwnership,
} from "@core/database/repositories/meters-repository";
import {
   addSubscriptionItem,
   updateSubscriptionItemQuantity,
   removeSubscriptionItem,
   listSubscriptionItems,
   ensureSubscriptionItemOwnership,
} from "@core/database/repositories/subscription-items-repository";
import {
   bulkCreateServices,
   createService,
   createPrice as createVariantRepo,
   deleteService,
   deletePrice as deleteVariant,
   ensureServiceOwnership,
   ensurePriceOwnership as ensureVariantOwnership,
   listServices,
   listPricesByService as listVariantsByService,
   updateService,
   updatePrice as updateVariantRepo,
} from "@core/database/repositories/services-repository";
import {
   createSubscription as createSubscriptionRepo,
   ensureSubscriptionOwnership,
   listExpiringSoon,
   listSubscriptionsByContact,
   listSubscriptionsByTeam,
   updateSubscription,
} from "@core/database/repositories/subscriptions-repository";
import {
   createBenefitSchema,
   benefits,
   serviceBenefits,
   updateBenefitSchema,
} from "@core/database/schemas/benefits";
import { createMeterSchema, updateMeterSchema } from "@core/database/schemas/meters";
import {
   createSubscriptionItemSchema,
   updateSubscriptionItemSchema,
   subscriptionItems,
} from "@core/database/schemas/subscription-items";
import {
   createServiceSchema,
   updateServiceSchema,
   createPriceSchema as createVariantSchema,
   updatePriceSchema as updateVariantSchema,
   servicePrices,
} from "@core/database/schemas/services";
import {
   contactSubscriptions,
   createSubscriptionSchema,
} from "@core/database/schemas/subscriptions";
import { upsertUsageEventSchema } from "@core/database/schemas/usage-events";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { createBillableMiddleware } from "@core/orpc/billable";
import {
   emitServiceBenefitCreated,
   emitServiceMeterCreated,
   emitSubscriptionCreated,
   emitUsageIngested,
} from "@packages/events/service";
import { enqueueUsageIngestionWorkflow } from "@packages/workflows/workflows/billing/usage-ingestion-workflow";
import { eq, and, sum, sql, count, asc } from "drizzle-orm";
import { z } from "zod";
import { BILLING_EVENTS } from "../events";

const idSchema = z.object({ id: z.string().uuid() });

export const getAll = protectedProcedure
   .input(
      z
         .object({
            search: z.string().optional(),
            categoryId: z.string().uuid().optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) =>
      (await listServices(context.db, context.teamId, input)).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) =>
      (await createService(context.db, context.teamId, input)).match(
         (service) => service,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const bulkCreate = protectedProcedure
   .input(z.object({ items: z.array(createServiceSchema).min(1) }))
   .handler(async ({ context, input }) => {
      const inserted = (
         await bulkCreateServices(context.db, context.teamId, input.items)
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      if (inserted.length === 0)
         throw WebAppError.internal("Falha ao importar os serviços.");
      return inserted;
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateServiceSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureServiceOwnership(context.db, id, context.teamId).andThen(
            () => updateService(context.db, id, data),
         )
      ).match(
         (service) => service,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteService(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const exportAll = protectedProcedure.handler(async ({ context }) =>
   (await listServices(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   ),
);

export const getVariants = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         ).andThen(() => listVariantsByService(context.db, input.serviceId))
      ).match(
         (variants) => variants,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const createVariant = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }).merge(createVariantSchema))
   .handler(async ({ context, input }) => {
      const { serviceId, ...variantData } = input;
      if (input.type === "metered") {
         if (!input.meterId)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
      }
      return (
         await ensureServiceOwnership(
            context.db,
            serviceId,
            context.teamId,
         ).andThen(() =>
            createVariantRepo(context.db, context.teamId, serviceId, variantData),
         )
      ).match(
         (variant) => variant,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const updateVariant = protectedProcedure
   .input(idSchema.merge(updateVariantSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (input.type === "metered") {
         if (input.meterId === null || input.meterId === undefined)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (input.basePrice !== undefined && Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
      }
      return (
         await ensureVariantOwnership(context.db, id, context.teamId).andThen(
            () => updateVariantRepo(context.db, id, data),
         )
      ).match(
         (variant) => variant,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeVariant = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureVariantOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteVariant(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getAllSubscriptions = protectedProcedure
   .input(
      z
         .object({
            status: z.enum(["active", "completed", "cancelled"]).optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) =>
      (
         await listSubscriptionsByTeam(context.db, context.teamId, input?.status)
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getContactSubscriptions = protectedProcedure
   .input(z.object({ contactId: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureContactOwnership(
            context.db,
            input.contactId,
            context.teamId,
         ).andThen(() =>
            listSubscriptionsByContact(context.db, input.contactId),
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const createSubscription = protectedProcedure
   .use(createBillableMiddleware(BILLING_EVENTS.subscriptionCreated))
   .input(
      createSubscriptionSchema
         .pick({ contactId: true, startDate: true, endDate: true, notes: true })
         .extend({
            items: z
               .array(createSubscriptionItemSchema.omit({ subscriptionId: true }))
               .optional(),
         }),
   )
   .handler(async ({ context, input }) => {
      const sub = (
         await ensureContactOwnership(
            context.db,
            input.contactId,
            context.teamId,
         ).andThen(() =>
            createSubscriptionRepo(context.db, context.teamId, {
               ...input,
               source: "manual",
               cancelAtPeriodEnd: false,
            }),
         )
      ).match(
         (s) => s,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );

      if (input.items && input.items.length > 0) {
         const itemResults = await Promise.allSettled(
            input.items.map((item) =>
               addSubscriptionItem(context.db, context.teamId, {
                  ...item,
                  subscriptionId: sub.id,
               }),
            ),
         );
         if (itemResults.filter((r) => r.status === "rejected").length > 0)
            throw WebAppError.internal("Falha ao adicionar itens à assinatura.");
      }

      context.scheduleEmit(() =>
         emitSubscriptionCreated(context.emitCtx, {
            subscriptionId: sub.id,
            contactId: sub.contactId,
         }),
      );

      return sub;
   });

export const cancelSubscription = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const subscription = (
         await ensureSubscriptionOwnership(context.db, input.id, context.teamId)
      ).match(
         (sub) => sub,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );

      if (!["active", "trialing", "incomplete"].includes(subscription.status))
         throw WebAppError.badRequest(
            "Apenas assinaturas ativas, em trial ou incompletas podem ser canceladas.",
         );
      if (subscription.source === "asaas")
         throw WebAppError.badRequest(
            "Assinaturas do Asaas não podem ser canceladas aqui.",
         );

      return (
         await updateSubscription(context.db, input.id, { status: "cancelled" })
      ).match(
         (cancelled) => cancelled,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getExpiringSoon = protectedProcedure
   .input(
      z
         .object({
            status: z.enum(["active", "trialing"]).optional().default("active"),
         })
         .optional(),
   )
   .handler(async ({ context, input }) =>
      (
         await listExpiringSoon(
            context.db,
            context.teamId,
            undefined,
            input?.status,
         )
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const createMeter = protectedProcedure
   .use(createBillableMiddleware(BILLING_EVENTS.meterCreated))
   .input(createMeterSchema)
   .handler(async ({ context, input }) => {
      const meter = (
         await createMeterRepo(context.db, context.teamId, input)
      ).match(
         (m) => m,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      context.scheduleEmit(() =>
         emitServiceMeterCreated(context.emitCtx, {
            meterId: meter.id,
            eventName: meter.eventName,
         }),
      );
      return meter;
   });

export const createBenefit = protectedProcedure
   .use(createBillableMiddleware(BILLING_EVENTS.benefitCreated))
   .input(createBenefitSchema)
   .handler(async ({ context, input }) => {
      const benefit = (
         await createBenefitRepo(context.db, context.teamId, input)
      ).match(
         (b) => b,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      context.scheduleEmit(() =>
         emitServiceBenefitCreated(context.emitCtx, {
            benefitId: benefit.id,
            name: benefit.name,
         }),
      );
      return benefit;
   });

export const ingestUsage = protectedProcedure
   .use(createBillableMiddleware(BILLING_EVENTS.usageIngested))
   .input(upsertUsageEventSchema)
   .handler(async ({ context, input }) => {
      if (input.teamId !== context.teamId)
         throw WebAppError.forbidden(
            "Você não tem permissão para registrar uso neste time.",
         );

      await enqueueUsageIngestionWorkflow(context.workflowClient, {
         teamId: input.teamId,
         meterId: input.meterId,
         quantity: input.quantity,
         idempotencyKey: input.idempotencyKey,
         contactId: input.contactId ?? undefined,
         properties: input.properties,
      });

      context.scheduleEmit(() =>
         emitUsageIngested(context.emitCtx, {
            meterId: input.meterId,
            contactId: input.contactId ?? undefined,
            idempotencyKey: input.idempotencyKey,
         }),
      );

      return { queued: true as const };
   });

export const getMrr = protectedProcedure.handler(async ({ context }) => {
   const rows = await context.db
      .select({
         total: sum(
            sql<string>`
  CASE ${servicePrices.interval}
    WHEN 'monthly' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric
    WHEN 'annual' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric / 12
    ELSE 0::numeric
  END
`,
         ),
      })
      .from(subscriptionItems)
      .innerJoin(servicePrices, eq(subscriptionItems.priceId, servicePrices.id))
      .innerJoin(
         contactSubscriptions,
         eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
      )
      .where(
         and(
            eq(subscriptionItems.teamId, context.teamId),
            eq(contactSubscriptions.status, "active"),
         ),
      );
   return { mrr: rows[0]?.total ?? "0" };
});

export const getMeters = protectedProcedure.handler(async ({ context }) =>
   (await listMeters(context.db, context.teamId)).match(
      (rows) => rows,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   ),
);

export const getMeterById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (await ensureMeterOwnership(context.db, input.id, context.teamId)).match(
         (meter) => meter,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const updateMeterById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(updateMeterSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureMeterOwnership(context.db, id, context.teamId).andThen(
            () => updateMeter(context.db, id, data),
         )
      ).match(
         (meter) => meter,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeMeter = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureMeterOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteMeter(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getBenefits = protectedProcedure.handler(async ({ context }) => {
   const rows = await context.db
      .select({
         id: benefits.id,
         teamId: benefits.teamId,
         name: benefits.name,
         type: benefits.type,
         meterId: benefits.meterId,
         creditAmount: benefits.creditAmount,
         description: benefits.description,
         isActive: benefits.isActive,
         createdAt: benefits.createdAt,
         updatedAt: benefits.updatedAt,
         usedInServices: count(serviceBenefits.serviceId),
      })
      .from(benefits)
      .leftJoin(serviceBenefits, eq(benefits.id, serviceBenefits.benefitId))
      .where(eq(benefits.teamId, context.teamId))
      .groupBy(benefits.id)
      .orderBy(asc(benefits.name));
   return rows;
});

export const getBenefitById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureBenefitOwnership(context.db, input.id, context.teamId)
      ).match(
         (benefit) => benefit,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const updateBenefitById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(updateBenefitSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureBenefitOwnership(context.db, id, context.teamId).andThen(
            () => updateBenefit(context.db, id, data),
         )
      ).match(
         (benefit) => benefit,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeBenefit = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureBenefitOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteBenefit(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const attachBenefit = protectedProcedure
   .input(
      z.object({
         serviceId: z.string().uuid(),
         benefitId: z.string().uuid(),
      }),
   )
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         )
            .andThen(() =>
               ensureBenefitOwnership(
                  context.db,
                  input.benefitId,
                  context.teamId,
               ),
            )
            .andThen(() =>
               attachBenefitToService(
                  context.db,
                  input.serviceId,
                  input.benefitId,
               ),
            )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const detachBenefit = protectedProcedure
   .input(
      z.object({
         serviceId: z.string().uuid(),
         benefitId: z.string().uuid(),
      }),
   )
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         ).andThen(() =>
            detachBenefitFromService(
               context.db,
               input.serviceId,
               input.benefitId,
            ),
         )
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getServiceBenefits = protectedProcedure
   .input(z.object({ serviceId: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureServiceOwnership(
            context.db,
            input.serviceId,
            context.teamId,
         ).andThen(() => listBenefitsByService(context.db, input.serviceId))
      ).match(
         (rows) => rows,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const getActiveCountByPrice = protectedProcedure
   .input(z.object({ priceId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const rows = await context.db
         .select({ count: count() })
         .from(subscriptionItems)
         .innerJoin(
            contactSubscriptions,
            eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
         )
         .where(
            and(
               eq(subscriptionItems.priceId, input.priceId),
               eq(subscriptionItems.teamId, context.teamId),
               eq(contactSubscriptions.status, "active"),
            ),
         );
      return { count: rows[0]?.count ?? 0 };
   });

export const addItem = protectedProcedure
   .input(createSubscriptionItemSchema)
   .handler(async ({ context, input }) =>
      (
         await ensureSubscriptionOwnership(
            context.db,
            input.subscriptionId,
            context.teamId,
         ).andThen(() => addSubscriptionItem(context.db, context.teamId, input))
      ).match(
         (item) => item,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const updateItem = protectedProcedure
   .input(
      z.object({ id: z.string().uuid() }).merge(updateSubscriptionItemSchema),
   )
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureSubscriptionItemOwnership(
            context.db,
            id,
            context.teamId,
         ).andThen(() => updateSubscriptionItemQuantity(context.db, id, data))
      ).match(
         (item) => item,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const removeItem = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureSubscriptionItemOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => removeSubscriptionItem(context.db, input.id))
      ).match(
         () => ({ success: true as const }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );

export const listItems = protectedProcedure
   .input(z.object({ subscriptionId: z.string().uuid() }))
   .handler(async ({ context, input }) =>
      (
         await ensureSubscriptionOwnership(
            context.db,
            input.subscriptionId,
            context.teamId,
         ).andThen(() =>
            listSubscriptionItems(context.db, input.subscriptionId),
         )
      ).match(
         (items) => items,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      ),
   );
```

> **Note on emit signatures:** `emitSubscriptionCreated`, `emitServiceMeterCreated`, `emitServiceBenefitCreated`, `emitUsageIngested` in the current `apps/web` code take `(emit, emitCtx, payload)`. After the billable middleware refactor, `emitCtx` comes from context. Check the actual function signatures in `packages/events/src/service.ts` before writing — adapt the call site accordingly.

> **Note on schema paths:** `subscriptionItems` is in `@core/database/schemas/subscription-items`, `contactSubscriptions` + `createSubscriptionSchema` in `@core/database/schemas/subscriptions`, `servicePrices` + service schemas in `@core/database/schemas/services`. Verify exact exports before importing.

**Step 2: Build**

```bash
cd modules/billing && bun run build
```

Expected: success.

**Step 3: Commit**

```bash
git add modules/billing/src/router/services.ts
git commit -m "feat(modules/billing): add services router"
```

---

### Task 8: `modules/billing/src/router/index.ts`

Re-export everything. Shape matches existing `apps/web` router keys exactly so future wiring is a one-line swap.

**Files:**
- Create: `modules/billing/src/router/index.ts`

**Step 1: Create the file**

```typescript
export * as billing from "./billing";
export * as coupons from "./coupons";
export * as services from "./services";
```

**Step 2: Build**

```bash
cd modules/billing && bun run build
```

**Step 3: Full typecheck**

```bash
bun run typecheck
```

Expected: success.

**Step 4: Commit**

```bash
git add modules/billing/src/router/index.ts
git commit -m "feat(modules/billing): assemble and export billing module router"
```

---

## Schema import reference

| Symbol | Import path |
|---|---|
| `subscriptionItems`, `createSubscriptionItemSchema`, `updateSubscriptionItemSchema` | `@core/database/schemas/subscription-items` |
| `contactSubscriptions`, `createSubscriptionSchema` | `@core/database/schemas/subscriptions` |
| `servicePrices`, `createServiceSchema`, `updateServiceSchema`, `createPriceSchema`, `updatePriceSchema` | `@core/database/schemas/services` |
| `benefits`, `serviceBenefits`, `createBenefitSchema`, `updateBenefitSchema` | `@core/database/schemas/benefits` |
| `createMeterSchema`, `updateMeterSchema` | `@core/database/schemas/meters` |
| `createCouponSchema`, `updateCouponSchema` | `@core/database/schemas/coupons` |
| `upsertUsageEventSchema` | `@core/database/schemas/usage-events` |

If a schema file doesn't export what you expect, read it directly before writing the import.
