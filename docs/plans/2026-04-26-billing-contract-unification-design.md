# Billing module ↔ HyprPay contract unification

**Status:** Design approved, ready to implement.
**Branch:** `modules/classification`
**Supersedes:** `ARCHITECTURAL-REWORK-PLAN.md` (Phase B/C section).

---

## Problem

Commit `f0cac0c6` ported the legacy `apps/web/src/integrations/orpc/sdk/router/hyprpay/` handlers into 5 new files in `modules/billing/src/router/` (`customers.ts`, `usage.ts`, `subscriptions.ts`, `benefits.ts`, `customer-portal.ts`). Those files re-implement SQL that already lives in `services.ts` (`ingestUsage`, `createSubscription`, `cancelSubscription`, `addItem`/`updateItem`/`removeItem`, `attachBenefit`, etc.) — duplicated transaction bodies, two code paths to maintain.

User direction:

> "i want the hyprpay to hit the real billing modules i dont want to duplicate logic"
> "the hyprpay should be rewrote to match the existing ones today okay, and we do some type of thing to accept the externalId or id"
> "we dont need a service layer on the modules/billing okay — we can use middlewares"
> "the contacts port will need to remove the repositories and use the db directly"

---

## Approach

**Single source of truth.** `modules/billing/src/router/*.ts` is the only billing API. Dashboard and SDK call the same procedures. The contract object (in `libraries/hyprpay/src/contract.ts`) defines the public shape; module handlers `implementer`-bind to it.

**Discriminated union for contact references.** Every input that names a contact accepts either an internal id or an externalId. One middleware resolves it to the loaded `contacts` row.

**No service layer.** `modules/billing/src/services/` directory is NOT created. Existing middleware pattern (`modules/billing/src/router/middlewares.ts`) handles cross-procedure logic (entity loading, ownership checks). No "shared function" extraction.

---

## Architecture

### Contract (`libraries/hyprpay/src/contract.ts`)

Restructured to mirror the modules. Drop the `hyprpay` namespacing.

```ts
import { oc } from "@orpc/contract";
import { z } from "zod";

// Two ref schemas, one per field-name convention.
export const contactByIdRef = z.union([
   z.object({ id: z.string().uuid() }),
   z.object({ externalId: z.string().min(1) }),
]);

export const contactFkRef = z.union([
   z.object({ contactId: z.string().uuid() }),
   z.object({ externalId: z.string().min(1) }),
]);

export type ContactByIdRef = z.infer<typeof contactByIdRef>;
export type ContactFkRef = z.infer<typeof contactFkRef>;

const servicesContract = {
   ingestUsage: oc.input(contactFkRef.and(z.object({
      meterId: z.string().uuid(),
      quantity: z.number().positive(),
      idempotencyKey: z.string().optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
   }))).output(z.object({ queued: z.boolean(), idempotencyKey: z.string() })),
   createSubscription: oc.input(contactFkRef.and(z.object({
      items: z.array(z.object({ priceId: z.string(), quantity: z.number().int().min(1).optional() })).min(1),
      couponCode: z.string().optional(),
      // ...other create fields
   }))).output(/* subscription schema */),
   cancelSubscription: oc.input(z.object({ subscriptionId: z.string(), cancelAtPeriodEnd: z.boolean().default(false) })).output(/* */),
   getContactSubscriptions: oc.input(contactFkRef).output(/* array */),
   addItem: oc.input(/* */).output(/* */),
   updateItem: oc.input(/* */).output(/* */),
   removeItem: oc.input(/* */).output(/* */),
   // ...mirror everything else in services.ts that's SDK-relevant
};

const contactsContract = {
   create: oc.input(/* */).output(/* */),
   getAll: oc.input(/* */).output(/* */),
   getById: oc.input(contactByIdRef).output(/* */),
   update: oc.input(contactByIdRef.and(/* */)).output(/* */),
   remove: oc.input(contactByIdRef).output(/* */),
   archive: oc.input(contactByIdRef).output(/* */),
   reactivate: oc.input(contactByIdRef).output(/* */),
   getStats: oc.input(contactByIdRef).output(/* */),
   getTransactions: oc.input(contactByIdRef.and(/* */)).output(/* */),
   bulkRemove: oc.input(z.object({ ids: z.array(z.string().uuid()) })).output(/* */),
};

const couponsContract = {
   list: oc.input(/* */).output(/* */),
   get: oc.input(/* */).output(/* */),
   create: oc.input(/* */).output(/* */),
   update: oc.input(/* */).output(/* */),
   deactivate: oc.input(/* */).output(/* */),
   validate: oc.input(z.object({ code: z.string(), priceId: z.string().optional() })).output(/* discriminated union */),
};

const customerPortalContract = {
   createSession: oc.input(z.object({ externalId: z.string() })).output(z.object({ url: z.string() })),
};

export const billingContract = {
   services: servicesContract,
   contacts: contactsContract,
   coupons: couponsContract,
   customerPortal: customerPortalContract,
};
```

