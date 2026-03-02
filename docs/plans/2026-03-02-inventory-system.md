# Inventory System — MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a minimal inventory/stock module with transaction auto-creation — scoped as a concept release.

**Architecture:** Three new DB tables (`inventory_products`, `inventory_movements`, `inventory_settings`). A single `registerMovement` procedure handles purchase/sale/waste and auto-creates a linked transaction. `@f-o-t/uom` converts purchase units to base units where possible, falling back to a stored factor for custom units (box, pod, etc.).

**Tech Stack:** Drizzle ORM, oRPC, TanStack Query + Router, `@f-o-t/uom`, existing `transactions` table, `contacts` table, `bank_accounts`/`credit_cards`/`categories` tables.

---

## Improvements (post-concept — do NOT implement now)

- Batch/lot tracking with expiry dates + FIFO consumption
- Low stock threshold alerts
- Calendar view (expiry planning)
- Mobile quick-sell flow (tap card → numpad → done)
- Native `@f-o-t/uom` category detection (skip try/catch, check unit category)
- Barcode scanning on mobile

---

## Task 1: Install `@f-o-t/uom`

**Files:**
- Modify: `package.json` (root) — fot catalog
- Modify: `apps/web/package.json` — dependencies

**Step 1: Add to root catalog**

In `package.json`, under `"catalog": { "fot": { ... } }`, add:
```json
"@f-o-t/uom": "1.0.6"
```

**Step 2: Add to web app**

In `apps/web/package.json`, under `"dependencies"`, add:
```json
"@f-o-t/uom": "catalog:fot"
```

**Step 3: Install**
```bash
bun install
```

Expected: no errors, `@f-o-t/uom` resolvable from `apps/web`.

**Step 4: Commit**
```bash
git add package.json apps/web/package.json bun.lock
git commit -m "chore: add @f-o-t/uom to web app"
```

---

## Task 2: DB Schema

**Files:**
- Create: `packages/database/src/schemas/inventory.ts`
- Modify: `packages/database/src/schema.ts`

**Step 1: Create schema file**

```typescript
// packages/database/src/schemas/inventory.ts
import { relations, sql } from "drizzle-orm";
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
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      baseUnit: text("base_unit").notNull(),       // "unit", "g", "mL"
      purchaseUnit: text("purchase_unit").notNull(), // "box", "kg", "L"
      purchaseUnitFactor: numeric("purchase_unit_factor", {
         precision: 12,
         scale: 4,
      }).notNull().default("1"),                   // base units per purchase unit
      sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }),
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

export const inventoryMovements = pgTable(
   "inventory_movements",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      productId: uuid("product_id")
         .notNull()
         .references(() => inventoryProducts.id, { onDelete: "restrict" }),
      type: inventoryMovementTypeEnum("type").notNull(),
      qty: numeric("qty", { precision: 12, scale: 4 }).notNull(), // in baseUnit
      unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
      totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
      supplierId: uuid("supplier_id").references(() => contacts.id, {
         onDelete: "set null",
      }),
      transactionId: uuid("transaction_id").references(() => transactions.id, {
         onDelete: "set null",
      }),
      notes: text("notes"),
      date: date("date").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      index("inventory_movements_product_id_idx").on(table.productId),
      index("inventory_movements_team_id_idx").on(table.teamId),
   ],
);

export const inventorySettings = pgTable("inventory_settings", {
   teamId: uuid("team_id").primaryKey(),
   purchaseBankAccountId: uuid("purchase_bank_account_id").references(
      () => bankAccounts.id,
      { onDelete: "set null" },
   ),
   purchaseCreditCardId: uuid("purchase_credit_card_id").references(
      () => creditCards.id,
      { onDelete: "set null" },
   ),
   purchaseCategoryId: uuid("purchase_category_id").references(
      () => categories.id,
      { onDelete: "set null" },
   ),
   saleCategoryId: uuid("sale_category_id").references(() => categories.id, {
      onDelete: "set null",
   }),
   wasteCategoryId: uuid("waste_category_id").references(() => categories.id, {
      onDelete: "set null",
   }),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
});

// Relations
export const inventoryProductsRelations = relations(
   inventoryProducts,
   ({ many }) => ({
      movements: many(inventoryMovements),
   }),
);

export const inventoryMovementsRelations = relations(
   inventoryMovements,
   ({ one }) => ({
      product: one(inventoryProducts, {
         fields: [inventoryMovements.productId],
         references: [inventoryProducts.id],
      }),
   }),
);

export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type NewInventoryProduct = typeof inventoryProducts.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventorySettings = typeof inventorySettings.$inferSelect;
```

**Step 2: Export from schema barrel**

In `packages/database/src/schema.ts`, add after the last `export *`:
```typescript
// Inventory
export * from "./schemas/inventory";
```

**Step 3: Push schema to DB**
```bash
bun run db:push
```

Expected: 3 new tables created, enum `inventory_movement_type` created.

**Step 4: Commit**
```bash
git add packages/database/src/schemas/inventory.ts packages/database/src/schema.ts
git commit -m "feat(db): add inventory schema (products, movements, settings)"
```

---

## Task 3: Repository

**Files:**
- Create: `packages/database/src/repositories/inventory-repository.ts`

**Step 1: Create repository**

