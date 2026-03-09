# Usage-Based Billing (PostHog-style) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current credit/plan system with a fully metered PostHog-style billing model using Stripe Billing Meters + Better Auth Stripe `lineItems`.

**Architecture:** Every billable action emits an event that writes to PostgreSQL (existing) AND reports a Stripe Meter Event. Stripe accumulates usage and auto-bills at month end. Free tiers are enforced in-app via Redis counters keyed per org per product. Platform addons (Boost, Scale, Enterprise) and Mensageria addons (Telegram, WhatsApp) are fixed-price Stripe subscriptions managed via Better Auth's `lineItems`.

**Tech Stack:** Better Auth `@better-auth/stripe` v1.5.1, Stripe Billing Meters API (`stripe.billing.meterEvents.create`), Drizzle ORM, Redis (existing), `@f-o-t/money`, `packages/events/`, `packages/stripe/`, `packages/authentication/`

---

## Context & Decisions

### What changes

- **Remove:** `ai.completion` (FIM), `ai.image_generation` events and all references
- **Add events:** `contact.*`, `inventory.*`, `service.*`, `nfe.*`, `document.signed`
- **Plans removed:** FREE/LITE/PRO replaced by fully metered (no base subscription)
- **Credit pools replaced:** Redis free-tier counters per product (not two AI/platform pools)
- **Stripe Meters:** one meter per billable product, reported from `emitEvent()`
- **Addons:** Boost, Scale, Enterprise, Telegram, WhatsApp as Stripe products with `lineItems`

### New event catalog

| Event                            | Category  | Free/mês | Price BRL |
| -------------------------------- | --------- | -------- | --------- |
| `finance.transaction_created`    | finance   | 500      | R$0,001   |
| `finance.bank_account_connected` | finance   | 500      | free      |
| `ai.chat_message`                | ai        | 20       | R$0,02    |
| `ai.agent_action`                | ai        | 5        | R$0,04    |
| `webhook.delivered`              | webhook   | 500      | R$0,0005  |
| `contact.created`                | contact   | 50       | R$0,01    |
| `contact.updated`                | contact   | 50       | free      |
| `contact.deleted`                | contact   | 50       | free      |
| `inventory.item_created`         | inventory | 50       | R$0,01    |
| `inventory.item_updated`         | inventory | 50       | free      |
| `inventory.item_deleted`         | inventory | 50       | free      |
| `service.created`                | service   | 20       | R$0,01    |
| `service.updated`                | service   | 20       | free      |
| `service.deleted`                | service   | 20       | free      |
| `nfe.emitted`                    | nfe       | 5        | R$0,15    |
| `document.signed`                | document  | 10       | R$0,10    |

### Stripe Meters to create (one-time in Stripe dashboard)

- `finance_transactions` → `finance.transaction_created`
- `ai_chat_messages` → `ai.chat_message`
- `ai_agent_actions` → `ai.agent_action`
- `webhook_deliveries` → `webhook.delivered`
- `contact_creates` → `contact.created`
- `inventory_creates` → `inventory.item_created`
- `service_creates` → `service.created`
- `nfe_emissions` → `nfe.emitted`
- `document_signatures` → `document.signed`

### Platform Addons (Stripe Products)

- **Boost** R$199/mês — SSO, white label, 2FA enforcement, unlimited projects
- **Scale** R$599/mês — Boost + SAML, RBAC, audit logs, SLA 24h
- **Enterprise** R$2.500+/mês — holdings, multiple CNPJs, SLA 4h, custom
- **Telegram** R$29/mês — Telegram bot channel (Evolution API)
- **WhatsApp** R$39/mês — WhatsApp channel (Evolution API)
- **Bundle Mensageria** R$59/mês — Telegram + WhatsApp

### AI model

Default: `qwen/qwen3.5-35b-a3b` ($0.25/M input, $1/M output)

---

## Task 1: Remove CMS-era events and image generation

**Files:**

- Modify: `packages/events/src/ai.ts`
- Modify: `packages/events/src/catalog.ts`
- Modify: `packages/events/src/credits.ts`
- Modify: `packages/stripe/src/constants.ts`
- Modify: `scripts/seed-event-catalog.ts`

**Step 1: Remove `ai.completion` and `ai.image_generation` from `ai.ts`**

Delete:

- `AI_PRICING["ai.completion"]`
- `AI_PRICING["ai.image_generation"]`
- `IMAGE_MODEL_PRICING` constant and all image model entries
- `getImageGenerationPrice()` function
- `getImageGenerationPriceMinorUnits()` function
- `AI_EVENTS["ai.completion"]` and `AI_EVENTS["ai.image_generation"]`
- `aiCompletionEventSchema`, `AiCompletionEvent`, `emitAiCompletion()`
- `aiImageGenerationEventSchema`, `AiImageGenerationEvent`, `emitAiImageGeneration()`

Keep only: `ai.chat_message`, `ai.agent_action`

**Step 2: Search for all usages of removed exports**

```bash
grep -r "ai\.completion\|ai\.image_generation\|IMAGE_MODEL_PRICING\|getImageGenerationPrice\|emitAiCompletion\|emitAiImageGeneration\|aiCompletionEvent\|aiImageGenerationEvent" apps/ packages/ --include="*.ts" --include="*.tsx" -l
```

Fix every file that imports or uses any of the removed exports.

