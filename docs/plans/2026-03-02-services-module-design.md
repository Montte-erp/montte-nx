# Services Module — Design Document

**Date:** 2026-03-02
**Status:** Design approved, pending implementation
**Feature flag:** `services` (alpha)

---

## Context

Two companies use this app and need their own service catalog tracked here:

- **Coworking** — currently uses Conexa ERP, wants to migrate. Sells shared desk time (hourly + monthly packages). Manages client contracts with negotiated pricing and discounts. Future: booking/resource management to prevent overbooking.
- **SaaS** — uses Asaas for recurring billing. Wants their subscriptions and payment data pulled into the app automatically via Asaas webhooks.

Both companies need revenue analytics per service and client subscription tracking with discount visibility.

---

## Architecture Overview

```
apps/
├── server/          (renamed from sdk-server) — HTTP only: receives requests, validates, enqueues jobs
└── worker/          — BullMQ jobs + cron schedulers only, no HTTP server
packages/
└── database/
    └── schemas/services.ts   — new schema
    └── repositories/services-repository.ts
```

**Responsibility boundary:**
| App | Does | Does NOT |
|---|---|---|
| `server` | HTTP endpoints, auth, signature validation, enqueue jobs | Process jobs |
| `worker` | BullMQ job processors | Receive HTTP requests, run crons |
| Railway lambdas | Cron-triggered jobs (scheduled tasks) | — |

**Asaas webhook flow:**

```
Asaas → POST /webhooks/asaas → server (validate signature + enqueue job)
                                          ↓
                                   worker processes job (sync contacts/subscriptions to DB)
```

---

## Data Model

All tables are `teamId`-scoped.

### `services`

Base service catalog entry.

```ts
{
  id:          uuid PK
  teamId:      uuid FK → team.id (cascade delete)
  name:        text NOT NULL
  description: text
  category:    text          -- optional grouping label
  isActive:    boolean       -- default true
  createdAt:   timestamp
  updatedAt:   timestamp
}
```

### `service_variants`

Pricing options per service. A service can have multiple variants.

```ts
{
  id:           uuid PK
  serviceId:    uuid FK → services.id (cascade delete)
  teamId:       uuid FK → team.id (cascade delete)
  name:         text NOT NULL    -- e.g. "Por Hora", "Pacote Mensal"
  basePrice:    integer NOT NULL -- cents (minor units, @f-o-t/money)
  billingCycle: enum('hourly', 'monthly', 'annual', 'one_time')
  isActive:     boolean default true
  createdAt:    timestamp
  updatedAt:    timestamp
}
```

### `contact_subscriptions`

Contract/booking per client. Links a contact to a service variant.

```ts
{
  id:               uuid PK
  teamId:           uuid FK → team.id (cascade delete)
  contactId:        uuid FK → contacts.id (cascade delete)
  variantId:        uuid FK → service_variants.id (cascade delete)
  startDate:        date NOT NULL
  endDate:          date           -- nullable = open-ended contract
  negotiatedPrice:  integer NOT NULL -- cents, actual price per cycle
  notes:            text
  status:           enum('active', 'completed', 'cancelled') default 'active'
  source:           enum('manual', 'asaas') default 'manual'
  externalId:       text           -- Asaas subscription ID, nullable
  resourceId:       uuid           -- nullable, reserved for future booking
  createdAt:        timestamp
  updatedAt:        timestamp
}
```

**Derived discount** (never stored):

```
discount% = ((basePrice - negotiatedPrice) / basePrice) * 100
```

### `resources` _(schema only, not used in v1)_

Reserved for future booking/overbooking prevention.