```typescript
// packages/database/src/repositories/inventory-repository.ts
import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   inventoryMovements,
   inventoryProducts,
   inventorySettings,
   type NewInventoryMovement,
   type NewInventoryProduct,
} from "../schema";

// =============================================================================
// Products
// =============================================================================

export async function listInventoryProducts(
   db: DatabaseInstance,
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

export async function getInventoryProduct(
   db: DatabaseInstance,
   id: string,
) {
   try {
      const [product] = await db
         .select()
         .from(inventoryProducts)
         .where(eq(inventoryProducts.id, id));
      return product ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get inventory product");
   }
}

export async function createInventoryProduct(
   db: DatabaseInstance,
   data: NewInventoryProduct,
) {
   try {
      const [product] = await db
         .insert(inventoryProducts)
         .values(data)
         .returning();
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create inventory product");
   }
}

export async function updateInventoryProduct(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewInventoryProduct>,
) {
   try {
      const [product] = await db
         .update(inventoryProducts)
         .set(data)
         .where(eq(inventoryProducts.id, id))
         .returning();
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update inventory product");
   }
}

export async function archiveInventoryProduct(
   db: DatabaseInstance,
   id: string,
) {
   try {
      const [product] = await db
         .update(inventoryProducts)
         .set({ archivedAt: new Date() })
         .where(eq(inventoryProducts.id, id))
         .returning();
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive inventory product");
   }
}

// =============================================================================
// Movements
// =============================================================================

export async function createInventoryMovement(
   db: DatabaseInstance,
   data: NewInventoryMovement,
) {
   try {
      const [movement] = await db
         .insert(inventoryMovements)
         .values(data)
         .returning();
      return movement;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create inventory movement");
   }
}

export async function listInventoryMovements(
   db: DatabaseInstance,
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

/**
 * Adjusts currentStock on the product.
 * purchase → add qty
 * sale / waste → subtract qty
 */
export async function adjustProductStock(
   db: DatabaseInstance,
   productId: string,
   type: "purchase" | "sale" | "waste",
   qty: number,
) {
   try {
      const delta = type === "purchase" ? qty : -qty;
      await db
         .update(inventoryProducts)
         .set({
            currentStock: sql`${inventoryProducts.currentStock} + ${delta}`,
         })
         .where(eq(inventoryProducts.id, productId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to adjust product stock");
   }
}

// =============================================================================
// Settings
// =============================================================================

export async function getInventorySettings(
   db: DatabaseInstance,
   teamId: string,
) {
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
   db: DatabaseInstance,
   teamId: string,
   data: Omit<typeof inventorySettings.$inferInsert, "teamId" | "createdAt" | "updatedAt">,
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

**Step 2: Commit**
```bash
git add packages/database/src/repositories/inventory-repository.ts
git commit -m "feat(db): add inventory repository"
```

---

## Task 4: oRPC Router

**Files:**
- Create: `apps/web/src/integrations/orpc/router/inventory.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

**Step 1: Create inventory router**

```typescript
// apps/web/src/integrations/orpc/router/inventory.ts
import { ORPCError } from "@orpc/server";
import {
   adjustProductStock,
   archiveInventoryProduct,
   createInventoryMovement,
   createInventoryProduct,
   getInventoryProduct,
   getInventorySettings,
   listInventoryMovements,
   listInventoryProducts,
   updateInventoryProduct,
   upsertInventorySettings,
} from "@packages/database/repositories/inventory-repository";
import { createTransaction } from "@packages/database/repositories/transactions-repository";
import {
   inventoryMovements,
   inventoryProducts,
   inventorySettings,
} from "@packages/database/schemas/inventory";
import { convert, of } from "@f-o-t/uom";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Converts purchasedQty (in purchaseUnit) to base units.
 * Tries @f-o-t/uom first; falls back to purchaseUnitFactor for custom units.
 */
function toBaseQty(
   purchasedQty: number,
   purchaseUnit: string,
   baseUnit: string,
   factor: number,
): number {
   if (purchaseUnit === baseUnit) return purchasedQty;
   try {
      // biome-ignore lint/suspicious/noExplicitAny: UOM unit symbols are dynamic
      const m = of(purchasedQty, purchaseUnit as any);
      // biome-ignore lint/suspicious/noExplicitAny: UOM unit symbols are dynamic
      const converted = convert(m, baseUnit as any);
      return Number(converted.value) / Math.pow(10, converted.scale);
   } catch {
      return purchasedQty * factor;
   }
}

// =============================================================================
// Validation Schemas
// =============================================================================

const productSchema = createInsertSchema(inventoryProducts).pick({
   name: true,
   description: true,
   baseUnit: true,
   purchaseUnit: true,
   purchaseUnitFactor: true,
   sellingPrice: true,
});

const movementSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("purchase"),
      productId: z.string().uuid(),
      purchasedQty: z.number().positive(),       // in purchaseUnit
      unitPrice: z.number().positive().optional(), // cost per baseUnit (auto-calc if totalAmount given)
      totalAmount: z.number().positive(),
      supplierId: z.string().uuid().optional(),
      date: z.string().date(),
      notes: z.string().optional(),
      bankAccountId: z.string().uuid().optional(),
      creditCardId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
   }),
   z.object({
      type: z.literal("sale"),
      productId: z.string().uuid(),
      qty: z.number().positive(),                // in baseUnit
      unitPrice: z.number().positive().optional(),
      totalAmount: z.number().positive(),
      date: z.string().date(),
      notes: z.string().optional(),
   }),
   z.object({
      type: z.literal("waste"),
      productId: z.string().uuid(),
      qty: z.number().positive(),                // in baseUnit
      date: z.string().date(),
      notes: z.string().optional(),
   }),
]);

const settingsSchema = createInsertSchema(inventorySettings).omit({
   teamId: true,
   createdAt: true,
   updatedAt: true,
});

// =============================================================================
// Products
// =============================================================================

export const getProducts = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listInventoryProducts(db, teamId);
});

export const createProduct = protectedProcedure
   .input(productSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createInventoryProduct(db, {
         teamId,
         name: input.name,
         description: input.description ?? null,
         baseUnit: input.baseUnit,
         purchaseUnit: input.purchaseUnit,
         purchaseUnitFactor: input.purchaseUnitFactor ?? "1",
         sellingPrice: input.sellingPrice ?? null,
      });
   });

export const updateProduct = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(productSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { id, ...data } = input;
      const product = await getInventoryProduct(db, id);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado." });
      }
      return updateInventoryProduct(db, id, data);
   });

export const archiveProduct = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const product = await getInventoryProduct(db, input.id);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado." });
      }
      return archiveInventoryProduct(db, input.id);
   });

// =============================================================================
// Movements
// =============================================================================

export const registerMovement = protectedProcedure
   .input(movementSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const product = await getInventoryProduct(db, input.productId);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado." });
      }

      const settings = await getInventorySettings(db, teamId);

      let transactionId: string | null = null;
      let baseQty: number;
      let unitPrice: number | undefined;

      // -----------------------------------------------------------------------
      // Resolve base qty and create transaction
      // -----------------------------------------------------------------------
      if (input.type === "purchase") {
         baseQty = toBaseQty(
            input.purchasedQty,
            product.purchaseUnit,
            product.baseUnit,
            Number(product.purchaseUnitFactor),
         );
         unitPrice = input.unitPrice ?? input.totalAmount / baseQty;

         // Auto-create expense transaction (non-fatal on error)
         try {
            const bankAccountId =
               input.bankAccountId ?? settings?.purchaseBankAccountId;
            if (bankAccountId) {
               const tx = await createTransaction(db, {
                  teamId,
                  type: "expense",
                  name: `Compra: ${product.name} - ${input.purchasedQty} ${product.purchaseUnit}`,
                  amount: String(input.totalAmount),
                  date: input.date,
                  bankAccountId,
                  creditCardId: input.creditCardId ?? settings?.purchaseCreditCardId ?? null,
                  categoryId: input.categoryId ?? settings?.purchaseCategoryId ?? null,
                  contactId: input.supplierId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            }
         } catch {
            // Transaction creation failure is non-fatal — inventory is source of truth
         }
      } else if (input.type === "sale") {
         baseQty = input.qty;
         unitPrice = input.unitPrice ?? input.totalAmount / baseQty;

         if (Number(product.currentStock) < baseQty) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Estoque insuficiente para registrar a venda.",
            });
         }

         try {
            const bankAccountId = settings?.purchaseBankAccountId;
            if (bankAccountId) {
               const tx = await createTransaction(db, {
                  teamId,
                  type: "income",
                  name: `Venda: ${product.name} - ${baseQty} ${product.baseUnit}`,
                  amount: String(input.totalAmount),
                  date: input.date,
                  bankAccountId,
                  categoryId: settings?.saleCategoryId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            }
         } catch {
            // non-fatal
         }
      } else {
         // waste
         baseQty = input.qty;

         if (Number(product.currentStock) < baseQty) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Estoque insuficiente para registrar o descarte.",
            });
         }

         // Waste creates an expense for the cost lost (no amount required from user)
         // Amount = qty * sellingPrice as proxy (or 0 if not set)
         const lossAmount = baseQty * Number(product.sellingPrice ?? 0);
         if (lossAmount > 0 && settings?.purchaseBankAccountId) {
            try {
               const tx = await createTransaction(db, {
                  teamId,
                  type: "expense",
                  name: `Desperdício: ${product.name} - ${baseQty} ${product.baseUnit}`,
                  amount: String(lossAmount),
                  date: input.date,
                  bankAccountId: settings.purchaseBankAccountId,
                  categoryId: settings?.wasteCategoryId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            } catch {
               // non-fatal
            }
         }
      }

      // -----------------------------------------------------------------------
      // Persist movement + update running stock total
      // -----------------------------------------------------------------------
      const [movement] = await Promise.all([
         createInventoryMovement(db, {
            teamId,
            productId: product.id,
            type: input.type,
            qty: String(baseQty),
            unitPrice: unitPrice != null ? String(unitPrice) : null,
            totalAmount:
               input.type !== "waste" ? String(input.totalAmount) : null,
            supplierId:
               input.type === "purchase" ? (input.supplierId ?? null) : null,
            transactionId,
            notes: input.notes ?? null,
            date: input.date,
         }),
         adjustProductStock(db, product.id, input.type, baseQty),
      ]);

      return movement;
   });

export const getMovements = protectedProcedure
   .input(z.object({ productId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listInventoryMovements(db, input.productId, teamId);
   });

// =============================================================================
// Settings
// =============================================================================

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return getInventorySettings(db, teamId);
});

export const upsertSettings = protectedProcedure
   .input(settingsSchema.partial())
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return upsertInventorySettings(db, teamId, input);
   });
```

**Step 2: Register in router index**

In `apps/web/src/integrations/orpc/router/index.ts`, add the import and registration.

After the last `import *` line, add:
```typescript
import * as inventoryRouter from "./inventory";
```

