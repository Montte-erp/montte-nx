import { AppError, propagateError } from "@core/utils/errors";
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

export async function getInventoryProduct(db: DatabaseInstance, id: string) {
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
