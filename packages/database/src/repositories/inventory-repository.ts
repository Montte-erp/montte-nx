import {
	fromDatabase as moneyFromDatabase,
	of as moneyOf,
	toDatabase as moneyToDatabase,
	multiply,
} from "@f-o-t/money";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   inventoryItem,
   inventoryItemCounterparty,
   inventoryItemUom,
   stockLot,
   stockMovement,
} from "../schemas/inventory";
import { buildPaginationMeta, calculateOffset } from "../utils/pagination";

// =============================================================================
// Types
// =============================================================================

export type InventoryItem = typeof inventoryItem.$inferSelect;
export type NewInventoryItem = typeof inventoryItem.$inferInsert;

export type InventoryItemUom = typeof inventoryItemUom.$inferSelect;
export type NewInventoryItemUom = typeof inventoryItemUom.$inferInsert;

export type StockMovement = typeof stockMovement.$inferSelect;
export type NewStockMovement = typeof stockMovement.$inferInsert;

export type StockLot = typeof stockLot.$inferSelect;

export type InventoryItemCounterparty =
   typeof inventoryItemCounterparty.$inferSelect;
export type NewInventoryItemCounterparty =
   typeof inventoryItemCounterparty.$inferInsert;

export type InventoryItemWithUoms = InventoryItem & {
   inventoryItemUoms: InventoryItemUom[];
};

// =============================================================================
// Item CRUD
// =============================================================================

/**
 * Create a new inventory item with base UoM and valuation method
 */
export async function createInventoryItem(
   dbClient: DatabaseInstance,
   data: NewInventoryItem,
) {
   try {
      // Generate search index
      const searchIndex = [data.name, data.sku]
         .filter(Boolean)
         .join(" ")
         .toLowerCase();

      const result = await dbClient
         .insert(inventoryItem)
         .values({ ...data, searchIndex })
         .returning();

      if (!result[0]) {
         throw AppError.database("Failed to create inventory item");
      }

      const createdId = result[0].id;

      const createdItem = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq }) => eq(item.id, createdId),
         with: {
            inventoryItemUoms: true,
         },
      });

      if (!createdItem) {
         throw AppError.database("Failed to fetch created inventory item");
      }

      return createdItem;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create inventory item: ${(err as Error).message}`,
      );
   }
}

/**
 * Update an inventory item
 * Verifies organization ownership
 */
export async function updateInventoryItem(
   dbClient: DatabaseInstance,
   id: string,
   organizationId: string,
   data: Partial<NewInventoryItem>,
) {
   try {
      // Verify ownership
      const existing = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq, and }) =>
            and(eq(item.id, id), eq(item.organizationId, organizationId)),
      });

      if (!existing) {
         throw AppError.database("Inventory item not found");
      }

      // Generate search index if name or sku changed
      const searchIndex =
         data.name || data.sku
            ? [data.name ?? existing.name, data.sku ?? existing.sku]
                 .filter(Boolean)
                 .join(" ")
                 .toLowerCase()
            : undefined;

      const result = await dbClient
         .update(inventoryItem)
         .set(searchIndex ? { ...data, searchIndex } : data)
         .where(eq(inventoryItem.id, id))
         .returning();

      if (!result.length) {
         throw AppError.database("Inventory item not found");
      }

      const updatedItem = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq }) => eq(item.id, id),
         with: {
            inventoryItemUoms: true,
         },
      });

      if (!updatedItem) {
         throw AppError.database("Failed to fetch updated inventory item");
      }

      return updatedItem;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to update inventory item: ${(err as Error).message}`,
      );
   }
}

/**
 * Delete an inventory item
 * Cascades to movements, lots, and UoMs
 */
export async function deleteInventoryItem(
   dbClient: DatabaseInstance,
   id: string,
   organizationId: string,
) {
   try {
      // Verify ownership
      const existing = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq, and }) =>
            and(eq(item.id, id), eq(item.organizationId, organizationId)),
      });

      if (!existing) {
         throw AppError.database("Inventory item not found");
      }

      const result = await dbClient
         .delete(inventoryItem)
         .where(eq(inventoryItem.id, id))
         .returning();

      if (!result.length) {
         throw AppError.database("Inventory item not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete inventory item: ${(err as Error).message}`,
      );
   }
}

