# Services Pricing Paradigm — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat `serviceVariants` model with a full usage-based billing stack — meters, typed prices, subscription items, coupons, and benefits — while preserving all existing oRPC contracts.

**Architecture:** New tables live in `crmSchema` (crm PG schema). `serviceVariants` is renamed to `service_prices` with a `type` discriminator. `contactSubscriptions` becomes a billing container; per-price line items move to `subscription_items`. `meters` drive usage aggregation for `metered` price types and link to `usage_events`.

**Tech Stack:** Drizzle ORM, PostgreSQL (ParadeDB), Zod, neverthrow, `@core/database`, `@core/logging/errors`, `bun run db:push`

---

## Dependency Order (read before starting)

```
meters
  └─ service_prices  (meterId FK → meters.id)
  └─ usage_events    (meterId FK → meters.id, currently text — type change)
       coupons
         └─ contactSubscriptions  (couponId FK → coupons.id)
              └─ subscription_items  (subscriptionId FK → contactSubscriptions.id)
                                     (priceId FK → service_prices.id)
              └─ coupon_redemptions  (subscriptionId FK)
       benefits
         └─ service_benefits  (serviceId FK, benefitId FK)
```

---

## Task 1: Create `meters` schema

**Files:**
- Create: `core/database/src/schemas/meters.ts`

**Step 1: Write the schema file**

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   jsonb,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { crmSchema } from "@core/database/schemas/schemas";

export const meterAggregationEnum = crmSchema.enum("meter_aggregation", [
   "sum",
   "count",
   "count_unique",
   "max",
   "last",
]);

export type MeterAggregation = (typeof meterAggregationEnum.enumValues)[number];

export const meters = crmSchema.table(
   "meters",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      eventName: text("event_name").notNull(),
      aggregation: meterAggregationEnum("aggregation").notNull().default("sum"),
      aggregationProperty: text("aggregation_property"),
      filters: jsonb("filters")
         .$type<Record<string, unknown>>()
         .notNull()
         .default(sql`'{}'::jsonb`),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      uniqueIndex("meters_team_id_event_name_idx").on(
         table.teamId,
         table.eventName,
      ),
      index("meters_team_id_idx").on(table.teamId),
   ],
);

export type Meter = typeof meters.$inferSelect;
export type NewMeter = typeof meters.$inferInsert;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const baseSchema = createInsertSchema(meters).pick({
   name: true,
   eventName: true,
   aggregation: true,
   aggregationProperty: true,
   filters: true,
});

