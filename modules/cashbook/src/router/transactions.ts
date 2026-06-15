import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { matchError, Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import {
   createTransactionSchema,
   transactionRecurrenceFrequencyEnum,
   transactionRecurrences,
   transactionItems,
   transactions,
   updateTransactionSchema,
   type Attachment,
} from "@core/database/schemas/transactions";
import {
   vaultDocuments,
   vaultFolders,
   type NewVaultDocument,
} from "@core/database/schemas/vault";
import { VAULT_DEFAULT_FOLDER_KEYS } from "@core/vault/catalog";
import { protectedProcedure } from "@core/orpc/server";
import {
   enqueueClassifyTransactionsBatchWorkflow,
   isClassificationWorkflowQueueFailure,
} from "@modules/classification/workflows/enqueue";
import {
   enforceCostCenterPolicy,
   requireOwnedTransactionIds,
   requireTransactionRecurrence,
   requireTransaction,
   requireValidFinancialReferences,
} from "@modules/cashbook/router/middlewares";
import {
   addRecurrencePeriod,
   buildInstallmentPreview,
   buildRecurrenceOccurrences,
   type TransactionRuleError,
} from "@modules/cashbook/transactions";

const transactionRouterErrors = defineErrorCatalog(
   "cashbook.router.transactions",
   {
      BAD_REQUEST: {
         status: 400,
         message: "Requisição inválida em lançamentos.",
         tags: ["cashbook"],
      },
      FORBIDDEN: {
         status: 403,
         message: "Ação não permitida em lançamentos.",
         tags: ["cashbook"],
      },
      INTERNAL: {
         status: 500,
         message: "Falha interna em lançamentos.",
         tags: ["cashbook"],
      },
      NOT_FOUND: {
         status: 404,
         message: "Lançamento não encontrado.",
         tags: ["cashbook"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cashbook.router.transactions": typeof transactionRouterErrors;
   }
}

type TransactionRouterCatalogError =
   | ReturnType<typeof transactionRouterErrors.BAD_REQUEST>
   | ReturnType<typeof transactionRouterErrors.FORBIDDEN>
   | ReturnType<typeof transactionRouterErrors.INTERNAL>
   | ReturnType<typeof transactionRouterErrors.NOT_FOUND>;

class TransactionRouterError extends TaggedError("TransactionRouterError")<{
   error: TransactionRouterCatalogError;
   message: string;
}>() {}

const idSchema = z.object({ id: z.string().uuid() });

function extractObjectKeyFromFileUrl(url: string) {
   const marker = "/api/files/";
   const markerIndex = url.indexOf(marker);
   if (markerIndex < 0) return undefined;

   const rest = url.slice(markerIndex + marker.length);
   const separatorIndex = rest.indexOf("/");
   if (separatorIndex < 0) return undefined;

   return rest;
}

function buildVaultRowsForTransactionAttachments(input: {
   attachments: Attachment[] | null | undefined;
   organizationId: string;
   teamId: string;
   userId: string;
   transactionName: string | null | undefined;
   folderId: string;
}): NewVaultDocument[] {
   return (input.attachments ?? []).flatMap((attachment) => {
      const fileKey = extractObjectKeyFromFileUrl(attachment.url);
      if (!fileKey) return [];

      return [
         {
            organizationId: input.organizationId,
            teamId: input.teamId,
            title: attachment.filename,
            description: input.transactionName
               ? `Anexo do lançamento ${input.transactionName}.`
               : "Anexo de lançamento financeiro.",
            folderId: input.folderId,
            status: "stored",
            source: "finance",
            fileKey,
            originalFileName: attachment.filename,
            mimeType: attachment.mimeType,
            fileSize: attachment.size,
            uploadedByUserId: input.userId,
         },
      ];
   });
}

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
         .number({ error: "Número de parcelas é obrigatório." })
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
            error: "Periodicidade da recorrência é obrigatória.",
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
         throw new TransactionRouterError({
            error: transactionRouterErrors.BAD_REQUEST(),
            message: "Transferências não podem ser parceladas.",
         });
      }
      if (isRecurring && isInstallment) {
         throw new TransactionRouterError({
            error: transactionRouterErrors.BAD_REQUEST(),
            message: "Lançamento recorrente não pode ser parcelado.",
         });
      }
      if (installmentPreview?.isErr()) {
         throw matchError<TransactionRuleError, TransactionRouterError>(
            installmentPreview.error,
            {
               TransactionRuleError: (error) =>
                  new TransactionRouterError({
                     error: transactionRouterErrors.BAD_REQUEST(),
                     message: error.message,
                  }),
            },
         );
      }
      if (recurrencePreview?.isErr()) {
         throw matchError<TransactionRuleError, TransactionRouterError>(
            recurrencePreview.error,
            {
               TransactionRuleError: (error) =>
                  new TransactionRouterError({
                     error: transactionRouterErrors.BAD_REQUEST(),
                     message: error.message,
                  }),
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
         relationshipId: transactionData.relationshipId,
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
                  throw new TransactionRouterError({
                     error: transactionRouterErrors.INTERNAL(),
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
                     throw new TransactionRouterError({
                        error: transactionRouterErrors.INTERNAL(),
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
                     rows.flatMap((createdRow) =>
                        items.map((item) => ({
                           transactionId: createdRow.id,
                           teamId: context.teamId,
                           description: item.description ?? null,
                           quantity: item.quantity,
                           unitPrice: item.unitPrice,
                        })),
                     ),
                  );
               }
               await tx
                  .insert(vaultFolders)
                  .values({
                     organizationId: context.organizationId,
                     teamId: context.teamId,
                     name: "Anexos",
                     systemKey: VAULT_DEFAULT_FOLDER_KEYS.attachments,
                     isDefault: true,
                  })
                  .onConflictDoNothing();
               const attachmentsFolder = await tx.query.vaultFolders.findFirst({
                  where: (folder, { and, eq }) =>
                     and(
                        eq(folder.teamId, context.teamId),
                        eq(
                           folder.systemKey,
                           VAULT_DEFAULT_FOLDER_KEYS.attachments,
                        ),
                     ),
               });
               const vaultRows = attachmentsFolder
                  ? buildVaultRowsForTransactionAttachments({
                       attachments: row.attachments,
                       organizationId: context.organizationId,
                       teamId: context.teamId,
                       userId: context.userId,
                       transactionName: row.name,
                       folderId: attachmentsFolder.id,
                    })
                  : [];
               if (vaultRows.length > 0) {
                  await tx.insert(vaultDocuments).values(vaultRows);
               }
               return row;
            }),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
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
            throw new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
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
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao interromper recorrência.",
            }),
      });
      if (stopped.isErr()) throw stopped.error;
      const [row] = stopped.value;
      if (!row) {
         throw new TransactionRouterError({
            error: transactionRouterErrors.NOT_FOUND(),
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
                  error: "Periodicidade da recorrência é obrigatória.",
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
                  new TransactionRouterError({
                     error: transactionRouterErrors.INTERNAL(),
                     message: "Falha ao verificar lançamentos gerados.",
                  }),
            });
            if (latestOccurrence.isErr()) throw latestOccurrence.error;
            if (!latestOccurrence.value) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.INTERNAL(),
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
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao atualizar recorrência.",
            }),
      });
      if (updated.isErr()) throw updated.error;
      const [row] = updated.value;
      if (!row) {
         throw new TransactionRouterError({
            error: transactionRouterErrors.NOT_FOUND(),
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
               new TransactionRouterError({
                  error: transactionRouterErrors.INTERNAL(),
                  message: "Falha ao verificar configurações.",
               }),
         });
         if (policyResult.isErr()) throw policyResult.error;
         if (policyResult.value?.costCenterRequired && !input.tagId) {
            throw new TransactionRouterError({
               error: transactionRouterErrors.FORBIDDEN(),
               message: "Centro de Custo é obrigatório para este espaço.",
            });
         }
      }
      await requireValidFinancialReferences(context.db, context.teamId, {
         bankAccountId: input.bankAccountId ?? existing.bankAccountId,
         destinationBankAccountId:
            input.destinationBankAccountId ?? existing.destinationBankAccountId,
         categoryId: input.categoryId ?? existing.categoryId,
         tagId: input.tagId ?? existing.tagId,
         relationshipId: input.relationshipId ?? existing.relationshipId,
         date: input.date ?? existing.date,
      });
      const { id, tagId, items, ...data } = input;
      const updateData = (() => {
         if (tagId !== undefined && data.categoryId !== undefined) {
            return {
               ...data,
               tagId,
               suggestedTagId: null,
               suggestedCategoryId: null,
            };
         }
         if (tagId !== undefined) {
            return { ...data, tagId, suggestedTagId: null };
         }
         if (data.categoryId !== undefined) {
            return { ...data, suggestedCategoryId: null };
         }
         return data;
      })();

      const updated = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(transactions)
                  .set(updateData)
                  .where(eq(transactions.id, id))
                  .returning();
               if (!row) {
                  throw new TransactionRouterError({
                     error: transactionRouterErrors.NOT_FOUND(),
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
               if (data.attachments !== undefined) {
                  await tx
                     .insert(vaultFolders)
                     .values({
                        organizationId: context.organizationId,
                        teamId: context.teamId,
                        name: "Anexos",
                        systemKey: VAULT_DEFAULT_FOLDER_KEYS.attachments,
                        isDefault: true,
                     })
                     .onConflictDoNothing();
                  const attachmentsFolder =
                     await tx.query.vaultFolders.findFirst({
                        where: (folder, { and, eq }) =>
                           and(
                              eq(folder.teamId, context.teamId),
                              eq(
                                 folder.systemKey,
                                 VAULT_DEFAULT_FOLDER_KEYS.attachments,
                              ),
                           ),
                     });
                  const vaultRows = attachmentsFolder
                     ? buildVaultRowsForTransactionAttachments({
                          attachments: row.attachments,
                          organizationId: context.organizationId,
                          teamId: context.teamId,
                          userId: context.userId,
                          transactionName: row.name,
                          folderId: attachmentsFolder.id,
                       })
                     : [];
                  const fileKeys = vaultRows.flatMap((vaultRow) =>
                     vaultRow.fileKey ? [vaultRow.fileKey] : [],
                  );
                  const existingVaultRows =
                     fileKeys.length > 0
                        ? await tx
                             .select({ fileKey: vaultDocuments.fileKey })
                             .from(vaultDocuments)
                             .where(
                                and(
                                   eq(vaultDocuments.teamId, context.teamId),
                                   inArray(vaultDocuments.fileKey, fileKeys),
                                ),
                             )
                        : [];
                  const existingFileKeys = new Set(
                     existingVaultRows.flatMap((vaultRow) =>
                        vaultRow.fileKey ? [vaultRow.fileKey] : [],
                     ),
                  );
                  const newVaultRows = vaultRows.filter(
                     (vaultRow) =>
                        vaultRow.fileKey &&
                        !existingFileKeys.has(vaultRow.fileKey),
                  );
                  if (newVaultRows.length > 0) {
                     await tx.insert(vaultDocuments).values(newVaultRows);
                  }
               }
               return row;
            }),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao atualizar lançamento.",
            }),
      });
      if (updated.isErr()) throw updated.error;
      return updated.value;
   });

