# Products, Services & Inventory — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor services, inventory, and subscriptions domains — separate schemas, add Zod validators, singleton db, @f-o-t/money for prices, @f-o-t/uom for quantities, full PGlite test coverage.

**Architecture:** Three separate domain schemas (services, subscriptions, inventory) each with dedicated repositories following the bank-accounts pattern: singleton db import, Zod validateInput, AppError + propagateError.

**Tech Stack:** Drizzle ORM, Zod, @f-o-t/money, @f-o-t/uom, PGlite, Vitest

**Design doc:** `docs/plans/2026-03-11-products-services-inventory-design.md`

---

## Task 1: Subscriptions Schema (extract from services)

**Files:**

- Create: `core/database/src/schemas/subscriptions.ts`
- Modify: `core/database/src/schemas/services.ts` (remove contactSubscriptions)
- Modify: `core/database/src/schema.ts` (add subscriptions export)
- Modify: `core/database/src/relations.ts` (update imports if needed)

**Step 1: Create `core/database/src/schemas/subscriptions.ts`**

Move `contactSubscriptions` table from `services.ts` to this new file. Changes:

- `negotiatedPrice`: `integer` → `numeric(12,2)`
- Add `currentPeriodStart`: `date` nullable
- Add `currentPeriodEnd`: `date` nullable
- Add `cancelAtPeriodEnd`: `boolean` default false
- Add `canceledAt`: `timestamp` nullable
- Add Zod validators

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   date,
   index,
   numeric,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { contacts } from "./contacts";
import { serviceVariants } from "./services";
import { subscriptionStatusEnum, serviceSourceEnum } from "./enums";

export const contactSubscriptions = pgTable(
   "contact_subscriptions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      contactId: uuid("contact_id")
         .notNull()
         .references(() => contacts.id, { onDelete: "cascade" }),
      variantId: uuid("variant_id")
         .notNull()
         .references(() => serviceVariants.id, { onDelete: "cascade" }),
      startDate: date("start_date").notNull(),
      endDate: date("end_date"),
      negotiatedPrice: numeric("negotiated_price", {
         precision: 12,
         scale: 2,
      }).notNull(),
      currentPeriodStart: date("current_period_start"),
      currentPeriodEnd: date("current_period_end"),
      cancelAtPeriodEnd: boolean("cancel_at_period_end")
         .notNull()
         .default(false),
      canceledAt: timestamp("canceled_at", { withTimezone: true }),
      notes: text("notes"),
      status: subscriptionStatusEnum("status").notNull().default("active"),
      source: serviceSourceEnum("source").notNull().default("manual"),
      externalId: text("external_id"),
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
      index("contact_subscriptions_variant_id_idx").on(table.variantId),
      index("contact_subscriptions_external_id_idx").on(table.externalId),
      index("contact_subscriptions_status_idx").on(table.status),
   ],
);

export type ContactSubscription = typeof contactSubscriptions.$inferSelect;
export type NewContactSubscription = typeof contactSubscriptions.$inferInsert;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido e não negativo.",
   });

const dateStringSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

export const createSubscriptionSchema = createInsertSchema(contactSubscriptions)
   .pick({
      contactId: true,
      variantId: true,
      startDate: true,
      endDate: true,
      negotiatedPrice: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      notes: true,
      status: true,
      source: true,
      externalId: true,
   })
   .extend({
      contactId: z.string().uuid(),
      variantId: z.string().uuid(),
      startDate: dateStringSchema,
      endDate: dateStringSchema.nullable().optional(),
      negotiatedPrice: priceSchema,
      currentPeriodStart: dateStringSchema.nullable().optional(),
      currentPeriodEnd: dateStringSchema.nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
      status: z.enum(["active", "completed", "cancelled"]).default("active"),
      source: z.enum(["manual", "asaas"]).default("manual"),
      externalId: z.string().nullable().optional(),
   });

