import { ORPCError } from "@orpc/server";
import { getBankAccount } from "@core/database/repositories/bank-accounts-repository";
import {
   createBill,
   createBillsBatch,
   createRecurrenceSetting,
   deleteBill,
   getBill,
   listBills,
   updateBill,
} from "@core/database/repositories/bills-repository";
import { getCategory } from "@core/database/repositories/categories-repository";
import {
   createTransaction,
   deleteTransaction,
} from "@core/database/repositories/transactions-repository";
import { z } from "zod";
import { protectedProcedure } from "../server";

const billBaseSchema = z.object({
   name: z.string().min(1).max(200),
   description: z.string().nullable().optional(),
   type: z.enum(["payable", "receivable"]),
   amount: z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Valor deve ser maior que zero.",
   }),
   dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   bankAccountId: z.string().uuid().nullable().optional(),
   categoryId: z.string().uuid().nullable().optional(),
   attachmentUrl: z.string().nullable().optional(),
});

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

async function verifyBillRefs(
   teamId: string,
   input: {
      bankAccountId?: string | null;
      categoryId?: string | null;
   },
) {
   if (input.bankAccountId) {
      const account = await getBankAccount(input.bankAccountId);
      if (!account || account.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta bancária inválida.",
         });
      }
   }

   if (input.categoryId) {
      const cat = await getCategory(input.categoryId);
      if (!cat || cat.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", { message: "Categoria inválida." });
      }
   }
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
      const { teamId } = context;
      return listBills({ teamId, ...input });
   });

export const create = protectedProcedure
   .input(
      z.object({
         bill: billBaseSchema,
         installment: installmentSchema.optional(),
         recurrence: recurrenceSchema.optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const { bill, installment, recurrence } = input;

      await verifyBillRefs(teamId, {
         bankAccountId: bill.bankAccountId,
         categoryId: bill.categoryId,
      });

      if (!installment && !recurrence) {
         return createBill(teamId, bill);
      }

      if (installment) {
         const { mode, count, amounts } = installment;
         const groupId = crypto.randomUUID();
         const batchData = Array.from({ length: count }, (_, i) => {
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

         return createBillsBatch(batchData);
      }

      if (recurrence) {
         const { frequency, windowMonths, endsAt } = recurrence;

         const setting = await createRecurrenceSetting(teamId, {
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
            throw new ORPCError("BAD_REQUEST", {
               message: "Nenhuma parcela gerada dentro da janela configurada.",
            });
         }

         return createBillsBatch(batchData);
      }
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(billBaseSchema.partial()))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const { id, ...data } = input;

      const existing = await getBill(id);
      if (!existing || existing.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta a pagar/receber não encontrada.",
         });
      }

      if (existing.status === "paid") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível editar uma conta já paga.",
         });
      }

      if (data.bankAccountId !== undefined || data.categoryId !== undefined) {
         await verifyBillRefs(teamId, {
            bankAccountId: data.bankAccountId,
            categoryId: data.categoryId,
         });
      }

      return updateBill(id, data);
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
      const { teamId } = context;
      const { id, amount, date, bankAccountId, paymentType } = input;

      const bill = await getBill(id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta a pagar/receber não encontrada.",
         });
      }

      if (bill.status === "paid") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Esta conta já foi paga.",
         });
      }

      if (bill.status === "cancelled") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível pagar uma conta cancelada.",
         });
      }

      if (paymentType === "partial" && Number(amount) >= Number(bill.amount)) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Valor parcial deve ser menor que o valor da conta.",
         });
      }

      const resolvedBankAccountId = bankAccountId ?? bill.bankAccountId ?? null;

      if (!resolvedBankAccountId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta bancária é obrigatória para pagar uma conta.",
         });
      }

      const account = await getBankAccount(resolvedBankAccountId);
      if (!account || account.teamId !== teamId) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Conta bancária inválida.",
         });
      }

      const transactionType = bill.type === "payable" ? "expense" : "income";

      const transaction = await createTransaction(
         teamId,
         {
            name: bill.name,
            type: transactionType,
            amount,
            description: bill.description ?? null,
            date,
            bankAccountId: resolvedBankAccountId,
            categoryId: bill.categoryId ?? null,
            attachmentUrl: bill.attachmentUrl ?? null,
         },
         [],
      );

      if (!transaction) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Falha ao criar transação.",
         });
      }

      if (paymentType === "partial") {
         const remaining = (Number(bill.amount) - Number(amount)).toFixed(2);
         return updateBill(id, { amount: remaining });
      }

      return updateBill(id, {
         status: "paid",
         paidAt: new Date(),
         transactionId: transaction.id,
      });
   });

export const unpay = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;

      const bill = await getBill(input.id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta a pagar/receber não encontrada.",
         });
      }

      if (bill.status !== "paid") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Esta conta não está paga.",
         });
      }

      if (bill.transactionId) {
         await deleteTransaction(bill.transactionId);
      }

      return updateBill(input.id, {
         status: "pending",
         paidAt: null,
         transactionId: null,
      });
   });

export const cancel = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;

      const bill = await getBill(input.id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta a pagar/receber não encontrada.",
         });
      }

      return updateBill(input.id, { status: "cancelled" });
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;

      const bill = await getBill(input.id);
      if (!bill || bill.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta a pagar/receber não encontrada.",
         });
      }

      if (bill.status === "paid") {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível excluir uma conta já paga.",
         });
      }

      await deleteBill(input.id);
      return { success: true };
   });

export const createFromTransaction = protectedProcedure
   .input(
      z.object({
         transactionId: z.string().uuid(),
         bill: billBaseSchema,
         installment: installmentSchema.optional(),
         recurrence: recurrenceSchema.optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const { bill, installment, recurrence } = input;

      await verifyBillRefs(teamId, {
         bankAccountId: bill.bankAccountId,
         categoryId: bill.categoryId,
      });

      if (!installment && !recurrence) {
         return createBill(teamId, bill);
      }

      if (installment) {
         const { mode, count, amounts } = installment;
         const groupId = crypto.randomUUID();
         const batchData = Array.from({ length: count }, (_, i) => {
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

         return createBillsBatch(batchData);
      }

      if (recurrence) {
         const { frequency, windowMonths, endsAt } = recurrence;

         const setting = await createRecurrenceSetting(teamId, {
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
            throw new ORPCError("BAD_REQUEST", {
               message: "Nenhuma parcela gerada dentro da janela configurada.",
            });
         }

         return createBillsBatch(batchData);
      }
   });
