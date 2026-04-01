import { ConditionGroup } from "@f-o-t/condition-evaluator";
import {
   createTransaction,
   createTransactionItems,
   deleteTransaction,
   ensureTransactionOwnership,
   getTransactionsSummary,
   getTransactionWithTags,
   listTransactions,
   replaceTransactionItems,
   updateTransaction,
   validateTransactionReferences,
} from "@core/database/repositories/transactions-repository";
import { ensureBankAccountOwnership } from "@core/database/repositories/bank-accounts-repository";
import {
   createTransactionSchema,
   transactions,
   updateTransactionSchema,
} from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { enforceCreditBudget, incrementUsage } from "@packages/events/credits";
import { createEmitFn } from "@packages/events/emit";
import { emitFinanceStatementImported } from "@packages/events/finance";
import { z } from "zod";
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
   .input(createTransactionSchema.merge(tagAndItemsSchema))
   .handler(async ({ context, input }) => {
      const { tagIds, items, ...data } = input;
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

export const importStatement = protectedProcedure
   .input(
      z.object({
         bankAccountId: z.string().uuid(),
         format: z.enum(["csv", "xlsx", "ofx"]),
         transactions: z
            .array(
               z.object({
                  name: z.string().max(500).optional(),
                  type: z.enum(["income", "expense"]),
                  amount: z.string(),
                  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                  description: z.string().max(1000).optional(),
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
      }),
   )
   .handler(async ({ context, input }) => {
      try {
         await enforceCreditBudget(
            context.organizationId,
            "finance.statement_imported",
            context.redis,
         );
      } catch {
         throw WebAppError.forbidden(
            "Limite do plano gratuito atingido para importação de extratos.",
         );
      }

      await ensureBankAccountOwnership(
         context.db,
         input.bankAccountId,
         context.teamId,
      );

      const rows = input.transactions.map((t) => ({
         teamId: context.teamId,
         bankAccountId: input.bankAccountId,
         name: t.name ?? null,
         type: t.type,
         amount: t.amount,
         date: t.date,
         description: t.description ?? null,
         paymentMethod: t.paymentMethod ?? null,
      }));

      await context.db.insert(transactions).values(rows);

      await incrementUsage(
         context.organizationId,
         "finance.statement_imported",
         context.redis,
      );

      try {
         const emit = createEmitFn(context.db, context.posthog);
         emitFinanceStatementImported(
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

export const importBulk = protectedProcedure
   .input(
      z.object({
         transactions: z
            .array(createTransactionSchema.merge(tagAndItemsSchema))
            .min(1)
            .max(500),
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
         await createTransaction(context.db, context.teamId, data, tagIds);
         imported++;
      }
      return { imported, skipped: 0 };
   });
