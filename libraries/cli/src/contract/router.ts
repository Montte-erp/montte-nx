import { oc } from "@orpc/contract";
import {
   BankAccountSchema,
   CreateBankAccountSchema,
   UpdateBankAccountSchema,
   TransactionSchema,
   CreateTransactionSchema,
   UpdateTransactionSchema,
   ListTransactionsFilterSchema,
   TransactionSummarySchema,
   PaginatedTransactionsSchema,
   CategorySchema,
   CreateCategorySchema,
   UpdateCategorySchema,
   BudgetGoalSchema,
   CreateBudgetGoalSchema,
   UpdateBudgetGoalSchema,
   ListBudgetGoalsFilterSchema,
} from "./schemas";
import { z } from "zod";

const uuid = z.string().uuid();

export const contract = {
   accounts: {
      list: oc
         .input(z.object({ includeArchived: z.boolean().optional() }))
         .output(z.array(BankAccountSchema)),
      get: oc.input(z.object({ id: uuid })).output(BankAccountSchema),
      create: oc.input(CreateBankAccountSchema).output(BankAccountSchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateBankAccountSchema))
         .output(BankAccountSchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
   },
   transactions: {
      list: oc
         .input(ListTransactionsFilterSchema)
         .output(PaginatedTransactionsSchema),
      get: oc.input(z.object({ id: uuid })).output(TransactionSchema),
      create: oc.input(CreateTransactionSchema).output(TransactionSchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateTransactionSchema))
         .output(TransactionSchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
      summary: oc
         .input(ListTransactionsFilterSchema)
         .output(TransactionSummarySchema),
   },
   categories: {
      list: oc
         .input(
            z.object({
               type: z.enum(["income", "expense"]).optional(),
               includeArchived: z.boolean().optional(),
            }),
         )
         .output(z.array(CategorySchema)),
      create: oc.input(CreateCategorySchema).output(CategorySchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateCategorySchema))
         .output(CategorySchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
      archive: oc.input(z.object({ id: uuid })).output(CategorySchema),
   },
   budgets: {
      list: oc
         .input(ListBudgetGoalsFilterSchema)
         .output(z.array(BudgetGoalSchema)),
      get: oc.input(z.object({ id: uuid })).output(BudgetGoalSchema),
      create: oc.input(CreateBudgetGoalSchema).output(BudgetGoalSchema),
      update: oc
         .input(z.object({ id: uuid }).merge(UpdateBudgetGoalSchema))
         .output(BudgetGoalSchema),
      remove: oc
         .input(z.object({ id: uuid }))
         .output(z.object({ success: z.literal(true) })),
   },
};
