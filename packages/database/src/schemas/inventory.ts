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
      baseUnit: text("base_unit").notNull(),
      purchaseUnit: text("purchase_unit").notNull(),
      purchaseUnitFactor: numeric("purchase_unit_factor", {
         precision: 12,
         scale: 4,
      }).notNull().default("1"),
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
      qty: numeric("qty", { precision: 12, scale: 4 }).notNull(),
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