/**
 * Get a single inventory item with UoMs loaded
 */
export async function getInventoryItem(
   dbClient: DatabaseInstance,
   id: string,
   organizationId: string,
) {
   try {
      const result = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq, and }) =>
            and(eq(item.id, id), eq(item.organizationId, organizationId)),
         with: {
            inventoryItemUoms: true,
            defaultCounterparty: true,
         },
      });

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get inventory item: ${(err as Error).message}`,
      );
   }
}

/**
 * List inventory items with pagination, search, and type filter
 */
export async function listInventoryItems(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: {
      page?: number;
      limit?: number;
      search?: string;
      type?: "product" | "material" | "asset";
      orderBy?: "name" | "sku" | "createdAt";
      orderDirection?: "asc" | "desc";
   } = {},
) {
   const {
      page = 1,
      limit = 10,
      search,
      type,
      orderBy = "name",
      orderDirection = "asc",
   } = options;

   const offset = calculateOffset(page, limit);

   try {
      const buildWhereCondition = () => {
         const conditions = [eq(inventoryItem.organizationId, organizationId)];

         if (type) {
            conditions.push(eq(inventoryItem.type, type));
         }

         if (search) {
            conditions.push(ilike(inventoryItem.searchIndex, `%${search}%`));
         }

         return and(...conditions);
      };

      const [items, totalCountResult] = await Promise.all([
         dbClient.query.inventoryItem.findMany({
            limit,
            offset,
            orderBy: (item) => {
               const column = item[orderBy as keyof typeof item];
               return orderDirection === "asc" ? asc(column) : desc(column);
            },
            where: buildWhereCondition,
            with: {
               inventoryItemUoms: true,
               defaultCounterparty: true,
            },
         }),
         dbClient
            .select({ count: count() })
            .from(inventoryItem)
            .where(buildWhereCondition()),
      ]);

      const totalCount = totalCountResult[0]?.count || 0;

      return {
         data: items,
         total: totalCount,
         pagination: buildPaginationMeta(totalCount, page, limit),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to list inventory items: ${(err as Error).message}`,
      );
   }
}

// =============================================================================
// UoM Management
// =============================================================================

/**
 * Register an alternate UoM conversion for an item
 */
export async function addItemUom(
   dbClient: DatabaseInstance,
   data: NewInventoryItemUom,
) {
   try {
      const result = await dbClient
         .insert(inventoryItemUom)
         .values(data)
         .returning();

      if (!result[0]) {
         throw AppError.database("Failed to add item UoM");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to add item UoM: ${(err as Error).message}`,
      );
   }
}

/**
 * Remove an alternate UoM
 */
export async function removeItemUom(dbClient: DatabaseInstance, id: string) {
   try {
      const result = await dbClient
         .delete(inventoryItemUom)
         .where(eq(inventoryItemUom.id, id))
         .returning();

      if (!result.length) {
         throw AppError.database("Item UoM not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to remove item UoM: ${(err as Error).message}`,
      );
   }
}

// =============================================================================
// Stock Movements
// =============================================================================

/**
 * Record a stock movement
 * - Creates a lot on inflow (FIFO)
 * - Updates weighted average cost on inflow (weighted_average)
 * - Consumes stock on outflow
 */