export const updateSubscriptionSchema = createSubscriptionSchema
   .omit({ contactId: true, variantId: true })
   .extend({
      cancelAtPeriodEnd: z.boolean().optional(),
   })
   .partial();

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
```

**Step 2: Remove `contactSubscriptions` from `core/database/src/schemas/services.ts`**

Remove:

- The `contactSubscriptions` table definition
- The `resources` table `resourceId` reference will need updating (it referenced `resources` which is in same file, so it stays)
- Remove `ContactSubscription`, `NewContactSubscription` type exports
- Remove imports that were only used by contactSubscriptions (`subscriptionStatusEnum`, `serviceSourceEnum` from enums) — keep only if still used by other tables in the file

**Step 3: Update `core/database/src/schema.ts`**

Add after the inventory export line:

```typescript
export * from "./schemas/subscriptions";
```

**Step 4: Update any import in `core/database/src/relations.ts` if `contactSubscriptions` is referenced**

Check if relations.ts references contactSubscriptions. If so, the import will auto-resolve since schema.ts re-exports everything.

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: No errors related to subscriptions imports (there may be pre-existing errors)

**Step 6: Commit**

```bash
git add core/database/src/schemas/subscriptions.ts core/database/src/schemas/services.ts core/database/src/schema.ts core/database/src/relations.ts
git commit -m "refactor(database): extract subscriptions schema from services with lifecycle fields"
```

---

## Task 2: Services Schema (remove enum, numeric prices, Zod validators)

**Files:**

- Modify: `core/database/src/schemas/services.ts`
- Modify: `core/database/src/schemas/enums.ts` (remove serviceTypeEnum)

**Step 1: Update `core/database/src/schemas/enums.ts`**

Remove `serviceTypeEnum` and `ServiceType` type export. Keep `billingCycleEnum`, `subscriptionStatusEnum`, `serviceSourceEnum`.

**Step 2: Update `core/database/src/schemas/services.ts`**

Changes:

- Remove `serviceTypeEnum` import and `type` field from `services` table
- Change `basePrice` in `services` from `integer` to `numeric(12,2)`
- Change `basePrice` in `serviceVariants` from `integer` to `numeric(12,2)`
- Remove `contactSubscriptions` table (already done in Task 1 — verify it's gone)
- Remove the old comment dividers
- Add Zod validators

The updated file should have:

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   numeric,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { categories } from "./categories";
import { billingCycleEnum } from "./enums";
import { tags } from "./tags";

export const services = pgTable(
   "services",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      basePrice: numeric("base_price", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
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

export const serviceVariants = pgTable(
   "service_variants",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
      billingCycle: billingCycleEnum("billing_cycle").notNull(),
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
      index("service_variants_service_id_idx").on(table.serviceId),
      index("service_variants_team_id_idx").on(table.teamId),
   ],
);

export const resources = pgTable(
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
export type ServiceVariant = typeof serviceVariants.$inferSelect;
export type NewServiceVariant = typeof serviceVariants.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido e não negativo.",
   });

export const createServiceSchema = createInsertSchema(services)
   .pick({
      name: true,
      description: true,
      basePrice: true,
      categoryId: true,
      tagId: true,
   })
   .extend({
      name: nameSchema,
      description: z.string().max(500).nullable().optional(),
      basePrice: priceSchema.default("0"),
      categoryId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().nullable().optional(),
   });

export const updateServiceSchema = createServiceSchema
   .extend({ isActive: z.boolean().optional() })
   .partial();

export const createVariantSchema = createInsertSchema(serviceVariants)
   .pick({
      name: true,
      basePrice: true,
      billingCycle: true,
   })
   .extend({
      name: nameSchema,
      basePrice: priceSchema,
      billingCycle: z.enum(["hourly", "monthly", "annual", "one_time"]),
   });

export const updateVariantSchema = createVariantSchema
   .extend({ isActive: z.boolean().optional() })
   .partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
```

**Step 3: Fix any references to `serviceTypeEnum` or `services.type` across the codebase**

Search for: `serviceTypeEnum`, `services.type`, `type: serviceTypeEnum`, `ServiceType` (from enums)

Key files to check:

- `apps/web/src/integrations/orpc/router/inventory.ts` (has inline schemas)
- `core/database/src/repositories/services-repository.ts` (has `ListServicesFilters.type`)
- Any frontend components rendering service type

Update each reference to remove the type field usage.

**Step 4: Run typecheck**

Run: `bun run typecheck`

**Step 5: Commit**

```bash
git add core/database/src/schemas/services.ts core/database/src/schemas/enums.ts
git commit -m "refactor(database): remove serviceTypeEnum, migrate basePrice to numeric, add Zod validators"
```

---

## Task 3: Inventory Schema (add initialStock, Zod validators)

**Files:**

- Modify: `core/database/src/schemas/inventory.ts`

**Step 1: Update `core/database/src/schemas/inventory.ts`**

Changes:

- Add `initialStock` field to `inventoryProducts`
- Add Zod validators
- Remove comment dividers

```typescript
import { sql } from "drizzle-orm";
import {
   date,
   index,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { bankAccounts } from "./bank-accounts";
import { categories } from "./categories";
import { contacts } from "./contacts";
import { creditCards } from "./credit-cards";
import { transactions } from "./transactions";

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
   "purchase",
   "sale",
   "waste",
]);

export const inventoryProducts = pgTable(
   "inventory_products",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      baseUnit: text("base_unit").notNull(),
      purchaseUnit: text("purchase_unit").notNull(),
      purchaseUnitFactor: numeric("purchase_unit_factor", {
         precision: 12,
         scale: 4,
      })
         .notNull()
         .default("1"),
      sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }),
      initialStock: numeric("initial_stock", { precision: 12, scale: 4 })
         .notNull()
         .default("0"),
      currentStock: numeric("current_stock", { precision: 12, scale: 4 })
         .notNull()
         .default("0"),
      archivedAt: timestamp("archived_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("inventory_products_team_id_idx").on(table.teamId)],
);

// inventoryMovements and inventorySettings stay the same as current
// (just remove comment dividers)

export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type NewInventoryProduct = typeof inventoryProducts.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventorySettings = typeof inventorySettings.$inferSelect;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const qtySchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Quantidade deve ser um número válido e não negativo.",
   });

const positiveQtySchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Quantidade deve ser maior que zero.",
   });

const priceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Preço deve ser um número válido e não negativo.",
   });

const positivePriceSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Preço deve ser maior que zero.",
   });

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createInventoryProductSchema = createInsertSchema(
   inventoryProducts,
)
   .pick({
      name: true,
      description: true,
      baseUnit: true,
      purchaseUnit: true,
      purchaseUnitFactor: true,
      sellingPrice: true,
      initialStock: true,
   })
   .extend({
      name: nameSchema,
      description: z.string().max(500).nullable().optional(),
      baseUnit: z.string().min(1).max(10),
      purchaseUnit: z.string().min(1).max(10),
      purchaseUnitFactor: qtySchema.default("1"),
      sellingPrice: priceSchema.nullable().optional(),
      initialStock: qtySchema.default("0"),
   });

export const updateInventoryProductSchema = createInventoryProductSchema
   .omit({ initialStock: true })
   .partial();

export const createInventoryMovementSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("purchase"),
      productId: z.string().uuid(),
      qty: positiveQtySchema,
      unitPrice: positivePriceSchema,
      supplierId: z.string().uuid().nullable().optional(),
      transactionId: z.string().uuid().nullable().optional(),
      notes: z.string().max(255).nullable().optional(),
      date: z
         .string()
         .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD."),
   }),
   z.object({
      type: z.literal("sale"),
      productId: z.string().uuid(),
      qty: positiveQtySchema,
      unitPrice: positivePriceSchema,
      supplierId: z.string().uuid().nullable().optional(),
      transactionId: z.string().uuid().nullable().optional(),
      notes: z.string().max(255).nullable().optional(),
      date: z
         .string()
         .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD."),
   }),
   z.object({
      type: z.literal("waste"),
      productId: z.string().uuid(),
      qty: positiveQtySchema,
      supplierId: z.string().uuid().nullable().optional(),
      transactionId: z.string().uuid().nullable().optional(),
      notes: z.string().max(255).nullable().optional(),
      date: z
         .string()
         .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD."),
   }),
]);

export type CreateInventoryProductInput = z.infer<
   typeof createInventoryProductSchema
>;
export type UpdateInventoryProductInput = z.infer<
   typeof updateInventoryProductSchema
>;
export type CreateInventoryMovementInput = z.infer<
   typeof createInventoryMovementSchema
>;
```

