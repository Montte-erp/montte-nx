# HyprPay — The Better-Auth of Payments

**Date:** 2026-04-28
**Status:** Vision + scope; replaces Montte billing wholesale
**Repo:** `libraries/hyprpay` (in-place)

---

## What HyprPay is

The composable, gateway-agnostic, self-hostable payment SDK for TypeScript apps. **Better-auth's surface area, shape, and DX — but for billing.**

You drop it into your backend, choose a gateway plugin (Stripe / Paddle / Asaas / …), declare which capability plugins you need, and get a fully-typed billing surface backed by your own database.

No SaaS dependency. No lock-in. Plugin system is the product.

## Positioning vs the field

| Tool | Self-host | Gateway-agnostic | Composable plugins | Type-safe client | Usage-based | OSS |
|---|---|---|---|---|---|---|
| Stripe Billing | ✗ | ✗ (Stripe-only) | ✗ | partial | ✓ | ✗ |
| Lago | ✓ (heavy infra) | ✗ | ✗ | ✗ | ✓ | ✓ |
| OpenMeter | ✓ | ✗ | ✗ | ✗ | ✓ (only) | ✓ |
| Polar | ✗ | ✗ | ✗ | partial | ✓ | partial |
| Hyperswitch | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Medusa | ✓ | partial | ✓ | ✓ | ✗ | ✓ |
| **HyprPay** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |

Hyperswitch nails routing. Lago nails usage billing. Medusa nails commerce composability. None of them are "the SDK you import" — they are services you run. **HyprPay is the SDK.** Same gap better-auth filled vs Auth0/Cognito/Supabase Auth.

---

## Audit of `modules/billing` — what stays, what dies

Total: **4340 LOC** across 10 routers, 3 workflows, 5 services.

| Area | LOC | Verdict | Reason |
|---|---|---|---|
| `router/services.ts` + variants | 522 | ✗ DROP | "Service" is Montte-speak. Replace with generic `products` + `prices` (Stripe model). |
| `services/pricing-engine.ts` | 610 | ✗ HOST | Domain rules merging meters/benefits/coupons/usage. Belongs in host app. SDK exposes line-item primitive. |
| `router/benefits.ts` + `benefit-grants` schema + `benefit-lifecycle-workflow` | 421 | ✗ DROP | Entitlements ≠ billing. Host computes entitlement from `subscription_items.priceId`. |
| `router/contacts.ts` | 368 | ✗ DROP | Identity duplication with host's auth. Replaced by `customers.externalId` pointing at host user/org. |
| `router/coupons.ts` + schema | 481 | ⚠ STRIP | Conditions DSL (`dayOfWeek`, `meterIds`), surcharge direction, auto-trigger = bloat. Strip to Stripe-minimum. Rename `discounts`. |
| `router/customer-portal.ts` | 38 | ⚠ MOVE | Goes into `stripe()` gateway plugin (Stripe-specific concept). |
| `router/billing.ts` (`getEventCatalog`) | 16 | ✗ DROP | Static taxonomy = constants, not API. |
| `router/subscriptions.ts` | 416 | ✓ KEEP, lean | Core. Some procs (`getMrr`, `getActiveCountByPrice`) → analytics plugin. |
| `router/usage.ts` + `meters.ts` | 313 | ✓ KEEP | Core usage-based billing. |
| `services/invoice-builder.ts` | 123 | ✓ KEEP | Invoice generation primitive. |
| `services/cost.ts`, aggregates | 288 | ⚠ HOST | Analytics. Host or `analytics()` plugin. |
| 7 ownership middlewares | 136 | ✓ KEEP, regen | Per-plugin ownership middleware (4 generic ones in lean version). |
| `sse.ts` (6 events) | 35 | ✗ DROP | Use SDK event bus. Host bridges to SSE. |
| 3 DBOS workflows (benefit/period-end/trial) | 880 | ✓ HOST WIRES | SDK emits events; host enqueues workflows. SDK never imports DBOS. |

**Net:** ~3000 LOC of domain bloat moves to host. ~1300 LOC of true billing primitives ports into HyprPay plugins (cleaner).

---

## Domain model — agnostic primitives

Stripe's API objects are the right abstraction (the field has converged). Use them.

```
customers              host identity pointer (single externalId, no dual lookup)
products               what's sold
prices                 pricing config attached to product
meters                 usage definitions
subscriptions          active billing cycle
subscription_items     what's billed in a subscription
usage_events           raw metered events (idempotent)
invoices               billed period snapshot
invoice_lines          line items
discounts              code, percent_off | amount_off, duration, scope
payments               charge attempts (gateway-routed)
refunds                refund records
gateway_accounts       per-customer gateway-specific identifiers (stripe_customer_id, etc.)
webhook_events         received gateway webhook log (dedupe + replay)
```

13 tables, all map 1:1 to Stripe API objects → familiar mental model, every gateway plugin can implement them, host devs already understand them.

