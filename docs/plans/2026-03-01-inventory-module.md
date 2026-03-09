# Inventory Module (Controle de Estoque)

**Date:** 2026-03-01
**Status:** Draft
**Stage:** Alpha (feature flag: `inventory`)
**Library:** `@f-o-t/uom` — quantity formatting + unit validation

---

## Summary

A single-page inventory module. Users manage a product catalog with stock levels. Each product row in the DataTable has a "Registrar Movimentação" action that opens a credenza. A dedicated inventory dashboard (seeded on team creation) shows KPI tiles and movement charts powered by direct DB queries — no changes to the finance analytics engine.

---

## Design Decisions

- **One page** — `/inventory` shows all products + current stock. No separate movements page.
- **Movements accessible via row action** — opens a credenza for registration. Expandable row shows the last 5 movements.
- **Single router file** — `inventory.ts` covers products + categories + movement registration.
- **Current stock** — computed from `SUM(signed_quantity)` in `inventory_movements`. No balance column.
- **Movement quantity** — stored as signed numeric: positive for entries (`entrada`, `devolucao`, `ajuste_positivo`), negative for exits (`saida`, `ajuste_negativo`, `perda`).
- **Unit of Measure** — `@f-o-t/uom` used on the frontend for display (`format(of(qty, unit))`) and unit picker. `"un"`, `"cx"`, `"pct"` registered as custom units at app startup.
- **Finance integration** — movement creation can either link an existing transaction (optional FK) or auto-create a `despesa`/`receita` transaction.
- **Dashboard** — a separate default dashboard with inventory-specific insights seeded via `seed-default-dashboard.ts`. Powered by dedicated oRPC queries, not the finance analytics engine.

---

## Step 1 — Install `@f-o-t/uom`

**Root `package.json`** — add to `"fot"` catalog:

```json
"@f-o-t/uom": "1.0.6"
```

**`apps/web/package.json`** — add to dependencies:

```json
"@f-o-t/uom": "catalog:fot"
```

Run `bun install`.

**Register custom units at app startup** in `apps/web/src/main.tsx`:

```typescript
import { registerUnit } from "@f-o-t/uom";

for (const def of [
   {
      symbol: "un",
      name: "Unidade",
      category: "count",
      toBaseMultiplier: 1000000000000n,
   },
   {
      symbol: "cx",
      name: "Caixa",
      category: "count",
      toBaseMultiplier: 1000000000000n,
   },
   {
      symbol: "pct",
      name: "Pacote",
      category: "count",
      toBaseMultiplier: 1000000000000n,
   },
]) {
   registerUnit(def);
}
```

---

## Step 2 — Database Schema

**File:** `packages/database/src/schemas/inventory.ts`

```typescript
import { sql } from "drizzle-orm";
import {
   index,
   integer,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { transactions } from "./transactions";

// ─── Categories ──────────────────────────────────────────────────────────────

export const inventoryCategories = pgTable(
   "inventory_categories",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull().default("#6b7280"),
      icon: text("icon"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (t) => [
      index("inv_categories_team_idx").on(t.teamId),
      uniqueIndex("inv_categories_name_unique").on(t.teamId, t.name),
   ],
);

// ─── Products ────────────────────────────────────────────────────────────────

export const inventoryProducts = pgTable(
   "inventory_products",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      categoryId: uuid("category_id").references(() => inventoryCategories.id, {
         onDelete: "set null",
      }),
      name: text("name").notNull(),
      sku: text("sku"),
      description: text("description"),
      unit: text("unit").notNull().default("un"), // UnitSymbol: "kg", "L", "un", etc.
      costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
      salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
      minStock: numeric("min_stock", { precision: 15, scale: 6 })
         .notNull()
         .default("0"),
      isActive: integer("is_active").notNull().default(1),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (t) => [
      index("inv_products_team_idx").on(t.teamId),
      uniqueIndex("inv_products_sku_unique").on(t.teamId, t.sku),
   ],
);

// ─── Movements ───────────────────────────────────────────────────────────────

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
   "entrada",
   "saida",
   "ajuste_positivo",
   "ajuste_negativo",
   "devolucao",
   "perda",
]);

export const inventoryMovements = pgTable(
   "inventory_movements",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      productId: uuid("product_id")
         .notNull()
         .references(() => inventoryProducts.id, { onDelete: "cascade" }),
      type: inventoryMovementTypeEnum("type").notNull(),
      quantity: numeric("quantity", { precision: 15, scale: 6 }).notNull(), // signed: positive=in, negative=out
      unit: text("unit").notNull(),
      unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
      transactionId: uuid("transaction_id").references(() => transactions.id, {
         onDelete: "set null",
      }),
      notes: text("notes"),
      date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (t) => [
      index("inv_movements_team_idx").on(t.teamId),
      index("inv_movements_product_idx").on(t.productId),
      index("inv_movements_date_idx").on(t.date),
   ],
);

export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type NewInventoryCategory = typeof inventoryCategories.$inferInsert;
export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type NewInventoryProduct = typeof inventoryProducts.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
```