**Step 2: Run typecheck**

Run: `bun run typecheck`

**Step 3: Commit**

```bash
git add core/database/src/schemas/inventory.ts
git commit -m "refactor(database): add initialStock, Zod validators to inventory schema"
```

---

## Task 4: Inventory Repository (singleton db, atomic movements, stock blocking)

**Files:**

- Rewrite: `core/database/src/repositories/inventory-repository.ts`

**Step 1: Rewrite `core/database/src/repositories/inventory-repository.ts`**

Key changes from current:

- Singleton `db` import instead of `db: DatabaseInstance` param
- `validateInput` with Zod schemas
- `createInventoryProduct` sets `currentStock = initialStock`
- `createInventoryMovement` is atomic (transaction): validates stock, inserts movement, updates currentStock
- `deleteInventoryMovement` reverts the stock delta atomically
- `toBaseQty` helper migrated from router (uses `@f-o-t/uom`)
- Uses `@f-o-t/money` for `totalAmount` calculation

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import { multiply, of, toDecimal } from "@f-o-t/money";
import { convert, of as uomOf } from "@f-o-t/uom";
import {
   type CreateInventoryMovementInput,
   type CreateInventoryProductInput,
   type UpdateInventoryProductInput,
   createInventoryMovementSchema,
   createInventoryProductSchema,
   inventoryMovements,
   inventoryProducts,
   inventorySettings,
   updateInventoryProductSchema,
} from "@core/database/schemas/inventory";

export async function createInventoryProduct(
   teamId: string,
   data: CreateInventoryProductInput,
) {
   const validated = validateInput(createInventoryProductSchema, data);
   try {
      const [product] = await db
         .insert(inventoryProducts)
         .values({
            ...validated,
            teamId,
            currentStock: validated.initialStock ?? "0",
         })
         .returning();
      if (!product)
         throw AppError.database("Failed to create inventory product");
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create inventory product");
   }
}

export async function listInventoryProducts(
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   try {
      const conditions = [eq(inventoryProducts.teamId, teamId)];
      if (!opts?.includeArchived) {
         conditions.push(isNull(inventoryProducts.archivedAt));
      }
      return await db
         .select()
         .from(inventoryProducts)
         .where(and(...conditions))
         .orderBy(inventoryProducts.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list inventory products");
   }
}

export async function getInventoryProduct(id: string) {
   try {
      const product = await db.query.inventoryProducts.findFirst({
         where: { id },
      });
      return product ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get inventory product");
   }
}

export async function updateInventoryProduct(
   id: string,
   data: UpdateInventoryProductInput,
) {
   const validated = validateInput(updateInventoryProductSchema, data);
   try {
      const [product] = await db
         .update(inventoryProducts)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(inventoryProducts.id, id))
         .returning();
      if (!product) throw AppError.notFound("Produto não encontrado.");
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update inventory product");
   }
}

export async function archiveInventoryProduct(id: string) {
   try {
      const [product] = await db
         .update(inventoryProducts)
         .set({ archivedAt: new Date() })
         .where(eq(inventoryProducts.id, id))
         .returning();
      if (!product) throw AppError.notFound("Produto não encontrado.");
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive inventory product");
   }
}

export function toBaseQty(
   purchasedQty: number,
   purchaseUnit: string,
   baseUnit: string,
   factor: number,
): number {
   if (purchaseUnit === baseUnit) return purchasedQty;
   try {
      const m = uomOf(purchasedQty, purchaseUnit as any);
      const converted = convert(m, baseUnit as any);
      return Number(converted.value) / 10 ** converted.scale;
   } catch {
      return purchasedQty * factor;
   }
}

