import {
   type ConditionGroup,
   type EvaluationContext,
   evaluateConditionGroup,
} from "@f-o-t/condition-evaluator";
import { setTransactionCategories } from "@packages/database/repositories/category-repository";
import { setTransactionTags } from "@packages/database/repositories/tag-repository";
import {
   createTransactionAttachment,
   deleteTransactionAttachment,
   findTransactionAttachmentById,
   findTransactionAttachmentsByTransactionId,
} from "@packages/database/repositories/transaction-attachment-repository";
import {
   createTransaction,
   createTransfer,
   deleteTransaction,
   deleteTransactions,
   findMatchingTransferTransaction,
   findTransactionById,
   findTransactionsByOrganizationId,
   findTransactionsByOrganizationIdPaginated,
   findTransferCandidates,
   getTotalExpensesByOrganizationId,
   getTotalIncomeByOrganizationId,
   getTotalTransactionsByOrganizationId,
   getTotalTransfersByOrganizationId,
   updateTransaction,
   updateTransactionsCategory,
} from "@packages/database/repositories/transaction-repository";
import {
   createTransferLog,
   findTransferLogByTransactionId,
} from "@packages/database/repositories/transfer-log-repository";
import type { CategorySplit } from "@packages/database/schemas/transactions";
import {
   deleteFile,
   generatePresignedPutUrl,
   streamFileForProxy,
   verifyFileExists,
} from "@packages/files/client";
import { checkBudgetAlertsAfterTransaction } from "@packages/notifications/budget-alerts";
import { emitBudgetWorkflowEvents } from "@packages/workflows/budget-events";
import { APIError } from "@packages/utils/errors";
import { validateCategorySplits as validateSplits } from "@packages/utils/split";
import { enqueueWorkflowEvent } from "@packages/workflows/queue/producer";
import {
   createTransactionCreatedEvent,
   createTransactionUpdatedEvent,
   type TransactionEventData,
} from "@packages/workflows/types/events";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const ALLOWED_ATTACHMENT_TYPES = [
   "application/pdf",
   "image/jpeg",
   "image/png",
   "image/webp",
];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

const categorySplitSchema = z.object({
   categoryId: z.string().uuid(),
   splitType: z.literal("amount"),
   value: z.number().nonnegative(),
});

const createTransactionSchema = z.object({
   amount: z.number(),
   bankAccountId: z.string().optional(),
   categoryIds: z.array(z.string()).optional(),
   categorySplits: z.array(categorySplitSchema).nullable().optional(),
   costCenterId: z.string().optional(),
   date: z.string(),
   description: z.string(),
   tagIds: z.array(z.string()).optional(),
   type: z.enum(["income", "expense", "transfer"]),
});

const updateTransactionSchema = z.object({
   amount: z.number().optional(),
   bankAccountId: z.string().optional(),
   categoryIds: z.array(z.string()).optional(),
   categorySplits: z.array(categorySplitSchema).nullable().optional(),
   costCenterId: z.string().nullable().optional(),
   date: z.string().optional(),
   description: z.string().optional(),
   tagIds: z.array(z.string()).optional(),
   type: z.enum(["income", "expense", "transfer"]).optional(),
});

const paginationSchema = z.object({
   bankAccountId: z.string().optional(),
   categoryId: z.string().optional(),
   categoryIds: z.array(z.string()).optional(),
   costCenterId: z.string().optional(),
   endDate: z.string().optional(),
   limit: z.coerce.number().min(1).max(100).default(5),
   orderBy: z.enum(["date", "amount"]).default("date"),
   orderDirection: z.enum(["asc", "desc"]).default("desc"),
   page: z.coerce.number().min(1).default(1),
   search: z.string().optional(),
   startDate: z.string().optional(),
   tagId: z.string().optional(),
   type: z.enum(["income", "expense", "transfer"]).optional(),
});

