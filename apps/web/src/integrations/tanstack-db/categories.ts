import {
   parseWhereExpression,
   queryCollectionOptions,
} from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection, LoadSubsetOptions } from "@tanstack/react-db";
import { z } from "zod";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

export type CategoriesCollectionRow = Outputs["categories"]["getAll"][number];

type CategoriesCollectionInput = Inputs["categories"]["getAll"];
type CategoryCreateInput = Inputs["categories"]["create"];
type CategoryUpdateInput = Inputs["categories"]["update"];
type CategoryImportInput = Inputs["categoriesBulk"]["importBatch"];

type CategoriesCollectionOptionsParams = {
   queryClient: QueryClient;
};

type CategoriesWhereInput = {
   includeArchived?: boolean;
   search?: string;
   type?: "income" | "expense" | "transfer";
};

type CategoryCreateActionInput = {
   row: CategoriesCollectionRow;
   input: CategoryCreateInput;
};

type CategoryUpdateActionInput = {
   id: string;
   patch: Omit<CategoryUpdateInput, "id"> & {
      type?: "income" | "expense" | "transfer";
   };
};

type CategoryIdInput = {
   id: string;
};

type CategoriesBulkIdsInput = {
   ids: string[];
};

type CategoriesImportActionInput = CategoryImportInput;

const categoryCollectionSchema = z.object({
   id: z.string(),
   teamId: z.string(),
   parentId: z.string().nullable(),
   name: z.string(),
   type: z.enum(["income", "expense", "transfer"]),
   level: z.number(),
   description: z.string().nullable(),
   isDefault: z.boolean(),
   color: z.string().nullable(),
   icon: z.string().nullable(),
   isArchived: z.boolean(),
   notes: z.string().nullable(),
   participatesDre: z.boolean(),
   dreGroupId: z.string().nullable(),
   createdAt: z.date(),
   updatedAt: z.date(),
});

function cleanSearchPattern(value: unknown) {
   if (typeof value !== "string") return undefined;
   const cleaned = value.replace(/^%+|%+$/g, "").trim();
   return cleaned || undefined;
}

function parseCategoryType(
   value: unknown,
): "income" | "expense" | "transfer" | undefined {
   if (value === "income" || value === "expense" || value === "transfer") {
      return value;
   }
   return undefined;
}

function parseCategoriesWhere(options: LoadSubsetOptions | undefined) {
   return (
      parseWhereExpression<CategoriesWhereInput>(options?.where, {
         handlers: {
            eq: (field: Array<string | number>, value: unknown) => {
               const fieldName = field.join(".");
               if (fieldName === "isArchived" && value === false) {
                  return { includeArchived: false };
               }
               if (fieldName === "type") {
                  return { type: parseCategoryType(value) };
               }
               return {};
            },
            ilike: (field: Array<string | number>, value: unknown) => {
               if (field.join(".") !== "name") return {};
               return { search: cleanSearchPattern(value) };
            },
            and: (...filters: CategoriesWhereInput[]) =>
               filters.reduce((acc, filter) => ({ ...acc, ...filter }), {}),
            or: (...filters: CategoriesWhereInput[]) => {
               const search = filters.find((filter) => filter.search)?.search;
               return search ? { search } : {};
            },
         },
         onUnknownOperator: () => ({}),
      }) ?? {}
   );
}

function categoriesInputFromLoadSubsetOptions(
   options: LoadSubsetOptions | undefined,
): CategoriesCollectionInput {
   const where = parseCategoriesWhere(options);
   return {
      includeArchived: where.includeArchived,
      search: where.search,
      type: where.type,
   };
}

function hasLoadSubsetOptions(options: LoadSubsetOptions | undefined) {
   return Boolean(options?.where || options?.orderBy?.length);
}