export const bulkUpdate = protectedProcedure
   .input(
      z
         .object({
            ids: z.array(z.string().uuid()).min(1).max(500),
         })
         .merge(updateTransactionSchema),
   )
   .use(requireOwnedTransactionIds, (input) => input.ids)
   .handler(async ({ context, input }) => {
      const { ids, tagId, ...data } = input;
      if ("tagId" in input) {
         const policyResult = await Result.tryPromise({
            try: () =>
               context.db.query.financialConfig.findFirst({
                  where: (f, { eq }) => eq(f.teamId, context.teamId),
               }),
            catch: () =>
               new TransactionRouterError({
                  error: transactionRouterErrors.INTERNAL(),
                  message: "Falha ao verificar configurações.",
               }),
         });
         if (policyResult.isErr()) throw policyResult.error;
         if (policyResult.value?.costCenterRequired && !input.tagId) {
            throw new TransactionRouterError({
               error: transactionRouterErrors.FORBIDDEN(),
               message: "Centro de Custo é obrigatório para este espaço.",
            });
         }
      }

      const existingRows = await Result.tryPromise({
         try: () =>
            context.db.query.transactions.findMany({
               where: (f, { and, inArray, eq }) =>
                  and(inArray(f.id, ids), eq(f.teamId, context.teamId)),
            }),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao verificar lançamentos.",
            }),
      });
      if (existingRows.isErr()) throw existingRows.error;

      const finalReferences = existingRows.value.map((row) => ({
         bankAccountId:
            data.bankAccountId !== undefined
               ? data.bankAccountId
               : row.bankAccountId,
         destinationBankAccountId:
            data.destinationBankAccountId !== undefined
               ? data.destinationBankAccountId
               : row.destinationBankAccountId,
         categoryId:
            data.categoryId !== undefined ? data.categoryId : row.categoryId,
         tagId: tagId !== undefined ? tagId : row.tagId,
         relationshipId:
            data.relationshipId !== undefined
               ? data.relationshipId
               : row.relationshipId,
         date: data.date !== undefined ? data.date : row.date,
      }));

      const bankAccountIds = new Set<string>();
      const categoryIds = new Set<string>();
      const relationshipIds = new Set<string>();
      const tagIds = new Set<string>();
      for (const refs of finalReferences) {
         if (refs.bankAccountId) bankAccountIds.add(refs.bankAccountId);
         if (refs.destinationBankAccountId) {
            bankAccountIds.add(refs.destinationBankAccountId);
         }
         if (refs.categoryId) categoryIds.add(refs.categoryId);
         if (refs.relationshipId) relationshipIds.add(refs.relationshipId);
         if (refs.tagId) tagIds.add(refs.tagId);
      }

      const bankAccountRowsResult = await Result.tryPromise({
         try: () =>
            bankAccountIds.size > 0
               ? context.db.query.bankAccounts.findMany({
                    where: (f, { inArray }) =>
                       inArray(f.id, Array.from(bankAccountIds)),
                 })
               : Promise.resolve([]),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao verificar contas bancárias.",
            }),
      });
      if (bankAccountRowsResult.isErr()) throw bankAccountRowsResult.error;

      const categoryRowsResult = await Result.tryPromise({
         try: () =>
            categoryIds.size > 0
               ? context.db.query.categories.findMany({
                    where: (f, { inArray }) =>
                       inArray(f.id, Array.from(categoryIds)),
                 })
               : Promise.resolve([]),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao verificar categorias.",
            }),
      });
      if (categoryRowsResult.isErr()) throw categoryRowsResult.error;

      const tagRowsResult = await Result.tryPromise({
         try: () =>
            tagIds.size > 0
               ? context.db.query.tags.findMany({
                    where: (f, { inArray }) =>
                       inArray(f.id, Array.from(tagIds)),
                 })
               : Promise.resolve([]),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao verificar Centros de Custo.",
            }),
      });
      if (tagRowsResult.isErr()) throw tagRowsResult.error;

      const relationshipRowsResult = await Result.tryPromise({
         try: () =>
            relationshipIds.size > 0
               ? context.db.query.parties.findMany({
                    where: (f, { inArray }) =>
                       inArray(f.id, Array.from(relationshipIds)),
                 })
               : Promise.resolve([]),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao verificar relacionamentos.",
            }),
      });
      if (relationshipRowsResult.isErr()) throw relationshipRowsResult.error;

      const bankAccountRows = new Map(
         bankAccountRowsResult.value.map((account) => [account.id, account]),
      );
      const categoryRows = new Map(
         categoryRowsResult.value.map((category) => [category.id, category]),
      );
      const tagRows = new Map(tagRowsResult.value.map((tag) => [tag.id, tag]));
      const relationshipRows = new Map(
         relationshipRowsResult.value.map((relationship) => [
            relationship.id,
            relationship,
         ]),
      );

      for (const refs of finalReferences) {
         if (refs.bankAccountId) {
            const account = bankAccountRows.get(refs.bankAccountId);
            if (!account || account.teamId !== context.teamId) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: "Conta bancária inválida.",
               });
            }
            if (
               account.initialBalanceDate &&
               refs.date &&
               dayjs(refs.date).isBefore(dayjs(account.initialBalanceDate))
            ) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: `Não é possível registrar lançamentos antes da data do saldo inicial (${dayjs(account.initialBalanceDate).format("DD/MM/YYYY")}).`,
               });
            }
         }

         if (refs.destinationBankAccountId) {
            const account = bankAccountRows.get(refs.destinationBankAccountId);
            if (!account || account.teamId !== context.teamId) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: "Conta de destino inválida.",
               });
            }
            if (
               account.initialBalanceDate &&
               refs.date &&
               dayjs(refs.date).isBefore(dayjs(account.initialBalanceDate))
            ) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: `Não é possível registrar lançamentos antes da data do saldo inicial da conta de destino (${dayjs(account.initialBalanceDate).format("DD/MM/YYYY")}).`,
               });
            }
         }

         if (refs.categoryId) {
            const category = categoryRows.get(refs.categoryId);
            if (!category || category.teamId !== context.teamId) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: "Categoria inválida.",
               });
            }
            if (category.isArchived) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: "Categoria arquivada.",
               });
            }
         }

         if (refs.tagId) {
            const tag = tagRows.get(refs.tagId);
            if (!tag || tag.teamId !== context.teamId) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: "Centro de Custo inválido.",
               });
            }
         }

         if (refs.relationshipId) {
            const relationship = relationshipRows.get(refs.relationshipId);
            if (!relationship || relationship.teamId !== context.teamId) {
               throw new TransactionRouterError({
                  error: transactionRouterErrors.BAD_REQUEST(),
                  message: "Relacionamento inválido.",
               });
            }
         }
      }

      const updateData = (() => {
         if (tagId !== undefined && data.categoryId !== undefined) {
            return {
               ...data,
               tagId,
               suggestedTagId: null,
               suggestedCategoryId: null,
            };
         }
         if (tagId !== undefined) {
            return { ...data, tagId, suggestedTagId: null };
         }
         if (data.categoryId !== undefined) {
            return { ...data, suggestedCategoryId: null };
         }
         return data;
      })();

      const updated = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set(updateData)
                  .where(inArray(transactions.id, ids))
                  .returning(),
            ),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao atualizar lançamentos.",
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
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao excluir lançamento.",
            }),
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
   .use(requireOwnedTransactionIds, (input) => input.ids)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               await tx
                  .delete(transactionRecurrences)
                  .where(
                     inArray(
                        transactionRecurrences.sourceTransactionId,
                        input.ids,
                     ),
                  );
               return tx
                  .delete(transactions)
                  .where(inArray(transactions.id, input.ids));
            }),
         catch: () =>
            new TransactionRouterError({
               error: transactionRouterErrors.INTERNAL(),
               message: "Falha ao excluir lançamentos.",
            }),
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   });
