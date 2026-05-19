import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { matchError, Result } from "better-result";
import { z } from "zod";
import {
   createTransactionSchema,
   transactionRecurrenceFrequencyEnum,
   transactionRecurrences,
   transactionItems,
   transactions,
   updateTransactionSchema,
} from "@core/database/schemas/transactions";
import { protectedProcedure } from "@core/orpc/server";
import {
   enqueueClassifyTransactionsBatchWorkflow,
   isClassificationWorkflowQueueFailure,
} from "@modules/classification/workflows/enqueue";
import {
   enforceCostCenterPolicy,
   requireTransactionRecurrence,
   requireTransaction,
   requireValidFinancialReferences,
} from "@modules/cashbook/router/middlewares";
import {
   addRecurrencePeriod,
   buildInstallmentPreview,
   buildRecurrenceOccurrences,
} from "@modules/cashbook/transactions";
import {
   CashbookError,
   cashbookErrors,
} from "@modules/cashbook/cashbook-error";

const idSchema = z.object({ id: z.string().uuid() });

const tagAndItemsSchema = z.object({
   tagId: z.string().uuid().nullable().optional(),
   items: z
      .array(
         z.object({
            description: z.string().max(500).nullable().optional(),
            quantity: z.string(),
            unitPrice: z.string(),
         }),
      )
      .optional()
      .default([]),
});

const installmentSchema = z
   .object({
      isInstallment: z.boolean().optional().default(false),
      installmentCount: z
         .number({ message: "Número de parcelas é obrigatório." })
         .int("Número de parcelas deve ser inteiro.")
         .min(2, "Número de parcelas deve ser maior que 1.")
         .max(120, "Número de parcelas deve ser menor ou igual a 120.")
         .optional(),
   })
   .superRefine((data, ctx) => {
      if (data.isInstallment && !data.installmentCount) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Número de parcelas é obrigatório.",
            path: ["installmentCount"],
         });
      }
   });

const recurrenceSchema = z
   .object({
      isRecurring: z.boolean().optional().default(false),
      recurrenceFrequency: z
         .enum(transactionRecurrenceFrequencyEnum.enumValues, {
            message: "Periodicidade da recorrência é obrigatória.",
         })
         .optional(),
   })
   .superRefine((data, ctx) => {
      if (data.isRecurring && !data.recurrenceFrequency) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Periodicidade da recorrência é obrigatória.",
            path: ["recurrenceFrequency"],
         });
      }
   });

