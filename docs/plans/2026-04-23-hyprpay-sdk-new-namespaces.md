# HyprPay SDK — New Namespaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `subscriptions`, `usage`, `benefits`, `coupons`, and `customerPortal` namespaces to `@montte/hyprpay` SDK, backed by new oRPC procedures under `/api/sdk/hyprpay`.

**Architecture:** Contract-first with `@orpc/contract` in `libraries/hyprpay/src/contract.ts` → implemented in `apps/web/src/integrations/orpc/sdk/router/hyprpay/` (split into sub-files per namespace) → wired into `hyprpay.ts` router → client methods added to `libraries/hyprpay/src/client.ts`. The SDK route already exists at `/api/sdk/$`. Usage.ingest enqueues the existing `usageIngestionWorkflow` via `workflowClient` — the SDK handler context must be extended to carry it.

**Tech Stack:** `@orpc/contract`, `@orpc/server`, neverthrow, Drizzle repos (already exist), DBOS `enqueueUsageIngestionWorkflow`, Jose JWT for `customerPortal` signed URLs.

---

## Key existing files to understand before starting

- `libraries/hyprpay/src/contract.ts` — oRPC contract (add new namespaces here)
- `libraries/hyprpay/src/client.ts` — SDK client (add new namespace methods here)
- `libraries/hyprpay/src/types.ts` — shared input/output types
- `apps/web/src/integrations/orpc/sdk/router/hyprpay.ts` — current flat impl (refactor into folder)
- `apps/web/src/integrations/orpc/sdk/server.ts` — `SdkContext` and `sdkProcedure`
- `apps/web/src/routes/api/sdk/$.ts` — handler that passes `{ db, posthog, request }` to context
- `packages/workflows/src/workflows/billing/usage-ingestion-workflow.ts` — `enqueueUsageIngestionWorkflow`
- `apps/web/src/integrations/singletons.ts` — `workflowClient: DBOSClient` already exists

**Repos available (no new DB work needed):**
- `subscriptions-repository.ts` — `createSubscription`, `listSubscriptionsByContact`, `updateSubscription`, `ensureSubscriptionOwnership`
- `subscription-items-repository.ts` — `addSubscriptionItem`, `updateSubscriptionItemQuantity`, `removeSubscriptionItem`, `listSubscriptionItems`, `ensureSubscriptionItemOwnership`
- `benefit-grants-repository.ts` — `grantBenefits`, `listGrantsBySubscription`
- `benefits-repository.ts` — `getBenefit`, `listBenefits` (check what exists)
- `coupons-repository.ts` — `getCouponByCode`, `ensureCouponOwnership`

---

## Task 1: Extend SDK context with `workflowClient`

**Files:**
- Modify: `apps/web/src/integrations/orpc/sdk/server.ts`
- Modify: `apps/web/src/routes/api/sdk/$.ts`

**Context:** Usage ingestion must enqueue a DBOS workflow. The main oRPC server already resolves `workflowClient` from `singletons.ts`. We need to pass it to the SDK handler too.

**Step 1: Add `workflowClient` to `SdkContext` in `server.ts`**

In `apps/web/src/integrations/orpc/sdk/server.ts`, extend `BaseContext`:

```typescript
import type { DBOSClient } from "@dbos-inc/dbos-sdk";

interface BaseContext {
   db: DatabaseInstance;
   posthog: PostHog;
   request: Request;
   workflowClient: DBOSClient;
}
```

No change needed to `sdkProcedure` — it forwards all context via `next({ context: { ...context, ... } })`.

**Step 2: Pass `workflowClient` in the route handler**

In `apps/web/src/routes/api/sdk/$.ts`:

```typescript
import { db, posthog, workflowClient } from "@/integrations/singletons";

// workflowClient is a Promise<DBOSClient>
const resolvedWorkflowClient = await workflowClient;

async function handle({ request }: { request: Request }) {
   const { response } = await handler.handle(request, {
      prefix: "/api/sdk",
      context: { db, posthog, request, workflowClient: resolvedWorkflowClient },
   });
   return response ?? new Response("Not Found", { status: 404 });
}
```

**Step 3: Verify typecheck passes**

```bash
bun run typecheck
```

