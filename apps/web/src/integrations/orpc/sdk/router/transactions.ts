import { z } from "zod";
import {
   listTransactions,
   getTransactionsSummary,
   ensureTransactionOwnership,
   createTransaction,
   updateTransaction,
   deleteTransaction,
   validateTransactionReferences,
} from "@core/database/repositories/transactions-repository";
import {
   CreateTransactionSchema,
   UpdateTransactionSchema,
   ListTransactionsFilterSchema,
} from "@montte/cli/contract";
import { emitFinanceTransactionCreated } from "@packages/events/finance";
import { createBillableProcedure } from "../billable";
import { sdkProcedure } from "../server";

function mapTransaction(tx: Record<string, unknown>) {
   return {
      ...tx,
      date:
         typeof tx.date === "string"
            ? tx.date
            : (tx.date as Date).toISOString().slice(0, 10),
      createdAt: (tx.createdAt as Date).toISOString(),
      updatedAt: (tx.updatedAt as Date).toISOString(),
   };
}

export const list = sdkProcedure
   .input(ListTransactionsFilterSchema)
   .handler(async ({ context, input }) => {
      const result = await listTransactions(context.db, {
         teamId: context.teamId!,
         ...input,
      });
      return {
         data: result.data.map(mapTransaction),
         total: result.total,
      };
   });

export const get = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const tx = await ensureTransactionOwnership(
         context.db,
         input.id,
         context.teamId!,
      );
      return mapTransaction(tx);
   });

export const create = createBillableProcedure("finance.transaction_created")
   .input(CreateTransactionSchema)
   .handler(async ({ context, input }) => {
      const { tagIds, ...data } = input;
      await validateTransactionReferences(context.db, context.teamId!, {
         bankAccountId: data.bankAccountId,
         destinationBankAccountId: data.destinationBankAccountId,
         categoryId: data.categoryId,
         contactId: data.contactId,
         tagIds,
         date: data.date,
      });
      const tx = await createTransaction(
         context.db,
         context.teamId!,
         data,
         tagIds,
      );
      context.scheduleEmit(() =>
         emitFinanceTransactionCreated(context.emit, context.emitCtx, {
            transactionId: tx.id,
            type: data.type,
            bankAccountId: data.bankAccountId ?? tx.bankAccountId ?? "",
            categoryId: data.categoryId ?? undefined,
            amountCents: Math.round(parseFloat(data.amount) * 100),
         }),
      );
      return mapTransaction(tx);
   });

export const update = sdkProcedure
   .input(z.object({ id: z.string().uuid() }).merge(UpdateTransactionSchema))
   .handler(async ({ context, input }) => {
      const { id, tagIds, ...data } = input;
      await ensureTransactionOwnership(context.db, id, context.teamId!);
      if (Object.keys(data).length > 0 || tagIds) {
         await validateTransactionReferences(context.db, context.teamId!, {
            bankAccountId: data.bankAccountId,
            destinationBankAccountId: data.destinationBankAccountId,
            categoryId: data.categoryId,
            contactId: data.contactId,
            tagIds,
            date: data.date,
         });
      }
      const tx = await updateTransaction(context.db, id, data, tagIds);
      return mapTransaction(tx);
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureTransactionOwnership(context.db, input.id, context.teamId!);
      await deleteTransaction(context.db, input.id);
      return { success: true as const };
   });

export const summary = sdkProcedure
   .input(ListTransactionsFilterSchema)
   .handler(async ({ context, input }) => {
      return await getTransactionsSummary(context.db, {
         teamId: context.teamId!,
         ...input,
      });
   });
