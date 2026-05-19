import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { AgentReadClient } from "@modules/agents/tools/registry";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

const transactionStatusSchema = z.enum(["pending", "paid", "ignored"]);

const searchTransactionsInputSchema = z.object({
   query: z.string().trim().min(1).max(100).optional(),
   startDate: isoDate.optional(),
   endDate: isoDate.optional(),
   dueStartDate: isoDate.optional(),
   dueEndDate: isoDate.optional(),
   status: transactionStatusSchema.optional(),
   type: z.enum(["income", "expense", "transfer"]).optional(),
   categoryId: uuid.optional(),
   costCenterId: uuid.optional(),
   bankAccountId: uuid.optional(),
   creditCardId: uuid.optional(),
   limit: z.number().int().min(1).max(50).default(20),
});

const transactionRowSchema = z.object({
   id: uuid,
   name: z.string().nullable(),
   description: z.string().nullable(),
   amount: z.string(),
   type: z.enum(["income", "expense", "transfer"]),
   status: z.enum(["pending", "paid", "cancelled"]),
   ignored: z.boolean(),
   date: z.string().nullable(),
   dueDate: z.string().nullable(),
   paidAt: z.string().nullable(),
   categoryId: uuid.nullable(),
   categoryName: z.string().nullable(),
   costCenterId: uuid.nullable(),
   costCenterName: z.string().nullable(),
   bankAccountId: uuid.nullable(),
   bankAccountName: z.string().nullable(),
   creditCardId: uuid.nullable(),
   creditCardName: z.string().nullable(),
});

const searchTransactionsOutputSchema = z.object({
   data: z.array(transactionRowSchema),
   total: z.number().int().nonnegative(),
   limit: z.number().int().positive(),
});

const getFinancialSummaryInputSchema = z.object({
   startDate: isoDate,
   endDate: isoDate,
   status: z.enum(["pending", "paid"]).optional(),
   type: z.enum(["income", "expense", "transfer"]).optional(),
   categoryId: uuid.optional(),
   costCenterId: uuid.optional(),
   bankAccountId: uuid.optional(),
   creditCardId: uuid.optional(),
});

const getFinancialSummaryOutputSchema = z.object({
   totalCount: z.number().int().nonnegative(),
   incomeTotal: z.string(),
   expenseTotal: z.string(),
   balance: z.string(),
});

const listBankAccountsInputSchema = z.object({
   query: z.string().trim().min(1).max(100).optional(),
   type: z
      .enum(["checking", "savings", "investment", "payment", "cash"])
      .optional(),
   limit: z.number().int().min(1).max(50).default(20),
});

const bankAccountRowSchema = z.object({
   id: uuid,
   name: z.string(),
   type: z.enum(["checking", "savings", "investment", "payment", "cash"]),
   bankCode: z.string().nullable(),
   bankName: z.string().nullable(),
   branch: z.string().nullable(),
   accountNumber: z.string().nullable(),
   initialBalance: z.string(),
   currentBalance: z.string(),
   projectedBalance: z.string(),
});

const listBankAccountsOutputSchema = z.object({
   data: z.array(bankAccountRowSchema),
   total: z.number().int().nonnegative(),
   limit: z.number().int().positive(),
});

interface CashbookReadToolDeps {
   client: AgentReadClient;
}

function serializeDate(value: Date | string | null) {
   if (value === null) return null;
   if (typeof value === "string") return value;
   return value.toISOString();
}

export function buildCashbookReadTools({ client }: CashbookReadToolDeps) {
   return [
      toolDefinition({
         name: "search_transactions",
         description:
            "Busca lançamentos financeiros do cashbook por texto, período, vencimento, status, tipo, categoria, Centro de Custo, conta ou cartão. Use para responder perguntas sobre lançamentos específicos.",
         inputSchema: searchTransactionsInputSchema,
         outputSchema: searchTransactionsOutputSchema,
      }).server(async (input) => {
         const limit = input.limit ?? 20;
         const status = (() => {
            if (input.status === "ignored") return undefined;
            return input.status;
         })();
         const result = await client.transactions.getAll({
            search: input.query,
            dateFrom: input.startDate,
            dateTo: input.endDate,
            dueDateFrom: input.dueStartDate,
            dueDateTo: input.dueEndDate,
            status,
            type: input.type,
            categoryId: input.categoryId,
            tagId: input.costCenterId,
            bankAccountId: input.bankAccountId,
            creditCardId: input.creditCardId,
            view: input.status === "ignored" ? "ignored" : undefined,
            page: 1,
            pageSize: limit,
         });

         return {
            data: result.data.map((transaction) => ({
               id: transaction.id,
               name: transaction.name,
               description: transaction.description,
               amount: transaction.amount,
               type: transaction.type,
               status: transaction.status,
               ignored: transaction.ignored,
               date: transaction.date,
               dueDate: transaction.dueDate,
               paidAt: serializeDate(transaction.paidAt),
               categoryId: transaction.categoryId,
               categoryName: transaction.categoryName,
               costCenterId: transaction.tagId,
               costCenterName: transaction.tagName,
               bankAccountId: transaction.bankAccountId,
               bankAccountName: transaction.bankAccountName,
               creditCardId: transaction.creditCardId,
               creditCardName: transaction.creditCardName,
            })),
            total: result.total,
            limit,
         };
      }),
      toolDefinition({
         name: "get_financial_summary",
         description:
            "Calcula resumo financeiro do cashbook em um período: total de lançamentos, entradas, saídas e saldo. Use para perguntas como quanto entrou, quanto saiu ou resultado do período.",
         inputSchema: getFinancialSummaryInputSchema,
         outputSchema: getFinancialSummaryOutputSchema,
      }).server((input) =>
         client.transactions.getSummary({
            dateFrom: input.startDate,
            dateTo: input.endDate,
            status: input.status,
            type: input.type,
            categoryId: input.categoryId,
            tagId: input.costCenterId,
            bankAccountId: input.bankAccountId,
            creditCardId: input.creditCardId,
         }),
      ),
      toolDefinition({
         name: "list_bank_accounts",
         description:
            "Lista contas bancárias ativas com saldo atual e saldo projetado. Use quando precisar identificar a conta correta ou explicar saldos por conta.",
         inputSchema: listBankAccountsInputSchema,
         outputSchema: listBankAccountsOutputSchema,
      }).server(async (input) => {
         const limit = input.limit ?? 20;
         const result = await client.bankAccounts.list({
            page: 1,
            pageSize: limit,
            search: input.query,
            type: input.type,
         });

         return {
            data: result.data.map((account) => ({
               id: account.id,
               name: account.name,
               type: account.type,
               bankCode: account.bankCode,
               bankName: account.bankName,
               branch: account.branch,
               accountNumber: account.accountNumber,
               initialBalance: account.initialBalance,
               currentBalance: account.currentBalance,
               projectedBalance: account.projectedBalance,
            })),
            total: result.totalCount,
            limit,
         };
      }),
   ];
}