Expected: no errors related to `workflowClient`.

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/sdk/server.ts apps/web/src/routes/api/sdk/$.ts
git commit -m "feat(sdk): extend SDK context with workflowClient"
```

---

## Task 2: Refactor existing hyprpay router into a folder structure

**Files:**
- Create: `apps/web/src/integrations/orpc/sdk/router/hyprpay/customers.ts`
- Delete (conceptually move): `apps/web/src/integrations/orpc/sdk/router/hyprpay.ts` → content moves to `customers.ts`
- Create: `apps/web/src/integrations/orpc/sdk/router/hyprpay/index.ts`
- Modify: `apps/web/src/integrations/orpc/sdk/router/index.ts`

**Context:** Currently hyprpay handlers are in a flat file. We'll split by namespace into a folder `hyprpay/`.

**Step 1: Create `hyprpay/customers.ts`**

Move the entire content of `apps/web/src/integrations/orpc/sdk/router/hyprpay.ts` into `apps/web/src/integrations/orpc/sdk/router/hyprpay/customers.ts`. No logic changes — just relocation.

**Step 2: Create `hyprpay/index.ts`**

```typescript
import * as customers from "./customers";

export default {
   customers,
};
```

**Step 3: Update `router/index.ts`**

```typescript
import * as accounts from "./accounts";
import * as transactions from "./transactions";
import * as categories from "./categories";
import hyprpay from "./hyprpay/index";

export default {
   accounts,
   transactions,
   categories,
   hyprpay,
};
```

**Step 4: Delete old flat file**

```bash
rm apps/web/src/integrations/orpc/sdk/router/hyprpay.ts
```

**Step 5: Verify typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add apps/web/src/integrations/orpc/sdk/router/
git commit -m "refactor(sdk): split hyprpay router into folder structure"
```

---

## Task 3: Add `subscriptions` namespace to contract

**Files:**
- Modify: `libraries/hyprpay/src/contract.ts`

**Context:** We add oRPC contract definitions. These are the "interface" only — no implementation yet.

**Step 1: Add subscription schemas and contract entries**

Add to `contract.ts`:

```typescript
const subscriptionItemSchema = z.object({
   id: z.string(),
   subscriptionId: z.string(),
   priceId: z.string(),
   quantity: z.number(),
   negotiatedPrice: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

const subscriptionSchema = z.object({
   id: z.string(),
   contactId: z.string(),
   teamId: z.string(),
   status: z.enum(["active", "trialing", "incomplete", "completed", "cancelled"]),
   startDate: z.string(),
   endDate: z.string().nullable(),
   couponId: z.string().nullable(),
   cancelAtPeriodEnd: z.boolean(),
   checkoutUrl: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

const subscriptionsContract = {
   create: oc
      .input(
         z.object({
            customerId: z.string(),
            items: z.array(
               z.object({
                  priceId: z.string(),
                  quantity: z.number().int().min(1).optional(),
               }),
            ).min(1),
            couponCode: z.string().optional(),
         }),
      )
      .output(z.object({ subscription: subscriptionSchema, checkoutUrl: z.string().nullable() })),

   cancel: oc
      .input(z.object({ subscriptionId: z.string(), cancelAtPeriodEnd: z.boolean().default(false) }))
      .output(subscriptionSchema),

   list: oc
      .input(z.object({ customerId: z.string() }))
      .output(z.array(subscriptionSchema)),

   addItem: oc
      .input(z.object({ subscriptionId: z.string(), priceId: z.string(), quantity: z.number().int().min(1).optional() }))
      .output(subscriptionItemSchema),

   updateItem: oc
      .input(z.object({ itemId: z.string(), quantity: z.number().int().min(1).optional(), negotiatedPrice: z.string().nullable().optional() }))
      .output(subscriptionItemSchema),

   removeItem: oc
      .input(z.object({ itemId: z.string() }))
      .output(z.object({ success: z.boolean() })),
};
```

Then update `hyprpayContract` export:

```typescript
export const hyprpayContract = {
   // existing customers entries...
   create: ...,
   get: ...,
   list: ...,
   update: ...,
   // new
   subscriptions: subscriptionsContract,
};
```

> Note: oRPC contracts can be nested objects. Check if `@orpc/contract` requires `oc.router({...})` wrapper — look at how the existing flat contract is used in `hyprpay.ts` with `implementerInternal`. If nested namespaces need `oc.router()`, wrap accordingly.

**Step 2: Export new types**

```typescript
export type HyprPaySubscriptionFromContract = z.infer<typeof subscriptionSchema>;
export type HyprPaySubscriptionItemFromContract = z.infer<typeof subscriptionItemSchema>;
```

**Step 3: Build library to check types**

```bash
cd libraries/hyprpay && bun run build
```

**Step 4: Commit**

```bash
git add libraries/hyprpay/src/contract.ts
git commit -m "feat(hyprpay-sdk): add subscriptions contract definitions"
```

---

## Task 4: Implement `subscriptions` router

**Files:**
- Create: `apps/web/src/integrations/orpc/sdk/router/hyprpay/subscriptions.ts`
- Modify: `apps/web/src/integrations/orpc/sdk/router/hyprpay/index.ts`