export const createMeterSchema = baseSchema.extend({
   name: nameSchema,
   eventName: z.string().min(1, "Nome do evento é obrigatório."),
   aggregation: z.enum(["sum", "count", "count_unique", "max", "last"]).default("sum"),
   aggregationProperty: z.string().nullable().optional(),
   filters: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateMeterSchema = z.object({
   name: nameSchema.optional(),
   isActive: z.boolean().optional(),
});

export type CreateMeterInput = z.infer<typeof createMeterSchema>;
export type UpdateMeterInput = z.infer<typeof updateMeterSchema>;
```

> Note: `aggregation + eventName + filters` are immutable once usage events exist — enforced at the application layer (not DB constraint).

**Step 2: Verify TypeScript compiles**

```bash
cd core/database && bun run typecheck
```

Expected: no errors on new file (other files don't import it yet).

**Step 3: Commit**

```bash
git add core/database/src/schemas/meters.ts
git commit -m "feat(database): add meters schema"
```

---

## Task 2: Rename `serviceVariants` → `servicePrices` with new fields

**Files:**
- Modify: `core/database/src/schemas/services.ts`

**Step 1: Update the schema**

Replace the entire `serviceVariants` block. Also remove `basePrice` from `services`. The existing `services` import of `billingCycleEnum` from subscriptions stays (reused for `interval` on prices).

Full new `services.ts`:

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   numeric,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { categories } from "@core/database/schemas/categories";
import { billingCycleEnum } from "@core/database/schemas/subscriptions";
import { meters } from "@core/database/schemas/meters";
import { tags } from "@core/database/schemas/tags";
import { crmSchema } from "@core/database/schemas/schemas";

export const pricingTypeEnum = crmSchema.enum("pricing_type", [
   "flat",
   "per_unit",
   "metered",
]);

export type PricingType = (typeof pricingTypeEnum.enumValues)[number];

export const services = crmSchema.table(
   "services",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("services_team_id_idx").on(table.teamId)],
);

export const servicePrices = crmSchema.table(
   "service_prices",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: pricingTypeEnum("type").notNull().default("flat"),
      basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
      interval: billingCycleEnum("interval").notNull(),
      meterId: uuid("meter_id").references(() => meters.id, {
         onDelete: "set null",
      }),
      priceCap: numeric("price_cap", { precision: 12, scale: 2 }),
      trialDays: integer("trial_days"),
      autoEnroll: boolean("auto_enroll").notNull().default(false),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("service_prices_service_id_idx").on(table.serviceId),
      index("service_prices_team_id_idx").on(table.teamId),
      index("service_prices_meter_id_idx").on(table.meterId),
   ],
);

export const resources = crmSchema.table(
   "resources",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      capacity: integer("capacity").notNull().default(1),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
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

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServicePrice = typeof servicePrices.$inferSelect;
export type NewServicePrice = typeof servicePrices.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido maior ou igual a zero.",
   });

const baseServiceSchema = createInsertSchema(services).pick({
   name: true,
   description: true,
   categoryId: true,
   tagId: true,
});

export const createServiceSchema = baseServiceSchema.extend({
   name: nameSchema,
   description: z.string().max(500).nullable().optional(),
   categoryId: z.string().uuid().nullable().optional(),
   tagId: z.string().uuid().nullable().optional(),
});

export const updateServiceSchema = baseServiceSchema
   .extend({
      name: nameSchema.optional(),
      description: z.string().max(500).nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
   })
   .partial();

const basePriceSchema = createInsertSchema(servicePrices).pick({
   name: true,
   type: true,
   basePrice: true,
   interval: true,
   meterId: true,
   priceCap: true,
   trialDays: true,
   autoEnroll: true,
});

export const createPriceSchema = basePriceSchema.extend({
   name: nameSchema,
   type: z.enum(["flat", "per_unit", "metered"]).default("flat"),
   basePrice: priceSchema,
   interval: z.enum(["hourly", "monthly", "annual", "one_time"]),
   meterId: z.string().uuid().nullable().optional(),
   priceCap: priceSchema.nullable().optional(),
   trialDays: z.number().int().min(0).nullable().optional(),
   autoEnroll: z.boolean().default(false),
});

export const updatePriceSchema = basePriceSchema
   .extend({
      name: nameSchema.optional(),
      basePrice: priceSchema.optional(),
      interval: z.enum(["hourly", "monthly", "annual", "one_time"]).optional(),
      isActive: z.boolean().optional(),
   })
   .partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;

// Legacy aliases — keep until router is updated
export const serviceVariants = servicePrices;
export type ServiceVariant = ServicePrice;
export type NewServiceVariant = NewServicePrice;
export const createVariantSchema = createPriceSchema;
export const updateVariantSchema = updatePriceSchema;
export type CreateVariantInput = CreatePriceInput;
export type UpdateVariantInput = UpdatePriceInput;
```

> The legacy aliases at the bottom prevent breaking the repos/router until they're updated in later tasks. Remove them in Task 10.

**Step 2: Typecheck**

```bash
cd core/database && bun run typecheck
```

Expected: any errors related to removed `basePrice` field on `createServiceSchema` — fix callers in the same session.

**Step 3: Commit**

```bash
git add core/database/src/schemas/services.ts
git commit -m "feat(database): rename serviceVariants to servicePrices, remove services.basePrice"
```

---

## Task 3: Create `coupons` + `coupon_redemptions` schemas

**Files:**
- Create: `core/database/src/schemas/coupons.ts`

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   jsonb,
   numeric,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { contacts } from "@core/database/schemas/contacts";
import { crmSchema } from "@core/database/schemas/schemas";

export const couponScopeEnum = crmSchema.enum("coupon_scope", [
   "team",
   "price",
]);

export const couponTypeEnum = crmSchema.enum("coupon_type", [
   "percent",
   "fixed",
]);

export const couponDurationEnum = crmSchema.enum("coupon_duration", [
   "once",
   "repeating",
   "forever",
]);

export type CouponScope = (typeof couponScopeEnum.enumValues)[number];
export type CouponType = (typeof couponTypeEnum.enumValues)[number];
export type CouponDuration = (typeof couponDurationEnum.enumValues)[number];

export const coupons = crmSchema.table(
   "coupons",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      code: text("code").notNull(),
      scope: couponScopeEnum("scope").notNull().default("team"),
      priceId: uuid("price_id"),
      type: couponTypeEnum("type").notNull(),
      amount: numeric("amount", { precision: 12, scale: 4 }).notNull(),
      duration: couponDurationEnum("duration").notNull(),
      durationMonths: integer("duration_months"),
      maxUses: integer("max_uses"),
      usedCount: integer("used_count").notNull().default(0),
      redeemBy: timestamp("redeem_by", { withTimezone: true }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      uniqueIndex("coupons_team_id_code_idx").on(table.teamId, sql`lower(${table.code})`),
      index("coupons_team_id_idx").on(table.teamId),
   ],
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;

export const couponRedemptions = crmSchema.table(
   "coupon_redemptions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      couponId: uuid("coupon_id")
         .notNull()
         .references(() => coupons.id, { onDelete: "restrict" }),
      subscriptionId: uuid("subscription_id").notNull(),
      contactId: uuid("contact_id")
         .notNull()
         .references(() => contacts.id, { onDelete: "cascade" }),
      discountSnapshot: jsonb("discount_snapshot")
         .$type<{
            code: string;
            type: CouponType;
            amount: string;
            duration: CouponDuration;
            durationMonths: number | null;
         }>()
         .notNull(),
      redeemedAt: timestamp("redeemed_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      index("coupon_redemptions_coupon_id_idx").on(table.couponId),
      index("coupon_redemptions_subscription_id_idx").on(table.subscriptionId),
      index("coupon_redemptions_team_id_idx").on(table.teamId),
   ],
);

export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type NewCouponRedemption = typeof couponRedemptions.$inferInsert;

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Valor deve ser um número positivo.",
   });

export const createCouponSchema = z.object({
   code: z.string().min(1).max(50, "Código deve ter no máximo 50 caracteres."),
   scope: z.enum(["team", "price"]).default("team"),
   priceId: z.string().uuid().nullable().optional(),
   type: z.enum(["percent", "fixed"]),
   amount: priceSchema,
   duration: z.enum(["once", "repeating", "forever"]),
   durationMonths: z.number().int().min(1).nullable().optional(),
   maxUses: z.number().int().min(1).nullable().optional(),
   redeemBy: z.string().datetime().nullable().optional(),
});

export const updateCouponSchema = z.object({
   isActive: z.boolean().optional(),
   maxUses: z.number().int().min(1).nullable().optional(),
   redeemBy: z.string().datetime().nullable().optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
```

> `discountSnapshot` is immutable — written once at redemption. Deleting a coupon does not alter history (`onDelete: "restrict"` on coupon FK).
> `subscriptionId` on `coupon_redemptions` is NOT a FK yet because `contactSubscriptions` is updated in Task 4. Add the FK reference after Task 4.

**Step 2: Commit**

```bash
git add core/database/src/schemas/coupons.ts
git commit -m "feat(database): add coupons and coupon_redemptions schemas"
```

---

## Task 4: Update `contactSubscriptions` schema

**Files:**
- Modify: `core/database/src/schemas/subscriptions.ts`

Key changes:
- Remove `variantId` column and FK
- Remove `negotiatedPrice` column
- Add `trialing` + `incomplete` to `subscriptionStatusEnum`
- Add `trialEndsAt` timestamp nullable
- Add `couponId` uuid nullable FK to coupons
- Change `currentPeriodStart` + `currentPeriodEnd` from `date` to `timestamp`

Full updated `subscriptions.ts`:

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { contacts, serviceSourceEnum } from "@core/database/schemas/contacts";
import { coupons } from "@core/database/schemas/coupons";
import { crmSchema } from "@core/database/schemas/schemas";

export const billingCycleEnum = crmSchema.enum("billing_cycle", [
   "hourly",
   "monthly",
   "annual",
   "one_time",
]);

export const subscriptionStatusEnum = crmSchema.enum("subscription_status", [
   "active",
   "trialing",
   "incomplete",
   "completed",
   "cancelled",
]);

export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type SubscriptionStatus =
   (typeof subscriptionStatusEnum.enumValues)[number];

export const contactSubscriptions = crmSchema.table(
   "contact_subscriptions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      contactId: uuid("contact_id")
         .notNull()
         .references(() => contacts.id, { onDelete: "cascade" }),
      startDate: text("start_date").notNull(),
      endDate: text("end_date"),
      notes: text("notes"),
      status: subscriptionStatusEnum("status").notNull().default("active"),
      source: serviceSourceEnum("source").notNull().default("manual"),
      externalId: text("external_id"),
      couponId: uuid("coupon_id").references(() => coupons.id, {
         onDelete: "set null",
      }),
      trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
      currentPeriodStart: timestamp("current_period_start", {
         withTimezone: true,
      }),
      currentPeriodEnd: timestamp("current_period_end", {
         withTimezone: true,
      }),
      cancelAtPeriodEnd: boolean("cancel_at_period_end")
         .notNull()
         .default(false),
      canceledAt: timestamp("canceled_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("contact_subscriptions_team_id_idx").on(table.teamId),
      index("contact_subscriptions_contact_id_idx").on(table.contactId),
      index("contact_subscriptions_external_id_idx").on(table.externalId),
      index("contact_subscriptions_status_idx").on(table.status),
      index("contact_subscriptions_coupon_id_idx").on(table.couponId),
   ],
);

export type ContactSubscription = typeof contactSubscriptions.$inferSelect;
export type NewContactSubscription = typeof contactSubscriptions.$inferInsert;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateStringSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const baseSubscriptionSchema = createInsertSchema(contactSubscriptions).pick({
   contactId: true,
   startDate: true,
   endDate: true,
   notes: true,
   status: true,
   source: true,
   externalId: true,
   couponId: true,
   cancelAtPeriodEnd: true,
});

export const createSubscriptionSchema = baseSubscriptionSchema.extend({
   contactId: z.string().uuid("ID do contato inválido."),
   startDate: dateStringSchema,
   endDate: dateStringSchema.nullable().optional(),
   notes: z
      .string()
      .max(500, "Notas devem ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   externalId: z.string().nullable().optional(),
   couponId: z.string().uuid().nullable().optional(),
   cancelAtPeriodEnd: z.boolean().default(false),
});

export const updateSubscriptionSchema = baseSubscriptionSchema
   .extend({
      startDate: dateStringSchema.optional(),
      endDate: dateStringSchema.nullable().optional(),
      notes: z
         .string()
         .max(500, "Notas devem ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      externalId: z.string().nullable().optional(),
      couponId: z.string().uuid().nullable().optional(),
      cancelAtPeriodEnd: z.boolean().optional(),
      trialEndsAt: z.string().datetime().nullable().optional(),
      currentPeriodStart: z.string().datetime().nullable().optional(),
      currentPeriodEnd: z.string().datetime().nullable().optional(),
   })
   .partial();

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
```

> `currentPeriodStart/End` changed from `date` (string YYYY-MM-DD) to `timestamp`. Drizzle push will ask to confirm the column type change — say yes for dev. For prod, write a migration: `ALTER TABLE crm.contact_subscriptions ALTER COLUMN current_period_start TYPE TIMESTAMPTZ USING current_period_start::timestamptz;`

**Step 2: Now add the FK from `coupon_redemptions` to `contactSubscriptions`**

In `coupons.ts`, update `couponRedemptions.subscriptionId`:

```typescript
// Replace:
subscriptionId: uuid("subscription_id").notNull(),
// With:
subscriptionId: uuid("subscription_id")
   .notNull()
   .references(() => contactSubscriptions.id, { onDelete: "cascade" }),
```

Also add the import at the top of `coupons.ts`:
```typescript
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
```

**Step 3: Typecheck**

```bash
cd core/database && bun run typecheck
```

Fix any errors from removed `variantId` / `negotiatedPrice` in repos/router (see Tasks 8–10).

**Step 4: Commit**

```bash
git add core/database/src/schemas/subscriptions.ts core/database/src/schemas/coupons.ts
git commit -m "feat(database): update contactSubscriptions - remove variantId/negotiatedPrice, add status variants, couponId, trialEndsAt"
```

---

## Task 5: Create `subscription_items` schema

**Files:**
- Create: `core/database/src/schemas/subscription-items.ts`

```typescript
import { sql } from "drizzle-orm";
import {
   index,
   integer,
   numeric,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { servicePrices } from "@core/database/schemas/services";
import { crmSchema } from "@core/database/schemas/schemas";

export const subscriptionItems = crmSchema.table(
   "subscription_items",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      subscriptionId: uuid("subscription_id")
         .notNull()
         .references(() => contactSubscriptions.id, { onDelete: "cascade" }),
      priceId: uuid("price_id")
         .notNull()
         .references(() => servicePrices.id, { onDelete: "restrict" }),
      teamId: uuid("team_id").notNull(),
      quantity: integer("quantity").notNull().default(1),
      negotiatedPrice: numeric("negotiated_price", {
         precision: 12,
         scale: 2,
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("subscription_items_subscription_id_idx").on(table.subscriptionId),
      index("subscription_items_price_id_idx").on(table.priceId),
      index("subscription_items_team_id_idx").on(table.teamId),
   ],
);

export type SubscriptionItem = typeof subscriptionItems.$inferSelect;
export type NewSubscriptionItem = typeof subscriptionItems.$inferInsert;

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido maior ou igual a zero.",
   });

export const createSubscriptionItemSchema = createInsertSchema(
   subscriptionItems,
)
   .pick({ subscriptionId: true, priceId: true, quantity: true, negotiatedPrice: true })
   .extend({
      subscriptionId: z.string().uuid("ID da assinatura inválido."),
      priceId: z.string().uuid("ID do preço inválido."),
      quantity: z.number().int().min(1).default(1),
      negotiatedPrice: priceSchema.nullable().optional(),
   });

export const updateSubscriptionItemSchema = z.object({
   quantity: z.number().int().min(1).optional(),
   negotiatedPrice: priceSchema.nullable().optional(),
});

export type CreateSubscriptionItemInput = z.infer<
   typeof createSubscriptionItemSchema
>;
export type UpdateSubscriptionItemInput = z.infer<
   typeof updateSubscriptionItemSchema
>;
```

**Step 2: Commit**

```bash
git add core/database/src/schemas/subscription-items.ts
git commit -m "feat(database): add subscription_items schema"
```

---

## Task 6: Create `benefits` + `service_benefits` schemas

**Files:**
- Create: `core/database/src/schemas/benefits.ts`

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   primaryKey,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { services } from "@core/database/schemas/services";
import { crmSchema } from "@core/database/schemas/schemas";

export const benefitTypeEnum = crmSchema.enum("benefit_type", [
   "credits",
   "feature_access",
   "custom",
]);

export type BenefitType = (typeof benefitTypeEnum.enumValues)[number];

export const benefits = crmSchema.table(
   "benefits",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: benefitTypeEnum("type").notNull(),
      meterId: uuid("meter_id"),
      creditAmount: integer("credit_amount"),
      description: text("description"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("benefits_team_id_idx").on(table.teamId)],
);

export const serviceBenefits = crmSchema.table(
   "service_benefits",
   {
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      benefitId: uuid("benefit_id")
         .notNull()
         .references(() => benefits.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      primaryKey({ columns: [table.serviceId, table.benefitId] }),
      index("service_benefits_service_id_idx").on(table.serviceId),
   ],
);

export type Benefit = typeof benefits.$inferSelect;
export type NewBenefit = typeof benefits.$inferInsert;
export type ServiceBenefit = typeof serviceBenefits.$inferSelect;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

export const createBenefitSchema = createInsertSchema(benefits)
   .pick({ name: true, type: true, meterId: true, creditAmount: true, description: true })
   .extend({
      name: nameSchema,
      type: z.enum(["credits", "feature_access", "custom"]),
      meterId: z.string().uuid().nullable().optional(),
      creditAmount: z.number().int().min(1).nullable().optional(),
      description: z.string().max(500).nullable().optional(),
   });

export const updateBenefitSchema = z.object({
   name: nameSchema.optional(),
   description: z.string().max(500).nullable().optional(),
   isActive: z.boolean().optional(),
});

export type CreateBenefitInput = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput = z.infer<typeof updateBenefitSchema>;
```

**Step 2: Commit**

```bash
git add core/database/src/schemas/benefits.ts
git commit -m "feat(database): add benefits and service_benefits schemas"
```

---

## Task 7: Update `usage_events` — meterId text → uuid FK

**Files:**
- Modify: `core/database/src/schemas/usage-events.ts`

Change `meterId` from `text` to `uuid` with FK to `meters.id`:

```typescript
// Replace:
meterId: text("meter_id").notNull(),
// With:
meterId: uuid("meter_id")
   .notNull()
   .references(() => meters.id, { onDelete: "restrict" }),
```

Add import at top:
```typescript
import { meters } from "@core/database/schemas/meters";
```

> **Warning:** This changes the column type from `text` to `uuid`. On dev with `db:push`, Drizzle will ask to confirm. For production, use:
> ```sql
> ALTER TABLE platform.usage_events ALTER COLUMN meter_id TYPE UUID USING meter_id::uuid;
> ALTER TABLE platform.usage_events ADD CONSTRAINT usage_events_meter_id_fkey
>   FOREIGN KEY (meter_id) REFERENCES crm.meters(id) ON DELETE RESTRICT;
> ```
> Existing rows with non-UUID `meter_id` values will fail the cast — ensure data is clean first.

**Step 2: Update usage-events-repository.ts**

No functional changes needed — the column name stays `meterId`, just type changes. The Zod schema in `usage-events.ts` for `meterId` needs updating:

```typescript
// In upsertUsageEventSchema.extend, replace:
meterId: z.string().min(1, "ID do medidor é obrigatório."),
// With:
meterId: z.string().uuid("ID do medidor inválido."),
```

**Step 3: Commit**

```bash
git add core/database/src/schemas/usage-events.ts
git commit -m "feat(database): change usage_events.meterId from text to uuid FK → meters"
```

---

## Task 8: Update `schema.ts` (main export)

**Files:**
- Modify: `core/database/src/schema.ts`

Add new schema exports:

```typescript
export * from "@core/database/schemas/agents";
export * from "@core/database/schemas/auth";
export * from "@core/database/schemas/bank-accounts";
export * from "@core/database/schemas/benefits";      // NEW
export * from "@core/database/schemas/categories";
export * from "@core/database/schemas/contact-settings";
export * from "@core/database/schemas/contacts";
export * from "@core/database/schemas/coupons";        // NEW
export * from "@core/database/schemas/credit-cards";
export * from "@core/database/schemas/credit-card-statements";
export * from "@core/database/schemas/credit-card-statement-totals";
export * from "@core/database/schemas/dashboards";
export * from "@core/database/schemas/event-catalog";
export * from "@core/database/schemas/events";
export * from "@core/database/schemas/insights";
export * from "@core/database/schemas/inventory";
export * from "@core/database/schemas/meters";         // NEW
export * from "@core/database/schemas/services";
export * from "@core/database/schemas/settings-financial";
export * from "@core/database/schemas/subscription-items";  // NEW
export * from "@core/database/schemas/subscriptions";
export * from "@core/database/schemas/tags";
export * from "@core/database/schemas/transactions";
export * from "@core/database/schemas/usage-events";
export * from "@core/database/schemas/webhooks";
export * from "@core/database/relations";
export {
   authSchema,
   financeSchema,
   crmSchema,
   inventorySchema,
   platformSchema,
   settingsSchema,
} from "@core/database/schemas/schemas";
```

**Step 2: Commit**

```bash
git add core/database/src/schema.ts
git commit -m "feat(database): export new schemas (meters, coupons, benefits, subscription-items)"
```

---

## Task 9: Update `relations.ts`

**Files:**
- Modify: `core/database/src/relations.ts`

Add/update these relation blocks. Keep all existing ones and add:

**1. Import new tables at top:**
```typescript
import { meters } from "@core/database/schemas/meters";
import { coupons, couponRedemptions } from "@core/database/schemas/coupons";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
```

**2. Replace `serviceVariantsRelations`:**
```typescript
// Remove:
export const serviceVariantsRelations = relations(
   serviceVariants,
   ...
);

// Add:
export const servicePricesRelations = relations(
   servicePrices,
   ({ one, many }) => ({
      service: one(services, {
         fields: [servicePrices.serviceId],
         references: [services.id],
      }),
      meter: one(meters, {
         fields: [servicePrices.meterId],
         references: [meters.id],
      }),
      subscriptionItems: many(subscriptionItems),
   }),
);
```

**3. Update `servicesRelations`:**
```typescript
export const servicesRelations = relations(services, ({ one, many }) => ({
   category: one(categories, {
      fields: [services.categoryId],
      references: [categories.id],
   }),
   tag: one(tags, {
      fields: [services.tagId],
      references: [tags.id],
   }),
   prices: many(servicePrices),      // renamed from variants
   resources: many(resources),
   serviceBenefits: many(serviceBenefits),
}));
```

**4. Update `contactSubscriptionsRelations`:**
```typescript
export const contactSubscriptionsRelations = relations(
   contactSubscriptions,
   ({ one, many }) => ({
      contact: one(contacts, {
         fields: [contactSubscriptions.contactId],
         references: [contacts.id],
      }),
      coupon: one(coupons, {
         fields: [contactSubscriptions.couponId],
         references: [coupons.id],
      }),
      items: many(subscriptionItems),
      redemptions: many(couponRedemptions),
   }),
);
```

**5. Add new relation blocks:**
```typescript
export const metersRelations = relations(meters, ({ many }) => ({
   prices: many(servicePrices),
   usageEvents: many(usageEvents),
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
   team: one(team, {
      fields: [usageEvents.teamId],
      references: [team.id],
   }),
   contact: one(contacts, {
      fields: [usageEvents.contactId],
      references: [contacts.id],
   }),
   meter: one(meters, {
      fields: [usageEvents.meterId],
      references: [meters.id],
   }),
}));

export const subscriptionItemsRelations = relations(
   subscriptionItems,
   ({ one }) => ({
      subscription: one(contactSubscriptions, {
         fields: [subscriptionItems.subscriptionId],
         references: [contactSubscriptions.id],
      }),
      price: one(servicePrices, {
         fields: [subscriptionItems.priceId],
         references: [servicePrices.id],
      }),
   }),
);

export const couponsRelations = relations(coupons, ({ many }) => ({
   redemptions: many(couponRedemptions),
   subscriptions: many(contactSubscriptions),
}));

export const couponRedemptionsRelations = relations(
   couponRedemptions,
   ({ one }) => ({
      coupon: one(coupons, {
         fields: [couponRedemptions.couponId],
         references: [coupons.id],
      }),
      subscription: one(contactSubscriptions, {
         fields: [couponRedemptions.subscriptionId],
         references: [contactSubscriptions.id],
      }),
      contact: one(contacts, {
         fields: [couponRedemptions.contactId],
         references: [contacts.id],
      }),
   }),
);

export const benefitsRelations = relations(benefits, ({ many }) => ({
   serviceBenefits: many(serviceBenefits),
}));

export const serviceBenefitsRelations = relations(
   serviceBenefits,
   ({ one }) => ({
      service: one(services, {
         fields: [serviceBenefits.serviceId],
         references: [services.id],
      }),
      benefit: one(benefits, {
         fields: [serviceBenefits.benefitId],
         references: [benefits.id],
      }),
   }),
);
```

**Step 2: Typecheck**

```bash
cd core/database && bun run typecheck
```

**Step 3: Commit**

```bash
git add core/database/src/relations.ts
git commit -m "feat(database): update relations for new tables and renamed servicePrices"
```

---

## Task 10: Update `services-repository.ts` — rename variants → prices

**Files:**
- Modify: `core/database/src/repositories/services-repository.ts`

Rename all `serviceVariants` → `servicePrices`, all `Variant`/`variant` → `Price`/`price`, all `createVariantSchema`/`updateVariantSchema` → `createPriceSchema`/`updatePriceSchema`. Keep function signatures identical (old functions are called by router).

The key renaming:
- `serviceVariants` table → `servicePrices`
- `createVariant` → `createPrice`
- `listVariantsByService` → `listPricesByService`
- `getVariant` → `getPrice`
- `updateVariant` → `updatePrice`
- `deleteVariant` → `deletePrice`
- `ensureVariantOwnership` → `ensurePriceOwnership`
- Error messages: "variante" → "preço"
- Import: `ServiceVariant` type → `ServicePrice`

Also update `listServices` — remove `basePrice` from the select projection since `services` no longer has it:

```typescript
// Remove from select:
basePrice: services.basePrice,
```

After renaming, remove the legacy aliases from `services.ts` (added in Task 2):

```typescript
// Remove from services.ts:
export const serviceVariants = servicePrices;
export type ServiceVariant = ServicePrice;
// ... etc
```

**Step 2: Typecheck**

```bash
cd core/database && bun run typecheck
```

**Step 3: Commit**

```bash
git add core/database/src/repositories/services-repository.ts core/database/src/schemas/services.ts
git commit -m "refactor(database): rename variant functions to price in services-repository"
```

---

## Task 11: Update `subscriptions-repository.ts`

**Files:**
- Modify: `core/database/src/repositories/subscriptions-repository.ts`

Changes needed:
1. Remove import of `serviceVariants` and `services` (no longer needed for `listSubscriptionsByContact` join)
2. Update `listSubscriptionsByContact` — remove the join to `serviceVariants`/`services`, remove the select fields `serviceName`, `variantName`, `billingCycle`, `serviceId` that came from those joins. Return bare `contactSubscriptions` rows.
3. Update `countActiveSubscriptionsByVariant` — this function is now obsolete. Either remove it or rename to `countActiveSubscriptions` returning a simple count.
4. Remove `negotiatedPrice` from `upsertSubscriptionByExternalId` update set (field removed)
5. Fix `listSubscriptionsByTeam` — `status` type now includes `trialing` and `incomplete`

Updated status type:
```typescript
// The SubscriptionStatus type is imported from the schema — no change needed here,
// the enum update in Task 4 automatically widens the type.
```

For `listSubscriptionsByContact`, simplified version:
```typescript
export function listSubscriptionsByContact(
   db: DatabaseInstance,
   contactId: string,
) {
   return fromPromise(
      db
         .select()
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.contactId, contactId))
         .orderBy(desc(contactSubscriptions.createdAt)),
      (e) =>
         AppError.database("Falha ao listar assinaturas do contato.", {
            cause: e,
         }),
   );
}
```

**Step 2: Typecheck + test**

```bash
cd core/database && bun run typecheck
npx vitest run core/database
```

**Step 3: Commit**

```bash
git add core/database/src/repositories/subscriptions-repository.ts
git commit -m "refactor(database): update subscriptions-repository - remove variantId/negotiatedPrice references"
```

---

## Task 12: Create `meters-repository.ts`

**Files:**
- Create: `core/database/src/repositories/meters-repository.ts`

```typescript
import { AppError, validateInput } from "@core/logging/errors";
import { and, eq } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateMeterInput,
   type UpdateMeterInput,
   createMeterSchema,
   updateMeterSchema,
   meters,
} from "@core/database/schemas/meters";

const safeValidateCreate = fromThrowable(
   (data: CreateMeterInput) => validateInput(createMeterSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateMeterInput) => validateInput(updateMeterSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function createMeter(
   db: DatabaseInstance,
   teamId: string,
   data: CreateMeterInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(meters)
               .values({ ...validated, teamId })
               .returning();
            if (!row) throw AppError.database("Falha ao criar medidor.");
            return row;
         }),
         (e) =>
            e instanceof AppError
               ? e
               : AppError.database("Falha ao criar medidor.", { cause: e }),
      ),
   );
}

