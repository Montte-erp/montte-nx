import type { DatabaseInstance } from "@core/database/client";
import {
   createBill,
   createBillsBatch,
   createRecurrenceSetting,
   deleteBill,
   ensureBillOwnership,
   listBills,
   updateBill,
   validateBillReferences,
} from "@core/database/repositories/bills-repository";
import {
   createTransaction,
   deleteTransaction,
} from "@core/database/repositories/transactions-repository";
import { ensureBankAccountOwnership } from "@core/database/repositories/bank-accounts-repository";
import { createBillSchema } from "@core/database/schemas/bills";
import { AppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

const installmentSchema = z.object({
   mode: z.enum(["equal", "fixed", "irregular"]),
   count: z.number().int().min(2).max(360),
   amounts: z.array(z.string()).optional(),
});

const recurrenceSchema = z.object({
   frequency: z.enum([
      "daily",
      "weekly",
      "biweekly",
      "monthly",
      "quarterly",
      "yearly",
   ]),
   windowMonths: z.number().int().min(1).max(12).default(3),
   endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
});

function computeDueDate(
   startDate: string,
   frequency: string,
   offset: number,
): string {
   const d = new Date(startDate);
   switch (frequency) {
      case "weekly":
         d.setDate(d.getDate() + 7 * offset);
         break;
      case "biweekly":
         d.setDate(d.getDate() + 14 * offset);
         break;
      case "monthly":
         d.setMonth(d.getMonth() + offset);
         break;
      case "quarterly":
         d.setMonth(d.getMonth() + 3 * offset);
         break;
      case "yearly":
         d.setFullYear(d.getFullYear() + offset);
         break;
   }
   return d.toISOString().substring(0, 10);
}

function buildBatch(
   teamId: string,
   bill: z.infer<typeof createBillSchema>,
   installment?: z.infer<typeof installmentSchema>,
) {
   const { mode, count, amounts } = installment!;
   const groupId = crypto.randomUUID();
   return Array.from({ length: count }, (_, i) => {
      let installmentAmount: string;
      if (mode === "irregular" && amounts && amounts[i]) {
         installmentAmount = amounts[i] as string;
      } else if (mode === "equal") {
         installmentAmount = (Number(bill.amount) / count).toFixed(2);
      } else {
         installmentAmount = bill.amount;
      }

      const dueDate = computeDueDate(bill.dueDate, "monthly", i);

      return {
         ...bill,
         teamId,
         name: `${bill.name} (${i + 1}/${count})`,
         amount: installmentAmount,
         dueDate,
         installmentGroupId: groupId,
         installmentIndex: i + 1,
         installmentTotal: count,
      };
   });
}

async function buildRecurrenceBatch(
   db: DatabaseInstance,
   teamId: string,
   bill: z.infer<typeof createBillSchema>,
   recurrence: z.infer<typeof recurrenceSchema>,
) {
   const { frequency, windowMonths, endsAt } = recurrence;

   const setting = await createRecurrenceSetting(db, teamId, {
      frequency,
      windowMonths,
      endsAt: endsAt ?? null,
   });

   const windowEnd = new Date();
   windowEnd.setMonth(windowEnd.getMonth() + windowMonths);
   const windowEndStr = windowEnd.toISOString().substring(0, 10);

   const batchData = [];
   let i = 0;
   let currentDueDate = bill.dueDate;

   while (currentDueDate <= windowEndStr) {
      if (endsAt && currentDueDate > endsAt) break;

      batchData.push({
         ...bill,
         teamId,
         dueDate: currentDueDate,
         recurrenceGroupId: setting.id,
      });

      i++;
      currentDueDate = computeDueDate(bill.dueDate, frequency, i);
   }

   if (batchData.length === 0) {
      throw AppError.validation(
         "Nenhuma parcela gerada dentro da janela configurada.",
      );
   }

   return createBillsBatch(db, batchData);
}

export const getAll = protectedProcedure
   .input(
      z
         .object({
            type: z.enum(["payable", "receivable"]).optional(),
            status: z
               .enum(["pending", "paid", "cancelled", "overdue"])
               .optional(),
            categoryId: z.string().uuid().optional(),
            month: z.number().int().min(1).max(12).optional(),
            year: z.number().int().min(2000).max(2100).optional(),
            page: z.number().int().positive().default(1),
            pageSize: z.number().int().positive().max(100).default(20),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      return listBills(context.db, { teamId: context.teamId, ...input });
   });

export const create = protectedProcedure
   .input(
      z.object({
         bill: createBillSchema,
         installment: installmentSchema.optional(),
         recurrence: recurrenceSchema.optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { bill, installment, recurrence } = input;

      await validateBillReferences(db, teamId, {
         bankAccountId: bill.bankAccountId,
         categoryId: bill.categoryId,
         contactId: bill.contactId,
      });

      if (!installment && !recurrence) {
         return createBill(db, teamId, bill);
      }

      if (installment) {
         return createBillsBatch(db, buildBatch(teamId, bill, installment));
      }

      if (recurrence) {
         return buildRecurrenceBatch(db, teamId, bill, recurrence);
      }
   });

export const update = protectedProcedure
   .input(idSchema.merge(createBillSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { id, ...data } = input;

      const existing = await ensureBillOwnership(db, id, teamId);

      if (existing.status === "paid") {
         throw AppError.validation("Não é possível editar uma conta já paga.");
      }

      if (
         data.bankAccountId !== undefined ||
         data.categoryId !== undefined ||
         data.contactId !== undefined
      ) {
         await validateBillReferences(db, teamId, {
            bankAccountId: data.bankAccountId,
            categoryId: data.categoryId,
            contactId: data.contactId,
         });
      }

      return updateBill(db, id, data);
   });

export const pay = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         amount: z
            .string()
            .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
               message: "Valor deve ser maior que zero.",
            }),
         date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
         bankAccountId: z.string().uuid().optional(),
         paymentType: z.enum(["total", "partial"]).default("total"),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { id, amount, date, bankAccountId, paymentType } = input;

      const bill = await ensureBillOwnership(db, id, teamId);

      if (bill.status === "paid") {
         throw AppError.validation("Esta conta já foi paga.");
      }

      if (bill.status === "cancelled") {
         throw AppError.validation("Não é possível pagar uma conta cancelada.");
      }

      if (paymentType === "partial" && Number(amount) >= Number(bill.amount)) {
         throw AppError.validation(
            "Valor parcial deve ser menor que o valor da conta.",
         );
      }

      const resolvedBankAccountId = bankAccountId ?? bill.bankAccountId ?? null;

      if (!resolvedBankAccountId) {
         throw AppError.validation(
            "Conta bancária é obrigatória para pagar uma conta.",
         );
      }

      await ensureBankAccountOwnership(db, resolvedBankAccountId, teamId);

      const transactionType = bill.type === "payable" ? "expense" : "income";

      const transaction = await createTransaction(
         db,
         teamId,
         {
            name: bill.name,
            type: transactionType,
            amount,
            description: bill.description ?? null,
            date,
            bankAccountId: resolvedBankAccountId,
            categoryId: bill.categoryId ?? null,
         },
         [],
      );

      if (!transaction) {
         throw AppError.database("Falha ao criar transação.");
      }

      if (paymentType === "partial") {
         const remaining = (Number(bill.amount) - Number(amount)).toFixed(2);
         return updateBill(db, id, { amount: remaining });
      }

      return updateBill(db, id, {
         status: "paid",
         paidAt: new Date(),
         transactionId: transaction.id,
      });
   });