**Context:** This is the server-side implementation. Uses existing repos. `subscriptions.create` is the complex one — it validates coupon, creates subscription, adds items, optionally redeems coupon. Returns `checkoutUrl: null` for now (payment gateway integration is future scope per project memory).

**Step 1: Create `subscriptions.ts`**

```typescript
import { implementerInternal } from "@orpc/server";
import { err, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import type { SdkContext } from "../../server";
import {
   createSubscription,
   listSubscriptionsByContact,
   updateSubscription,
   ensureSubscriptionOwnership,
} from "@core/database/repositories/subscriptions-repository";
import {
   addSubscriptionItem,
   updateSubscriptionItemQuantity,
   removeSubscriptionItem,
   ensureSubscriptionItemOwnership,
} from "@core/database/repositories/subscription-items-repository";
import { getCouponByCode } from "@core/database/repositories/coupons-repository";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import dayjs from "dayjs";

// impl builder (same pattern as customers.ts)
const impl = implementerInternal(
   hyprpayContract.subscriptions,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

function requireTeamId(teamId: SdkContext["teamId"]) {
   if (!teamId) return err(new WebAppError("FORBIDDEN", { message: "Esta operação requer uma chave de API vinculada a um projeto.", source: "hyprpay" }));
   return ok(teamId);
}

function mapSubscription(sub: import("@core/database/schemas/subscriptions").ContactSubscription) {
   return {
      id: sub.id,
      contactId: sub.contactId,
      teamId: sub.teamId,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate ?? null,
      couponId: sub.couponId ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      checkoutUrl: null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
   };
}

export const create = impl.create.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   // Resolve contact by externalId (customerId = externalId)
   const contactResult = await getContactByExternalId(context.db, input.customerId, teamId, "cliente");
   if (contactResult.isErr()) throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value) throw new WebAppError("NOT_FOUND", { message: "Cliente não encontrado.", source: "hyprpay" });
   const contact = contactResult.value;

   // Validate coupon if provided
   if (input.couponCode) {
      const couponResult = await getCouponByCode(context.db, teamId, input.couponCode);
      if (couponResult.isErr()) throw WebAppError.fromAppError(couponResult.error);
      if (!couponResult.value || !couponResult.value.isActive)
         throw new WebAppError("BAD_REQUEST", { message: "Cupom inválido ou inativo.", source: "hyprpay" });
   }

   // Create subscription
   const subResult = await createSubscription(context.db, teamId, {
      contactId: contact.id,
      startDate: dayjs().format("YYYY-MM-DD"),
      status: "active",
      source: "api",
      couponId: undefined, // coupon redemption is a separate concern
   });
   if (subResult.isErr()) throw WebAppError.fromAppError(subResult.error);
   const subscription = subResult.value;

   // Add items
   for (const item of input.items) {
      const itemResult = await addSubscriptionItem(context.db, teamId, {
         subscriptionId: subscription.id,
         priceId: item.priceId,
         quantity: item.quantity ?? 1,
      });
      if (itemResult.isErr()) throw WebAppError.fromAppError(itemResult.error);
   }

   return { subscription: mapSubscription(subscription), checkoutUrl: null };
});

export const cancel = impl.cancel.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const ownershipResult = await ensureSubscriptionOwnership(context.db, input.subscriptionId, teamId);
   if (ownershipResult.isErr()) throw WebAppError.fromAppError(ownershipResult.error);

   const updateResult = await updateSubscription(context.db, input.subscriptionId, {
      status: input.cancelAtPeriodEnd ? undefined : "cancelled",
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      ...(input.cancelAtPeriodEnd ? {} : { canceledAt: dayjs().toISOString() }),
   });
   if (updateResult.isErr()) throw WebAppError.fromAppError(updateResult.error);
   return mapSubscription(updateResult.value);
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(context.db, input.customerId, teamId, "cliente");
   if (contactResult.isErr()) throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value) throw new WebAppError("NOT_FOUND", { message: "Cliente não encontrado.", source: "hyprpay" });

   const subsResult = await listSubscriptionsByContact(context.db, contactResult.value.id);
   if (subsResult.isErr()) throw WebAppError.fromAppError(subsResult.error);
   return subsResult.value.map(mapSubscription);
});

export const addItem = impl.addItem.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const result = await addSubscriptionItem(context.db, teamId, {
      subscriptionId: input.subscriptionId,
      priceId: input.priceId,
      quantity: input.quantity ?? 1,
   });
   if (result.isErr()) throw WebAppError.fromAppError(result.error);
   const item = result.value;
   return {
      id: item.id,
      subscriptionId: item.subscriptionId,
      priceId: item.priceId,
      quantity: item.quantity,
      negotiatedPrice: item.negotiatedPrice ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
   };
});

export const updateItem = impl.updateItem.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const ownershipResult = await ensureSubscriptionItemOwnership(context.db, input.itemId, teamId);
   if (ownershipResult.isErr()) throw WebAppError.fromAppError(ownershipResult.error);

   const result = await updateSubscriptionItemQuantity(context.db, input.itemId, {
      quantity: input.quantity,
      negotiatedPrice: input.negotiatedPrice,
   });
   if (result.isErr()) throw WebAppError.fromAppError(result.error);
   const item = result.value;
   return {
      id: item.id,
      subscriptionId: item.subscriptionId,
      priceId: item.priceId,
      quantity: item.quantity,
      negotiatedPrice: item.negotiatedPrice ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
   };
});

export const removeItem = impl.removeItem.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const ownershipResult = await ensureSubscriptionItemOwnership(context.db, input.itemId, teamId);
   if (ownershipResult.isErr()) throw WebAppError.fromAppError(ownershipResult.error);

   const result = await removeSubscriptionItem(context.db, input.itemId);
   if (result.isErr()) throw WebAppError.fromAppError(result.error);
   return { success: true };
});
```