export function getMeter(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.meters.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar medidor.", { cause: e }),
   ).map((meter) => meter ?? null);
}

export function listMeters(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db
         .select()
         .from(meters)
         .where(eq(meters.teamId, teamId))
         .orderBy(meters.name),
      (e) => AppError.database("Falha ao listar medidores.", { cause: e }),
   );
}

export function updateMeter(
   db: DatabaseInstance,
   id: string,
   data: UpdateMeterInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(meters)
            .set(validated)
            .where(eq(meters.id, id))
            .returning(),
         (e) => AppError.database("Falha ao atualizar medidor.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Medidor não encontrado.")),
      ),
   );
}

export function deleteMeter(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.delete(meters).where(eq(meters.id, id)),
      (e) => AppError.database("Falha ao excluir medidor.", { cause: e }),
   ).map(() => undefined);
}

export function ensureMeterOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getMeter(db, id).andThen((meter) => {
      if (!meter || meter.teamId !== teamId)
         return err(AppError.notFound("Medidor não encontrado."));
      return ok(meter);
   });
}
```

**Step 2: Write test file**

Create `core/database/__tests__/repositories/meters-repository.test.ts`:

```typescript
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../helpers/setup-test-db";
import * as schema from "@core/database/schema";
import * as repo from "../../src/repositories/meters-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomSeed() {
   return Math.floor(Math.random() * 1_000_000);
}

