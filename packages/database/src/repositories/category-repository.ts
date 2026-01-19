import { AppError, propagateError } from "@packages/utils/errors";
import { and, count, eq, ilike, inArray, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   category,
   type TransactionTypeValue,
   transactionCategory,
} from "../schemas/categories";
import { transaction } from "../schemas/transactions";
import {
   buildPaginationMeta,
   calculateOffset,
   type PaginationOptions,
} from "../utils/pagination";

export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;
export type TransactionCategory = typeof transactionCategory.$inferSelect;
export type NewTransactionCategory = typeof transactionCategory.$inferInsert;
export type { TransactionTypeValue } from "../schemas/categories";

export async function createCategory(
   dbClient: DatabaseInstance,
   data: NewCategory,
) {
   try {
      const result = await dbClient.insert(category).values(data).returning();
      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict(
            "Category already exists for this organization",
            { cause: err },
         );
      }

      propagateError(err);
      throw AppError.database(`Failed to create category: ${error.message}`, {
         cause: err,
      });
   }
}

export async function findCategoryById(
   dbClient: DatabaseInstance,
   categoryId: string,
) {
   try {
      const result = await dbClient.query.category.findFirst({
         where: (category, { eq }) => eq(category.id, categoryId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find category by id: ${(err as Error).message}`,
      );
   }
}

export async function findCategoriesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.query.category.findMany({
         orderBy: (category, { asc }) => asc(category.name),
         where: (category, { eq }) =>
            eq(category.organizationId, organizationId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find categories by organization id: ${(err as Error).message}`,
      );
   }
}

export async function findCategoriesByTransactionType(
   dbClient: DatabaseInstance,
   organizationId: string,
   transactionType: TransactionTypeValue,
) {
   try {
      const result = await dbClient
         .select()
         .from(category)
         .where(
            and(
               eq(category.organizationId, organizationId),
               sql`${category.transactionTypes} @> ARRAY[${transactionType}]::text[]`,
            ),
         )
         .orderBy(category.name);
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find categories by transaction type: ${(err as Error).message}`,
      );
   }
}

export async function findCategoriesByOrganizationIdPaginated(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: PaginationOptions<"name" | "createdAt" | "updatedAt"> = {},
) {
   const {
      page = 1,
      limit = 10,
      orderBy = "name",
      orderDirection = "asc",
      search,
   } = options;

   const offset = calculateOffset(page, limit);

   try {
      const baseWhereCondition = eq(category.organizationId, organizationId);
      const whereCondition = search
         ? and(baseWhereCondition, ilike(category.name, `%${search}%`))
         : baseWhereCondition;

      const [categories, totalCount] = await Promise.all([
         dbClient.query.category.findMany({
            limit,
            offset,
            orderBy: (category, { asc, desc }) => {
               const column = category[orderBy as keyof typeof category];
               return orderDirection === "asc" ? asc(column) : desc(column);
            },
            where: whereCondition,
         }),
         dbClient.query.category
            .findMany({
               where: whereCondition,
            })
            .then((result) => result.length),
      ]);

      return {
         categories,
         pagination: buildPaginationMeta(totalCount, page, limit),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find categories by organization id paginated: ${(err as Error).message}`,
      );
   }
}

export async function updateCategory(
   dbClient: DatabaseInstance,
   categoryId: string,
   data: Partial<NewCategory>,
) {
   try {
      const existingCategory = await findCategoryById(dbClient, categoryId);
      if (!existingCategory) {
         throw AppError.notFound("Category not found");
      }

      const result = await dbClient
         .update(category)
         .set(data)
         .where(eq(category.id, categoryId))
         .returning();

      if (!result.length) {
         throw AppError.database("Category not found");
      }

      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict(
            "Category already exists for this organization",
            { cause: err },
         );
      }

      if (err instanceof AppError) {
         throw err;
      }

      propagateError(err);
      throw AppError.database(`Failed to update category: ${error.message}`, {
         cause: err,
      });
   }
}

export async function deleteCategory(
   dbClient: DatabaseInstance,
   categoryId: string,
) {
   try {
      const result = await dbClient
         .delete(category)
         .where(eq(category.id, categoryId))
         .returning();

      if (!result.length) {
         throw AppError.database("Category not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete category: ${(err as Error).message}`,
      );
   }
}

export async function deleteManyCategories(
   dbClient: DatabaseInstance,
   categoryIds: string[],
   organizationId: string,
) {
   if (categoryIds.length === 0) {
      return [];
   }

   try {
      const result = await dbClient
         .delete(category)
         .where(
            and(
               inArray(category.id, categoryIds),
               eq(category.organizationId, organizationId),
            ),
         )
         .returning();

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete categories: ${(err as Error).message}`,
      );
   }
}

export async function getTotalCategoriesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient
         .select({ count: count() })
         .from(category)
         .where(eq(category.organizationId, organizationId));

      return result[0]?.count || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total categories: ${(err as Error).message}`,
      );
   }
}

