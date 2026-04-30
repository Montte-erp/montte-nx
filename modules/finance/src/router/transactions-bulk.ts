import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import {
   createTransactionSchema,
   transactions,
} from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { enqueueClassifyTransactionsBatchWorkflow } from "@modules/classification/workflows/classification-workflow";
import {
   requireBankAccount,
   requireValidFinancialReferences,
} from "@modules/finance/router/middlewares";

const tagOnlySchema = z.object({
   tagId: z.string().uuid().nullable().optional(),
});

const importStatementSchema = z.object({
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
});

export const importStatement = protectedProcedure
   .input(importStatementSchema)
   .use(requireBankAccount, (input) => input.bankAccountId)
   .handler(async ({ context, input }) => {
      const uniqueCategoryIds = [
         ...new Set(
            input.transactions
               .map((t) => t.categoryId)
               .filter((id): id is string => !!id),
         ),
      ];
      for (const categoryId of uniqueCategoryIds) {
         await requireValidFinancialReferences(context.db, context.teamId, {
            categoryId,
         });
      }

      const rows = input.transactions.map((t) => ({
         bankAccountId: input.bankAccountId,
         teamId: context.teamId,
         name: t.name ?? null,
         type: t.type,
         amount: t.amount,
         date: t.date,
         description: t.description ?? null,
         categoryId: t.categoryId ?? null,
         paymentMethod: t.paymentMethod ?? null,
      }));

      const inserted = await fromPromise(
         context.db.transaction(async (tx) =>
            tx.insert(transactions).values(rows).returning({
               id: transactions.id,
               type: transactions.type,
               categoryId: transactions.categoryId,
            }),
         ),
         () => WebAppError.internal("Falha ao importar lançamentos."),
      );
      if (inserted.isErr()) throw inserted.error;

      if (input.autoCategorize) {
         const idsToClassify = inserted.value
            .filter(
               (tx) =>
                  !tx.categoryId &&
                  (tx.type === "income" || tx.type === "expense"),
            )
            .map((tx) => tx.id);
         if (idsToClassify.length > 0) {
            await enqueueClassifyTransactionsBatchWorkflow(
               context.workflowClient,
               { teamId: context.teamId, transactionIds: idsToClassify },
            );
         }
      }

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
      }),
   )
   .use(requireBankAccount, (input) => input.bankAccountId)
   .handler(async ({ context, input }) => {
      const existing = await context.db.query.transactions.findMany({
         columns: { date: true, amount: true, type: true },
         where: (f, { and, eq, inArray }) =>
            and(
               eq(f.bankAccountId, input.bankAccountId),
               eq(f.teamId, context.teamId),
               inArray(
                  f.date,
                  input.transactions.map((t) => t.date),
               ),
            ),
      });

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
            .array(createTransactionSchema.merge(tagOnlySchema))
            .min(1)
            .max(500),
         autoCategorize: z.boolean().default(false),
      }),
   )
   .handler(async ({ context, input }) => {
      const idsToClassify: string[] = [];
      let imported = 0;
      for (const t of input.transactions) {
         const { tagId, ...data } = t;
         await requireValidFinancialReferences(context.db, context.teamId, {
            bankAccountId: data.bankAccountId,
            destinationBankAccountId: data.destinationBankAccountId,
            categoryId: data.categoryId,
            tagId,
            date: data.date,
         });
         const inserted = await fromPromise(
            context.db.transaction(async (tx) =>
               tx
                  .insert(transactions)
                  .values({
                     ...data,
                     teamId: context.teamId,
                     tagId: tagId ?? null,
                  })
                  .returning({ id: transactions.id }),
            ),
            () => WebAppError.internal("Falha ao importar lançamento."),
         );
         if (inserted.isErr()) throw inserted.error;
         const [row] = inserted.value;
         if (
            input.autoCategorize &&
            row &&
            !data.categoryId &&
            (data.type === "income" || data.type === "expense")
         ) {
            idsToClassify.push(row.id);
         }
         imported++;
      }
      if (idsToClassify.length > 0) {
         await enqueueClassifyTransactionsBatchWorkflow(
            context.workflowClient,
            { teamId: context.teamId, transactionIds: idsToClassify },
         );
      }
      return { imported, skipped: 0 };
   });
