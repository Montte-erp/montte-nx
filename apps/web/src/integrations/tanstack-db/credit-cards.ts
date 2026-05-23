import dayjs from "dayjs";
import {
   parseOrderByExpression,
   parseWhereExpression,
   queryCollectionOptions,
} from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection, LoadSubsetOptions } from "@tanstack/react-db";
import { z } from "zod";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

export type CreditCardsCollectionRow =
   Outputs["creditCards"]["getAll"]["data"][number];

export type CreditCardCreateInput = Inputs["creditCards"]["create"];
export type CreditCardUpdateInput = Inputs["creditCards"]["update"];
export type CreditCardBulkCreateInput = Inputs["creditCards"]["bulkCreate"];

type CreditCardsCollectionInput = NonNullable<Inputs["creditCards"]["getAll"]>;

type CreditCardSortId = NonNullable<
   CreditCardsCollectionInput["sorting"]
>[number]["id"];

type CreditCardsCollectionOptionsParams = {
   queryClient: QueryClient;
   teamId: string;
};

type CreditCardsWhereInput = {
   search?: string;
   status?: "active" | "blocked" | "cancelled";
};

type CreditCardCreateActionInput = {
   row: CreditCardsCollectionRow;
   input: CreditCardCreateInput;
};

type CreditCardUpdateActionInput = {
   id: string;
   patch: Omit<CreditCardUpdateInput, "id">;
};

type CreditCardIdInput = {
   id: string;
};

type CreditCardsBulkIdsInput = {
   ids: string[];
};

type CreditCardsBulkCreateActionInput = {
   rows: Array<{
      row: CreditCardsCollectionRow;
      input: CreditCardBulkCreateInput["cards"][number];
   }>;
};

type CreditCardsCollection = Collection<CreditCardsCollectionRow, string>;

type OptimisticCreditCardInput = CreditCardCreateInput & {
   status?: CreditCardsCollectionRow["status"];
};

const creditCardCollectionSchema = z.object({
   id: z.string(),
   teamId: z.string(),
   name: z.string(),
   color: z.string(),
   iconUrl: z.string().nullable(),
   creditLimit: z.string(),
   last4: z.string().nullable(),
   closingDay: z.number(),
   dueDay: z.number(),
   bankAccountId: z.string(),
   status: z.enum(["active", "blocked", "cancelled"]),
   brand: z
      .enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"])
      .nullable(),
   createdAt: z.date(),
   updatedAt: z.date(),
});

function cleanSearchPattern(value: unknown) {
   if (typeof value !== "string") return undefined;
   const cleaned = value.replace(/^%+|%+$/g, "").trim();
   return cleaned || undefined;
}

function parseCreditCardStatus(value: unknown) {
   if (value === "active" || value === "blocked" || value === "cancelled") {
      return value;
   }
   return undefined;
}

function parseCreditCardsWhere(options: LoadSubsetOptions | undefined) {
   return (
      parseWhereExpression<CreditCardsWhereInput>(options?.where, {
         handlers: {
            eq: (field: Array<string | number>, value: unknown) => {
               if (field.join(".") === "status") {
                  return { status: parseCreditCardStatus(value) };
               }
               return {};
            },
            ilike: (field: Array<string | number>, value: unknown) => {
               if (field.join(".") !== "name") return {};
               return { search: cleanSearchPattern(value) };
            },
            and: (...filters: CreditCardsWhereInput[]) =>
               filters.reduce((acc, filter) => ({ ...acc, ...filter }), {}),
            or: (...filters: CreditCardsWhereInput[]) => {
               const search = filters.find((filter) => filter.search)?.search;
               return search ? { search } : {};
            },
         },
         onUnknownOperator: () => ({}),
      }) ?? {}
   );
}

function parseCreditCardSortId(value: string): CreditCardSortId | undefined {
   switch (value) {
      case "bankAccountId":
      case "brand":
      case "closingDay":
      case "creditLimit":
      case "dueDay":
      case "name":
      case "status":
         return value;
   }
}

function parseCreditCardsSorting(options: LoadSubsetOptions | undefined) {
   return parseOrderByExpression(options?.orderBy)
      .map((sort) => {
         const id = parseCreditCardSortId(sort.field.join("."));
         if (!id) return undefined;
         return { id, desc: sort.direction === "desc" };
      })
      .filter((sort) => sort !== undefined);
}

function creditCardsInputFromLoadSubsetOptions(
   options: LoadSubsetOptions | undefined,
): CreditCardsCollectionInput {
   const where = parseCreditCardsWhere(options);
   const sorting = parseCreditCardsSorting(options);
   const limit = options?.limit;
   const input: CreditCardsCollectionInput = {
      page: 1,
      pageSize: 1000,
      search: where.search,
      status: where.status,
      sorting,
   };

   if (limit !== undefined) {
      const pageSize = Math.min(1000, Math.max(1, limit));
      const offset = options?.offset ?? 0;
      input.page = Math.floor(offset / pageSize) + 1;
      input.pageSize = pageSize;
   }

   return input;
}

function hasLoadSubsetOptions(options: LoadSubsetOptions | undefined) {
   return Boolean(
      options?.where ||
      options?.orderBy?.length ||
      options?.limit !== undefined ||
      options?.offset !== undefined,
   );
}

async function safeRefetchCreditCards(collection: CreditCardsCollection) {
   await collection.utils.refetch().catch(() => {});
}

export function buildOptimisticCreditCardRowId(prefix = "__credit_card_") {
   if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function") {
         return `${prefix}${crypto.randomUUID()}`;
      }

      if (typeof crypto.getRandomValues === "function") {
         const bytes = new Uint8Array(16);
         crypto.getRandomValues(bytes);
         const hex = Array.from(bytes, (byte) =>
            byte.toString(16).padStart(2, "0"),
         ).join("");
         return `${prefix}${hex}`;
      }
   }

   return `${prefix}${dayjs().valueOf().toString(36)}`;
}