export async function searchCategories(
   dbClient: DatabaseInstance,
   organizationId: string,
   query: string,
   options: {
      limit?: number;
      includeTransactionCount?: boolean;
   } = {},
) {
   const { limit = 20, includeTransactionCount = false } = options;

   try {
      if (includeTransactionCount) {
         const result = await dbClient.execute<{
            id: string;
            name: string;
            color: string;
            icon: string | null;
            organizationId: string;
            createdAt: Date;
            updatedAt: Date;
            transactionCount: string;
         }>(sql`
            SELECT
               c.*,
               COUNT(tc.transaction_id) as "transactionCount"
            FROM ${category} c
            LEFT JOIN ${transactionCategory} tc ON c.id = tc.category_id
            WHERE
               c.organization_id = ${organizationId}
               AND c.name ILIKE ${`%${query}%`}
            GROUP BY c.id
            ORDER BY c.name ASC
            LIMIT ${limit}
         `);

         return result.rows.map((row) => ({
            ...row,
            transactionCount: parseInt(row.transactionCount, 10),
         }));
      }

      const result = await dbClient.query.category.findMany({
         limit,
         orderBy: (category, { asc }) => asc(category.name),
         where: and(
            eq(category.organizationId, organizationId),
            ilike(category.name, `%${query}%`),
         ),
      });

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to search categories: ${(err as Error).message}`,
      );
   }
}

export async function addCategoryToTransaction(
   dbClient: DatabaseInstance,
   transactionId: string,
   categoryId: string,
) {
   try {
      const result = await dbClient
         .insert(transactionCategory)
         .values({ categoryId, transactionId })
         .returning();

      return result[0];
   } catch (err: unknown) {
      const error = err as Error & { code?: string };

      if (error.code === "23505") {
         throw AppError.conflict(
            "Category already linked to this transaction",
            { cause: err },
         );
      }

      propagateError(err);
      throw AppError.database(
         `Failed to add category to transaction: ${error.message}`,
         { cause: err },
      );
   }
}

export async function removeCategoryFromTransaction(
   dbClient: DatabaseInstance,
   transactionId: string,
   categoryId: string,
) {
   try {
      const result = await dbClient
         .delete(transactionCategory)
         .where(
            and(
               eq(transactionCategory.transactionId, transactionId),
               eq(transactionCategory.categoryId, categoryId),
            ),
         )
         .returning();

      if (!result.length) {
         throw AppError.notFound("Category not linked to this transaction");
      }

      return result[0];
   } catch (err) {
      if (err instanceof AppError) {
         throw err;
      }
      propagateError(err);
      throw AppError.database(
         `Failed to remove category from transaction: ${(err as Error).message}`,
      );
   }
}

export async function setTransactionCategories(
   dbClient: DatabaseInstance,
   transactionId: string,
   categoryIds: string[],
) {
   try {
      await dbClient
         .delete(transactionCategory)
         .where(eq(transactionCategory.transactionId, transactionId));

      if (categoryIds.length === 0) {
         return [];
      }

      const result = await dbClient
         .insert(transactionCategory)
         .values(
            categoryIds.map((categoryId) => ({ categoryId, transactionId })),
         )
         .returning();

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to set transaction categories: ${(err as Error).message}`,
      );
   }
}