**No `services`. No `benefits`. No `contacts`. No `tags`. No `centro_de_custo`. No `event_catalog`.**

---

## Plugin architecture

```ts
import { hyprpay } from "@montte/hyprpay";
import { drizzleAdapter } from "@montte/hyprpay/database/drizzle";
import {
  customers, products, subscriptions, usage, invoices, discounts,
} from "@montte/hyprpay/plugins";
import { stripe } from "@montte/hyprpay/gateways/stripe";

export const payments = hyprpay({
  database: drizzleAdapter(db, { schemaName: "billing" }),
  getSession: (req) => ({ userId, customerId }),
  plugins: [
    customers(),
    products(),
    subscriptions(),
    usage(),
    invoices(),
    discounts(),
    stripe({ apiKey, webhookSecret }),
  ],
});
```

**Layers:**

```
┌─ Capability plugins (composable) ──────────────────────────┐
│ customers · products · subscriptions · usage · invoices    │
│ discounts · taxes · dunning · marketplace · audit          │
│ analytics · customer-portal · emails                       │
└────────────────────────────────────────────────────────────┘
                              │
┌─ Routing engine (Hyperswitch-style) ───────────────────────┐
│ priority · volumeSplit · rules · smart-retry               │
└────────────────────────────────────────────────────────────┘
                              │
┌─ Gateway plugins (composable) ─────────────────────────────┐
│ stripe · paddle · lemonsqueezy · mollie · adyen · braintree│
│ asaas · pagarme · mercado-pago · razorpay                  │
│ coinbase-commerce · now-payments (crypto)                  │
└────────────────────────────────────────────────────────────┘
                              │
┌─ Adapters ─────────────────────────────────────────────────┐
│ database: drizzle · prisma · kysely · mongo                │
│ framework: nextjs · hono · express · sveltekit · nuxt · bun│
└────────────────────────────────────────────────────────────┘
```

Every box = a plugin or adapter, shipped via subpath, written/forked by anyone.

---

## What HyprPay solves natively (the painful parts of payments)

