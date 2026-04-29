# HyprPay Rewrite — Composable Payment SDK

**Date:** 2026-04-28
**Status:** Design locked; v0.1 = core only
**Location:** `libraries/hyprpay` (in-place refactor)
**Package:** `@montte/hyprpay` (unchanged)

---

## Vision

HyprPay becomes a **self-host server library** for billing/payments, modeled on `better-auth`: a single `hyprpay()` factory composed from plugins, with adapter slots for the infra it depends on. Montte uses it like any other consumer; the SaaS-only `createHyprPayClient` model is retired.

Two plugin layers:

- **Gateway adapter plugins** (bottom) — `stripe()`, `asaas()`, `mercadoPago()`, … Each wraps a payment provider and registers per-capability sub-adapters.
- **Capability plugins** (top) — `subscriptions()`, `usage()`, `customerPortal()`, `coupons()`, `seats()`, `montte()`. Each adds tables, oRPC procedures, hooks, event subscriptions.

Architecture is composable from day one but **v0.1 ships core only** — engine, interfaces, type machinery. Concrete adapters and plugins land v0.2+.

---

## Top-level config

```ts
import { hyprpay } from "@montte/hyprpay";
import { drizzleAdapter } from "@montte/hyprpay/database/drizzle";
import { dbosEngine } from "@montte/hyprpay/workflow/dbos";
import { resendEngine } from "@montte/hyprpay/email/resend";
import { stripe } from "@montte/hyprpay/gateways/stripe";
import {
  subscriptions,
  usage,
  customerPortal,
} from "@montte/hyprpay/plugins";

export const payments = hyprpay({
  database: drizzleAdapter(db),
  workflow: dbosEngine({ client: dbosClient }),
  email: resendEngine({ apiKey: env.RESEND_KEY, from: "billing@x.com" }),

  // host wires session — mirrors better-auth's user/session model
  getSession: async (req) => ({
    userId: "...",
    /* activeOrganizationId added by organization plugin if installed */
  }),

  plugins: [
    stripe({ apiKey: env.STRIPE_KEY, webhookSecret: env.STRIPE_WHSEC }),
    subscriptions(),
    usage(),
    customerPortal(),
  ],
});

// host integration
export const handler = payments.handler; // fetch-API handler (oRPC RPCHandler)
export const api = payments.api;          // server-side direct call surface
export type PaymentsRouter = typeof payments.router;
```

**Returned object:**

| Key       | Purpose |
|-----------|---------|
| `handler` | Fetch handler (wraps oRPC `RPCHandler`). Mount on Hono/Next/Express. |
| `router`  | Merged oRPC router (all plugin contracts namespaced). |
| `api`     | Server-side direct call (`payments.api.subscriptions.create({...})`). |
| `events`  | Typed event bus for cross-plugin reactions. |
| `$Infer`  | Type-only export with merged plugin types. |

---

## Core decisions (locked)

| # | Decision | Rationale |
|---|---|---|
| 1 | Two plugin layers (gateway + capability) | User picks gateway, capability layer stays gateway-agnostic. |
| 2 | Self-host server library (better-auth model) | Domain ownership, swappable backend. SaaS-only client retired. |
| 3 | HyprPay owns full schema; plugins extend via `additionalFields` | Like better-auth tables. Migrations shipped. |
| 4 | Per-capability sub-adapters per gateway | Type-level capability presence; `UnsupportedCapability` impossible at type level. |
| 5 | Session-based scoping (better-auth style); tenancy via plugin | `getSession` returns user; `organization()` plugin adds `activeOrganizationId`. No abstract dimension system. |
| 6 | **oRPC as the transport** | Reuses oRPC `RPCHandler` for Hono/Next/Express. Plugins ship oRPC contracts. |
| 7 | Webhooks: per-gateway endpoint + engine event bus | Transport (gateway parses & verifies) decoupled from dispatch (capability plugins subscribe). |
| 8 | Pure better-auth plugin shape — `id`, `schema`, `hooks`, `init`, `$Infer`, `$ERROR_CODES` (+ `router` instead of `endpoints`) | No special slots; gateway/event registration via `init`. |
| 9 | Routing engine = Hyperswitch-inspired (priority/volumeSplit/rules + smart retry) | MVP default = `priority([firstInstalledGateway])`. Real strategies land with multi-gateway. |
| 10 | Montte plugin = pure sync (push events to Montte SaaS) | MVP. Bidirectional later. |
| 11 | Idempotency: caller key required on public mutations; engine derives keys for internal retries/webhooks | Workflow engine durability gives internal idempotency naturally. |
| 12 | Engine slots: `database`, `workflow`, `email` | Pluggable infra. MVP impls: drizzle, dbos, resend. |
| 13 | MVP gateway: Stripe only | Smart routing trivial with one gateway. |
| 14 | MVP capability plugins: subscriptions, usage, customerPortal | Contacts handled by host app. Coupons/seats deferred. |