export async function findCategoriesByTransactionId(
   dbClient: DatabaseInstance,
   transactionId: string,
) {
   try {
      const result = await dbClient
         .select({
            color: category.color,
            createdAt: category.createdAt,
            icon: category.icon,
            id: category.id,
            name: category.name,
            organizationId: category.organizationId,
            transactionTypes: category.transactionTypes,
            updatedAt: category.updatedAt,
         })
         .from(transactionCategory)
         .innerJoin(category, eq(transactionCategory.categoryId, category.id))
         .where(eq(transactionCategory.transactionId, transactionId))
         .orderBy(category.name);

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find categories by transaction id: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionsByCategoryId(
   dbClient: DatabaseInstance,
   categoryId: string,
   options: {
      page?: number;
      limit?: number;
   } = {},
) {
   const { page = 1, limit = 10 } = options;
   const offset = (page - 1) * limit;

   try {
      const [transactions, totalCount] = await Promise.all([
         dbClient
            .select({
               amount: transaction.amount,
               bankAccountId: transaction.bankAccountId,
               createdAt: transaction.createdAt,
               date: transaction.date,
               description: transaction.description,
               externalId: transaction.externalId,
               id: transaction.id,
               organizationId: transaction.organizationId,
               type: transaction.type,
               updatedAt: transaction.updatedAt,
            })
            .from(transactionCategory)
            .innerJoin(
               transaction,
               eq(transactionCategory.transactionId, transaction.id),
            )
            .where(eq(transactionCategory.categoryId, categoryId))
            .orderBy(transaction.date)
            .limit(limit)
            .offset(offset),
         dbClient
            .select({ count: count() })
            .from(transactionCategory)
            .where(eq(transactionCategory.categoryId, categoryId))
            .then((result) => result[0]?.count || 0),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
         pagination: {
            currentPage: page,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            limit,
            totalCount,
            totalPages,
         },
         transactions,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transactions by category id: ${(err as Error).message}`,
      );
   }
}

export async function getCategoryWithMostTransactions(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.execute<{
         categoryId: string;
         categoryName: string;
         transactionCount: string;
      }>(sql`
         SELECT
            c.id as "categoryId",
            c.name as "categoryName",
            COUNT(tc.transaction_id) as "transactionCount"
         FROM ${category} c
         LEFT JOIN ${transactionCategory} tc ON c.id = tc.category_id
         WHERE c.organization_id = ${organizationId}
         GROUP BY c.id, c.name
         ORDER BY "transactionCount" DESC
         LIMIT 1
      `);

      const rows = result.rows;
      if (!rows || rows.length === 0) return null;

      return {
         categoryId: rows[0]?.categoryId,
         categoryName: rows[0]?.categoryName,
         transactionCount: parseInt(rows[0]?.transactionCount ?? "", 10),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get category with most transactions: ${(err as Error).message}`,
      );
   }
}

export async function findCategoriesByIds(
   dbClient: DatabaseInstance,
   categoryIds: string[],
) {
   if (categoryIds.length === 0) {
      return [];
   }

   try {
      const result = await dbClient.query.category.findMany({
         where: inArray(category.id, categoryIds),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find categories by ids: ${(err as Error).message}`,
      );
   }
}

export interface CategoryBreakdown {
   categoryId: string;
   categoryName: string;
   categoryColor: string;
   income: number;
   expenses: number;
}

export async function getCategoryBreakdown(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.execute<{
         categoryId: string;
         categoryName: string;
         categoryColor: string;
         income: string;
         expenses: string;
      }>(sql`
         SELECT
            c.id as "categoryId",
            c.name as "categoryName",
            c.color as "categoryColor",
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN CAST(t.amount AS DECIMAL) ELSE 0 END), 0) as "income",
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN CAST(t.amount AS DECIMAL) ELSE 0 END), 0) as "expenses"
         FROM ${category} c
         LEFT JOIN ${transactionCategory} tc ON c.id = tc.category_id
         LEFT JOIN ${transaction} t ON tc.transaction_id = t.id
         WHERE c.organization_id = ${organizationId}
         GROUP BY c.id, c.name, c.color
         ORDER BY c.name ASC
      `);

      return result.rows.map((row) => ({
         categoryColor: row.categoryColor,
         categoryId: row.categoryId,
         categoryName: row.categoryName,
         expenses: parseFloat(row.expenses) || 0,
         income: parseFloat(row.income) || 0,
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get category breakdown: ${(err as Error).message}`,
      );
   }
}

export interface CategoryMonthlyTrend {
   month: string;
   categories: {
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      income: number;
      expenses: number;
   }[];
}