In the `export default { ... }` object, add:
```typescript
inventory: inventoryRouter,
```

**Step 3: Commit**
```bash
git add apps/web/src/integrations/orpc/router/inventory.ts apps/web/src/integrations/orpc/router/index.ts
git commit -m "feat(api): add inventory oRPC router"
```

---

## Task 5: Feature UI Files

**Files to create:**
- `apps/web/src/features/inventory/ui/inventory-product-columns.tsx`
- `apps/web/src/features/inventory/ui/inventory-product-card.tsx`
- `apps/web/src/features/inventory/ui/inventory-product-form.tsx`
- `apps/web/src/features/inventory/ui/inventory-movement-credenza.tsx`
- `apps/web/src/features/inventory/ui/inventory-history-sheet.tsx`

**Step 1: Product columns (table view)**

```typescript
// apps/web/src/features/inventory/ui/inventory-product-columns.tsx
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, History, MoreHorizontal, PackagePlus, Pencil } from "lucide-react";

export type InventoryProductRow = {
   id: string;
   name: string;
   description: string | null;
   baseUnit: string;
   purchaseUnit: string;
   currentStock: string;
   sellingPrice: string | null;
};

function StockBadge({ stock }: { stock: string }) {
   const value = Number(stock);
   const variant =
      value <= 0 ? "destructive" : value <= 5 ? "outline" : "secondary";
   return (
      <Badge variant={variant}>
         {value <= 0 ? "Sem estoque" : stock}
      </Badge>
   );
}

export function buildInventoryProductColumns(
   onRegisterMovement: (product: InventoryProductRow) => void,
   onViewHistory: (product: InventoryProductRow) => void,
   onEdit: (product: InventoryProductRow) => void,
   onArchive: (product: InventoryProductRow) => void,
): ColumnDef<InventoryProductRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Produto",
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "currentStock",
         header: "Estoque",
         cell: ({ row }) => (
            <div className="flex items-center gap-2">
               <StockBadge stock={row.original.currentStock} />
               <span className="text-muted-foreground text-xs">
                  {row.original.baseUnit}
               </span>
            </div>
         ),
      },
      {
         accessorKey: "sellingPrice",
         header: "Preço de venda",
         cell: ({ row }) => {
            if (!row.original.sellingPrice)
               return <span className="text-muted-foreground">—</span>;
            return (
               <span>
                  R$ {Number(row.original.sellingPrice).toFixed(2)}{" "}
                  <span className="text-muted-foreground text-xs">
                     /{row.original.baseUnit}
                  </span>
               </span>
            );
         },
      },
      {
         id: "actions",
         cell: ({ row }) => (
            <div className="flex items-center gap-1">
               <Button
                  onClick={() => onRegisterMovement(row.original)}
                  size="sm"
                  variant="outline"
               >
                  <PackagePlus className="size-3.5 mr-1" />
                  Movimento
               </Button>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button size="icon-sm" variant="ghost">
                        <MoreHorizontal className="size-4" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     <DropdownMenuItem onClick={() => onViewHistory(row.original)}>
                        <History className="size-4 mr-2" />
                        Ver histórico
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => onEdit(row.original)}>
                        <Pencil className="size-4 mr-2" />
                        Editar
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onArchive(row.original)}
                     >
                        <Archive className="size-4 mr-2" />
                        Arquivar
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
         ),
      },
   ];
}
```

**Step 2: Product card (card view)**

```typescript
// apps/web/src/features/inventory/ui/inventory-product-card.tsx
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { History, PackagePlus } from "lucide-react";
import type { InventoryProductRow } from "./inventory-product-columns";

interface InventoryProductCardProps {
   product: InventoryProductRow;
   onRegisterMovement: (product: InventoryProductRow) => void;
   onViewHistory: (product: InventoryProductRow) => void;
}

export function InventoryProductCard({
   product,
   onRegisterMovement,
   onViewHistory,
}: InventoryProductCardProps) {
   const stock = Number(product.currentStock);
   const stockColor =
      stock <= 0
         ? "bg-destructive"
         : stock <= 5
           ? "bg-yellow-400"
           : "bg-emerald-500";

   return (
      <Card>
         <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
               <CardTitle className="text-base">{product.name}</CardTitle>
               {stock <= 0 && (
                  <Badge variant="destructive" className="shrink-0">
                     Sem estoque
                  </Badge>
               )}
               {stock > 0 && stock <= 5 && (
                  <Badge variant="outline" className="shrink-0 border-yellow-400 text-yellow-600">
                     Estoque baixo
                  </Badge>
               )}
            </div>
         </CardHeader>
         <CardContent className="space-y-3">
            {/* Stock gauge */}
            <div className="space-y-1">
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estoque</span>
                  <span className="font-medium">
                     {product.currentStock} {product.baseUnit}
                  </span>
               </div>
               <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                     className={`h-full rounded-full transition-all ${stockColor}`}
                     style={{ width: `${Math.min(100, (stock / 20) * 100)}%` }}
                  />
               </div>
            </div>

            {product.sellingPrice && (
               <p className="text-xs text-muted-foreground">
                  Preço: R$ {Number(product.sellingPrice).toFixed(2)}/{product.baseUnit}
               </p>
            )}

            <div className="flex gap-2 pt-1">
               <Button
                  className="flex-1"
                  onClick={() => onRegisterMovement(product)}
                  size="sm"
               >
                  <PackagePlus className="size-3.5 mr-1" />
                  Movimento
               </Button>
               <Button
                  onClick={() => onViewHistory(product)}
                  size="icon-sm"
                  variant="outline"
               >
                  <History className="size-4" />
               </Button>
            </div>
         </CardContent>
      </Card>
   );
}
```