**Step 3: Update `catalog.ts` — add new categories**

```typescript
export const EVENT_CATEGORIES = {
   finance: "finance",
   ai: "ai",
   webhook: "webhook",
   dashboard: "dashboard",
   insight: "insight",
   contact: "contact",
   inventory: "inventory",
   service: "service",
   nfe: "nfe",
   document: "document",
   system: "system",
} as const;
```

**Step 4: Update `credits.ts` — replace two-pool system with per-product free tiers**

Replace `PLAN_CREDIT_BUDGETS` and `POOL_CATEGORIES` with a product-centric free tier config:

```typescript
// Free tier limits per product (resets monthly via Redis TTL)
export const FREE_TIER_LIMITS: Record<string, number> = {
   "finance.transaction_created": 500,
   "ai.chat_message": 20,
   "ai.agent_action": 5,
   "webhook.delivered": 500,
   "contact.created": 50,
   "inventory.item_created": 50,
   "service.created": 20,
   "nfe.emitted": 5,
   "document.signed": 10,
};
```

Replace Redis key pattern from `credits:{orgId}:{pool}_used` to `usage:{orgId}:{eventName}` — simpler, per-product.

**Step 5: Update `constants.ts` — remove plan tiers, add addon names**

```typescript
// Remove PlanName enum (FREE/LITE/PRO)
// Remove STRIPE_PLANS array
// Remove PLAN_PROJECT_LIMITS
// Remove PLAN_CREDIT_BUDGETS references

export enum AddonName {
   BOOST = "boost",
   SCALE = "scale",
   ENTERPRISE = "enterprise",
   TELEGRAM = "telegram",
   WHATSAPP = "whatsapp",
   MENSAGERIA_BUNDLE = "mensageria-bundle",
}

// Metered price per event in BRL
export const EVENT_PRICES: Record<string, string> = {
   "finance.transaction_created": "0.001000",
   "ai.chat_message": "0.020000",
   "ai.agent_action": "0.040000",
   "webhook.delivered": "0.000500",
   "contact.created": "0.010000",
   "inventory.item_created": "0.010000",
   "service.created": "0.010000",
   "nfe.emitted": "0.150000",
   "document.signed": "0.100000",
};

// Stripe Meter Event Names (must match what you created in Stripe dashboard)
export const STRIPE_METER_EVENTS: Record<string, string> = {
   "finance.transaction_created": "finance_transactions",
   "ai.chat_message": "ai_chat_messages",
   "ai.agent_action": "ai_agent_actions",
   "webhook.delivered": "webhook_deliveries",
   "contact.created": "contact_creates",
   "inventory.item_created": "inventory_creates",
   "service.created": "service_creates",
   "nfe.emitted": "nfe_emissions",
   "document.signed": "document_signatures",
};
```

**Step 6: Commit**

```bash
git add packages/events/src/ai.ts packages/events/src/catalog.ts packages/events/src/credits.ts packages/stripe/src/constants.ts
git commit -m "feat(billing): remove FIM/image events, add new categories and product-centric free tiers"
```

---

## Task 2: Add contact, inventory, service, nfe, document event files

**Files:**

- Create: `packages/events/src/contact.ts`
- Create: `packages/events/src/inventory.ts`
- Create: `packages/events/src/service.ts`
- Create: `packages/events/src/nfe.ts`
- Create: `packages/events/src/document.ts`
- Modify: `packages/events/package.json` (add exports)

**Step 1: Create `contact.ts`**

```typescript
import { z } from "zod";
import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const CONTACT_EVENTS = {
   "contact.created": "contact.created",
   "contact.updated": "contact.updated",
   "contact.deleted": "contact.deleted",
} as const;

export type ContactEventName =
   (typeof CONTACT_EVENTS)[keyof typeof CONTACT_EVENTS];

export const contactCreatedSchema = z.object({
   contactId: z.string().uuid(),
   type: z.enum(["person", "company"]),
});
export type ContactCreatedEvent = z.infer<typeof contactCreatedSchema>;

export function emitContactCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ContactCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: CONTACT_EVENTS["contact.created"],
      eventCategory: EVENT_CATEGORIES.contact,
      properties,
   });
}

export const contactUpdatedSchema = z.object({
   contactId: z.string().uuid(),
   changedFields: z.array(z.string()),
});
export type ContactUpdatedEvent = z.infer<typeof contactUpdatedSchema>;
export function emitContactUpdated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ContactUpdatedEvent,
) {
   return emit({
      ...ctx,
      eventName: CONTACT_EVENTS["contact.updated"],
      eventCategory: EVENT_CATEGORIES.contact,
      properties,
   });
}

export const contactDeletedSchema = z.object({ contactId: z.string().uuid() });
export type ContactDeletedEvent = z.infer<typeof contactDeletedSchema>;
export function emitContactDeleted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ContactDeletedEvent,
) {
   return emit({
      ...ctx,
      eventName: CONTACT_EVENTS["contact.deleted"],
      eventCategory: EVENT_CATEGORIES.contact,
      properties,
   });
}
```

**Step 2: Create `inventory.ts`**

