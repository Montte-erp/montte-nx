import {
   parseOrderByExpression,
   parseWhereExpression,
   queryCollectionOptions,
} from "@tanstack/query-db-collection";
import dayjs from "dayjs";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection, LoadSubsetOptions } from "@tanstack/react-db";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

export type BankAccountsCollectionRow =
   Outputs["bankAccounts"]["getAll"][number];

export type BankAccountCreateInput = Inputs["bankAccounts"]["create"];
export type BankAccountUpdateInput = Inputs["bankAccounts"]["update"];

export type BankAccountBulkCreateInput = Inputs["bankAccounts"]["bulkCreate"];

type BankAccountsCollectionInputParams = {
   queryClient: QueryClient;
   teamId: string;
};

type BankAccountsCollectionInput = NonNullable<
   Inputs["bankAccounts"]["getAll"]
>;

type BankAccountSortId = NonNullable<
   BankAccountsCollectionInput["sorting"]
>[number]["id"];

type BankAccountsCollectionSubset = {
   search?: string;
   status?: "active" | "archived";
   type?: "checking" | "savings" | "investment" | "payment" | "cash";
};

function cleanSearchPattern(value: unknown) {
   if (typeof value !== "string") return undefined;
   const cleaned = value.replace(/^%+|%+$/g, "").trim();
   return cleaned || undefined;
}

function parseBankAccountsWhere(
   options: LoadSubsetOptions | undefined,
): BankAccountsCollectionSubset {
   return (
      parseWhereExpression<BankAccountsCollectionSubset>(options?.where, {
         handlers: {
            eq: (field: Array<string | number>, value: unknown) => {
               const key = field.join(".");
               if (key === "type" && typeof value === "string") {
                  if (
                     value === "checking" ||
                     value === "savings" ||
                     value === "investment" ||
                     value === "payment" ||
                     value === "cash"
                  ) {
                     return { type: value };
                  }
                  return {};
               }
               if (key === "status" && value === "active")
                  return { status: "active" };
               if (key === "status" && value === "archived")
                  return { status: "archived" };
               return {};
            },
            ilike: (field: Array<string | number>, value: unknown) => {
               if (field.join(".") !== "name") return {};
               return { search: cleanSearchPattern(value) };
            },
            and: (...filters: BankAccountsCollectionSubset[]) =>
               filters.reduce((acc, filter) => ({ ...acc, ...filter }), {}),
            or: (...filters: BankAccountsCollectionSubset[]) => {
               const search = filters.find((filter) => filter.search)?.search;
               return search ? { search } : {};
            },
         },
         onUnknownOperator: () => ({}),
      }) ?? {}
   );
}

function parseBankAccountsSortId(value: string): BankAccountSortId | undefined {
   switch (value) {
      case "name":
      case "type":
      case "initialBalance":
      case "currentBalance":
      case "projectedBalance":
      case "createdAt":
      case "updatedAt":
         return value;
   }
}

function parseBankAccountsSorting(options: LoadSubsetOptions | undefined) {
   return parseOrderByExpression(options?.orderBy)
      .map((sort) => {
         const id = parseBankAccountsSortId(sort.field.join("."));
         if (!id) return undefined;
         return { id, desc: sort.direction === "desc" };
      })
      .filter((sort) => sort !== undefined);
}

type BankAccountCreateActionInput = {
   row: BankAccountsCollectionRow;
   input: BankAccountCreateInput;
};

type BankAccountUpdateActionInput = {
   id: string;
   patch: Omit<BankAccountUpdateInput, "id">;
};

type BankAccountDeleteActionInput = {
   id: string;
};

type BankAccountBulkDeleteActionInput = {
   ids: string[];
};

type BankAccountBulkCreateActionInput = {
   rows: BankAccountCreateActionInput[];
};

type BankAccountsCollection = Collection<BankAccountsCollectionRow, string>;
export function buildOptimisticBankAccountRowId(prefix = "__bank_account_") {
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

   return `${prefix}${Date.now().toString(36)}`;
}

export function buildOptimisticBankAccountRow({
   id,
   input,
   teamId,
}: {
   id: string;
   input: BankAccountCreateInput;
   teamId: string;
}): BankAccountsCollectionRow {
   const now = dayjs().toDate();
   const initialBalance = input.initialBalance ?? "0";
   const row: BankAccountsCollectionRow = {
      id,
      teamId,
      status: "active",
      name: input.name,
      type: input.type ?? "checking",
      color: input.color ?? "#6366f1",
      iconUrl: input.iconUrl ?? null,
      bankCode: input.bankCode ?? null,
      bankName: input.bankName ?? null,
      branch: input.branch ?? null,
      accountNumber: input.accountNumber ?? null,
      notes: input.notes ?? null,
      initialBalance,
      initialBalanceDate: input.initialBalanceDate ?? null,
      currentBalance: initialBalance,
      projectedBalance: initialBalance,
      createdAt: now,
      updatedAt: now,
   };

   return row;
}

