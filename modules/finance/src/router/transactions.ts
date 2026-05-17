import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import {
   createTransactionSchema,
   transactionRecurrenceFrequencyEnum,
   transactionRecurrences,
   transactionItems,
   transactions,
   updateTransactionSchema,
} from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
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
} from "@modules/finance/router/middlewares";
import { buildInstallmentPreview } from "@modules/finance/services/installments";
import {
   addRecurrencePeriod,
   buildRecurrenceOccurrences,
} from "@modules/finance/services/recurrences";

const idSchema = z.object({ id: z.string().uuid() });

const tagAndItemsSchema = z.object({
   tagId: z.string().uuid().nullable().optional(),
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
      const installmentPreview =
         isInstallment && installmentCount > 1
            ? buildInstallmentPreview({
                 amount: transactionData.amount,
                 count: installmentCount,
                 date: transactionData.date,
                 dueDate: transactionData.dueDate,
              })
            : null;
      const recurrencePreview =
         isRecurring && recurrenceFrequency
            ? buildRecurrenceOccurrences({
                 date: transactionData.date,
                 dueDate: transactionData.dueDate,
                 frequency: recurrenceFrequency,
              })
            : null;

      if (isInstallment && transactionData.type === "transfer") {
         throw WebAppError.badRequest(
            "Transferências não podem ser parceladas.",
         );
      }
      if (isRecurring && isInstallment) {
         throw WebAppError.badRequest(
            "Lançamento recorrente não pode ser parcelado.",
         );
      }
      if (installmentPreview?.isErr()) {
         throw WebAppError.badRequest(installmentPreview.error);
      }
      if (recurrencePreview?.isErr()) {
         throw WebAppError.badRequest(recurrencePreview.error);
      }

      await requireValidFinancialReferences(context.db, context.teamId, {
         bankAccountId: transactionData.bankAccountId,
         destinationBankAccountId: transactionData.destinationBankAccountId,
         categoryId:
            transactionData.type === "transfer"
               ? null
               : transactionData.categoryId,
         tagId,
         contactId: transactionData.contactId,
         date: transactionData.date,
      });

      const txData =
         transactionData.type === "transfer"
            ? { ...transactionData, categoryId: null }
            : transactionData;
      const ignored = txData.ignored ?? false;
      const status = txData.status;
      const installments = installmentPreview?.isOk()
         ? installmentPreview.value
         : [
              {
                 number: 1,
                 count: 1,
                 amount: txData.amount,
                 date: txData.date,
                 dueDate: txData.dueDate ?? null,
              },
           ];
      const installmentGroupId =
         installments.length > 1 ? crypto.randomUUID() : null;
      const recurrenceOccurrences = recurrencePreview?.isOk()
         ? recurrencePreview.value
         : null;
      const recurrenceId = recurrenceOccurrences ? crypto.randomUUID() : null;
      const transactionRows = recurrenceOccurrences
         ? recurrenceOccurrences.map((occurrence) => ({
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
           }))
         : installments.map((installment) => ({
              ...txData,
              amount: installment.amount,
              date: installment.date,
              dueDate: installment.dueDate,
              name:
                 installment.count > 1 && txData.name
                    ? `${txData.name} (${installment.number}/${installment.count})`
                    : txData.name,
              status,
              ignored,
              teamId: context.teamId,
              tagId: tagId ?? null,
              installmentGroupId,
              installmentNumber:
                 installment.count > 1 ? installment.number : null,
              installmentCount:
                 installment.count > 1 ? installment.count : null,
           }));

      const created = await fromPromise(
         context.db.transaction(async (tx) => {
            const rows = await tx
               .insert(transactions)
               .values(transactionRows)
               .returning();
            const [row] = rows;
            if (!row) throw WebAppError.internal("Falha ao criar lançamento.");
            if (recurrenceId && recurrenceFrequency && recurrenceOccurrences) {
               const lastOccurrence =
                  recurrenceOccurrences[recurrenceOccurrences.length - 1];
               if (!lastOccurrence) {
                  throw WebAppError.internal("Falha ao criar recorrência.");
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
                     serviceId: item.serviceId ?? null,
                     description: item.description ?? null,
                     quantity: item.quantity,
                     unitPrice: item.unitPrice,
                  })),
               );
            }
            return row;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao criar lançamento."),
      );
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
            throw WebAppError.internal(
               "Falha ao enfileirar classificação de lançamentos.",
            );
         }
      }

      return created.value;
   });

