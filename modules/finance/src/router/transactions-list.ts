import {
   ConditionGroup,
   evaluateConditionGroup,
} from "@f-o-t/condition-evaluator";
import { of, toDecimal } from "@f-o-t/money";
import { count, sql } from "drizzle-orm";
import { z } from "zod";
import { transactions } from "@core/database/schemas/transactions";
import { protectedProcedure } from "@core/orpc/server";
import {
   selectTransactionsWithJoins,
   type TransactionSortId,
} from "@modules/finance/services/transactions-query";
import {
   buildTransactionWhere,
   type TransactionFilter,
} from "@modules/finance/services/transactions-where";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const txStatus = z.enum(["pending", "paid"]);
const sortIdSchema = z.enum([
   "amount",
   "bankAccountName",
   "categoryName",
   "creditCardName",
   "date",
   "dueDate",
   "name",
   "status",
   "type",
]);
const sortingSchema = z.array(
   z.object({
      id: sortIdSchema,
      desc: z.boolean(),
   }),
);

type SortingInput = z.infer<typeof sortingSchema>;

function normalizeSorting(sorting: SortingInput | undefined) {
   return sorting?.map((rule) => ({
      id: rule.id satisfies TransactionSortId,
      desc: rule.desc,
   }));
}

const filterSchema = z
   .object({
      type: z.enum(["income", "expense", "transfer"]).optional(),
      bankAccountId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
      tagId: z.string().uuid().optional(),
      dateFrom: isoDate.optional(),
      dateTo: isoDate.optional(),
      search: z.string().max(100).optional(),
      creditCardId: z.string().uuid().optional(),
      uncategorized: z.boolean().optional(),
      paymentMethod: z.string().optional(),
      status: z.union([txStatus, z.array(txStatus)]).optional(),
      dueDateFrom: isoDate.optional(),
      dueDateTo: isoDate.optional(),
      overdueOnly: z.boolean().optional(),
      view: z
         .enum(["all", "payable", "receivable", "settled", "ignored"])
         .optional(),
      ignored: z.boolean().optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
      conditionGroup: ConditionGroup.optional(),
      sorting: sortingSchema.optional(),
   })
   .optional();

export const getAll = protectedProcedure
   .input(filterSchema)
   .handler(async ({ context, input }) => {
      const filtersIgnored =
         input?.ignored === true ||
         input?.view === "ignored" ||
         input?.view === "all";
      const filter: TransactionFilter = {
         teamId: context.teamId,
         ...input,
         includeIgnored: filtersIgnored,
      };
      const page = filter.page ?? 1;
      const pageSize = filter.pageSize ?? 50;
      const where = buildTransactionWhere(filter);
      const cg = filter.conditionGroup;

      if (cg?.scoringMode === "weighted") {
         const allRows = await selectTransactionsWithJoins(
            context.db,
            where,
            normalizeSorting(filter.sorting),
         );
         const filtered = allRows.filter(
            (row) =>
               evaluateConditionGroup(cg, {
                  data: {
                     categoryId: row.categoryId ?? null,
                     bankAccountId: row.bankAccountId,
                     creditCardId: row.creditCardId ?? null,
                     amount: Number(row.amount),
                     name: row.name ?? row.description ?? "",
                  },
               }).passed,
         );
         const offset = (page - 1) * pageSize;
         return {
            data: filtered.slice(offset, offset + pageSize),
            total: filtered.length,
         };
      }

      const [countRow] = await context.db
         .select({ total: count() })
         .from(transactions)
         .where(where);

      const data = await selectTransactionsWithJoins(
         context.db,
         where,
         normalizeSorting(filter.sorting),
      )
         .limit(pageSize)
         .offset((page - 1) * pageSize);

      return { data, total: countRow?.total ?? 0 };
   });

export const getSummary = protectedProcedure
   .input(filterSchema)
   .handler(async ({ context, input }) => {
      const filtersIgnored =
         input?.ignored === true ||
         input?.view === "ignored" ||
         input?.view === "all";
      const filter: TransactionFilter = {
         teamId: context.teamId,
         ...input,
         includeIgnored: filtersIgnored,
      };
      const where = buildTransactionWhere(filter);
      const t = transactions;
      const [row] = await context.db
         .select({
            totalCount: count(),
            incomeTotal: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'income' THEN ${t.amount} ELSE 0 END), 0)`,
            expenseTotal: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'expense' THEN ${t.amount} ELSE 0 END), 0)`,
            balance: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'income' THEN ${t.amount} WHEN ${t.type} = 'expense' THEN -${t.amount} ELSE 0 END), 0)`,
         })
         .from(t)
         .where(where);

      const c = "BRL";
      return {
         totalCount: row?.totalCount ?? 0,
         incomeTotal: toDecimal(of(row?.incomeTotal ?? "0", c)),
         expenseTotal: toDecimal(of(row?.expenseTotal ?? "0", c)),
         balance: toDecimal(of(row?.balance ?? "0", c)),
      };
   });
