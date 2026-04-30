import {
   ConditionGroup,
   evaluateConditionGroup,
} from "@f-o-t/condition-evaluator";
import { of, toDecimal } from "@f-o-t/money";
import { and, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import { protectedProcedure } from "@core/orpc/server";
import {
   buildTransactionConditions,
   type TransactionFilter,
} from "@modules/finance/router/transactions-filters";

const filterSchema = z
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
      status: z
         .union([
            z.enum(["pending", "paid", "cancelled"]),
            z.array(z.enum(["pending", "paid", "cancelled"])),
         ])
         .optional(),
      dueDateFrom: z
         .string()
         .regex(/^\d{4}-\d{2}-\d{2}$/)
         .optional(),
      dueDateTo: z
         .string()
         .regex(/^\d{4}-\d{2}-\d{2}$/)
         .optional(),
      overdueOnly: z.boolean().optional(),
      view: z
         .enum(["all", "payable", "receivable", "settled", "cancelled"])
         .optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
      conditionGroup: ConditionGroup.optional(),
   })
   .optional();

export const getAll = protectedProcedure
   .input(filterSchema)
   .handler(async ({ context, input }) => {
      const filter: TransactionFilter = {
         teamId: context.teamId,
         ...input,
      };
      const page = filter.page ?? 1;
      const pageSize = filter.pageSize ?? 50;
      const conds = buildTransactionConditions(filter, true);
      const whereClause = and(...conds);

      const isWeighted = filter.conditionGroup?.scoringMode === "weighted";

      const suggestedCategories = alias(categories, "suggested_categories");
      const suggestedTags = alias(tags, "suggested_tags");
      const tagAlias = alias(tags, "tag_alias");

      if (isWeighted && filter.conditionGroup) {
         const condGroup = filter.conditionGroup;
         const allRows = await context.db
            .select({
               ...getTableColumns(transactions),
               categoryName: categories.name,
               creditCardName: creditCards.name,
               bankAccountName: bankAccounts.name,
               contactName: contacts.name,
               suggestedCategoryName: suggestedCategories.name,
               tagName: tagAlias.name,
               suggestedTagName: suggestedTags.name,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(
               suggestedCategories,
               eq(transactions.suggestedCategoryId, suggestedCategories.id),
            )
            .leftJoin(
               creditCards,
               eq(transactions.creditCardId, creditCards.id),
            )
            .leftJoin(
               bankAccounts,
               eq(transactions.bankAccountId, bankAccounts.id),
            )
            .leftJoin(contacts, eq(transactions.contactId, contacts.id))
            .leftJoin(tagAlias, eq(transactions.tagId, tagAlias.id))
            .leftJoin(
               suggestedTags,
               eq(transactions.suggestedTagId, suggestedTags.id),
            )
            .where(whereClause)
            .orderBy(desc(transactions.date));

         const filtered = allRows.filter((row) => {
            const result = evaluateConditionGroup(condGroup, {
               data: {
                  categoryId: row.categoryId ?? null,
                  bankAccountId: row.bankAccountId,
                  creditCardId: row.creditCardId ?? null,
                  amount: Number(row.amount),
                  name: row.name ?? row.description ?? "",
               },
            });
            return result.passed;
         });

         const offset = (page - 1) * pageSize;
         return {
            data: filtered.slice(offset, offset + pageSize),
            total: filtered.length,
         };
      }

      const [countRow] = await context.db
         .select({ total: count() })
         .from(transactions)
         .leftJoin(categories, eq(transactions.categoryId, categories.id))
         .leftJoin(creditCards, eq(transactions.creditCardId, creditCards.id))
         .leftJoin(
            bankAccounts,
            eq(transactions.bankAccountId, bankAccounts.id),
         )
         .leftJoin(contacts, eq(transactions.contactId, contacts.id))
         .where(whereClause);

      const data = await context.db
         .select({
            ...getTableColumns(transactions),
            categoryName: categories.name,
            creditCardName: creditCards.name,
            bankAccountName: bankAccounts.name,
            contactName: contacts.name,
            suggestedCategoryName: suggestedCategories.name,
            tagName: tagAlias.name,
            suggestedTagName: suggestedTags.name,
         })
         .from(transactions)
         .leftJoin(categories, eq(transactions.categoryId, categories.id))
         .leftJoin(
            suggestedCategories,
            eq(transactions.suggestedCategoryId, suggestedCategories.id),
         )
         .leftJoin(creditCards, eq(transactions.creditCardId, creditCards.id))
         .leftJoin(
            bankAccounts,
            eq(transactions.bankAccountId, bankAccounts.id),
         )
         .leftJoin(contacts, eq(transactions.contactId, contacts.id))
         .leftJoin(tagAlias, eq(transactions.tagId, tagAlias.id))
         .leftJoin(
            suggestedTags,
            eq(transactions.suggestedTagId, suggestedTags.id),
         )
         .where(whereClause)
         .orderBy(desc(transactions.date))
         .limit(pageSize)
         .offset((page - 1) * pageSize);

      return { data, total: countRow?.total ?? 0 };
   });

export const getSummary = protectedProcedure
   .input(filterSchema)
   .handler(async ({ context, input }) => {
      const filter: TransactionFilter = {
         teamId: context.teamId,
         ...input,
      };
      const conds = buildTransactionConditions(filter, false);
      const whereClause = and(...conds);
      const [row] = await context.db
         .select({
            totalCount: count(),
            incomeTotal: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
            expenseTotal: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
            balance: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} WHEN ${transactions.type} = 'expense' THEN -${transactions.amount} ELSE 0 END), 0)`,
         })
         .from(transactions)
         .where(whereClause);

      const currency = "BRL";
      return {
         totalCount: row?.totalCount ?? 0,
         incomeTotal: toDecimal(of(row?.incomeTotal ?? "0", currency)),
         expenseTotal: toDecimal(of(row?.expenseTotal ?? "0", currency)),
         balance: toDecimal(of(row?.balance ?? "0", currency)),
      };
   });
