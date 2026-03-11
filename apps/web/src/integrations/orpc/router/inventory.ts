import { ORPCError } from "@orpc/server";
import {
   archiveInventoryProduct,
   createInventoryMovement,
   createInventoryProduct,
   getInventoryProduct,
   getInventorySettings,
   listInventoryMovements,
   listInventoryProducts,
   toBaseQty,
   updateInventoryProduct,
   upsertInventorySettings,
} from "@core/database/repositories/inventory-repository";
import { createTransaction } from "@core/database/repositories/transactions-repository";
import {
   inventoryProducts,
   inventorySettings,
} from "@core/database/schemas/inventory";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const productSchema = createInsertSchema(inventoryProducts).pick({
   name: true,
   description: true,
   baseUnit: true,
   purchaseUnit: true,
   purchaseUnitFactor: true,
   sellingPrice: true,
   initialStock: true,
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

export const getProducts = protectedProcedure.handler(async ({ context }) => {
   const { teamId } = context;
   return listInventoryProducts(teamId);
});

export const createProduct = protectedProcedure
   .input(productSchema)
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return createInventoryProduct(teamId, {
         name: input.name,
         description: input.description ?? null,
         baseUnit: input.baseUnit,
         purchaseUnit: input.purchaseUnit,
         purchaseUnitFactor: input.purchaseUnitFactor ?? "1",
         sellingPrice: input.sellingPrice ?? null,
         initialStock: input.initialStock ?? "0",
      });
   });

export const updateProduct = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(productSchema.partial()))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const { id, ...data } = input;
      const product = await getInventoryProduct(id);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Produto não encontrado.",
         });
      }
      return updateInventoryProduct(id, data);
   });

export const archiveProduct = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const product = await getInventoryProduct(input.id);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Produto não encontrado.",
         });
      }
      return archiveInventoryProduct(input.id);
   });

export const registerMovement = protectedProcedure
   .input(movementSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      const product = await getInventoryProduct(input.productId);
      if (!product || product.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Produto não encontrado.",
         });
      }

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
               const tx = await createTransaction(db, {
                  teamId,
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
         } catch {}
      } else {
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

      const movement = await createInventoryMovement(teamId, movementData);

      return movement;
   });

export const getMovements = protectedProcedure
   .input(z.object({ productId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return listInventoryMovements(input.productId, teamId);
   });

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const { teamId } = context;
   return getInventorySettings(teamId);
});

export const upsertSettings = protectedProcedure
   .input(settingsSchema.partial())
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return upsertInventorySettings(teamId, input);
   });