**Step 3: Product form**

```typescript
// apps/web/src/features/inventory/ui/inventory-product-form.tsx
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface InventoryProductFormProps {
   mode: "create" | "edit";
   defaultValues?: {
      id: string;
      name: string;
      description: string | null;
      baseUnit: string;
      purchaseUnit: string;
      purchaseUnitFactor: string;
      sellingPrice: string | null;
   };
   onSuccess: () => void;
}

export function InventoryProductForm({
   mode,
   defaultValues,
   onSuccess,
}: InventoryProductFormProps) {
   const createMutation = useMutation(
      orpc.inventory.createProduct.mutationOptions({
         onSuccess: () => {
            toast.success("Produto criado.");
            onSuccess();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const updateMutation = useMutation(
      orpc.inventory.updateProduct.mutationOptions({
         onSuccess: () => {
            toast.success("Produto atualizado.");
            onSuccess();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const isPending = createMutation.isPending || updateMutation.isPending;

   const handleSubmit = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         const payload = {
            name: String(data.get("name")),
            description: String(data.get("description")) || null,
            baseUnit: String(data.get("baseUnit")),
            purchaseUnit: String(data.get("purchaseUnit")),
            purchaseUnitFactor: String(data.get("purchaseUnitFactor") || "1"),
            sellingPrice: data.get("sellingPrice")
               ? String(data.get("sellingPrice"))
               : null,
         };
         if (mode === "create") {
            createMutation.mutate(payload);
         } else if (defaultValues?.id) {
            updateMutation.mutate({ id: defaultValues.id, ...payload });
         }
      },
      [mode, defaultValues, createMutation, updateMutation],
   );

   return (
      <form className="space-y-4" onSubmit={handleSubmit}>
         <div className="space-y-1.5">
            <Label htmlFor="name">Nome do produto</Label>
            <Input
               defaultValue={defaultValues?.name}
               id="name"
               name="name"
               placeholder="Ex: Picolé Morango"
               required
            />
         </div>

         <div className="space-y-1.5">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
               defaultValue={defaultValues?.description ?? ""}
               id="description"
               name="description"
               rows={2}
            />
         </div>

         <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
               <Label htmlFor="baseUnit">Unidade base</Label>
               <Input
                  defaultValue={defaultValues?.baseUnit ?? "un"}
                  id="baseUnit"
                  name="baseUnit"
                  placeholder="un, g, mL"
                  required
               />
            </div>
            <div className="space-y-1.5">
               <Label htmlFor="purchaseUnit">Unidade de compra</Label>
               <Input
                  defaultValue={defaultValues?.purchaseUnit ?? "caixa"}
                  id="purchaseUnit"
                  name="purchaseUnit"
                  placeholder="caixa, kg, L"
                  required
               />
            </div>
         </div>

         <div className="space-y-1.5">
            <Label htmlFor="purchaseUnitFactor">
               Fator de conversão (quantas unidades base por unidade de compra)
            </Label>
            <Input
               defaultValue={defaultValues?.purchaseUnitFactor ?? "1"}
               id="purchaseUnitFactor"
               min="0.0001"
               name="purchaseUnitFactor"
               placeholder="Ex: 12 (1 caixa = 12 un)"
               step="any"
               type="number"
            />
            <p className="text-xs text-muted-foreground">
               Para unidades padrão (kg→g, L→mL), a conversão é automática.
            </p>
         </div>

         <div className="space-y-1.5">
            <Label htmlFor="sellingPrice">Preço de venda (opcional)</Label>
            <Input
               defaultValue={defaultValues?.sellingPrice ?? ""}
               id="sellingPrice"
               min="0"
               name="sellingPrice"
               placeholder="0.00"
               step="0.01"
               type="number"
            />
         </div>

         <Button className="w-full" disabled={isPending} type="submit">
            {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
            {mode === "create" ? "Criar produto" : "Salvar alterações"}
         </Button>
      </form>
   );
}
```

**Step 4: Movement credenza (3 tabs)**