```typescript
import { z } from "zod";
import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const INVENTORY_EVENTS = {
   "inventory.item_created": "inventory.item_created",
   "inventory.item_updated": "inventory.item_updated",
   "inventory.item_deleted": "inventory.item_deleted",
} as const;

export type InventoryEventName =
   (typeof INVENTORY_EVENTS)[keyof typeof INVENTORY_EVENTS];

export const inventoryItemCreatedSchema = z.object({
   itemId: z.string().uuid(),
   sku: z.string().optional(),
   type: z.enum(["product", "service", "raw_material"]).optional(),
});
export type InventoryItemCreatedEvent = z.infer<
   typeof inventoryItemCreatedSchema
>;
export function emitInventoryItemCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: InventoryItemCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: INVENTORY_EVENTS["inventory.item_created"],
      eventCategory: EVENT_CATEGORIES.inventory,
      properties,
   });
}

export const inventoryItemUpdatedSchema = z.object({
   itemId: z.string().uuid(),
   changedFields: z.array(z.string()),
});
export type InventoryItemUpdatedEvent = z.infer<
   typeof inventoryItemUpdatedSchema
>;
export function emitInventoryItemUpdated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: InventoryItemUpdatedEvent,
) {
   return emit({
      ...ctx,
      eventName: INVENTORY_EVENTS["inventory.item_updated"],
      eventCategory: EVENT_CATEGORIES.inventory,
      properties,
   });
}

export const inventoryItemDeletedSchema = z.object({
   itemId: z.string().uuid(),
});
export type InventoryItemDeletedEvent = z.infer<
   typeof inventoryItemDeletedSchema
>;
export function emitInventoryItemDeleted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: InventoryItemDeletedEvent,
) {
   return emit({
      ...ctx,
      eventName: INVENTORY_EVENTS["inventory.item_deleted"],
      eventCategory: EVENT_CATEGORIES.inventory,
      properties,
   });
}
```

**Step 3: Create `service.ts`**

```typescript
import { z } from "zod";
import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const SERVICE_EVENTS = {
   "service.created": "service.created",
   "service.updated": "service.updated",
   "service.deleted": "service.deleted",
} as const;

export type ServiceEventName =
   (typeof SERVICE_EVENTS)[keyof typeof SERVICE_EVENTS];

export const serviceCreatedSchema = z.object({
   serviceId: z.string().uuid(),
   name: z.string(),
});
export type ServiceCreatedEvent = z.infer<typeof serviceCreatedSchema>;
export function emitServiceCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.created"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

export const serviceUpdatedSchema = z.object({
   serviceId: z.string().uuid(),
   changedFields: z.array(z.string()),
});
export type ServiceUpdatedEvent = z.infer<typeof serviceUpdatedSchema>;
export function emitServiceUpdated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceUpdatedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.updated"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}

export const serviceDeletedSchema = z.object({ serviceId: z.string().uuid() });
export type ServiceDeletedEvent = z.infer<typeof serviceDeletedSchema>;
export function emitServiceDeleted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: ServiceDeletedEvent,
) {
   return emit({
      ...ctx,
      eventName: SERVICE_EVENTS["service.deleted"],
      eventCategory: EVENT_CATEGORIES.service,
      properties,
   });
}
```

**Step 4: Create `nfe.ts`**

```typescript
import { z } from "zod";
import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const NFE_EVENTS = {
   "nfe.emitted": "nfe.emitted",
   "nfe.cancelled": "nfe.cancelled",
} as const;

export type NfeEventName = (typeof NFE_EVENTS)[keyof typeof NFE_EVENTS];

export const nfeEmittedSchema = z.object({
   nfeId: z.string().uuid(),
   cnpj: z.string(),
   chaveAcesso: z.string().optional(),
   valorTotal: z.number().nonnegative(),
   tipo: z.enum(["NFe", "NFSe", "NFCe"]),
});
export type NfeEmittedEvent = z.infer<typeof nfeEmittedSchema>;
export function emitNfeEmitted(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: NfeEmittedEvent,
) {
   return emit({
      ...ctx,
      eventName: NFE_EVENTS["nfe.emitted"],
      eventCategory: EVENT_CATEGORIES.nfe,
      properties,
   });
}

export const nfeCancelledSchema = z.object({
   nfeId: z.string().uuid(),
   motivo: z.string(),
});
export type NfeCancelledEvent = z.infer<typeof nfeCancelledSchema>;
export function emitNfeCancelled(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: NfeCancelledEvent,
) {
   return emit({
      ...ctx,
      eventName: NFE_EVENTS["nfe.cancelled"],
      eventCategory: EVENT_CATEGORIES.nfe,
      properties,
   });
}
```

**Step 5: Create `document.ts`**

```typescript
import { z } from "zod";
import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const DOCUMENT_EVENTS = {
   "document.signed": "document.signed",
} as const;

export type DocumentEventName =
   (typeof DOCUMENT_EVENTS)[keyof typeof DOCUMENT_EVENTS];

export const documentSignedSchema = z.object({
   documentId: z.string().uuid(),
   signatureType: z.enum(["a1", "a3"]),
   signerCpfHash: z.string(), // hashed, never store raw CPF
});
export type DocumentSignedEvent = z.infer<typeof documentSignedSchema>;
export function emitDocumentSigned(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: DocumentSignedEvent,
) {
   return emit({
      ...ctx,
      eventName: DOCUMENT_EVENTS["document.signed"],
      eventCategory: EVENT_CATEGORIES.document,
      properties,
   });
}
```

**Step 6: Add exports to `packages/events/package.json`**

Add to the `exports` field:

```json
"./contact": "./src/contact.ts",
"./inventory": "./src/inventory.ts",
"./service": "./src/service.ts",
"./nfe": "./src/nfe.ts",
"./document": "./src/document.ts"
```

**Step 7: Commit**

```bash
git add packages/events/src/contact.ts packages/events/src/inventory.ts packages/events/src/service.ts packages/events/src/nfe.ts packages/events/src/document.ts packages/events/package.json
git commit -m "feat(events): add contact, inventory, service, nfe, document event categories"
```

---

## Task 3: Rewrite free tier enforcement (replace credit pools with per-product counters)

**Files:**

- Modify: `packages/events/src/credits.ts`

**Context:** The old system had two pools (`ai` and `platform`) tracked in Redis. The new system tracks each billable event name independently: `usage:{orgId}:{eventName}` in Redis with monthly TTL.

**Step 1: Rewrite `credits.ts`**

Replace the entire file content with:

```typescript
import { ORPCError } from "@orpc/server";
import type { DatabaseInstance } from "@packages/database/client";
import { getRedisConnection } from "@packages/redis/connection";
import { FREE_TIER_LIMITS } from "@packages/stripe/constants";
import type { Redis } from "ioredis";

// ---------------------------------------------------------------------------
// Redis Key
// ---------------------------------------------------------------------------

function usageKey(organizationId: string, eventName: string): string {
   return `usage:${organizationId}:${eventName}`;
}

// ---------------------------------------------------------------------------
// TTL helper
// ---------------------------------------------------------------------------

function msUntilEndOfMonth(): number {
   const now = new Date();
   const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
   return new Date(next.getTime() + 86_400_000).getTime() - now.getTime();
}

// ---------------------------------------------------------------------------
// Check free tier
// ---------------------------------------------------------------------------

/**
 * Returns true if the org is within the free tier for this event.
 * Returns false if they've exceeded it (should be billed via Stripe).
 * Never throws — if Redis is down, always allows (fail open).
 */
export async function isWithinFreeTier(
   organizationId: string,
   eventName: string,
): Promise<boolean> {
   const redis = getRedisConnection();
   if (!redis) return true;

   const limit = FREE_TIER_LIMITS[eventName];
   if (limit === undefined) return true; // not a metered event

   const raw = await redis.get(usageKey(organizationId, eventName));
   if (raw === null) return true;

   return Number(raw) < limit;
}

// ---------------------------------------------------------------------------
// Increment usage counter
// ---------------------------------------------------------------------------

/**
 * Increments the per-product usage counter.
 * Sets TTL on first use of the month.
 */
export async function incrementUsage(
   organizationId: string,
   eventName: string,
): Promise<void> {
   const redis = getRedisConnection();
   if (!redis) return;

   const key = usageKey(organizationId, eventName);
   const newValue = await redis.incr(key);

   if (newValue === 1) {
      await redis.pexpire(key, msUntilEndOfMonth());
   }
}

// ---------------------------------------------------------------------------
// Get current usage (for billing dashboard)
// ---------------------------------------------------------------------------

export async function getCurrentUsage(
   organizationId: string,
   eventName: string,
): Promise<{ used: number; limit: number; withinFreeTier: boolean }> {
   const redis = getRedisConnection();
   const limit = FREE_TIER_LIMITS[eventName] ?? 0;

   if (!redis) return { used: 0, limit, withinFreeTier: true };

   const raw = await redis.get(usageKey(organizationId, eventName));
   const used = raw ? Number(raw) : 0;

   return { used, limit, withinFreeTier: used < limit };
}
```

**Step 2: Find and update all callers of the old credit functions**

```bash
grep -r "enforceCreditBudget\|checkCreditBudget\|trackCreditUsage\|incrementCreditUsage\|getCreditPool\|POOL_CATEGORIES\|PLAN_CREDIT_BUDGETS\|resolveOrganizationPlan" apps/ packages/ --include="*.ts" -l
```

For each call to `enforceCreditBudget(db, orgId, pool)` — replace with the new Stripe overage flow (do NOT throw; Stripe handles billing when free tier is exceeded). Remove enforcement blocks — users are never blocked, they just get billed.

**Step 3: Commit**

```bash
git add packages/events/src/credits.ts
git commit -m "feat(billing): replace two-pool credit system with per-product free tier counters"
```

---

## Task 4: Wire Stripe Meter Events into `emitEvent()`

**Files:**

- Modify: `packages/events/src/emit.ts`
- Modify: `packages/events/package.json` (if stripeClient needs to be passed)

**Context:** After inserting to PostgreSQL, if the event has a Stripe meter mapping, call `stripe.billing.meterEvents.create()`. The `stripeCustomerId` comes from the organization record (already stored by Better Auth Stripe plugin in `organization.stripeCustomerId`).

**Step 1: Update `EmitEventParams` to accept optional Stripe client and customer ID**

```typescript
import type Stripe from "stripe";

export interface EmitEventParams {
   db: DatabaseInstance;
   posthog?: PostHog;
   stripeClient?: Stripe; // ← new
   stripeCustomerId?: string; // ← new (org's Stripe customer ID)
   organizationId: string;
   eventName: string;
   eventCategory: EventCategory;
   properties: Record<string, unknown>;
   userId?: string;
   teamId?: string;
   ipAddress?: string;
   userAgent?: string;
   priceOverride?: Money;
}
```

