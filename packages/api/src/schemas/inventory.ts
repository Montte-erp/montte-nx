import { CurrencyCodeSchema } from "@f-o-t/money";
import { z } from "zod";

// Helper validators for BigInt-safe numeric strings
const numericStringSchema = z.string().refine(
	(val) => /^\d+(\.\d+)?$/.test(val) && Number(val) >= 0,
	{ message: "Must be a valid non-negative numeric string" },
);

const monetaryAmountSchema = z.string().refine(
	(val) => /^\d+(\.\d+)?$/.test(val) && Number(val) >= 0,
	{ message: "Must be a non-negative decimal string" },
);

// Basic ID schemas
export const idSchema = z.object({
	id: z.string().uuid(),
});

export const itemIdSchema = z.object({
	itemId: z.string().uuid(),
});

// Item type and valuation enums
const itemTypeSchema = z.enum(["product", "material", "asset"]);
const valuationMethodSchema = z.enum(["fifo", "weighted_average"]);

// Create item schema
export const createItemSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	sku: z.string().max(100).optional(),
	type: itemTypeSchema,
	baseUnit: z.string(),
	baseUnitScale: z.number().int().min(0).default(2),
	valuationMethod: valuationMethodSchema,
	currency: CurrencyCodeSchema,
	reorderPoint: numericStringSchema.optional(),
	defaultCounterpartyId: z.string().uuid().optional(),
});

// Update item schema (all fields optional except id)
export const updateItemSchema = z
	.object({
		id: z.string().uuid(),
	})
	.merge(createItemSchema.partial());

// Movement type and reason enums
const movementTypeSchema = z.enum(["in", "out", "adjustment"]);
const movementReasonSchema = z.enum([
	"purchase",
	"sale",
	"return",
	"damage",
	"correction",
	"production",
]);

// Record movement schema
export const recordMovementSchema = z.object({
	itemId: z.string().uuid(),
	type: movementTypeSchema,
	reason: movementReasonSchema,
	quantity: numericStringSchema,
	unit: z.string().min(1).max(50).optional(), // Must match baseUnit or registered UoM (validated at repository level)
	unitCost: monetaryAmountSchema,
	currency: CurrencyCodeSchema,
	counterpartyId: z.string().uuid().optional(),
	transactionId: z.string().uuid().optional(),
	date: z.coerce.date(),
	notes: z.string().optional(),
});

// Add item unit of measure schema
export const addItemUomSchema = z.object({
	inventoryItemId: z.string().uuid(),
	unit: z.string().min(1).max(50),
	conversionFactor: numericStringSchema,
});

// Counterparty role enum
const counterpartyRoleSchema = z.enum(["supplier", "client"]);

// Link counterparty schema
export const linkCounterpartySchema = z.object({
	itemId: z.string().uuid(),
	counterpartyId: z.string().uuid(),
	role: counterpartyRoleSchema,
	unitPrice: monetaryAmountSchema,
	currency: CurrencyCodeSchema,
	minOrderQuantity: numericStringSchema.optional(),
	leadTimeDays: z.number().int().min(0).optional(),
	notes: z.string().optional(),
});

// List items schema (pagination + filters)
export const listItemsSchema = z.object({
	search: z.string().min(2).optional(),
	type: itemTypeSchema.optional(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(20),
});

// Get movements schema (pagination for movements)
export const getMovementsSchema = z.object({
	itemId: z.string().uuid(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(20),
});