function validateCategorySplitsForTransaction(
   categorySplits:
      | { categoryId: string; value: number; splitType: "amount" }[]
      | null
      | undefined,
   categoryIds: string[],
   amountInDecimal: number,
): void {
   if (!categorySplits || categorySplits.length === 0) {
      return;
   }

   const amountInCents = Math.round(amountInDecimal * 100);
   const result = validateSplits(categorySplits, categoryIds, amountInCents);

   if (!result.isValid) {
      throw APIError.validation(result.errors.join("; "));
   }
}

function buildTransactionEventData(
   transaction: NonNullable<Awaited<ReturnType<typeof findTransactionById>>>,
   previousData?: Partial<TransactionEventData>,
): TransactionEventData {
   return {
      amount: Number(transaction.amount),
      bankAccountId: transaction.bankAccountId,
      categoryIds: transaction.transactionCategories?.map(
         (tc) => tc.category.id,
      ),
      costCenterId: transaction.costCenterId,
      date: transaction.date.toISOString(),
      description: transaction.description,
      id: transaction.id,
      organizationId: transaction.organizationId,
      previousData,
      tagIds: transaction.transactionTags?.map((tt) => tt.tag.id),
      type: transaction.type as "income" | "expense" | "transfer",
   };
}

export const transactionRouter = router({
   requestAttachmentUploadUrl: protectedProcedure
      .input(
         z.object({
            contentType: z
               .string()
               .refine((val) => ALLOWED_ATTACHMENT_TYPES.includes(val), {
                  message: "File type must be PDF, JPEG, PNG, or WebP",
               }),
            fileName: z.string(),
            fileSize: z
               .number()
               .max(MAX_ATTACHMENT_SIZE, "File size must be less than 10MB"),
            transactionId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const { fileName, contentType, fileSize, transactionId } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            transactionId,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         const attachmentId = crypto.randomUUID();
         const storageKey = `transactions/${organizationId}/${transactionId}/attachments/${attachmentId}/${fileName}`;
         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         const presignedUrl = await generatePresignedPutUrl(
            storageKey,
            bucketName,
            minioClient,
            300,
         );

         return {
            presignedUrl,
            storageKey,
            attachmentId,
            contentType,
            fileSize,
         };
      }),

   confirmAttachmentUpload: protectedProcedure
      .input(
         z.object({
            attachmentId: z.string(),
            contentType: z.string(),
            fileName: z.string(),
            fileSize: z.number(),
            storageKey: z.string(),
            transactionId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const {
            attachmentId,
            contentType,
            fileName,
            fileSize,
            storageKey,
            transactionId,
         } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            transactionId,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         if (
            !storageKey.startsWith(
               `transactions/${organizationId}/${transactionId}/attachments/`,
            )
         ) {
            throw APIError.validation(
               "Invalid storage key for this transaction",
            );
         }

         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         const fileInfo = await verifyFileExists(
            storageKey,
            bucketName,
            minioClient,
         );

         if (!fileInfo) {
            throw APIError.validation("File was not uploaded successfully");
         }

         const attachment = await createTransactionAttachment(resolvedCtx.db, {
            contentType,
            fileName,
            fileSize: fileSize || fileInfo.size,
            id: attachmentId,
            storageKey,
            transactionId,
         });

         return attachment;
      }),

   cancelAttachmentUpload: protectedProcedure
      .input(
         z.object({
            storageKey: z.string(),
            transactionId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const { storageKey, transactionId } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            transactionId,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         if (
            !storageKey.startsWith(
               `transactions/${organizationId}/${transactionId}/attachments/`,
            )
         ) {
            throw APIError.validation(
               "Invalid storage key for this transaction",
            );
         }

         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         try {
            await deleteFile(storageKey, bucketName, minioClient);
         } catch (error) {
            console.error("Error deleting cancelled upload:", error);
         }

         return { success: true };
      }),

   completeTransferLink: protectedProcedure
      .input(
         z.object({
            notes: z.string().optional(),
            otherBankAccountId: z.string(),
            transactionId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         if (!existingTransaction.bankAccountId) {
            throw APIError.validation("Transaction must have a bank account");
         }

         const existingLog = await findTransferLogByTransactionId(
            resolvedCtx.db,
            input.transactionId,
         );

         if (existingLog) {
            throw APIError.conflict(
               "Transfer already has a linked transaction",
            );
         }

         const amount = parseFloat(existingTransaction.amount);
         const isOutgoing = amount < 0;

         const counterpartTransaction = await createTransaction(
            resolvedCtx.db,
            {
               amount: (-amount).toString(),
               bankAccountId: input.otherBankAccountId,
               date: existingTransaction.date,
               description: existingTransaction.description,
               id: crypto.randomUUID(),
               organizationId,
               type: "transfer",
            },
         );

         await updateTransaction(resolvedCtx.db, input.transactionId, {
            type: "transfer",
         });

         const log = await createTransferLog(resolvedCtx.db, {
            fromBankAccountId: isOutgoing
               ? existingTransaction.bankAccountId
               : input.otherBankAccountId,
            fromTransactionId: isOutgoing
               ? input.transactionId
               : counterpartTransaction.id,
            notes: input.notes || null,
            organizationId,
            toBankAccountId: isOutgoing
               ? input.otherBankAccountId
               : existingTransaction.bankAccountId,
            toTransactionId: isOutgoing
               ? counterpartTransaction.id
               : input.transactionId,
         });

         return {
            counterpartTransaction,
            log,
         };
      }),
   create: protectedProcedure
      .input(createTransactionSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         validateCategorySplitsForTransaction(
            input.categorySplits,
            input.categoryIds ?? [],
            input.amount,
         );

         const transaction = await createTransaction(resolvedCtx.db, {
            ...input,
            amount: input.amount.toString(),
            categorySplits:
               input.categorySplits && input.categorySplits.length > 0
                  ? input.categorySplits
                  : null,
            costCenterId: input.costCenterId || undefined,
            date: new Date(input.date),
            id: crypto.randomUUID(),
            organizationId,
         });

         if (input.categoryIds && input.categoryIds.length > 0) {
            await setTransactionCategories(
               resolvedCtx.db,
               transaction.id,
               input.categoryIds,
            );
         }

         if (input.tagIds && input.tagIds.length > 0) {
            await setTransactionTags(
               resolvedCtx.db,
               transaction.id,
               input.tagIds,
            );
         }

         const createdTransaction = await findTransactionById(
            resolvedCtx.db,
            transaction.id,
         );

         if (input.type === "expense") {
            const userId = resolvedCtx.session?.user.id;
            if (userId) {
               checkBudgetAlertsAfterTransaction({
                  db: resolvedCtx.db,
                  organizationId,
                  userId,
                  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
                  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
                  vapidSubject: process.env.VAPID_SUBJECT,
               }).catch((err: unknown) => {
                  console.error("Error checking budget alerts:", err);
               });
            }

            // Emit workflow events for budget thresholds
            emitBudgetWorkflowEvents({
               db: resolvedCtx.db,
               organizationId,
            }).catch((err: unknown) => {
               console.error("Error emitting budget workflow events:", err);
            });
         }

         if (createdTransaction) {
            const event = createTransactionCreatedEvent(
               organizationId,
               buildTransactionEventData(createdTransaction),
            );
            enqueueWorkflowEvent(event).catch((err: unknown) => {
               console.error("Error emitting transaction created event:", err);
            });
         }

         return {
            transaction: createdTransaction,
         };
      }),

   delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            input.id,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         return deleteTransaction(resolvedCtx.db, input.id);
      }),

   deleteAttachment: protectedProcedure
      .input(z.object({ attachmentId: z.string(), transactionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         const attachment = await findTransactionAttachmentById(
            resolvedCtx.db,
            input.attachmentId,
         );

         if (!attachment || attachment.transactionId !== input.transactionId) {
            throw APIError.notFound("Attachment not found");
         }

         try {
            const bucketName = resolvedCtx.minioBucket;
            const minioClient = resolvedCtx.minioClient;
            await minioClient.removeObject(bucketName, attachment.storageKey);
         } catch (error) {
            console.error("Error deleting attachment file:", error);
         }

         await deleteTransactionAttachment(resolvedCtx.db, input.attachmentId);

         return { success: true };
      }),

   deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.string()).min(1) }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transactions = await Promise.all(
            input.ids.map((id) => findTransactionById(resolvedCtx.db, id)),
         );

         const validIds = transactions
            .filter(
               (t): t is NonNullable<typeof t> =>
                  t !== null &&
                  t !== undefined &&
                  t.organizationId === organizationId,
            )
            .map((t) => t.id);

         if (validIds.length === 0) {
            throw APIError.notFound("No valid transactions found");
         }

         return deleteTransactions(resolvedCtx.db, validIds);
      }),

   findTransferCandidates: protectedProcedure
      .input(
         z.object({
            toBankAccountId: z.string(),
            transactionId: z.string(),
         }),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         const amount = Number(transaction.amount);
         const inverseAmount = -amount;

         const candidates = await findTransferCandidates(resolvedCtx.db, {
            amount: inverseAmount,
            bankAccountId: input.toBankAccountId,
            date: transaction.date,
            description: transaction.description,
            organizationId,
         });

         const exactMatch = candidates.find((c) => c.score >= 90) || null;
         const fuzzyMatches = candidates.filter(
            (c) => c.score < 90 && c.score >= 50,
         );

         return {
            exactMatch: exactMatch
               ? {
                    matchReason: exactMatch.matchReason,
                    score: exactMatch.score,
                    transaction: exactMatch.transaction,
                 }
               : null,
            fuzzyMatches: fuzzyMatches.map((c) => ({
               matchReason: c.matchReason,
               score: c.score,
               transaction: c.transaction,
            })),
         };
      }),

   getAll: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return findTransactionsByOrganizationId(resolvedCtx.db, organizationId);
   }),

   getAllPaginated: protectedProcedure
      .input(paginationSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findTransactionsByOrganizationIdPaginated(
            resolvedCtx.db,
            organizationId,
            {
               ...input,
               endDate: input.endDate ? new Date(input.endDate) : undefined,
               startDate: input.startDate
                  ? new Date(input.startDate)
                  : undefined,
            },
         );
      }),

   getAttachment: protectedProcedure
      .input(z.object({ transactionId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         if (!transaction.attachmentKey) {
            return null;
         }

         const bucketName = resolvedCtx.minioBucket;
         const key = transaction.attachmentKey;

         try {
            const { buffer, contentType } = await streamFileForProxy(
               key,
               bucketName,
               resolvedCtx.minioClient,
            );
            const base64 = buffer.toString("base64");
            return {
               contentType,
               data: `data:${contentType};base64,${base64}`,
               fileName: key.split("/").pop() || "attachment",
            };
         } catch (error) {
            console.error("Error fetching transaction attachment:", error);
            return null;
         }
      }),

   getAttachmentData: protectedProcedure
      .input(z.object({ attachmentId: z.string(), transactionId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         const attachment = await findTransactionAttachmentById(
            resolvedCtx.db,
            input.attachmentId,
         );

         if (!attachment || attachment.transactionId !== input.transactionId) {
            throw APIError.notFound("Attachment not found");
         }

         const bucketName = resolvedCtx.minioBucket;

         try {
            const { buffer, contentType } = await streamFileForProxy(
               attachment.storageKey,
               bucketName,
               resolvedCtx.minioClient,
            );
            const base64 = buffer.toString("base64");
            return {
               contentType,
               data: `data:${contentType};base64,${base64}`,
               fileName: attachment.fileName,
               id: attachment.id,
            };
         } catch (error) {
            console.error("Error fetching attachment:", error);
            return null;
         }
      }),

   getAttachments: protectedProcedure
      .input(z.object({ transactionId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         const attachments = await findTransactionAttachmentsByTransactionId(
            resolvedCtx.db,
            input.transactionId,
         );

         return attachments;
      }),

   getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.id,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         return transaction;
      }),

   getStats: protectedProcedure
      .input(
         z
            .object({
               bankAccountId: z.string().optional(),
               endDate: z.string().optional(),
               startDate: z.string().optional(),
            })
            .optional(),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const bankAccountId = input?.bankAccountId;
         const startDate = input?.startDate
            ? new Date(input.startDate)
            : undefined;
         const endDate = input?.endDate ? new Date(input.endDate) : undefined;

         const [totalTransactions, totalIncome, totalExpenses, totalTransfers] =
            await Promise.all([
               getTotalTransactionsByOrganizationId(
                  resolvedCtx.db,
                  organizationId,
                  bankAccountId,
                  startDate,
                  endDate,
               ),
               getTotalIncomeByOrganizationId(
                  resolvedCtx.db,
                  organizationId,
                  bankAccountId,
                  startDate,
                  endDate,
               ),
               getTotalExpensesByOrganizationId(
                  resolvedCtx.db,
                  organizationId,
                  bankAccountId,
                  startDate,
                  endDate,
               ),
               getTotalTransfersByOrganizationId(
                  resolvedCtx.db,
                  organizationId,
                  bankAccountId,
                  startDate,
                  endDate,
               ),
            ]);

         return {
            totalExpenses: totalExpenses || 0,
            totalIncome: totalIncome || 0,
            totalTransactions,
            totalTransfers: totalTransfers || 0,
         };
      }),

   getTransferLog: protectedProcedure
      .input(z.object({ transactionId: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         if (transaction.type !== "transfer") {
            return null;
         }

         const transferLogData = await findTransferLogByTransactionId(
            resolvedCtx.db,
            input.transactionId,
         );

         return transferLogData;
      }),

   linkTransferTransactions: protectedProcedure
      .input(
         z.object({
            fromTransactionId: z.string(),
            notes: z.string().optional(),
            toTransactionId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const [fromTransaction, toTransaction] = await Promise.all([
            findTransactionById(resolvedCtx.db, input.fromTransactionId),
            findTransactionById(resolvedCtx.db, input.toTransactionId),
         ]);

         if (
            !fromTransaction ||
            fromTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("From transaction not found");
         }

         if (
            !toTransaction ||
            toTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("To transaction not found");
         }

         if (!fromTransaction.bankAccountId || !toTransaction.bankAccountId) {
            throw APIError.validation(
               "Both transactions must have a bank account",
            );
         }

         await Promise.all([
            updateTransaction(resolvedCtx.db, input.fromTransactionId, {
               type: "transfer",
            }),
            updateTransaction(resolvedCtx.db, input.toTransactionId, {
               type: "transfer",
            }),
         ]);

         const log = await createTransferLog(resolvedCtx.db, {
            fromBankAccountId: fromTransaction.bankAccountId,
            fromTransactionId: input.fromTransactionId,
            notes: input.notes || null,
            organizationId,
            toBankAccountId: toTransaction.bankAccountId,
            toTransactionId: input.toTransactionId,
         });

         return log;
      }),

   markAsTransfer: protectedProcedure
      .input(
         z.object({
            ids: z.array(z.string()).min(1),
            matchedTransactionIds: z.record(z.string(), z.string()).optional(),
            toBankAccountId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transactions = await Promise.all(
            input.ids.map((id) => findTransactionById(resolvedCtx.db, id)),
         );

         const validTransactions = transactions.filter(
            (t): t is NonNullable<typeof t> =>
               t !== null &&
               t !== undefined &&
               t.organizationId === organizationId &&
               t.bankAccountId !== null,
         );

         if (validTransactions.length === 0) {
            throw APIError.notFound("No valid transactions found");
         }

         const results = await Promise.all(
            validTransactions.map(async (t) => {
               const amount = Number(t.amount);

               await updateTransaction(resolvedCtx.db, t.id, {
                  type: "transfer",
               });

               let counterpartId: string;

               const userMatchedId = input.matchedTransactionIds?.[t.id];

               if (userMatchedId) {
                  await updateTransaction(resolvedCtx.db, userMatchedId, {
                     type: "transfer",
                  });
                  counterpartId = userMatchedId;
               } else {
                  const exactMatch = await findMatchingTransferTransaction(
                     resolvedCtx.db,
                     {
                        amount: -amount,
                        bankAccountId: input.toBankAccountId,
                        date: t.date,
                        organizationId,
                     },
                  );

                  if (exactMatch) {
                     await updateTransaction(resolvedCtx.db, exactMatch.id, {
                        type: "transfer",
                     });
                     counterpartId = exactMatch.id;
                  } else {
                     const counterpart = await createTransaction(
                        resolvedCtx.db,
                        {
                           amount: (-amount).toString(),
                           bankAccountId: input.toBankAccountId,
                           date: t.date,
                           description: t.description,
                           id: crypto.randomUUID(),
                           organizationId,
                           type: "transfer",
                        },
                     );
                     counterpartId = counterpart.id;
                  }
               }

               await createTransferLog(resolvedCtx.db, {
                  fromBankAccountId: t.bankAccountId as string,
                  fromTransactionId: t.id,
                  id: crypto.randomUUID(),
                  notes: null,
                  organizationId,
                  toBankAccountId: input.toBankAccountId,
                  toTransactionId: counterpartId,
               });

               return t.id;
            }),
         );

         return results;
      }),

   removeAttachment: protectedProcedure
      .input(z.object({ transactionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (!transaction || transaction.organizationId !== organizationId) {
            throw APIError.notFound("Transaction not found");
         }

         if (!transaction.attachmentKey) {
            return { success: true };
         }

         try {
            const bucketName = resolvedCtx.minioBucket;
            const minioClient = resolvedCtx.minioClient;
            await minioClient.removeObject(
               bucketName,
               transaction.attachmentKey,
            );
         } catch (error) {
            console.error("Error deleting attachment:", error);
         }

         await updateTransaction(resolvedCtx.db, input.transactionId, {
            attachmentKey: null,
         });

         return { success: true };
      }),

   transfer: protectedProcedure
      .input(
         z.object({
            amount: z.number().positive(),
            date: z.string(),
            description: z.string(),
            fromBankAccountId: z.string(),
            toBankAccountId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return createTransfer(resolvedCtx.db, {
            amount: input.amount,
            date: new Date(input.date),
            description: input.description,
            fromBankAccountId: input.fromBankAccountId,
            organizationId,
            toBankAccountId: input.toBankAccountId,
         });
      }),

   update: protectedProcedure
      .input(
         z.object({
            data: updateTransactionSchema,
            id: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            input.id,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         if (input.data.categorySplits !== undefined) {
            const categoryIds =
               input.data.categoryIds ??
               existingTransaction.transactionCategories?.map(
                  (tc) => tc.category.id,
               ) ??
               [];
            const amount =
               input.data.amount ?? Number(existingTransaction.amount);
            validateCategorySplitsForTransaction(
               input.data.categorySplits,
               categoryIds,
               amount,
            );
         }

         const updateData: {
            amount?: string;
            bankAccountId?: string;
            categorySplits?: CategorySplit[] | null;
            costCenterId?: string | null;
            date?: Date;
            description?: string;
            type?: "income" | "expense" | "transfer";
         } = {};

         if (input.data.amount !== undefined) {
            updateData.amount = input.data.amount.toString();
         }

         if (input.data.date !== undefined) {
            updateData.date = new Date(input.data.date);
         }

         if (input.data.bankAccountId !== undefined) {
            updateData.bankAccountId = input.data.bankAccountId;
         }

         if (input.data.categorySplits !== undefined) {
            updateData.categorySplits = input.data.categorySplits;
         }

         if (input.data.costCenterId !== undefined) {
            updateData.costCenterId = input.data.costCenterId;
         }

         if (input.data.description !== undefined) {
            updateData.description = input.data.description;
         }

         if (input.data.type !== undefined) {
            updateData.type = input.data.type;
         }

         const updatedTransaction = await updateTransaction(
            resolvedCtx.db,
            input.id,
            updateData,
         );

         if (input.data.categoryIds !== undefined) {
            await setTransactionCategories(
               resolvedCtx.db,
               input.id,
               input.data.categoryIds,
            );
         }

         if (input.data.tagIds !== undefined) {
            await setTransactionTags(
               resolvedCtx.db,
               input.id,
               input.data.tagIds,
            );
         }

         const finalTransaction = await findTransactionById(
            resolvedCtx.db,
            input.id,
         );

         if (finalTransaction) {
            const previousData = buildTransactionEventData(existingTransaction);
            const event = createTransactionUpdatedEvent(
               organizationId,
               buildTransactionEventData(finalTransaction, previousData),
            );
            enqueueWorkflowEvent(event).catch((err: unknown) => {
               console.error("Error emitting transaction updated event:", err);
            });
         }

         return {
            transaction: updatedTransaction,
         };
      }),

   updateCategory: protectedProcedure
      .input(
         z.object({
            categoryId: z.string(),
            ids: z.array(z.string()).min(1),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transactions = await Promise.all(
            input.ids.map((id) => findTransactionById(resolvedCtx.db, id)),
         );

         const validIds = transactions
            .filter(
               (t): t is NonNullable<typeof t> =>
                  t !== null &&
                  t !== undefined &&
                  t.organizationId === organizationId,
            )
            .map((t) => t.id);

         if (validIds.length === 0) {
            throw APIError.notFound("No valid transactions found");
         }

         return updateTransactionsCategory(
            resolvedCtx.db,
            validIds,
            input.categoryId,
         );
      }),

   updateCostCenter: protectedProcedure
      .input(
         z.object({
            costCenterId: z.string().nullable(),
            ids: z.array(z.string()).min(1),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transactions = await Promise.all(
            input.ids.map((id) => findTransactionById(resolvedCtx.db, id)),
         );

         const validIds = transactions
            .filter(
               (t): t is NonNullable<typeof t> =>
                  t !== null &&
                  t !== undefined &&
                  t.organizationId === organizationId,
            )
            .map((t) => t.id);

         if (validIds.length === 0) {
            throw APIError.notFound("No valid transactions found");
         }

         const results = await Promise.all(
            validIds.map((id) =>
               updateTransaction(resolvedCtx.db, id, {
                  costCenterId: input.costCenterId,
               }),
            ),
         );

         return results;
      }),

   updateTags: protectedProcedure
      .input(
         z.object({
            ids: z.array(z.string()).min(1),
            tagIds: z.array(z.string()),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const transactions = await Promise.all(
            input.ids.map((id) => findTransactionById(resolvedCtx.db, id)),
         );

         const validIds = transactions
            .filter(
               (t): t is NonNullable<typeof t> =>
                  t !== null &&
                  t !== undefined &&
                  t.organizationId === organizationId,
            )
            .map((t) => t.id);

         if (validIds.length === 0) {
            throw APIError.notFound("No valid transactions found");
         }

         await Promise.all(
            validIds.map((id) =>
               setTransactionTags(resolvedCtx.db, id, input.tagIds),
            ),
         );

         return validIds;
      }),

   uploadAttachment: protectedProcedure
      .input(
         z.object({
            contentType: z
               .string()
               .refine((val) => ALLOWED_ATTACHMENT_TYPES.includes(val), {
                  message: "File type must be PDF, JPEG, PNG, or WebP",
               }),
            fileName: z.string(),
            fileSize: z
               .number()
               .max(MAX_ATTACHMENT_SIZE, "File size must be less than 10MB"),
            transactionId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const { fileName, contentType, fileSize, transactionId } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            transactionId,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         const timestamp = Date.now();
         const storageKey = `transactions/${organizationId}/${transactionId}/attachment/${timestamp}-${fileName}`;
         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         const presignedUrl = await generatePresignedPutUrl(
            storageKey,
            bucketName,
            minioClient,
            300,
         );

         return { presignedUrl, storageKey, contentType, fileSize };
      }),

   confirmUploadAttachment: protectedProcedure
      .input(
         z.object({
            storageKey: z.string(),
            transactionId: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const { storageKey, transactionId } = input;
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTransaction = await findTransactionById(
            resolvedCtx.db,
            transactionId,
         );

         if (
            !existingTransaction ||
            existingTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         if (
            !storageKey.startsWith(
               `transactions/${organizationId}/${transactionId}/attachment/`,
            )
         ) {
            throw APIError.validation(
               "Invalid storage key for this transaction",
            );
         }

         const bucketName = resolvedCtx.minioBucket;
         const minioClient = resolvedCtx.minioClient;

         const fileInfo = await verifyFileExists(
            storageKey,
            bucketName,
            minioClient,
         );

         if (!fileInfo) {
            throw APIError.validation("File was not uploaded successfully");
         }

         if (existingTransaction.attachmentKey) {
            try {
               await deleteFile(
                  existingTransaction.attachmentKey,
                  bucketName,
                  minioClient,
               );
            } catch (error) {
               console.error("Error deleting old attachment:", error);
            }
         }

         await updateTransaction(resolvedCtx.db, transactionId, {
            attachmentKey: storageKey,
         });

         return { key: storageKey };
      }),

   getSimilarTransactions: protectedProcedure
      .input(
         z.object({
            limit: z.number().min(1).max(100).default(5),
            transactionId: z.string(),
         }),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const sourceTransaction = await findTransactionById(
            resolvedCtx.db,
            input.transactionId,
         );

         if (
            !sourceTransaction ||
            sourceTransaction.organizationId !== organizationId
         ) {
            throw APIError.notFound("Transaction not found");
         }

         const sourceAmount = Math.abs(Number(sourceTransaction.amount));
         const sourceCategoryId =
            sourceTransaction.transactionCategories?.[0]?.category.id || null;

         const descriptionWords = sourceTransaction.description
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word.length > 2);
         const mainKeyword = descriptionWords[0] || "";

         let transferCounterpartId: string | null = null;
         if (sourceTransaction.type === "transfer") {
            const transferLog = await findTransferLogByTransactionId(
               resolvedCtx.db,
               input.transactionId,
            );
            if (transferLog) {
               transferCounterpartId =
                  transferLog.fromTransactionId === input.transactionId
                     ? transferLog.toTransactionId
                     : transferLog.fromTransactionId;
            }
         }

         const candidates = await findTransactionsByOrganizationIdPaginated(
            resolvedCtx.db,
            organizationId,
            { limit: 100, page: 1 },
         );

         const excludeIds = new Set([input.transactionId]);
         if (transferCounterpartId) {
            excludeIds.add(transferCounterpartId);
         }

         const conditions: ConditionGroup["conditions"] = [];

         if (sourceCategoryId) {
            conditions.push({
               field: "categoryId",
               id: "category-match",
               operator: "eq",
               options: { weight: 30 },
               type: "string",
               value: sourceCategoryId,
            });
         }

         if (sourceAmount > 0) {
            conditions.push({
               field: "amount",
               id: "amount-proximity",
               operator: "between",
               options: { weight: 30 },
               type: "number",
               value: [sourceAmount * 0.8, sourceAmount * 1.2],
            });
         }

         if (mainKeyword) {
            conditions.push({
               field: "description",
               id: "description-contains",
               operator: "contains",
               options: { caseSensitive: false, weight: 40 },
               type: "string",
               value: mainKeyword,
            });
         }

         if (conditions.length === 0) {
            return [];
         }

         const similarityRule: ConditionGroup = {
            conditions,
            id: "similarity-check",
            operator: "OR",
            scoringMode: "weighted",
            threshold: 30,
         };

         const scoredCandidates = candidates.transactions
            .filter((t) => !excludeIds.has(t.id))
            .map((candidate) => {
               const candidateCategoryId =
                  candidate.transactionCategories?.[0]?.category.id || "";
               const candidateAmount = Math.abs(Number(candidate.amount));

               const context: EvaluationContext = {
                  data: {
                     amount: candidateAmount,
                     categoryId: candidateCategoryId,
                     description: candidate.description.toLowerCase(),
                  },
               };

               const result = evaluateConditionGroup(similarityRule, context);

               return {
                  score: result.totalScore ?? 0,
                  transaction: candidate,
               };
            })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, input.limit);

         return scoredCandidates.map((item) => ({
            score: item.score,
            transaction: item.transaction,
         }));
      }),
});