```ts
{
  id:       uuid PK
  teamId:   uuid FK
  serviceId: uuid FK → services.id
  name:     text    -- e.g. "Desk 12", "Sala A"
  capacity: integer default 1
  isActive: boolean default true
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Schema additions on existing tables

**`contacts`:**

```ts
source:     enum('manual', 'asaas') default 'manual'
externalId: text  -- Asaas customer ID, nullable
```

---

## Money Handling

All monetary values stored as **integers (cents)** — consistent with `transactions`, `bills`, `bank_accounts`.

- **Input:** `MoneyInput` from `@packages/ui/components/money-input`
- **Display:** `formatAmount(fromMinorUnits(cents, "BRL"), "pt-BR")` from `@f-o-t/money`
- **Derived discount:** integer arithmetic on cents

---

## Auto-Bill Generation

When a subscription is saved, bills (receivable) are auto-created in the existing `bills` table.

| `billingCycle` | Behavior                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `monthly`      | One bill per month between `startDate` and `endDate`, `dueDate` = same day of month as `startDate` |
| `annual`       | One bill                                                                                           |
| `one_time`     | One bill                                                                                           |
| `hourly`       | **No auto-generation** — too granular, created manually per session                                |

Each bill gets:

- `type: 'receivable'`
- `contactId` — the subscribed contact
- `description` — `"[Service Name] – [Variant Name] ([Month/Year])"` e.g. `"Espaço Compartilhado – Pacote Mensal (Mar/2026)"`
- `amount` — `negotiatedPrice` in cents

Bills are created at subscription creation time, not lazily. If the subscription is cancelled, pending unpaid bills are marked `cancelled`.

---

## Subscription Form UX

1. Select **service** → select **variant** (shows base price)
2. Set **start date** + **end date** (or number of months)
3. Enter **negotiated price** via `MoneyInput` — system shows derived discount % live
4. Notes (optional)
5. Save → auto-generate bills

Asaas-sourced subscriptions show a `"Sincronizado via Asaas"` badge. Edit/delete is disabled for `source: 'asaas'` records.

---

## Revenue Analytics

Displayed on the services index page as a summary header above the table.

- **Revenue by service** — total billed this month/quarter/year (from existing `bills` data)
- **Active subscriptions** — count per variant
- **Average discount** — per service, derived from base vs negotiated price
- **Expiring soon** — subscriptions with `endDate` within the next 30 days

No new analytics tables. All data comes from `contact_subscriptions` + `bills`.

For heavier aggregations (e.g. monthly revenue rollups), a **Railway lambda cron** (hourly) recomputes a materialized summary — consistent with how insights/credits reconciliation already works in this project. The worker is not involved in scheduling.

---

## Feature Gating (Alpha)

### Sidebar — `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

Add to `erp` group:

```ts
{
  id: "services",
  label: "Serviços",
  icon: Briefcase,
  route: "/$slug/$teamSlug/erp/services",
  earlyAccessFlag: "services",
}
```

### Billing overview — `EARLY_ACCESS_CATEGORY_GATES`

```ts
service: { flag: "services", fallbackStage: "alpha" }
```

PostHog is the source of truth for stage. `"alpha"` is the fallback only.

---

## Asaas Integration

### Webhook receiver — `apps/server/`

New public endpoint:

```
POST /webhooks/asaas
```

Responsibilities:

1. Verify Asaas signature (token from env `ASAAS_WEBHOOK_TOKEN`)
2. Respond `200 OK` immediately
3. Enqueue BullMQ job `asaas.webhook` with raw payload

### Worker job — `apps/worker/src/jobs/process-asaas-webhook.ts`

Handles sync logic per event type:

| Asaas event              | Action                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| `CUSTOMER_CREATED`       | Upsert contact (`externalId` = Asaas customer ID, `source: 'asaas'`)          |
| `CUSTOMER_UPDATED`       | Update contact name/email/phone/document                                      |
| `SUBSCRIPTION_CREATED`   | Upsert service variant + create `contact_subscription` (`source: 'asaas'`)    |
| `SUBSCRIPTION_UPDATED`   | Update subscription status, price, dates                                      |
| `SUBSCRIPTION_CANCELLED` | Set subscription `status: 'cancelled'`, cancel pending bills                  |
| `PAYMENT_RECEIVED`       | Create `transaction` (income) linked to `contactId`, tagged with service name |

Matching strategy:

- Contacts matched by `externalId` (Asaas customer ID)
- Subscriptions matched by `externalId` (Asaas subscription ID)
- Service + variant auto-created from Asaas plan name if not found

### Environment variable

```
ASAAS_WEBHOOK_TOKEN=<token from Asaas dashboard>
```

Added to `packages/environment/src/server.ts` and `worker.ts`.

---

## Future: Booking & Resource Management

The `resources` table is created now but unused. When implemented:

- `resources` defines physical units (desks, rooms) with capacity
- `resource_bookings` links a contact + time slot + resource
- Overbooking prevention: check `resource_bookings` overlap before confirming
- Hourly subscriptions gain time-slot selection in the booking form

The `resourceId` nullable column on `contact_subscriptions` is already reserved for this link.

---

## Implementation Checklist

- [ ] Rename `apps/sdk-server` → `apps/server` (Nx project rename)
- [ ] DB schema: `services`, `service_variants`, `contact_subscriptions`, `resources`
- [ ] DB schema: add `source` + `externalId` to `contacts`
- [ ] Repositories: services, service_variants, contact_subscriptions
- [ ] oRPC router: `services` (CRUD + subscriptions)
- [ ] Auto-bill generation on subscription create/cancel
- [ ] UI: service catalog page + forms
- [ ] UI: subscription form with live discount calculation
- [ ] UI: revenue analytics header
- [ ] Sidebar nav item + PostHog feature flag (`services`)
- [ ] Billing overview early access card
- [ ] `apps/server`: `POST /webhooks/asaas` receiver
- [ ] Worker job: `process-asaas-webhook`
- [ ] Env vars: `ASAAS_WEBHOOK_TOKEN`
- [ ] `resources` table (schema only, no UI)
