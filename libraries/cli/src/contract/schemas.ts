import { z } from "zod";

const uuid = z.string().uuid();
const numericString = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const attachmentSchema = z.object({
   url: z.string().url(),
   filename: z.string().min(1),
   size: z.number().int().positive(),
   mimeType: z.string().optional(),
});

export const bankAccountTypeEnum = z.enum([
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
]);
export const bankAccountStatusEnum = z.enum(["active", "archived"]);

export const BankAccountSchema = z.object({
   id: uuid,
   name: z.string(),
   type: bankAccountTypeEnum,
   status: bankAccountStatusEnum,
   color: z.string(),
   iconUrl: z.string().nullable(),
   bankCode: z.string().nullable(),
   bankName: z.string().nullable(),
   branch: z.string().nullable(),
   accountNumber: z.string().nullable(),
   initialBalance: numericString,
   initialBalanceDate: dateString.nullable(),
   notes: z.string().nullable(),
   currentBalance: numericString,
   projectedBalance: numericString,
   createdAt: z.string(),
   updatedAt: z.string(),
});

export const CreateBankAccountSchema = z.object({
   name: z.string().min(2).max(100),
   type: bankAccountTypeEnum.default("checking"),
   color: z.string().default("#6366f1"),
   initialBalance: numericString.default("0"),
   initialBalanceDate: dateString.optional(),
   bankCode: z.string().optional(),
   bankName: z.string().optional(),
   branch: z.string().optional(),
   accountNumber: z.string().optional(),
   iconUrl: z.string().optional(),
   notes: z.string().optional(),
});

export const UpdateBankAccountSchema = CreateBankAccountSchema.partial();

export const transactionTypeEnum = z.enum(["income", "expense", "transfer"]);
export const paymentMethodEnum = z.enum([
   "pix",
   "credit_card",
   "debit_card",
   "boleto",
   "cash",
   "transfer",
   "other",
   "cheque",
   "automatic_debit",
]);

export const TransactionSchema = z.object({
   id: uuid,
   name: z.string().nullable(),
   type: transactionTypeEnum,
   amount: numericString,
   description: z.string().nullable(),
   date: dateString,
   bankAccountId: uuid.nullable(),
   destinationBankAccountId: uuid.nullable(),
   creditCardId: uuid.nullable(),
   categoryId: uuid.nullable(),
   contactId: uuid.nullable(),
   paymentMethod: paymentMethodEnum.nullable(),
   attachments: z.array(attachmentSchema).nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

export const CreateTransactionSchema = z.object({
   name: z.string().min(2).max(200).nullable().optional(),
   type: transactionTypeEnum,
   amount: numericString,
   date: dateString,
   description: z.string().max(500).nullable().optional(),
   bankAccountId: uuid.nullable().optional(),
   destinationBankAccountId: uuid.nullable().optional(),
   creditCardId: uuid.nullable().optional(),
   categoryId: uuid.nullable().optional(),
   contactId: uuid.nullable().optional(),
   paymentMethod: paymentMethodEnum.nullable().optional(),
   attachments: z.array(attachmentSchema).nullable().optional(),
   tagId: uuid.nullable().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.omit({
   type: true,
}).partial();

export const ListTransactionsFilterSchema = z.object({
   type: transactionTypeEnum.optional(),
   bankAccountId: uuid.optional(),
   categoryId: uuid.optional(),
   tagId: uuid.optional(),
   contactId: uuid.optional(),
   creditCardId: uuid.optional(),
   dateFrom: dateString.optional(),
   dateTo: dateString.optional(),
   search: z.string().optional(),
   uncategorized: z.boolean().optional(),
   paymentMethod: paymentMethodEnum.optional(),
   page: z.number().int().min(1).default(1),
   pageSize: z.number().int().min(1).max(100).default(25),
});

export const TransactionSummarySchema = z.object({
   totalCount: z.number(),
   incomeTotal: numericString,
   expenseTotal: numericString,
   balance: numericString,
});

export const PaginatedTransactionsSchema = z.object({
   data: z.array(TransactionSchema),
   total: z.number(),
});

export const categoryTypeEnum = z.enum(["income", "expense"]);

export const CategorySchema = z.object({
   id: uuid,
   parentId: uuid.nullable(),
   name: z.string(),
   type: categoryTypeEnum,
   level: z.number(),
   description: z.string().nullable(),
   isDefault: z.boolean(),
   color: z.string().nullable(),
   icon: z.string().nullable(),
   isArchived: z.boolean(),
   keywords: z.array(z.string()).nullable(),
   notes: z.string().nullable(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

export const CreateCategorySchema = z.object({
   name: z.string().min(2).max(100),
   type: categoryTypeEnum,
   parentId: uuid.nullable().optional(),
   description: z.string().max(255).nullable().optional(),
   color: z.string().nullable().optional(),
   icon: z.string().max(50).nullable().optional(),
   keywords: z.array(z.string().min(1).max(60)).max(20).nullable().optional(),
   notes: z.string().max(500).nullable().optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.omit({
   type: true,
}).partial();

export const BudgetGoalSchema = z.object({
   id: uuid,
   categoryId: uuid,
   month: z.number(),
   year: z.number(),
   limitAmount: numericString,
   alertThreshold: z.number().nullable(),
   currentSpent: numericString,
   percentUsed: z.number(),
   createdAt: z.string(),
   updatedAt: z.string(),
});

export const CreateBudgetGoalSchema = z.object({
   categoryId: uuid,
   month: z.number().int().min(1).max(12),
   year: z.number().int().min(2020),
   limitAmount: numericString,
   alertThreshold: z.number().int().min(1).max(100).nullable().optional(),
});

export const UpdateBudgetGoalSchema = z.object({
   limitAmount: numericString.optional(),
   alertThreshold: z.number().int().min(1).max(100).nullable().optional(),
});

export const ListBudgetGoalsFilterSchema = z.object({
   month: z.number().int().min(1).max(12),
   year: z.number().int().min(2020),
});