Register in `packages/database/src/schema.ts`.

---

## Step 3 — Repository

**File:** `packages/database/src/repositories/inventory-repository.ts`

```typescript
// ProductWithStock: InventoryProduct + { currentStock: number; lowStock: boolean; category: InventoryCategory | null }
// currentStock = SUM of signed quantity from movements
// lowStock = currentStock <= minStock

export async function listInventoryProducts(db, { teamId, search?, categoryId? }): Promise<ProductWithStock[]>
export async function getInventoryProduct(db, { id, teamId }): Promise<ProductWithStock | null>
export async function createInventoryProduct(db, data: NewInventoryProduct): Promise<InventoryProduct>
export async function updateInventoryProduct(db, { id, teamId }, data): Promise<InventoryProduct>
export async function deleteInventoryProduct(db, { id, teamId }): Promise<void>

export async function listInventoryCategories(db, { teamId }): Promise<InventoryCategory[]>
export async function createInventoryCategory(db, data: NewInventoryCategory): Promise<InventoryCategory>
export async function updateInventoryCategory(db, { id, teamId }, data): Promise<InventoryCategory>
export async function deleteInventoryCategory(db, { id, teamId }): Promise<void>

export async function listProductMovements(db, { teamId, productId, limit? }): Promise<InventoryMovement[]>
export async function createInventoryMovement(db, data: NewInventoryMovement): Promise<InventoryMovement>
export async function deleteInventoryMovement(db, { id, teamId }): Promise<void>

// Dashboard queries
export async function getInventoryStats(db, { teamId }): Promise<{
  totalProducts: number;
  lowStockCount: number;
  totalMovementsThisMonth: number;
}>
export async function getMovementChart(db, { teamId, months?: number }): Promise<
  { month: string; entradas: number; saidas: number }[]
>
export async function getTopProductsByMovement(db, { teamId, limit?: number }): Promise<
  { product: InventoryProduct; movementCount: number }[]
>
```

---

## Step 4 — oRPC Router

**File:** `apps/web/src/integrations/orpc/router/inventory.ts`

One file, procedures grouped by concern:

```typescript
// ── Products ──────────────────────────────────────────────────────────────────
export const getProducts = protectedProcedure
  .input(z.object({ search: z.string().optional(), categoryId: z.string().uuid().optional() }))
  .handler(...)

export const createProduct = protectedProcedure
  .input(z.object({
    name: z.string().min(1),
    sku: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().min(1),
    categoryId: z.string().uuid().optional(),
    costPrice: z.string().optional(),
    salePrice: z.string().optional(),
    minStock: z.string().optional().default("0"),
  }))
  .handler(...)

export const updateProduct = protectedProcedure.input(...).handler(...)
export const removeProduct = protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(...)

// ── Categories ────────────────────────────────────────────────────────────────
export const getCategories = protectedProcedure.handler(...)
export const createCategory = protectedProcedure.input(...).handler(...)
export const updateCategory = protectedProcedure.input(...).handler(...)
export const removeCategory = protectedProcedure.input(...).handler(...)

// ── Movements ─────────────────────────────────────────────────────────────────
export const getProductMovements = protectedProcedure
  .input(z.object({ productId: z.string().uuid(), limit: z.number().int().optional() }))
  .handler(...)

export const registerMovement = protectedProcedure
  .input(z.object({
    productId: z.string().uuid(),
    type: z.enum(["entrada", "saida", "ajuste_positivo", "ajuste_negativo", "devolucao", "perda"]),
    quantity: z.string().min(1),      // always positive string — sign derived from type
    unitCost: z.string().optional(),
    notes: z.string().optional(),
    date: z.string().optional(),
    transactionId: z.string().uuid().optional(),
    createTransaction: z.boolean().optional(),  // auto-create a finance transaction
  }))
  .handler(async ({ context, input }) => {
    const POSITIVE = ["entrada", "devolucao", "ajuste_positivo"];
    const sign = POSITIVE.includes(input.type) ? 1 : -1;
    const signedQty = (parseFloat(input.quantity) * sign).toString();

    let transactionId = input.transactionId;
    if (input.createTransaction && input.unitCost) {
      // Create a transaction with type = "expense" for entries, "income" for exits
      // ... insert transaction, capture ID
    }

    return createInventoryMovement(context.db, {
      teamId: context.teamId,
      ...input,
      quantity: signedQty,
      transactionId,
    });
  })

export const deleteMovement = protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(...)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats = protectedProcedure.handler(...)
export const getMovementChart = protectedProcedure
  .input(z.object({ months: z.number().int().min(1).max(12).optional() }))
  .handler(...)
export const getTopProducts = protectedProcedure
  .input(z.object({ limit: z.number().int().optional() }))
  .handler(...)
```

**Register in `apps/web/src/integrations/orpc/router/index.ts`:**

```typescript
import * as inventory from "./inventory";
export const router = { ...existing, inventory };
```

---

## Step 5 — UI Components

```
apps/web/src/features/inventory/
├── hooks/
│   └── use-uom-units.ts           # getAllUnits() grouped by category for the unit combobox
├── ui/
│   ├── inventory-product-form.tsx # Sheet: create/edit product
│   ├── inventory-product-card.tsx # Mobile card renderer
│   ├── inventory-columns.tsx      # DataTable columns + row actions
│   ├── inventory-movement-credenza.tsx  # Register movement credenza
│   └── inventory-movement-list.tsx     # Expandable row: last 5 movements
```

### `use-uom-units.ts`

```typescript
import { getAllUnits, type UnitDefinition } from "@f-o-t/uom";

export function useUomUnits(): UnitDefinition[] {
   return getAllUnits();
}
```

### `inventory-columns.tsx`

Columns: Name, SKU, Category (badge), Unit, Current Stock (`format(of(qty, unit))`), Cost/Sale Price, Status (low-stock badge), Actions.

Row actions:

- **Registrar Movimentação** → opens `InventoryMovementCredenza`
- **Editar** → opens `InventoryProductForm` sheet in edit mode
- **Arquivar / Excluir** → `useAlertDialog`

Expandable row (`renderSubComponent`): `<InventoryMovementList productId={row.id} />`

### `inventory-movement-credenza.tsx`

Fields:

- **Tipo** — Select: Entrada / Saída / Ajuste+ / Ajuste− / Devolução / Perda (grouped as "Entradas" / "Saídas")
- **Quantidade** — Number input (unit shown as suffix, e.g. "kg")
- **Custo unitário** — MoneyInput (optional)
- **Data** — DatePicker
- **Notas** — Textarea
- **Transação** — Toggle group: "Nenhuma" | "Vincular existente" | "Criar automático"
   - "Vincular existente" → transaction Combobox
   - "Criar automático" → shows estimated transaction type and description

Uses `useCredenza` global hook.

### `inventory-product-form.tsx`

Fields: Name, SKU, Description, Unit (Combobox from `useUomUnits()` grouped by category), Category (Combobox), Cost Price, Sale Price, Min Stock.

Uses `useSheet` global hook.

---

## Step 6 — Route

**File:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`

```
<DefaultHeader
  title="Inventário"
  description="Gerencie produtos e controle de estoque"
  actions={<Button onClick={openCreateProduct}><Plus /> Novo Produto</Button>}
/>

{/* Optional category filter + search */}
<div className="flex gap-2 mb-4">
  <Input placeholder="Buscar produto..." ... />
  <CategoryFilter ... />
</div>

<Suspense fallback={<Skeleton />}>
  <InventoryTable />