**Step 2: Update `hyprpay/index.ts`**

```typescript
import * as customers from "./customers";
import * as subscriptions from "./subscriptions";

export default {
   customers,
   subscriptions,
};
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/sdk/router/hyprpay/
git commit -m "feat(sdk): implement hyprpay.subscriptions router (create, cancel, list, addItem, updateItem, removeItem)"
```

---

## Task 5: Add `usage` namespace to contract + implement router

**Files:**
- Modify: `libraries/hyprpay/src/contract.ts`
- Create: `apps/web/src/integrations/orpc/sdk/router/hyprpay/usage.ts`
- Modify: `apps/web/src/integrations/orpc/sdk/router/hyprpay/index.ts`

**Context:** `usage.ingest` enqueues the DBOS workflow (already exists). `idempotencyKey` is caller-supplied and optional — if omitted, generate a UUID server-side (this is safe here because failure before enqueue = no event recorded, so retry is fine).

**Step 1: Add usage contract**

In `contract.ts`:

```typescript
const usageEventSchema = z.object({
   teamId: z.string(),
   meterId: z.string(),
   quantity: z.string(),
   idempotencyKey: z.string(),
   contactId: z.string().nullable(),
   properties: z.record(z.string(), z.unknown()),
   timestamp: z.string(),
});

const usageContract = {
   ingest: oc
      .input(z.object({
         customerId: z.string(),
         meterId: z.string(),
         quantity: z.number().positive(),
         properties: z.record(z.string(), z.unknown()).optional(),
         idempotencyKey: z.string().optional(),
      }))
      .output(z.object({ queued: z.boolean(), idempotencyKey: z.string() })),

   list: oc
      .input(z.object({ customerId: z.string(), meterId: z.string().optional() }))
      .output(z.array(usageEventSchema)),
};
```

Add to `hyprpayContract`: `usage: usageContract`.

**Step 2: Create `usage.ts`**

```typescript
import { implementerInternal } from "@orpc/server";
import { ok, err } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import type { SdkContext } from "../../server";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import { listUsageEventsByContact } from "@core/database/repositories/usage-events-repository";
import { enqueueUsageIngestionWorkflow } from "@packages/workflows/workflows/billing/usage-ingestion-workflow";
import dayjs from "dayjs";

const impl = implementerInternal(
   hyprpayContract.usage,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

function requireTeamId(teamId: SdkContext["teamId"]) {
   if (!teamId) return err(new WebAppError("FORBIDDEN", { message: "Esta operação requer uma chave de API vinculada a um projeto.", source: "hyprpay" }));
   return ok(teamId);
}

export const ingest = impl.ingest.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(context.db, input.customerId, teamId, "cliente");
   if (contactResult.isErr()) throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value) throw new WebAppError("NOT_FOUND", { message: "Cliente não encontrado.", source: "hyprpay" });

   const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();

   await enqueueUsageIngestionWorkflow(context.workflowClient, {
      teamId,
      meterId: input.meterId,
      quantity: String(input.quantity),
      idempotencyKey,
      contactId: contactResult.value.id,
      properties: input.properties ?? {},
   });

   return { queued: true, idempotencyKey };
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(context.db, input.customerId, teamId, "cliente");
   if (contactResult.isErr()) throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value) throw new WebAppError("NOT_FOUND", { message: "Cliente não encontrado.", source: "hyprpay" });

   const eventsResult = await listUsageEventsByContact(context.db, teamId, contactResult.value.id);
   if (eventsResult.isErr()) throw WebAppError.fromAppError(eventsResult.error);

   return eventsResult.value
      .filter((e) => !input.meterId || e.meterId === input.meterId)
      .map((e) => ({
         teamId: e.teamId,
         meterId: e.meterId,
         quantity: e.quantity,
         idempotencyKey: e.idempotencyKey,
         contactId: e.contactId ?? null,
         properties: e.properties,
         timestamp: e.timestamp.toISOString(),
      }));
});
```