```typescript
// apps/web/src/features/inventory/ui/inventory-movement-credenza.tsx
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { InventoryProductRow } from "./inventory-product-columns";

interface InventoryMovementCredenzaProps {
   product: InventoryProductRow;
   onSuccess: () => void;
}

export function InventoryMovementCredenza({
   product,
   onSuccess,
}: InventoryMovementCredenzaProps) {
   const mutation = useMutation(
      orpc.inventory.registerMovement.mutationOptions({
         onSuccess: () => {
            toast.success("Movimento registrado.");
            onSuccess();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const today = new Date().toISOString().split("T")[0];

   const handlePurchase = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         mutation.mutate({
            type: "purchase",
            productId: product.id,
            purchasedQty: Number(data.get("purchasedQty")),
            totalAmount: Number(data.get("totalAmount")),
            date: String(data.get("date")),
            notes: String(data.get("notes") ?? "") || undefined,
         });
      },
      [mutation, product.id],
   );

   const handleSale = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         const qty = Number(data.get("qty"));
         const unitPrice = Number(data.get("unitPrice") ?? product.sellingPrice ?? 0);
         mutation.mutate({
            type: "sale",
            productId: product.id,
            qty,
            unitPrice,
            totalAmount: qty * unitPrice,
            date: String(data.get("date")),
            notes: String(data.get("notes") ?? "") || undefined,
         });
      },
      [mutation, product.id, product.sellingPrice],
   );

   const handleWaste = useCallback(
      (e: React.FormEvent<HTMLFormElement>) => {
         e.preventDefault();
         const form = e.currentTarget;
         const data = new FormData(form);
         mutation.mutate({
            type: "waste",
            productId: product.id,
            qty: Number(data.get("qty")),
            date: String(data.get("date")),
            notes: String(data.get("notes") ?? "") || undefined,
         });
      },
      [mutation, product.id],
   );

   return (
      <Tabs defaultValue="purchase">
         <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="purchase">Receber</TabsTrigger>
            <TabsTrigger className="flex-1" value="sale">Vender</TabsTrigger>
            <TabsTrigger className="flex-1" value="waste">Descartar</TabsTrigger>
         </TabsList>

         {/* Receive */}
         <TabsContent value="purchase">
            <form className="space-y-4 pt-2" onSubmit={handlePurchase}>
               <div className="space-y-1.5">
                  <Label>Quantidade ({product.purchaseUnit})</Label>
                  <Input min="0.001" name="purchasedQty" placeholder="Ex: 10" required step="any" type="number" />
               </div>
               <div className="space-y-1.5">
                  <Label>Custo total (R$)</Label>
                  <Input min="0.01" name="totalAmount" placeholder="0.00" required step="0.01" type="number" />
               </div>
               <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input defaultValue={today} name="date" required type="date" />
               </div>
               <div className="space-y-1.5">
                  <Label>Observações (opcional)</Label>
                  <Input name="notes" placeholder="Ex: Entrega do fornecedor" />
               </div>
               <Button className="w-full" disabled={mutation.isPending} type="submit">
                  {mutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Registrar recebimento
               </Button>
            </form>
         </TabsContent>

         {/* Sale */}
         <TabsContent value="sale">
            <form className="space-y-4 pt-2" onSubmit={handleSale}>
               <div className="space-y-1.5">
                  <Label>Quantidade ({product.baseUnit})</Label>
                  <Input min="0.001" name="qty" placeholder="Ex: 3" required step="any" type="number" />
               </div>
               <div className="space-y-1.5">
                  <Label>Preço por {product.baseUnit} (R$)</Label>
                  <Input
                     defaultValue={product.sellingPrice ?? ""}
                     min="0.01"
                     name="unitPrice"
                     placeholder="0.00"
                     step="0.01"
                     type="number"
                  />
               </div>
               <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input defaultValue={today} name="date" required type="date" />
               </div>
               <div className="space-y-1.5">
                  <Label>Observações (opcional)</Label>
                  <Input name="notes" />
               </div>
               <Button className="w-full" disabled={mutation.isPending} type="submit">
                  {mutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Registrar venda
               </Button>
            </form>
         </TabsContent>

         {/* Waste */}
         <TabsContent value="waste">
            <form className="space-y-4 pt-2" onSubmit={handleWaste}>
               <div className="space-y-1.5">
                  <Label>Quantidade ({product.baseUnit})</Label>
                  <Input min="0.001" name="qty" placeholder="Ex: 2" required step="any" type="number" />
               </div>
               <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input defaultValue={today} name="date" required type="date" />
               </div>
               <div className="space-y-1.5">
                  <Label>Observações (opcional)</Label>
                  <Input name="notes" placeholder="Ex: Vencido" />
               </div>
               <Button className="w-full" disabled={mutation.isPending} type="submit" variant="destructive">
                  {mutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Registrar descarte
               </Button>
            </form>
         </TabsContent>
      </Tabs>
   );
}
```

**Step 5: History sheet**

```typescript
// apps/web/src/features/inventory/ui/inventory-history-sheet.tsx
import { Badge } from "@packages/ui/components/badge";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { orpc } from "@/integrations/orpc/client";
import type { InventoryProductRow } from "./inventory-product-columns";

const TYPE_LABELS = {
   purchase: "Compra",
   sale: "Venda",
   waste: "Descarte",
} as const;

const TYPE_VARIANTS = {
   purchase: "secondary",
   sale: "default",
   waste: "destructive",
} as const;

function HistoryList({ product }: { product: InventoryProductRow }) {
   const { data: movements } = useSuspenseQuery(
      orpc.inventory.getMovements.queryOptions({
         input: { productId: product.id },
      }),
   );

   if (!movements.length) {
      return (
         <p className="text-muted-foreground text-sm py-8 text-center">
            Nenhum movimento registrado.
         </p>
      );
   }

   return (
      <ul className="space-y-3">
         {movements.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
               <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                     <Badge variant={TYPE_VARIANTS[m.type]}>
                        {TYPE_LABELS[m.type]}
                     </Badge>
                     <span className="text-sm font-medium">
                        {m.qty} {product.baseUnit}
                     </span>
                  </div>
                  {m.notes && (
                     <p className="text-xs text-muted-foreground">{m.notes}</p>
                  )}
               </div>
               <div className="text-right shrink-0">
                  {m.totalAmount && (
                     <p className="text-sm font-medium">
                        R$ {Number(m.totalAmount).toFixed(2)}
                     </p>
                  )}
                  <p className="text-xs text-muted-foreground">{m.date}</p>
               </div>
            </li>
         ))}
      </ul>
   );
}

interface InventoryHistorySheetProps {
   product: InventoryProductRow;
}

export function InventoryHistorySheet({ product }: InventoryHistorySheetProps) {
   return (
      <div className="space-y-4">
         <p className="text-muted-foreground text-sm">
            Histórico de movimentos de <strong>{product.name}</strong>.
         </p>
         <Suspense
            fallback={
               <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                     <Skeleton className="h-12 w-full" key={`skel-${i + 1}`} />
                  ))}
               </div>
            }
         >
            <HistoryList product={product} />
         </Suspense>
      </div>
   );
}
```