| Pain | How HyprPay handles it |
|---|---|
| **Webhook hell** | Gateway plugin verifies + parses + emits to engine event bus. `webhook_events` table dedupes. Host subscribes to typed events. |
| **Idempotency** | Caller key on public mutations. Engine derives keys for retries/webhooks. Workflow-engine-friendly (host's DBOS/Inngest gets crash-safe). |
| **Gateway lock-in** | Sub-adapter contract (Q4 design). Capability plugins call `ctx.gateways[id].subscriptions.create(...)`. Switching gateway = swap plugin. |
| **Multi-gateway routing** | `priority` / `volumeSplit` / `rules` strategies. Smart retry on failure. Per-customer connector accounts override default creds. |
| **Trial / cancel-at-period-end / proration** | Subscription state machine baked in. SDK emits `trial.ending`, `period.closing`. Host wires workflow. |
| **Usage-based billing** | First-class. `usage_events` ingest (idempotent), meters (sum/count/last/max aggregations), period-close hook produces invoice lines. |
| **Multi-currency** | `@f-o-t/money` baked in. All amounts as decimal strings. Formatter built-in. |
| **Tax** | `tax()` plugin slot. Adapters: `stripeTax()`, `taxjar()`, `manualRates()`. Computed during invoice finalization. |
| **Dunning** | `dunning()` plugin emits `payment.retry_due` events on failure. Host workflow executes retries. Configurable schedule (exponential, fixed, custom). |
| **Marketplace / Connect** | `marketplace()` plugin: `application_fee`, `transfer_data`. Gateway plugin implements. |
| **Customer portal** | `customerPortal()` plugin = generic primitive (`createSession({ customerId, returnUrl })`). Gateway plugin implements (Stripe portal, custom hosted). |
| **Audit log** | `audit()` plugin auto-records every mutation with diff. Time-travel queries. |
| **Schema migrations** | CLI: `hyprpay generate` (SQL) / `hyprpay migrate` (apply). Done. |
| **Type safety** | `$InferServerPlugin` chain. Client = typed oRPC. No codegen step. |

---

## Scope tiers

### Tier 1 — v1 OSS launch (must-have)

Capability plugins:
1. `customers()`
2. `products()`
3. `subscriptions()` — trial, active, canceled, cancel-at-period-end, lifecycle events
4. `usage()` — meters + ingest + aggregate (sum/count/last/max)
5. `invoices()` — generate from subscription, finalize, mark paid; manual line items
6. `discounts()` — code, percent/fixed, duration, scope to price/customer

Gateway plugins:
1. `stripe()` — full surface (customers, subscriptions, charges, webhooks, portal)

Framework adapters:
1. `nextjs()` — App Router route handler
2. `hono()` — middleware
3. `bun()` — `Bun.serve` handler

Database adapters:
1. `drizzle` ✓ (done)
2. `prisma`
3. `kysely`

CLI:
1. `generate` — SQL ✓ (done)
2. `generate --output drizzle` — emit `schema.ts` for type-safe queries
3. `migrate` ✓ (done)
4. `add <plugin>` — scaffold plugin file in user's repo
5. `dashboard` — local web UI for inspecting state (like Drizzle Studio for billing)

Plumbing already built: factory, plugin loader, schema merger, event bus, routing skeleton, errors, idempotency, drizzle adapter, DDL generator. **~50% of v1 core is shipped.**

### Tier 2 — v2 (differentiators)

- Gateways: `paddle()`, `mercadoPago()`, `asaas()`, `lemonSqueezy()`, `mollie()`
- Capability: `tax()`, `dunning()`, `customerPortal()`, `proration()`, `audit()`
- Framework: `express()`, `sveltekit()`, `nuxt()`, `nestjs()`
- DB: `mongo` adapter
- Auth integrations: `betterAuth()`, `clerk()`, `supabase()` plugins (resolve `customerId` from session)
- Multi-gateway routing strategies: `priority`/`volumeSplit`/`rules` actually wired into payment flow

### Tier 3 — v3 (ecosystem)

- Gateways: `adyen()`, `braintree()`, `razorpay()`, `pagarme()`, `coinbaseCommerce()`, `nowPayments()`
- Capability: `marketplace()`, `creditNotes()`, `analytics()`, `emails()`, `portal-react()` (UI components)
- Tax adapters: `taxjar()`, `avalara()`
- Hosted dashboard (optional managed offering, like better-auth ↔ Polar)
- Embeddable React: `<PaymentForm/>`, `<PricingTable/>`, `<CustomerPortal/>`

---

## Migration path for Montte

1. **Build v1 plugins in `libraries/hyprpay`** — `customers`, `products`, `subscriptions`, `usage`, `invoices`, `discounts`, `stripe()`.
2. **In Montte web app:** instantiate `hyprpay({...})`, mount handler, replace `apps/web/src/integrations/orpc/router/index.ts` references to `modules/billing/router/*` with the typed oRPC client from HyprPay.
3. **Move pricing-engine.ts (610 LOC) to `apps/web/src/integrations/billing/pricing.ts`** — host-side computation feeding HyprPay's `invoices.createDraft({ lines })`.
4. **Wire DBOS workflows** in `apps/worker`: subscribe to `payments.events.on("subscription.period_ended", ...)`, enqueue period-end-invoice. Same for trial-expiry.
5. **Schema migration** — `hyprpay generate -o billing-schema.sql`, apply alongside drop of old billing tables. (Data migration script: `services → products+prices`, `subscriptions` direct copy, `meters` direct, `coupons → discounts` with strip.)
6. **Drop**: `modules/billing/`, `core/stripe` (legacy), `core/sse` billing events, `services` schema, `benefits/benefit-grants` schemas, `contacts` (replaced by `customers`), `tags` (drop entirely or move to a Montte-specific module).
7. **Frontend update**: 7 `apps/web` files importing `modules/billing` types/routers → import from typed HyprPay client.

---

## What's missing from current HyprPay state

Already shipped: core engine, drizzle adapter, CLI (generate/migrate), 17 tests passing.

| Missing | Tier | Notes |
|---|---|---|
| 6 capability plugins | 1 | The bulk of v1 work. |
| `stripe()` gateway plugin | 1 | Sub-adapters: customers, subscriptions, charges, webhooks. |
| Framework adapters (Next/Hono/Bun) | 1 | Thin wrappers over the existing `handler`. |
| Prisma + Kysely adapters | 1 | Same DDL generator + per-ORM query layer. |
| `generate --output drizzle` mode | 1 | Emit TS file with `pgTable(...)` + relations. |
| `add <plugin>` scaffolder | 1 | Templates in `libraries/hyprpay/templates/`. |
| `dashboard` CLI cmd | 1 | Optional, ships post-v1. |
| Idempotency middleware for procedures | 1 | Wrap public mutations to write-through `IdempotencyStore`. |
| Webhook framework helpers | 1 | `verifyHMAC()`, `parseStripeEvent()`, etc. |
| Money / currency module | 1 | Bake in `@f-o-t/money` patterns. |
| Customer portal generic endpoint | 1 | Engine primitive; gateway plugins implement. |
| Plugin counterpart client (`$InferServerPlugin`) | 1 | Better-auth-style typed client extension. |
| Docs site + examples | 1 | Critical for OSS adoption. |

**Effort estimate to v1 OSS launch:** 6 capability plugins + Stripe + 3 framework adapters + 2 DB adapters + 4 CLI commands + docs.

---

## Manifesto (the elevator pitch)

> **HyprPay** is the type-safe, self-hostable, gateway-agnostic billing SDK for modern TypeScript apps. Drop it into your backend, pick a gateway, compose plugins. Subscriptions, usage-based billing, invoices, multi-gateway routing — all owned by you, all in your database, all behind one typed client.
>
> What better-auth did for authentication, HyprPay does for payments.
