import {
   parseOrderByExpression,
   parseWhereExpression,
   queryCollectionOptions,
} from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection, LoadSubsetOptions } from "@tanstack/react-db";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

type VaultDocumentsInput = Inputs["vault"]["listDocuments"];
export type VaultDocumentRow =
   Outputs["vault"]["listDocuments"]["items"][number];
export type VaultFolderRow = Outputs["vault"]["listFolders"][number];

type VaultWhereInput = {
   search?: string;
};

type VaultSortId = NonNullable<VaultDocumentsInput["sorting"]>[number]["id"];

type CreateDocumentInput = Inputs["vault"]["createDocument"];
type UpdateDocumentInput = Inputs["vault"]["updateDocument"];
type CreateFolderInput = Inputs["vault"]["createFolder"];
type BulkIdsInput = { ids: string[] };

type CollectionOptionsParams = {
   queryClient: QueryClient;
};

function cleanSearchPattern(value: unknown) {
   if (typeof value !== "string") return undefined;
   const cleaned = value.replace(/^%+|%+$/g, "").trim();
   return cleaned || undefined;
}

function parseVaultSortId(value: string): VaultSortId | undefined {
   switch (value) {
      case "description":
      case "source":
      case "status":
      case "title":
      case "updatedAt":
         return value;
   }
}

function parseVaultWhere(options: LoadSubsetOptions | undefined) {
   return (
      parseWhereExpression<VaultWhereInput>(options?.where, {
         handlers: {
            ilike: (field: Array<string | number>, value: unknown) => {
               const fieldName = field.join(".");
               if (
                  fieldName !== "title" &&
                  fieldName !== "description" &&
                  fieldName !== "originalFileName" &&
                  fieldName !== "folderName"
               ) {
                  return {};
               }
               return { search: cleanSearchPattern(value) };
            },
            and: (...filters: VaultWhereInput[]) =>
               filters.reduce((acc, filter) => ({ ...acc, ...filter }), {}),
            or: (...filters: VaultWhereInput[]) => {
               const search = filters.find((filter) => filter.search)?.search;
               return search ? { search } : {};
            },
         },
         onUnknownOperator: () => ({}),
      }) ?? {}
   );
}

function parseVaultSorting(options: LoadSubsetOptions | undefined) {
   return parseOrderByExpression(options?.orderBy)
      .map((sort) => {
         const id = parseVaultSortId(sort.field.join("."));
         if (!id) return undefined;
         return { id, desc: sort.direction === "desc" };
      })
      .filter((sort) => sort !== undefined);
}

function documentsInputFromLoadSubsetOptions(
   options: LoadSubsetOptions | undefined,
): VaultDocumentsInput {
   const where = parseVaultWhere(options);
   const limit = options?.limit ?? 500;
   const offset = options?.offset ?? 0;

   return {
      search: where.search,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      sorting: parseVaultSorting(options),
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

export function vaultDocumentsCollectionOptions({
   queryClient,
}: CollectionOptionsParams) {
   return queryCollectionOptions({
      id: "vault-documents",
      queryKey: (options) =>
         hasLoadSubsetOptions(options)
            ? [
                 "vault",
                 "documents",
                 documentsInputFromLoadSubsetOptions(options),
              ]
            : ["vault", "documents"],
      queryFn: async (ctx) => {
         const result = await orpc.vault.listDocuments.call(
            documentsInputFromLoadSubsetOptions(ctx.meta?.loadSubsetOptions),
         );
         return result.items;
      },
      queryClient,
      getKey: (document: VaultDocumentRow) => document.id,
      syncMode: "on-demand",
   });
}

export function vaultFoldersCollectionOptions({
   queryClient,
}: CollectionOptionsParams) {
   return queryCollectionOptions({
      id: "vault-folders",
      queryKey: () => ["vault", "folders"],
      queryFn: () => orpc.vault.listFolders.call(),
      queryClient,
      getKey: (folder: VaultFolderRow) => folder.id,
      syncMode: "on-demand",
   });
}

export function createVaultDocumentAction(
   collection: Collection<VaultDocumentRow, string>,
) {
   return createOptimisticAction<{ input: CreateDocumentInput }>({
      onMutate: () => {},
      mutationFn: async ({ input }) => {
         const created = await orpc.vault.createDocument.call(input);
         await collection.utils.refetch();
         return created;
      },
   });
}

export function updateVaultDocumentAction(
   collection: Collection<VaultDocumentRow, string>,
) {
   return createOptimisticAction<UpdateDocumentInput>({
      onMutate: ({ id, patch }) => {
         collection.update(id, (draft) => {
            if (patch.title !== undefined) draft.title = patch.title;
            if (patch.description !== undefined)
               draft.description = patch.description;
            if (patch.folderId !== undefined) draft.folderId = patch.folderId;
         });
      },
      mutationFn: async (input) => {
         const updated = await orpc.vault.updateDocument.call(input);
         await collection.utils.refetch();
         return updated;
      },
   });
}

export function createVaultFolderAction(
   collection: Collection<VaultFolderRow, string>,
) {
   return createOptimisticAction<{ input: CreateFolderInput }>({
      onMutate: () => {},
      mutationFn: async ({ input }) => {
         const created = await orpc.vault.createFolder.call(input);
         await collection.utils.refetch();
         return created;
      },
   });
}

export function bulkDeleteVaultDocumentsAction(
   collection: Collection<VaultDocumentRow, string>,
) {
   return createOptimisticAction<BulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.delete(ids);
      },
      mutationFn: async ({ ids }) => {
         const deleted = await orpc.vault.bulkDeleteDocuments.call({ ids });
         await collection.utils.refetch();
         return deleted;
      },
   });
}

export function bulkArchiveVaultDocumentsAction(
   collection: Collection<VaultDocumentRow, string>,
) {
   return createOptimisticAction<BulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.update(ids, (drafts) => {
            for (const draft of drafts) {
               draft.status = "archived";
               draft.statusLabel = "Arquivado";
            }
         });
      },
      mutationFn: async ({ ids }) => {
         const archived = await orpc.vault.bulkArchiveDocuments.call({ ids });
         await collection.utils.refetch();
         return archived;
      },
   });
}
