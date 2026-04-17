import { z } from "zod";
import {
   listCategories,
   ensureCategoryOwnership,
   createCategory,
   updateCategory,
   archiveCategory,
   deleteCategory,
} from "@core/database/repositories/categories-repository";
import {
   CreateCategorySchema,
   UpdateCategorySchema,
} from "@montte/cli/contract";
import dayjs from "dayjs";
import { WebAppError } from "@core/logging/errors";
import { emitFinanceCategoryCreated } from "@packages/events/finance";
import { createBillableProcedure } from "../billable";
import { sdkProcedure } from "../server";

function mapCategory(cat: {
   createdAt?: string | Date | null;
   updatedAt?: string | Date | null;
   [key: string]: unknown;
}) {
   return {
      ...cat,
      createdAt: dayjs(cat.createdAt).toISOString(),
      updatedAt: dayjs(cat.updatedAt).toISOString(),
   };
}

export const list = sdkProcedure
   .input(
      z.object({
         type: z.enum(["income", "expense"]).optional(),
         includeArchived: z.boolean().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const result = await listCategories(context.db, context.teamId, {
         type: input.type,
         includeArchived: input.includeArchived,
      });
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return result.value.map(mapCategory);
   });

export const create = createBillableProcedure("finance.category_created")
   .input(CreateCategorySchema)
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const result = await createCategory(context.db, context.teamId, {
         ...input,
         participatesDre: false,
      });
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      const cat = result.value;
      context.scheduleEmit(() =>
         emitFinanceCategoryCreated(context.emit, context.emitCtx, {
            categoryId: cat.id,
         }),
      );
      return mapCategory(cat);
   });

export const update = sdkProcedure
   .input(z.object({ id: z.string().uuid() }).merge(UpdateCategorySchema))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const { id, ...data } = input;
      const ownershipResult = await ensureCategoryOwnership(
         context.db,
         id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const updateResult = await updateCategory(context.db, id, data);
      if (updateResult.isErr())
         throw WebAppError.fromAppError(updateResult.error);
      return mapCategory(updateResult.value);
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const ownershipResult = await ensureCategoryOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const deleteResult = await deleteCategory(context.db, input.id);
      if (deleteResult.isErr())
         throw WebAppError.fromAppError(deleteResult.error);
      return { success: true };
   });

export const archive = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const ownershipResult = await ensureCategoryOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const archiveResult = await archiveCategory(context.db, input.id);
      if (archiveResult.isErr())
         throw WebAppError.fromAppError(archiveResult.error);
      if (!archiveResult.value)
         throw WebAppError.notFound("Categoria não encontrada.");
      return mapCategory(archiveResult.value);
   });