export async function recordStockMovement(
   dbClient: DatabaseInstance,
   data: NewStockMovement,
) {
   try {
      return await dbClient.transaction(async (tx) => {
         // Insert the stock movement
         const movementResult = await tx
            .insert(stockMovement)
            .values(data)
            .returning();

         const movement = movementResult[0];
         if (!movement) {
            throw AppError.database("Failed to create stock movement");
         }

         // Get the item to check valuation method
         const item = await tx.query.inventoryItem.findFirst({
            where: (item, { eq }) => eq(item.id, data.inventoryItemId),
         });

         if (!item) {
            throw AppError.database("Inventory item not found");
         }

         // Handle inflow
         if (data.type === "in") {
            if (item.valuationMethod === "fifo") {
               // Create a new lot
               await tx.insert(stockLot).values({
                  inventoryItemId: item.id,
                  remainingQuantity: data.quantity,
                  unitCost: data.unitCost,
                  currency: data.currency,
                  date: data.date,
                  stockMovementId: movement.id,
               });
            } else if (item.valuationMethod === "weighted_average") {
               // Calculate new weighted average cost
               const currentLevel = await getStockLevel(tx, item.id);
               const currentValuation = await getStockValuation(tx, item.id);

               const incomingQty = BigInt(data.quantity);
               const incomingCost = moneyFromDatabase({
                  amount: data.unitCost,
                  currency: data.currency,
               });
               const incomingValue = multiply(
                  incomingCost,
                  incomingQty.toString(),
               );

               const newTotalQty = BigInt(currentLevel) + incomingQty;
               const newTotalValue = currentValuation
                  ? {
                       amount: (
                          BigInt(currentValuation.amount) + incomingValue.amount
                       ).toString(),
                       currency: currentValuation.currency,
                       scale: currentValuation.scale,
                    }
                  : incomingValue;

               // Store weighted average in a pseudo-lot or item metadata
               // For simplicity, we'll create a single lot that represents the average
               // In production, you might store this in the item record itself
               await tx
                  .delete(stockLot)
                  .where(eq(stockLot.inventoryItemId, item.id));

               if (newTotalQty > 0n) {
                  const avgCost = moneyFromDatabase({
                     amount: (
                        BigInt(newTotalValue.amount) / newTotalQty
                     ).toString(),
                     currency: newTotalValue.currency,
                  });
                  const avgCostDb = moneyToDatabase(avgCost);

                  await tx.insert(stockLot).values({
                     inventoryItemId: item.id,
                     remainingQuantity: newTotalQty.toString(),
                     unitCost: avgCostDb.amount,
                     currency: avgCostDb.currency,
                     date: data.date,
                     stockMovementId: movement.id,
                  });
               }
            }
         }

         // Handle outflow
         if (data.type === "out") {
            await consumeStock(
               tx,
               item.id,
               BigInt(data.quantity),
               item.valuationMethod as "fifo" | "weighted_average",
            );
         }

         // Return the created movement with relations
         const createdMovement = await tx.query.stockMovement.findFirst({
            where: (m, { eq }) => eq(m.id, movement.id),
            with: {
               inventoryItem: true,
               counterparty: true,
               transaction: true,
            },
         });

         if (!createdMovement) {
            throw AppError.database("Failed to fetch created stock movement");
         }

         return createdMovement;
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to record stock movement: ${(err as Error).message}`,
      );
   }
}

/**
 * Get paginated stock movement history for an item
 */
export async function getStockMovements(
   dbClient: DatabaseInstance,
   itemId: string,
   organizationId: string,
   options: {
      page?: number;
      limit?: number;
   } = {},
) {
   const { page = 1, limit = 10 } = options;
   const offset = calculateOffset(page, limit);

   try {
      const whereCondition = and(
         eq(stockMovement.inventoryItemId, itemId),
         eq(stockMovement.organizationId, organizationId),
      );

      const [movements, totalCountResult] = await Promise.all([
         dbClient.query.stockMovement.findMany({
            limit,
            offset,
            orderBy: (m) => desc(m.date),
            where: (m, { eq, and }) =>
               and(
                  eq(m.inventoryItemId, itemId),
                  eq(m.organizationId, organizationId),
               ),
            with: {
               inventoryItem: true,
               counterparty: true,
               transaction: true,
            },
         }),
         dbClient
            .select({ count: count() })
            .from(stockMovement)
            .where(whereCondition),
      ]);

      const totalCount = totalCountResult[0]?.count || 0;

      return {
         data: movements,
         total: totalCount,
         pagination: buildPaginationMeta(totalCount, page, limit),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get stock movements: ${(err as Error).message}`,
      );
   }
}

// =============================================================================
// Stock Queries
// =============================================================================

/**
 * Get current stock level (sum of lot remainders or running total)
 */
export async function getStockLevel(
   dbClient: DatabaseInstance,
   itemId: string,
): Promise<string> {
   try {
      const item = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq }) => eq(item.id, itemId),
      });

      if (!item) {
         throw AppError.database("Inventory item not found");
      }

      if (item.valuationMethod === "fifo") {
         // Sum remaining quantities from lots
         const result = await dbClient
            .select({
               total: sql<string>`COALESCE(SUM(CAST(${stockLot.remainingQuantity} AS NUMERIC)), 0)`,
            })
            .from(stockLot)
            .where(eq(stockLot.inventoryItemId, itemId));

         return result[0]?.total || "0";
      }

      // For weighted_average, sum movements
      const movements = await dbClient.query.stockMovement.findMany({
         where: (m, { eq }) => eq(m.inventoryItemId, itemId),
      });

      let total = 0n;
      for (const movement of movements) {
         const qty = BigInt(movement.quantity);
         if (movement.type === "in") {
            total += qty;
         } else if (movement.type === "out") {
            total -= qty;
         }
         // adjustment can be positive or negative, we'd need a sign field
         // For now, treating as direct value
      }

      return total.toString();
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get stock level: ${(err as Error).message}`,
      );
   }
}

/**
 * Get total stock valuation (value using FIFO lots or weighted average)
 */
export async function getStockValuation(
   dbClient: DatabaseInstance,
   itemId: string,
) {
   try {
      const item = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq }) => eq(item.id, itemId),
      });

      if (!item) {
         throw AppError.database("Inventory item not found");
      }

      if (item.valuationMethod === "fifo") {
         // Sum (remaining_quantity * unit_cost) for all lots
         const lots = await dbClient.query.stockLot.findMany({
            where: (lot, { eq }) => eq(lot.inventoryItemId, itemId),
         });

         if (lots.length === 0) {
            return moneyOf("0", item.currency);
         }

         let totalValue = moneyOf("0", lots[0]!.currency);
         for (const lot of lots) {
            const lotCost = moneyFromDatabase({
               amount: lot.unitCost,
               currency: lot.currency,
            });
            const lotQty = BigInt(lot.remainingQuantity);
            const lotValue = multiply(lotCost, lotQty.toString());
            totalValue = {
               amount: totalValue.amount + lotValue.amount,
               currency: totalValue.currency,
               scale: totalValue.scale,
            };
         }

         return totalValue;
      }

      // For weighted_average
      const lots = await dbClient.query.stockLot.findMany({
         where: (lot, { eq }) => eq(lot.inventoryItemId, itemId),
      });

      if (lots.length === 0) {
         return moneyOf("0", item.currency);
      }

      const lot = lots[0]!;
      const avgCost = moneyFromDatabase({
         amount: lot.unitCost,
         currency: lot.currency,
      });
      const qty = BigInt(lot.remainingQuantity);

      return multiply(avgCost, qty.toString());
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get stock valuation: ${(err as Error).message}`,
      );
   }
}

/**
 * Consume stock using FIFO (deplete oldest lots) or weighted average
 * Returns the average cost of consumed stock
 */
export async function consumeStock(
   dbClient: DatabaseInstance,
   itemId: string,
   quantity: bigint,
   valuationMethod: "fifo" | "weighted_average",
) {
   try {
      // Get the item to access currency
      const item = await dbClient.query.inventoryItem.findFirst({
         where: (item, { eq }) => eq(item.id, itemId),
      });

      if (!item) {
         throw AppError.database("Inventory item not found");
      }

      if (valuationMethod === "fifo") {
         // Get oldest lots first
         const lots = await dbClient.query.stockLot.findMany({
            where: (lot, { eq }) => eq(lot.inventoryItemId, itemId),
            orderBy: (lot) => asc(lot.date),
         });

         if (lots.length === 0) {
            throw AppError.validation("No stock available");
         }

         let remaining = quantity;
         let totalCost = moneyOf("0", item.currency);
         let consumedQty = 0n;

         for (const lot of lots) {
            if (remaining <= 0n) break;

            const lotRemaining = BigInt(lot.remainingQuantity);
            const toConsume =
               remaining < lotRemaining ? remaining : lotRemaining;

            const lotCost = moneyFromDatabase({
               amount: lot.unitCost,
               currency: lot.currency,
            });
            const consumeCost = multiply(lotCost, toConsume.toString());

            totalCost = {
               amount: totalCost.amount + consumeCost.amount,
               currency: totalCost.currency,
               scale: totalCost.scale,
            };
            consumedQty += toConsume;

            const newRemaining = lotRemaining - toConsume;

            if (newRemaining === 0n) {
               await dbClient.delete(stockLot).where(eq(stockLot.id, lot.id));
            } else {
               await dbClient
                  .update(stockLot)
                  .set({ remainingQuantity: newRemaining.toString() })
                  .where(eq(stockLot.id, lot.id));
            }

            remaining -= toConsume;
         }

         if (remaining > 0n) {
            throw AppError.validation("Insufficient stock to consume");
         }

         // Return average cost of consumed stock
         const avgCost =
            consumedQty > 0n
               ? moneyFromDatabase({
                    amount: (totalCost.amount / consumedQty).toString(),
                    currency: totalCost.currency,
                 })
               : totalCost;

         return avgCost;
      }

      // For weighted_average
      const lots = await dbClient.query.stockLot.findMany({
         where: (lot, { eq }) => eq(lot.inventoryItemId, itemId),
      });

      if (lots.length === 0) {
         throw AppError.validation("No stock available");
      }

      const lot = lots[0]!;
      const currentQty = BigInt(lot.remainingQuantity);

      if (currentQty < quantity) {
         throw AppError.validation("Insufficient stock to consume");
      }

      const newQty = currentQty - quantity;

      if (newQty === 0n) {
         await dbClient.delete(stockLot).where(eq(stockLot.id, lot.id));
      } else {
         await dbClient
            .update(stockLot)
            .set({ remainingQuantity: newQty.toString() })
            .where(eq(stockLot.id, lot.id));
      }

      // Return the weighted average cost
      return moneyFromDatabase({
         amount: lot.unitCost,
         currency: lot.currency,
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to consume stock: ${(err as Error).message}`,
      );
   }
}

// =============================================================================
// Counterparty Links
// =============================================================================

/**
 * Link a supplier or client to an item with pricing
 */
export async function linkItemCounterparty(
   dbClient: DatabaseInstance,
   data: NewInventoryItemCounterparty,
) {
   try {
      const result = await dbClient
         .insert(inventoryItemCounterparty)
         .values(data)
         .returning();

      if (!result[0]) {
         throw AppError.database("Failed to link item counterparty");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to link item counterparty: ${(err as Error).message}`,
      );
   }
}

/**
 * Remove a counterparty association
 */
export async function unlinkItemCounterparty(
   dbClient: DatabaseInstance,
   id: string,
) {
   try {
      const result = await dbClient
         .delete(inventoryItemCounterparty)
         .where(eq(inventoryItemCounterparty.id, id))
         .returning();

      if (!result.length) {
         throw AppError.database("Item counterparty link not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to unlink item counterparty: ${(err as Error).message}`,
      );
   }
}

/**
 * Get all suppliers/clients linked to an item
 */
export async function getItemCounterparties(
   dbClient: DatabaseInstance,
   itemId: string,
) {
   try {
      const result = await dbClient.query.inventoryItemCounterparty.findMany({
         where: (link, { eq }) => eq(link.inventoryItemId, itemId),
         with: {
            counterparty: true,
         },
      });

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get item counterparties: ${(err as Error).message}`,
      );
   }
}
