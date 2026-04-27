# Billing Router Split & Local Implementers

**Date:** 2026-04-27
**Branch:** modules/classification
**Scope:** `modules/billing` only

## Goal

1. Replace shared `_implementer.ts` with per-file local implementers — each router file declares only the contract slice it implements.
2. Drop dead duplicate schemas in `contracts/services.ts` (HyprPay contract is the source of truth for SDK-bound procs).
3. Split monolithic `router/services.ts` (930 lines, mixed domains) into focused files: `services`, `subscriptions`, `meters`, `benefits`, `usage`.

Non-goals: changing handler logic, contract shape, ingestion semantics (`meterId | eventName` stays), or DB schema.

## Current State

- `modules/billing/src/router/_implementer.ts` exports a shared `billingImpl` covering all 4 contract slices (`services`, `contacts`, `coupons`, `customerPortal`). Every router file imports it.
- `modules/billing/src/contracts/billing.ts` is `export {};` — empty.
- `modules/billing/src/contracts/services.ts` exports schemas. Subset is dead — referenced only inside the same file:
  - `createSubscriptionSchema`, `updateSubscriptionSchema`
  - `createSubscriptionItemSchema`, `updateSubscriptionItemSchema`, `updateSubscriptionItemInputSchema`
  - `upsertUsageEventSchema`
  - `createSubscriptionWithItemsInputSchema`, `listExpiringSoonInputSchema` (dead — see step 4)
  - matching `Input` type aliases
  Bound procs read schemas from `billingImpl.services.*` (HyprPay contract).
- `router/services.ts` mixes 7 domains: services CRUD, prices CRUD, subscriptions, subscription items, meters, benefits + service-benefit links, usage ingestion, MRR/active-count analytics.

## Plan

### 1. Delete `contracts/billing.ts`

Empty file. Remove.

### 2. Trim `contracts/services.ts`

Keep schemas actually consumed by raw `protectedProcedure` handlers:
- `createServiceSchema`, `updateServiceSchema`, `bulkCreateServicesInputSchema`, `updateServiceInputSchema`, `listServicesInputSchema`
- `createPriceSchema`, `updatePriceSchema`, `createPriceForServiceInputSchema`, `updatePriceInputSchema`
- `createMeterSchema`, `updateMeterSchema`, `updateMeterInputSchema`
- `createBenefitSchema`, `updateBenefitSchema`, `updateBenefitInputSchema`
- `idInputSchema`, `serviceIdInputSchema`, `priceIdInputSchema`, `subscriptionIdInputSchema`, `contactIdInputSchema`
- `serviceBenefitLinkSchema`
- `listSubscriptionsInputSchema`, `listExpiringSoonInputSchema` (consumed by `getAllSubscriptions` / `getExpiringSoon`)

Drop:
- `createSubscriptionSchema`, `updateSubscriptionSchema`
- `createSubscriptionItemSchema`, `updateSubscriptionItemSchema`, `updateSubscriptionItemInputSchema`
- `upsertUsageEventSchema`
- `createSubscriptionWithItemsInputSchema`
- All matching `Input` type aliases for the dropped schemas

Optionally split this file alongside the router split (`contracts/services.ts` → `contracts/{services,prices,meters,benefits}.ts`) — defer; not required for this task.

### 3. Inline implementers per router file

Delete `router/_implementer.ts`.

Each router file that implements HyprPay procs declares its own slice at the top:

```typescript
import { implementerInternal } from "@orpc/server";
import { billingContract } from "@montte/hyprpay/contract";
import { protectedProcedure } from "@core/orpc/server";
import type { ORPCContext, ORPCContextWithOrganization } from "@core/orpc/server";

const def = protectedProcedure["~orpc"];

const impl = implementerInternal<
   typeof billingContract.services, // or .contacts / .coupons / .customerPortal
   ORPCContext,
   ORPCContextWithOrganization
>(billingContract.services, def.config, [...def.middlewares]);
```

Files affected: `contacts.ts`, `coupons.ts`, `customer-portal.ts`, plus the new split files (`subscriptions.ts`, `usage.ts`) that bind to `billingContract.services`.

`services.ts` (post-split, services+prices only) does NOT need an implementer — those procs are all raw `protectedProcedure`. Same for `meters.ts` and `benefits.ts`.

### 4. Split `router/services.ts`

Move handlers verbatim (no logic changes). Imports localized to each file.

| New file | Procs moved | Notes |
|---|---|---|
| `router/services.ts` | `getAll`, `create`, `bulkCreate`, `update`, `remove`, `exportAll`, `getVariants`, `createVariant`, `updateVariant`, `removeVariant` | services + prices CRUD. No implementer. |
| `router/subscriptions.ts` | `getAllSubscriptions`, `getContactSubscriptions`, `createSubscription`, `cancelSubscription`, `getExpiringSoon`, `addItem`, `updateItem`, `removeItem`, `listItems`, `getMrr`, `getActiveCountByPrice` | Local `impl` from `billingContract.services`. Workflow enqueue logic stays inline. |
| `router/meters.ts` | `createMeter`, `getMeters`, `getMeterById`, `updateMeterById`, `removeMeter` | No implementer. |
| `router/benefits.ts` | `createBenefit`, `getBenefits`, `getBenefitById`, `updateBenefitById`, `removeBenefit`, `attachBenefit`, `detachBenefit`, `getServiceBenefits` | No implementer. |
| `router/usage.ts` | `ingestUsage` | Local `impl` from `billingContract.services`. |