Drop `hyprpayContract` export entirely (or alias `billingContract` to it for one release with a deprecation notice).

### Module handlers (`modules/billing/src/router/`)

Each handler binds to its contract slice via `implementer` and uses `protectedProcedure`'s middleware stack:

```ts
// modules/billing/src/router/services.ts
import { implementer } from "@orpc/server";
import { billingContract } from "@montte/hyprpay/contract";
import { protectedProcedure } from "@core/orpc/server";
import { requireContact, requireMeter, requireSubscription, ... } from "./middlewares";

const impl = implementer(
   billingContract.services,
   protectedProcedure["~orpc"].config,
   [...protectedProcedure["~orpc"].middlewares],
);

export const ingestUsage = impl.ingestUsage
   .use(requireContact, (input) => input)
   .handler(async ({ context, input }) => {
      const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.insert(usageEvents).values({
               teamId: context.teamId,
               contactId: context.contact.id,
               meterId: input.meterId,
               quantity: String(input.quantity),
               idempotencyKey,
               properties: input.properties ?? {},
            }).onConflictDoNothing({ target: [usageEvents.teamId, usageEvents.idempotencyKey] });
         }),
         () => WebAppError.internal("Falha ao registrar evento de uso."),
      );
      if (result.isErr()) throw result.error;
      return { queued: true, idempotencyKey };
   });

export const createSubscription = impl.createSubscription
   .use(requireContact, (input) => input)
   .handler(/* ... transaction body unchanged from current services.ts:308 ... */);
```

The transaction body inside `services.createSubscription`, `services.ingestUsage`, etc. stays as it is today. The only change per handler: input wraps `requireContact` extractor (returns the union ref subset, or just `input` when input matches the ref schema).

### Middleware (`modules/billing/src/router/middlewares.ts`)

`requireContact` rewritten to accept the union ref:

```ts
import { os } from "@orpc/server";
import { err, fromPromise, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import type { ContactByIdRef, ContactFkRef } from "@montte/hyprpay/contract";

const base = os.$context<ORPCContextWithOrganization>();

type ContactRef = ContactByIdRef | ContactFkRef;

export const requireContact = base.middleware(
   async ({ context, next }, ref: ContactRef) => {
      const result = await fromPromise(
         context.db.query.contacts.findFirst({
            where: (f, { and, eq }) =>
               and(
                  eq(f.teamId, context.teamId),
                  "id" in ref
                     ? eq(f.id, ref.id)
                     : "contactId" in ref
                       ? eq(f.id, ref.contactId)
                       : and(
                            eq(f.externalId, ref.externalId),
                            eq(f.type, "cliente"),
                         ),
               ),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Cliente não encontrado."))
            : ok(contact),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { contact: result.value } });
   },
);
```

Existing `requireService`, `requireMeter`, `requireBenefit`, `requireSubscription`, `requireSubscriptionItem`, `requireServicePrice` middlewares stay as-is (they take scalar id; their entities have no externalId equivalent).

The current `requireContact(id: string)` is replaced by this union version. All existing call sites in `services.ts` that pass `(input) => input.contactId` become `(input) => ({ contactId: input.contactId })`. Mechanical edit.

### SDK client (`libraries/hyprpay/src/client.ts`)

Replace the 180-line manual wrappers with ~30 lines:

```ts
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { billingContract } from "./contract";

const DEFAULT_BASE_URL = "https://app.montte.co";

export interface HyprPayClientConfig {
   apiKey: string;
   baseUrl?: string;
}

export type HyprPayClient = ContractRouterClient<typeof billingContract>;

export function createHyprPayClient(config: HyprPayClientConfig): HyprPayClient {
   const link = new RPCLink({
      url: `${config.baseUrl ?? DEFAULT_BASE_URL}/api/rpc`,
      headers: { "x-api-key": config.apiKey },
   });
   return createORPCClient(link);
}
```

Drop `libraries/hyprpay/src/types.ts` (types now flow from contract via `z.infer`). Drop `libraries/hyprpay/src/errors.ts` (oRPC errors are typed by ContractRouterClient — caller handles via `.isDefinedError`/`.code`).

Bump `@montte/hyprpay` to **v0.4.0**. CHANGELOG entry calling out the breaking restructure: `hyprpayContract` → `billingContract`, namespaces moved to `services`/`contacts`/`coupons`/`customerPortal`, contact-keyed inputs now `{id|contactId} | {externalId}` discriminated unions, client.create/get/list/update moved under `client.contacts.*`.

### App router mount (`apps/web/src/integrations/orpc/router/index.ts`)

