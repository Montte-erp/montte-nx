import { ConditionGroup } from "@f-o-t/condition-evaluator";
import { ORPCError } from "@orpc/server";
import { getBankAccount } from "@core/database/repositories/bank-accounts-repository";
import { getCategory } from "@core/database/repositories/categories-repository";
import { getContact } from "@core/database/repositories/contacts-repository";
import { getSubcategory } from "@core/database/repositories/subcategories-repository";
import { getTag } from "@core/database/repositories/tags-repository";
import {
   createTransaction,
   createTransactionItems,
   deleteTransaction,
   getTransactionsSummary,
   getTransactionWithTags,
   listTransactions,
   replaceTransactionItems,
   updateTransaction,
} from "@core/database/repositories/transactions-repository";
import { transactions } from "@core/database/schemas/transactions";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const transactionBaseSchema = createInsertSchema(transactions)
   .pick({
      type: true,
      amount: true,
      description: true,
      date: true,
      bankAccountId: true,
      destinationBankAccountId: true,
      categoryId: true,
      subcategoryId: true,
      attachmentUrl: true,
      contactId: true,
      creditCardId: true,
      paymentMethod: true,
      isInstallment: true,
      installmentCount: true,
      installmentNumber: true,
      installmentGroupId: true,
   })
   .extend({
      name: z.string().max(200).nullable().optional(),
      amount: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
            message: "Valor deve ser maior que zero.",
         }),
      bankAccountId: z
         .string()
         .uuid({ message: "Conta bancária obrigatória." })
         .nullable()
         .optional(),
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

const transactionSchema = transactionBaseSchema.superRefine((data, ctx) => {
   if (data.type !== "transfer" && !data.categoryId) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message: "Categoria é obrigatória para receitas e despesas.",
         path: ["categoryId"],
      });
   }
});

// =============================================================================
// Helpers
// =============================================================================

async function verifyTransactionRefs(
   db: Parameters<typeof getBankAccount>[0],
   teamId: string,
   input: {
      bankAccountId?: string | null;
      destinationBankAccountId?: string | null;
      categoryId?: string | null;
      subcategoryId?: string | null;
      tagIds?: string[];
      contactId?: string | null;
      date?: Date | string | null;
   },
) {
   if (input.bankAccountId) {
      const account = await getBankAccount(db, input.bankAccountId);
      if (!account || account.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta bancária inválida.",
         });
      }
      if (account.initialBalanceDate && input.date) {
         const txDate = new Date(input.date);
         const balanceDate = new Date(account.initialBalanceDate);
         if (txDate < balanceDate) {
            throw new ORPCError("BAD_REQUEST", {
               message: `Não é possível registrar lançamentos antes da data do saldo inicial (${balanceDate.toLocaleDateString("pt-BR")}).`,
            });
         }
      }
   }

   if (input.destinationBankAccountId) {
      const dest = await getBankAccount(db, input.destinationBankAccountId);
      if (!dest || dest.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta de destino inválida.",
         });
      }
      if (dest.initialBalanceDate && input.date) {
         const txDate = new Date(input.date);
         const balanceDate = new Date(dest.initialBalanceDate);
         if (txDate < balanceDate) {
            throw new ORPCError("BAD_REQUEST", {
               message: `Não é possível registrar lançamentos antes da data do saldo inicial da conta de destino (${balanceDate.toLocaleDateString("pt-BR")}).`,
            });
         }
      }
   }

   if (input.categoryId) {
      const cat = await getCategory(input.categoryId);
      if (!cat || cat.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", { message: "Categoria inválida." });
      }
   }

   if (input.subcategoryId) {
      const sub = await getSubcategory(db, input.subcategoryId);
      if (!sub || sub.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Subcategoria inválida.",
         });
      }
   }

   if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
         const tag = await getTag(db, tagId);
         if (!tag || tag.teamId !== teamId) {
            throw new ORPCError("BAD_REQUEST", { message: "Tag inválida." });
         }
      }
   }

   if (input.contactId) {
      const contact = await getContact(db, input.contactId);
      if (!contact || contact.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Contato inválido.",
         });
      }
   }
}

// =============================================================================
// Transaction Procedures
// =============================================================================

