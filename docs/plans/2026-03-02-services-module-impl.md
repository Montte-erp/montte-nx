# Services Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Services module — a service catalog with variants, client subscriptions with negotiated pricing, auto-generated bills, revenue analytics, and an Asaas webhook integration for sync.

**Architecture:** Four new DB tables (`services`, `service_variants`, `contact_subscriptions`, `resources`). Subscriptions auto-create `bills` (receivables) in the existing finance module. Asaas sync flows through an HTTP receiver in `apps/server` → BullMQ job → worker processor.

**Tech Stack:** Drizzle ORM, oRPC + Zod, TanStack Query (`useSuspenseQuery`), `@f-o-t/money`, `MoneyInput`, DataTable, BullMQ, Elysia (server)

**Design doc:** `docs/plans/2026-03-02-services-module-design.md`

---

## Task 1: Rename sdk-server → server

**Files:**
- Modify: `apps/sdk-server/project.json`
- Rename dir: `apps/sdk-server/` → `apps/server/`

**Step 1: Rename the directory**

```bash
mv apps/sdk-server apps/server
```

**Step 2: Update project.json name**

In `apps/server/project.json`, change `"name": "sdk-server"` to `"name": "server"`.

**Step 3: Update any references in workspace**

```bash
grep -r "sdk-server" --include="*.json" --include="*.ts" -l
```

Update `SDK_SERVER_URL` references and any `nx.json` / `package.json` scripts that mention `sdk-server`. In `packages/environment/src/server.ts`, rename `SDK_SERVER_URL` to `SERVER_URL` (or keep as-is if it's already `SERVER_URL`).

**Step 4: Verify dev server still starts**

```bash
bun dev
```
Expected: No errors about missing project.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: rename sdk-server to server"
```

---

## Task 2: DB Schema — services tables

**Files:**
- Create: `packages/database/src/schemas/services.ts`

**Step 1: Write the schema**

```typescript
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { team } from "./auth";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const billingCycleEnum = pgEnum("billing_cycle", [
  "hourly",
  "monthly",
  "annual",
  "one_time",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "completed",
  "cancelled",
]);

export const serviceSourceEnum = pgEnum("service_source", [
  "manual",
  "asaas",
]);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const services = pgTable(
  "services",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("services_team_id_idx").on(table.teamId),
  ],
);

// ---------------------------------------------------------------------------
// Service Variants
// ---------------------------------------------------------------------------

export const serviceVariants = pgTable(
  "service_variants",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    basePrice: integer("base_price").notNull(), // cents (@f-o-t/money)
    billingCycle: billingCycleEnum("billing_cycle").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("service_variants_service_id_idx").on(table.serviceId),
    index("service_variants_team_id_idx").on(table.teamId),
  ],
);

// ---------------------------------------------------------------------------
// Contact Subscriptions
// ---------------------------------------------------------------------------