const recurrenceIdSchema = z.object({ id: z.string().uuid() });

export const stopRecurrence = protectedProcedure
   .input(recurrenceIdSchema)
   .use(requireTransactionRecurrence, (input) => input.id)
   .handler(async ({ context }) => {
      const stopped = await fromPromise(
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
         () => WebAppError.internal("Falha ao interromper recorrência."),
      );
      if (stopped.isErr()) throw stopped.error;
      const [row] = stopped.value;
      if (!row) throw WebAppError.notFound("Recorrência não encontrada.");
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
      let nextOccurrenceDate = existing.nextOccurrenceDate;
      if (input.frequency && input.frequency !== existing.frequency) {
         const latestOccurrence = await fromPromise(
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
            () =>
               WebAppError.internal("Falha ao verificar lançamentos gerados."),
         );
         if (latestOccurrence.isErr()) throw latestOccurrence.error;
         if (!latestOccurrence.value) {
            throw WebAppError.internal(
               "Falha ao verificar lançamentos gerados.",
            );
         }
         nextOccurrenceDate = addRecurrencePeriod(
            latestOccurrence.value.date,
            input.frequency,
         );
      }
      const updated = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(transactionRecurrences)
               .set({
                  frequency: nextFrequency,
                  status: nextStatus,
                  stoppedAt:
                     nextStatus === "stopped"
                        ? (existing.stoppedAt ?? dayjs().toDate())
                        : null,
                  nextOccurrenceDate,
               })
               .where(eq(transactionRecurrences.id, existing.id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao atualizar recorrência."),
      );
      if (updated.isErr()) throw updated.error;
      const [row] = updated.value;
      if (!row) throw WebAppError.notFound("Recorrência não encontrada.");
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
         const policyResult = await fromPromise(
            context.db.query.financialConfig.findFirst({
               where: (f, { eq }) => eq(f.teamId, context.teamId),
            }),
            () => WebAppError.internal("Falha ao verificar configurações."),
         );
         if (policyResult.isErr()) throw policyResult.error;
         if (policyResult.value?.costCenterRequired && !input.tagId) {
            throw WebAppError.forbidden(
               "Centro de Custo é obrigatório para este espaço.",
            );
         }
      }
      if (
         input.bankAccountId ||
         input.destinationBankAccountId ||
         input.categoryId ||
         input.tagId ||
         input.contactId
      ) {
         await requireValidFinancialReferences(context.db, context.teamId, {
            bankAccountId: input.bankAccountId ?? existing.bankAccountId,
            destinationBankAccountId: input.destinationBankAccountId,
            categoryId: input.categoryId,
            tagId: input.tagId,
            contactId: input.contactId,
            date: input.date ?? existing.date,
         });
      }
      const { id, tagId, items, ...data } = input;
      const ignored = data.ignored;
      const status = data.status;

      const updated = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(transactions)
               .set({
                  ...data,
                  ...(status !== undefined ? { status } : {}),
                  ...(ignored !== undefined ? { ignored } : {}),
                  ...(tagId !== undefined
                     ? { tagId, suggestedTagId: null }
                     : {}),
                  ...(data.categoryId !== undefined
                     ? { suggestedCategoryId: null }
                     : {}),
               })
               .where(eq(transactions.id, id))
               .returning();
            if (!row) throw WebAppError.notFound("Lançamento não encontrado.");
            if (items !== undefined) {
               await tx
                  .delete(transactionItems)
                  .where(eq(transactionItems.transactionId, id));
               if (items.length > 0) {
                  await tx.insert(transactionItems).values(
                     items.map((item) => ({
                        transactionId: id,
                        teamId: context.teamId,
                        serviceId: item.serviceId ?? null,
                        description: item.description ?? null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                     })),
                  );
               }
            }
            return row;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao atualizar lançamento."),
      );
      if (updated.isErr()) throw updated.error;
      return updated.value;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx.delete(transactions).where(eq(transactions.id, input.id)),
         ),
         () => WebAppError.internal("Falha ao excluir lançamento."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });
