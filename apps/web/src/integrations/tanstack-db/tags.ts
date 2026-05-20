import {
   parseOrderByExpression,
   parseWhereExpression,
   queryCollectionOptions,
} from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection, LoadSubsetOptions } from "@tanstack/react-db";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

type TagsCollectionInput = Inputs["tags"]["getAll"];
export type TagsCollectionRow = Outputs["tags"]["getAll"]["data"][number];

type TagsCollectionOptionsParams = {
   queryClient: QueryClient;
};

type TagsWhereInput = {
   includeArchived?: boolean;
   search?: string;
};

type TagCreateInput = {
   row: TagsCollectionRow;
};

type TagsBulkCreateInput = {
   rows: TagsCollectionRow[];
};

type TagsBulkIdsInput = {
   ids: string[];
};

type TagIdInput = {
   id: string;
};

type TagUpdateInput = {
   id: string;
   patch: Partial<Pick<TagsCollectionRow, "color" | "description" | "name">>;
};

type TagSortId = NonNullable<TagsCollectionInput["sorting"]>[number]["id"];

function cleanSearchPattern(value: unknown) {
   if (typeof value !== "string") return undefined;
   const cleaned = value.replace(/^%+|%+$/g, "").trim();
   return cleaned || undefined;
}

function parseTagSortId(value: string): TagSortId | undefined {
   switch (value) {
      case "createdAt":
      case "description":
      case "dreOrder":
      case "isDefault":
      case "name":
         return value;
   }
}

function parseTagsWhere(options: LoadSubsetOptions | undefined) {
   return (
      parseWhereExpression<TagsWhereInput>(options?.where, {
         handlers: {
            eq: (field: Array<string | number>, value: unknown) => {
               if (field.join(".") === "isArchived" && value === false) {
                  return { includeArchived: false };
               }
               return {};
            },
            ilike: (field: Array<string | number>, value: unknown) => {
               const fieldName = field.join(".");
               if (fieldName !== "name" && fieldName !== "description") {
                  return {};
               }
               return { search: cleanSearchPattern(value) };
            },
            and: (...filters: TagsWhereInput[]) =>
               filters.reduce((acc, filter) => ({ ...acc, ...filter }), {}),
            or: (...filters: TagsWhereInput[]) => {
               const search = filters.find((filter) => filter.search)?.search;
               return search ? { search } : {};
            },
         },
         onUnknownOperator: () => ({}),
      }) ?? {}
   );
}

function parseTagsSorting(options: LoadSubsetOptions | undefined) {
   return parseOrderByExpression(options?.orderBy)
      .map((sort) => {
         const id = parseTagSortId(sort.field.join("."));
         if (!id) return undefined;
         return { id, desc: sort.direction === "desc" };
      })
      .filter((sort) => sort !== undefined);
}

function tagsInputFromLoadSubsetOptions(
   options: LoadSubsetOptions | undefined,
): TagsCollectionInput {
   const where = parseTagsWhere(options);
   const limit = options?.limit ?? 20;
   const offset = options?.offset ?? 0;

   return {
      search: where.search,
      includeArchived: where.includeArchived,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      sorting: parseTagsSorting(options),
   };
}

function hasLoadSubsetOptions(options: LoadSubsetOptions | undefined) {
   return Boolean(
      options?.where ||
      options?.orderBy?.length ||
      options?.limit !== undefined ||
      options?.offset !== undefined,
   );
}

export function tagsCollectionOptions({
   queryClient,
}: TagsCollectionOptionsParams) {
   return queryCollectionOptions({
      id: "tags",
      queryKey: (options) =>
         hasLoadSubsetOptions(options)
            ? ["tags", tagsInputFromLoadSubsetOptions(options)]
            : ["tags"],
      queryFn: async (ctx) => {
         const result = await orpc.tags.getAll.call(
            tagsInputFromLoadSubsetOptions(ctx.meta?.loadSubsetOptions),
         );
         return result.data;
      },
      queryClient,
      getKey: (tag: TagsCollectionRow) => tag.id,
      syncMode: "on-demand",
   });
}

export function createTagAction(
   collection: Collection<TagsCollectionRow, string>,
) {
   return createOptimisticAction<TagCreateInput>({
      onMutate: ({ row }) => {
         collection.insert(row);
      },
      mutationFn: async ({ row }) => {
         const created = await orpc.tags.create.call({
            name: row.name,
            color: row.color,
            description: row.description,
         });
         await collection.utils.refetch();
         return created;
      },
   });
}

export function bulkCreateTagsAction(
   collection: Collection<TagsCollectionRow, string>,
) {
   return createOptimisticAction<TagsBulkCreateInput>({
      onMutate: ({ rows }) => {
         collection.insert(rows);
      },
      mutationFn: async ({ rows }) => {
         const created = await orpc.tags.bulkCreate.call({
            items: rows.map((row) => ({
               name: row.name,
               color: row.color,
               description: row.description,
            })),
         });
         await collection.utils.refetch();
         return created;
      },
   });
}

export function updateTagAction(
   collection: Collection<TagsCollectionRow, string>,
) {
   return createOptimisticAction<TagUpdateInput>({
      onMutate: ({ id, patch }) => {
         collection.update(id, (draft) => {
            if (patch.color !== undefined) draft.color = patch.color;
            if (patch.description !== undefined) {
               draft.description = patch.description;
            }
            if (patch.name !== undefined) draft.name = patch.name;
         });
      },
      mutationFn: async ({ id, patch }) => {
         const updated = await orpc.tags.update.call({ id, ...patch });
         await collection.utils.refetch();
         return updated;
      },
   });
}

export function bulkArchiveTagsAction(
   collection: Collection<TagsCollectionRow, string>,
) {
   return createOptimisticAction<TagsBulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.update(ids, (drafts) => {
            for (const draft of drafts) {
               draft.isArchived = true;
            }
         });
      },
      mutationFn: async ({ ids }) => {
         const archived = await orpc.tags.bulkArchive.call({ ids });
         await collection.utils.refetch();
         return archived;
      },
   });
}

export function unarchiveTagAction(
   collection: Collection<TagsCollectionRow, string>,
) {
   return createOptimisticAction<TagIdInput>({
      onMutate: ({ id }) => {
         collection.update(id, (draft) => {
            draft.isArchived = false;
         });
      },
      mutationFn: async ({ id }) => {
         const unarchived = await orpc.tags.unarchive.call({ id });
         await collection.utils.refetch();
         return unarchived;
      },
   });
}

export function bulkDeleteTagsAction(
   collection: Collection<TagsCollectionRow, string>,
) {
   return createOptimisticAction<TagsBulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.delete(ids);
      },
      mutationFn: async ({ ids }) => {
         const removed = await orpc.tags.bulkRemove.call({ ids });
         await collection.utils.refetch();
         return removed;
      },
   });
}