export const contactSubscriptions = pgTable(
  "contact_subscriptions",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull().references(() => serviceVariants.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),          // null = open-ended
    negotiatedPrice: integer("negotiated_price").notNull(), // cents
    notes: text("notes"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    source: serviceSourceEnum("source").notNull().default("manual"),
    externalId: text("external_id"),   // Asaas subscription ID
    resourceId: uuid("resource_id"),   // reserved for future booking
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("contact_subscriptions_team_id_idx").on(table.teamId),
    index("contact_subscriptions_contact_id_idx").on(table.contactId),
    index("contact_subscriptions_variant_id_idx").on(table.variantId),
    index("contact_subscriptions_external_id_idx").on(table.externalId),
    index("contact_subscriptions_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// Resources (schema only — not used in v1, reserved for booking)
// ---------------------------------------------------------------------------

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("resources_team_id_idx").on(table.teamId),
    index("resources_service_id_idx").on(table.serviceId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const servicesRelations = relations(services, ({ one, many }) => ({
  team: one(team, { fields: [services.teamId], references: [team.id] }),
  variants: many(serviceVariants),
  resources: many(resources),
}));

export const serviceVariantsRelations = relations(serviceVariants, ({ one, many }) => ({
  service: one(services, { fields: [serviceVariants.serviceId], references: [services.id] }),
  subscriptions: many(contactSubscriptions),
}));

export const contactSubscriptionsRelations = relations(contactSubscriptions, ({ one }) => ({
  contact: one(contacts, { fields: [contactSubscriptions.contactId], references: [contacts.id] }),
  variant: one(serviceVariants, { fields: [contactSubscriptions.variantId], references: [serviceVariants.id] }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  service: one(services, { fields: [resources.serviceId], references: [services.id] }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServiceVariant = typeof serviceVariants.$inferSelect;
export type NewServiceVariant = typeof serviceVariants.$inferInsert;
export type ContactSubscription = typeof contactSubscriptions.$inferSelect;
export type NewContactSubscription = typeof contactSubscriptions.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type ServiceSource = (typeof serviceSourceEnum.enumValues)[number];
```

**Step 2: Commit**

```bash
git add packages/database/src/schemas/services.ts
git commit -m "feat(db): add services, service_variants, contact_subscriptions, resources schemas"
```

---

## Task 3: DB Schema — add source/externalId to contacts + contactId/subscriptionId to bills

**Files:**
- Modify: `packages/database/src/schemas/contacts.ts`
- Modify: `packages/database/src/schemas/bills.ts`

**Step 1: Add source + externalId to contacts**

In `packages/database/src/schemas/contacts.ts`, add the `serviceSourceEnum` import and two new columns inside `pgTable`:

```typescript
// at top, add import:
import { serviceSourceEnum } from "./services";

// inside contacts table definition, after `notes`:
source: serviceSourceEnum("source").notNull().default("manual"),
externalId: text("external_id"),   // Asaas customer ID
```

Also add to the exported types:
```typescript
export type ContactSource = (typeof serviceSourceEnum.enumValues)[number];
```

**Step 2: Add contactId + subscriptionId to bills**

In `packages/database/src/schemas/bills.ts`, add after `transactionId`:

```typescript
// import at top — add contactSubscriptions forward ref or use lazy
contactId: uuid("contact_id"),       // nullable — set when bill is auto-generated from a subscription
subscriptionId: uuid("subscription_id"), // nullable — FK to contact_subscriptions
```

Also add indexes:
```typescript
index("bills_contact_id_idx").on(table.contactId),
index("bills_subscription_id_idx").on(table.subscriptionId),
```

> Note: These are intentionally nullable with no FK constraint to avoid circular import issues between `bills.ts` and `services.ts`. The application enforces the relationship.

**Step 3: Export new schema from schema.ts**

In `packages/database/src/schema.ts`, add:
```typescript
// Services
export * from "./schemas/services";
```

**Step 4: Commit**

```bash
git add packages/database/src/schemas/contacts.ts packages/database/src/schemas/bills.ts packages/database/src/schema.ts
git commit -m "feat(db): add source/externalId to contacts, contactId/subscriptionId to bills"
```

---

## Task 4: Push schema to DB

**Step 1: Push**

```bash
bun run db:push
```

Expected: All new tables created, new columns added. No errors.

**Step 2: Verify in Drizzle Studio**

```bash
bun run db:studio
```

Check that `services`, `service_variants`, `contact_subscriptions`, `resources` tables exist and `contacts` has `source` + `external_id` columns.

---

## Task 5: Repositories

**Files:**
- Create: `packages/database/src/repositories/services-repository.ts`

**Step 1: Write the repository**

```typescript
import { AppError, propagateError } from "@packages/utils/errors";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
  type NewContactSubscription,
  type NewService,
  type NewServiceVariant,
  type SubscriptionStatus,
  contactSubscriptions,
  serviceVariants,
  services,
} from "../schema";

// ---------------------------------------------------------------------------
// Services CRUD
// ---------------------------------------------------------------------------

export async function listServices(db: DatabaseInstance, teamId: string) {
  try {
    return await db
      .select()
      .from(services)
      .where(eq(services.teamId, teamId))
      .orderBy(services.name);
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to list services");
  }
}

export async function getService(db: DatabaseInstance, id: string) {
  try {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service ?? null;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to get service");
  }
}

export async function createService(db: DatabaseInstance, data: NewService) {
  try {
    const [service] = await db.insert(services).values(data).returning();
    return service;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to create service");
  }
}

export async function updateService(
  db: DatabaseInstance,
  id: string,
  data: Partial<NewService>,
) {
  try {
    const [updated] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return updated;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to update service");
  }
}

export async function deleteService(db: DatabaseInstance, id: string) {
  try {
    await db.delete(services).where(eq(services.id, id));
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to delete service");
  }
}

// ---------------------------------------------------------------------------
// Service Variants CRUD
// ---------------------------------------------------------------------------

export async function listVariantsByService(db: DatabaseInstance, serviceId: string) {
  try {
    return await db
      .select()
      .from(serviceVariants)
      .where(eq(serviceVariants.serviceId, serviceId))
      .orderBy(serviceVariants.name);
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to list variants");
  }
}

export async function createVariant(db: DatabaseInstance, data: NewServiceVariant) {
  try {
    const [variant] = await db.insert(serviceVariants).values(data).returning();
    return variant;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to create variant");
  }
}

export async function updateVariant(
  db: DatabaseInstance,
  id: string,
  data: Partial<NewServiceVariant>,
) {
  try {
    const [updated] = await db.update(serviceVariants).set(data).where(eq(serviceVariants.id, id)).returning();
    return updated;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to update variant");
  }
}

export async function deleteVariant(db: DatabaseInstance, id: string) {
  try {
    await db.delete(serviceVariants).where(eq(serviceVariants.id, id));
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to delete variant");
  }
}

// ---------------------------------------------------------------------------
// Contact Subscriptions
// ---------------------------------------------------------------------------

export async function listSubscriptionsByTeam(
  db: DatabaseInstance,
  teamId: string,
  status?: SubscriptionStatus,
) {
  try {
    const conditions = [eq(contactSubscriptions.teamId, teamId)];
    if (status) conditions.push(eq(contactSubscriptions.status, status));
    return await db
      .select()
      .from(contactSubscriptions)
      .where(and(...conditions))
      .orderBy(contactSubscriptions.startDate);
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to list subscriptions");
  }
}

export async function listSubscriptionsByContact(
  db: DatabaseInstance,
  contactId: string,
) {
  try {
    return await db
      .select()
      .from(contactSubscriptions)
      .where(eq(contactSubscriptions.contactId, contactId))
      .orderBy(contactSubscriptions.startDate);
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to list contact subscriptions");
  }
}

export async function getSubscription(db: DatabaseInstance, id: string) {
  try {
    const [sub] = await db
      .select()
      .from(contactSubscriptions)
      .where(eq(contactSubscriptions.id, id));
    return sub ?? null;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to get subscription");
  }
}

export async function createSubscription(
  db: DatabaseInstance,
  data: NewContactSubscription,
) {
  try {
    const [sub] = await db.insert(contactSubscriptions).values(data).returning();
    return sub;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to create subscription");
  }
}

export async function updateSubscription(
  db: DatabaseInstance,
  id: string,
  data: Partial<NewContactSubscription>,
) {
  try {
    const [updated] = await db
      .update(contactSubscriptions)
      .set(data)
      .where(eq(contactSubscriptions.id, id))
      .returning();
    return updated;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to update subscription");
  }
}

export async function upsertSubscriptionByExternalId(
  db: DatabaseInstance,
  externalId: string,
  data: NewContactSubscription,
) {
  try {
    const [result] = await db
      .insert(contactSubscriptions)
      .values(data)
      .onConflictDoUpdate({
        target: contactSubscriptions.externalId,
        set: {
          status: data.status,
          negotiatedPrice: data.negotiatedPrice,
          endDate: data.endDate,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to upsert subscription");
  }
}

// ---------------------------------------------------------------------------
// Analytics helpers
// ---------------------------------------------------------------------------

export async function countActiveSubscriptionsByVariant(
  db: DatabaseInstance,
  teamId: string,
) {
  try {
    return await db
      .select({
        variantId: contactSubscriptions.variantId,
        count: count(),
      })
      .from(contactSubscriptions)
      .where(
        and(
          eq(contactSubscriptions.teamId, teamId),
          eq(contactSubscriptions.status, "active"),
        ),
      )
      .groupBy(contactSubscriptions.variantId);
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to count subscriptions");
  }
}

export async function listExpiringSoon(
  db: DatabaseInstance,
  teamId: string,
  withinDays = 30,
) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return await db
      .select()
      .from(contactSubscriptions)
      .where(
        and(
          eq(contactSubscriptions.teamId, teamId),
          eq(contactSubscriptions.status, "active"),
          lte(contactSubscriptions.endDate, cutoff.toISOString().slice(0, 10)),
          gte(contactSubscriptions.endDate, new Date().toISOString().slice(0, 10)),
        ),
      );
  } catch (err) {
    propagateError(err);
    throw AppError.database("Failed to list expiring subscriptions");
  }
}
```

**Step 2: Commit**

```bash
git add packages/database/src/repositories/services-repository.ts
git commit -m "feat(db): add services repository"
```

---

## Task 6: oRPC Router

**Files:**
- Create: `apps/web/src/integrations/orpc/router/services.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Write the router**

```typescript
import { ORPCError } from "@orpc/server";
import {
  createService,
  createSubscription,
  createVariant,
  deleteService,
  deleteVariant,
  getService,
  getSubscription,
  listExpiringSoon,
  listServices,
  listSubscriptionsByContact,
  listSubscriptionsByTeam,
  listVariantsByService,
  updateService,
  updateSubscription,
  updateVariant,
} from "@packages/database/repositories/services-repository";
import { contactSubscriptions, serviceVariants, services } from "@packages/database/schemas/services";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const serviceSchema = createInsertSchema(services).pick({
  name: true,
  description: true,
  category: true,
  isActive: true,
});

const variantSchema = createInsertSchema(serviceVariants).pick({
  name: true,
  basePrice: true,
  billingCycle: true,
  isActive: true,
});

const subscriptionSchema = createInsertSchema(contactSubscriptions).pick({
  contactId: true,
  variantId: true,
  startDate: true,
  endDate: true,
  negotiatedPrice: true,
  notes: true,
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const getAll = protectedProcedure.handler(async ({ context }) => {
  const { db, teamId } = context;
  return listServices(db, teamId);
});

export const create = protectedProcedure
  .input(serviceSchema)
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    return createService(db, { ...input, teamId });
  });

export const update = protectedProcedure
  .input(z.object({ id: z.string().uuid() }).merge(serviceSchema.partial()))
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    const service = await getService(db, input.id);
    if (!service || service.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Serviço não encontrado." });
    }
    const { id, ...data } = input;
    return updateService(db, id, data);
  });

export const remove = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    const service = await getService(db, input.id);
    if (!service || service.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Serviço não encontrado." });
    }
    await deleteService(db, input.id);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export const getVariants = protectedProcedure
  .input(z.object({ serviceId: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    const service = await getService(db, input.serviceId);
    if (!service || service.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Serviço não encontrado." });
    }
    return listVariantsByService(db, input.serviceId);
  });

export const createVariantProcedure = protectedProcedure
  .input(z.object({ serviceId: z.string().uuid() }).merge(variantSchema))
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    const service = await getService(db, input.serviceId);
    if (!service || service.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Serviço não encontrado." });
    }
    const { serviceId, ...variantData } = input;
    return createVariant(db, { ...variantData, serviceId, teamId });
  });

export const updateVariantProcedure = protectedProcedure
  .input(z.object({ id: z.string().uuid() }).merge(variantSchema.partial()))
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    // Fetch variant to check ownership via teamId
    const [variant] = await db
      .select()
      .from(serviceVariants)
      .where(require("drizzle-orm").eq(serviceVariants.id, input.id));
    if (!variant || variant.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Variante não encontrada." });
    }
    const { id, ...data } = input;
    return updateVariant(db, id, data);
  });

export const removeVariant = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    const [variant] = await db
      .select()
      .from(serviceVariants)
      .where(require("drizzle-orm").eq(serviceVariants.id, input.id));
    if (!variant || variant.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Variante não encontrada." });
    }
    await deleteVariant(db, input.id);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const getAllSubscriptions = protectedProcedure
  .input(z.object({ status: z.enum(["active", "completed", "cancelled"]).optional() }).optional())
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    return listSubscriptionsByTeam(db, teamId, input?.status);
  });

export const getContactSubscriptions = protectedProcedure
  .input(z.object({ contactId: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const { db } = context;
    return listSubscriptionsByContact(db, input.contactId);
  });

export const createSubscriptionProcedure = protectedProcedure
  .input(subscriptionSchema)
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    return createSubscription(db, { ...input, teamId, source: "manual" });
    // NOTE: bill auto-generation is handled in Task 7 — add it here after implementing generateBillsForSubscription
  });

export const cancelSubscription = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;
    const sub = await getSubscription(db, input.id);
    if (!sub || sub.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Assinatura não encontrada." });
    }
    if (sub.source === "asaas") {
      throw new ORPCError("FORBIDDEN", { message: "Assinaturas do Asaas não podem ser canceladas aqui." });
    }
    return updateSubscription(db, input.id, { status: "cancelled" });
    // NOTE: cancel pending bills — handled in Task 7
  });

export const getExpiringSoon = protectedProcedure.handler(async ({ context }) => {
  const { db, teamId } = context;
  return listExpiringSoon(db, teamId, 30);
});
```

**Step 2: Register in router index**

In `apps/web/src/integrations/orpc/router/index.ts`, add:

```typescript
import * as servicesRouter from "./services";

// in the export default object:
services: servicesRouter,
```

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/services.ts apps/web/src/integrations/orpc/router/index.ts
git commit -m "feat(orpc): add services router"
```

---

## Task 7: Auto-bill generation

**Files:**
- Create: `apps/web/src/integrations/orpc/router/services-bills.ts`
- Modify: `apps/web/src/integrations/orpc/router/services.ts`

**Step 1: Write the bill generation helper**

Create `apps/web/src/integrations/orpc/router/services-bills.ts`:

```typescript
import { bills } from "@packages/database/schemas/bills";
import type { ContactSubscription } from "@packages/database/schemas/services";
import type { DatabaseInstance } from "@packages/database/client";
import type { ServiceVariant } from "@packages/database/schemas/services";

/**
 * Auto-generate receivable bills for a subscription.
 * - monthly: one bill per month in [startDate, endDate]
 * - annual: one bill
 * - one_time: one bill
 * - hourly: no auto-generation (too granular)
 */
export async function generateBillsForSubscription(
  db: DatabaseInstance,
  subscription: ContactSubscription,
  variant: ServiceVariant,
  serviceName: string,
): Promise<void> {
  const { billingCycle } = variant;
  if (billingCycle === "hourly") return; // manual per session

  const amount = (subscription.negotiatedPrice / 100).toFixed(2);
  const start = new Date(subscription.startDate);
  const end = subscription.endDate ? new Date(subscription.endDate) : null;

  const billsToCreate: {
    teamId: string;
    name: string;
    description: string;
    type: "receivable";
    amount: string;
    dueDate: string;
    contactId: string;
    subscriptionId: string;
    status: "pending";
  }[] = [];

  const formatMonthYear = (d: Date) =>
    d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

  const makeBill = (dueDate: Date, label: string) => ({
    teamId: subscription.teamId,
    name: `${serviceName} – ${variant.name}`,
    description: `${serviceName} – ${variant.name} (${label})`,
    type: "receivable" as const,
    amount,
    dueDate: dueDate.toISOString().slice(0, 10),
    contactId: subscription.contactId,
    subscriptionId: subscription.id,
    status: "pending" as const,
  });

  if (billingCycle === "one_time") {
    billsToCreate.push(makeBill(start, "Pagamento único"));
  } else if (billingCycle === "annual") {
    billsToCreate.push(makeBill(start, formatMonthYear(start)));
  } else if (billingCycle === "monthly") {
    const cursor = new Date(start);
    const limit = end ?? (() => { const d = new Date(start); d.setFullYear(d.getFullYear() + 2); return d; })();
    while (cursor <= limit) {
      billsToCreate.push(makeBill(new Date(cursor), formatMonthYear(cursor)));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  if (billsToCreate.length === 0) return;
  await db.insert(bills).values(billsToCreate);
}

/**
 * Cancel all pending bills for a subscription.
 */
export async function cancelPendingBillsForSubscription(
  db: DatabaseInstance,
  subscriptionId: string,
): Promise<void> {
  const { eq, and } = await import("drizzle-orm");
  await db
    .update(bills)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(bills.subscriptionId as any, subscriptionId),
        eq(bills.status, "pending"),
      ),
    );
}
```

**Step 2: Wire into createSubscriptionProcedure**

In `apps/web/src/integrations/orpc/router/services.ts`, update `createSubscriptionProcedure` to call `generateBillsForSubscription` after creating the subscription. First import:

```typescript
import { generateBillsForSubscription } from "./services-bills";
import { listVariantsByService } from "@packages/database/repositories/services-repository";
```

Then update the handler:

```typescript
export const createSubscriptionProcedure = protectedProcedure
  .input(subscriptionSchema)
  .handler(async ({ context, input }) => {
    const { db, teamId } = context;

    // Get the variant + service name for bill generation
    const [variant] = await db.select().from(serviceVariants).where(eq(serviceVariants.id, input.variantId));
    if (!variant || variant.teamId !== teamId) {
      throw new ORPCError("NOT_FOUND", { message: "Variante não encontrada." });
    }
    const service = await getService(db, variant.serviceId);
    if (!service) throw new ORPCError("NOT_FOUND", { message: "Serviço não encontrado." });

    const sub = await createSubscription(db, { ...input, teamId, source: "manual" });

    // Auto-generate bills (non-throwing — don't fail subscription creation if bills fail)
    try {
      await generateBillsForSubscription(db, sub, variant, service.name);
    } catch (err) {
      console.error("[services] Failed to generate bills for subscription:", err);
    }

    return sub;
  });
```

**Step 3: Wire into cancelSubscription**

Update `cancelSubscription` handler to also cancel pending bills:

```typescript
import { cancelPendingBillsForSubscription } from "./services-bills";

// inside cancelSubscription handler, after updateSubscription:
await cancelPendingBillsForSubscription(db, input.id).catch((err) => {
  console.error("[services] Failed to cancel bills for subscription:", err);
});
```

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/services-bills.ts apps/web/src/integrations/orpc/router/services.ts
git commit -m "feat(services): auto-generate and cancel bills on subscription lifecycle"
```

---

## Task 8: UI — Services route + catalog page

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx`
- Create: `apps/web/src/features/services/ui/services-columns.tsx`

**Step 1: Write the columns**

```typescript
// apps/web/src/features/services/ui/services-columns.tsx
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type ServiceRow = {
  id: string;
  name: string;
  category: string | null;
  isActive: boolean;
};

export function buildServiceColumns(
  onEdit: (row: ServiceRow) => void,
  onDelete: (row: ServiceRow) => void,
): ColumnDef<ServiceRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "category",
      header: "Categoria",
      cell: ({ row }) =>
        row.original.category ? (
          <Badge variant="outline">{row.original.category}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button onClick={() => onEdit(row.original)} size="icon" variant="ghost">
            <Pencil className="size-4" />
            <span className="sr-only">Editar</span>
          </Button>
          <Button
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(row.original)}
            size="icon"
            variant="ghost"
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Excluir</span>
          </Button>
        </div>
      ),
    },
  ];
}
```

**Step 2: Write the route page**

```typescript
// apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx
import { DataTable } from "@packages/ui/components/data-table";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Button } from "@packages/ui/components/button";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, Plus } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { buildServiceColumns, type ServiceRow } from "@/features/services/ui/services-columns";
import { ServiceForm } from "@/features/services/ui/services-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
  "/_authenticated/$slug/$teamSlug/_dashboard/erp/services",
)({
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(orpc.services.getAll.queryOptions({}));
  },
  component: ServicesPage,
});

function ServicesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton className="h-12 w-full" key={`skeleton-${i + 1}`} />
      ))}
    </div>
  );
}

