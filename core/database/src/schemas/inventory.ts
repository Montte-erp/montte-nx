import { sql } from "drizzle-orm";
import {
   date,
   index,
   numeric,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { inventorySchema } from "@core/database/schemas/inventory-schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { transactions } from "@core/database/schemas/transactions";

export const inventoryMovementTypeEnum = inventorySchema.enum(
   "inventory_movement_type",
   ["purchase", "sale", "waste"],
);

export const inventoryProducts = inventorySchema.table(
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

export const inventoryMovements = inventorySchema.table(
   "inventory_movements",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
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

export const inventorySettings = inventorySchema.table("inventory_settings", {
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

export type InventoryProduct = typeof inventoryProducts.$inferSelect;
export type NewInventoryProduct = typeof inventoryProducts.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventorySettings = typeof inventorySettings.$inferSelect;

const numericNonNegative = (msg: string) =>
   z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: msg,
   });

const numericPositive = (msg: string) =>
   z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: msg,
   });

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const baseProductSchema = createInsertSchema(inventoryProducts).pick({
   name: true,
   description: true,
   baseUnit: true,
   purchaseUnit: true,
   purchaseUnitFactor: true,
   sellingPrice: true,
   initialStock: true,
});

export const createInventoryProductSchema = baseProductSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   baseUnit: z
      .string()
      .min(1, "Unidade base é obrigatória.")
      .max(10, "Unidade base deve ter no máximo 10 caracteres."),
   purchaseUnit: z
      .string()
      .min(1, "Unidade de compra é obrigatória.")
      .max(10, "Unidade de compra deve ter no máximo 10 caracteres."),
   purchaseUnitFactor: numericNonNegative(
      "Fator de conversão deve ser um número válido maior ou igual a zero.",
   ).default("1"),
   sellingPrice: numericNonNegative(
      "Preço de venda deve ser um número válido maior ou igual a zero.",
   )
      .nullable()
      .optional(),
   initialStock: numericNonNegative(
      "Estoque inicial deve ser um número válido maior ou igual a zero.",
   ).default("0"),
});

export const updateInventoryProductSchema = baseProductSchema
   .omit({ initialStock: true })
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(120, "Nome deve ter no máximo 120 caracteres.")
         .optional(),
      description: z
         .string()
         .max(500, "Descrição deve ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      baseUnit: z
         .string()
         .min(1, "Unidade base é obrigatória.")
         .max(10, "Unidade base deve ter no máximo 10 caracteres.")
         .optional(),
      purchaseUnit: z
         .string()
         .min(1, "Unidade de compra é obrigatória.")
         .max(10, "Unidade de compra deve ter no máximo 10 caracteres.")
         .optional(),
      purchaseUnitFactor: numericNonNegative(
         "Fator de conversão deve ser um número válido maior ou igual a zero.",
      ).optional(),
      sellingPrice: numericNonNegative(
         "Preço de venda deve ser um número válido maior ou igual a zero.",
      )
         .nullable()
         .optional(),
   })
   .partial();

const movementBaseFields = {
   productId: z.string().uuid("ID do produto inválido."),
   qty: numericPositive("Quantidade deve ser um número válido maior que zero."),
   supplierId: z
      .string()
      .uuid("ID do fornecedor inválido.")
      .nullable()
      .optional(),
   transactionId: z
      .string()
      .uuid("ID da transação inválido.")
      .nullable()
      .optional(),
   notes: z
      .string()
      .max(255, "Observações devem ter no máximo 255 caracteres.")
      .nullable()
      .optional(),
   date: dateSchema,
};

export const createInventoryMovementSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("purchase"),
      ...movementBaseFields,
      unitPrice: numericPositive(
         "Preço unitário deve ser um número válido maior que zero.",
      ),
   }),
   z.object({
      type: z.literal("sale"),
      ...movementBaseFields,
      unitPrice: numericPositive(
         "Preço unitário deve ser um número válido maior que zero.",
      ),
   }),
   z.object({
      type: z.literal("waste"),
      ...movementBaseFields,
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