export function buildOptimisticCreditCardRow({
   id,
   input,
   teamId,
}: {
   id: string;
   input: OptimisticCreditCardInput;
   teamId: string;
}): CreditCardsCollectionRow {
   const now = dayjs().toDate();
   return {
      id,
      teamId,
      name: input.name,
      color: input.color ?? "#6366f1",
      iconUrl: input.iconUrl ?? null,
      creditLimit: input.creditLimit ?? "0",
      last4: input.last4 ?? null,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      bankAccountId: input.bankAccountId,
      status: input.status ?? "active",
      brand: input.brand ?? null,
      createdAt: now,
      updatedAt: now,
   };
}

export function creditCardsCollectionOptions({
   queryClient,
   teamId,
}: CreditCardsCollectionOptionsParams) {
   return queryCollectionOptions({
      id: `credit-cards:${teamId}`,
      queryKey: (options) =>
         hasLoadSubsetOptions(options)
            ? [
                 "credit-cards",
                 teamId,
                 creditCardsInputFromLoadSubsetOptions(options),
              ]
            : ["credit-cards", teamId],
      queryFn: async (ctx) => {
         const result = await orpc.creditCards.getAll.call(
            creditCardsInputFromLoadSubsetOptions(ctx.meta?.loadSubsetOptions),
         );
         return result.data;
      },
      queryClient,
      getKey: (card: CreditCardsCollectionRow) => card.id,
      schema: creditCardCollectionSchema,
      refetchInterval: 5_000,
      syncMode: "on-demand",
   });
}

export function createCreditCardAction(collection: CreditCardsCollection) {
   return createOptimisticAction<CreditCardCreateActionInput>({
      onMutate: ({ row }) => {
         collection.insert(row);
      },
      mutationFn: async ({ input }) => {
         const created = await orpc.creditCards.create.call(input);
         await safeRefetchCreditCards(collection);
         return created;
      },
   });
}

export function updateCreditCardAction(collection: CreditCardsCollection) {
   return createOptimisticAction<CreditCardUpdateActionInput>({
      onMutate: ({ id, patch }) => {
         collection.update(id, (draft) => {
            if (patch.name !== undefined) draft.name = patch.name;
            if (patch.color !== undefined) draft.color = patch.color;
            if (patch.iconUrl !== undefined) draft.iconUrl = patch.iconUrl;
            if (patch.creditLimit !== undefined)
               draft.creditLimit = patch.creditLimit;
            if (patch.last4 !== undefined) draft.last4 = patch.last4;
            if (patch.closingDay !== undefined)
               draft.closingDay = patch.closingDay;
            if (patch.dueDay !== undefined) draft.dueDay = patch.dueDay;
            if (patch.bankAccountId !== undefined)
               draft.bankAccountId = patch.bankAccountId;
            if (patch.status !== undefined) draft.status = patch.status;
            if (patch.brand !== undefined) draft.brand = patch.brand;
            draft.updatedAt = dayjs().toDate();
         });
      },
      mutationFn: async ({ id, patch }) => {
         const updated = await orpc.creditCards.update.call({ id, ...patch });
         await safeRefetchCreditCards(collection);
         return updated;
      },
   });
}

export function deleteCreditCardAction(collection: CreditCardsCollection) {
   return createOptimisticAction<CreditCardIdInput>({
      onMutate: ({ id }) => {
         collection.delete(id);
      },
      mutationFn: async ({ id }) => {
         const removed = await orpc.creditCards.remove.call({ id });
         await safeRefetchCreditCards(collection);
         return removed;
      },
   });
}

export function bulkDeleteCreditCardsAction(collection: CreditCardsCollection) {
   return createOptimisticAction<CreditCardsBulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.delete(ids);
      },
      mutationFn: async ({ ids }) => {
         const removed = await orpc.creditCards.bulkRemove.call({ ids });
         await safeRefetchCreditCards(collection);
         return removed;
      },
   });
}

export function bulkCreateCreditCardsAction(collection: CreditCardsCollection) {
   return createOptimisticAction<CreditCardsBulkCreateActionInput>({
      onMutate: ({ rows }) => {
         collection.insert(rows.map((row) => row.row));
      },
      mutationFn: async ({ rows }) => {
         const created = await orpc.creditCards.bulkCreate.call({
            cards: rows.map((row) => row.input),
         });
         await safeRefetchCreditCards(collection);
         return created;
      },
   });
}

export type CreditCardSummaryCollectionRow =
   Outputs["transactions"]["getSummary"] & {
      id: string;
      creditCardId: string;
      dateFrom: string;
      dateTo: string;
   };

type CreditCardSummaryCollectionOptionsParams = {
   queryClient: QueryClient;
   creditCardId: string;
   dateFrom: string;
   dateTo: string;
};

export function creditCardSummaryCollectionOptions({
   queryClient,
   creditCardId,
   dateFrom,
   dateTo,
}: CreditCardSummaryCollectionOptionsParams) {
   const id = `${creditCardId}:${dateFrom}:${dateTo}`;
   return queryCollectionOptions({
      id: `credit-card-summary:${id}`,
      queryKey: () => ["credit-card-summary", id],
      queryFn: async () => {
         const summary = await orpc.transactions.getSummary.call({
            creditCardId,
            dateFrom,
            dateTo,
         });
         return [{ ...summary, id, creditCardId, dateFrom, dateTo }];
      },
      queryClient,
      getKey: (summary: CreditCardSummaryCollectionRow) => summary.id,
      refetchInterval: 5_000,
      syncMode: "on-demand",
   });
}