**Step 2: Add Stripe meter reporting after PostgreSQL insert**

In `emitEvent()`, after the DB insert, add:

```typescript
// 2b. Report to Stripe meter (if billable and stripe client available)
if (params.stripeClient && params.stripeCustomerId) {
   const meterEventName = STRIPE_METER_EVENTS[eventName];
   if (meterEventName) {
      try {
         await params.stripeClient.billing.meterEvents.create({
            event_name: meterEventName,
            payload: {
               stripe_customer_id: params.stripeCustomerId,
               value: "1",
            },
         });
         // Also increment local free tier counter
         await incrementUsage(organizationId, eventName);
      } catch (meterError) {
         console.error(
            `[Events] Stripe meter report failed for ${eventName}:`,
            meterError,
         );
         // Don't throw — meter failure must not block the main flow
      }
   }
}
```

**Step 3: Update `createEmitFn()` to accept stripeClient and stripeCustomerId**

```typescript
export function createEmitFn(
   db: DatabaseInstance,
   posthog?: PostHog,
   stripeClient?: Stripe,
   stripeCustomerId?: string,
): EmitFn {
   return (params) =>
      emitEvent({ ...params, db, posthog, stripeClient, stripeCustomerId });
}
```

**Step 4: Update all callers of `createEmitFn()` in oRPC routers**

```bash
grep -r "createEmitFn" apps/ packages/ --include="*.ts" -l
```

In oRPC routers, the `context` already has `stripeClient`. Fetch the org's `stripeCustomerId` from the org record:

```typescript
// In router context setup or procedure handler:
const org = await db.query.organization.findFirst({
   where: eq(organization.id, organizationId),
   columns: { stripeCustomerId: true },
});

const emit = createEmitFn(
   db,
   posthog,
   stripeClient,
   org?.stripeCustomerId ?? undefined,
);
```

**Step 5: Commit**

```bash
git add packages/events/src/emit.ts
git commit -m "feat(billing): report Stripe meter events from emitEvent() after PostgreSQL insert"
```

---

## Task 5: Update Better Auth Stripe plugin config

**Files:**

- Modify: `packages/authentication/src/server.ts`
- Modify: `packages/environment/src/server.ts` (add new env vars)

**Context:** Remove the old plan definitions (FREE/LITE/PRO). Add addon Stripe products as separate plans using `group` to separate them from base usage. The Stripe Meter prices should be `lineItems` on a base "metered" subscription.

**Step 1: Create a base metered subscription plan in Stripe dashboard**

In Stripe: create a Product called "Montte Base" with a price of R$0/mês (free base). This gives the org a subscription to attach metered line items to.

For each billable meter, create a metered price in Stripe linked to the meter. Add those price IDs to env vars:

```
STRIPE_METER_PRICE_FINANCE_TRANSACTIONS=price_xxx
STRIPE_METER_PRICE_AI_CHAT=price_xxx
STRIPE_METER_PRICE_AI_AGENT=price_xxx
STRIPE_METER_PRICE_WEBHOOKS=price_xxx
STRIPE_METER_PRICE_CONTACTS=price_xxx
STRIPE_METER_PRICE_INVENTORY=price_xxx
STRIPE_METER_PRICE_SERVICES=price_xxx
STRIPE_METER_PRICE_NFE=price_xxx
STRIPE_METER_PRICE_DOCUMENTS=price_xxx
STRIPE_ADDON_PRICE_BOOST=price_xxx
STRIPE_ADDON_PRICE_SCALE=price_xxx
STRIPE_ADDON_PRICE_ENTERPRISE=price_xxx
STRIPE_ADDON_PRICE_TELEGRAM=price_xxx
STRIPE_ADDON_PRICE_WHATSAPP=price_xxx
STRIPE_ADDON_PRICE_MENSAGERIA_BUNDLE=price_xxx
```

**Step 2: Update `server.ts` — Stripe plugin plans**

Replace the existing `plans` array with:

```typescript
plans: [
   // Base metered plan — all users go through this checkout to add payment method
   {
      name: "metered",
      priceId: env.STRIPE_BASE_PRICE_ID, // R$0/mês base
      lineItems: [
         { price: env.STRIPE_METER_PRICE_FINANCE_TRANSACTIONS },
         { price: env.STRIPE_METER_PRICE_AI_CHAT },
         { price: env.STRIPE_METER_PRICE_AI_AGENT },
         { price: env.STRIPE_METER_PRICE_WEBHOOKS },
         { price: env.STRIPE_METER_PRICE_CONTACTS },
         { price: env.STRIPE_METER_PRICE_INVENTORY },
         { price: env.STRIPE_METER_PRICE_SERVICES },
         { price: env.STRIPE_METER_PRICE_NFE },
         { price: env.STRIPE_METER_PRICE_DOCUMENTS },
      ],
      limits: {
         // Free tier limits shown in UI — not enforced by Stripe, enforced by Redis
         finance_transactions: 500,
         ai_chat_messages: 20,
         ai_agent_actions: 5,
         webhook_deliveries: 500,
         contact_creates: 50,
         inventory_creates: 50,
         service_creates: 20,
         nfe_emissions: 5,
         document_signatures: 10,
      },
   },
   // Platform addons (separate group — can stack on top of metered)
   {
      name: AddonName.BOOST,
      priceId: env.STRIPE_ADDON_PRICE_BOOST,
      group: "addon",
      limits: { sso: true, whiteLabel: true, twoFaEnforcement: true },
   },
   {
      name: AddonName.SCALE,
      priceId: env.STRIPE_ADDON_PRICE_SCALE,
      group: "addon",
      limits: { sso: true, whiteLabel: true, saml: true, rbac: true, auditLogs: true },
   },
   {
      name: AddonName.ENTERPRISE,
      priceId: env.STRIPE_ADDON_PRICE_ENTERPRISE,
      group: "addon",
      limits: { sso: true, whiteLabel: true, saml: true, rbac: true, auditLogs: true, dedicatedSupport: true },
   },
   {
      name: AddonName.TELEGRAM,
      priceId: env.STRIPE_ADDON_PRICE_TELEGRAM,
      group: "mensageria",
      limits: { telegram: true },
   },
   {
      name: AddonName.WHATSAPP,
      priceId: env.STRIPE_ADDON_PRICE_WHATSAPP,
      group: "mensageria",
      limits: { whatsapp: true },
   },
   {
      name: AddonName.MENSAGERIA_BUNDLE,
      priceId: env.STRIPE_ADDON_PRICE_MENSAGERIA_BUNDLE,
      group: "mensageria",
      limits: { telegram: true, whatsapp: true },
   },
],
```