async function seedTeam() {
   const orgId = crypto.randomUUID();
   const teamId = crypto.randomUUID();
   await seed(testDb.db, { organization: schema.organization }, { seed: randomSeed() }).refine(
      (f) => ({ organization: { count: 1, columns: { id: f.default({ defaultValue: orgId }) } } }),
   );
   await seed(testDb.db, { team: schema.team }, { seed: randomSeed() }).refine(
      (f) => ({
         team: {
            count: 1,
            columns: {
               id: f.default({ defaultValue: teamId }),
               organizationId: f.default({ defaultValue: orgId }),
            },
         },
      }),
   );
   return teamId;
}

function validMeterInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Consultas API",
      eventName: "api.call",
      aggregation: "sum" as const,
      ...overrides,
   };
}

describe("meters-repository", () => {
   describe("createMeter", () => {
      it("creates meter with correct fields", async () => {
         const teamId = await seedTeam();
         const result = await repo.createMeter(testDb.db, teamId, validMeterInput());
         const meter = result._unsafeUnwrap();
         expect(meter).toMatchObject({ teamId, name: "Consultas API", eventName: "api.call", isActive: true });
         expect(meter.id).toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = await seedTeam();
         const result = await repo.createMeter(testDb.db, teamId, validMeterInput({ name: "A" }));
         expect(result.isErr()).toBe(true);
      });

      it("rejects duplicate eventName on same team", async () => {
         const teamId = await seedTeam();
         await repo.createMeter(testDb.db, teamId, validMeterInput({ eventName: "unique.event" }));
         const duplicate = await repo.createMeter(testDb.db, teamId, validMeterInput({ eventName: "unique.event" }));
         expect(duplicate.isErr()).toBe(true);
      });

      it("allows same eventName on different teams", async () => {
         const [teamA, teamB] = await Promise.all([seedTeam(), seedTeam()]);
         const a = await repo.createMeter(testDb.db, teamA, validMeterInput({ eventName: "shared.event" }));
         const b = await repo.createMeter(testDb.db, teamB, validMeterInput({ eventName: "shared.event" }));
         expect(a.isOk()).toBe(true);
         expect(b.isOk()).toBe(true);
      });
   });

   describe("getMeter", () => {
      it("returns meter by id", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createMeter(testDb.db, teamId, validMeterInput()))._unsafeUnwrap();
         const found = (await repo.getMeter(testDb.db, created.id))._unsafeUnwrap();
         expect(found?.id).toBe(created.id);
      });

      it("returns null for non-existent id", async () => {
         const result = (await repo.getMeter(testDb.db, crypto.randomUUID()))._unsafeUnwrap();
         expect(result).toBeNull();
      });
   });

   describe("listMeters", () => {
      it("lists meters for team only", async () => {
         const [teamA, teamB] = await Promise.all([seedTeam(), seedTeam()]);
         await repo.createMeter(testDb.db, teamA, validMeterInput({ eventName: "a.event" }));
         await repo.createMeter(testDb.db, teamB, validMeterInput({ eventName: "b.event" }));
         const list = (await repo.listMeters(testDb.db, teamA))._unsafeUnwrap();
         expect(list.every((m) => m.teamId === teamA)).toBe(true);
      });
   });

   describe("updateMeter", () => {
      it("updates name", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createMeter(testDb.db, teamId, validMeterInput()))._unsafeUnwrap();
         const updated = (await repo.updateMeter(testDb.db, created.id, { name: "Novo Nome" }))._unsafeUnwrap();
         expect(updated.name).toBe("Novo Nome");
      });

      it("returns err for non-existent id", async () => {
         const result = await repo.updateMeter(testDb.db, crypto.randomUUID(), { name: "X X" });
         expect(result.isErr()).toBe(true);
      });
   });

   describe("deleteMeter", () => {
      it("deletes a meter", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createMeter(testDb.db, teamId, validMeterInput()))._unsafeUnwrap();
         await repo.deleteMeter(testDb.db, created.id);
         const found = (await repo.getMeter(testDb.db, created.id))._unsafeUnwrap();
         expect(found).toBeNull();
      });
   });

   describe("ensureMeterOwnership", () => {
      it("returns meter when team matches", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createMeter(testDb.db, teamId, validMeterInput()))._unsafeUnwrap();
         const result = await repo.ensureMeterOwnership(testDb.db, created.id, teamId);
         expect(result.isOk()).toBe(true);
      });

      it("returns err when team does not match", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createMeter(testDb.db, teamId, validMeterInput()))._unsafeUnwrap();
         const result = await repo.ensureMeterOwnership(testDb.db, created.id, crypto.randomUUID());
         expect(result.isErr()).toBe(true);
      });
   });
});
```

**Step 3: Run tests**

```bash
npx vitest run core/database/__tests__/repositories/meters-repository.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add core/database/src/repositories/meters-repository.ts core/database/__tests__/repositories/meters-repository.test.ts
git commit -m "feat(database): add meters-repository with tests"
```

---

## Task 13: Create `subscription-items-repository.ts`

**Files:**
- Create: `core/database/src/repositories/subscription-items-repository.ts`

```typescript
import { AppError, validateInput } from "@core/logging/errors";
import { and, count, eq } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateSubscriptionItemInput,
   type UpdateSubscriptionItemInput,
   createSubscriptionItemSchema,
   updateSubscriptionItemSchema,
   subscriptionItems,
} from "@core/database/schemas/subscription-items";