**Step 3: Register in `hyprpay/index.ts`**

```typescript
import * as customers from "./customers";
import * as subscriptions from "./subscriptions";
import * as usage from "./usage";

export default { customers, subscriptions, usage };
```

**Step 4: Typecheck + commit**

```bash
bun run typecheck
git add libraries/hyprpay/src/contract.ts apps/web/src/integrations/orpc/sdk/router/hyprpay/
git commit -m "feat(sdk): implement hyprpay.usage router (ingest via DBOS, list)"
```

---

## Task 6: Add `benefits` namespace

**Files:**
- Modify: `libraries/hyprpay/src/contract.ts`
- Create: `apps/web/src/integrations/orpc/sdk/router/hyprpay/benefits.ts`
- Modify: `apps/web/src/integrations/orpc/sdk/router/hyprpay/index.ts`

**Context:** `benefits.check` looks up a specific grant for a customer+benefit combo. `benefits.list` returns all active grants with benefit details. We need to check what functions exist in `benefits-repository.ts` first.

**Step 1: Check benefits-repository.ts**

Read `core/database/src/repositories/benefits-repository.ts` to see what query functions exist for fetching benefit details.

**Step 2: Add benefits contract**

```typescript
const benefitGrantSchema = z.object({
   id: z.string(),
   benefitId: z.string(),
   subscriptionId: z.string(),
   status: z.enum(["active", "revoked"]),
   grantedAt: z.string(),
   revokedAt: z.string().nullable(),
   benefit: z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["credits", "feature_access", "custom"]),
      description: z.string().nullable(),
   }),
});

const benefitsContract = {
   check: oc
      .input(z.object({ customerId: z.string(), benefitId: z.string() }))
      .output(z.object({
         status: z.enum(["granted", "revoked", "not_found"]),
         grantedAt: z.string().nullable(),
         revokedAt: z.string().nullable(),
         subscriptionId: z.string().nullable(),
      })),

   list: oc
      .input(z.object({ customerId: z.string() }))
      .output(z.array(benefitGrantSchema)),
};
```

Add `benefits: benefitsContract` to `hyprpayContract`.

**Step 3: Create `benefits.ts`**

Logic:
- Resolve `customerId` → contact
- List subscriptions for contact → collect all subscription IDs
- `benefit-grants-repository` → `listGrantsBySubscription` for each (or create a new repo fn `listGrantsByContact` if needed)
- For `check`: filter by `benefitId`, return first match status
- For `list`: join with benefit details (query with `with: { benefit: true }` via Drizzle relations)

```typescript
// Check if db.query.benefitGrants supports with: { benefit: true }
// Look at core/database/src/schemas/relations.ts or similar
```

If Drizzle relations aren't set up for benefitGrants→benefits, do a manual join:

```typescript
import { eq, and, inArray } from "drizzle-orm";
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import { benefits } from "@core/database/schemas/benefits";

// Manual join
const rows = await context.db
   .select()
   .from(benefitGrants)
   .innerJoin(benefits, eq(benefitGrants.benefitId, benefits.id))
   .where(inArray(benefitGrants.subscriptionId, subscriptionIds));
```

> Note: avoid raw db in router per CLAUDE.md — add a `listGrantsWithBenefitsBySubscriptions` function to `benefit-grants-repository.ts` if the join is non-trivial.

**Step 4: Register + typecheck + commit**

```bash
bun run typecheck
git commit -m "feat(sdk): implement hyprpay.benefits router (check, list)"
```

---

## Task 7: Add `coupons` namespace

**Files:**
- Modify: `libraries/hyprpay/src/contract.ts`
- Create: `apps/web/src/integrations/orpc/sdk/router/hyprpay/coupons.ts`
- Modify: `apps/web/src/integrations/orpc/sdk/router/hyprpay/index.ts`

**Context:** `coupons.validate` looks up a coupon by code, checks active + not expired + not maxed out, and optionally validates price scope. Returns coupon details or a structured error (not an HTTP error — the output type carries the error).

**Step 1: Add coupons contract**