export async function createInventoryMovement(
   teamId: string,
   data: CreateInventoryMovementInput,
) {
   const validated = validateInput(createInventoryMovementSchema, data);
   try {
      return await db.transaction(async (tx) => {
         const [product] = await tx
            .select()
            .from(inventoryProducts)
            .where(eq(inventoryProducts.id, validated.productId));
         if (!product) throw AppError.notFound("Produto não encontrado.");

         const currentStockNum = Number(product.currentStock);
         const qtyNum = Number(validated.qty);

         if (validated.type === "sale" || validated.type === "waste") {
            if (qtyNum > currentStockNum) {
               throw AppError.conflict(
                  `Quantidade maior que o estoque disponível (saldo atual: ${product.currentStock})`,
               );
            }
         }

         let totalAmount: string | null = null;
         if (validated.type !== "waste") {
            const price = of(validated.unitPrice, "BRL");
            totalAmount = toDecimal(multiply(price, qtyNum));
         }

         const delta = validated.type === "purchase" ? qtyNum : -qtyNum;

         const [movement] = await tx
            .insert(inventoryMovements)
            .values({
               teamId,
               productId: validated.productId,
               type: validated.type,
               qty: validated.qty,
               unitPrice:
                  validated.type !== "waste" ? validated.unitPrice : null,
               totalAmount,
               supplierId: validated.supplierId ?? null,
               transactionId: validated.transactionId ?? null,
               notes: validated.notes ?? null,
               date: validated.date,
            })
            .returning();

         await tx
            .update(inventoryProducts)
            .set({
               currentStock: sql`${inventoryProducts.currentStock} + ${delta}`,
            })
            .where(eq(inventoryProducts.id, validated.productId));

         if (!movement)
            throw AppError.database("Failed to create inventory movement");
         return movement;
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create inventory movement");
   }
}

export async function listInventoryMovements(
   productId: string,
   teamId: string,
) {
   try {
      return await db
         .select()
         .from(inventoryMovements)
         .where(
            and(
               eq(inventoryMovements.productId, productId),
               eq(inventoryMovements.teamId, teamId),
            ),
         )
         .orderBy(desc(inventoryMovements.createdAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list inventory movements");
   }
}

export async function deleteInventoryMovement(id: string) {
   try {
      return await db.transaction(async (tx) => {
         const [movement] = await tx
            .select()
            .from(inventoryMovements)
            .where(eq(inventoryMovements.id, id));
         if (!movement) throw AppError.notFound("Movimento não encontrado.");

         const qtyNum = Number(movement.qty);
         const reverseDelta = movement.type === "purchase" ? -qtyNum : qtyNum;

         await tx
            .delete(inventoryMovements)
            .where(eq(inventoryMovements.id, id));

         await tx
            .update(inventoryProducts)
            .set({
               currentStock: sql`${inventoryProducts.currentStock} + ${reverseDelta}`,
            })
            .where(eq(inventoryProducts.id, movement.productId));
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete inventory movement");
   }
}

export async function getInventorySettings(teamId: string) {
   try {
      const [settings] = await db
         .select()
         .from(inventorySettings)
         .where(eq(inventorySettings.teamId, teamId));
      return settings ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get inventory settings");
   }
}

export async function upsertInventorySettings(
   teamId: string,
   data: Omit<
      typeof inventorySettings.$inferInsert,
      "teamId" | "createdAt" | "updatedAt"
   >,
) {
   try {
      const [settings] = await db
         .insert(inventorySettings)
         .values({ teamId, ...data })
         .onConflictDoUpdate({
            target: inventorySettings.teamId,
            set: { ...data, updatedAt: new Date() },
         })
         .returning();
      return settings;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert inventory settings");
   }
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`

**Step 3: Commit**

```bash
git add core/database/src/repositories/inventory-repository.ts
git commit -m "refactor(database): rewrite inventory repository with singleton db, Zod, atomic stock"
```

---

## Task 5: Services Repository (singleton db, Zod, remove subscriptions)

**Files:**

- Rewrite: `core/database/src/repositories/services-repository.ts`

**Step 1: Rewrite `core/database/src/repositories/services-repository.ts`**

Key changes:

- Singleton `db` import
- `validateInput` with Zod schemas
- Remove all subscription functions (migrated to Task 6)
- Remove `bulkCreateServices`
- Remove comment dividers

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateServiceInput,
   type CreateVariantInput,
   type UpdateServiceInput,
   type UpdateVariantInput,
   createServiceSchema,
   createVariantSchema,
   services,
   serviceVariants,
   updateServiceSchema,
   updateVariantSchema,
} from "@core/database/schemas/services";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";

export async function createService(teamId: string, data: CreateServiceInput) {
   const validated = validateInput(createServiceSchema, data);
   try {
      const [service] = await db
         .insert(services)
         .values({ ...validated, teamId })
         .returning();
      if (!service) throw AppError.database("Failed to create service");
      return service;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create service");
   }
}

export async function listServices(
   teamId: string,
   filters?: { search?: string; categoryId?: string },
) {
   try {
      const conditions: SQL[] = [eq(services.teamId, teamId)];

      if (filters?.search) {
         const pattern = `%${filters.search}%`;
         const searchCondition = or(
            ilike(services.name, pattern),
            ilike(services.description, pattern),
         );
         if (searchCondition) conditions.push(searchCondition);
      }

      if (filters?.categoryId) {
         conditions.push(eq(services.categoryId, filters.categoryId));
      }

      return await db
         .select({
            id: services.id,
            teamId: services.teamId,
            name: services.name,
            description: services.description,
            basePrice: services.basePrice,
            categoryId: services.categoryId,
            tagId: services.tagId,
            isActive: services.isActive,
            createdAt: services.createdAt,
            updatedAt: services.updatedAt,
            categoryName: categories.name,
            categoryColor: categories.color,
            tagName: tags.name,
            tagColor: tags.color,
         })
         .from(services)
         .leftJoin(categories, eq(services.categoryId, categories.id))
         .leftJoin(tags, eq(services.tagId, tags.id))
         .where(and(...conditions))
         .orderBy(services.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list services");
   }
}

export async function getService(id: string) {
   try {
      const service = await db.query.services.findFirst({
         where: { id },
      });
      return service ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get service");
   }
}

export async function updateService(id: string, data: UpdateServiceInput) {
   const validated = validateInput(updateServiceSchema, data);
   try {
      const [updated] = await db
         .update(services)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(services.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Serviço não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update service");
   }
}

export async function deleteService(id: string) {
   try {
      await db.delete(services).where(eq(services.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete service");
   }
}

export async function createVariant(
   teamId: string,
   serviceId: string,
   data: CreateVariantInput,
) {
   const validated = validateInput(createVariantSchema, data);
   try {
      const [variant] = await db
         .insert(serviceVariants)
         .values({ ...validated, teamId, serviceId })
         .returning();
      if (!variant) throw AppError.database("Failed to create variant");
      return variant;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create variant");
   }
}

export async function listVariantsByService(serviceId: string) {
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

export async function getVariant(id: string) {
   try {
      const variant = await db.query.serviceVariants.findFirst({
         where: { id },
      });
      return variant ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get variant");
   }
}

export async function updateVariant(id: string, data: UpdateVariantInput) {
   const validated = validateInput(updateVariantSchema, data);
   try {
      const [updated] = await db
         .update(serviceVariants)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(serviceVariants.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Variante não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update variant");
   }
}

export async function deleteVariant(id: string) {
   try {
      await db.delete(serviceVariants).where(eq(serviceVariants.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete variant");
   }
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`

**Step 3: Commit**

```bash
git add core/database/src/repositories/services-repository.ts
git commit -m "refactor(database): rewrite services repository with singleton db, Zod, remove subscriptions"
```

---

## Task 6: Subscriptions Repository (new)

**Files:**

- Create: `core/database/src/repositories/subscriptions-repository.ts`

**Step 1: Create `core/database/src/repositories/subscriptions-repository.ts`**

Migrated from services-repository with changes:

- Singleton `db`
- `validateInput` with Zod schemas
- `@f-o-t/money` for negotiatedPrice

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateSubscriptionInput,
   type UpdateSubscriptionInput,
   contactSubscriptions,
   createSubscriptionSchema,
   updateSubscriptionSchema,
} from "@core/database/schemas/subscriptions";

export async function createSubscription(
   teamId: string,
   data: CreateSubscriptionInput,
) {
   const validated = validateInput(createSubscriptionSchema, data);
   try {
      const [sub] = await db
         .insert(contactSubscriptions)
         .values({ ...validated, teamId })
         .returning();
      if (!sub) throw AppError.database("Failed to create subscription");
      return sub;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create subscription");
   }
}

export async function getSubscription(id: string) {
   try {
      const sub = await db.query.contactSubscriptions.findFirst({
         where: { id },
      });
      return sub ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get subscription");
   }
}

export async function updateSubscription(
   id: string,
   data: UpdateSubscriptionInput,
) {
   const validated = validateInput(updateSubscriptionSchema, data);
   try {
      const [updated] = await db
         .update(contactSubscriptions)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(contactSubscriptions.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Assinatura não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update subscription");
   }
}

export async function listSubscriptionsByTeam(
   teamId: string,
   status?: "active" | "completed" | "cancelled",
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

export async function listSubscriptionsByContact(contactId: string) {
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

export async function upsertSubscriptionByExternalId(
   externalId: string,
   data: CreateSubscriptionInput & { teamId: string },
) {
   const validated = validateInput(createSubscriptionSchema, data);
   try {
      const [existing] = await db
         .select({ id: contactSubscriptions.id })
         .from(contactSubscriptions)
         .where(eq(contactSubscriptions.externalId, externalId));

      if (existing) {
         const [updated] = await db
            .update(contactSubscriptions)
            .set({
               status: validated.status,
               negotiatedPrice: validated.negotiatedPrice,
               endDate: validated.endDate,
               currentPeriodStart: validated.currentPeriodStart,
               currentPeriodEnd: validated.currentPeriodEnd,
               updatedAt: new Date(),
            })
            .where(eq(contactSubscriptions.id, existing.id))
            .returning();
         return updated;
      }

      const [inserted] = await db
         .insert(contactSubscriptions)
         .values({ ...validated, teamId: data.teamId })
         .returning();
      return inserted;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert subscription");
   }
}

export async function countActiveSubscriptionsByVariant(teamId: string) {
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

export async function listExpiringSoon(teamId: string, withinDays = 30) {
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
               lte(
                  contactSubscriptions.endDate,
                  cutoff.toISOString().slice(0, 10),
               ),
               gte(
                  contactSubscriptions.endDate,
                  new Date().toISOString().slice(0, 10),
               ),
            ),
         )
         .orderBy(contactSubscriptions.endDate);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list expiring subscriptions");
   }
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`

**Step 3: Commit**

```bash
git add core/database/src/repositories/subscriptions-repository.ts
git commit -m "feat(database): add subscriptions repository with Zod validators and lifecycle fields"
```

---

## Task 7: Update oRPC Router and Other Consumers

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/inventory.ts`
- Search and fix: any file importing from old locations

**Step 1: Search for all imports of moved/changed symbols**

Search for:

- `from "../schema"` or `from "@core/database/schema"` that import `contactSubscriptions`, `NewContactSubscription`, `SubscriptionStatus`
- `from "../../src/repositories/services-repository"` that import subscription functions
- `serviceTypeEnum` or `ServiceType` references
- `services.type` usage in queries

Run grep to find all affected files and update imports to point to new locations.

**Step 2: Update `apps/web/src/integrations/orpc/router/inventory.ts`**

- Remove inline `toBaseQty` function (now exported from inventory-repository)
- Remove inline `productSchema` and `movementSchema` (now in inventory schema)
- Update repository function calls to match new signatures (no more `db` param)
- Import `toBaseQty` from `@core/database/repositories/inventory-repository`

**Step 3: Run typecheck and fix all remaining errors**

Run: `bun run typecheck`
Fix any remaining import errors iteratively.

**Step 4: Commit**

```bash
git add -u
git commit -m "refactor: update all consumers for new services/inventory/subscriptions split"
```

---

## Task 8: Inventory Repository Tests

**Files:**

- Create: `core/database/__tests__/repositories/inventory-repository.test.ts`

**Step 1: Write test file**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import * as repo from "../../src/repositories/inventory-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

function validProductInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Café Especial",
      baseUnit: "kg",
      purchaseUnit: "kg",
      purchaseUnitFactor: "1",
      sellingPrice: "45.00",
      initialStock: "100.0000",
      ...overrides,
   };
}

describe("inventory-repository", () => {
   describe("createInventoryProduct", () => {
      it("creates a product with currentStock equal to initialStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "50.0000" }),
         );

         expect(product).toMatchObject({
            teamId,
            name: "Café Especial",
            initialStock: "50.0000",
            currentStock: "50.0000",
         });
         expect(product.id).toBeDefined();
      });

      it("defaults initialStock and currentStock to 0", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: undefined }),
         );

         expect(product.initialStock).toBe("0.0000");
         expect(product.currentStock).toBe("0.0000");
      });

      it("rejects negative initialStock", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createInventoryProduct(
               teamId,
               validProductInput({ initialStock: "-5" }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("listInventoryProducts", () => {
      it("lists active products only by default", async () => {
         const teamId = randomTeamId();
         await repo.createInventoryProduct(
            teamId,
            validProductInput({ name: "Active" }),
         );
         const archived = await repo.createInventoryProduct(
            teamId,
            validProductInput({ name: "Archived" }),
         );
         await repo.archiveInventoryProduct(archived.id);

         const list = await repo.listInventoryProducts(teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Active");
      });

      it("lists all products when includeArchived is true", async () => {
         const teamId = randomTeamId();
         await repo.createInventoryProduct(
            teamId,
            validProductInput({ name: "A" }),
         );
         const b = await repo.createInventoryProduct(
            teamId,
            validProductInput({ name: "B" }),
         );
         await repo.archiveInventoryProduct(b.id);

         const list = await repo.listInventoryProducts(teamId, {
            includeArchived: true,
         });
         expect(list).toHaveLength(2);
      });
   });

   describe("getInventoryProduct", () => {
      it("returns product by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createInventoryProduct(
            teamId,
            validProductInput(),
         );

         const found = await repo.getInventoryProduct(created.id);
         expect(found).toMatchObject({ id: created.id, name: "Café Especial" });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getInventoryProduct(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateInventoryProduct", () => {
      it("updates product fields", async () => {
         const teamId = randomTeamId();
         const created = await repo.createInventoryProduct(
            teamId,
            validProductInput(),
         );

         const updated = await repo.updateInventoryProduct(created.id, {
            name: "Café Premium",
            sellingPrice: "55.00",
         });

         expect(updated.name).toBe("Café Premium");
         expect(updated.sellingPrice).toBe("55.00");
      });
   });

   describe("createInventoryMovement", () => {
      it("purchase: creates movement and increments currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "10.0000" }),
         );

         const movement = await repo.createInventoryMovement(teamId, {
            type: "purchase",
            productId: product.id,
            qty: "5.0000",
            unitPrice: "30.00",
            date: "2026-03-11",
         });

         expect(movement.type).toBe("purchase");
         expect(movement.qty).toBe("5.0000");
         expect(movement.totalAmount).toBe("150.00");

         const updated = await repo.getInventoryProduct(product.id);
         expect(updated!.currentStock).toBe("15.0000");
      });

      it("sale: creates movement and decrements currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "20.0000" }),
         );

         const movement = await repo.createInventoryMovement(teamId, {
            type: "sale",
            productId: product.id,
            qty: "5.0000",
            unitPrice: "45.00",
            date: "2026-03-11",
         });

         expect(movement.totalAmount).toBe("225.00");

         const updated = await repo.getInventoryProduct(product.id);
         expect(updated!.currentStock).toBe("15.0000");
      });

      it("sale: blocks when qty exceeds currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "5.0000" }),
         );

         await expect(
            repo.createInventoryMovement(teamId, {
               type: "sale",
               productId: product.id,
               qty: "10.0000",
               unitPrice: "45.00",
               date: "2026-03-11",
            }),
         ).rejects.toThrow(/estoque disponível/);
      });

      it("waste: creates movement without unitPrice and decrements stock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "10.0000" }),
         );

         const movement = await repo.createInventoryMovement(teamId, {
            type: "waste",
            productId: product.id,
            qty: "3.0000",
            date: "2026-03-11",
         });

         expect(movement.unitPrice).toBeNull();
         expect(movement.totalAmount).toBeNull();

         const updated = await repo.getInventoryProduct(product.id);
         expect(updated!.currentStock).toBe("7.0000");
      });

      it("waste: blocks when qty exceeds currentStock", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "2.0000" }),
         );

         await expect(
            repo.createInventoryMovement(teamId, {
               type: "waste",
               productId: product.id,
               qty: "5.0000",
               date: "2026-03-11",
            }),
         ).rejects.toThrow(/estoque disponível/);
      });
   });

   describe("deleteInventoryMovement", () => {
      it("reverts purchase delta on deletion", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "10.0000" }),
         );

         const movement = await repo.createInventoryMovement(teamId, {
            type: "purchase",
            productId: product.id,
            qty: "5.0000",
            unitPrice: "30.00",
            date: "2026-03-11",
         });

         await repo.deleteInventoryMovement(movement.id);

         const updated = await repo.getInventoryProduct(product.id);
         expect(updated!.currentStock).toBe("10.0000");
      });

      it("reverts sale delta on deletion", async () => {
         const teamId = randomTeamId();
         const product = await repo.createInventoryProduct(
            teamId,
            validProductInput({ initialStock: "20.0000" }),
         );

         const movement = await repo.createInventoryMovement(teamId, {
            type: "sale",
            productId: product.id,
            qty: "5.0000",
            unitPrice: "45.00",
            date: "2026-03-11",
         });

         await repo.deleteInventoryMovement(movement.id);

         const updated = await repo.getInventoryProduct(product.id);
         expect(updated!.currentStock).toBe("20.0000");
      });
   });

   describe("toBaseQty", () => {
      it("returns same qty when units match", () => {
         expect(repo.toBaseQty(10, "kg", "kg", 1)).toBe(10);
      });

      it("falls back to factor for custom units", () => {
         expect(repo.toBaseQty(2, "cx", "un", 12)).toBe(24);
      });
   });
});
```

**Step 2: Run tests**

Run: `cd core/database && npx vitest run __tests__/repositories/inventory-repository.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/inventory-repository.test.ts
git commit -m "test(database): add inventory repository tests with stock blocking"
```

---

## Task 9: Services Repository Tests

**Files:**

- Create: `core/database/__tests__/repositories/services-repository.test.ts`

**Step 1: Write test file**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import * as repo from "../../src/repositories/services-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

function validServiceInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Consultoria Financeira",
      basePrice: "150.00",
      ...overrides,
   };
}

function validVariantInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Hora",
      basePrice: "150.00",
      billingCycle: "one_time" as const,
      ...overrides,
   };
}

describe("services-repository", () => {
   describe("createService", () => {
      it("creates a service with correct fields", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());

         expect(service).toMatchObject({
            teamId,
            name: "Consultoria Financeira",
            basePrice: "150.00",
            isActive: true,
         });
         expect(service.id).toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createService(teamId, validServiceInput({ name: "A" })),
         ).rejects.toThrow();
      });
   });

   describe("listServices", () => {
      it("lists services for a team", async () => {
         const teamId = randomTeamId();
         await repo.createService(
            teamId,
            validServiceInput({ name: "Serviço A" }),
         );
         await repo.createService(
            teamId,
            validServiceInput({ name: "Serviço B" }),
         );

         const list = await repo.listServices(teamId);
         expect(list).toHaveLength(2);
      });

      it("filters by search term", async () => {
         const teamId = randomTeamId();
         await repo.createService(
            teamId,
            validServiceInput({ name: "Consultoria" }),
         );
         await repo.createService(
            teamId,
            validServiceInput({ name: "Auditoria" }),
         );

         const list = await repo.listServices(teamId, { search: "Consul" });
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Consultoria");
      });
   });

   describe("getService", () => {
      it("returns service by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createService(teamId, validServiceInput());

         const found = await repo.getService(created.id);
         expect(found).toMatchObject({ id: created.id });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getService(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateService", () => {
      it("updates service fields", async () => {
         const teamId = randomTeamId();
         const created = await repo.createService(teamId, validServiceInput());

         const updated = await repo.updateService(created.id, {
            name: "Mentoria",
            basePrice: "200.00",
         });

         expect(updated.name).toBe("Mentoria");
         expect(updated.basePrice).toBe("200.00");
      });
   });

   describe("deleteService", () => {
      it("deletes a service", async () => {
         const teamId = randomTeamId();
         const created = await repo.createService(teamId, validServiceInput());

         await repo.deleteService(created.id);
         const found = await repo.getService(created.id);
         expect(found).toBeNull();
      });
   });

   describe("variants", () => {
      it("creates a variant linked to a service", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());

         const variant = await repo.createVariant(
            teamId,
            service.id,
            validVariantInput(),
         );

         expect(variant).toMatchObject({
            serviceId: service.id,
            name: "Hora",
            basePrice: "150.00",
            billingCycle: "one_time",
         });
      });

      it("lists variants by service", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());
         await repo.createVariant(
            teamId,
            service.id,
            validVariantInput({ name: "Hora" }),
         );
         await repo.createVariant(
            teamId,
            service.id,
            validVariantInput({ name: "Turno", basePrice: "250.00" }),
         );

         const list = await repo.listVariantsByService(service.id);
         expect(list).toHaveLength(2);
      });

      it("updates a variant", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());
         const variant = await repo.createVariant(
            teamId,
            service.id,
            validVariantInput(),
         );

         const updated = await repo.updateVariant(variant.id, {
            name: "Diária",
            basePrice: "350.00",
         });

         expect(updated.name).toBe("Diária");
         expect(updated.basePrice).toBe("350.00");
      });

      it("deletes a variant", async () => {
         const teamId = randomTeamId();
         const service = await repo.createService(teamId, validServiceInput());
         const variant = await repo.createVariant(
            teamId,
            service.id,
            validVariantInput(),
         );

         await repo.deleteVariant(variant.id);
         const found = await repo.getVariant(variant.id);
         expect(found).toBeNull();
      });
   });
});
```