const MAX_ITEMS_PER_SUBSCRIPTION = 20;

const safeValidateCreate = fromThrowable(
   (data: CreateSubscriptionItemInput) =>
      validateInput(createSubscriptionItemSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateSubscriptionItemInput) =>
      validateInput(updateSubscriptionItemSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function addSubscriptionItem(
   db: DatabaseInstance,
   teamId: string,
   data: CreateSubscriptionItemInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [{ itemCount }] = await tx
               .select({ itemCount: count() })
               .from(subscriptionItems)
               .where(eq(subscriptionItems.subscriptionId, validated.subscriptionId));

            if ((itemCount ?? 0) >= MAX_ITEMS_PER_SUBSCRIPTION) {
               throw AppError.validation(
                  `Limite de ${MAX_ITEMS_PER_SUBSCRIPTION} itens por assinatura atingido.`,
               );
            }

            const [row] = await tx
               .insert(subscriptionItems)
               .values({ ...validated, teamId })
               .returning();
            if (!row) throw AppError.database("Falha ao adicionar item.");
            return row;
         }),
         (e) =>
            e instanceof AppError
               ? e
               : AppError.database("Falha ao adicionar item.", { cause: e }),
      ),
   );
}

export function updateSubscriptionItemQuantity(
   db: DatabaseInstance,
   id: string,
   data: UpdateSubscriptionItemInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(subscriptionItems)
            .set(validated)
            .where(eq(subscriptionItems.id, id))
            .returning(),
         (e) =>
            AppError.database("Falha ao atualizar item.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Item de assinatura não encontrado.")),
      ),
   );
}

export function removeSubscriptionItem(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.delete(subscriptionItems).where(eq(subscriptionItems.id, id)),
      (e) => AppError.database("Falha ao remover item.", { cause: e }),
   ).map(() => undefined);
}

export function listSubscriptionItems(
   db: DatabaseInstance,
   subscriptionId: string,
) {
   return fromPromise(
      db
         .select()
         .from(subscriptionItems)
         .where(eq(subscriptionItems.subscriptionId, subscriptionId))
         .orderBy(subscriptionItems.createdAt),
      (e) =>
         AppError.database("Falha ao listar itens da assinatura.", {
            cause: e,
         }),
   );
}

export function ensureSubscriptionItemOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return fromPromise(
      db.query.subscriptionItems.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar item.", { cause: e }),
   ).andThen((item) => {
      if (!item || item.teamId !== teamId)
         return err(AppError.notFound("Item de assinatura não encontrado."));
      return ok(item);
   });
}
```

**Step 2: Write test file**

Create `core/database/__tests__/repositories/subscription-items-repository.test.ts`:

```typescript
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../helpers/setup-test-db";
import * as schema from "@core/database/schema";
import { services, servicePrices } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { contacts } from "@core/database/schemas/contacts";
import * as repo from "../../src/repositories/subscription-items-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomSeed() {
   return Math.floor(Math.random() * 1_000_000);
}

async function seedTeam() {
   const orgId = crypto.randomUUID();
   const teamId = crypto.randomUUID();
   await seed(testDb.db, { organization: schema.organization }, { seed: randomSeed() }).refine(
      (f) => ({ organization: { count: 1, columns: { id: f.default({ defaultValue: orgId }) } } }),
   );
   await seed(testDb.db, { team: schema.team }, { seed: randomSeed() }).refine(
      (f) => ({
         team: {
            count: 1,
            columns: {
               id: f.default({ defaultValue: teamId }),
               organizationId: f.default({ defaultValue: orgId }),
            },
         },
      }),
   );
   return teamId;
}

async function seedFixtures(teamId: string) {
   const [contact] = await testDb.db
      .insert(contacts)
      .values({ teamId, name: "Maria Oliveira", type: "cliente" })
      .returning();

   const [service] = await testDb.db
      .insert(services)
      .values({ teamId, name: "Plano Básico" })
      .returning();

   const [price] = await testDb.db
      .insert(servicePrices)
      .values({ teamId, serviceId: service!.id, name: "Mensal", type: "flat", basePrice: "99.00", interval: "monthly" })
      .returning();

   const [subscription] = await testDb.db
      .insert(contactSubscriptions)
      .values({ teamId, contactId: contact!.id, startDate: "2026-01-01", status: "active", source: "manual" })
      .returning();

   return { contact: contact!, price: price!, subscription: subscription! };
}

describe("subscription-items-repository", () => {
   describe("addSubscriptionItem", () => {
      it("adds an item to a subscription", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);

         const result = await repo.addSubscriptionItem(testDb.db, teamId, {
            subscriptionId: subscription.id,
            priceId: price.id,
            quantity: 1,
         });

         const item = result._unsafeUnwrap();
         expect(item.subscriptionId).toBe(subscription.id);
         expect(item.priceId).toBe(price.id);
         expect(item.quantity).toBe(1);
      });

      it("rejects when subscription has 20 items already", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);

         // Fill up to 20 items (same price, different calls — quantity can repeat, id is PK)
         for (let i = 0; i < 20; i++) {
            const [extraPrice] = await testDb.db
               .insert(servicePrices)
               .values({ teamId, serviceId: price.serviceId, name: `Plano ${i}`, type: "flat", basePrice: "10.00", interval: "monthly" })
               .returning();
            await repo.addSubscriptionItem(testDb.db, teamId, {
               subscriptionId: subscription.id,
               priceId: extraPrice!.id,
               quantity: 1,
            });
         }

         const overflow = await repo.addSubscriptionItem(testDb.db, teamId, {
            subscriptionId: subscription.id,
            priceId: price.id,
            quantity: 1,
         });
         expect(overflow.isErr()).toBe(true);
      });
   });

   describe("updateSubscriptionItemQuantity", () => {
      it("updates quantity", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);
         const item = (await repo.addSubscriptionItem(testDb.db, teamId, { subscriptionId: subscription.id, priceId: price.id, quantity: 1 }))._unsafeUnwrap();

         const updated = (await repo.updateSubscriptionItemQuantity(testDb.db, item.id, { quantity: 3 }))._unsafeUnwrap();
         expect(updated.quantity).toBe(3);
      });

      it("returns err for non-existent item", async () => {
         const result = await repo.updateSubscriptionItemQuantity(testDb.db, crypto.randomUUID(), { quantity: 2 });
         expect(result.isErr()).toBe(true);
      });
   });

   describe("removeSubscriptionItem", () => {
      it("removes item from subscription", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);
         const item = (await repo.addSubscriptionItem(testDb.db, teamId, { subscriptionId: subscription.id, priceId: price.id, quantity: 1 }))._unsafeUnwrap();

         await repo.removeSubscriptionItem(testDb.db, item.id);
         const list = (await repo.listSubscriptionItems(testDb.db, subscription.id))._unsafeUnwrap();
         expect(list).toHaveLength(0);
      });
   });

   describe("listSubscriptionItems", () => {
      it("returns items for subscription only", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);
         const { subscription: otherSub } = await seedFixtures(teamId);

         await repo.addSubscriptionItem(testDb.db, teamId, { subscriptionId: subscription.id, priceId: price.id, quantity: 1 });
         await repo.addSubscriptionItem(testDb.db, teamId, { subscriptionId: otherSub.id, priceId: price.id, quantity: 1 });

         const list = (await repo.listSubscriptionItems(testDb.db, subscription.id))._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.subscriptionId).toBe(subscription.id);
      });
   });
});
```

**Step 3: Run tests**

```bash
npx vitest run core/database/__tests__/repositories/subscription-items-repository.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add core/database/src/repositories/subscription-items-repository.ts core/database/__tests__/repositories/subscription-items-repository.test.ts
git commit -m "feat(database): add subscription-items-repository with tests"
```

---

## Task 14: Create `coupons-repository.ts`

**Files:**
- Create: `core/database/src/repositories/coupons-repository.ts`

```typescript
import { AppError, validateInput } from "@core/logging/errors";
import { and, eq, sql } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateCouponInput,
   type UpdateCouponInput,
   createCouponSchema,
   updateCouponSchema,
   coupons,
   couponRedemptions,
} from "@core/database/schemas/coupons";