`router/billing.ts` (currently `getEventCatalog`) — leave as is.

Rename consideration: in the new `subscriptions.ts`, drop the `Subscriptions` suffix from local exports (`getAllSubscriptions` → `getAll`, `getContactSubscriptions` → `getByContact`, `getExpiringSoon` stays, `createSubscription` → `create`, `cancelSubscription` → `cancel`). This shifts public API names — update `apps/web/.../router/index.ts` and any callers (`features/billing/**`, route loaders). **Decision deferred** — keep current names in initial split; rename in a follow-up if desired.

### 5. Wire new routers in `apps/web/src/integrations/orpc/router/index.ts`

Replace single `services` import with split imports. Add new top-level keys:

```typescript
import * as benefitsRouter from "@modules/billing/router/benefits";
import * as metersRouter from "@modules/billing/router/meters";
import * as servicesRouter from "@modules/billing/router/services";
import * as subscriptionsRouter from "@modules/billing/router/subscriptions";
import * as usageRouter from "@modules/billing/router/usage";

export default {
   …
   services: servicesRouter,
   subscriptions: subscriptionsRouter,
   meters: metersRouter,
   benefits: benefitsRouter,
   usage: usageRouter,
   …
};
```

This **breaks every client call** to `orpc.services.getMrr`, `orpc.services.getMeters`, `orpc.services.ingestUsage`, etc. Audit and rewrite frontend call sites.

### 6. Update frontend call sites

```bash
rg -n "orpc\.services\.(getMrr|getActiveCountByPrice|ingestUsage|createMeter|getMeters|getMeterById|updateMeterById|removeMeter|createBenefit|getBenefits|getBenefitById|updateBenefitById|removeBenefit|attachBenefit|detachBenefit|getServiceBenefits|getAllSubscriptions|getContactSubscriptions|createSubscription|cancelSubscription|getExpiringSoon|addItem|updateItem|removeItem|listItems)" apps/web/src
```

Rewrite each to the new namespace (e.g. `orpc.meters.getAll`, `orpc.usage.ingest`, `orpc.subscriptions.getMrr`).

### 7. Update tests

```bash
rg -n "orpc.services\.|servicesRouter\.|from.*router/services" modules/billing/__tests__
```

`modules/billing/__tests__/router/services.test.ts` likely splits too. Move tests next to the procs they cover (`subscriptions.test.ts`, `meters.test.ts`, etc.) — or keep one file and update imports. Decision: **split tests alongside source** for parity.

### 8. Verify

```bash
bun run typecheck
bun run check
bun nx run @modules/billing:test
bun nx affected -t test
```

Manual smoke (web): load services list, MRR widget, meter admin, ingest path (any billable proc). No console errors, no broken queries.

## File-by-File Checklist

- [ ] Delete `modules/billing/src/contracts/billing.ts`
- [ ] Trim `modules/billing/src/contracts/services.ts` (remove 7 dead schemas + types)
- [ ] Delete `modules/billing/src/router/_implementer.ts`
- [ ] Add local `impl` to `modules/billing/src/router/contacts.ts`
- [ ] Add local `impl` to `modules/billing/src/router/coupons.ts`
- [ ] Add local `impl` to `modules/billing/src/router/customer-portal.ts`
- [ ] Create `modules/billing/src/router/subscriptions.ts` (with local `impl`)
- [ ] Create `modules/billing/src/router/meters.ts`
- [ ] Create `modules/billing/src/router/benefits.ts`
- [ ] Create `modules/billing/src/router/usage.ts` (with local `impl`)
- [ ] Trim `modules/billing/src/router/services.ts` to services + prices only
- [ ] Update `apps/web/src/integrations/orpc/router/index.ts`
- [ ] Rewrite frontend call sites under `apps/web/src/features/billing/**` + route loaders
- [ ] Split / update `modules/billing/__tests__/router/services.test.ts`
- [ ] `bun run typecheck && bun run check && bun nx affected -t test`

## Risk

- **API surface break** — every `orpc.services.*` non-CRUD call must move. Mitigated by typecheck + grep audit.
- **Test mocks** — `modules/billing/__tests__/helpers/mock-billing-context.ts` may inline `billingImpl`. Verify after `_implementer` deletion.
- **Workflow enqueue side effects** in `createSubscription` / `cancelSubscription` — handlers move verbatim, no logic edit.

## Out of Scope

- Renaming procs (e.g. `getAllSubscriptions` → `getAll`). Defer.
- Splitting `contracts/services.ts` into per-domain contract files. Defer.
- Changing ingestion identifier (`meterId | eventName` unchanged).
- Adding a `(teamId, name)` unique index on meters.
- Touching HyprPay SDK contract (`libraries/hyprpay/src/contract.ts`).