Drop the `hyprpay` namespace + the 5 dupe imports. Switch contacts import.

```ts
// before
import * as contactsRouter from "./contacts";
const hyprpayRouter = { ...customersRouter, subscriptions: subscriptionsRouter, ... };

// after
import * as contactsRouter from "@modules/billing/router/contacts";
import * as customerPortalRouter from "@modules/billing/router/customer-portal";
// (no hyprpayRouter object)

export default {
   // ...existing flat keys
   contacts: contactsRouter,        // now from modules/billing
   customerPortal: customerPortalRouter,  // new
   // (no hyprpay key)
};
```

---

## Procedure inventory

### `services` namespace (existing, modified)
- `ingestUsage` — input wraps `contactFkRef`; uses `requireContact`
- `createSubscription` — input wraps `contactFkRef`; uses `requireContact`
- `cancelSubscription` — unchanged (input keyed by subscriptionId)
- `getContactSubscriptions` — input is `contactFkRef`; uses `requireContact`
- `addItem`, `updateItem`, `removeItem` — unchanged (keyed by subscriptionId/itemId)
- `getAll`, `create`, `bulkCreate`, `update`, `remove`, `exportAll` — services CRUD, unchanged
- `getVariants`, `createVariant`, `updateVariant`, `removeVariant` — unchanged
- `getMeters`, `createMeter`, `getMeterById`, `updateMeterById`, `removeMeter` — unchanged
- `getBenefits`, `createBenefit`, `getBenefitById`, `updateBenefitById`, `removeBenefit`, `attachBenefit`, `detachBenefit`, `getServiceBenefits` — unchanged
- `getMrr`, `getActiveCountByPrice` — unchanged
- `getAllSubscriptions`, `getExpiringSoon` — unchanged

### `contacts` namespace (moved from apps/web, modified)
Procedures kept (all 10): `create`, `getAll`, `getById`, `getStats`, `getTransactions`, `update`, `remove`, `bulkRemove`, `archive`, `reactivate`. Each input keyed by `id` becomes `contactByIdRef` union. Repository imports inlined as Drizzle queries.

### `coupons` namespace (existing, mostly unchanged)
- `list`, `get`, `create`, `update`, `deactivate`, `validate` — verify shape parity with `billingContract.coupons`; minor schema tweaks if needed.

### `billing` namespace (existing, trimmed)
- `getEventCatalog` — unchanged
- `getUsageSummary` — **deleted**. Dashboard calls `orpc.services.getContactSubscriptions` or a new `services.getUsageSummary` instead.
- `getCustomerPortalSession` — **deleted**. Dashboard calls `orpc.customerPortal.createSession({ externalId: organizationId })`.

### `customerPortal` namespace (new)
- `createSession` — `{ externalId }` → `{ url: \`${env.APP_URL}/portal?externalId=${externalId}\` }`. ~10 lines.

---

## Migration steps (ordered)

1. **Delete dupe files** from commit `f0cac0c6`:
   - `modules/billing/src/router/customers.ts`
   - `modules/billing/src/router/usage.ts`
   - `modules/billing/src/router/subscriptions.ts`
   - `modules/billing/src/router/benefits.ts`
   - `modules/billing/src/router/customer-portal.ts`
   - Remove from `modules/billing/package.json` if `@montte/hyprpay` workspace dep is no longer needed (it still is — for `billingContract` import).

2. **Restructure `libraries/hyprpay/src/contract.ts`** to the `billingContract` shape above. Export both ref schemas. Bump `@montte/hyprpay` to v0.4.0; write CHANGELOG.

3. **Rewrite `libraries/hyprpay/src/client.ts`** to thin `createORPCClient` + `ContractRouterClient`. Delete `types.ts` + `errors.ts`. Delete `better-auth/` plugin dir for now (Phase E is downstream — can be re-added against the new contract later).

4. **Move + port `apps/web/src/integrations/orpc/router/contacts.ts` → `modules/billing/src/router/contacts.ts`:**
   - Switch `protectedProcedure` import to `@core/orpc/server`
   - Replace every `getContactByExternalId(...)`, `createContact(...)`, `updateContact(...)`, `listContacts*(...)` repository call with inline Drizzle on the `contacts` schema. Mirror the SQL the repo functions produce (read `core/database/src/repositories/contacts-repository.ts` for source of truth).
   - Wrap procedures with `implementer(billingContract.contacts, ...)` so the public shape and the runtime stay locked.
   - Inputs that take `{ id }` become `contactByIdRef` unions. Use `requireContact` middleware.
   - All writes inside `context.db.transaction(...)`.

5. **Rewrite `modules/billing/src/router/middlewares.ts`** — replace `requireContact(id: string)` with the `requireContact(ref: ContactRef)` union version. All existing extractors that passed `(input) => input.contactId` change to `(input) => ({ contactId: input.contactId })`.