export async function getCategoryMonthlyTrend(
   dbClient: DatabaseInstance,
   organizationId: string,
   months: number = 6,
) {
   try {
      const result = await dbClient.execute<{
         month: string;
         categoryId: string;
         categoryName: string;
         categoryColor: string;
         income: string;
         expenses: string;
      }>(sql`
         SELECT
            TO_CHAR(t.date, 'YYYY-MM') as "month",
            c.id as "categoryId",
            c.name as "categoryName",
            c.color as "categoryColor",
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN CAST(t.amount AS DECIMAL) ELSE 0 END), 0) as "income",
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN CAST(t.amount AS DECIMAL) ELSE 0 END), 0) as "expenses"
         FROM ${category} c
         LEFT JOIN ${transactionCategory} tc ON c.id = tc.category_id
         LEFT JOIN ${transaction} t ON tc.transaction_id = t.id
         WHERE c.organization_id = ${organizationId}
            AND t.date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${sql.raw(String(months - 1))} months'
         GROUP BY TO_CHAR(t.date, 'YYYY-MM'), c.id, c.name, c.color
         ORDER BY "month" ASC, c.name ASC
      `);

      const monthlyData = new Map<string, CategoryMonthlyTrend>();

      for (const row of result.rows) {
         if (!monthlyData.has(row.month)) {
            monthlyData.set(row.month, {
               categories: [],
               month: row.month,
            });
         }

         monthlyData.get(row.month)?.categories.push({
            categoryColor: row.categoryColor,
            categoryId: row.categoryId,
            categoryName: row.categoryName,
            expenses: parseFloat(row.expenses) || 0,
            income: parseFloat(row.income) || 0,
         });
      }

      return Array.from(monthlyData.values());
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get category monthly trend: ${(err as Error).message}`,
      );
   }
}

export interface TopCategory {
   categoryId: string;
   categoryName: string;
   categoryColor: string;
   total: number;
   transactionCount: number;
}

export async function getTopCategories(
   dbClient: DatabaseInstance,
   organizationId: string,
   type: "income" | "expense" | "all" = "all",
   limit: number = 5,
) {
   try {
      const typeCondition =
         type === "all"
            ? sql`t.type IN ('income', 'expense', 'transfer')`
            : sql`t.type = ${type}`;

      const result = await dbClient.execute<{
         categoryId: string;
         categoryName: string;
         categoryColor: string;
         total: string;
         transactionCount: string;
      }>(sql`
         SELECT
            c.id as "categoryId",
            c.name as "categoryName",
            c.color as "categoryColor",
            COALESCE(SUM(CAST(t.amount AS DECIMAL)), 0) as "total",
            COUNT(t.id) as "transactionCount"
         FROM ${category} c
         LEFT JOIN ${transactionCategory} tc ON c.id = tc.category_id
         LEFT JOIN ${transaction} t ON tc.transaction_id = t.id AND ${typeCondition}
         WHERE c.organization_id = ${organizationId}
         GROUP BY c.id, c.name, c.color
         HAVING COUNT(t.id) > 0
         ORDER BY "total" DESC
         LIMIT ${limit}
      `);

      return result.rows.map((row) => ({
         categoryColor: row.categoryColor,
         categoryId: row.categoryId,
         categoryName: row.categoryName,
         total: parseFloat(row.total) || 0,
         transactionCount: parseInt(row.transactionCount, 10) || 0,
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get top categories: ${(err as Error).message}`,
      );
   }
}

export interface CategoryTypeDistribution {
   categoryId: string;
   categoryName: string;
   categoryColor: string;
   incomeCount: number;
   expenseCount: number;
   incomeTotal: number;
   expenseTotal: number;
}

export async function getCategoryTypeDistribution(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.execute<{
         categoryId: string;
         categoryName: string;
         categoryColor: string;
         incomeCount: string;
         expenseCount: string;
         incomeTotal: string;
         expenseTotal: string;
      }>(sql`
         SELECT
            c.id as "categoryId",
            c.name as "categoryName",
            c.color as "categoryColor",
            COUNT(CASE WHEN t.type = 'income' THEN 1 END) as "incomeCount",
            COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as "expenseCount",
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN CAST(t.amount AS DECIMAL) ELSE 0 END), 0) as "incomeTotal",
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN CAST(t.amount AS DECIMAL) ELSE 0 END), 0) as "expenseTotal"
         FROM ${category} c
         LEFT JOIN ${transactionCategory} tc ON c.id = tc.category_id
         LEFT JOIN ${transaction} t ON tc.transaction_id = t.id
         WHERE c.organization_id = ${organizationId}
         GROUP BY c.id, c.name, c.color
         HAVING COUNT(t.id) > 0
         ORDER BY (COUNT(CASE WHEN t.type = 'income' THEN 1 END) + COUNT(CASE WHEN t.type = 'expense' THEN 1 END)) DESC
      `);

      return result.rows.map((row) => ({
         categoryColor: row.categoryColor,
         categoryId: row.categoryId,
         categoryName: row.categoryName,
         expenseCount: parseInt(row.expenseCount, 10) || 0,
         expenseTotal: parseFloat(row.expenseTotal) || 0,
         incomeCount: parseInt(row.incomeCount, 10) || 0,
         incomeTotal: parseFloat(row.incomeTotal) || 0,
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get category type distribution: ${(err as Error).message}`,
      );
   }
}

export interface CategoryUsageFrequency {
   categoryId: string;
   categoryName: string;
   categoryColor: string;
   transactionCount: number;
}

export async function getCategoryUsageFrequency(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.execute<{
         categoryId: string;
         categoryName: string;
         categoryColor: string;
         transactionCount: string;
      }>(sql`
         SELECT
            c.id as "categoryId",
            c.name as "categoryName",
            c.color as "categoryColor",
            COUNT(tc.transaction_id) as "transactionCount"
         FROM ${category} c
         LEFT JOIN ${transactionCategory} tc ON c.id = tc.category_id
         WHERE c.organization_id = ${organizationId}
         GROUP BY c.id, c.name, c.color
         ORDER BY "transactionCount" DESC
      `);

      return result.rows.map((row) => ({
         categoryColor: row.categoryColor,
         categoryId: row.categoryId,
         categoryName: row.categoryName,
         transactionCount: parseInt(row.transactionCount, 10) || 0,
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get category usage frequency: ${(err as Error).message}`,
      );
   }
}