const safeValidateCreate = fromThrowable(
   (data: CreateCouponInput) => validateInput(createCouponSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateCouponInput) => validateInput(updateCouponSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function createCoupon(
   db: DatabaseInstance,
   teamId: string,
   data: CreateCouponInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const existing = await tx.query.coupons.findFirst({
               where: (fields, { and, eq, sql }) =>
                  and(
                     eq(fields.teamId, teamId),
                     sql`lower(${fields.code}) = lower(${validated.code})`,
                  ),
            });
            if (existing) throw AppError.conflict("Já existe um cupom com esse código.");

            const [row] = await tx
               .insert(coupons)
               .values({ ...validated, teamId })
               .returning();
            if (!row) throw AppError.database("Falha ao criar cupom.");
            return row;
         }),
         (e) =>
            e instanceof AppError
               ? e
               : AppError.database("Falha ao criar cupom.", { cause: e }),
      ),
   );
}

export function getCoupon(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.coupons.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar cupom.", { cause: e }),
   ).map((coupon) => coupon ?? null);
}

export function getCouponByCode(
   db: DatabaseInstance,
   teamId: string,
   code: string,
) {
   return fromPromise(
      db.query.coupons.findFirst({
         where: (fields, { and, eq, sql }) =>
            and(
               eq(fields.teamId, teamId),
               sql`lower(${fields.code}) = lower(${code})`,
            ),
      }),
      (e) => AppError.database("Falha ao buscar cupom.", { cause: e }),
   ).map((coupon) => coupon ?? null);
}

export function listCoupons(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db
         .select()
         .from(coupons)
         .where(eq(coupons.teamId, teamId))
         .orderBy(coupons.createdAt),
      (e) => AppError.database("Falha ao listar cupons.", { cause: e }),
   );
}

export function updateCoupon(
   db: DatabaseInstance,
   id: string,
   data: UpdateCouponInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(coupons)
            .set(validated)
            .where(eq(coupons.id, id))
            .returning(),
         (e) => AppError.database("Falha ao atualizar cupom.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Cupom não encontrado.")),
      ),
   );
}

export function ensureCouponOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getCoupon(db, id).andThen((coupon) => {
      if (!coupon || coupon.teamId !== teamId)
         return err(AppError.notFound("Cupom não encontrado."));
      return ok(coupon);
   });
}

export function redeemCoupon(
   db: DatabaseInstance,
   teamId: string,
   params: {
      couponId: string;
      subscriptionId: string;
      contactId: string;
   },
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const coupon = await tx.query.coupons.findFirst({
            where: (fields, { eq }) => eq(fields.id, params.couponId),
         });
         if (!coupon || coupon.teamId !== teamId)
            throw AppError.notFound("Cupom não encontrado.");
         if (!coupon.isActive)
            throw AppError.badRequest("Cupom inativo.");
         if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
            throw AppError.badRequest("Limite de usos do cupom atingido.");
         if (coupon.redeemBy && new Date() > coupon.redeemBy)
            throw AppError.badRequest("Cupom expirado.");

         await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(eq(coupons.id, params.couponId));

         const [redemption] = await tx
            .insert(couponRedemptions)
            .values({
               teamId,
               couponId: params.couponId,
               subscriptionId: params.subscriptionId,
               contactId: params.contactId,
               discountSnapshot: {
                  code: coupon.code,
                  type: coupon.type,
                  amount: coupon.amount,
                  duration: coupon.duration,
                  durationMonths: coupon.durationMonths ?? null,
               },
            })
            .returning();
         if (!redemption) throw AppError.database("Falha ao resgatar cupom.");
         return redemption;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao resgatar cupom.", { cause: e }),
   );
}
```

**Step 2: Write test file**

Create `core/database/__tests__/repositories/coupons-repository.test.ts`:

```typescript
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../helpers/setup-test-db";
import * as schema from "@core/database/schema";
import { contacts } from "@core/database/schemas/contacts";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import * as repo from "../../src/repositories/coupons-repository";
import dayjs from "dayjs";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomSeed() {
   return Math.floor(Math.random() * 1_000_000);
}

async function seedTeam() {
   const orgId = crypto.randomUUID();
   const teamId = crypto.randomUUID();
   await seed(testDb.db, { organization: schema.organization }, { seed: randomSeed() }).refine(
      (f) => ({ organization: { count: 1, columns: { id: f.default({ defaultValue: orgId }) } } }),
   );
   await seed(testDb.db, { team: schema.team }, { seed: randomSeed() }).refine(
      (f) => ({
         team: {
            count: 1,
            columns: {
               id: f.default({ defaultValue: teamId }),
               organizationId: f.default({ defaultValue: orgId }),
            },
         },
      }),
   );
   return teamId;
}

async function seedContactAndSubscription(teamId: string) {
   const [contact] = await testDb.db
      .insert(contacts)
      .values({ teamId, name: "Carlos Lima", type: "cliente" })
      .returning();
   const [sub] = await testDb.db
      .insert(contactSubscriptions)
      .values({ teamId, contactId: contact!.id, startDate: "2026-01-01", status: "active", source: "manual" })
      .returning();
   return { contact: contact!, subscription: sub! };
}