**Step 3: Commit**

```bash
git add packages/authentication/src/server.ts packages/environment/src/server.ts
git commit -m "feat(billing): configure Stripe metered plans and addon products in Better Auth"
```

---

## Task 6: Update seed-event-catalog.ts

**Files:**

- Modify: `scripts/seed-event-catalog.ts`

**Step 1: Replace `EVENT_PRICING` array**

Remove all old entries. Add:

```typescript
import { CONTACT_EVENTS } from "@packages/events/contact";
import { INVENTORY_EVENTS } from "@packages/events/inventory";
import { SERVICE_EVENTS } from "@packages/events/service";
import { NFE_EVENTS } from "@packages/events/nfe";
import { DOCUMENT_EVENTS } from "@packages/events/document";
// Keep existing imports for FINANCE_EVENTS, AI_EVENTS, WEBHOOK_EVENTS, DASHBOARD_EVENTS, INSIGHT_EVENTS

const EVENT_PRICING: EventPricing[] = [
   // Finance
   {
      eventName: FINANCE_EVENTS["finance.transaction_created"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.001000",
      freeTierLimit: 500,
      displayName: "Transação Financeira",
      description: "Registrada quando uma transação financeira é criada.",
      isBillable: true,
   },
   {
      eventName: FINANCE_EVENTS["finance.transaction_updated"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Transação Atualizada",
      description: "Registrada quando uma transação é atualizada.",
      isBillable: false,
   },
   {
      eventName: FINANCE_EVENTS["finance.bank_account_connected"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Conta Bancária Conectada",
      description: "Registrada quando uma conta bancária é conectada.",
      isBillable: false,
   },
   {
      eventName: FINANCE_EVENTS["finance.category_created"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Categoria Criada",
      description: "Registrada quando uma categoria é criada.",
      isBillable: false,
   },
   {
      eventName: FINANCE_EVENTS["finance.tag_created"],
      category: EVENT_CATEGORIES.finance,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Tag Criada",
      description: "Registrada quando uma tag é criada.",
      isBillable: false,
   },
   // AI
   {
      eventName: AI_EVENTS["ai.chat_message"],
      category: EVENT_CATEGORIES.ai,
      pricePerEvent: "0.020000",
      freeTierLimit: 20,
      displayName: "Mensagem de Chat IA",
      description: "Registrada por mensagem no chat com a IA.",
      isBillable: true,
   },
   {
      eventName: AI_EVENTS["ai.agent_action"],
      category: EVENT_CATEGORIES.ai,
      pricePerEvent: "0.040000",
      freeTierLimit: 5,
      displayName: "Ação de Agente IA",
      description: "Registrada por ação discreta de um agente IA.",
      isBillable: true,
   },
   // Webhooks
   {
      eventName: WEBHOOK_EVENTS["webhook.endpoint.created"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Endpoint Criado",
      description: "Registrada quando um endpoint de webhook é criado.",
      isBillable: false,
   },
   {
      eventName: WEBHOOK_EVENTS["webhook.endpoint.updated"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Endpoint Atualizado",
      description: "Registrada quando um endpoint é atualizado.",
      isBillable: false,
   },
   {
      eventName: WEBHOOK_EVENTS["webhook.endpoint.deleted"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Endpoint Deletado",
      description: "Registrada quando um endpoint é deletado.",
      isBillable: false,
   },
   {
      eventName: WEBHOOK_EVENTS["webhook.delivered"],
      category: EVENT_CATEGORIES.webhook,
      pricePerEvent: "0.000500",
      freeTierLimit: 500,
      displayName: "Webhook Entregue",
      description: "Registrada por entrega bem-sucedida de webhook.",
      isBillable: true,
   },
   // Dashboards (free)
   {
      eventName: DASHBOARD_EVENTS["dashboard.created"],
      category: EVENT_CATEGORIES.dashboard,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Dashboard Criado",
      description: "Registrada quando um dashboard é criado.",
      isBillable: false,
   },
   {
      eventName: DASHBOARD_EVENTS["dashboard.updated"],
      category: EVENT_CATEGORIES.dashboard,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Dashboard Atualizado",
      description: "Registrada quando um dashboard é atualizado.",
      isBillable: false,
   },
   {
      eventName: DASHBOARD_EVENTS["dashboard.deleted"],
      category: EVENT_CATEGORIES.dashboard,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Dashboard Deletado",
      description: "Registrada quando um dashboard é deletado.",
      isBillable: false,
   },
   // Insights (free)
   {
      eventName: INSIGHT_EVENTS["insight.created"],
      category: EVENT_CATEGORIES.insight,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Insight Criado",
      description: "Registrada quando um insight é criado.",
      isBillable: false,
   },
   {
      eventName: INSIGHT_EVENTS["insight.updated"],
      category: EVENT_CATEGORIES.insight,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Insight Atualizado",
      description: "Registrada quando um insight é atualizado.",
      isBillable: false,
   },
   {
      eventName: INSIGHT_EVENTS["insight.deleted"],
      category: EVENT_CATEGORIES.insight,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Insight Deletado",
      description: "Registrada quando um insight é deletado.",
      isBillable: false,
   },
   // Contacts
   {
      eventName: CONTACT_EVENTS["contact.created"],
      category: EVENT_CATEGORIES.contact,
      pricePerEvent: "0.010000",
      freeTierLimit: 50,
      displayName: "Contato Criado",
      description: "Registrada quando um contato é criado.",
      isBillable: true,
   },
   {
      eventName: CONTACT_EVENTS["contact.updated"],
      category: EVENT_CATEGORIES.contact,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Contato Atualizado",
      description: "Registrada quando um contato é atualizado.",
      isBillable: false,
   },
   {
      eventName: CONTACT_EVENTS["contact.deleted"],
      category: EVENT_CATEGORIES.contact,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Contato Deletado",
      description: "Registrada quando um contato é deletado.",
      isBillable: false,
   },
   // Inventory
   {
      eventName: INVENTORY_EVENTS["inventory.item_created"],
      category: EVENT_CATEGORIES.inventory,
      pricePerEvent: "0.010000",
      freeTierLimit: 50,
      displayName: "Item de Estoque Criado",
      description: "Registrada quando um item de estoque é criado.",
      isBillable: true,
   },
   {
      eventName: INVENTORY_EVENTS["inventory.item_updated"],
      category: EVENT_CATEGORIES.inventory,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Item Atualizado",
      description: "Registrada quando um item é atualizado.",
      isBillable: false,
   },
   {
      eventName: INVENTORY_EVENTS["inventory.item_deleted"],
      category: EVENT_CATEGORIES.inventory,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Item Deletado",
      description: "Registrada quando um item é deletado.",
      isBillable: false,
   },
   // Services
   {
      eventName: SERVICE_EVENTS["service.created"],
      category: EVENT_CATEGORIES.service,
      pricePerEvent: "0.010000",
      freeTierLimit: 20,
      displayName: "Serviço Criado",
      description: "Registrada quando um serviço é criado.",
      isBillable: true,
   },
   {
      eventName: SERVICE_EVENTS["service.updated"],
      category: EVENT_CATEGORIES.service,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Serviço Atualizado",
      description: "Registrada quando um serviço é atualizado.",
      isBillable: false,
   },
   {
      eventName: SERVICE_EVENTS["service.deleted"],
      category: EVENT_CATEGORIES.service,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "Serviço Deletado",
      description: "Registrada quando um serviço é deletado.",
      isBillable: false,
   },
   // NF-e
   {
      eventName: NFE_EVENTS["nfe.emitted"],
      category: EVENT_CATEGORIES.nfe,
      pricePerEvent: "0.150000",
      freeTierLimit: 5,
      displayName: "NF-e Emitida",
      description: "Registrada por emissão de nota fiscal eletrônica.",
      isBillable: true,
   },
   {
      eventName: NFE_EVENTS["nfe.cancelled"],
      category: EVENT_CATEGORIES.nfe,
      pricePerEvent: "0.000000",
      freeTierLimit: 0,
      displayName: "NF-e Cancelada",
      description: "Registrada quando uma NF-e é cancelada.",
      isBillable: false,
   },
   // Document Signature
   {
      eventName: DOCUMENT_EVENTS["document.signed"],
      category: EVENT_CATEGORIES.document,
      pricePerEvent: "0.100000",
      freeTierLimit: 10,
      displayName: "Documento Assinado",
      description: "Registrada por assinatura digital de documento.",
      isBillable: true,
   },
];
```

