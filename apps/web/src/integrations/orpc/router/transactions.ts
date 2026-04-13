import { and, eq, inArray } from "drizzle-orm";
import {
   ConditionGroup,
   evaluateConditionGroup,
} from "@f-o-t/condition-evaluator";
import {
   bulkCreateTransactions,
   createTransaction,
   createTransactionItems,
   deleteTransaction,
   ensureTransactionOwnership,
   getTransactionsSummary,
   getTransactionWithTags,
   listTransactions,
   replaceTransactionItems,
   updateTransaction,
   updateTransactionCategory,
   validateTransactionReferences,
} from "@core/database/repositories/transactions-repository";
import { ensureBankAccountOwnership } from "@core/database/repositories/bank-accounts-repository";
import {
   createTransactionSchema,
   transactions,
   updateTransactionSchema,
} from "@core/database/schemas/transactions";
import { createEmitFn } from "@packages/events/emit";
import { emitFinanceStatementImported } from "@packages/events/finance";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { startCategorizationWorkflow } from "@/integrations/dbos/workflows/runner";
import { withCreditEnforcement } from "../middlewares/credit-enforcement";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

const tagAndItemsSchema = z.object({
   tagIds: z.array(z.string().uuid()).optional().default([]),
   items: z
      .array(
         z.object({
            serviceId: z.string().uuid().nullable().optional(),
            description: z.string().max(500).nullable().optional(),
            quantity: z.string(),
            unitPrice: z.string(),
         }),
      )
      .optional()
      .default([]),
});

const filterSchema = z
   .object({
      type: z.enum(["income", "expense", "transfer"]).optional(),
      bankAccountId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
      tagId: z.string().uuid().optional(),
      contactId: z.string().uuid().optional(),
      dateFrom: z
         .string()
         .regex(/^\d{4}-\d{2}-\d{2}$/)
         .optional(),
      dateTo: z
         .string()
         .regex(/^\d{4}-\d{2}-\d{2}$/)
         .optional(),
      search: z.string().max(100).optional(),
      creditCardId: z.string().uuid().optional(),
      uncategorized: z.boolean().optional(),
      paymentMethod: z.string().optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
      conditionGroup: ConditionGroup.optional(),
   })
   .optional();

export const create = protectedProcedure
   .input(
      createTransactionSchema
         .merge(tagAndItemsSchema)
         .merge(z.object({ autoCategorize: z.boolean().default(false) })),
   )
   .handler(async ({ context, input }) => {
      const { tagIds, items, autoCategorize, ...data } = input;
      await validateTransactionReferences(context.db, context.teamId, {
         bankAccountId: data.bankAccountId,
         destinationBankAccountId: data.destinationBankAccountId,
         categoryId: data.type === "transfer" ? null : data.categoryId,
         tagIds,
         contactId: data.contactId,
         date: data.date,
      });

      const txData =
         data.type === "transfer"
            ? { ...data, categoryId: null, type: "transfer" as const }
            : data;

      const transaction = await createTransaction(
         context.db,
         context.teamId,
         txData,
         tagIds,
      );

      if (items.length > 0 && transaction) {
         await createTransactionItems(
            context.db,
            transaction.id,
            context.teamId,
            items,
         );
      }

      if (
         autoCategorize &&
         transaction &&
         !input.categoryId &&
         (input.type === "income" || input.type === "expense")
      ) {
         startCategorizationWorkflow({
            transactionId: transaction.id,
            teamId: context.teamId,
            name: input.name ?? "",
            type: input.type,
         });
      }

      return transaction;
   });

export const getAll = protectedProcedure
   .input(filterSchema)
   .handler(async ({ context, input }) => {
      return listTransactions(context.db, { teamId: context.teamId, ...input });
   });

export const getSummary = protectedProcedure
   .input(filterSchema)
   .handler(async ({ context, input }) => {
      return getTransactionsSummary(context.db, {
         teamId: context.teamId,
         ...input,
      });
   });

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureTransactionOwnership(context.db, input.id, context.teamId);
      return getTransactionWithTags(context.db, input.id);
   });

