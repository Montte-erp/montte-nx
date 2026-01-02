import {
   createTransaction,
   findMatchingTransferTransaction,
   updateTransaction,
} from "@packages/database/repositories/transaction-repository";
import { createTransferLog } from "@packages/database/repositories/transfer-log-repository";
import type { Consequence } from "@packages/database/schema";
import { negate, of, toDecimal } from "@packages/money";
import {
   type ActionHandler,
   type ActionHandlerContext,
   createActionResult,
   createSkippedResult,
} from "../types";

export const markAsTransferHandler: ActionHandler = {
   type: "mark_as_transfer",

   async execute(consequence: Consequence, context: ActionHandlerContext) {
      const { toBankAccountId } = consequence.payload;

      if (!toBankAccountId) {
         return createSkippedResult(
            consequence,
            "Destination bank account ID is required",
         );
      }

      const transactionId = context.eventData.id as string | undefined;
      const amount = context.eventData.amount as number | undefined;
      const date = context.eventData.date as Date | string | undefined;
      const description = context.eventData.description as string | undefined;
      const fromBankAccountId = context.eventData.bankAccountId as
         | string
         | undefined;

      if (!transactionId) {
         return createSkippedResult(consequence, "Transaction ID is required");
      }

      if (amount === undefined || amount === null) {
         return createSkippedResult(consequence, "Transaction amount is required");
      }

      if (!date) {
         return createSkippedResult(consequence, "Transaction date is required");
      }

      if (!fromBankAccountId) {
         return createSkippedResult(
            consequence,
            "Transaction bank account ID is required",
         );
      }

      if (fromBankAccountId === toBankAccountId) {
         return createSkippedResult(
            consequence,
            "Source and destination bank accounts cannot be the same",
         );
      }

      const numericAmount = Number(amount);
      const isOutgoing = numericAmount < 0;
      const transactionDate = new Date(date);

      if (context.dryRun) {
         return createActionResult(consequence, true, {
            counterpartAmount: -numericAmount,
            description,
            dryRun: true,
            fromBankAccountId: isOutgoing ? fromBankAccountId : toBankAccountId,
            isOutgoing,
            toBankAccountId: isOutgoing ? toBankAccountId : fromBankAccountId,
            transactionDate: transactionDate.toISOString(),
            transactionId,
         });
      }

      try {
         await updateTransaction(context.db, transactionId, {
            type: "transfer",
         });

         let counterpartId: string;

         const exactMatch = await findMatchingTransferTransaction(context.db, {
            amount: -numericAmount,
            bankAccountId: toBankAccountId,
            date: transactionDate,
            organizationId: context.organizationId,
         });

         if (exactMatch) {
            await updateTransaction(context.db, exactMatch.id, {
               type: "transfer",
            });
            counterpartId = exactMatch.id;
         } else {
            const counterpart = await createTransaction(context.db, {
               amount: toDecimal(negate(of(String(numericAmount), "BRL"))),
               bankAccountId: toBankAccountId,
               date: transactionDate,
               description: description || "",
               id: crypto.randomUUID(),
               organizationId: context.organizationId,
               type: "transfer",
            });
            counterpartId = counterpart.id;
         }

         await createTransferLog(context.db, {
            fromBankAccountId: isOutgoing ? fromBankAccountId : toBankAccountId,
            fromTransactionId: isOutgoing ? transactionId : counterpartId,
            id: crypto.randomUUID(),
            notes: null,
            organizationId: context.organizationId,
            toBankAccountId: isOutgoing ? toBankAccountId : fromBankAccountId,
            toTransactionId: isOutgoing ? counterpartId : transactionId,
         });

         return createActionResult(consequence, true, {
            counterpartCreated: !exactMatch,
            counterpartId,
            counterpartMatched: !!exactMatch,
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
      if (!config.toBankAccountId) {
         errors.push("Destination bank account ID is required");
      }
      return { errors, valid: errors.length === 0 };
   },
};
