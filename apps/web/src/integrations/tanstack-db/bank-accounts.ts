import { queryCollectionOptions } from "@tanstack/query-db-collection";
import dayjs from "dayjs";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection } from "@tanstack/react-db";
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
   const initialBalance = input.initialBalance;

   return {
      id,
      teamId,
      status: "active",
      color: input.color,
      iconUrl: input.iconUrl ?? "",
      bankCode: input.bankCode ?? "",
      bankName: input.bankName ?? "",
      branch: input.branch ?? "",
      accountNumber: input.accountNumber ?? "",
      name: input.name,
      type: input.type ?? "checking",
      initialBalance,
      initialBalanceDate: input.initialBalanceDate ?? null,
      notes: input.notes ?? "",
      currentBalance: initialBalance,
      projectedBalance: initialBalance,
      createdAt: now,
      updatedAt: now,
   } as BankAccountsCollectionRow;
}

async function safeRefetchBankAccounts(collection: BankAccountsCollection) {
   await collection.utils.refetch().catch(() => {});
}

export function bankAccountsCollectionOptions({
   queryClient,
   teamId,
}: BankAccountsCollectionInputParams) {
   return queryCollectionOptions({
      id: `bank-accounts:${teamId}`,
      queryKey: ["bank-accounts", teamId],
      queryFn: async () => {
         return orpc.bankAccounts.getAll.call();
      },
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
