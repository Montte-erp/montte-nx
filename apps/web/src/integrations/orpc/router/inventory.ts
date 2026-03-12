import {
   archiveInventoryProduct,
   createInventoryMovement,
   createInventoryProduct,
   ensureProductOwnership,
   getInventorySettings,
   listInventoryMovements,
   listInventoryProducts,
   toBaseQty,
   updateInventoryProduct,
   upsertInventorySettings,
} from "@core/database/repositories/inventory-repository";
import { createTransaction } from "@core/database/repositories/transactions-repository";
import {
   createInventoryProductSchema,
   inventorySettings,
   updateInventoryProductSchema,
} from "@core/database/schemas/inventory";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

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

export const getProducts = protectedProcedure.handler(async ({ context }) => {
   return listInventoryProducts(context.teamId);
});

export const createProduct = protectedProcedure
   .input(createInventoryProductSchema)
   .handler(async ({ context, input }) => {
      return createInventoryProduct(context.teamId, input);
   });

export const updateProduct = protectedProcedure
   .input(idSchema.merge(updateInventoryProductSchema.partial()))
   .handler(async ({ context, input }) => {
      await ensureProductOwnership(input.id, context.teamId);
      const { id, ...data } = input;
      return updateInventoryProduct(id, data);
   });

export const archiveProduct = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureProductOwnership(input.id, context.teamId);
      return archiveInventoryProduct(input.id);
   });

export const registerMovement = protectedProcedure
   .input(movementSchema)
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const product = await ensureProductOwnership(input.productId, teamId);
      const settings = await getInventorySettings(teamId);

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
               const tx = await createTransaction(teamId, {
                  type: "expense",
                  name: `Compra: ${product.name} - ${input.purchasedQty} ${product.purchaseUnit}`,
                  amount: String(input.totalAmount),
                  date: input.date,
                  bankAccountId,
                  creditCardId:
                     input.creditCardId ??
                     settings?.purchaseCreditCardId ??
                     null,
                  categoryId:
                     input.categoryId ?? settings?.purchaseCategoryId ?? null,
                  contactId: input.supplierId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            }
         } catch {}
      } else if (input.type === "sale") {
         baseQty = input.qty;
         unitPrice = input.unitPrice ?? input.totalAmount / baseQty;

         try {
            const bankAccountId = settings?.purchaseBankAccountId;
            if (bankAccountId) {
               const tx = await createTransaction(teamId, {
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
         } catch {}
      } else {
         baseQty = input.qty;

         const lossAmount = baseQty * Number(product.sellingPrice ?? 0);
         if (lossAmount > 0 && settings?.purchaseBankAccountId) {
            try {
               const tx = await createTransaction(teamId, {
                  type: "expense",
                  name: `Desperdício: ${product.name} - ${baseQty} ${product.baseUnit}`,
                  amount: String(lossAmount),
                  date: input.date,
                  bankAccountId: settings.purchaseBankAccountId,
                  categoryId: settings?.wasteCategoryId ?? null,
                  description: input.notes ?? null,
               });
               transactionId = tx?.id ?? null;
            } catch {}
         }
      }

      const baseMovementData = {
         productId: product.id,
         qty: String(baseQty),
         supplierId:
            input.type === "purchase" ? (input.supplierId ?? null) : null,
         transactionId,
         notes: input.notes ?? null,
         date: input.date,
      };

      const movementData =
         input.type === "waste"
            ? { ...baseMovementData, type: "waste" as const }
            : {
                 ...baseMovementData,
                 type: input.type,
                 unitPrice: String(unitPrice ?? 0),
              };

      return createInventoryMovement(teamId, movementData);
   });

export const getMovements = protectedProcedure
   .input(z.object({ productId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return listInventoryMovements(input.productId, context.teamId);
   });

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   return getInventorySettings(context.teamId);
});

export const upsertSettings = protectedProcedure
   .input(settingsSchema.partial())
   .handler(async ({ context, input }) => {
      return upsertInventorySettings(context.teamId, input);
   });