export const create = protectedProcedure
   .input(
      createTransactionSchema
         .merge(tagAndItemsSchema)
         .merge(installmentSchema)
         .merge(recurrenceSchema)
         .merge(z.object({ autoCategorize: z.boolean().default(false) })),
   )
   .use(enforceCostCenterPolicy, (input) => input.tagId)
   .handler(async ({ context, input }) => {
      const {
         tagId,
         items,
         autoCategorize,
         isInstallment,
         installmentCount: rawInstallmentCount,
         isRecurring,
         recurrenceFrequency,
         ...transactionData
      } = input;
      const installmentCount = rawInstallmentCount ?? 1;
      const installmentPreview = (() => {
         if (isInstallment && installmentCount > 1) {
            return buildInstallmentPreview({
               amount: transactionData.amount,
               count: installmentCount,
               date: transactionData.date,
               dueDate: transactionData.dueDate,
            });
         }
         return null;
      })();
      const recurrencePreview = (() => {
         if (isRecurring && recurrenceFrequency) {
            return buildRecurrenceOccurrences({
               date: transactionData.date,
               dueDate: transactionData.dueDate,
               frequency: recurrenceFrequency,
            });
         }
         return null;
      })();

      if (isInstallment && transactionData.type === "transfer") {
         throw new CashbookError({
            error: cashbookErrors.BAD_REQUEST(),
            message: "Transferências não podem ser parceladas.",
         });
      }
      if (isRecurring && isInstallment) {
         throw new CashbookError({
            error: cashbookErrors.BAD_REQUEST(),
            message: "Lançamento recorrente não pode ser parcelado.",
         });
      }
      if (installmentPreview?.isErr()) {
         throw matchError<CashbookError, CashbookError>(
            installmentPreview.error,
            {
               CashbookError: (error) => error,
            },
         );
      }
      if (recurrencePreview?.isErr()) {
         throw matchError<CashbookError, CashbookError>(
            recurrencePreview.error,
            {
               CashbookError: (error) => error,
            },
         );
      }

      await requireValidFinancialReferences(context.db, context.teamId, {
         bankAccountId: transactionData.bankAccountId,
         destinationBankAccountId: transactionData.destinationBankAccountId,
         categoryId: (() => {
            if (transactionData.type === "transfer") return null;
            return transactionData.categoryId;
         })(),
         tagId,
         date: transactionData.date,
      });

      const txData = (() => {
         if (transactionData.type === "transfer") {
            return { ...transactionData, categoryId: null };
         }
         return transactionData;
      })();
      const ignored = txData.ignored ?? false;
      const status = txData.status;
      const installments = (() => {
         if (installmentPreview?.isOk()) return installmentPreview.value;
         return [
            {
               number: 1,
               count: 1,
               amount: txData.amount,
               date: txData.date,
               dueDate: txData.dueDate ?? null,
            },
         ];
      })();
      const installmentGroupId = (() => {
         if (installments.length > 1) return crypto.randomUUID();
         return null;
      })();
      const recurrenceOccurrences = (() => {
         if (recurrencePreview?.isOk()) return recurrencePreview.value;
         return null;
      })();
      const recurrenceId = (() => {
         if (recurrenceOccurrences) return crypto.randomUUID();
         return null;
      })();
      const transactionRows = (() => {
         if (recurrenceOccurrences) {
            return recurrenceOccurrences.map((occurrence) => ({
               ...txData,
               amount: txData.amount,
               date: occurrence.date,
               dueDate: occurrence.dueDate,
               name: txData.name,
               status,
               ignored,
               teamId: context.teamId,
               tagId: tagId ?? null,
               recurrenceId,
               recurrenceOccurrenceNumber: occurrence.number,
            }));
         }

         return installments.map((installment) => {
            const baseRow = {
               ...txData,
               amount: installment.amount,
               date: installment.date,
               dueDate: installment.dueDate,
               status,
               ignored,
               teamId: context.teamId,
               tagId: tagId ?? null,
               installmentGroupId,
            };

            if (installment.count > 1 && txData.name) {
               return {
                  ...baseRow,
                  name: `${txData.name} (${installment.number}/${installment.count})`,
                  installmentNumber: installment.number,
                  installmentCount: installment.count,
               };
            }

            if (installment.count > 1) {
               return {
                  ...baseRow,
                  name: txData.name,
                  installmentNumber: installment.number,
                  installmentCount: installment.count,
               };
            }

            return {
               ...baseRow,
               name: txData.name,
               installmentNumber: null,
               installmentCount: null,
            };
         });
      })();

      const created = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const rows = await tx
                  .insert(transactions)
                  .values(transactionRows)
                  .returning();
               const [row] = rows;
               if (!row) {
                  throw new CashbookError({
                     error: cashbookErrors.INTERNAL(),
                     message: "Falha ao criar lançamento.",
                  });
               }
               if (
                  recurrenceId &&
                  recurrenceFrequency &&
                  recurrenceOccurrences
               ) {
                  const lastOccurrence =
                     recurrenceOccurrences[recurrenceOccurrences.length - 1];
                  if (!lastOccurrence) {
                     throw new CashbookError({
                        error: cashbookErrors.INTERNAL(),
                        message: "Falha ao criar recorrência.",
                     });
                  }
                  await tx.insert(transactionRecurrences).values({
                     id: recurrenceId,
                     teamId: context.teamId,
                     sourceTransactionId: row.id,
                     frequency: recurrenceFrequency,
                     startedAt: row.date,
                     nextOccurrenceDate: addRecurrencePeriod(
                        lastOccurrence.date,
                        recurrenceFrequency,
                     ),
                  });
               }
               if (items.length > 0) {
                  await tx.insert(transactionItems).values(
                     items.map((item) => ({
                        transactionId: row.id,
                        teamId: context.teamId,
                        description: item.description ?? null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                     })),
                  );
               }
               return row;
            }),
         catch: () =>
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao criar lançamento.",
            }),
      });
      if (created.isErr()) throw created.error;

      if (
         autoCategorize &&
         !input.categoryId &&
         !ignored &&
         (input.type === "income" || input.type === "expense")
      ) {
         const transactionIds = await (async () => {
            if (created.value.installmentGroupId) {
               return context.db
                  .select({ id: transactions.id })
                  .from(transactions)
                  .where(
                     and(
                        eq(
                           transactions.installmentGroupId,
                           created.value.installmentGroupId,
                        ),
                        eq(transactions.teamId, context.teamId),
                     ),
                  )
                  .then((rows) => rows.map((row) => row.id));
            }
            if (created.value.recurrenceId) {
               return context.db
                  .select({ id: transactions.id })
                  .from(transactions)
                  .where(
                     and(
                        eq(
                           transactions.recurrenceId,
                           created.value.recurrenceId,
                        ),
                        eq(transactions.teamId, context.teamId),
                     ),
                  )
                  .then((rows) => rows.map((row) => row.id));
            }
            return [created.value.id];
         })();
         const queued = await enqueueClassifyTransactionsBatchWorkflow(
            context.workflowClient,
            {
               organizationId: context.organizationId,
               teamId: context.teamId,
               transactionIds,
            },
         );
         if (isClassificationWorkflowQueueFailure(queued)) {
            throw new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao enfileirar classificação de lançamentos.",
            });
         }
      }

      return created.value;
   });