function ServicesList() {
  const { openCredenza, closeCredenza } = useCredenza();
  const { openAlertDialog } = useAlertDialog();
  const { data: servicesList } = useSuspenseQuery(orpc.services.getAll.queryOptions({}));

  const deleteMutation = useMutation(
    orpc.services.remove.mutationOptions({
      onSuccess: () => toast.success("Serviço excluído."),
      onError: (e) => toast.error(e.message || "Erro ao excluir serviço."),
    }),
  );

  const handleEdit = useCallback(
    (row: ServiceRow) => {
      openCredenza({ children: <ServiceForm mode="edit" service={row} onSuccess={closeCredenza} /> });
    },
    [openCredenza, closeCredenza],
  );

  const handleDelete = useCallback(
    (row: ServiceRow) => {
      openAlertDialog({
        title: "Excluir serviço",
        description: `Tem certeza que deseja excluir "${row.name}"?`,
        actionLabel: "Excluir",
        cancelLabel: "Cancelar",
        variant: "destructive",
        onAction: async () => { await deleteMutation.mutateAsync({ id: row.id }); },
      });
    },
    [openAlertDialog, deleteMutation],
  );

  if (servicesList.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Briefcase className="size-6" /></EmptyMedia>
          <EmptyTitle>Nenhum serviço</EmptyTitle>
          <EmptyDescription>Cadastre os serviços que sua empresa oferece.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DataTable
      columns={buildServiceColumns(handleEdit, handleDelete)}
      data={servicesList as ServiceRow[]}
      getRowId={(row) => row.id}
      renderMobileCard={({ row }) => (
        <div className="rounded-lg border bg-background p-4 space-y-1">
          <p className="font-medium">{row.original.name}</p>
          {row.original.category && <p className="text-sm text-muted-foreground">{row.original.category}</p>}
          <div className="flex gap-2 pt-1">
            <Button onClick={() => handleEdit(row.original)} size="sm" variant="outline">Editar</Button>
            <Button className="text-destructive" onClick={() => handleDelete(row.original)} size="sm" variant="ghost">Excluir</Button>
          </div>
        </div>
      )}
    />
  );
}