export const create = protectedProcedure
   .input(transactionSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      if (input.type === "transfer") {
         if (!input.destinationBankAccountId) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Transferências exigem uma conta de destino.",
            });
         }
         if (!input.bankAccountId) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Transferências exigem uma conta de origem.",
            });
         }
         if (input.bankAccountId === input.destinationBankAccountId) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Conta de origem e destino devem ser diferentes.",
            });
         }
      }
      await verifyTransactionRefs(db, teamId, {
         bankAccountId: input.bankAccountId,
         destinationBankAccountId: input.destinationBankAccountId,
         categoryId: input.type === "transfer" ? null : input.categoryId,
         subcategoryId: input.type === "transfer" ? null : input.subcategoryId,
         tagIds: input.tagIds,
         contactId: input.contactId,
         date: input.date,
      });
      const { tagIds, items, ...data } = input;

      if (input.type === "transfer") {
         // Single record: bankAccountId = origin (negative effect), destinationBankAccountId = destination (positive effect)
         const transaction = await createTransaction(
            db,
            {
               ...data,
               teamId,
               categoryId: null,
               subcategoryId: null,
               type: "transfer",
               bankAccountId: input.bankAccountId,
               destinationBankAccountId: input.destinationBankAccountId,
            },
            tagIds,
         );

         if (items && items.length > 0 && transaction) {
            await createTransactionItems(db, transaction.id, teamId, items);
         }
         return transaction;
      }

      const transaction = await createTransaction(
         db,
         { ...data, teamId },
         tagIds,
      );
      if (items && items.length > 0 && transaction) {
         await createTransactionItems(db, transaction.id, teamId, items);
      }
      return transaction;
   });

export const getAll = protectedProcedure
   .input(
      z
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
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listTransactions(db, { teamId, ...input });
   });

export const getSummary = protectedProcedure
   .input(
      z
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
            paymentMethod: z.string().optional(),
            uncategorized: z.boolean().optional(),
            conditionGroup: ConditionGroup.optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return getTransactionsSummary(db, { teamId, ...input });
   });

export const getById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const transaction = await getTransactionWithTags(db, input.id);
      if (!transaction || transaction.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Transação não encontrada.",
         });
      }
      return transaction;
   });

export const update = protectedProcedure
   .input(
      z
         .object({ id: z.string().uuid() })
         .merge(transactionBaseSchema.partial()),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const existing = await getTransactionWithTags(db, input.id);
      if (!existing || existing.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Transação não encontrada.",
         });
      }
      if (
         input.bankAccountId ||
         input.destinationBankAccountId ||
         input.categoryId ||
         input.subcategoryId ||
         input.tagIds ||
         input.contactId
      ) {
         await verifyTransactionRefs(db, teamId, {
            bankAccountId: input.bankAccountId ?? existing.bankAccountId,
            destinationBankAccountId: input.destinationBankAccountId,
            categoryId: input.categoryId,
            subcategoryId: input.subcategoryId,
            tagIds: input.tagIds,
            contactId: input.contactId,
            date: input.date ?? existing.date,
         });
      }
      const { id, tagIds, items, ...data } = input;
      const result = await updateTransaction(db, id, data, tagIds);
      if (items !== undefined) {
         await replaceTransactionItems(db, id, teamId, items);
      }
      return result;
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const transaction = await getTransactionWithTags(db, input.id);
      if (!transaction || transaction.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Transação não encontrada.",
         });
      }
      await deleteTransaction(db, input.id);
      return { success: true };
   });

export const importBulk = protectedProcedure
   .input(
      z.object({
         transactions: z
            .array(
               transactionBaseSchema.extend({
                  name: z.string().max(200).nullable().optional(),
               }),
            )
            .min(1)
            .max(500),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      let imported = 0;
      for (const t of input.transactions) {
         const { tagIds, items, ...data } = t;
         await verifyTransactionRefs(db, teamId, {
            bankAccountId: data.bankAccountId,
            destinationBankAccountId: data.destinationBankAccountId,
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId,
            tagIds,
            date: data.date,
         });
         await createTransaction(db, { ...data, teamId }, tagIds);
         imported++;
      }
      return { imported, skipped: 0 };
   });