</Suspense>
```

Loader prefetches `orpc.inventory.getProducts` and `orpc.inventory.getCategories`.

---

## Step 7 — Dashboard Integration

Add inventory insights to the default dashboard seed. The inventory dashboard uses dedicated oRPC queries (`getDashboardStats`, `getMovementChart`, `getTopProducts`) rendered as static tiles on the existing dashboard page.

**Option A (simpler for alpha):** Extend the seed script to create a new default dashboard named "Estoque" when a team has the `inventory` flag. Tiles are rendered via existing `DashboardTile` components with a new `source: "inventory"` property.

**Option B:** Add inventory insight types to `DEFAULT_INSIGHTS` so they appear in the existing finance dashboard.

→ **Go with Option A** for clean separation. When the user enables inventory, they get a dedicated "Estoque" dashboard.

Details: extend `packages/database/src/default-insights.ts` with `INVENTORY_DEFAULT_INSIGHTS` array (kpi tiles: total products, low stock count, total movements; chart: entries vs exits last 6 months; list: top 5 products by movement).

The seed script and the "create team" flow both check for the `inventory` feature flag before seeding the inventory dashboard.

---

## Step 8 — Sidebar + Early Access

### Sidebar

**File:** `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`

Add new group:

```typescript
{
  id: "inventory",
  label: "Inventário",
  items: [
    {
      id: "inventory",
      label: "Produtos",
      icon: Package,
      route: "/$slug/$teamSlug/inventory",
      earlyAccessFlag: "inventory",
    },
  ],
},
```

### Billing overview

**File:** `apps/web/src/features/billing/ui/billing-overview.tsx`

Add to `VOLUME_FEATURE_CONFIG`:

```typescript
inventory: {
  label: "Inventário",
  description: "Controle de estoque com unidades de medida",
  icon: <Package className="size-5" />,
  priceLabel: "Alpha",
  unit: "acesso gratuito",
  fallbackStage: "alpha",
},
```

### PostHog

Create early access feature flag `inventory` with stage `alpha` in PostHog. This gates the sidebar item and billing card.

---

## File Checklist

| File                                                                 | Action                                           |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| `package.json` (root)                                                | Edit — add `@f-o-t/uom: 1.0.6` to fot catalog    |
| `apps/web/package.json`                                              | Edit — add `@f-o-t/uom: catalog:fot`             |
| `apps/web/src/main.tsx`                                              | Edit — register `un`, `cx`, `pct` custom units   |
| `packages/database/src/schemas/inventory.ts`                         | Create                                           |
| `packages/database/src/schema.ts`                                    | Edit — export inventory schema                   |
| `packages/database/src/repositories/inventory-repository.ts`         | Create                                           |
| `apps/web/src/integrations/orpc/router/inventory.ts`                 | Create                                           |
| `apps/web/src/integrations/orpc/router/index.ts`                     | Edit — register `inventory`                      |
| `apps/web/src/features/inventory/hooks/use-uom-units.ts`             | Create                                           |
| `apps/web/src/features/inventory/ui/inventory-product-form.tsx`      | Create                                           |
| `apps/web/src/features/inventory/ui/inventory-product-card.tsx`      | Create                                           |
| `apps/web/src/features/inventory/ui/inventory-columns.tsx`           | Create                                           |
| `apps/web/src/features/inventory/ui/inventory-movement-credenza.tsx` | Create                                           |
| `apps/web/src/features/inventory/ui/inventory-movement-list.tsx`     | Create                                           |
| `apps/web/src/routes/.../inventory/index.tsx`                        | Create                                           |
| `apps/web/src/layout/dashboard/ui/sidebar-nav-items.ts`              | Edit — add Inventário group                      |
| `apps/web/src/features/billing/ui/billing-overview.tsx`              | Edit — add to VOLUME_FEATURE_CONFIG              |
| `packages/database/src/default-insights.ts`                          | Edit — add INVENTORY_DEFAULT_INSIGHTS            |
| `scripts/seed-default-dashboard.ts`                                  | Edit — seed inventory dashboard when flag active |

---

## Out of Scope (alpha)

- Multi-location / warehouse
- Purchase orders (PO)
- Supplier link (pending contacts module)
- Stock valuation (FIFO/LIFO/average cost)
- Low-stock email/push alerts
- Batch CSV import
- Barcode scanning