export const update = protectedProcedure
   .input(
      idSchema
         .merge(updateTransactionSchema)
         .merge(tagAndItemsSchema.partial()),
   )
   .handler(async ({ context, input }) => {
      const existing = await ensureTransactionOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (
         input.bankAccountId ||
         input.destinationBankAccountId ||
         input.categoryId ||
         input.tagIds ||
         input.contactId
      ) {
         await validateTransactionReferences(context.db, context.teamId, {
            bankAccountId: input.bankAccountId ?? existing.bankAccountId,
            destinationBankAccountId: input.destinationBankAccountId,
            categoryId: input.categoryId,
            tagIds: input.tagIds,
            contactId: input.contactId,
            date: input.date ?? existing.date,
         });
      }
      const { id, tagIds, items, ...data } = input;
      const result = await updateTransaction(context.db, id, data, tagIds);
      if (items !== undefined) {
         await replaceTransactionItems(context.db, id, context.teamId, items);
      }
      return result;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureTransactionOwnership(context.db, input.id, context.teamId);
      await deleteTransaction(context.db, input.id);
      return { success: true };
   });

export const importStatement = withCreditEnforcement(
   "finance.statement_imported",
)
   .input(
      z.object({
         bankAccountId: z.string().uuid(),
         format: z.enum(["csv", "xlsx", "ofx"]),
         transactions: z
            .array(
               z.object({
                  name: z.string().max(500).optional(),
                  type: z.enum(["income", "expense"]),
                  amount: z.string().regex(/^-?\d+(\.\d+)?$/),
                  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                  description: z.string().max(1000).optional(),
                  categoryId: z.string().uuid().optional(),
                  paymentMethod: z
                     .enum([
                        "pix",
                        "credit_card",
                        "debit_card",
                        "boleto",
                        "cash",
                        "transfer",
                        "other",
                        "cheque",
                        "automatic_debit",
                     ])
                     .optional(),
               }),
            )
            .min(1)
            .max(1000),
         autoCategorize: z.boolean().default(false),
      }),
   )
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(
         context.db,
         input.bankAccountId,
         context.teamId,
      );

      const uniqueCategoryIds = [
         ...new Set(
            input.transactions
               .map((t) => t.categoryId)
               .filter((id): id is string => !!id),
         ),
      ];
      for (const categoryId of uniqueCategoryIds) {
         await validateTransactionReferences(context.db, context.teamId, {
            categoryId,
         });
      }

      const rows = input.transactions.map((t) => ({
         bankAccountId: input.bankAccountId,
         name: t.name ?? null,
         type: t.type,
         amount: t.amount,
         date: t.date,
         description: t.description ?? null,
         categoryId: t.categoryId ?? null,
         paymentMethod: t.paymentMethod ?? null,
      }));

      const inserted = await bulkCreateTransactions(
         context.db,
         context.teamId,
         rows,
      );

      if (input.autoCategorize) {
         for (const tx of inserted) {
            if (
               !tx.categoryId &&
               (tx.type === "income" || tx.type === "expense")
            ) {
               startCategorizationWorkflow({
                  transactionId: tx.id,
                  teamId: context.teamId,
                  name: tx.name ?? "",
                  type: tx.type,
               });
            }
         }
      }

      try {
         const emit = createEmitFn(context.db, context.posthog);
         await emitFinanceStatementImported(
            emit,
            {
               organizationId: context.organizationId,
               userId: context.userId,
               teamId: context.teamId,
            },
            {
               bankAccountId: input.bankAccountId,
               format: input.format,
               rowCount: rows.length,
            },
         );
      } catch {}

      return { imported: rows.length };
   });

function normalizeAmount(amount: string): string {
   return Number.parseFloat(amount).toFixed(2);
}