**Step 2: Run tests**

Run: `cd core/database && npx vitest run __tests__/repositories/services-repository.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/services-repository.test.ts
git commit -m "test(database): add services repository tests"
```

---

## Task 10: Subscriptions Repository Tests

**Files:**

- Create: `core/database/__tests__/repositories/subscriptions-repository.test.ts`

**Step 1: Write test file**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { services, serviceVariants } from "@core/database/schemas/services";
import { contacts } from "@core/database/schemas/contacts";
import * as repo from "../../src/repositories/subscriptions-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

async function createTestVariant(teamId: string) {
   const [service] = await testDb.db
      .insert(services)
      .values({
         teamId,
         name: "Plano Ouro",
         basePrice: "399.00",
      })
      .returning();

   const [variant] = await testDb.db
      .insert(serviceVariants)
      .values({
         teamId,
         serviceId: service!.id,
         name: "Mensal",
         basePrice: "399.00",
         billingCycle: "monthly",
      })
      .returning();

   return variant!;
}

async function createTestContact(teamId: string) {
   const [contact] = await testDb.db
      .insert(contacts)
      .values({
         teamId,
         name: "João Silva",
         type: "cliente",
      })
      .returning();
   return contact!;
}

function validSubscriptionInput(
   contactId: string,
   variantId: string,
   overrides: Record<string, unknown> = {},
) {
   return {
      contactId,
      variantId,
      startDate: "2026-03-01",
      negotiatedPrice: "399.00",
      currentPeriodStart: "2026-03-01",
      currentPeriodEnd: "2026-03-31",
      ...overrides,
   };
}

