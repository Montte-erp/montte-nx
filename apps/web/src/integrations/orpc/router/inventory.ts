import { ORPCError } from "@orpc/server";
import {
   adjustProductStock,
   archiveInventoryProduct,
   createInventoryMovement,
   createInventoryProduct,
   getInventoryProduct,
   getInventorySettings,
   listInventoryMovements,
   listInventoryProducts,
   updateInventoryProduct,
   upsertInventorySettings,
} from "@packages/database/repositories/inventory-repository";
import { createTransaction } from "@packages/database/repositories/transactions-repository";
import {
   inventoryProducts,
   inventorySettings,
} from "@packages/database/schemas/inventory";
import { convert, of } from "@f-o-t/uom";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Converts purchasedQty (in purchaseUnit) to base units.
 * Tries @f-o-t/uom first; falls back to purchaseUnitFactor for custom units.
 */
function toBaseQty(
   purchasedQty: number,
   purchaseUnit: string,
   baseUnit: string,
   factor: number,
): number {
   if (purchaseUnit === baseUnit) return purchasedQty;
   try {
      // biome-ignore lint/suspicious/noExplicitAny: UOM unit symbols are dynamic
      const m = of(purchasedQty, purchaseUnit as any);
      // biome-ignore lint/suspicious/noExplicitAny: UOM unit symbols are dynamic
      const converted = convert(m, baseUnit as any);
      return Number(converted.value) / Math.pow(10, converted.scale);
   } catch {
      return purchasedQty * factor;
   }
}

// =============================================================================
// Validation Schemas
// =============================================================================

const productSchema = createInsertSchema(inventoryProducts).pick({
   name: true,
   description: true,
   baseUnit: true,
   purchaseUnit: true,
   purchaseUnitFactor: true,
   sellingPrice: true,
});

const movementSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("purchase"),
      productId: z.string().uuid(),
      purchasedQty: z.number().positive(),
      unitPrice: z.number().positive().optional(),
      totalAmount: z.number().positive(),
      supplierId: z.string().uuid().optional(),
      date: z.string().date(),
      notes: z.string().optional(),
      bankAccountId: z.string().uuid().optional(),
      creditCardId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
   }),
   z.object({
      type: z.literal("sale"),
      productId: z.string().uuid(),
      qty: z.number().positive(),
      unitPrice: z.number().positive().optional(),
      totalAmount: z.number().positive(),
      date: z.string().date(),
      notes: z.string().optional(),
   }),
   z.object({
      type: z.literal("waste"),
      productId: z.string().uuid(),
      qty: z.number().positive(),
      date: z.string().date(),
      notes: z.string().optional(),
   }),
]);

const settingsSchema = createInsertSchema(inventorySettings).omit({
   teamId: true,
   createdAt: true,
   updatedAt: true,
});

// =============================================================================
// Products
// =============================================================================

export const getProducts = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listInventoryProducts(db, teamId);
});

export const createProduct = protectedProcedure
   .input(productSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createInventoryProduct(db, {
         teamId,
         name: input.name,
         description: input.description ?? null,
         baseUnit: input.baseUnit,
         purchaseUnit: input.purchaseUnit,
         purchaseUnitFactor: input.purchaseUnitFactor ?? "1",
         sellingPrice: input.sellingPrice ?? null,
      });
   });

export const updateProduct = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(productSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { id, ...data } = input;
      const product = await getInventoryProduct(db, id);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado." });
      }
      return updateInventoryProduct(db, id, data);
   });

export const archiveProduct = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const product = await getInventoryProduct(db, input.id);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado." });
      }
      return archiveInventoryProduct(db, input.id);
   });

// =============================================================================
// Movements
// =============================================================================

export const registerMovement = protectedProcedure
   .input(movementSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const product = await getInventoryProduct(db, input.productId);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado." });
      }

      const settings = await getInventorySettings(db, teamId);

      let transactionId: string | null = null;
      let baseQty: number;
      let unitPrice: number | undefined;

      if (input.type === "purchase") {
         baseQty = toBaseQty(
            input.purchasedQty,
            product.purchaseUnit,
            product.baseUnit,
            Number(product.purchaseUnitFactor),
         );
         unitPrice = input.unitPrice ?? input.totalAmount / baseQty;

         try {
            const bankAccountId =
               input.bankAccountId ?? settings?.purchaseBankAccountId;
            if (bankAccountId) {
               const tx = await createTransaction(db, {
                  teamId,
                  type: "expense",
                  name: `Compra: ${product.name} - ${input.purchasedQty} ${product.purchaseUnit}`,
                  amount: String(input.totalAmount),
                  date: input.date,
                  bankAccountId,
                  creditCardId: input.creditCardId ?? settings?.purchaseCreditCardId ?? null,
                  categoryId: input.categoryId ?? settings?.purchaseCategoryId ?? null,
                  contactId: input.supplierId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            }
         } catch {
            // Transaction creation is non-fatal — inventory is source of truth
         }
      } else if (input.type === "sale") {
         baseQty = input.qty;
         unitPrice = input.unitPrice ?? input.totalAmount / baseQty;

         if (Number(product.currentStock) < baseQty) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Estoque insuficiente para registrar a venda.",
            });
         }

         try {
            const bankAccountId = settings?.purchaseBankAccountId;
            if (bankAccountId) {
               const tx = await createTransaction(db, {
                  teamId,
                  type: "income",
                  name: `Venda: ${product.name} - ${baseQty} ${product.baseUnit}`,
                  amount: String(input.totalAmount),
                  date: input.date,
                  bankAccountId,
                  categoryId: settings?.saleCategoryId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            }
         } catch {
            // non-fatal
         }
      } else {
         // waste
         baseQty = input.qty;

         if (Number(product.currentStock) < baseQty) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Estoque insuficiente para registrar o descarte.",
            });
         }

         const lossAmount = baseQty * Number(product.sellingPrice ?? 0);
         if (lossAmount > 0 && settings?.purchaseBankAccountId) {
            try {
               const tx = await createTransaction(db, {
                  teamId,
                  type: "expense",
                  name: `Desperdício: ${product.name} - ${baseQty} ${product.baseUnit}`,
                  amount: String(lossAmount),
                  date: input.date,
                  bankAccountId: settings.purchaseBankAccountId,
                  categoryId: settings?.wasteCategoryId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            } catch {
               // non-fatal
            }
         }
      }

      const [movement] = await Promise.all([
         createInventoryMovement(db, {
            teamId,
            productId: product.id,
            type: input.type,
            qty: String(baseQty),
            unitPrice: unitPrice != null ? String(unitPrice) : null,
            totalAmount:
               input.type !== "waste" ? String(input.totalAmount) : null,
            supplierId:
               input.type === "purchase" ? (input.supplierId ?? null) : null,
            transactionId,
            notes: input.notes ?? null,
            date: input.date,
         }),
         adjustProductStock(db, product.id, input.type, baseQty),
      ]);

      return movement;
   });

export const getMovements = protectedProcedure
   .input(z.object({ productId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listInventoryMovements(db, input.productId, teamId);
   });

// =============================================================================
// Settings
// =============================================================================

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return getInventorySettings(db, teamId);
});

export const upsertSettings = protectedProcedure
   .input(settingsSchema.partial())
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return upsertInventorySettings(db, teamId, input);
   });