---

## Plugin contract

```ts
import { oc } from "@orpc/contract";
import type { HyprPayPlugin } from "@montte/hyprpay";

export const subscriptions = (): HyprPayPlugin => ({
  id: "subscriptions",

  schema: {
    subscriptions: {
      fields: {
        status: { type: "string", required: true },
        gatewayId: { type: "string", required: true },
        currentPeriodStart: { type: "date" },
        currentPeriodEnd: { type: "date" },
        // userId / activeOrganizationId injected by core/org plugin
      },
    },
    subscriptionItems: { fields: { /* ... */ } },
  },

  router: {
    create: oc
      .input(z.object({ /* ... */ }))
      .output(subscriptionRow)
      .handler(async ({ context, input }) => {
        const gateway = context.routing.resolve(context);
        const remote = await context.gateways[gateway].subscriptions.create(input);
        // persist via context.db
        context.events.emit("subscription.created", { /* ... */ });
        return /* row */;
      }),
    cancel: oc.input(...).handler(...),
  },

  hooks: {
    before: [
      { matcher: (ctx) => ctx.path === "/subscriptions/create", handler: ... },
    ],
  },

  init: (ctx) => ({
    context: {
      // extend ctx for downstream plugins
    },
  }),

  $Infer: {
    Subscription: {} as Subscription,
  },

  $ERROR_CODES: {
    SUBSCRIPTION_NOT_FOUND: "Assinatura não encontrada.",
  },
});
```

**Endpoint context (`context`) provides:**

| Key | Type | From |
|---|---|---|
| `db` | `DatabaseAdapter` | `database` engine |
| `session` | `Session` (typed by `getSession` + plugin extensions) | `getSession` |
| `gateways` | `{ stripe: StripeSubAdapters, … }` | gateway plugins via `init` |
| `workflow` | `WorkflowEngine` | `workflow` slot |
| `email` | `EmailEngine` | `email` slot |
| `events` | `EventBus<UnionOfEvents>` | core |
| `routing` | `RoutingEngine` (`resolve(ctx) → gatewayId`) | core |
| `request` / `headers` | request plumbing | oRPC |

**Gateway plugin** = same shape, registers sub-adapters via `init`:

```ts
export const stripe = (config: StripeConfig): HyprPayPlugin => ({
  id: "stripe",
  schema: { stripeWebhookEvents: { /* ... */ } },
  router: {
    webhook: oc
      .input(z.unknown())
      .handler(async ({ context, input, request }) => {
        const event = verifyAndParse(request, config.webhookSecret);
        context.events.emit("charge.succeeded", normalize(event));
        return { received: true };
      }),
  },
  init: (ctx) => ({
    context: {
      gateways: {
        ...ctx.gateways,
        stripe: makeStripeSubAdapters(config.apiKey),
      },
    },
  }),
});
```

**Sub-adapter contract (per capability):**

```ts
type StripeSubAdapters = {
  customers?: { create, update, retrieve, delete };
  subscriptions?: { create, update, cancel, retrieve };
  charges?: { create, refund, capture };
  webhooks?: { verify, parse };
};
```

A gateway plugin only declares the sub-adapters it implements. TypeScript ensures capability plugins can only call sub-adapters that exist on at least one installed gateway.

---

## Engine internals

### Routing engine (Hyperswitch-inspired)

```ts
import { priority, volumeSplit, rules } from "@montte/hyprpay/routing";

routing: priority(["stripe", "asaas"]),
// or
routing: volumeSplit({ stripe: 70, asaas: 30 }),
// or
routing: rules([
  { when: (ctx) => ctx.amount > 1000_00, then: "stripe" },
  { fallback: "asaas" },
]),
```

- **Connector accounts table** (per-scope cred override): `connector_accounts(scope, gatewayId, encryptedCreds)`. Plugin's instantiation creds = default fallback.
- **Smart retry** — on gateway error, engine consults router for next candidate; preserves caller idempotency key.
- **MVP** — single gateway, default `priority([firstInstalledGateway])`. Strategies are real but mostly inert until multi-gateway.

### Event bus

```ts
type CoreEvents =
  | { type: "subscription.created"; payload: ... }
  | { type: "subscription.canceled"; payload: ... }
  | { type: "charge.succeeded"; payload: ... }
  | { type: "charge.failed"; payload: ... }
  | { type: "invoice.finalized"; payload: ... };

context.events.emit(type, payload);
context.events.on(type, async (payload) => { ... });
```

Plugins extend `CoreEvents` via module augmentation. Bus is in-process; for cross-process delivery, host wraps with their own queue.

### Idempotency

- **Public mutations** require `idempotencyKey` in input. Stored `(scope, key) → response` via `database` adapter.
- **Internal retries / webhook re-delivery** — engine derives deterministic keys (e.g., `webhook:stripe:${eventId}`).
- **Workflow engine durability** — DBOS workflows give crash-safe internal idempotency on retries.