```typescript
const couponDetailSchema = z.object({
   id: z.string(),
   code: z.string(),
   type: z.enum(["percent", "fixed"]),
   amount: z.string(),
   duration: z.enum(["once", "repeating", "forever"]),
   durationMonths: z.number().nullable(),
   scope: z.enum(["team", "price"]),
   priceId: z.string().nullable(),
   maxUses: z.number().nullable(),
   usedCount: z.number(),
   redeemBy: z.string().nullable(),
});

const couponsContract = {
   validate: oc
      .input(z.object({ code: z.string(), priceId: z.string().optional() }))
      .output(z.discriminatedUnion("valid", [
         z.object({ valid: z.literal(true), coupon: couponDetailSchema }),
         z.object({ valid: z.literal(false), reason: z.enum(["not_found", "inactive", "expired", "max_uses_reached", "price_scope_mismatch"]) }),
      ])),
};
```

Add `coupons: couponsContract` to `hyprpayContract`.

**Step 2: Create `coupons.ts`**

```typescript
export const validate = impl.validate.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const couponResult = await getCouponByCode(context.db, teamId, input.code);
   if (couponResult.isErr()) throw WebAppError.fromAppError(couponResult.error);

   const coupon = couponResult.value;
   if (!coupon) return { valid: false as const, reason: "not_found" as const };
   if (!coupon.isActive) return { valid: false as const, reason: "inactive" as const };
   if (coupon.redeemBy && dayjs().isAfter(coupon.redeemBy))
      return { valid: false as const, reason: "expired" as const };
   if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
      return { valid: false as const, reason: "max_uses_reached" as const };
   if (coupon.scope === "price" && input.priceId && coupon.priceId !== input.priceId)
      return { valid: false as const, reason: "price_scope_mismatch" as const };

   return {
      valid: true as const,
      coupon: {
         id: coupon.id,
         code: coupon.code,
         type: coupon.type,
         amount: coupon.amount,
         duration: coupon.duration,
         durationMonths: coupon.durationMonths ?? null,
         scope: coupon.scope,
         priceId: coupon.priceId ?? null,
         maxUses: coupon.maxUses ?? null,
         usedCount: coupon.usedCount,
         redeemBy: coupon.redeemBy?.toISOString() ?? null,
      },
   };
});
```

**Step 3: Register + typecheck + commit**

```bash
bun run typecheck
git commit -m "feat(sdk): implement hyprpay.coupons.validate router"
```

---

## Task 8: Add `customerPortal` namespace

**Files:**
- Modify: `libraries/hyprpay/src/contract.ts`
- Create: `apps/web/src/integrations/orpc/sdk/router/hyprpay/customer-portal.ts`
- Modify: `apps/web/src/integrations/orpc/sdk/router/hyprpay/index.ts`

**Context:** `customerPortal.createSession` generates a short-lived signed JWT (using `jose`) pointing to `/portal/:teamSlug`. The portal route must exist (or this just creates the token — the portal route is separate scope). JWT expires in 15 minutes. `customerId` = contact `externalId`. We sign with `JWT_SECRET` from env.

**Step 1: Check env for JWT_SECRET**

```bash
grep -n "JWT_SECRET\|PORTAL" /home/yorizel/Documents/montte-nx/core/environment/src/server.ts
```

If `JWT_SECRET` doesn't exist, add it:

In `core/environment/src/server.ts`:
```typescript
JWT_SECRET: z.string().min(32),
```

Then add to `apps/web/.env.example`.

**Step 2: Add customerPortal contract**

```typescript
const customerPortalContract = {
   createSession: oc
      .input(z.object({ customerId: z.string() }))
      .output(z.object({ url: z.string(), expiresAt: z.string() })),
};
```

Add `customerPortal: customerPortalContract` to `hyprpayContract`.

**Step 3: Install jose if not present**

```bash
grep "jose" /home/yorizel/Documents/montte-nx/apps/web/package.json
```

If missing, `jose` should be in the `server` catalog. Add to `apps/web/package.json`:
```json
"jose": "catalog:server"
```

Verify it's in `pnpm-workspace.yaml` or `bun` catalog. If not, add the version.

**Step 4: Create `customer-portal.ts`**

