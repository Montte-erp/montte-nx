import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import {
   createTransactionSchema,
   transactionItems,
   transactions,
   updateTransactionSchema,
} from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { enqueueClassifyTransactionsBatchWorkflow } from "@modules/classification/workflows/classification-workflow";
import {
   enforceCostCenterPolicy,
   requireTransaction,
   requireValidFinancialReferences,
} from "@modules/finance/router/middlewares";

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

export const create = protectedProcedure
   .input(
      createTransactionSchema
         .merge(tagAndItemsSchema)
         .merge(z.object({ autoCategorize: z.boolean().default(false) })),
   )
   .use(enforceCostCenterPolicy, (input) => input.tagId)
   .handler(async ({ context, input }) => {
      const { tagId, items, autoCategorize, ...data } = input;
      await requireValidFinancialReferences(context.db, context.teamId, {
         bankAccountId: data.bankAccountId,
         destinationBankAccountId: data.destinationBankAccountId,
         categoryId: data.type === "transfer" ? null : data.categoryId,
         tagId,
         contactId: data.contactId,
         date: data.date,
      });

      const txData =
         data.type === "transfer" ? { ...data, categoryId: null } : data;

      const created = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(transactions)
               .values({
                  ...txData,
                  teamId: context.teamId,
                  tagId: tagId ?? null,
               })
               .returning();
            if (!row) throw WebAppError.internal("Falha ao criar lançamento.");
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
         (input.type === "income" || input.type === "expense")
      ) {
         await enqueueClassifyTransactionsBatchWorkflow(
            context.workflowClient,
            { teamId: context.teamId, transactionIds: [created.value.id] },
         );
      }

      return created.value;
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

      const updated = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(transactions)
               .set({
                  ...data,
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
         context.db.delete(transactions).where(eq(transactions.id, input.id)),
         () => WebAppError.internal("Falha ao excluir lançamento."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });
