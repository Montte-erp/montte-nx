import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { counterparty } from "./counterparties";
import { transaction } from "./transactions";

export const inventoryItem = pgTable(
	"inventory_item",
	{
		id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		sku: text("sku"),
		type: text("type").notNull(), // "product" | "material" | "asset"
		baseUnit: text("base_unit").notNull(),
		baseUnitScale: integer("base_unit_scale").notNull(),
		valuationMethod: text("valuation_method").notNull(), // "fifo" | "weighted_average"
		currency: text("currency").notNull(), // ISO 4217
		reorderPoint: text("reorder_point"),
		defaultCounterpartyId: uuid("default_counterparty_id").references(
			() => counterparty.id,
			{ onDelete: "set null" },
		),
		searchIndex: text("search_index"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("inventory_item_organization_id_idx").on(table.organizationId),
		index("inventory_item_search_index_idx").on(table.searchIndex),
	],
);

export const inventoryItemUom = pgTable("inventory_item_uom", {
	id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
	inventoryItemId: uuid("inventory_item_id")
		.notNull()
		.references(() => inventoryItem.id, { onDelete: "cascade" }),
	unit: text("unit").notNull(),
	conversionFactor: text("conversion_factor").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const stockMovement = pgTable(
	"stock_movement",
	{
		id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id, { onDelete: "cascade" }),
		type: text("type").notNull(), // "in" | "out" | "adjustment"
		reason: text("reason").notNull(), // "purchase" | "sale" | "return" | "damage" | "correction" | "production"
		quantity: text("quantity").notNull(),
		unitCost: text("unit_cost").notNull(),
		currency: text("currency").notNull(), // ISO 4217
		counterpartyId: uuid("counterparty_id").references(() => counterparty.id, {
			onDelete: "set null",
		}),
		transactionId: uuid("transaction_id").references(() => transaction.id, {
			onDelete: "set null",
		}),
		notes: text("notes"),
		date: timestamp("date").notNull(),
		searchIndex: text("search_index"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("stock_movement_organization_id_idx").on(table.organizationId),
		index("stock_movement_inventory_item_id_idx").on(table.inventoryItemId),
		index("stock_movement_search_index_idx").on(table.searchIndex),
	],
);

export const stockLot = pgTable("stock_lot", {
	id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
	inventoryItemId: uuid("inventory_item_id")
		.notNull()
		.references(() => inventoryItem.id, { onDelete: "cascade" }),
	remainingQuantity: text("remaining_quantity").notNull(),
	unitCost: text("unit_cost").notNull(),
	currency: text("currency").notNull(), // ISO 4217
	date: timestamp("date").notNull(),
	stockMovementId: uuid("stock_movement_id")
		.notNull()
		.references(() => stockMovement.id),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const inventoryItemCounterparty = pgTable(
	"inventory_item_counterparty",
	{
		id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
		inventoryItemId: uuid("inventory_item_id")
			.notNull()
			.references(() => inventoryItem.id, { onDelete: "cascade" }),
		counterpartyId: uuid("counterparty_id")
			.notNull()
			.references(() => counterparty.id, { onDelete: "cascade" }),
		role: text("role").notNull(), // "supplier" | "client"
		unitPrice: text("unit_price").notNull(),
		currency: text("currency").notNull(), // ISO 4217
		minOrderQuantity: text("min_order_quantity"),
		leadTimeDays: integer("lead_time_days"),
		notes: text("notes"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
);

// Relations

export const inventoryItemRelations = relations(
	inventoryItem,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [inventoryItem.organizationId],
			references: [organization.id],
		}),
		defaultCounterparty: one(counterparty, {
			fields: [inventoryItem.defaultCounterpartyId],
			references: [counterparty.id],
		}),
		inventoryItemUoms: many(inventoryItemUom),
		stockMovements: many(stockMovement),
		stockLots: many(stockLot),
		inventoryItemCounterparties: many(inventoryItemCounterparty),
	}),
);

export const inventoryItemUomRelations = relations(
	inventoryItemUom,
	({ one }) => ({
		inventoryItem: one(inventoryItem, {
			fields: [inventoryItemUom.inventoryItemId],
			references: [inventoryItem.id],
		}),
	}),
);

export const stockMovementRelations = relations(
	stockMovement,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [stockMovement.organizationId],
			references: [organization.id],
		}),
		inventoryItem: one(inventoryItem, {
			fields: [stockMovement.inventoryItemId],
			references: [inventoryItem.id],
		}),
		counterparty: one(counterparty, {
			fields: [stockMovement.counterpartyId],
			references: [counterparty.id],
		}),
		transaction: one(transaction, {
			fields: [stockMovement.transactionId],
			references: [transaction.id],
		}),
		stockLots: many(stockLot),
	}),
);

export const stockLotRelations = relations(stockLot, ({ one }) => ({
	inventoryItem: one(inventoryItem, {
		fields: [stockLot.inventoryItemId],
		references: [inventoryItem.id],
	}),
	stockMovement: one(stockMovement, {
		fields: [stockLot.stockMovementId],
		references: [stockMovement.id],
	}),
}));

export const inventoryItemCounterpartyRelations = relations(
	inventoryItemCounterparty,
	({ one }) => ({
		inventoryItem: one(inventoryItem, {
			fields: [inventoryItemCounterparty.inventoryItemId],
			references: [inventoryItem.id],
		}),
		counterparty: one(counterparty, {
			fields: [inventoryItemCounterparty.counterpartyId],
			references: [counterparty.id],
		}),
	}),
);