describe("subscriptions-repository", () => {
   describe("createSubscription", () => {
      it("creates a subscription with lifecycle fields", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);

         const sub = await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id),
         );

         expect(sub).toMatchObject({
            teamId,
            contactId: contact.id,
            variantId: variant.id,
            negotiatedPrice: "399.00",
            currentPeriodStart: "2026-03-01",
            currentPeriodEnd: "2026-03-31",
            cancelAtPeriodEnd: false,
            canceledAt: null,
            status: "active",
         });
      });
   });

   describe("getSubscription", () => {
      it("returns subscription by id", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         const created = await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id),
         );

         const found = await repo.getSubscription(created.id);
         expect(found).toMatchObject({ id: created.id });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getSubscription(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateSubscription", () => {
      it("updates subscription fields", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         const created = await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id),
         );

         const updated = await repo.updateSubscription(created.id, {
            cancelAtPeriodEnd: true,
            status: "cancelled",
            canceledAt: new Date().toISOString(),
         });

         expect(updated.cancelAtPeriodEnd).toBe(true);
         expect(updated.status).toBe("cancelled");
      });
   });

   describe("listSubscriptionsByTeam", () => {
      it("lists subscriptions for a team", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id),
         );

         const list = await repo.listSubscriptionsByTeam(teamId);
         expect(list).toHaveLength(1);
      });

      it("filters by status", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         const sub = await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id),
         );
         await repo.updateSubscription(sub.id, { status: "cancelled" });

         const active = await repo.listSubscriptionsByTeam(teamId, "active");
         expect(active).toHaveLength(0);

         const cancelled = await repo.listSubscriptionsByTeam(
            teamId,
            "cancelled",
         );
         expect(cancelled).toHaveLength(1);
      });
   });

   describe("listSubscriptionsByContact", () => {
      it("lists subscriptions for a contact", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id),
         );

         const list = await repo.listSubscriptionsByContact(contact.id);
         expect(list).toHaveLength(1);
      });
   });

   describe("upsertSubscriptionByExternalId", () => {
      it("inserts when externalId does not exist", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);

         const sub = await repo.upsertSubscriptionByExternalId(
            "asaas_sub_123",
            {
               teamId,
               ...validSubscriptionInput(contact.id, variant.id, {
                  externalId: "asaas_sub_123",
                  source: "asaas",
               }),
            },
         );

         expect(sub!.externalId).toBe("asaas_sub_123");
      });

      it("updates when externalId already exists", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);

         await repo.upsertSubscriptionByExternalId("asaas_sub_456", {
            teamId,
            ...validSubscriptionInput(contact.id, variant.id, {
               externalId: "asaas_sub_456",
               source: "asaas",
               negotiatedPrice: "399.00",
            }),
         });

         const updated = await repo.upsertSubscriptionByExternalId(
            "asaas_sub_456",
            {
               teamId,
               ...validSubscriptionInput(contact.id, variant.id, {
                  externalId: "asaas_sub_456",
                  source: "asaas",
                  negotiatedPrice: "499.00",
                  status: "cancelled",
               }),
            },
         );

         expect(updated!.negotiatedPrice).toBe("499.00");
         expect(updated!.status).toBe("cancelled");
      });
   });

   describe("countActiveSubscriptionsByVariant", () => {
      it("counts active subscriptions grouped by variant", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact1 = await createTestContact(teamId);
         const contact2 = await createTestContact(teamId);

         await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact1.id, variant.id),
         );
         await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact2.id, variant.id),
         );

         const counts = await repo.countActiveSubscriptionsByVariant(teamId);
         expect(counts).toHaveLength(1);
         expect(counts[0]!.count).toBe(2);
      });
   });

   describe("listExpiringSoon", () => {
      it("lists subscriptions expiring within N days", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);

         await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id, {
               endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 10),
            }),
         );

         await repo.createSubscription(
            teamId,
            validSubscriptionInput(contact.id, variant.id, {
               endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 10),
            }),
         );

         const expiring = await repo.listExpiringSoon(teamId, 30);
         expect(expiring).toHaveLength(1);
      });
   });
});
```

**Step 2: Run tests**

Run: `cd core/database && npx vitest run __tests__/repositories/subscriptions-repository.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/subscriptions-repository.test.ts
git commit -m "test(database): add subscriptions repository tests with lifecycle and analytics"
```

---

## Task 11: Run All Tests and Final Typecheck

**Step 1: Run all database tests**

Run: `cd core/database && npx vitest run`
Expected: All tests pass (inventory, services, subscriptions + existing bank-accounts, categories, credit-cards, tags)

**Step 2: Run full typecheck**

Run: `bun run typecheck`
Expected: No new errors

**Step 3: Run linter**

Run: `bun run check`
Expected: No new errors

**Step 4: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix: resolve typecheck and lint issues from refactoring"
```