function validCouponInput(overrides: Record<string, unknown> = {}) {
   return {
      code: `PROMO${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      type: "percent" as const,
      amount: "10",
      duration: "once" as const,
      ...overrides,
   };
}

describe("coupons-repository", () => {
   describe("createCoupon", () => {
      it("creates coupon with correct fields", async () => {
         const teamId = await seedTeam();
         const result = await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "SUMMER20" }));
         const coupon = result._unsafeUnwrap();
         expect(coupon.code).toBe("SUMMER20");
         expect(coupon.usedCount).toBe(0);
         expect(coupon.isActive).toBe(true);
      });

      it("rejects duplicate code on same team (case-insensitive)", async () => {
         const teamId = await seedTeam();
         await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "DUPCODE" }));
         const dup = await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "dupcode" }));
         expect(dup.isErr()).toBe(true);
      });

      it("allows same code on different teams", async () => {
         const [teamA, teamB] = await Promise.all([seedTeam(), seedTeam()]);
         const a = await repo.createCoupon(testDb.db, teamA, validCouponInput({ code: "SHARED" }));
         const b = await repo.createCoupon(testDb.db, teamB, validCouponInput({ code: "SHARED" }));
         expect(a.isOk()).toBe(true);
         expect(b.isOk()).toBe(true);
      });
   });

   describe("getCouponByCode", () => {
      it("finds by code case-insensitively", async () => {
         const teamId = await seedTeam();
         await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "FINDME" }));
         const result = await repo.getCouponByCode(testDb.db, teamId, "findme");
         expect(result._unsafeUnwrap()?.code).toBe("FINDME");
      });

      it("returns null for missing code", async () => {
         const teamId = await seedTeam();
         const result = await repo.getCouponByCode(testDb.db, teamId, "MISSING");
         expect(result._unsafeUnwrap()).toBeNull();
      });
   });

   describe("redeemCoupon", () => {
      it("creates redemption with immutable snapshot", async () => {
         const teamId = await seedTeam();
         const coupon = (await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "SNAP10" })))._unsafeUnwrap();
         const { contact, subscription } = await seedContactAndSubscription(teamId);

         const redemption = (await repo.redeemCoupon(testDb.db, teamId, {
            couponId: coupon.id,
            subscriptionId: subscription.id,
            contactId: contact.id,
         }))._unsafeUnwrap();

         expect(redemption.couponId).toBe(coupon.id);
         expect(redemption.discountSnapshot.code).toBe("SNAP10");
         expect(redemption.discountSnapshot.type).toBe("percent");
         expect(redemption.discountSnapshot.amount).toBe("10");
      });

      it("increments usedCount atomically", async () => {
         const teamId = await seedTeam();
         const coupon = (await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "COUNTME" })))._unsafeUnwrap();
         const { contact, subscription } = await seedContactAndSubscription(teamId);

         await repo.redeemCoupon(testDb.db, teamId, { couponId: coupon.id, subscriptionId: subscription.id, contactId: contact.id });
         const updated = (await repo.getCoupon(testDb.db, coupon.id))._unsafeUnwrap();
         expect(updated?.usedCount).toBe(1);
      });

      it("rejects when maxUses reached", async () => {
         const teamId = await seedTeam();
         const coupon = (await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "MAXONE", maxUses: 1 })))._unsafeUnwrap();
         const { contact, subscription } = await seedContactAndSubscription(teamId);

         await repo.redeemCoupon(testDb.db, teamId, { couponId: coupon.id, subscriptionId: subscription.id, contactId: contact.id });

         const { subscription: sub2 } = await seedContactAndSubscription(teamId);
         const overflow = await repo.redeemCoupon(testDb.db, teamId, { couponId: coupon.id, subscriptionId: sub2.id, contactId: contact.id });
         expect(overflow.isErr()).toBe(true);
      });

      it("rejects when coupon expired", async () => {
         const teamId = await seedTeam();
         const coupon = (await repo.createCoupon(testDb.db, teamId, validCouponInput({
            code: "EXPIRED",
            redeemBy: dayjs().subtract(1, "day").toISOString(),
         })))._unsafeUnwrap();
         const { contact, subscription } = await seedContactAndSubscription(teamId);

         const result = await repo.redeemCoupon(testDb.db, teamId, { couponId: coupon.id, subscriptionId: subscription.id, contactId: contact.id });
         expect(result.isErr()).toBe(true);
      });

      it("rejects when coupon inactive", async () => {
         const teamId = await seedTeam();
         const coupon = (await repo.createCoupon(testDb.db, teamId, validCouponInput({ code: "INACTIVE" })))._unsafeUnwrap();
         await repo.updateCoupon(testDb.db, coupon.id, { isActive: false });
         const { contact, subscription } = await seedContactAndSubscription(teamId);

         const result = await repo.redeemCoupon(testDb.db, teamId, { couponId: coupon.id, subscriptionId: subscription.id, contactId: contact.id });
         expect(result.isErr()).toBe(true);
      });
   });
});
```

**Step 3: Run tests**

```bash
npx vitest run core/database/__tests__/repositories/coupons-repository.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add core/database/src/repositories/coupons-repository.ts core/database/__tests__/repositories/coupons-repository.test.ts
git commit -m "feat(database): add coupons-repository with redeem tests"
```

---

## Task 15: Create `benefits-repository.ts`

**Files:**
- Create: `core/database/src/repositories/benefits-repository.ts`

```typescript
import { AppError, validateInput } from "@core/logging/errors";
import { and, eq } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateBenefitInput,
   type UpdateBenefitInput,
   createBenefitSchema,
   updateBenefitSchema,
   benefits,
   serviceBenefits,
} from "@core/database/schemas/benefits";

const safeValidateCreate = fromThrowable(
   (data: CreateBenefitInput) => validateInput(createBenefitSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateBenefitInput) => validateInput(updateBenefitSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function createBenefit(
   db: DatabaseInstance,
   teamId: string,
   data: CreateBenefitInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(benefits)
               .values({ ...validated, teamId })
               .returning();
            if (!row) throw AppError.database("Falha ao criar benefício.");
            return row;
         }),
         (e) =>
            e instanceof AppError
               ? e
               : AppError.database("Falha ao criar benefício.", { cause: e }),
      ),
   );
}

export function getBenefit(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.benefits.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar benefício.", { cause: e }),
   ).map((benefit) => benefit ?? null);
}

export function listBenefits(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db
         .select()
         .from(benefits)
         .where(eq(benefits.teamId, teamId))
         .orderBy(benefits.name),
      (e) => AppError.database("Falha ao listar benefícios.", { cause: e }),
   );
}

export function updateBenefit(
   db: DatabaseInstance,
   id: string,
   data: UpdateBenefitInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(benefits)
            .set(validated)
            .where(eq(benefits.id, id))
            .returning(),
         (e) =>
            AppError.database("Falha ao atualizar benefício.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Benefício não encontrado.")),
      ),
   );
}

export function deleteBenefit(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.delete(benefits).where(eq(benefits.id, id)),
      (e) => AppError.database("Falha ao excluir benefício.", { cause: e }),
   ).map(() => undefined);
}

export function ensureBenefitOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getBenefit(db, id).andThen((benefit) => {
      if (!benefit || benefit.teamId !== teamId)
         return err(AppError.notFound("Benefício não encontrado."));
      return ok(benefit);
   });
}

export function attachBenefitToService(
   db: DatabaseInstance,
   serviceId: string,
   benefitId: string,
) {
   return fromPromise(
      db
         .insert(serviceBenefits)
         .values({ serviceId, benefitId })
         .onConflictDoNothing()
         .returning(),
      (e) =>
         AppError.database("Falha ao associar benefício ao serviço.", {
            cause: e,
         }),
   ).map(() => undefined);
}

export function detachBenefitFromService(
   db: DatabaseInstance,
   serviceId: string,
   benefitId: string,
) {
   return fromPromise(
      db
         .delete(serviceBenefits)
         .where(
            and(
               eq(serviceBenefits.serviceId, serviceId),
               eq(serviceBenefits.benefitId, benefitId),
            ),
         ),
      (e) =>
         AppError.database("Falha ao remover benefício do serviço.", {
            cause: e,
         }),
   ).map(() => undefined);
}

export function listBenefitsByService(
   db: DatabaseInstance,
   serviceId: string,
) {
   return fromPromise(
      db
         .select({ benefit: benefits })
         .from(serviceBenefits)
         .innerJoin(benefits, eq(serviceBenefits.benefitId, benefits.id))
         .where(eq(serviceBenefits.serviceId, serviceId)),
      (e) =>
         AppError.database("Falha ao listar benefícios do serviço.", {
            cause: e,
         }),
   ).map((rows) => rows.map((r) => r.benefit));
}
```

**Step 2: Write test file**

Create `core/database/__tests__/repositories/benefits-repository.test.ts`:

```typescript
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../helpers/setup-test-db";
import * as schema from "@core/database/schema";
import { services } from "@core/database/schemas/services";
import * as repo from "../../src/repositories/benefits-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomSeed() {
   return Math.floor(Math.random() * 1_000_000);
}

async function seedTeam() {
   const orgId = crypto.randomUUID();
   const teamId = crypto.randomUUID();
   await seed(testDb.db, { organization: schema.organization }, { seed: randomSeed() }).refine(
      (f) => ({ organization: { count: 1, columns: { id: f.default({ defaultValue: orgId }) } } }),
   );
   await seed(testDb.db, { team: schema.team }, { seed: randomSeed() }).refine(
      (f) => ({
         team: {
            count: 1,
            columns: {
               id: f.default({ defaultValue: teamId }),
               organizationId: f.default({ defaultValue: orgId }),
            },
         },
      }),
   );
   return teamId;
}

async function seedService(teamId: string) {
   const [svc] = await testDb.db
      .insert(services)
      .values({ teamId, name: "Plano Premium" })
      .returning();
   return svc!;
}

function validBenefitInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Acesso VIP",
      type: "feature_access" as const,
      ...overrides,
   };
}

describe("benefits-repository", () => {
   describe("createBenefit", () => {
      it("creates benefit with correct fields", async () => {
         const teamId = await seedTeam();
         const result = await repo.createBenefit(testDb.db, teamId, validBenefitInput());
         const benefit = result._unsafeUnwrap();
         expect(benefit).toMatchObject({ teamId, name: "Acesso VIP", type: "feature_access", isActive: true });
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = await seedTeam();
         const result = await repo.createBenefit(testDb.db, teamId, validBenefitInput({ name: "X" }));
         expect(result.isErr()).toBe(true);
      });
   });

   describe("getBenefit", () => {
      it("returns benefit by id", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createBenefit(testDb.db, teamId, validBenefitInput()))._unsafeUnwrap();
         const found = (await repo.getBenefit(testDb.db, created.id))._unsafeUnwrap();
         expect(found?.id).toBe(created.id);
      });

      it("returns null for non-existent id", async () => {
         const result = (await repo.getBenefit(testDb.db, crypto.randomUUID()))._unsafeUnwrap();
         expect(result).toBeNull();
      });
   });

   describe("updateBenefit", () => {
      it("updates name and isActive", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createBenefit(testDb.db, teamId, validBenefitInput()))._unsafeUnwrap();
         const updated = (await repo.updateBenefit(testDb.db, created.id, { name: "Acesso Ouro", isActive: false }))._unsafeUnwrap();
         expect(updated.name).toBe("Acesso Ouro");
         expect(updated.isActive).toBe(false);
      });
   });

   describe("deleteBenefit", () => {
      it("deletes a benefit", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createBenefit(testDb.db, teamId, validBenefitInput()))._unsafeUnwrap();
         await repo.deleteBenefit(testDb.db, created.id);
         expect((await repo.getBenefit(testDb.db, created.id))._unsafeUnwrap()).toBeNull();
      });
   });

   describe("attachBenefitToService / detachBenefitFromService / listBenefitsByService", () => {
      it("attaches and lists benefit on service", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         const benefit = (await repo.createBenefit(testDb.db, teamId, validBenefitInput()))._unsafeUnwrap();

         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id);
         const list = (await repo.listBenefitsByService(testDb.db, svc.id))._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.id).toBe(benefit.id);
      });

      it("attach is idempotent", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         const benefit = (await repo.createBenefit(testDb.db, teamId, validBenefitInput()))._unsafeUnwrap();

         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id);
         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id); // no error
         const list = (await repo.listBenefitsByService(testDb.db, svc.id))._unsafeUnwrap();
         expect(list).toHaveLength(1);
      });

      it("detaches benefit from service", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         const benefit = (await repo.createBenefit(testDb.db, teamId, validBenefitInput()))._unsafeUnwrap();

         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id);
         await repo.detachBenefitFromService(testDb.db, svc.id, benefit.id);
         const list = (await repo.listBenefitsByService(testDb.db, svc.id))._unsafeUnwrap();
         expect(list).toHaveLength(0);
      });

      it("returns empty list for service with no benefits", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         const list = (await repo.listBenefitsByService(testDb.db, svc.id))._unsafeUnwrap();
         expect(list).toHaveLength(0);
      });
   });

   describe("ensureBenefitOwnership", () => {
      it("returns err when team does not match", async () => {
         const teamId = await seedTeam();
         const created = (await repo.createBenefit(testDb.db, teamId, validBenefitInput()))._unsafeUnwrap();
         const result = await repo.ensureBenefitOwnership(testDb.db, created.id, crypto.randomUUID());
         expect(result.isErr()).toBe(true);
      });
   });
});
```

**Step 3: Run tests**

```bash
npx vitest run core/database/__tests__/repositories/benefits-repository.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add core/database/src/repositories/benefits-repository.ts core/database/__tests__/repositories/benefits-repository.test.ts
git commit -m "feat(database): add benefits-repository with attach/detach tests"
```

---

## Task 16: Update existing test files for schema changes

**Files:**
- Modify: `core/database/__tests__/repositories/services-repository.test.ts`
- Modify: `core/database/__tests__/repositories/subscriptions-repository.test.ts`
- Modify: `core/database/__tests__/repositories/usage-events-repository.test.ts`

### services-repository.test.ts

Changes:
- Remove `basePrice` from `validServiceInput()` (field deleted from `services`)
- Remove `basePrice` assertion from createService test
- Rename all `validVariantInput` → `validPriceInput`
- Replace `billingCycle` → `interval` in price input
- Rename `createVariant` → `createPrice`, `listVariantsByService` → `listPricesByService`, `updateVariant` → `updatePrice`, `deleteVariant` → `deletePrice`, `getVariant` → `getPrice`
- Add `type: "flat"` to validPriceInput

```typescript
function validServiceInput(overrides: Record<string, unknown> = {}) {
   return { name: "Consultoria Financeira", ...overrides };
   // basePrice removed
}

function validPriceInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Hora",
      type: "flat" as const,
      basePrice: "150.00",
      interval: "one_time" as const,
      ...overrides,
   };
}
```

Replace all variant function calls with price equivalents (`createPrice`, `listPricesByService`, `updatePrice`, `deletePrice`, `getPrice`).

### subscriptions-repository.test.ts

Changes:
- Remove `createTestVariant` helper (no `variantId` anymore)
- Remove `createTestContact` seeding of `serviceVariants` — contact seeding stays
- Remove `variantId` and `negotiatedPrice` from `validCreateInput`
- Remove assertions on `variantId`/`negotiatedPrice`/`variantName`/`billingCycle`/`serviceName` from `listSubscriptionsByContact` test (those joins were removed)
- Update `countActiveSubscriptionsByVariant` test if the function was renamed/removed

Updated `validCreateInput`:
```typescript
function validCreateInput(contactId: string, overrides: Record<string, unknown> = {}) {
   return {
      contactId,
      startDate: "2026-01-01",
      source: "manual" as const,
      cancelAtPeriodEnd: false,
      ...overrides,
   };
}
```

### usage-events-repository.test.ts

The `meterId` field is now a UUID FK to `meters.id`. Random UUID values will fail FK constraint.

Add a `seedMeter` helper and use it in all tests:

```typescript
import { meters } from "@core/database/schemas/meters";

async function seedMeter(teamId: string) {
   const [meter] = await testDb.db
      .insert(meters)
      .values({ teamId, name: "Test Meter", eventName: `event.${crypto.randomUUID()}`, aggregation: "sum" })
      .returning();
   return meter!;
}
```

Update `validInput` to require a real `meterId`:
```typescript
function validInput(teamId: string, meterId: string, overrides: Record<string, unknown> = {}) {
   return {
      teamId,
      meterId,
      quantity: "10",
      idempotencyKey: crypto.randomUUID(),
      ...overrides,
   };
}
```

Update all test cases to call `seedMeter(teamId)` first and pass `meter.id` to `validInput`.

**Step 1: Run all affected tests before changes to confirm they currently pass**

```bash
npx vitest run core/database/__tests__/repositories/services-repository.test.ts core/database/__tests__/repositories/subscriptions-repository.test.ts core/database/__tests__/repositories/usage-events-repository.test.ts
```

**Step 2: Apply updates as described above**

**Step 3: Run tests again**

```bash
npx vitest run core/database/__tests__/repositories/services-repository.test.ts core/database/__tests__/repositories/subscriptions-repository.test.ts core/database/__tests__/repositories/usage-events-repository.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add core/database/__tests__/repositories/services-repository.test.ts core/database/__tests__/repositories/subscriptions-repository.test.ts core/database/__tests__/repositories/usage-events-repository.test.ts
git commit -m "test(database): update existing tests for servicePrices rename and schema changes"
```

---

## Task 17: Update oRPC router for renamed types

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/services.ts`

Changes:
1. Replace all `serviceVariants`/`variant`/`Variant` references with `servicePrices`/`price`/`Price`
2. Replace `createVariantSchema` → `createPriceSchema`, `updateVariantSchema` → `updatePriceSchema`
3. Remove `variantId` from `createSubscription` input — subscription no longer needs a variant at creation time (items are added separately via `subscription_items`)
4. Remove `negotiatedPrice` from `createSubscription` input
5. Update `countActiveSubscriptionsByVariant` call — function renamed/simplified in Task 11
6. Update `getAllSubscriptions` status enum to include `"trialing"` and `"incomplete"`

Key changes in the router:

```typescript
// Replace imports:
import {
   createPriceSchema,
   updatePriceSchema,
} from "@core/database/schemas/services";

// Rename procedures:
// getVariants → getPrices
// createVariant → createPrice
// updateVariant → updatePrice
// removeVariant → removePrice

// Update ensureVariantOwnership → ensurePriceOwnership

// Update createSubscription — remove variantId and negotiatedPrice:
export const createSubscription = protectedProcedure
   .input(
      createSubscriptionSchema.pick({
         contactId: true,
         startDate: true,
         endDate: true,
         notes: true,
      }),
   )
   .handler(async ({ context, input }) => {
      return (
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
         (sub) => sub,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

// Update getAllSubscriptions status enum:
.input(
   z
      .object({
         status: z
            .enum(["active", "trialing", "incomplete", "completed", "cancelled"])
            .optional(),
      })
      .optional(),
)
```

**Step 2: Typecheck entire app**

```bash
bun run typecheck
```

Fix any remaining errors.

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/services.ts
git commit -m "feat(services): update router for servicePrices rename and new subscription model"
```

---

## Task 18: Push schema to DB and verify

**Step 1: Push**

```bash
bun run db:push
```

When prompted about destructive changes (column type changes), confirm each:
- `usage_events.meter_id`: text → uuid (ensure no existing rows or data is clean)
- `contact_subscriptions.current_period_start/end`: date → timestamp
- Dropping `contact_subscriptions.variant_id` and `negotiated_price` columns

**Step 2: Full typecheck + test**

```bash
bun run typecheck
bun run test
```

Expected: all green. Any test failures likely in `subscriptions-repository` tests — update to remove references to `variantId`.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: push schema migration for services pricing paradigm"
```

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `schemas/meters.ts` | Meters table + enums + Zod schemas |
| `schemas/coupons.ts` | Coupons + coupon_redemptions tables |
| `schemas/subscription-items.ts` | Subscription items table |
| `schemas/benefits.ts` | Benefits + service_benefits tables |
| `repositories/meters-repository.ts` | CRUD + ownership |
| `repositories/subscription-items-repository.ts` | Add/update/remove/list (max 20 guard) |
| `repositories/coupons-repository.ts` | CRUD + redeem (atomic, snapshot) |
| `repositories/benefits-repository.ts` | CRUD + attach/detach/list by service |

## Summary of Modified Files

| File | What changed |
|------|-------------|
| `schemas/services.ts` | `serviceVariants` → `servicePrices`, new fields, remove `services.basePrice` |
| `schemas/subscriptions.ts` | Remove `variantId`/`negotiatedPrice`, new status values, `couponId`/`trialEndsAt`, timestamp columns |
| `schemas/usage-events.ts` | `meterId` text → uuid FK |
| `schema.ts` | Export new schemas |
| `relations.ts` | All new/renamed relation blocks |
| `repositories/services-repository.ts` | Rename variant→price throughout |
| `repositories/subscriptions-repository.ts` | Remove variant join, removed fields |
| `router/services.ts` | Align with renamed types + new subscription shape |