const recurrenceIdSchema = z.object({ id: z.string().uuid() });

export const stopRecurrence = protectedProcedure
   .input(recurrenceIdSchema)
   .use(requireTransactionRecurrence, (input) => input.id)
   .handler(async ({ context }) => {
      const stopped = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactionRecurrences)
                  .set({
                     status: "stopped",
                     stoppedAt: dayjs().toDate(),
                  })
                  .where(eq(transactionRecurrences.id, context.recurrence.id))
                  .returning(),
            ),
         catch: () =>
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao interromper recorrência.",
            }),
      });
      if (stopped.isErr()) throw stopped.error;
      const [row] = stopped.value;
      if (!row) {
         throw new CashbookError({
            error: cashbookErrors.NOT_FOUND(),
            message: "Recorrência não encontrada.",
         });
      }
      return row;
   });

export const updateRecurrence = protectedProcedure
   .input(
      recurrenceIdSchema.merge(
         z.object({
            frequency: z
               .enum(transactionRecurrenceFrequencyEnum.enumValues, {
                  message: "Periodicidade da recorrência é obrigatória.",
               })
               .optional(),
            status: z.enum(["active", "stopped"]).optional(),
         }),
      ),
   )
   .use(requireTransactionRecurrence, (input) => input.id)
   .handler(async ({ context, input }) => {
      const existing = context.recurrence;
      const nextStatus = input.status ?? existing.status;
      const nextFrequency = input.frequency ?? existing.frequency;
      const nextOccurrenceDate = await (async () => {
         if (input.frequency && input.frequency !== existing.frequency) {
            const latestOccurrence = await Result.tryPromise({
               try: () =>
                  context.db.query.transactions.findFirst({
                     where: (f, { and, eq }) =>
                        and(
                           eq(f.recurrenceId, existing.id),
                           eq(f.teamId, context.teamId),
                        ),
                     orderBy: (f, { desc }) => [
                        desc(f.recurrenceOccurrenceNumber),
                        desc(f.date),
                     ],
                  }),
               catch: () =>
                  new CashbookError({
                     error: cashbookErrors.INTERNAL(),
                     message: "Falha ao verificar lançamentos gerados.",
                  }),
            });
            if (latestOccurrence.isErr()) throw latestOccurrence.error;
            if (!latestOccurrence.value) {
               throw new CashbookError({
                  error: cashbookErrors.INTERNAL(),
                  message: "Falha ao verificar lançamentos gerados.",
               });
            }
            return addRecurrencePeriod(
               latestOccurrence.value.date,
               input.frequency,
            );
         }
         return existing.nextOccurrenceDate;
      })();
      const stoppedAt = (() => {
         if (nextStatus === "stopped")
            return existing.stoppedAt ?? dayjs().toDate();
         return null;
      })();
      const updated = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactionRecurrences)
                  .set({
                     frequency: nextFrequency,
                     status: nextStatus,
                     stoppedAt,
                     nextOccurrenceDate,
                  })
                  .where(eq(transactionRecurrences.id, existing.id))
                  .returning(),
            ),
         catch: () =>
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao atualizar recorrência.",
            }),
      });
      if (updated.isErr()) throw updated.error;
      const [row] = updated.value;
      if (!row) {
         throw new CashbookError({
            error: cashbookErrors.NOT_FOUND(),
            message: "Recorrência não encontrada.",
         });
      }
      return row;
   });