```typescript
import { implementerInternal } from "@orpc/server";
import { ok, err } from "neverthrow";
import { SignJWT } from "jose";
import { WebAppError } from "@core/logging/errors";
import { env } from "@core/environment/server";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import type { SdkContext } from "../../server";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import dayjs from "dayjs";
// Need teamSlug — look up from team table
import { db } from "@/integrations/singletons"; // ← use context.db instead
import { team } from "@core/database/schemas/auth";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";

const impl = implementerInternal(
   hyprpayContract.customerPortal,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

function requireTeamId(teamId: SdkContext["teamId"]) {
   if (!teamId) return err(new WebAppError("FORBIDDEN", { message: "Esta operação requer uma chave de API vinculada a um projeto.", source: "hyprpay" }));
   return ok(teamId);
}

export const createSession = impl.createSession.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   // Verify contact exists
   const contactResult = await getContactByExternalId(context.db, input.customerId, teamId, "cliente");
   if (contactResult.isErr()) throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value) throw new WebAppError("NOT_FOUND", { message: "Cliente não encontrado.", source: "hyprpay" });

   // Fetch team slug
   const teamRow = await fromPromise(
      context.db.query.team.findFirst({ where: (f, { eq }) => eq(f.id, teamId) }),
      (e) => new WebAppError("INTERNAL_SERVER_ERROR", { message: "Erro interno.", source: "hyprpay", cause: e }),
   );
   if (teamRow.isErr()) throw teamRow.error;
   if (!teamRow.value) throw new WebAppError("NOT_FOUND", { message: "Time não encontrado.", source: "hyprpay" });

   const secret = new TextEncoder().encode(env.JWT_SECRET);
   const expiresAt = dayjs().add(15, "minute");

   const token = await new SignJWT({
      sub: input.customerId,
      teamId,
      contactId: contactResult.value.id,
   })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresAt.toDate())
      .sign(secret);

   const baseUrl = env.APP_URL ?? "https://app.montte.co";
   const url = `${baseUrl}/portal/${teamRow.value.slug}?token=${token}`;

   return { url, expiresAt: expiresAt.toISOString() };
});
```

> Note: check `team` schema for `slug` field. If `APP_URL` isn't in env, use a hardcoded default or add it.

**Step 5: Register + typecheck + commit**

```bash
bun run typecheck
git commit -m "feat(sdk): implement hyprpay.customerPortal.createSession (signed JWT portal URL)"
```

---

## Task 9: Add all new namespaces to the SDK client (`client.ts`)

**Files:**
- Modify: `libraries/hyprpay/src/client.ts`
- Modify: `libraries/hyprpay/src/types.ts`

**Context:** The client uses `ContractRouterClient<typeof hyprpayContract>` which is typed from the contract. With nested namespaces, `orpc.subscriptions.create(...)` etc. should work automatically once the contract is nested. We just need to expose clean method objects.

**Step 1: Add input/output types to `types.ts`**

```typescript
// Subscriptions
export interface CreateSubscriptionInput {
   customerId: string;
   items: Array<{ priceId: string; quantity?: number }>;
   couponCode?: string;
}
export interface CancelSubscriptionInput {
   subscriptionId: string;
   cancelAtPeriodEnd?: boolean;
}
export interface AddSubscriptionItemInput {
   subscriptionId: string;
   priceId: string;
   quantity?: number;
}
export interface UpdateSubscriptionItemInput {
   itemId: string;
   quantity?: number;
   negotiatedPrice?: string | null;
}
export interface RemoveSubscriptionItemInput {
   itemId: string;
}

// Usage
export interface IngestUsageInput {
   customerId: string;
   meterId: string;
   quantity: number;
   properties?: Record<string, unknown>;
   idempotencyKey?: string;
}
export interface ListUsageInput {
   customerId: string;
   meterId?: string;
}

// Benefits
export interface CheckBenefitInput {
   customerId: string;
   benefitId: string;
}

// Coupons
export interface ValidateCouponInput {
   code: string;
   priceId?: string;
}

// Portal
export interface CreatePortalSessionInput {
   customerId: string;
}
```

**Step 2: Add namespace methods to `client.ts`**

Pattern (same `ResultAsync.fromPromise(orpc.xxx(...), mapToHyprPayError)` for each):