6. **Wrap `modules/billing/src/router/services.ts` handlers** with `implementer(billingContract.services, ...)`. Handler bodies stay the same. Input schemas pulled from the contract (drop the local `upsertUsageEventSchema`, `createSubscriptionWithItemsInputSchema`, etc. unless they're imported elsewhere).

7. **Wrap `modules/billing/src/router/coupons.ts`** with `implementer(billingContract.coupons, ...)`. Verify shape parity; adjust the contract if the existing handlers are stricter/looser.

8. **Trim `modules/billing/src/router/billing.ts`** — delete `getUsageSummary` and `getCustomerPortalSession`. Update dashboard call sites (find via grep) to call `orpc.customerPortal.createSession(...)` etc.

9. **Create `modules/billing/src/router/customer-portal.ts`** — single procedure, `implementer`-bound to `billingContract.customerPortal`.

10. **Update `apps/web/src/integrations/orpc/router/index.ts`:**
    - Drop the `hyprpay` namespace key + the 5 dupe imports
    - Re-import `contacts` from `@modules/billing/router/contacts`
    - Add `customerPortal: customerPortalRouter`

11. **Verify:**
    - `bunx nx run-many -t typecheck` — all 24 green
    - `bunx nx run @modules/billing:test` — 127 still pass (input-shape changes may need test-fixture updates; expected)
    - `bunx nx run @montte/hyprpay:build` — types resolve cleanly
    - Dashboard smoke: `bun dev`; navigate to contacts page, create a contact, attach a subscription, ingest a usage event; confirm DB rows. Browser console for orpc errors.
    - SDK smoke: write a throwaway `bun run` script that does `createHyprPayClient({ apiKey })` against local dev with a valid api key (metadata.organizationId set), call `client.services.ingestUsage({ externalId: "...", meterId, quantity: 1 })` — confirm row in `usage_events`.

12. **Commit per step** (or grouped logically — middleware change + services wrap = one commit, contacts move = one commit, contract restructure + SDK rewrite = one commit, etc.) so each commit individually typechecks.

---

## Open decisions for the implementer

- **Customer portal URL format** — `${env.APP_URL}/portal?externalId=${externalId}` is a stub. If a real portal page exists, point at it. If not, decide whether to implement a stub page or leave the SDK consumer to handle the URL however they want.
- **Coupon shape parity** — verify `couponsRouter.validate` input/output matches the contract exactly. If they diverge, the contract is the source of truth (the existing handler conforms to the contract, not the other way around).
- **Handler-to-contract input shape mismatches** — `services.createSubscription` currently takes `createSubscriptionWithItemsInputSchema` (with `status`, `startDate`, `trialEndsAt`). The contract may not include all those fields. Decide whether to expose the full internal shape via the contract or restrict the SDK to a smaller subset (recommend: full subset; SaaS owners want control).
- **Better-auth plugin** — currently in `libraries/hyprpay/src/better-auth/`. Out of scope for this rework. Decide whether to leave it broken (it imports the old client API) or temp-disable until a follow-up rewires it against the new client. Recommend: comment out the plugin entry, ship the rest, write a follow-up task.
- **`apps/web/src/integrations/orpc/server.ts` duplicate** — still a duplicate of `core/orpc/src/server.ts`. Out of scope here, but worth noting that apps/web routers (`transactions.ts`, `dashboards.ts`, etc.) still go through it and don't have the api-key bridge. Their migration is separate.

---

## Constraints (don't relitigate)

- `WebAppError` only, factories (`notFound`, `forbidden`, `unauthorized`, `badRequest`, `conflict`, `internal`), pt-BR messages
- `neverthrow` chains, no `try/catch` (except tests)
- Direct Drizzle, no repository layer, no `@core/database/repositories/*` imports anywhere in modules
- All writes inside `context.db.transaction(async (tx) => ...)`
- No `as` casts. No JSDoc. No section comments. No barrel files.
- `protectedProcedure` from `@core/orpc/server`
- Workflow inputs always carry `organizationId` alongside `teamId` (workflows untouched in this rework)

---

## Verification snippet (smoke)

```bash
bunx nx run-many -t typecheck
bunx nx run @modules/billing:test
bunx nx run @modules/classification:test
bunx nx run @montte/hyprpay:build
bun dev
# in another terminal, after seeding an org + api key:
curl -X POST http://localhost:3000/api/rpc/services/ingestUsage \
   -H "Content-Type: application/json" \
   -H "x-api-key: $API_KEY" \
   -d '{"externalId":"contact_xxx","meterId":"meter_xxx","quantity":1}'
# expect: {"queued":true,"idempotencyKey":"<uuid>"}
```
