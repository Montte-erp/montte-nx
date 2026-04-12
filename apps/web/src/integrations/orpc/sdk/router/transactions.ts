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
import dayjs from "dayjs";
import { WebAppError } from "@core/logging/errors";
import { emitFinanceTransactionCreated } from "@packages/events/finance";
import { createBillableProcedure } from "../billable";
import { sdkProcedure } from "../server";

function mapTransaction(tx: {
   createdAt?: string | Date | null;
   updatedAt?: string | Date | null;
   date?: string | Date | null;
   [key: string]: unknown;
}) {
   return {
      ...tx,
      date:
         typeof tx.date === "string"
            ? tx.date
            : dayjs(tx.date).format("YYYY-MM-DD"),
      createdAt: dayjs(tx.createdAt).toISOString(),
      updatedAt: dayjs(tx.updatedAt).toISOString(),
   };
}

export const list = sdkProcedure
   .input(ListTransactionsFilterSchema)
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const result = await listTransactions(context.db, {
         teamId: context.teamId,
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
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const tx = await ensureTransactionOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      return mapTransaction(tx);
   });

export const create = createBillableProcedure("finance.transaction_created")
   .input(CreateTransactionSchema)
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const { tagIds, ...data } = input;
      await validateTransactionReferences(context.db, context.teamId, {
         bankAccountId: data.bankAccountId,
         destinationBankAccountId: data.destinationBankAccountId,
         categoryId: data.categoryId,
         contactId: data.contactId,
         tagIds,
         date: data.date,
      });
      const tx = await createTransaction(
         context.db,
         context.teamId,
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
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const { id, tagIds, ...data } = input;
      await ensureTransactionOwnership(context.db, id, context.teamId);
      if (Object.keys(data).length > 0 || tagIds) {
         await validateTransactionReferences(context.db, context.teamId, {
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
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      await ensureTransactionOwnership(context.db, input.id, context.teamId);
      await deleteTransaction(context.db, input.id);
      return { success: true };
   });

export const summary = sdkProcedure
   .input(ListTransactionsFilterSchema)
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      return await getTransactionsSummary(context.db, {
         teamId: context.teamId,
         ...input,
      });
   });
