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
import { emitFinanceCategoryCreated } from "@packages/events/finance";
import { createBillableProcedure } from "../billable";
import { sdkProcedure } from "../server";

function mapCategory(cat: Record<string, unknown>) {
   return {
      ...cat,
      createdAt: (cat.createdAt as Date).toISOString(),
      updatedAt: (cat.updatedAt as Date).toISOString(),
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
      const cats = await listCategories(context.db, context.teamId!, {
         type: input.type,
         includeArchived: input.includeArchived,
      });
      return cats.map(mapCategory);
   });

export const create = createBillableProcedure("finance.category_created")
   .input(CreateCategorySchema)
   .handler(async ({ context, input }) => {
      const cat = await createCategory(context.db, context.teamId!, {
         ...input,
         participatesDre: false,
      });
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
      const { id, ...data } = input;
      await ensureCategoryOwnership(context.db, id, context.teamId!);
      const cat = await updateCategory(context.db, id, data);
      return mapCategory(cat);
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId!);
      await deleteCategory(context.db, input.id);
      return { success: true as const };
   });

export const archive = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId!);
      const cat = await archiveCategory(context.db, input.id);
      return mapCategory(cat!);
   });