export function categoriesCollectionOptions({
   queryClient,
}: CategoriesCollectionOptionsParams) {
   return queryCollectionOptions({
      id: "categories",
      queryKey: (options) =>
         hasLoadSubsetOptions(options)
            ? ["categories", categoriesInputFromLoadSubsetOptions(options)]
            : ["categories"],
      queryFn: async (ctx) =>
         orpc.categories.getAll.call(
            categoriesInputFromLoadSubsetOptions(ctx.meta?.loadSubsetOptions),
         ),
      queryClient,
      getKey: (category: CategoriesCollectionRow) => category.id,
      schema: categoryCollectionSchema,
      syncMode: "on-demand",
      refetchInterval: 5_000,
   });
}

export function createCategoryAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return createOptimisticAction<CategoryCreateActionInput>({
      onMutate: ({ row }) => {
         collection.insert(row);
      },
      mutationFn: async ({ input }) => {
         const created = await orpc.categories.create.call(input);
         await collection.utils.refetch();
         return created;
      },
   });
}

export function updateCategoryAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return createOptimisticAction<CategoryUpdateActionInput>({
      onMutate: ({ id, patch }) => {
         collection.update(id, (draft) => {
            if (patch.name !== undefined) draft.name = patch.name;
            if (patch.parentId !== undefined) draft.parentId = patch.parentId;
            if (patch.type !== undefined) draft.type = patch.type;
            if (patch.description !== undefined) {
               draft.description = patch.description;
            }
            if (patch.color !== undefined) draft.color = patch.color;
            if (patch.icon !== undefined) draft.icon = patch.icon;
            if (patch.notes !== undefined) draft.notes = patch.notes;
            if (patch.participatesDre !== undefined) {
               draft.participatesDre = patch.participatesDre;
            }
            if (patch.dreGroupId !== undefined) {
               draft.dreGroupId = patch.dreGroupId;
            }
         });
      },
      mutationFn: async ({ id, patch }) => {
         const updated = await orpc.categories.update.call({ id, ...patch });
         await collection.utils.refetch();
         return updated;
      },
   });
}

export function archiveCategoryAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return createOptimisticAction<CategoryIdInput>({
      onMutate: ({ id }) => {
         collection.update(id, (draft) => {
            draft.isArchived = true;
         });
      },
      mutationFn: async ({ id }) => {
         const archived = await orpc.categories.archive.call({ id });
         await collection.utils.refetch();
         return archived;
      },
   });
}

export function unarchiveCategoryAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return createOptimisticAction<CategoryIdInput>({
      onMutate: ({ id }) => {
         collection.update(id, (draft) => {
            draft.isArchived = false;
         });
      },
      mutationFn: async ({ id }) => {
         const unarchived = await orpc.categories.unarchive.call({ id });
         await collection.utils.refetch();
         return unarchived;
      },
   });
}

export function deleteCategoryAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return createOptimisticAction<CategoryIdInput>({
      onMutate: ({ id }) => {
         collection.delete(id);
      },
      mutationFn: async ({ id }) => {
         const removed = await orpc.categories.remove.call({ id });
         await collection.utils.refetch();
         return removed;
      },
   });
}

export function bulkArchiveCategoriesAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return createOptimisticAction<CategoriesBulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.update(ids, (drafts) => {
            for (const draft of drafts) {
               draft.isArchived = true;
            }
         });
      },
      mutationFn: async ({ ids }) => {
         const archived = await orpc.categoriesBulk.bulkArchive.call({ ids });
         await collection.utils.refetch();
         return archived;
      },
   });
}

export function bulkDeleteCategoriesAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return createOptimisticAction<CategoriesBulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.delete(ids);
      },
      mutationFn: async ({ ids }) => {
         const removed = await orpc.categoriesBulk.bulkRemove.call({ ids });
         await collection.utils.refetch();
         return removed;
      },
   });
}

export function importCategoriesAction(
   collection: Collection<CategoriesCollectionRow, string>,
) {
   return async (input: CategoriesImportActionInput) => {
      const imported = await orpc.categoriesBulk.importBatch.call(input);
      await collection.utils.refetch();
      return imported;
   };
}