function ServicesPage() {
  const { openCredenza, closeCredenza } = useCredenza();

  const handleCreate = useCallback(() => {
    openCredenza({ children: <ServiceForm mode="create" onSuccess={closeCredenza} /> });
  }, [openCredenza, closeCredenza]);

  return (
    <main className="flex flex-col gap-4">
      <DefaultHeader
        actions={
          <Button onClick={handleCreate} size="sm">
            <Plus className="size-4 mr-1" />
            Novo Serviço
          </Button>
        }
        description="Gerencie o catálogo de serviços"
        title="Serviços"
      />
      <Suspense fallback={<ServicesSkeleton />}>
        <ServicesList />
      </Suspense>
    </main>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx apps/web/src/features/services/ui/services-columns.tsx
git commit -m "feat(services): add services catalog page and columns"
```

---

## Task 9: UI — Service form (create/edit with variants)

**Files:**
- Create: `apps/web/src/features/services/ui/services-form.tsx`

**Step 1: Write the form**

```typescript
// apps/web/src/features/services/ui/services-form.tsx
import { MoneyInput } from "@packages/ui/components/money-input";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@packages/ui/components/select";
import {
  CredenzaBody, CredenzaHeader, CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { ServiceRow } from "./services-columns";

const BILLING_CYCLE_LABELS: Record<string, string> = {
  hourly: "Por hora",
  monthly: "Mensal",
  annual: "Anual",
  one_time: "Pagamento único",
};

interface ServiceFormProps {
  mode: "create" | "edit";
  service?: ServiceRow;
  onSuccess: () => void;
}

export function ServiceForm({ mode, service, onSuccess }: ServiceFormProps) {
  const [isPending, startTransition] = useTransition();

  const createMutation = useMutation(orpc.services.create.mutationOptions());
  const updateMutation = useMutation(orpc.services.update.mutationOptions());
  const createVariantMutation = useMutation(orpc.services.createVariant.mutationOptions());

  const form = useForm({
    defaultValues: {
      name: service?.name ?? "",
      category: service?.category ?? "",
      description: "",
      variants: [] as { name: string; basePrice: number; billingCycle: string }[],
    },
    onSubmit: async ({ value }) => {
      if (mode === "create") {
        const newService = await createMutation.mutateAsync({
          name: value.name,
          category: value.category || undefined,
          isActive: true,
        });
        // Create variants
        await Promise.all(
          value.variants.map((v) =>
            createVariantMutation.mutateAsync({
              serviceId: newService.id,
              name: v.name,
              basePrice: v.basePrice ?? 0,
              billingCycle: v.billingCycle as any,
              isActive: true,
            }),
          ),
        );
        toast.success("Serviço criado.");
      } else if (service) {
        await updateMutation.mutateAsync({ id: service.id, name: value.name, category: value.category || undefined });
        toast.success("Serviço atualizado.");
      }
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => { await form.handleSubmit(); });
  };

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>{mode === "create" ? "Novo Serviço" : "Editar Serviço"}</CredenzaTitle>
      </CredenzaHeader>
      <CredenzaBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <form.Field name="name">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Ex: Espaço Compartilhado"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Ex: Coworking"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          {mode === "create" && (
            <form.Field name="variants" mode="array">
              {(field) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Variantes</Label>
                    <Button
                      onClick={() =>
                        field.pushValue({ name: "", basePrice: 0, billingCycle: "monthly" })
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus className="size-3.5 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {field.state.value.map((_, i) => (
                    <div className="border rounded-md p-3 space-y-2" key={`variant-${i + 1}`}>
                      <form.Field name={`variants[${i}].name`}>
                        {(f) => (
                          <Input
                            onChange={(e) => f.handleChange(e.target.value)}
                            placeholder="Nome da variante"
                            value={f.state.value}
                          />
                        )}
                      </form.Field>
                      <div className="flex gap-2">
                        <form.Field name={`variants[${i}].basePrice`}>
                          {(f) => (
                            <MoneyInput
                              className="flex-1"
                              onChange={(v) => f.handleChange(v ?? 0)}
                              value={f.state.value}
                            />
                          )}
                        </form.Field>
                        <form.Field name={`variants[${i}].billingCycle`}>
                          {(f) => (
                            <Select onValueChange={f.handleChange} value={f.state.value}>
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(BILLING_CYCLE_LABELS).map(([v, l]) => (
                                  <SelectItem key={v} value={v}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </form.Field>
                        <Button
                          onClick={() => field.removeValue(i)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form.Field>
          )}

          <form.Subscribe>
            {(state) => (
              <Button className="w-full" disabled={!state.canSubmit || isPending} type="submit">
                {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {mode === "create" ? "Criar Serviço" : "Salvar"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CredenzaBody>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/services/ui/services-form.tsx
git commit -m "feat(services): add service create/edit form with variants"
```

---

## Task 10: UI — Subscription form with live discount

**Files:**
- Create: `apps/web/src/features/services/ui/subscription-form.tsx`

**Step 1: Write the subscription form**

```typescript
// apps/web/src/features/services/ui/subscription-form.tsx
import { formatAmount, fromMinorUnits } from "@f-o-t/money";
import { MoneyInput } from "@packages/ui/components/money-input";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@packages/ui/components/select";
import {
  CredenzaBody, CredenzaHeader, CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Badge } from "@packages/ui/components/badge";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useTransition, useMemo } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface SubscriptionFormProps {
  contactId: string;
  onSuccess: () => void;
}

export function SubscriptionForm({ contactId, onSuccess }: SubscriptionFormProps) {
  const [isPending, startTransition] = useTransition();

  const { data: servicesList } = useSuspenseQuery(orpc.services.getAll.queryOptions({}));

  const createMutation = useMutation(orpc.services.createSubscription.mutationOptions({
    onSuccess: () => { toast.success("Assinatura criada."); onSuccess(); },
    onError: (e) => toast.error(e.message || "Erro ao criar assinatura."),
  }));

  const form = useForm({
    defaultValues: {
      serviceId: "",
      variantId: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      negotiatedPrice: 0,
      notes: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        contactId,
        variantId: value.variantId,
        startDate: value.startDate,
        endDate: value.endDate || undefined,
        negotiatedPrice: value.negotiatedPrice,
        notes: value.notes || undefined,
      });
    },
  });

  // Derive selected variant for base price display
  const selectedServiceId = form.useStore((s) => s.values.serviceId);
  const selectedVariantId = form.useStore((s) => s.values.variantId);
  const negotiatedPrice = form.useStore((s) => s.values.negotiatedPrice);

  const selectedService = servicesList.find((s) => s.id === selectedServiceId);

  // We need variants — fetch them when service is selected
  // Use useQuery with enabled flag
  const { data: variants = [] } = useSuspenseQuery(
    selectedServiceId
      ? orpc.services.getVariants.queryOptions({ input: { serviceId: selectedServiceId } })
      : { queryKey: ["no-service"], queryFn: async () => [] as any[] },
  );

  const selectedVariant = variants.find((v: any) => v.id === selectedVariantId);

  const discountPercent = useMemo(() => {
    if (!selectedVariant || !negotiatedPrice || selectedVariant.basePrice <= 0) return null;
    const pct = ((selectedVariant.basePrice - negotiatedPrice) / selectedVariant.basePrice) * 100;
    return pct > 0 ? pct.toFixed(1) : null;
  }, [selectedVariant, negotiatedPrice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => { await form.handleSubmit(); });
  };

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>Nova Assinatura</CredenzaTitle>
      </CredenzaHeader>
      <CredenzaBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Service select */}
          <form.Field name="serviceId">
            {(field) => (
              <div className="space-y-1">
                <Label>Serviço *</Label>
                <Select
                  onValueChange={(v) => { field.handleChange(v); form.setFieldValue("variantId", ""); }}
                  value={field.state.value}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
                  <SelectContent>
                    {servicesList.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          {/* Variant select */}
          {selectedServiceId && (
            <form.Field name="variantId">
              {(field) => (
                <div className="space-y-1">
                  <Label>Variante *</Label>
                  <Select onValueChange={field.handleChange} value={field.state.value}>
                    <SelectTrigger><SelectValue placeholder="Selecione a variante" /></SelectTrigger>
                    <SelectContent>
                      {variants.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} — {formatAmount(fromMinorUnits(v.basePrice, "BRL"), "pt-BR")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <form.Field name="startDate">
              {(field) => (
                <div className="space-y-1">
                  <Label>Início *</Label>
                  <Input type="date" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
                </div>
              )}
            </form.Field>
            <form.Field name="endDate">
              {(field) => (
                <div className="space-y-1">
                  <Label>Fim</Label>
                  <Input type="date" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
                </div>
              )}
            </form.Field>
          </div>

          {/* Negotiated price + live discount */}
          <form.Field name="negotiatedPrice">
            {(field) => (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Preço negociado *</Label>
                  {discountPercent && (
                    <Badge variant="secondary">{discountPercent}% de desconto</Badge>
                  )}
                </div>
                <MoneyInput
                  onChange={(v) => field.handleChange(v ?? 0)}
                  value={field.state.value}
                />
                {selectedVariant && (
                  <p className="text-xs text-muted-foreground">
                    Preço base: {formatAmount(fromMinorUnits(selectedVariant.basePrice, "BRL"), "pt-BR")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Notes */}
          <form.Field name="notes">
            {(field) => (
              <div className="space-y-1">
                <Label>Observações</Label>
                <Input
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Ex: Contrato de 6 meses negociado em mar/26"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe>
            {(state) => (
              <Button className="w-full" disabled={!state.canSubmit || isPending} type="submit">
                {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Criar Assinatura
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CredenzaBody>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/services/ui/subscription-form.tsx
git commit -m "feat(services): add subscription form with live discount calculation"
```

---

## Task 11: UI — Revenue analytics header

**Files:**
- Create: `apps/web/src/features/services/ui/services-analytics-header.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx`

**Step 1: Write the analytics header component**

```typescript
// apps/web/src/features/services/ui/services-analytics-header.tsx
import { formatAmount, fromMinorUnits } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle, TrendingUp, Users } from "lucide-react";
import { Suspense } from "react";
import { orpc } from "@/integrations/orpc/client";

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function AnalyticsContent() {
  const { data: subscriptions } = useSuspenseQuery(
    orpc.services.getAllSubscriptions.queryOptions({ input: { status: "active" } }),
  );
  const { data: expiring } = useSuspenseQuery(orpc.services.getExpiringSoon.queryOptions({}));

  // Total monthly recurring revenue (MRR) from active subscriptions
  const mrr = subscriptions
    .filter((s: any) => s.billingCycle === "monthly" || !s.billingCycle)
    .reduce((sum: number, s: any) => sum + (s.negotiatedPrice ?? 0), 0);

  // Average discount across all active subscriptions that have a base price
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard
        icon={<TrendingUp className="size-4" />}
        label="Receita mensal ativa"
        value={formatAmount(fromMinorUnits(mrr, "BRL"), "pt-BR")}
      />
      <StatCard
        icon={<Users className="size-4" />}
        label="Assinaturas ativas"
        value={String(subscriptions.length)}
      />
      <div className="rounded-lg border bg-background p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <AlertCircle className="size-4" />
          Vencem em 30 dias
        </div>
        <p className="text-xl font-semibold">{expiring.length}</p>
        {expiring.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {expiring.slice(0, 3).map((s: any) => (
              <Badge key={s.id} variant="outline" className="text-xs">
                {s.endDate}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ServicesAnalyticsHeader() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton className="h-20 w-full" key={`stat-skeleton-${i + 1}`} />
          ))}
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
```

**Step 2: Add to services route page**

In the services route, import `ServicesAnalyticsHeader` and render it above the table:

```typescript
import { ServicesAnalyticsHeader } from "@/features/services/ui/services-analytics-header";

// Inside ServicesPage, add before the Suspense:
<ServicesAnalyticsHeader />
```

**Step 3: Commit**

```bash
git add apps/web/src/features/services/ui/services-analytics-header.tsx apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx
git commit -m "feat(services): add revenue analytics header"
```

---

## Task 12: Feature gating — sidebar + billing overview

**Files:**
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`
- Modify: `apps/web/src/features/billing/ui/billing-overview.tsx`

**Step 1: Add to sidebar**

In `sidebar-nav-items.ts`, in the `erp` group array, add after the contacts item:

```typescript
{
  id: "services",
  label: "Serviços",
  icon: Briefcase,
  route: "/$slug/$teamSlug/erp/services",
  earlyAccessFlag: "services",
},
```

Also add `Briefcase` to the lucide-react import at the top.

**Step 2: Add to billing overview**

In `billing-overview.tsx`, find `EARLY_ACCESS_CATEGORY_GATES` and add:

```typescript
service: { flag: "services", fallbackStage: "alpha" },
```

**Step 3: Commit**

```bash
git add apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts apps/web/src/features/billing/ui/billing-overview.tsx
git commit -m "feat(services): add sidebar nav item and billing overview early access card"
```

---

## Deferred: Asaas Integration

> Tasks 13–17 (queue, server receiver, worker job, env vars) are **deferred** to a separate session.
> The Asaas integration is per-team (each team has their own Asaas credentials), which requires
> its own design — credential storage, per-team token validation, and subscription mapping.
> The `source` + `externalId` columns on `contacts` and `contact_subscriptions` are already
> in the schema so the data model is ready when the time comes.

---

## ~~Task 13: Queue — Asaas webhook job definition~~ *(deferred)*

**Files:**
- Create: `packages/queue/src/asaas-webhook.ts`

**Step 1: Write the queue definition**

```typescript
// packages/queue/src/asaas-webhook.ts
import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";

export const ASAAS_WEBHOOK_QUEUE = "asaas-webhook";

export interface AsaasWebhookJobData {
  event: string;       // e.g. "PAYMENT_RECEIVED", "SUBSCRIPTION_CREATED"
  payload: Record<string, unknown>;
  teamId: string;      // resolved from the webhook token/secret
  receivedAt: string;  // ISO timestamp
}

export function createAsaasWebhookQueue(
  connection: ConnectionOptions,
): Queue<AsaasWebhookJobData> {
  return new Queue<AsaasWebhookJobData>(ASAAS_WEBHOOK_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  });
}
```

**Step 2: Commit**

```bash
git add packages/queue/src/asaas-webhook.ts
git commit -m "feat(queue): add asaas-webhook queue definition"
```

---

## ~~Task 14: Environment variable — ASAAS_WEBHOOK_TOKEN~~ *(deferred)*

**Files:**
- Modify: `packages/environment/src/server.ts`

**Step 1: Add the env var**

In the `server` object of `createEnv`, add (alongside the Stripe vars is a good spot):

```typescript
// Asaas (Optional — only for teams using Asaas integration)
ASAAS_WEBHOOK_TOKEN: z.string().optional(),
```

**Step 2: Add to .env.local (dev)**

```bash
# In packages/database/.env.local
ASAAS_WEBHOOK_TOKEN=your_asaas_token_here
```

**Step 3: Commit**

```bash
git add packages/environment/src/server.ts
git commit -m "feat(env): add ASAAS_WEBHOOK_TOKEN"
```

---

## ~~Task 15: Server — Asaas webhook receiver~~ *(deferred)*

**Files:**
- Create: `apps/server/src/routes/webhooks/asaas.ts`
- Modify: `apps/server/src/index.ts` (or main Elysia entry)

**Step 1: Find the server entry point**

```bash
ls apps/server/src/
```

Locate the main Elysia app file (typically `index.ts` or `app.ts`).

**Step 2: Write the webhook route**

```typescript
// apps/server/src/routes/webhooks/asaas.ts
import { env } from "@packages/environment/server";
import { createQueueConnection } from "@packages/queue/connection";
import { ASAAS_WEBHOOK_QUEUE, createAsaasWebhookQueue } from "@packages/queue/asaas-webhook";
import Elysia from "elysia";

const queueConnection = createQueueConnection(env.REDIS_URL);
const asaasQueue = createAsaasWebhookQueue(queueConnection);

export const asaasWebhookRoute = new Elysia().post(
  "/webhooks/asaas",
  async ({ body, headers, set }) => {
    // Verify Asaas token (Asaas sends it as a header or query param)
    // Asaas uses asaas-access-token header
    const token = headers["asaas-access-token"];
    if (!env.ASAAS_WEBHOOK_TOKEN || token !== env.ASAAS_WEBHOOK_TOKEN) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const payload = body as Record<string, unknown>;
    const event = typeof payload.event === "string" ? payload.event : "UNKNOWN";

    await asaasQueue.add(event, {
      event,
      payload,
      teamId: "", // TODO: resolve teamId from token mapping once multi-tenant Asaas is needed
      receivedAt: new Date().toISOString(),
    });

    // Always return 200 immediately — Asaas will retry on non-2xx
    set.status = 200;
    return { received: true };
  },
  { type: "json" },
);
```

**Step 3: Register the route in the server app**

In `apps/server/src/index.ts`, import and use the route:

```typescript
import { asaasWebhookRoute } from "./routes/webhooks/asaas";

app.use(asaasWebhookRoute);
```

**Step 4: Commit**

```bash
git add apps/server/src/routes/webhooks/asaas.ts apps/server/src/index.ts
git commit -m "feat(server): add POST /webhooks/asaas receiver"
```

---

## ~~Task 16: Worker job — process-asaas-webhook~~ *(deferred)*

**Files:**
- Create: `apps/worker/src/jobs/process-asaas-webhook.ts`

**Step 1: Write the job**

```typescript
// apps/worker/src/jobs/process-asaas-webhook.ts
import type { DatabaseInstance } from "@packages/database/client";
import {
  contacts,
} from "@packages/database/schema";
import {
  createSubscription,
  upsertSubscriptionByExternalId,
  updateSubscription,
} from "@packages/database/repositories/services-repository";
import {
  createContact,
  updateContact,
} from "@packages/database/repositories/contacts-repository";
import type { AsaasWebhookJobData } from "@packages/queue/asaas-webhook";
import { eq } from "drizzle-orm";
import { bills } from "@packages/database/schema";

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCustomerCreated(db: DatabaseInstance, payload: Record<string, unknown>, teamId: string) {
  const customer = payload.customer as Record<string, unknown>;
  if (!customer) return;
  // Upsert contact by externalId
  const existing = await db.select().from(contacts).where(eq(contacts.externalId, String(customer.id))).limit(1);
  if (existing.length > 0) {
    await updateContact(db, existing[0].id, {
      name: String(customer.name ?? ""),
      email: customer.email ? String(customer.email) : undefined,
      phone: customer.mobilePhone ? String(customer.mobilePhone) : undefined,
    });
  } else {
    await createContact(db, {
      teamId,
      name: String(customer.name ?? "Sem nome"),
      type: "cliente",
      email: customer.email ? String(customer.email) : undefined,
      phone: customer.mobilePhone ? String(customer.mobilePhone) : undefined,
      source: "asaas",
      externalId: String(customer.id),
    });
  }
}

async function handleCustomerUpdated(db: DatabaseInstance, payload: Record<string, unknown>) {
  const customer = payload.customer as Record<string, unknown>;
  if (!customer) return;
  const existing = await db.select().from(contacts).where(eq(contacts.externalId, String(customer.id))).limit(1);
  if (existing.length > 0) {
    await updateContact(db, existing[0].id, {
      name: customer.name ? String(customer.name) : undefined,
      email: customer.email ? String(customer.email) : undefined,
      phone: customer.mobilePhone ? String(customer.mobilePhone) : undefined,
    });
  }
}

async function handleSubscriptionCreated(db: DatabaseInstance, payload: Record<string, unknown>, teamId: string) {
  const sub = payload.subscription as Record<string, unknown>;
  if (!sub) return;
  // Find contact by Asaas customer ID
  const customer = payload.customer as Record<string, unknown>;
  const contactRows = customer
    ? await db.select().from(contacts).where(eq(contacts.externalId, String(customer.id))).limit(1)
    : [];
  if (contactRows.length === 0) return; // contact not synced yet — will be created on CUSTOMER_CREATED

  await upsertSubscriptionByExternalId(db, String(sub.id), {
    teamId,
    contactId: contactRows[0].id,
    variantId: "", // TODO: map from Asaas plan to variant
    startDate: String(sub.dateCreated ?? new Date().toISOString().slice(0, 10)),
    endDate: sub.endDate ? String(sub.endDate) : undefined,
    negotiatedPrice: sub.value ? Math.round(Number(sub.value) * 100) : 0,
    source: "asaas",
    externalId: String(sub.id),
    status: "active",
  });
}

async function handleSubscriptionUpdated(db: DatabaseInstance, payload: Record<string, unknown>) {
  const sub = payload.subscription as Record<string, unknown>;
  if (!sub) return;
  const existing = await db
    .select()
    .from(require("@packages/database/schema").contactSubscriptions)
    .where(eq(require("@packages/database/schema").contactSubscriptions.externalId, String(sub.id)))
    .limit(1);
  if (existing.length > 0) {
    await updateSubscription(db, existing[0].id, {
      negotiatedPrice: sub.value ? Math.round(Number(sub.value) * 100) : undefined,
      endDate: sub.endDate ? String(sub.endDate) : undefined,
    });
  }
}

async function handleSubscriptionCancelled(db: DatabaseInstance, payload: Record<string, unknown>) {
  const sub = payload.subscription as Record<string, unknown>;
  if (!sub) return;
  const { contactSubscriptions } = require("@packages/database/schema");
  const existing = await db
    .select()
    .from(contactSubscriptions)
    .where(eq(contactSubscriptions.externalId, String(sub.id)))
    .limit(1);
  if (existing.length > 0) {
    await updateSubscription(db, existing[0].id, { status: "cancelled" });
    // Cancel pending bills
    const { and } = require("drizzle-orm");
    await db
      .update(bills)
      .set({ status: "cancelled" })
      .where(and(eq(bills.subscriptionId, existing[0].id), eq(bills.status, "pending")));
  }
}

async function handlePaymentReceived(db: DatabaseInstance, payload: Record<string, unknown>, teamId: string) {
  const payment = payload.payment as Record<string, unknown>;
  if (!payment) return;
  // Find contact from customer
  const customer = payload.customer as Record<string, unknown>;
  if (!customer) return;
  const contactRows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.externalId, String(customer.id)))
    .limit(1);
  if (contactRows.length === 0) return;

  // Create a transaction (income)
  const { transactions } = require("@packages/database/schema");
  const { sql } = require("drizzle-orm");
  await db.insert(transactions).values({
    teamId,
    contactId: contactRows[0].id,
    type: "income",
    amount: String(Number(payment.value ?? 0).toFixed(2)),
    date: String(payment.paymentDate ?? new Date().toISOString().slice(0, 10)),
    description: `Pagamento Asaas — ${payment.description ?? payment.id}`,
  }).onConflictDoNothing();
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function processAsaasWebhook(
  db: DatabaseInstance,
  job: AsaasWebhookJobData,
): Promise<void> {
  const { event, payload, teamId } = job;

  console.log(`[Worker] Processing Asaas event: ${event}`);

  switch (event) {
    case "CUSTOMER_CREATED":
      await handleCustomerCreated(db, payload, teamId);
      break;
    case "CUSTOMER_UPDATED":
      await handleCustomerUpdated(db, payload);
      break;
    case "SUBSCRIPTION_CREATED":
      await handleSubscriptionCreated(db, payload, teamId);
      break;
    case "SUBSCRIPTION_UPDATED":
      await handleSubscriptionUpdated(db, payload);
      break;
    case "SUBSCRIPTION_CANCELLED":
    case "SUBSCRIPTION_DELETED":
      await handleSubscriptionCancelled(db, payload);
      break;
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED":
      await handlePaymentReceived(db, payload, teamId);
      break;
    default:
      console.log(`[Worker] Unhandled Asaas event: ${event}`);
  }
}
```

**Step 2: Commit**

```bash
git add apps/worker/src/jobs/process-asaas-webhook.ts
git commit -m "feat(worker): add Asaas webhook job processor"
```

---

## ~~Task 17: Wire worker job into BullMQ worker~~ *(deferred)*

**Files:**
- Create: `apps/worker/src/workers/asaas-webhook.ts`
- Modify: `apps/worker/src/index.ts`

**Step 1: Write the BullMQ worker wrapper**

```typescript
// apps/worker/src/workers/asaas-webhook.ts
import type { DatabaseInstance } from "@packages/database/client";
import type { ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { ASAAS_WEBHOOK_QUEUE, type AsaasWebhookJobData } from "@packages/queue/asaas-webhook";
import { processAsaasWebhook } from "../jobs/process-asaas-webhook";

export function startAsaasWebhookWorker(
  connection: ConnectionOptions,
  db: DatabaseInstance,
): Worker {
  const worker = new Worker<AsaasWebhookJobData>(
    ASAAS_WEBHOOK_QUEUE,
    async (job) => {
      await processAsaasWebhook(db, job.data);
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Asaas webhook job ${job?.id} failed:`, err.message);
  });

  return worker;
}
```

**Step 2: Register in index.ts**

In `apps/worker/src/index.ts`, add:

```typescript
import { startAsaasWebhookWorker } from "./workers/asaas-webhook";

// Inside main(), after existing workers:
const asaasWorker = startAsaasWebhookWorker(queueConnection, db);

// In shutdown():
await asaasWorker.close();
```

**Step 3: Commit**

```bash
git add apps/worker/src/workers/asaas-webhook.ts apps/worker/src/index.ts
git commit -m "feat(worker): register Asaas webhook BullMQ worker"
```

---

## Final verification

**Step 1: Run typecheck**

```bash
bun run typecheck
```
Expected: No errors.

**Step 2: Run linter**

```bash
bun run check
```
Expected: No errors.

**Step 3: Start dev and smoke test**

```bash
bun dev
```

1. Enable `services` PostHog feature flag for your test org
2. Navigate to ERP → Serviços — confirm page loads
3. Create a service with 2 variants
4. Open a contact → create a subscription — confirm bills are created in Finance → Contas
5. Cancel the subscription — confirm pending bills are cancelled
6. Send a test Asaas webhook to `POST /webhooks/asaas` with header `asaas-access-token: <token>` — confirm job is enqueued and processed

**Step 4: Final commit tag**

```bash
git commit --allow-empty -m "feat: services module complete"
```
