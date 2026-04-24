# Modular Monolith Architecture

**Date:** 2026-04-23  
**Status:** In Progress — billing + services migrated (PR #808)  
**Linear:** MON-547

---

## Problem

Domain logic is scattered. Finding anything requires hunting across `apps/web/routers/`, `apps/worker/workflows/`, `core/database/repositories/`, and `packages/events/`. No enforced domain boundaries.

---

## Solution

Vertical slices. Each domain owns all its behavior in one place.

---

## Layer Contract

```
core/        ← pure infra, zero domain logic
  orpc/      ← protectedProcedure, RouterContext, middleware (next PR)
  database/  ← Drizzle schemas only — no repositories
  authentication/ ← Better Auth + HyprPay plugin
modules/     ← domain behavior
apps/        ← wiring only (assemble routers + workflows, mount HTTP handler)
packages/    ← ui stays here (it's not infra)
libraries/   ← hyprpay Better Auth plugin
```

---

## Module Structure

Every module has the same shape:

```
modules/billing/
  db/          ← database queries
  logic/       ← business rules
  router/      ← oRPC procedures (imports protectedProcedure from @core/orpc)
  workflows/   ← DBOS workflows
```

Add `ai/` only when the module actually needs AI. No barrel files — import directly from the file.

Simple modules (contacts, inventory) that are mostly CRUD skip `logic/` entirely — just `db/` + `router/`.

**apps/web wiring — pure assembly:**
```typescript
// apps/web/src/integrations/orpc/router.ts
import * as billing from "@modules/billing/router/billing"
import * as services from "@modules/services/router/services"
export const router = { billing, services }
```

---

## Import Rules

```
core/database/schemas/  ← all table defs stay here, modules never define their own
core/orpc/              ← protectedProcedure, RouterContext — imported by all module routers
modules/**/db/          ← imports @core/database schemas
modules/**/router/      ← imports @core/orpc/server for protectedProcedure
modules/**/workflows/   ← imports @core/database, @core/redis
apps/web                ← assembles module routers into root router, mounts HTTP handler
apps/worker             ← registers module workflows with DBOS
```

Cross-module imports allowed, no circular deps. Nx `check-boundaries` enforces this.

---

## What Changes

| Current | New |
|---|---|
| `apps/web/src/integrations/orpc/router/*` | `modules/*/router/` |
| `apps/web/src/integrations/orpc/server.ts` | `core/orpc/` (protectedProcedure, context, middleware) |
| `apps/worker/src/workflows/*` | `modules/*/workflows/` |
| `core/database/src/repositories/*` | `modules/*/db/` |
| `packages/events/credits.ts` | **deleted** — HyprPay owns metering |
| `packages/events/{service billing events}` | **deleted** — HyprPay plugin fires these |
| `packages/events/{analytics events}` | stays — PostHog tracking still needed |
| `packages/analytics/` | `modules/analytics/` (ParadeDB, build fresh) |
| `core/stripe/` | **deleted** — HyprPay plugin replaces it |

`packages/ui` stays as-is. `packages/notifications` stays until design is clear.

### What HyprPay kills

HyprPay as a Better Auth plugin hooks into subscription/usage/payment lifecycle automatically:

- `emitSubscriptionCreated` → plugin fires on subscription create
- `emitUsageIngested` → plugin fires on usage record
- `createBillableProcedure` pattern → replaced by HyprPay middleware
- Redis free-tier counters (`credits.ts`) → HyprPay meters replace them
- Stripe meter events → HyprPay sends to whichever gateway is configured

**What survives in `packages/events`:** PostHog analytics only — `finance.ts`, `contact.ts`, `service.ts` (non-billing), `ai.ts`, `emit.ts`. No `credits.ts`, no billing event emitters.

---

## Migration

**One PR at a time. Don't start next until previous is merged.**

| PR | Scope | Status |
|---|---|---|
| #808 | `modules/billing` + `modules/services` db/workflows/events | ✅ Merged |
| Next | `core/orpc` — extract protectedProcedure, move routers to modules | Planned |
| Later | `core/authentication` — HyprPay plugin, kill `core/stripe`, kill `packages/events/credits` | Planned |
| Later | Remaining modules (contacts, finance, inventory) | Planned |
| Later | `modules/analytics` — fresh ParadeDB build | Planned |

Per-module checklist:
- [ ] Create `modules/<name>/` with `package.json` (`@modules/<name>`)
- [ ] Move repositories → `db/`
- [ ] Move router → `router/` (requires `core/orpc` PR first)
- [ ] Move workflows → `workflows/`
- [ ] Update `apps/web` and `apps/worker` imports
- [ ] Delete old locations
- [ ] `bun run check-boundaries && bun run typecheck`

---

## Billing Engine Patterns

Two patterns apply to `modules/billing/logic/`. Nothing else.

### 1. Pipeline — DBOS workflows (already built)

```
subscribe → track usage → aggregate → generate invoice → charge
```

Each step is a durable DBOS workflow. Don't change this.

### 2. Strategy — pricing type calculation

One function per pricing type, no `if/switch` sprawl:

```typescript
// modules/billing/logic/pricing-strategies.ts
import { of, add, multiply } from "@f-o-t/money"

function calculateFlat(price: ServicePrice) {
  return of(price.amount, "BRL")
}

function calculatePerUnit(price: ServicePrice, usage: number) {
  return multiply(of(price.amount, "BRL"), usage)
}

function calculateMetered(price: ServicePrice, usage: number) {
  const total = multiply(of(price.amount, "BRL"), usage)
  return price.priceCap
    ? min(total, of(price.priceCap, "BRL"))
    : total
}

const strategies = { flat: calculateFlat, per_unit: calculatePerUnit, metered: calculateMetered }

export function calculateLineItem(price: ServicePrice, usage: number) {
  return strategies[price.type](price, usage)
}

// invoice total
const total = lineItems.reduce((acc, item) => add(acc, item.amount), of("0", "BRL"))
```

**Rules:**
- All money goes through `@f-o-t/money` — never raw numbers, never `parseFloat`, never float arithmetic
- `quantity` and `usage` are stored as `text` in DB — `of(value, "BRL")` handles decimal strings correctly
- `priceCap` enforced inside the strategy, not in the workflow

---

## What This Is Not

- Not a microservices migration
- Not full DDD/CQRS — no aggregates, no event sourcing, no command buses
- Not a big-bang reorg — one module at a time, starting with billing
