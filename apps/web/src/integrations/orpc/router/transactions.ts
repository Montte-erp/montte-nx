import { ConditionGroup } from "@f-o-t/condition-evaluator";
import { ORPCError } from "@orpc/server";
import { getBankAccount } from "@packages/database/repositories/bank-accounts-repository";
import { getCategory } from "@packages/database/repositories/categories-repository";
import { getContact } from "@packages/database/repositories/contacts-repository";
import { getSubcategory } from "@packages/database/repositories/subcategories-repository";
import { getTag } from "@packages/database/repositories/tags-repository";
import {
   createTransaction,
   deleteTransaction,
   getTransactionWithTags,
   listTransactions,
   updateTransaction,
} from "@packages/database/repositories/transactions-repository";
import { transactions } from "@packages/database/schemas/transactions";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const transactionSchema = createInsertSchema(transactions)
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
         .uuid({ message: "Conta bancária obrigatória." }),
      tagIds: z.array(z.string().uuid()).optional().default([]),
   });

// =============================================================================
// Helpers
// =============================================================================

async function verifyTransactionRefs(
   db: Parameters<typeof getBankAccount>[0],
   teamId: string,
   input: {
      bankAccountId: string;
      destinationBankAccountId?: string | null;
      categoryId?: string | null;
      subcategoryId?: string | null;
      tagIds?: string[];
      contactId?: string | null;
   },
) {
   const account = await getBankAccount(db, input.bankAccountId);
   if (!account || account.teamId !== teamId) {
      throw new ORPCError("BAD_REQUEST", {
         message: "Conta bancária inválida.",
      });
   }

   if (input.destinationBankAccountId) {
      const dest = await getBankAccount(db, input.destinationBankAccountId);
      if (!dest || dest.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta de destino inválida.",
         });
      }
   }

   if (input.categoryId) {
      const cat = await getCategory(db, input.categoryId);
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
      if (input.type === "transfer" && !input.destinationBankAccountId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Transferências exigem uma conta de destino.",
         });
      }
      await verifyTransactionRefs(db, teamId, {
         bankAccountId: input.bankAccountId,
         destinationBankAccountId: input.destinationBankAccountId,
         categoryId: input.categoryId,
         subcategoryId: input.subcategoryId,
         tagIds: input.tagIds,
         contactId: input.contactId,
      });
      const { tagIds, ...data } = input;
      return createTransaction(db, { ...data, teamId }, tagIds);
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
      z.object({ id: z.string().uuid() }).merge(transactionSchema.partial()),
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
            bankAccountId: input.bankAccountId ?? existing.bankAccountId ?? "",
            destinationBankAccountId: input.destinationBankAccountId,
            categoryId: input.categoryId,
            subcategoryId: input.subcategoryId,
            tagIds: input.tagIds,
            contactId: input.contactId,
         });
      }
      const { id, tagIds, ...data } = input;
      return updateTransaction(db, id, data, tagIds);
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
               transactionSchema.extend({
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
         const { tagIds, ...data } = t;
         await verifyTransactionRefs(db, teamId, {
            bankAccountId: data.bankAccountId ?? "",
            destinationBankAccountId: data.destinationBankAccountId,
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId,
            tagIds,
         });
         await createTransaction(db, { ...data, teamId }, tagIds);
         imported++;
      }
      return { imported, skipped: 0 };
   });
