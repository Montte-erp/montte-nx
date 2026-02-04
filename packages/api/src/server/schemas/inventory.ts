import { z } from "zod";

// =============================================================================
// Item CRUD Schemas
// =============================================================================

export const createItemSchema = z.object({
	name: z.string().min(1, "Name is required"),
	sku: z.string().optional(),
	type: z.enum(["product", "material", "asset"]),
	description: z.string().optional(),
	baseUnit: z.string().min(1, "Base unit of measure is required"),
	baseUnitScale: z.number().int().default(0),
	valuationMethod: z.enum(["fifo", "weighted_average"]).default("fifo"),
	currency: z.string().length(3, "Currency must be a 3-letter code"),
	reorderPoint: z.string().optional(),
	defaultCounterpartyId: z.string().uuid().optional(),
});

export const updateItemSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).optional(),
	sku: z.string().optional(),
	type: z.enum(["product", "material", "asset"]).optional(),
	description: z.string().optional(),
	baseUnit: z.string().optional(),
	baseUnitScale: z.number().int().optional(),
	valuationMethod: z.enum(["fifo", "weighted_average"]).optional(),
	currency: z.string().length(3).optional(),
	reorderPoint: z.string().optional(),
	defaultCounterpartyId: z.string().uuid().optional(),
});

export const idSchema = z.object({
	id: z.string().uuid(),
});

export const itemIdSchema = z.object({
	itemId: z.string().uuid(),
});

// =============================================================================
// List Items Schema
// =============================================================================

export const listItemsSchema = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(10),
	search: z.string().optional(),
	type: z.enum(["product", "material", "asset"]).optional(),
	orderBy: z.enum(["name", "sku", "createdAt"]).default("name"),
	orderDirection: z.enum(["asc", "desc"]).default("asc"),
});

// =============================================================================
// UoM Schemas
// =============================================================================

export const addItemUomSchema = z.object({
	inventoryItemId: z.string().uuid(),
	unit: z.string().min(1, "Unit of measure is required"),
	conversionFactor: z.string().min(1, "Conversion factor is required"),
});

// =============================================================================
// Stock Movement Schemas
// =============================================================================

export const recordMovementSchema = z.object({
	itemId: z.string().uuid(),
	type: z.enum(["in", "out", "adjustment"]),
	reason: z.enum(["purchase", "sale", "return", "damage", "correction", "production"]),
	quantity: z.string().min(1, "Quantity is required"),
	unitCost: z.string().min(1, "Unit cost is required"),
	currency: z.string().length(3, "Currency must be a 3-letter code"),
	date: z.date(),
	notes: z.string().optional(),
	counterpartyId: z.string().uuid().optional(),
	transactionId: z.string().uuid().optional(),
});

export const getMovementsSchema = z.object({
	itemId: z.string().uuid(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(10),
});

// =============================================================================
// Counterparty Link Schemas
// =============================================================================

export const linkCounterpartySchema = z.object({
	itemId: z.string().uuid(),
	counterpartyId: z.string().uuid(),
	role: z.enum(["supplier", "client"]),
	unitPrice: z.string().min(1, "Unit price is required"),
	currency: z.string().length(3, "Currency must be a 3-letter code"),
	minOrderQuantity: z.string().optional(),
	leadTimeDays: z.number().int().min(0).optional(),
	notes: z.string().optional(),
});