export const checkDuplicates = protectedProcedure
   .input(
      z.object({
         bankAccountId: z.string().uuid(),
         transactions: z
            .array(
               z.object({
                  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                  amount: z.string().regex(/^-?\d+(\.\d+)?$/),
                  type: z.enum(["income", "expense"]),
               }),
            )
            .min(1)
            .max(1000),
         autoCategorize: z.boolean().default(false),
      }),
   )
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(
         context.db,
         input.bankAccountId,
         context.teamId,
      );

      const existing = await context.db
         .select({
            date: transactions.date,
            amount: transactions.amount,
            type: transactions.type,
         })
         .from(transactions)
         .where(
            and(
               eq(transactions.bankAccountId, input.bankAccountId),
               eq(transactions.teamId, context.teamId),
               inArray(
                  transactions.date,
                  input.transactions.map((t) => t.date),
               ),
            ),
         );

      return input.transactions.map((t) => {
         const normalizedAmt = normalizeAmount(t.amount);
         return existing.some((ex) => {
            const result = evaluateConditionGroup(
               {
                  id: "dup",
                  operator: "AND",
                  scoringMode: "weighted",
                  threshold: 0.75,
                  conditions: [
                     {
                        id: "date-group",
                        operator: "AND",
                        weight: 3,
                        conditions: [
                           {
                              id: "date",
                              type: "string",
                              field: "date",
                              operator: "eq",
                              value: ex.date,
                           },
                        ],
                     },
                     {
                        id: "amount-group",
                        operator: "AND",
                        weight: 3,
                        conditions: [
                           {
                              id: "amount",
                              type: "string",
                              field: "amount",
                              operator: "eq",
                              value: normalizeAmount(ex.amount),
                           },
                        ],
                     },
                     {
                        id: "type-group",
                        operator: "AND",
                        weight: 2,
                        conditions: [
                           {
                              id: "type",
                              type: "string",
                              field: "type",
                              operator: "eq",
                              value: ex.type,
                           },
                        ],
                     },
                  ],
               },
               { data: { date: t.date, amount: normalizedAmt, type: t.type } },
            );
            return result.passed;
         });
      });
   });

export const importBulk = protectedProcedure
   .input(
      z.object({
         transactions: z
            .array(createTransactionSchema.merge(tagAndItemsSchema))
            .min(1)
            .max(500),
         autoCategorize: z.boolean().default(false),
      }),
   )
   .handler(async ({ context, input }) => {
      let imported = 0;
      for (const t of input.transactions) {
         const { tagIds, items: _items, ...data } = t;
         await validateTransactionReferences(context.db, context.teamId, {
            bankAccountId: data.bankAccountId,
            destinationBankAccountId: data.destinationBankAccountId,
            categoryId: data.categoryId,
            tagIds,
            date: data.date,
         });
         const transaction = await createTransaction(
            context.db,
            context.teamId,
            data,
            tagIds,
         );
         if (
            input.autoCategorize &&
            transaction &&
            !data.categoryId &&
            (data.type === "income" || data.type === "expense")
         ) {
            startCategorizationWorkflow({
               transactionId: transaction.id,
               teamId: context.teamId,
               name: data.name ?? "",
               type: data.type,
            });
         }
         imported++;
      }
      return { imported, skipped: 0 };
   });

export const acceptSuggestedCategory = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const tx = await ensureTransactionOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (!tx.suggestedCategoryId) {
         throw WebAppError.badRequest(
            "Nenhuma sugestão de categoria disponível.",
         );
      }
      await updateTransactionCategory(context.db, input.id, {
         categoryId: tx.suggestedCategoryId,
         suggestedCategoryId: null,
      });
      return { ok: true };
   });

export const dismissSuggestedCategory = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureTransactionOwnership(context.db, input.id, context.teamId);
      await updateTransactionCategory(context.db, input.id, {
         suggestedCategoryId: null,
      });
      return { ok: true };
   });
