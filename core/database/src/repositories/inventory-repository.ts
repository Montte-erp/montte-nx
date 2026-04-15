import dayjs from "dayjs";
import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { multiply, of, toDecimal } from "@f-o-t/money";
import { convert, of as uomOf } from "@f-o-t/uom";
import {
   type CreateInventoryMovementInput,
   type CreateInventoryProductInput,
   type UpdateInventoryProductInput,
   createInventoryMovementSchema,
   createInventoryProductSchema,
   inventoryMovements,
   inventoryProducts,
   inventorySettings,
   updateInventoryProductSchema,
} from "@core/database/schemas/inventory";

export async function createInventoryProduct(
   db: DatabaseInstance,
   teamId: string,
   data: CreateInventoryProductInput,
) {
   const validated = validateInput(createInventoryProductSchema, data);
   try {
      const [product] = await db
         .insert(inventoryProducts)
         .values({
            ...validated,
            teamId,
            currentStock: validated.initialStock,
         })
         .returning();
      if (!product)
         throw AppError.database("Failed to create inventory product");
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create inventory product");
   }
}

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
      const product = await db.query.inventoryProducts.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      return product ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get inventory product");
   }
}

export async function ensureProductOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const product = await getInventoryProduct(db, id);
   if (!product || product.teamId !== teamId) {
      throw AppError.notFound("Produto não encontrado.");
   }
   return product;
}

export async function updateInventoryProduct(
   db: DatabaseInstance,
   id: string,
   data: UpdateInventoryProductInput,
) {
   const validated = validateInput(updateInventoryProductSchema, data);
   try {
      const [product] = await db
         .update(inventoryProducts)
         .set(validated)
         .where(eq(inventoryProducts.id, id))
         .returning();
      if (!product)
         throw AppError.database("Failed to update inventory product");
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
         .set({ archivedAt: dayjs().toDate() })
         .where(eq(inventoryProducts.id, id))
         .returning();
      if (!product)
         throw AppError.database("Failed to archive inventory product");
      return product;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive inventory product");
   }
}

export function toBaseQty(
   purchasedQty: number,
   purchaseUnit: string,
   baseUnit: string,
   factor: number,
): number {
   if (purchaseUnit === baseUnit) return purchasedQty;
   try {
      const m = uomOf(purchasedQty, purchaseUnit as any);
      const converted = convert(m, baseUnit as any);
      return Number(converted.value) / 10 ** converted.scale;
   } catch {
      return purchasedQty * factor;
   }
}

export async function createInventoryMovement(
   db: DatabaseInstance,
   teamId: string,
   data: CreateInventoryMovementInput,
) {
   const validated = validateInput(createInventoryMovementSchema, data);
   const qtyNum = Number(validated.qty);

   return await db.transaction(async (tx) => {
      const [product] = await tx
         .select()
         .from(inventoryProducts)
         .where(eq(inventoryProducts.id, validated.productId));

      if (!product) throw AppError.notFound("Produto não encontrado");

      if (validated.type !== "purchase") {
         const currentStock = Number(product.currentStock);
         if (currentStock < qtyNum) {
            throw AppError.conflict(
               `Quantidade maior que o estoque disponível (saldo atual: ${currentStock})`,
            );
         }
      }

      let totalAmount: string | null = null;
      if (validated.type === "purchase" || validated.type === "sale") {
         const price = of(Number(validated.unitPrice), "BRL");
         totalAmount = toDecimal(multiply(price, qtyNum));
      }

      const [movement] = await tx
         .insert(inventoryMovements)
         .values({
            ...validated,
            teamId,
            totalAmount,
         })
         .returning();

      const delta = validated.type === "purchase" ? qtyNum : -qtyNum;
      await tx
         .update(inventoryProducts)
         .set({
            currentStock: sql`${inventoryProducts.currentStock} + ${delta}`,
         })
         .where(eq(inventoryProducts.id, validated.productId));

      if (!movement)
         throw AppError.database("Failed to create inventory movement");
      return movement;
   });
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

export async function deleteInventoryMovement(
   db: DatabaseInstance,
   id: string,
) {
   return await db.transaction(async (tx) => {
      const [movement] = await tx
         .select()
         .from(inventoryMovements)
         .where(eq(inventoryMovements.id, id));

      if (!movement) throw AppError.notFound("Movimentação não encontrada");

      const qtyNum = Number(movement.qty);
      const delta = movement.type === "purchase" ? -qtyNum : qtyNum;

      await tx.delete(inventoryMovements).where(eq(inventoryMovements.id, id));

      await tx
         .update(inventoryProducts)
         .set({
            currentStock: sql`${inventoryProducts.currentStock} + ${delta}`,
         })
         .where(eq(inventoryProducts.id, movement.productId));

      return movement;
   });
}

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
            set: { ...data, updatedAt: dayjs().toDate() },
         })
         .returning();
      if (!settings)
         throw AppError.database("Failed to upsert inventory settings");
      return settings;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert inventory settings");
   }
}