export const unpay = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const bill = await ensureBillOwnership(
         context.db,
         input.id,
         context.teamId,
      );

      if (bill.status !== "paid") {
         throw AppError.validation("Esta conta não está paga.");
      }

      if (bill.transactionId) {
         await deleteTransaction(context.db, bill.transactionId);
      }

      return updateBill(context.db, input.id, {
         status: "pending",
         paidAt: null,
         transactionId: null,
      });
   });

export const cancel = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureBillOwnership(context.db, input.id, context.teamId);
      return updateBill(context.db, input.id, { status: "cancelled" });
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const bill = await ensureBillOwnership(
         context.db,
         input.id,
         context.teamId,
      );

      if (bill.status === "paid") {
         throw AppError.validation("Não é possível excluir uma conta já paga.");
      }

      await deleteBill(context.db, input.id);
      return { success: true };
   });

export const createFromTransaction = protectedProcedure
   .input(
      z.object({
         transactionId: z.string().uuid(),
         bill: createBillSchema,
         installment: installmentSchema.optional(),
         recurrence: recurrenceSchema.optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const { bill, installment, recurrence } = input;

      await validateBillReferences(db, teamId, {
         bankAccountId: bill.bankAccountId,
         categoryId: bill.categoryId,
         contactId: bill.contactId,
      });

      if (!installment && !recurrence) {
         return createBill(db, teamId, bill);
      }

      if (installment) {
         return createBillsBatch(db, buildBatch(teamId, bill, installment));
      }

      if (recurrence) {
         return buildRecurrenceBatch(db, teamId, bill, recurrence);
      }
   });