**Step 2: Run dry run to verify**

```bash
bun run scripts/seed-event-catalog.ts run --dry-run
```

Expected: shows 29 events, correct billable counts.

**Step 3: Commit**

```bash
git add scripts/seed-event-catalog.ts
git commit -m "feat(billing): update event catalog seed for PostHog-style metered billing"
```

---

## Task 7: Update billing UI — `billing-overview.tsx`

**Files:**

- Modify: `apps/web/src/features/billing/ui/billing-overview.tsx`

**Context:** Remove CMS-era category gates (content, SEO, experiments, clusters). Replace with ERP modules. Show per-product usage bars with free tier + overage.

**Step 1: Update `EARLY_ACCESS_CATEGORY_GATES`**

Replace with ERP-relevant PostHog feature flags:

```typescript
const EARLY_ACCESS_CATEGORY_GATES = {
   contact: { flag: "contacts", fallbackStage: "alpha" },
   inventory: { flag: "inventory", fallbackStage: "alpha" },
   service: { flag: "services", fallbackStage: "alpha" },
   nfe: { flag: "nfe", fallbackStage: "alpha" },
   document: { flag: "document-signing", fallbackStage: "alpha" },
   telegram: { flag: "telegram", fallbackStage: "alpha" },
   whatsapp: { flag: "whatsapp", fallbackStage: "alpha" },
} as const;
```