```typescript
export function createHyprPayClient(config: HyprPayClientConfig) {
   // ... existing link + orpc setup ...
   // orpc is now typed as ContractRouterClient<typeof hyprpayContract>
   // With nested contract, access via orpc.subscriptions.create, orpc.usage.ingest, etc.

   return {
      customers: { /* existing */ },

      subscriptions: {
         create(input: CreateSubscriptionInput) {
            return ResultAsync.fromPromise(orpc.subscriptions.create(input), mapToHyprPayError);
         },
         cancel(input: CancelSubscriptionInput) {
            return ResultAsync.fromPromise(orpc.subscriptions.cancel(input), mapToHyprPayError);
         },
         list(customerId: string) {
            return ResultAsync.fromPromise(orpc.subscriptions.list({ customerId }), mapToHyprPayError);
         },
         addItem(input: AddSubscriptionItemInput) {
            return ResultAsync.fromPromise(orpc.subscriptions.addItem(input), mapToHyprPayError);
         },
         updateItem(input: UpdateSubscriptionItemInput) {
            return ResultAsync.fromPromise(orpc.subscriptions.updateItem(input), mapToHyprPayError);
         },
         removeItem(itemId: string) {
            return ResultAsync.fromPromise(orpc.subscriptions.removeItem({ itemId }), mapToHyprPayError);
         },
      },

      usage: {
         ingest(input: IngestUsageInput) {
            return ResultAsync.fromPromise(orpc.usage.ingest(input), mapToHyprPayError);
         },
         list(input: ListUsageInput) {
            return ResultAsync.fromPromise(orpc.usage.list(input), mapToHyprPayError);
         },
      },

      benefits: {
         check(input: CheckBenefitInput) {
            return ResultAsync.fromPromise(orpc.benefits.check(input), mapToHyprPayError);
         },
         list(customerId: string) {
            return ResultAsync.fromPromise(orpc.benefits.list({ customerId }), mapToHyprPayError);
         },
      },

      coupons: {
         validate(input: ValidateCouponInput) {
            return ResultAsync.fromPromise(orpc.coupons.validate(input), mapToHyprPayError);
         },
      },

      customerPortal: {
         createSession(customerId: string) {
            return ResultAsync.fromPromise(orpc.customerPortal.createSession({ customerId }), mapToHyprPayError);
         },
      },
   };
}
```

**Step 3: Build library**

```bash
cd libraries/hyprpay && bun run build
```

Expected: dist files regenerated with new exports.

**Step 4: Commit**

```bash
git add libraries/hyprpay/src/
git commit -m "feat(hyprpay-sdk): add subscriptions, usage, benefits, coupons, customerPortal client methods"
```

---

## Task 10: Update SKILL.md and CHANGELOG.md

**Files:**
- Modify: `libraries/hyprpay/skills/hyprpay/SKILL.md`
- Modify: `libraries/hyprpay/CHANGELOG.md`
- Modify: `libraries/hyprpay/package.json` (bump version to `0.2.0`)

**Step 1: Update SKILL.md with new namespace docs**

Document each namespace with a brief usage example (same style as existing Customers API section).

**Step 2: Update CHANGELOG.md**

```markdown
## 0.2.0 — 2026-04-23

### Added
- `subscriptions` namespace: create, cancel, list, addItem, updateItem, removeItem
- `usage` namespace: ingest (DBOS-backed, idempotent), list
- `benefits` namespace: check, list
- `coupons` namespace: validate (with price scope check)
- `customerPortal` namespace: createSession (signed JWT, 15-min TTL)
```

**Step 3: Bump version**

In `libraries/hyprpay/package.json`: `"version": "0.2.0"`

**Step 4: Final build + typecheck**

```bash
cd libraries/hyprpay && bun run build
bun run typecheck
```

**Step 5: Commit**

```bash
git add libraries/hyprpay/
git commit -m "feat(hyprpay-sdk): release 0.2.0 with subscriptions, usage, benefits, coupons, customerPortal"
```

---

## Caveats & Things to Verify During Implementation

1. **oRPC nested contract** — verify that `implementerInternal(hyprpayContract.subscriptions, ...)` works with the nested approach. The existing `customers.ts` uses `implementerInternal(hyprpayContract, ...)` for the flat contract. With nesting you pass the sub-contract.

2. **`team.slug`** — verify the `team` auth schema has a `slug` field. If not, use `team.id` in the portal URL and adjust the portal route accordingly.

3. **`APP_URL` env var** — if it doesn't exist in `core/environment/src/server.ts`, add it as `z.string().url().optional()` and use a fallback.

4. **`workflowClient` resolution** — `singletons.ts` exports `workflowClient` as `Promise<DBOSClient>`. The SDK route handler (`$.ts`) needs to `await` it once at module level (not per-request) since resolving inside `handle()` per request is wasteful. Use a module-level `let resolvedClient: DBOSClient` that gets set on first call or at top level.

5. **`benefits` repo join** — check `listGrantsBySubscription` — it returns grants without benefit details. You'll likely need a new repo function with a join, or use `db.query.benefitGrants.findMany({ with: { benefit: true } })` if relations are set up.

6. **`contactId` vs `externalId`** — HyprPay SDK uses `customerId` = contact `externalId`. Always resolve via `getContactByExternalId` first.

---

**Plan complete and saved to `docs/plans/2026-04-23-hyprpay-sdk-new-namespaces.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session in the worktree with executing-plans, batch execution with checkpoints

**Which approach?**
