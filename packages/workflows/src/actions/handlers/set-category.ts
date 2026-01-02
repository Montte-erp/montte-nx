import { findCategoriesByOrganizationId } from "@packages/database/repositories/category-repository";
import type { Consequence } from "@packages/database/schema";
import { transaction, transactionCategory } from "@packages/database/schema";
import { reaisToCents } from "@packages/money";
import {
   adjustFixedSplitsProportionally,
   type CategorySplit,
   calculateEqualSplits,
   calculateSplitsFromPercentage,
   createCategoryMap,
   parseDynamicSplits,
} from "@packages/utils/split";
import { eq } from "drizzle-orm";
import {
   type ActionHandler,
   type ActionHandlerContext,
   createActionResult,
   createSkippedResult,
} from "../types";

export const setCategoryHandler: ActionHandler = {
   type: "set_category",

   async execute(consequence: Consequence, context: ActionHandlerContext) {
      const {
         categoryId,
         categoryIds,
         categorySplitMode,
         categorySplits,
         dynamicSplitPattern,
      } = consequence.payload;

      const transactionId = context.eventData.id as string;
      const transactionAmount = reaisToCents(
         Math.abs(Number(context.eventData.amount ?? 0)),
      );
      const description = (context.eventData.description as string) ?? "";

      if (!transactionId) {
         return createActionResult(
            consequence,
            false,
            undefined,
            "No transaction ID in event data",
         );
      }

      let finalCategoryIds: string[] = [];
      let finalSplits: CategorySplit[] | null = null;

      try {
         if (categorySplitMode === "dynamic") {
            const categories = await findCategoriesByOrganizationId(
               context.db,
               context.organizationId,
            );
            const categoryMap = createCategoryMap(categories);
            const parsed = parseDynamicSplits(
               description,
               categoryMap,
               transactionAmount,
               dynamicSplitPattern,
            );

            if (parsed && parsed.length > 0) {
               finalCategoryIds = parsed.map((s) => s.categoryId);
               finalSplits = parsed;
            }
         } else if (categorySplitMode === "equal" && categoryIds?.length) {
            finalCategoryIds = categoryIds;
            if (categoryIds.length > 1) {
               finalSplits = calculateEqualSplits(
                  categoryIds,
                  transactionAmount,
               );
            }
         } else if (
            categorySplitMode === "percentage" &&
            categorySplits?.length
         ) {
            finalCategoryIds = categorySplits.map((s) => s.categoryId);
            finalSplits = calculateSplitsFromPercentage(
               categorySplits,
               transactionAmount,
            );
         } else if (categorySplitMode === "fixed" && categorySplits?.length) {
            finalCategoryIds = categorySplits.map((s) => s.categoryId);
            finalSplits = adjustFixedSplitsProportionally(
               categorySplits,
               transactionAmount,
            );
         } else if (categoryIds?.length) {
            finalCategoryIds = categoryIds;
            if (categoryIds.length > 1) {
               finalSplits = calculateEqualSplits(
                  categoryIds,
                  transactionAmount,
               );
            }
         } else if (categoryId) {
            finalCategoryIds = [categoryId];
         }

         if (finalCategoryIds.length === 0) {
            return createSkippedResult(consequence, "No categories to set");
         }

         if (context.dryRun) {
            return createActionResult(consequence, true, {
               categoryIds: finalCategoryIds,
               dryRun: true,
               splits: finalSplits,
               transactionId,
            });
         }

         await context.db
            .delete(transactionCategory)
            .where(eq(transactionCategory.transactionId, transactionId));

         await context.db.insert(transactionCategory).values(
            finalCategoryIds.map((catId) => ({
               categoryId: catId,
               transactionId,
            })),
         );

         await context.db
            .update(transaction)
            .set({ categorySplits: finalSplits })
            .where(eq(transaction.id, transactionId));

         return createActionResult(consequence, true, {
            categoryIds: finalCategoryIds,
            splits: finalSplits,
            transactionId,
         });
      } catch (error) {
         const message =
            error instanceof Error ? error.message : "Unknown error";
         return createActionResult(consequence, false, undefined, message);
      }
   },

   validate(config) {
      const errors: string[] = [];
      const { categoryId, categoryIds, categorySplitMode, categorySplits } =
         config;

      const hasCategories =
         categoryId || (categoryIds && categoryIds.length > 0);
      const isDynamicMode = categorySplitMode === "dynamic";

      if (!hasCategories && !isDynamicMode) {
         errors.push(
            "At least one category is required (unless using dynamic mode)",
         );
      }

      if (
         (categorySplitMode === "percentage" ||
            categorySplitMode === "fixed") &&
         (!categorySplits || categorySplits.length === 0)
      ) {
         errors.push("Split values are required for percentage/fixed mode");
      }

      if (categorySplitMode === "percentage" && categorySplits) {
         const sum = categorySplits.reduce((acc, s) => acc + s.value, 0);
         if (Math.abs(100 - sum) > 0.01) {
            errors.push(
               `Percentage splits must sum to 100% (current: ${sum}%)`,
            );
         }
      }

      return { errors, valid: errors.length === 0 };
   },
};