export const getById = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(({ context }) => context.transaction);

export const update = protectedProcedure
   .input(
      idSchema
         .merge(updateTransactionSchema)
         .merge(tagAndItemsSchema.partial()),
   )
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const existing = context.transaction;
      if ("tagId" in input) {
         const policyResult = await Result.tryPromise({
            try: () =>
               context.db.query.financialConfig.findFirst({
                  where: (f, { eq }) => eq(f.teamId, context.teamId),
               }),
            catch: () =>
               new CashbookError({
                  error: cashbookErrors.INTERNAL(),
                  message: "Falha ao verificar configurações.",
               }),
         });
         if (policyResult.isErr()) throw policyResult.error;
         if (policyResult.value?.costCenterRequired && !input.tagId) {
            throw new CashbookError({
               error: cashbookErrors.FORBIDDEN(),
               message: "Centro de Custo é obrigatório para este espaço.",
            });
         }
      }
      if (
         input.bankAccountId ||
         input.destinationBankAccountId ||
         input.categoryId ||
         input.tagId
      ) {
         await requireValidFinancialReferences(context.db, context.teamId, {
            bankAccountId: input.bankAccountId ?? existing.bankAccountId,
            destinationBankAccountId: input.destinationBankAccountId,
            categoryId: input.categoryId,
            tagId: input.tagId,
            date: input.date ?? existing.date,
         });
      }
      const { id, tagId, items, ...data } = input;
      const ignored = data.ignored;
      const status = data.status;
      const updateData = { ...data };
      if (status !== undefined) {
         updateData.status = status;
      }
      if (ignored !== undefined) {
         updateData.ignored = ignored;
      }
      if (tagId !== undefined) {
         updateData.tagId = tagId;
         updateData.suggestedTagId = null;
      }
      if (data.categoryId !== undefined) {
         updateData.suggestedCategoryId = null;
      }

      const updated = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(transactions)
                  .set(updateData)
                  .where(eq(transactions.id, id))
                  .returning();
               if (!row) {
                  throw new CashbookError({
                     error: cashbookErrors.NOT_FOUND(),
                     message: "Lançamento não encontrado.",
                  });
               }
               if (items !== undefined) {
                  await tx
                     .delete(transactionItems)
                     .where(eq(transactionItems.transactionId, id));
                  if (items.length > 0) {
                     await tx.insert(transactionItems).values(
                        items.map((item) => ({
                           transactionId: id,
                           teamId: context.teamId,
                           description: item.description ?? null,
                           quantity: item.quantity,
                           unitPrice: item.unitPrice,
                        })),
                     );
                  }
               }
               return row;
            }),
         catch: () =>
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao atualizar lançamento.",
            }),
      });
      if (updated.isErr()) throw updated.error;
      return updated.value;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx.delete(transactions).where(eq(transactions.id, input.id)),
            ),
         catch: () =>
            new CashbookError({
               error: cashbookErrors.INTERNAL(),
               message: "Falha ao excluir lançamento.",
            }),
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   });
