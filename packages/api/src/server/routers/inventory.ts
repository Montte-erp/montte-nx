import {
   addItemUom,
   createInventoryItem,
   deleteInventoryItem,
   getInventoryItem,
   getItemCounterparties,
   getStockLevel,
   getStockMovements,
   getStockValuation,
   linkItemCounterparty,
   listInventoryItems,
   recordStockMovement,
   removeItemUom,
   unlinkItemCounterparty,
   updateInventoryItem,
} from "@packages/database/repositories/inventory-repository";
import { APIError } from "@packages/utils/errors";
import { z } from "zod";
import {
   addItemUomSchema,
   createItemSchema,
   getMovementsSchema,
   idSchema,
   itemIdSchema,
   linkCounterpartySchema,
   listItemsSchema,
   recordMovementSchema,
   updateItemSchema,
} from "../schemas/inventory";
import { protectedProcedure, router } from "../trpc";

export const inventoryRouter = router({
   // =============================================================================
   // Item CRUD
   // =============================================================================

   create: protectedProcedure
      .input(createItemSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return createInventoryItem(resolvedCtx.db, {
            ...input,
            id: crypto.randomUUID(),
            organizationId,
         });
      }),

   update: protectedProcedure
      .input(updateItemSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.id,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         const { id, ...updateData } = input;

         return updateInventoryItem(resolvedCtx.db, id, organizationId, updateData);
      }),

   delete: protectedProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.id,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return deleteInventoryItem(resolvedCtx.db, input.id, organizationId);
      }),

   getById: protectedProcedure
      .input(idSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const item = await getInventoryItem(
            resolvedCtx.db,
            input.id,
            organizationId,
         );

         if (!item) {
            throw APIError.notFound("Inventory item not found");
         }

         return item;
      }),

   list: protectedProcedure
      .input(listItemsSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return listInventoryItems(resolvedCtx.db, organizationId, {
            page: input.page,
            limit: input.pageSize,
            search: input.search,
            type: input.type,
         });
      }),

   // =============================================================================
   // UoM Management
   // =============================================================================

   addUom: protectedProcedure
      .input(addItemUomSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.inventoryItemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return addItemUom(resolvedCtx.db, {
            ...input,
            id: crypto.randomUUID(),
         });
      }),

   removeUom: protectedProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;

         return removeItemUom(resolvedCtx.db, input.id);
      }),

   // =============================================================================
   // Stock Movements
   // =============================================================================

   recordMovement: protectedProcedure
      .input(recordMovementSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.itemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return recordStockMovement(resolvedCtx.db, {
            id: crypto.randomUUID(),
            inventoryItemId: input.itemId,
            organizationId,
            type: input.type,
            reason: input.reason,
            quantity: input.quantity,
            unitCost: input.unitCost,
            currency: input.currency,
            date: input.date,
            notes: input.notes,
            counterpartyId: input.counterpartyId,
            transactionId: input.transactionId,
         });
      }),

   getMovements: protectedProcedure
      .input(getMovementsSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.itemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return getStockMovements(
            resolvedCtx.db,
            input.itemId,
            organizationId,
            {
               page: input.page,
               limit: input.pageSize,
            },
         );
      }),

   // =============================================================================
   // Stock Queries
   // =============================================================================

   getStockLevel: protectedProcedure
      .input(itemIdSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.itemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return getStockLevel(resolvedCtx.db, input.itemId);
      }),

   getStockValuation: protectedProcedure
      .input(itemIdSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.itemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return getStockValuation(resolvedCtx.db, input.itemId);
      }),

   getStockSummary: protectedProcedure
      .input(itemIdSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.itemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         const [stockLevel, stockValuation] = await Promise.all([
            getStockLevel(resolvedCtx.db, input.itemId),
            getStockValuation(resolvedCtx.db, input.itemId),
         ]);

         return {
            item: existingItem,
            stockLevel,
            stockValuation,
         };
      }),

   // =============================================================================
   // Counterparty Links
   // =============================================================================

   linkCounterparty: protectedProcedure
      .input(linkCounterpartySchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.itemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return linkItemCounterparty(resolvedCtx.db, {
            id: crypto.randomUUID(),
            inventoryItemId: input.itemId,
            counterpartyId: input.counterpartyId,
            role: input.role,
            unitPrice: input.unitPrice,
            currency: input.currency,
            minOrderQuantity: input.minOrderQuantity,
            leadTimeDays: input.leadTimeDays,
            notes: input.notes,
         });
      }),

   unlinkCounterparty: protectedProcedure
      .input(idSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;

         return unlinkItemCounterparty(resolvedCtx.db, input.id);
      }),

   getCounterparties: protectedProcedure
      .input(itemIdSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingItem = await getInventoryItem(
            resolvedCtx.db,
            input.itemId,
            organizationId,
         );

         if (!existingItem) {
            throw APIError.notFound("Inventory item not found");
         }

         return getItemCounterparties(resolvedCtx.db, input.itemId);
      }),
});