### Errors

`HyprPayError` with typed codes, neverthrow-friendly. Plugins declare codes via `$ERROR_CODES`. Messages in pt-BR by default; locale slot for v0.2+.

---

## Engine adapter interfaces (v0.1)

```ts
interface DatabaseAdapter {
  // schema-aware CRUD; engine merges all plugin schemas + injects core cols
  create<T>(table, values): Promise<T>;
  findOne<T>(table, where): Promise<T | null>;
  findMany<T>(table, where, opts): Promise<T[]>;
  update<T>(table, where, values): Promise<T>;
  delete(table, where): Promise<void>;
  transaction<T>(fn: (tx) => Promise<T>): Promise<T>;
  // migrations
  applyMigrations(schema: MergedSchema): Promise<void>;
}

interface WorkflowEngine {
  enqueue(name: string, payload: unknown, opts?: { delaySeconds?: number; idempotencyKey?: string }): Promise<void>;
  schedule(name: string, cron: string, payload: unknown): Promise<void>;
  registerWorkflow(name: string, fn: WorkflowFn): void;
}

interface EmailEngine {
  send(template: string, props: { to: string; data: Record<string, unknown> }): Promise<void>;
  registerTemplate(name: string, render: (data) => { subject: string; html: string }): void;
}
```

**v0.2+ ships:** `drizzleAdapter`, `dbosEngine`, `resendEngine`. Plus `stripe()` gateway and capability plugins.

---

## Type inference

```ts
type Payments = typeof payments;
type Router = Payments["router"];
type Subscription = Payments["$Infer"]["subscription"]["Subscription"];

// Client (consumer apps)
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { PaymentsRouter } from "./payments";

const link = new RPCLink({ url: "/api/payments" });
export const paymentsClient = createORPCClient<PaymentsRouter>(link);

// fully-typed: paymentsClient.subscriptions.create({ ... })
```

Better-auth-style `$InferServerPlugin` chain: client plugin counterpart imports server plugin's `$Infer` to expose typed actions.

---

## Repo layout (post-refactor)

```
libraries/hyprpay/
├── src/
│   ├── index.ts                  # hyprpay() factory + types
│   ├── core/
│   │   ├── plugin-loader.ts
│   │   ├── schema-merger.ts
│   │   ├── router-builder.ts     # merges plugin oRPC routers
│   │   ├── event-bus.ts
│   │   ├── routing.ts            # priority/volumeSplit/rules + retry
│   │   ├── idempotency.ts
│   │   ├── session.ts
│   │   └── errors.ts
│   ├── adapters/
│   │   ├── database.ts           # DatabaseAdapter interface
│   │   ├── workflow.ts           # WorkflowEngine interface
│   │   └── email.ts              # EmailEngine interface
│   └── types.ts                  # HyprPayPlugin, sub-adapter contracts, $Infer
├── package.json
├── README.md
└── ...
```

Subpath exports for v0.2+:

```
@montte/hyprpay
@montte/hyprpay/database/drizzle
@montte/hyprpay/workflow/dbos
@montte/hyprpay/email/resend
@montte/hyprpay/gateways/stripe
@montte/hyprpay/plugins         # subscriptions, usage, customerPortal
@montte/hyprpay/routing         # priority, volumeSplit, rules
@montte/hyprpay/client          # createHyprPayClient (typed oRPC client)
```

---

## Migration & retirement

- Existing `libraries/hyprpay/src/contract.ts`, `client.ts`, `better-auth/` — rewritten/replaced.
- Existing consumers in `apps/web` need migration to the new factory + handler. Old `createHyprPayClient` removed; replaced by oRPC-typed client from `@montte/hyprpay/client`.
- Better-auth plugin subpath stays but is rebuilt against the new core (gets session into `getSession`).

---

## v0.1 deliverables (this rewrite)

- `hyprpay()` factory + plugin loader
- `HyprPayPlugin` contract types + sub-adapter contracts
- `DatabaseAdapter`, `WorkflowEngine`, `EmailEngine` interfaces (no impls)
- Session model + `getSession` slot
- Schema merger (no migration runner yet)
- Event bus
- oRPC router builder + fetch handler
- Routing engine skeleton with `priority` strategy
- Idempotency interface
- Error system + `$ERROR_CODES`
- Type-inference machinery (`$Infer`)
- Vitest setup + shape tests

**Out of scope for v0.1:** drizzle/dbos/resend impls, stripe gateway, capability plugins, migrations runner, smart retry, multi-gateway routing, Montte sync plugin, cli.

---

## Open questions deferred

1. Migrations runner — own format, or piggyback on host's drizzle-kit?
2. Currency/money model — single `@f-o-t/money` baked in, or pluggable?
3. Connector accounts encryption-at-rest — engine slot or host concern?
4. Locale/i18n for error messages — v0.2 slot.
5. Telemetry/observability — slot or just hooks?

These don't block v0.1 since it ships interfaces only.