async function safeRefetchBankAccounts(collection: BankAccountsCollection) {
   await collection.utils.refetch().catch(() => {});
}

function bankAccountsInputFromLoadSubsetOptions(
   options: LoadSubsetOptions | undefined,
): BankAccountsCollectionInput {
   const where = parseBankAccountsWhere(options);
   const sorting = parseBankAccountsSorting(options);
   const limit = options?.limit;
   const input: BankAccountsCollectionInput = {
      search: where.search,
      status: where.status,
      type: where.type,
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
export function bankAccountsCollectionOptions({
   queryClient,
   teamId,
}: BankAccountsCollectionInputParams) {
   return queryCollectionOptions({
      id: `bank-accounts:${teamId}`,
      queryKey: (options) =>
         hasLoadSubsetOptions(options)
            ? [
                 "bank-accounts",
                 teamId,
                 bankAccountsInputFromLoadSubsetOptions(options),
              ]
            : ["bank-accounts", teamId],
      queryFn: async (ctx) =>
         orpc.bankAccounts.getAll.call(
            bankAccountsInputFromLoadSubsetOptions(ctx.meta?.loadSubsetOptions),
         ),
      queryClient,
      getKey: (account: BankAccountsCollectionRow) => account.id,
      refetchInterval: 5_000,
      syncMode: "on-demand",
   });
}

export function createBankAccountAction(collection: BankAccountsCollection) {
   return createOptimisticAction<BankAccountCreateActionInput>({
      onMutate: ({ row }) => {
         collection.insert(row);
      },
      mutationFn: async ({ input }) => {
         const created = await orpc.bankAccounts.create.call(input);
         await safeRefetchBankAccounts(collection);
         return created;
      },
   });
}

export function updateBankAccountAction(collection: BankAccountsCollection) {
   return createOptimisticAction<BankAccountUpdateActionInput>({
      onMutate: ({ id, patch }) => {
         collection.update(id, (draft) => {
            if (patch.name !== undefined) draft.name = patch.name;
            if (patch.type !== undefined) draft.type = patch.type;
            if (patch.color !== undefined) draft.color = patch.color;
            if (patch.iconUrl !== undefined) draft.iconUrl = patch.iconUrl;
            if (patch.bankCode !== undefined) draft.bankCode = patch.bankCode;
            if (patch.bankName !== undefined) draft.bankName = patch.bankName;
            if (patch.branch !== undefined) draft.branch = patch.branch;
            if (patch.accountNumber !== undefined)
               draft.accountNumber = patch.accountNumber;
            if (patch.initialBalance !== undefined)
               draft.initialBalance = patch.initialBalance;
            if (patch.initialBalanceDate !== undefined)
               draft.initialBalanceDate = patch.initialBalanceDate;
            if (patch.notes !== undefined) draft.notes = patch.notes;
            draft.updatedAt = dayjs().toDate();
         });
      },
      mutationFn: async ({ id, patch }) => {
         const updated = await orpc.bankAccounts.update.call({ id, ...patch });
         await safeRefetchBankAccounts(collection);
         return updated;
      },
   });
}

export function deleteBankAccountAction(collection: BankAccountsCollection) {
   return createOptimisticAction<BankAccountDeleteActionInput>({
      onMutate: ({ id }) => {
         collection.delete(id);
      },
      mutationFn: async ({ id }) => {
         const removed = await orpc.bankAccounts.remove.call({ id });
         await safeRefetchBankAccounts(collection);
         return removed;
      },
   });
}

export function bulkDeleteBankAccountsAction(
   collection: BankAccountsCollection,
) {
   return createOptimisticAction<BankAccountBulkDeleteActionInput>({
      onMutate: ({ ids }) => {
         collection.delete(ids);
      },
      mutationFn: async ({ ids }) => {
         const removed = await orpc.bankAccounts.bulkRemove.call({ ids });
         await safeRefetchBankAccounts(collection);
         return removed;
      },
   });
}

export function bulkCreateBankAccountsAction(
   collection: BankAccountsCollection,
) {
   return createOptimisticAction<BankAccountBulkCreateActionInput>({
      onMutate: ({ rows }) => {
         collection.insert(rows.map((row) => row.row));
      },
      mutationFn: async ({ rows }) => {
         const created = await orpc.bankAccounts.bulkCreate.call({
            accounts: rows.map((row) => row.input),
         });
         await safeRefetchBankAccounts(collection);
         return created;
      },
   });
}
