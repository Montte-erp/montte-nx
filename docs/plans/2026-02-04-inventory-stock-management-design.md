# Inventory & Stock Management

## Overview

Add inventory/stock management capabilities to the finance tracker. Covers product resale tracking, asset inventory, raw material tracking, and a general stock ledger. Uses `@f-o-t/money` for precise monetary calculations and `@f-o-t/uom` for unit-of-measurement handling.

### Key decisions

- **Stock movements are separate from transactions** but optionally linkable via FK
- **Multiple UoM per item** with conversion factors (e.g. 1 box = 12 units)
- **Both FIFO and weighted average** valuation, configurable per item
- **Single stock pool** per organization (no multi-location)
- **Flat items** only (no variants)
- **Counterparty integration** — supplier/client pricing catalog, per-movement counterparty tracking, default supplier per item

---

## Data Model

### `inventory_item`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `organization_id` | uuid FK → organization | cascade delete |
| `name` | text | required |
| `description` | text | optional |
| `sku` | text | optional, unique per org |
| `type` | text | `"product"` / `"material"` / `"asset"` |
| `base_unit` | text | UoM unit code from `@f-o-t/uom` (e.g. `"kg"`, `"unit"`) |
| `base_unit_scale` | integer | decimal precision for the base unit |
| `valuation_method` | text | `"fifo"` / `"weighted_average"` |
| `currency` | text | ISO 4217 code |
| `reorder_point` | text | nullable, quantity as string (BigInt-safe) |
| `default_counterparty_id` | uuid FK → counterparty | nullable, set null on delete. Preferred supplier. |
| `search_index` | text | for search |
| `created_at` | timestamp | `defaultNow()` |
| `updated_at` | timestamp | `defaultNow()`, `$onUpdate` |

Indexes: `organization_id`, `search_index`.

### `inventory_item_uom`

Alternate UoM conversions per item.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `inventory_item_id` | uuid FK → inventory_item | cascade delete |
| `unit` | text | alternate unit code (e.g. `"box"`) |
| `conversion_factor` | text | how many base units = 1 of this unit (e.g. `"12"`) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `stock_movement`

Every stock in/out/adjustment.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organization_id` | uuid FK → organization | cascade delete |
| `inventory_item_id` | uuid FK → inventory_item | cascade delete |
| `type` | text | `"in"` / `"out"` / `"adjustment"` |
| `reason` | text | `"purchase"` / `"sale"` / `"return"` / `"damage"` / `"correction"` / `"production"` |
| `quantity` | text | BigInt-safe string in base unit |
| `unit_cost` | text | cost per base unit, minor units (BigInt-safe) |
| `currency` | text | ISO 4217 |
| `counterparty_id` | uuid FK → counterparty | nullable, set null on delete |
| `transaction_id` | uuid FK → transaction | nullable, set null on delete |
| `notes` | text | optional |
| `date` | timestamp | when the movement occurred |
| `search_index` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Indexes: `organization_id`, `inventory_item_id`, `search_index`.

### `stock_lot`

FIFO tracking — one row per incoming batch.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `inventory_item_id` | uuid FK → inventory_item | cascade delete |
| `remaining_quantity` | text | BigInt-safe, decremented on outflows |
| `unit_cost` | text | cost per unit for this lot (minor units) |
| `currency` | text | ISO 4217 |
| `date` | timestamp | lot acquisition date |
| `stock_movement_id` | uuid FK → stock_movement | the inflow that created this lot |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `inventory_item_counterparty`

Supplier/client pricing catalog per item.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `inventory_item_id` | uuid FK → inventory_item | cascade delete |
| `counterparty_id` | uuid FK → counterparty | cascade delete |
| `role` | text | `"supplier"` / `"client"` |
| `unit_price` | text | BigInt-safe, price per base unit (minor units) |
| `currency` | text | ISO 4217 |
| `min_order_quantity` | text | nullable, minimum order in base unit |
| `lead_time_days` | integer | nullable |
| `notes` | text | optional |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Relation updates

- `counterparty` gains `inventoryItems: many(inventoryItemCounterparty)` and `stockMovements: many(stockMovement)`
- `transaction` gains `stockMovements: many(stockMovement)`

---

## Library Integration

### `@f-o-t/money`

All monetary values stored as minor unit strings. Service layer converts to/from `Money` objects:

```typescript
import { of, toDatabase, fromDatabase, multiply, divide, add } from "@f-o-t/money";

// Store: toDatabase(of(25.50, "BRL")) → { amount: "2550", currency: "BRL", scale: 2 }
// Load: fromDatabase(lot.unitCost, lot.currency)

// FIFO: total cost = lot unit cost * consumed quantity
// Weighted avg: newAvg = (oldAvg * oldQty + inCost * inQty) / (oldQty + inQty)
```

### `@f-o-t/uom`

Quantities stored as BigInt strings in base unit. Service converts when alternate units are used:

```typescript
import { of, convert } from "@f-o-t/uom";

// User records 5 boxes, item base unit is "unit", 1 box = 12 units
const received = of(5, "box");
const inBaseUnit = convert(received, "unit", { conversionFactor: 12n });
// → 60 units stored
```

Built-in conversions (kg ↔ g, L ↔ mL) handled natively. Custom per-item conversions use factors from `inventory_item_uom`.

---

## Repository Layer

File: `packages/database/src/repositories/inventory-repository.ts`

| Function | Purpose |
|----------|---------|
| `createInventoryItem(db, data)` | Insert item with base UoM and valuation method |
| `updateInventoryItem(db, id, orgId, data)` | Update item fields |
| `deleteInventoryItem(db, id, orgId)` | Delete item (cascades to movements, lots, UoMs) |
| `getInventoryItem(db, id, orgId)` | Get single item with UoMs |
| `listInventoryItems(db, orgId, filters)` | Paginated list with search, type filter |
| `addItemUom(db, data)` | Register alternate UoM conversion |
| `removeItemUom(db, id)` | Remove alternate UoM |
| `recordStockMovement(db, data)` | Record movement, create lot on inflow (FIFO), update weighted avg |
| `getStockMovements(db, itemId, orgId, pagination)` | Paginated movement history |
| `getStockLevel(db, itemId)` | Current quantity (sum of lot remainders or running total) |
| `getStockValuation(db, itemId)` | Total value via FIFO lots or weighted average |
| `consumeStock(db, itemId, quantity)` | FIFO: deplete oldest lots first. WA: decrement and return avg cost |
| `linkItemCounterparty(db, data)` | Associate supplier/client with pricing |
| `unlinkItemCounterparty(db, id)` | Remove association |
| `getItemCounterparties(db, itemId)` | List suppliers/clients for an item |

All functions use `AppError` for errors and `propagateError()` in catch blocks.

---

## tRPC Router

File: `packages/api/src/server/routers/inventory.ts`

```typescript
export const inventoryRouter = router({
  // Items
  createItem:          protectedProcedure.input(createItemSchema).mutation(...),
  updateItem:          protectedProcedure.input(updateItemSchema).mutation(...),
  deleteItem:          protectedProcedure.input(idSchema).mutation(...),
  getItem:             protectedProcedure.input(idSchema).query(...),
  listItems:           protectedProcedure.input(listItemsSchema).query(...),

  // UoM conversions
  addItemUom:          protectedProcedure.input(addItemUomSchema).mutation(...),
  removeItemUom:       protectedProcedure.input(idSchema).mutation(...),

  // Stock movements
  recordMovement:      protectedProcedure.input(recordMovementSchema).mutation(...),
  getMovements:        protectedProcedure.input(getMovementsSchema).query(...),

  // Stock queries
  getStockLevel:       protectedProcedure.input(itemIdSchema).query(...),
  getStockValuation:   protectedProcedure.input(itemIdSchema).query(...),
  getStockSummary:     protectedProcedure.query(...),

  // Counterparty links
  linkCounterparty:      protectedProcedure.input(linkCounterpartySchema).mutation(...),
  unlinkCounterparty:    protectedProcedure.input(idSchema).mutation(...),
  getItemCounterparties: protectedProcedure.input(itemIdSchema).query(...),
});
```

Errors use `APIError` throughout.

### Validation schemas

File: `packages/api/src/schemas/inventory.ts`

- **`createItemSchema`** — name, type, baseUnit, baseUnitScale, valuationMethod, currency, sku?, description?, reorderPoint?, defaultCounterpartyId?
- **`updateItemSchema`** — id + partial of createItemSchema fields
- **`recordMovementSchema`** — itemId, type, reason, quantity, unit (can be alternate), unitCost, currency, counterpartyId?, transactionId?, date, notes?
- **`addItemUomSchema`** — inventoryItemId, unit, conversionFactor
- **`linkCounterpartySchema`** — itemId, counterpartyId, role, unitPrice, currency, minOrderQuantity?, leadTimeDays?, notes?
- **`listItemsSchema`** — search?, type?, page, pageSize
- **`getMovementsSchema`** — itemId, page, pageSize

---

## Dashboard UI

### Routes

```
routes/$slug/_dashboard/
  inventory/
    index.tsx          # Item list with stock levels
    $itemId.tsx        # Item detail: movements, valuation, counterparties
```

### Feature folder

```
features/inventory/
  hooks/
    use-create-item.ts
    use-update-item.ts
    use-delete-item.ts
    use-record-movement.ts
    use-stock-level.ts
    use-stock-valuation.ts
    use-item-counterparties.ts
    use-link-counterparty.ts
  ui/
    item-form-sheet.tsx            # useSheet — create/edit item
    record-movement-sheet.tsx      # useSheet — record stock in/out/adjustment
    item-uom-credenza.tsx          # useCredenza — manage alternate UoMs
    link-counterparty-credenza.tsx # useCredenza — associate supplier/client
    delete-item-alert.tsx          # useAlertDialog — confirm deletion
    stock-level-badge.tsx          # green/yellow/red based on reorder point
    valuation-summary-card.tsx     # total value, method indicator
    movement-history-table.tsx     # paginated movement log
    item-counterparty-table.tsx    # suppliers/clients with pricing
```

### Inventory list page (`index.tsx`)

- Table: name, SKU, type, stock level, base unit, valuation, last movement date
- `StockLevelBadge` — green (above reorder), yellow (at reorder), red (zero/below)
- Filters: type (product/material/asset), search by name/SKU
- "Add Item" button opens `ItemFormSheet`

### Item detail page (`$itemId.tsx`)

- Header: name, SKU, type, current stock + unit, total valuation
- Sections/tabs:
  - **Movements** — `MovementHistoryTable` with "Record Movement" button
  - **Counterparties** — `ItemCounterpartyTable` with "Link Counterparty" button
  - **UoM** — base unit display + list of alternate UoMs with conversion factors

---

## Implementation Order

1. Install `@f-o-t/money` and `@f-o-t/uom` as dependencies
2. Database schemas (`packages/database/src/schemas/inventory.ts`) + relation updates to counterparties and transactions
3. Run `db:push` to apply schema
4. Repository layer (`packages/database/src/repositories/inventory-repository.ts`)
5. Zod validation schemas (`packages/api/src/schemas/inventory.ts`)
6. tRPC router (`packages/api/src/server/routers/inventory.ts`) + register in app router
7. Dashboard hooks (`features/inventory/hooks/`)
8. Dashboard UI components (`features/inventory/ui/`)
9. Route pages (`inventory/index.tsx`, `inventory/$itemId.tsx`)
10. Navigation — add inventory link to dashboard sidebar