**Step 6: Commit**
```bash
git add apps/web/src/features/inventory/
git commit -m "feat(ui): add inventory feature components"
```

---

## Task 6: Route Page + Sidebar Nav

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`
- Modify: `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

**Step 1: Create route page**

```typescript
// apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, LayoutList, Package, Plus } from "lucide-react";
import { Suspense, useCallback } from "react";
import { DefaultHeader } from "@/components/default-header";
import { InventoryHistorySheet } from "@/features/inventory/ui/inventory-history-sheet";
import { InventoryMovementCredenza } from "@/features/inventory/ui/inventory-movement-credenza";
import {
   buildInventoryProductColumns,
   type InventoryProductRow,
} from "@/features/inventory/ui/inventory-product-columns";
import { InventoryProductCard } from "@/features/inventory/ui/inventory-product-card";
import { InventoryProductForm } from "@/features/inventory/ui/inventory-product-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/inventory/",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.inventory.getProducts.queryOptions({}),
      );
   },
   component: InventoryPage,
});

const INVENTORY_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// =============================================================================
// Skeleton
// =============================================================================

function InventorySkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton className="h-12 w-full" key={`skel-${i + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

function InventoryList({ view }: { view: "table" | "card" }) {
   const { data: products } = useSuspenseQuery(
      orpc.inventory.getProducts.queryOptions({}),
   );

   const { openCredenza, closeCredenza } = useCredenza();
   const { openSheet, closeSheet } = useSheet();
   const { openAlertDialog } = useAlertDialog();

   const archiveMutation = useMutation(
      orpc.inventory.archiveProduct.mutationOptions({
         onSuccess: () => toast.success("Produto arquivado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleMovement = useCallback(
      (product: InventoryProductRow) => {
         openCredenza({
            title: product.name,
            children: (
               <InventoryMovementCredenza
                  product={product}
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleHistory = useCallback(
      (product: InventoryProductRow) => {
         openSheet({
            title: `Histórico — ${product.name}`,
            children: <InventoryHistorySheet product={product} />,
         });
      },
      [openSheet],
   );

   const handleEdit = useCallback(
      (product: InventoryProductRow) => {
         openSheet({
            title: "Editar produto",
            children: (
               <InventoryProductForm
                  mode="edit"
                  defaultValues={{
                     id: product.id,
                     name: product.name,
                     description: product.description,
                     baseUnit: product.baseUnit,
                     purchaseUnit: product.purchaseUnit,
                     purchaseUnitFactor: "1",
                     sellingPrice: product.sellingPrice,
                  }}
                  onSuccess={closeSheet}
               />
            ),
         });
      },
      [openSheet, closeSheet],
   );

   const handleArchive = useCallback(
      (product: InventoryProductRow) => {
         openAlertDialog({
            title: "Arquivar produto?",
            description: `"${product.name}" será arquivado e ficará oculto da lista.`,
            onAction: () => archiveMutation.mutate({ id: product.id }),
         });
      },
      [openAlertDialog, archiveMutation],
   );

   if (!products.length) {
      return (
         <Empty>
            <EmptyMedia>
               <Package className="size-10" />
            </EmptyMedia>
            <EmptyHeader>
               <EmptyTitle>Nenhum produto cadastrado</EmptyTitle>
               <EmptyDescription>
                  Adicione produtos para começar a controlar o estoque.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
               <InventoryProductCard
                  key={product.id}
                  product={product as InventoryProductRow}
                  onRegisterMovement={handleMovement}
                  onViewHistory={handleHistory}
               />
            ))}
         </div>
      );
   }

   const columns = buildInventoryProductColumns(
      handleMovement,
      handleHistory,
      handleEdit,
      handleArchive,
   );

   return <DataTable columns={columns} data={products as InventoryProductRow[]} />;
}

// =============================================================================
// Page
// =============================================================================

function InventoryPage() {
   const { openSheet, closeSheet } = useSheet();
   const { currentView, setView, views } = useViewSwitch(
      "inventory:products:view",
      INVENTORY_VIEWS,
   );

   const handleCreate = useCallback(() => {
      openSheet({
         title: "Novo produto",
         children: <InventoryProductForm mode="create" onSuccess={closeSheet} />,
      });
   }, [openSheet, closeSheet]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Novo Produto
               </Button>
            }
            description="Controle de estoque e movimentações"
            title="Estoque"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />
         <Suspense fallback={<InventorySkeleton />}>
            <InventoryList view={currentView} />
         </Suspense>
      </main>
   );
}
```

**Step 2: Add sidebar nav item**

In `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`, add the `Package` import and a new nav group (or add to an existing group). Add `Package` to the lucide imports, then add a new group:

```typescript
import { ..., Package } from "lucide-react";
```

Add after the `finance` group in `navGroups`:
```typescript
{
   id: "inventory",
   label: "Estoque",
   items: [
      {
         id: "inventory",
         label: "Produtos",
         icon: Package,
         route: "/$slug/$teamSlug/inventory",
         quickAction: { type: "create", target: "sheet" },
         configurable: true,
      },
   ],
},
```

**Step 3: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/ apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts
git commit -m "feat(web): add inventory route and sidebar nav"
```

---

## Task 7: Inventory Settings Page

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/inventory.tsx`

**Step 1: Create settings page**

```typescript
// apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/inventory.tsx
import { Button } from "@packages/ui/components/button";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/inventory",
)({
   component: InventorySettingsPage,
});

function InventorySettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.inventory.getSettings.queryOptions({}),
   );
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const { data: creditCards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
   );

   const [form, setForm] = useState({
      purchaseBankAccountId: settings?.purchaseBankAccountId ?? "",
      purchaseCreditCardId: settings?.purchaseCreditCardId ?? "",
      purchaseCategoryId: settings?.purchaseCategoryId ?? "",
      saleCategoryId: settings?.saleCategoryId ?? "",
      wasteCategoryId: settings?.wasteCategoryId ?? "",
   });

   const mutation = useMutation(
      orpc.inventory.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleSave = useCallback(() => {
      mutation.mutate({
         purchaseBankAccountId: form.purchaseBankAccountId || null,
         purchaseCreditCardId: form.purchaseCreditCardId || null,
         purchaseCategoryId: form.purchaseCategoryId || null,
         saleCategoryId: form.saleCategoryId || null,
         wasteCategoryId: form.wasteCategoryId || null,
      });
   }, [mutation, form]);

   const expenseCategories = categories.filter(
      (c) => c.type === "expense" || c.type === null,
   );
   const incomeCategories = categories.filter(
      (c) => c.type === "income" || c.type === null,
   );

   return (
      <div className="space-y-6 max-w-lg">
         <div>
            <h3 className="text-lg font-medium">Estoque</h3>
            <p className="text-sm text-muted-foreground">
               Defina os padrões para transações criadas automaticamente ao
               registrar movimentos de estoque.
            </p>
         </div>

         <div className="space-y-4">
            <div className="space-y-1.5">
               <Label>Conta bancária padrão (compras)</Label>
               <Select
                  value={form.purchaseBankAccountId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, purchaseBankAccountId: v }))
                  }
               >
                  <SelectTrigger>
                     <SelectValue placeholder="Selecionar conta…" />
                  </SelectTrigger>
                  <SelectContent>
                     {bankAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                           {a.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="space-y-1.5">
               <Label>Cartão de crédito padrão (compras)</Label>
               <Select
                  value={form.purchaseCreditCardId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, purchaseCreditCardId: v }))
                  }
               >
                  <SelectTrigger>
                     <SelectValue placeholder="Selecionar cartão…" />
                  </SelectTrigger>
                  <SelectContent>
                     {creditCards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                           {c.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="space-y-1.5">
               <Label>Categoria para compras</Label>
               <Select
                  value={form.purchaseCategoryId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, purchaseCategoryId: v }))
                  }
               >
                  <SelectTrigger>
                     <SelectValue placeholder="Selecionar categoria…" />
                  </SelectTrigger>
                  <SelectContent>
                     {expenseCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                           {c.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="space-y-1.5">
               <Label>Categoria para vendas</Label>
               <Select
                  value={form.saleCategoryId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, saleCategoryId: v }))
                  }
               >
                  <SelectTrigger>
                     <SelectValue placeholder="Selecionar categoria…" />
                  </SelectTrigger>
                  <SelectContent>
                     {incomeCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                           {c.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="space-y-1.5">
               <Label>Categoria para descartes</Label>
               <Select
                  value={form.wasteCategoryId}
                  onValueChange={(v) =>
                     setForm((f) => ({ ...f, wasteCategoryId: v }))
                  }
               >
                  <SelectTrigger>
                     <SelectValue placeholder="Selecionar categoria…" />
                  </SelectTrigger>
                  <SelectContent>
                     {expenseCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                           {c.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>
         </div>

         <Button disabled={mutation.isPending} onClick={handleSave}>
            {mutation.isPending && (
               <Loader2 className="size-4 mr-2 animate-spin" />
            )}
            Salvar configurações
         </Button>
      </div>
   );
}

function InventorySettingsPage() {
   return (
      <Suspense
         fallback={
            <div className="space-y-4 max-w-lg">
               {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton className="h-10 w-full" key={`skel-${i + 1}`} />
               ))}
            </div>
         }
      >
         <InventorySettingsForm />
      </Suspense>
   );
}
```

**Step 2: Add to project settings nav** (check `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/general.tsx` or the settings layout for how sub-nav items are registered — follow the same pattern used for other project settings pages).

**Step 3: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/project/inventory.tsx
git commit -m "feat(settings): add inventory settings page"
```

---

## Done ✓

After all tasks, test manually:

1. Navigate to **Estoque** in sidebar
2. Create a product (e.g., "Picolé Morango", base unit: `un`, purchase unit: `caixa`, factor: `12`)
3. Register a **Receive** movement (10 caixas, R$ 50.00) → verify transaction created in Finanças
4. Register a **Sale** (5 un) → verify income transaction created
5. Register a **Waste** (2 un) → verify expense transaction created
6. Switch between table and card views
7. Expand history from the `[···]` dropdown in table view
8. Open Settings → Estoque and configure defaults
