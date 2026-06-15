import {
   parseOrderByExpression,
   parseWhereExpression,
   queryCollectionOptions,
} from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection, LoadSubsetOptions } from "@tanstack/react-db";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

type NfeInput = Inputs["fiscal"]["listNfe"];
export type NfeRow = Outputs["fiscal"]["listNfe"]["items"][number];

type NfeWhereInput = {
   search?: string;
};

type NfeSortId = NonNullable<NfeInput["sorting"]>[number]["id"];
type CreateNfeInput = Inputs["fiscal"]["createNfe"];
type BulkIdsInput = { ids: string[] };

type CollectionOptionsParams = {
   queryClient: QueryClient;
};

function cleanSearchPattern(value: unknown) {
   if (typeof value !== "string") return undefined;
   const cleaned = value.replace(/^%+|%+$/g, "").trim();
   return cleaned || undefined;
}

function parseNfeSortId(value: string): NfeSortId | undefined {
   switch (value) {
      case "accessKey":
      case "issuerName":
      case "issuedAt":
      case "number":
      case "recipientName":
      case "series":
      case "status":
      case "totalAmountCents":
      case "updatedAt":
         return value;
   }
}

function parseNfeWhere(options: LoadSubsetOptions | undefined) {
   return (
      parseWhereExpression<NfeWhereInput>(options?.where, {
         handlers: {
            ilike: (field: Array<string | number>, value: unknown) => {
               const fieldName = field.join(".");
               if (
                  fieldName !== "accessKey" &&
                  fieldName !== "issuerName" &&
                  fieldName !== "number" &&
                  fieldName !== "recipientName" &&
                  fieldName !== "series"
               ) {
                  return {};
               }
               return { search: cleanSearchPattern(value) };
            },
            and: (...filters: NfeWhereInput[]) =>
               filters.reduce((acc, filter) => ({ ...acc, ...filter }), {}),
            or: (...filters: NfeWhereInput[]) => {
               const search = filters.find((filter) => filter.search)?.search;
               return search ? { search } : {};
            },
         },
         onUnknownOperator: () => ({}),
      }) ?? {}
   );
}

function parseNfeSorting(options: LoadSubsetOptions | undefined) {
   return parseOrderByExpression(options?.orderBy)
      .map((sort) => {
         const id = parseNfeSortId(sort.field.join("."));
         if (!id) return undefined;
         return { id, desc: sort.direction === "desc" };
      })
      .filter((sort) => sort !== undefined);
}

function nfeInputFromLoadSubsetOptions(
   options: LoadSubsetOptions | undefined,
): NfeInput {
   const where = parseNfeWhere(options);
   const limit = options?.limit ?? 500;
   const offset = options?.offset ?? 0;

   return {
      search: where.search,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      sorting: parseNfeSorting(options),
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

export function nfeCollectionOptions({ queryClient }: CollectionOptionsParams) {
   return queryCollectionOptions({
      id: "fiscal-nfe",
      queryKey: (options) =>
         hasLoadSubsetOptions(options)
            ? ["fiscal", "nfe", nfeInputFromLoadSubsetOptions(options)]
            : ["fiscal", "nfe"],
      queryFn: async (ctx) => {
         const result = await orpc.fiscal.listNfe.call(
            nfeInputFromLoadSubsetOptions(ctx.meta?.loadSubsetOptions),
         );
         return result.items;
      },
      queryClient,
      getKey: (nfe: NfeRow) => nfe.id,
      syncMode: "on-demand",
   });
}

export function createNfeAction(collection: Collection<NfeRow, string>) {
   return createOptimisticAction<{ input: CreateNfeInput }>({
      onMutate: () => {},
      mutationFn: async ({ input }) => {
         const created = await orpc.fiscal.createNfe.call(input);
         await collection.utils.refetch();
         return created;
      },
   });
}

export function bulkArchiveNfeAction(collection: Collection<NfeRow, string>) {
   return createOptimisticAction<BulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.update(ids, (drafts) => {
            for (const draft of drafts) {
               draft.status = "archived";
               draft.statusLabel = "Arquivada";
            }
         });
      },
      mutationFn: async ({ ids }) => {
         const archived = await orpc.fiscal.bulkArchiveNfe.call({ ids });
         await collection.utils.refetch();
         return archived;
      },
   });
}