**Step 2: Update billing category display names and icons**

Replace the categories map to reflect ERP modules:

| Category key | Display name            | Icon        |
| ------------ | ----------------------- | ----------- |
| `finance`    | Finanças                | `Wallet`    |
| `ai`         | Inteligência Artificial | `Sparkles`  |
| `webhook`    | Webhooks                | `Webhook`   |
| `contact`    | Contatos                | `Users`     |
| `inventory`  | Estoque                 | `Package`   |
| `service`    | Serviços                | `Briefcase` |
| `nfe`        | Notas Fiscais           | `FileText`  |
| `document`   | Assinaturas Digitais    | `PenLine`   |

**Step 3: Update free tier display**

Each product card should show:

- Used / Free tier limit (e.g., "12 / 20 mensagens")
- Progress bar (green while within free tier, amber when >80%, red when exceeded)
- Overage cost if exceeded
- "Upgrade para remover limite" CTA only when approaching limit

**Step 4: Remove addon cards referencing old plans**

Remove `BOOST`, `SCALE`, `ENTERPRISE` display from the billing overview (they're still in Stripe, just not the focus of the usage view). Add a simple "Addons ativos" section listing subscribed addons with their monthly cost.

**Step 5: Commit**

```bash
git add apps/web/src/features/billing/ui/billing-overview.tsx
git commit -m "feat(billing): update billing overview for PostHog-style ERP module display"
```

---

## Task 8: Update billing oRPC router

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/billing.ts`

**Step 1: Update `getCurrentUsage` to return per-product data**

The procedure should return an array of:

```typescript
{
   eventName: string;
   displayName: string;
   category: string;
   used: number;
   freeTierLimit: number;
   withinFreeTier: boolean;
   overageCount: number;
   overageCost: string; // BRL formatted
   pricePerUnit: string;
}
```

Pull `used` from Redis (`getCurrentUsage()` in credits.ts), pull `freeTierLimit` and `pricePerUnit` from `FREE_TIER_LIMITS` and `EVENT_PRICES` constants.

**Step 2: Remove `getCategoryUsage` and `getDailyUsage` procedures that referenced old CMS categories**

Replace with `getProductUsage` — returns usage for a single event name over the current billing period from the PostgreSQL events table.

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/billing.ts
git commit -m "feat(billing): update billing router for per-product usage queries"
```

---

## Task 9: Update onboarding — remove plan selection references

**Files:**

- Modify: `apps/web/src/features/onboarding/ui/onboarding-wizard.tsx`
- Modify: `apps/web/src/integrations/orpc/router/onboarding.ts`

**Step 1: Search for plan name references**

```bash
grep -r "PlanName\|LITE\|FREE\|PLAN_CREDIT\|credit.*pool\|ai.*credit\|platform.*credit" apps/web/src --include="*.ts" --include="*.tsx" -l
```

**Step 2:** Remove any onboarding steps that asked users to pick a plan. Replace with a simple "you start free, pay as you go" message. The user adds a payment method when they hit their first free tier limit.

**Step 3: Commit**

```bash
git add apps/web/src/features/onboarding/
git commit -m "feat(onboarding): remove plan selection, replace with pay-as-you-go flow"
```

---

## Task 10: Run typecheck and fix remaining type errors

```bash
bun run typecheck 2>&1 | head -50
```

Fix any remaining TypeScript errors from the removed exports (`PlanName`, `PLAN_CREDIT_BUDGETS`, `getCreditPool`, `AI_PRICING`, `IMAGE_MODEL_PRICING`, etc.).

Commit all fixes:

```bash
git commit -m "fix(billing): resolve type errors from billing model migration"
```

---

## Task 11: Re-seed event catalog locally

```bash
bun run scripts/seed-event-catalog.ts run --env local
```

Expected output: 29 entries inserted, correct billable/free tier counts.

---

## Testing checklist

- [ ] `emitEvent("ai.chat_message", ...)` inserts PostgreSQL row AND calls `stripe.billing.meterEvents.create`
- [ ] `isWithinFreeTier(orgId, "ai.chat_message")` returns `true` when count < 20, `false` when ≥ 20
- [ ] `incrementUsage()` Redis key has correct monthly TTL
- [ ] Event catalog has 29 events, no FIM/image events
- [ ] Billing overview shows finance, AI, webhooks, contacts, inventory, services, NF-e, document categories
- [ ] Old `PlanName` enum not referenced anywhere in the codebase

---

## One-time Stripe setup (before deploying)

1. In Stripe dashboard → Billing → Meters: create one meter per billable event (names from `STRIPE_METER_EVENTS`)
2. For each meter: create a metered price in BRL
3. Create a "Base" product with R$0/mês price (for the free checkout session)
4. Create addon products: Boost, Scale, Enterprise, Telegram, WhatsApp, Bundle
5. Copy all price IDs to `.env.production`
6. Run: `bun run scripts/seed-event-catalog.ts run --env production`
