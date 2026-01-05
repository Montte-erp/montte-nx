import { decryptTransactionFields } from "@packages/encryption/service";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { bankAccount } from "../schemas/bank-accounts";
import { bill } from "../schemas/bills";
import { category, transactionCategory } from "../schemas/categories";
import { costCenter } from "../schemas/cost-centers";
import { counterparty } from "../schemas/counterparties";
import {
   type BudgetVsActualSnapshotData,
   type CashFlowForecastSnapshotData,
   type CategoryAnalysisSnapshotData,
   type CounterpartyAnalysisSnapshotData,
   type CustomReport,
   customReport,
   type DRELineItem,
   type DRESnapshotData,
   type FilterMetadata,
   type NewCustomReport,
   type ReportFilterConfig,
   type ReportSnapshotData,
   type ReportType,
   type SpendingTrendsSnapshotData,
   type TransactionSnapshot,
} from "../schemas/custom-reports";
import { tag, transactionTag } from "../schemas/tags";
import { transaction } from "../schemas/transactions";

export type {
   BudgetVsActualSnapshotData,
   CashFlowForecastSnapshotData,
   CategoryAnalysisSnapshotData,
   CounterpartyAnalysisSnapshotData,
   CustomReport,
   DRESnapshotData,
   ReportFilterConfig,
   ReportSnapshotData,
   ReportType,
   SpendingTrendsSnapshotData,
};

export async function createCustomReport(
   dbClient: DatabaseInstance,
   data: NewCustomReport,
) {
   try {
      const result = await dbClient
         .insert(customReport)
         .values(data)
         .returning();

      if (!result[0]) {
         throw AppError.database("Failed to create custom report");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create custom report: ${(err as Error).message}`,
      );
   }
}

export async function updateCustomReport(
   dbClient: DatabaseInstance,
   reportId: string,
   data: Partial<Pick<CustomReport, "name" | "description">>,
) {
   try {
      const result = await dbClient
         .update(customReport)
         .set({
            ...data,
            updatedAt: new Date(),
         })
         .where(eq(customReport.id, reportId))
         .returning();

      if (!result[0]) {
         throw AppError.notFound("Custom report not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to update custom report: ${(err as Error).message}`,
      );
   }
}

export async function deleteCustomReport(
   dbClient: DatabaseInstance,
   reportId: string,
) {
   try {
      const result = await dbClient
         .delete(customReport)
         .where(eq(customReport.id, reportId))
         .returning();

      if (!result[0]) {
         throw AppError.notFound("Custom report not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete custom report: ${(err as Error).message}`,
      );
   }
}

export async function deleteManyCustomReports(
   dbClient: DatabaseInstance,
   reportIds: string[],
   organizationId: string,
) {
   try {
      const result = await dbClient
         .delete(customReport)
         .where(
            and(
               sql`${customReport.id} IN ${reportIds}`,
               eq(customReport.organizationId, organizationId),
            ),
         )
         .returning();

      return {
         count: result.length,
         deletedIds: result.map((r) => r.id),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete custom reports: ${(err as Error).message}`,
      );
   }
}

export async function findCustomReportById(
   dbClient: DatabaseInstance,
   reportId: string,
) {
   try {
      const result = await dbClient.query.customReport.findFirst({
         where: (report, { eq }) => eq(report.id, reportId),
         with: {
            createdByUser: {
               columns: {
                  email: true,
                  id: true,
                  name: true,
               },
            },
         },
      });

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find custom report: ${(err as Error).message}`,
      );
   }
}

export async function findCustomReportsByOrganizationIdPaginated(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: {
      page?: number;
      limit?: number;
      search?: string;
      type?: ReportType;
   } = {},
) {
   const { page = 1, limit = 10, search, type } = options;
   const offset = (page - 1) * limit;

   try {
      const conditions = [eq(customReport.organizationId, organizationId)];

      if (search) {
         conditions.push(ilike(customReport.name, `%${search}%`));
      }

      if (type) {
         conditions.push(eq(customReport.type, type));
      }

      const whereClause = and(...conditions);

      const [reports, totalCount] = await Promise.all([
         dbClient.query.customReport.findMany({
            limit,
            offset,
            orderBy: (report) => desc(report.createdAt),
            where: () => whereClause,
            with: {
               createdByUser: {
                  columns: {
                     email: true,
                     id: true,
                     name: true,
                  },
               },
            },
         }),
         dbClient
            .select({ count: sql<number>`count(*)` })
            .from(customReport)
            .where(whereClause)
            .then((result) => Number(result[0]?.count || 0)),
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
         reports,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find custom reports: ${(err as Error).message}`,
      );
   }
}

async function buildFilterMetadata(
   dbClient: DatabaseInstance,
   filterConfig?: ReportFilterConfig,
): Promise<FilterMetadata | undefined> {
   if (!filterConfig) {
      return undefined;
   }

   const hasBankAccountFilter =
      filterConfig.bankAccountIds && filterConfig.bankAccountIds.length > 0;
   const hasCategoryFilter =
      filterConfig.categoryIds && filterConfig.categoryIds.length > 0;
   const hasCostCenterFilter =
      filterConfig.costCenterIds && filterConfig.costCenterIds.length > 0;
   const hasTagFilter = filterConfig.tagIds && filterConfig.tagIds.length > 0;

   if (
      !hasBankAccountFilter &&
      !hasCategoryFilter &&
      !hasCostCenterFilter &&
      !hasTagFilter
   ) {
      return undefined;
   }

   const metadata: FilterMetadata = {
      bankAccounts: [],
      categories: [],
      costCenters: [],
      tags: [],
   };

   if (hasBankAccountFilter) {
      const bankAccountIds = filterConfig.bankAccountIds as string[];
      const bankAccounts = await dbClient
         .select({ id: bankAccount.id, name: bankAccount.name })
         .from(bankAccount)
         .where(inArray(bankAccount.id, bankAccountIds));
      metadata.bankAccounts = bankAccounts.map((ba) => ({
         id: ba.id,
         name: ba.name || "Sem nome",
      }));
   }

   if (hasCategoryFilter) {
      const categoryIds = filterConfig.categoryIds as string[];
      const categories = await dbClient
         .select({ id: category.id, name: category.name })
         .from(category)
         .where(inArray(category.id, categoryIds));
      metadata.categories = categories.map((c) => ({
         id: c.id,
         name: c.name,
      }));
   }

   if (hasCostCenterFilter) {
      const costCenterIds = filterConfig.costCenterIds as string[];
      const costCenters = await dbClient
         .select({ id: costCenter.id, name: costCenter.name })
         .from(costCenter)
         .where(inArray(costCenter.id, costCenterIds));
      metadata.costCenters = costCenters.map((cc) => ({
         id: cc.id,
         name: cc.name,
      }));
   }

   if (hasTagFilter) {
      const tagIds = filterConfig.tagIds as string[];
      const tags = await dbClient
         .select({ id: tag.id, name: tag.name })
         .from(tag)
         .where(inArray(tag.id, tagIds));
      metadata.tags = tags.map((t) => ({
         id: t.id,
         name: t.name,
      }));
   }

   return metadata;
}

function generateDRELines(
   totalIncome: number,
   totalExpenses: number,
): DRELineItem[] {
   const receitaBruta = totalIncome;
   const deducoes = 0;
   const receitaLiquida = receitaBruta - deducoes;
   const custos = 0;
   const lucroBruto = receitaLiquida - custos;
   const despesasOperacionais = totalExpenses;
   const resultadoOperacional = lucroBruto - despesasOperacionais;
   const outrasReceitasDespesas = 0;
   const resultadoLiquido = resultadoOperacional + outrasReceitasDespesas;

   return [
      {
         code: "1",
         indent: 0,
         isTotal: true,
         label: "RECEITA BRUTA",
         value: receitaBruta,
      },
      {
         code: "1.1",
         indent: 1,
         isTotal: false,
         label: "Receitas de Vendas/Serviços",
         value: totalIncome,
      },
      {
         code: "2",
         indent: 0,
         isTotal: false,
         label: "(-) DEDUÇÕES",
         value: deducoes,
      },
      {
         code: "3",
         indent: 0,
         isTotal: true,
         label: "= RECEITA LÍQUIDA",
         value: receitaLiquida,
      },
      {
         code: "4",
         indent: 0,
         isTotal: false,
         label: "(-) CUSTOS DOS PRODUTOS/SERVIÇOS",
         value: custos,
      },
      {
         code: "5",
         indent: 0,
         isTotal: true,
         label: "= LUCRO BRUTO",
         value: lucroBruto,
      },
      {
         code: "6",
         indent: 0,
         isTotal: false,
         label: "(-) DESPESAS OPERACIONAIS",
         value: despesasOperacionais,
      },
      {
         code: "6.1",
         indent: 1,
         isTotal: false,
         label: "Despesas Administrativas",
         value: totalExpenses * 0.4,
      },
      {
         code: "6.2",
         indent: 1,
         isTotal: false,
         label: "Despesas Comerciais",
         value: totalExpenses * 0.35,
      },
      {
         code: "6.3",
         indent: 1,
         isTotal: false,
         label: "Despesas Financeiras",
         value: totalExpenses * 0.25,
      },
      {
         code: "7",
         indent: 0,
         isTotal: true,
         label: "= RESULTADO OPERACIONAL",
         value: resultadoOperacional,
      },
      {
         code: "8",
         indent: 0,
         isTotal: false,
         label: "(+/-) OUTRAS RECEITAS/DESPESAS",
         value: outrasReceitasDespesas,
      },
      {
         code: "9",
         indent: 0,
         isTotal: true,
         label: "= RESULTADO LÍQUIDO DO EXERCÍCIO",
         value: resultadoLiquido,
      },
   ];
}

async function createEmptySnapshotData(
   filterConfig: ReportFilterConfig | undefined,
   dbClient: DatabaseInstance,
): Promise<DRESnapshotData> {
   const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);
   return {
      categoryBreakdown: [],
      dreLines: generateDRELines(0, 0),
      filterMetadata,
      generatedAt: new Date().toISOString(),
      summary: {
         netResult: 0,
         totalExpenses: 0,
         totalIncome: 0,
         transactionCount: 0,
      },
      transactions: [],
   };
}

export async function generateDREGerencialData(
   dbClient: DatabaseInstance,
   organizationId: string,
   startDate: Date,
   endDate: Date,
   filterConfig?: ReportFilterConfig,
): Promise<DRESnapshotData> {
   try {
      const hasBankAccountFilter =
         filterConfig?.bankAccountIds && filterConfig.bankAccountIds.length > 0;
      const hasCategoryFilter =
         filterConfig?.categoryIds && filterConfig.categoryIds.length > 0;
      const hasCostCenterFilter =
         filterConfig?.costCenterIds && filterConfig.costCenterIds.length > 0;
      const hasTagFilter =
         filterConfig?.tagIds && filterConfig.tagIds.length > 0;

      let transactionIdsFromCategoryFilter: string[] | null = null;
      if (hasCategoryFilter && filterConfig.categoryIds) {
         const categoryTransactions = await dbClient
            .select({ transactionId: transactionCategory.transactionId })
            .from(transactionCategory)
            .where(
               inArray(
                  transactionCategory.categoryId,
                  filterConfig.categoryIds,
               ),
            );
         transactionIdsFromCategoryFilter = categoryTransactions.map(
            (t) => t.transactionId,
         );
      }

      let transactionIdsFromTagFilter: string[] | null = null;
      if (hasTagFilter && filterConfig.tagIds) {
         const tagTransactions = await dbClient
            .select({ transactionId: transactionTag.transactionId })
            .from(transactionTag)
            .where(inArray(transactionTag.tagId, filterConfig.tagIds));
         transactionIdsFromTagFilter = tagTransactions.map(
            (t) => t.transactionId,
         );
      }

      const baseConditions = [
         eq(transaction.organizationId, organizationId),
         gte(transaction.date, startDate),
         lte(transaction.date, endDate),
      ];

      if (hasBankAccountFilter && filterConfig.bankAccountIds) {
         baseConditions.push(
            inArray(transaction.bankAccountId, filterConfig.bankAccountIds),
         );
      }

      if (hasCostCenterFilter && filterConfig.costCenterIds) {
         baseConditions.push(
            inArray(transaction.costCenterId, filterConfig.costCenterIds),
         );
      }

      if (transactionIdsFromCategoryFilter !== null) {
         if (transactionIdsFromCategoryFilter.length === 0) {
            return createEmptySnapshotData(filterConfig, dbClient);
         }
         baseConditions.push(
            inArray(transaction.id, transactionIdsFromCategoryFilter),
         );
      }

      if (transactionIdsFromTagFilter !== null) {
         if (transactionIdsFromTagFilter.length === 0) {
            return createEmptySnapshotData(filterConfig, dbClient);
         }
         baseConditions.push(
            inArray(transaction.id, transactionIdsFromTagFilter),
         );
      }

      const whereClause = and(...baseConditions);

      const summaryResult = await dbClient
         .select({
            totalExpenses: sql<number>`
               COALESCE(
                  SUM(
                     CASE WHEN ${transaction.type} = 'expense'
                     THEN CAST(${transaction.amount} AS REAL)
                     ELSE 0
                     END
                  ),
                  0
               )
            `,
            totalIncome: sql<number>`
               COALESCE(
                  SUM(
                     CASE WHEN ${transaction.type} = 'income'
                     THEN CAST(${transaction.amount} AS REAL)
                     ELSE 0
                     END
                  ),
                  0
               )
            `,
            totalTransactions: sql<number>`COUNT(*)`,
         })
         .from(transaction)
         .where(whereClause);

      const summaryData = summaryResult[0];
      const totalIncome = summaryData?.totalIncome || 0;
      const totalExpenses = summaryData?.totalExpenses || 0;

      const filteredTransactionIds = await dbClient
         .select({ id: transaction.id })
         .from(transaction)
         .where(whereClause);

      const txIds = filteredTransactionIds.map((t) => t.id);

      let transactionsWithCategories: {
         amount: string;
         categoryColor: string;
         categoryId: string;
         categoryName: string;
         type: string;
      }[] = [];

      if (txIds.length > 0) {
         transactionsWithCategories = await dbClient
            .select({
               amount: transaction.amount,
               categoryColor: category.color,
               categoryId: category.id,
               categoryName: category.name,
               type: transaction.type,
            })
            .from(transaction)
            .innerJoin(
               transactionCategory,
               eq(transaction.id, transactionCategory.transactionId),
            )
            .innerJoin(
               category,
               eq(transactionCategory.categoryId, category.id),
            )
            .where(inArray(transaction.id, txIds));
      }

      const categoryStats = new Map<
         string,
         {
            categoryColor: string;
            categoryName: string;
            expenses: number;
            income: number;
         }
      >();

      for (const tx of transactionsWithCategories) {
         const categoryId = tx.categoryId;
         if (!categoryStats.has(categoryId)) {
            categoryStats.set(categoryId, {
               categoryColor: tx.categoryColor || "#8884d8",
               categoryName: tx.categoryName || "Sem categoria",
               expenses: 0,
               income: 0,
            });
         }

         const stats = categoryStats.get(categoryId);
         if (!stats) continue;

         if (tx.type === "expense") {
            stats.expenses += Number(tx.amount);
         } else if (tx.type === "income") {
            stats.income += Number(tx.amount);
         }
      }

      const categoryBreakdown = Array.from(categoryStats.entries()).map(
         ([categoryId, stats]) => ({
            categoryColor: stats.categoryColor,
            categoryId,
            categoryName: stats.categoryName,
            expenses: stats.expenses,
            income: stats.income,
         }),
      );

      const dreLines = generateDRELines(totalIncome, totalExpenses);

      const transactionsResult = await dbClient.query.transaction.findMany({
         orderBy: (tx, { desc: descOp }) => descOp(tx.date),
         where: (tx, { eq: eqOp, and: andOp, gte: gteOp, lte: lteOp }) => {
            if (txIds.length === 0) {
               return sql`false`;
            }
            return andOp(
               eqOp(tx.organizationId, organizationId),
               gteOp(tx.date, startDate),
               lteOp(tx.date, endDate),
               inArray(tx.id, txIds),
            );
         },
         with: {
            bankAccount: true,
            costCenter: true,
            transactionCategories: {
               with: {
                  category: true,
               },
            },
            transactionTags: {
               with: {
                  tag: true,
               },
            },
         },
      });

      // Decrypt transaction fields before mapping to snapshot
      const decryptedTransactions = transactionsResult.map(
         decryptTransactionFields,
      );

      const transactions: TransactionSnapshot[] = decryptedTransactions.map(
         (tx) => ({
            amount: tx.amount,
            bankAccount: tx.bankAccount
               ? {
                    bank: tx.bankAccount.bank,
                    id: tx.bankAccount.id,
                    name: tx.bankAccount.name,
                 }
               : null,
            categorySplits: tx.categorySplits
               ? tx.categorySplits.map((split) => ({
                    categoryId: split.categoryId,
                    splitType: "amount" as const,
                    value: split.value,
                 }))
               : null,
            costCenter: tx.costCenter
               ? {
                    code: tx.costCenter.code,
                    id: tx.costCenter.id,
                    name: tx.costCenter.name,
                 }
               : null,
            date: tx.date.toISOString(),
            description: tx.description,
            id: tx.id,
            transactionCategories: tx.transactionCategories.map((tc) => ({
               category: {
                  color: tc.category.color,
                  icon: tc.category.icon,
                  id: tc.category.id,
                  name: tc.category.name,
               },
            })),
            transactionTags: tx.transactionTags.map((tt) => ({
               tag: {
                  color: tt.tag.color,
                  id: tt.tag.id,
                  name: tt.tag.name,
               },
            })),
            type: tx.type as "income" | "expense" | "transfer",
         }),
      );

      const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);

      return {
         categoryBreakdown,
         dreLines,
         filterMetadata,
         generatedAt: new Date().toISOString(),
         summary: {
            netResult: totalIncome - totalExpenses,
            totalExpenses,
            totalIncome,
            transactionCount: summaryData?.totalTransactions || 0,
         },
         transactions,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to generate DRE Gerencial data: ${(err as Error).message}`,
      );
   }
}

export async function generateDREFiscalData(
   dbClient: DatabaseInstance,
   organizationId: string,
   startDate: Date,
   endDate: Date,
   filterConfig?: ReportFilterConfig,
): Promise<DRESnapshotData> {
   try {
      const hasBankAccountFilter =
         filterConfig?.bankAccountIds && filterConfig.bankAccountIds.length > 0;
      const hasCategoryFilter =
         filterConfig?.categoryIds && filterConfig.categoryIds.length > 0;
      const hasCostCenterFilter =
         filterConfig?.costCenterIds && filterConfig.costCenterIds.length > 0;
      const hasTagFilter =
         filterConfig?.tagIds && filterConfig.tagIds.length > 0;

      let transactionIdsFromCategoryFilter: string[] | null = null;
      if (hasCategoryFilter && filterConfig.categoryIds) {
         const categoryTransactions = await dbClient
            .select({ transactionId: transactionCategory.transactionId })
            .from(transactionCategory)
            .where(
               inArray(
                  transactionCategory.categoryId,
                  filterConfig.categoryIds,
               ),
            );
         transactionIdsFromCategoryFilter = categoryTransactions.map(
            (t) => t.transactionId,
         );
      }

      let transactionIdsFromTagFilter: string[] | null = null;
      if (hasTagFilter && filterConfig.tagIds) {
         const tagTransactions = await dbClient
            .select({ transactionId: transactionTag.transactionId })
            .from(transactionTag)
            .where(inArray(transactionTag.tagId, filterConfig.tagIds));
         transactionIdsFromTagFilter = tagTransactions.map(
            (t) => t.transactionId,
         );
      }

      const baseConditions = [
         eq(transaction.organizationId, organizationId),
         gte(transaction.date, startDate),
         lte(transaction.date, endDate),
      ];

      if (hasBankAccountFilter && filterConfig.bankAccountIds) {
         baseConditions.push(
            inArray(transaction.bankAccountId, filterConfig.bankAccountIds),
         );
      }

      if (hasCostCenterFilter && filterConfig.costCenterIds) {
         baseConditions.push(
            inArray(transaction.costCenterId, filterConfig.costCenterIds),
         );
      }

      if (transactionIdsFromCategoryFilter !== null) {
         if (transactionIdsFromCategoryFilter.length === 0) {
            return createEmptySnapshotData(filterConfig, dbClient);
         }
         baseConditions.push(
            inArray(transaction.id, transactionIdsFromCategoryFilter),
         );
      }

      if (transactionIdsFromTagFilter !== null) {
         if (transactionIdsFromTagFilter.length === 0) {
            return createEmptySnapshotData(filterConfig, dbClient);
         }
         baseConditions.push(
            inArray(transaction.id, transactionIdsFromTagFilter),
         );
      }

      const whereClause = and(...baseConditions);

      const plannedResult = await dbClient
         .select({
            expenses: sql<number>`
               COALESCE(
                  SUM(
                     CASE WHEN ${bill.type} = 'expense'
                     THEN CAST(${bill.amount} AS REAL)
                     ELSE 0
                     END
                  ),
                  0
               )
            `,
            income: sql<number>`
               COALESCE(
                  SUM(
                     CASE WHEN ${bill.type} = 'income'
                     THEN CAST(${bill.amount} AS REAL)
                     ELSE 0
                     END
                  ),
                  0
               )
            `,
         })
         .from(bill)
         .where(
            and(
               eq(bill.organizationId, organizationId),
               gte(bill.dueDate, startDate),
               lte(bill.dueDate, endDate),
            ),
         );

      const actualResult = await dbClient
         .select({
            expenses: sql<number>`
               COALESCE(
                  SUM(
                     CASE WHEN ${transaction.type} = 'expense'
                     THEN CAST(${transaction.amount} AS REAL)
                     ELSE 0
                     END
                  ),
                  0
               )
            `,
            income: sql<number>`
               COALESCE(
                  SUM(
                     CASE WHEN ${transaction.type} = 'income'
                     THEN CAST(${transaction.amount} AS REAL)
                     ELSE 0
                     END
                  ),
                  0
               )
            `,
            totalTransactions: sql<number>`COUNT(*)`,
         })
         .from(transaction)
         .where(whereClause);

      const planned = plannedResult[0];
      const actual = actualResult[0];

      const plannedIncome = planned?.income || 0;
      const plannedExpenses = planned?.expenses || 0;
      const actualIncome = actual?.income || 0;
      const actualExpenses = actual?.expenses || 0;

      const filteredTransactionIds = await dbClient
         .select({ id: transaction.id })
         .from(transaction)
         .where(whereClause);

      const txIds = filteredTransactionIds.map((t) => t.id);

      let transactionsWithCategories: {
         amount: string;
         categoryColor: string;
         categoryId: string;
         categoryName: string;
         type: string;
      }[] = [];

      if (txIds.length > 0) {
         transactionsWithCategories = await dbClient
            .select({
               amount: transaction.amount,
               categoryColor: category.color,
               categoryId: category.id,
               categoryName: category.name,
               type: transaction.type,
            })
            .from(transaction)
            .innerJoin(
               transactionCategory,
               eq(transaction.id, transactionCategory.transactionId),
            )
            .innerJoin(
               category,
               eq(transactionCategory.categoryId, category.id),
            )
            .where(inArray(transaction.id, txIds));
      }

      const categoryStats = new Map<
         string,
         {
            categoryColor: string;
            categoryName: string;
            expenses: number;
            income: number;
         }
      >();

      for (const tx of transactionsWithCategories) {
         const categoryId = tx.categoryId;
         if (!categoryStats.has(categoryId)) {
            categoryStats.set(categoryId, {
               categoryColor: tx.categoryColor || "#8884d8",
               categoryName: tx.categoryName || "Sem categoria",
               expenses: 0,
               income: 0,
            });
         }

         const stats = categoryStats.get(categoryId);
         if (!stats) continue;

         if (tx.type === "expense") {
            stats.expenses += Number(tx.amount);
         } else if (tx.type === "income") {
            stats.income += Number(tx.amount);
         }
      }

      const categoryBreakdown = Array.from(categoryStats.entries()).map(
         ([categoryId, stats]) => ({
            categoryColor: stats.categoryColor,
            categoryId,
            categoryName: stats.categoryName,
            expenses: stats.expenses,
            income: stats.income,
         }),
      );

      const dreLines = generateDRELinesFiscal(
         actualIncome,
         actualExpenses,
         plannedIncome,
         plannedExpenses,
      );

      const transactionsResult = await dbClient.query.transaction.findMany({
         orderBy: (tx, { desc: descOp }) => descOp(tx.date),
         where: (tx, { eq: eqOp, and: andOp, gte: gteOp, lte: lteOp }) => {
            if (txIds.length === 0) {
               return sql`false`;
            }
            return andOp(
               eqOp(tx.organizationId, organizationId),
               gteOp(tx.date, startDate),
               lteOp(tx.date, endDate),
               inArray(tx.id, txIds),
            );
         },
         with: {
            bankAccount: true,
            costCenter: true,
            transactionCategories: {
               with: {
                  category: true,
               },
            },
            transactionTags: {
               with: {
                  tag: true,
               },
            },
         },
      });

      // Decrypt transaction fields before mapping to snapshot
      const decryptedTransactions = transactionsResult.map(
         decryptTransactionFields,
      );

      const transactions: TransactionSnapshot[] = decryptedTransactions.map(
         (tx) => ({
            amount: tx.amount,
            bankAccount: tx.bankAccount
               ? {
                    bank: tx.bankAccount.bank,
                    id: tx.bankAccount.id,
                    name: tx.bankAccount.name,
                 }
               : null,
            categorySplits: tx.categorySplits
               ? tx.categorySplits.map((split) => ({
                    categoryId: split.categoryId,
                    splitType: "amount" as const,
                    value: split.value,
                 }))
               : null,
            costCenter: tx.costCenter
               ? {
                    code: tx.costCenter.code,
                    id: tx.costCenter.id,
                    name: tx.costCenter.name,
                 }
               : null,
            date: tx.date.toISOString(),
            description: tx.description,
            id: tx.id,
            transactionCategories: tx.transactionCategories.map((tc) => ({
               category: {
                  color: tc.category.color,
                  icon: tc.category.icon,
                  id: tc.category.id,
                  name: tc.category.name,
               },
            })),
            transactionTags: tx.transactionTags.map((tt) => ({
               tag: {
                  color: tt.tag.color,
                  id: tt.tag.id,
                  name: tt.tag.name,
               },
            })),
            type: tx.type as "income" | "expense" | "transfer",
         }),
      );

      const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);

      return {
         categoryBreakdown,
         dreLines,
         filterMetadata,
         generatedAt: new Date().toISOString(),
         summary: {
            netResult: actualIncome - actualExpenses,
            totalExpenses: actualExpenses,
            totalIncome: actualIncome,
            transactionCount: actual?.totalTransactions || 0,
         },
         transactions,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to generate DRE Fiscal data: ${(err as Error).message}`,
      );
   }
}

function generateDRELinesFiscal(
   actualIncome: number,
   actualExpenses: number,
   plannedIncome: number,
   plannedExpenses: number,
): DRELineItem[] {
   const actualReceitaBruta = actualIncome;
   const plannedReceitaBruta = plannedIncome;
   const actualDeducoes = 0;
   const plannedDeducoes = 0;
   const actualReceitaLiquida = actualReceitaBruta - actualDeducoes;
   const plannedReceitaLiquida = plannedReceitaBruta - plannedDeducoes;
   const actualCustos = 0;
   const plannedCustos = 0;
   const actualLucroBruto = actualReceitaLiquida - actualCustos;
   const plannedLucroBruto = plannedReceitaLiquida - plannedCustos;
   const actualDespesasOperacionais = actualExpenses;
   const plannedDespesasOperacionais = plannedExpenses;
   const actualResultadoOperacional =
      actualLucroBruto - actualDespesasOperacionais;
   const plannedResultadoOperacional =
      plannedLucroBruto - plannedDespesasOperacionais;
   const actualOutras = 0;
   const plannedOutras = 0;
   const actualResultadoLiquido = actualResultadoOperacional + actualOutras;
   const plannedResultadoLiquido = plannedResultadoOperacional + plannedOutras;

   return [
      {
         code: "1",
         indent: 0,
         isTotal: true,
         label: "RECEITA BRUTA",
         plannedValue: plannedReceitaBruta,
         value: actualReceitaBruta,
         variance: actualReceitaBruta - plannedReceitaBruta,
      },
      {
         code: "1.1",
         indent: 1,
         isTotal: false,
         label: "Receitas de Vendas/Serviços",
         plannedValue: plannedIncome,
         value: actualIncome,
         variance: actualIncome - plannedIncome,
      },
      {
         code: "2",
         indent: 0,
         isTotal: false,
         label: "(-) DEDUÇÕES",
         plannedValue: plannedDeducoes,
         value: actualDeducoes,
         variance: actualDeducoes - plannedDeducoes,
      },
      {
         code: "3",
         indent: 0,
         isTotal: true,
         label: "= RECEITA LÍQUIDA",
         plannedValue: plannedReceitaLiquida,
         value: actualReceitaLiquida,
         variance: actualReceitaLiquida - plannedReceitaLiquida,
      },
      {
         code: "4",
         indent: 0,
         isTotal: false,
         label: "(-) CUSTOS DOS PRODUTOS/SERVIÇOS",
         plannedValue: plannedCustos,
         value: actualCustos,
         variance: actualCustos - plannedCustos,
      },
      {
         code: "5",
         indent: 0,
         isTotal: true,
         label: "= LUCRO BRUTO",
         plannedValue: plannedLucroBruto,
         value: actualLucroBruto,
         variance: actualLucroBruto - plannedLucroBruto,
      },
      {
         code: "6",
         indent: 0,
         isTotal: false,
         label: "(-) DESPESAS OPERACIONAIS",
         plannedValue: plannedDespesasOperacionais,
         value: actualDespesasOperacionais,
         variance: actualDespesasOperacionais - plannedDespesasOperacionais,
      },
      {
         code: "6.1",
         indent: 1,
         isTotal: false,
         label: "Despesas Administrativas",
         plannedValue: plannedExpenses * 0.4,
         value: actualExpenses * 0.4,
         variance: actualExpenses * 0.4 - plannedExpenses * 0.4,
      },
      {
         code: "6.2",
         indent: 1,
         isTotal: false,
         label: "Despesas Comerciais",
         plannedValue: plannedExpenses * 0.35,
         value: actualExpenses * 0.35,
         variance: actualExpenses * 0.35 - plannedExpenses * 0.35,
      },
      {
         code: "6.3",
         indent: 1,
         isTotal: false,
         label: "Despesas Financeiras",
         plannedValue: plannedExpenses * 0.25,
         value: actualExpenses * 0.25,
         variance: actualExpenses * 0.25 - plannedExpenses * 0.25,
      },
      {
         code: "7",
         indent: 0,
         isTotal: true,
         label: "= RESULTADO OPERACIONAL",
         plannedValue: plannedResultadoOperacional,
         value: actualResultadoOperacional,
         variance: actualResultadoOperacional - plannedResultadoOperacional,
      },
      {
         code: "8",
         indent: 0,
         isTotal: false,
         label: "(+/-) OUTRAS RECEITAS/DESPESAS",
         plannedValue: plannedOutras,
         value: actualOutras,
         variance: actualOutras - plannedOutras,
      },
      {
         code: "9",
         indent: 0,
         isTotal: true,
         label: "= RESULTADO LÍQUIDO DO EXERCÍCIO",
         plannedValue: plannedResultadoLiquido,
         value: actualResultadoLiquido,
         variance: actualResultadoLiquido - plannedResultadoLiquido,
      },
   ];
}

// =====================================================
// NEW REPORT TYPE GENERATION FUNCTIONS
// =====================================================

export async function generateBudgetVsActualData(
   dbClient: DatabaseInstance,
   organizationId: string,
   startDate: Date,
   endDate: Date,
   filterConfig?: ReportFilterConfig,
): Promise<BudgetVsActualSnapshotData> {
   try {
      const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);

      // Get budgets for the organization
      const budgets = await dbClient.query.budget.findMany({
         where: (b, { eq: eqOp, and: andOp }) =>
            andOp(
               eqOp(b.organizationId, organizationId),
               eqOp(b.isActive, true),
            ),
         with: {
            periods: {
               where: (p, { and: andOp, gte: gteOp, lte: lteOp }) =>
                  andOp(
                     gteOp(p.periodStart, startDate),
                     lteOp(p.periodEnd, endDate),
                  ),
            },
         },
      });

      // Calculate total budgeted from budget periods
      let totalBudgeted = 0;
      const budgetByCategory = new Map<
         string,
         { budgeted: number; categoryId: string }
      >();

      for (const b of budgets) {
         for (const period of b.periods) {
            totalBudgeted += Number(period.totalAmount);

            // Extract category from budget target
            const target = b.target;
            if (target?.type === "category" && target.categoryId) {
               const existing = budgetByCategory.get(target.categoryId) || {
                  budgeted: 0,
                  categoryId: target.categoryId,
               };
               existing.budgeted += Number(period.totalAmount);
               budgetByCategory.set(target.categoryId, existing);
            } else if (target?.type === "categories" && target.categoryIds) {
               const perCategoryAmount =
                  Number(period.totalAmount) / target.categoryIds.length;
               for (const catId of target.categoryIds) {
                  const existing = budgetByCategory.get(catId) || {
                     budgeted: 0,
                     categoryId: catId,
                  };
                  existing.budgeted += perCategoryAmount;
                  budgetByCategory.set(catId, existing);
               }
            }
         }
      }

      // Get actual spending from transactions
      const baseConditions = [
         eq(transaction.organizationId, organizationId),
         gte(transaction.date, startDate),
         lte(transaction.date, endDate),
         eq(transaction.type, "expense"),
      ];

      if (filterConfig?.bankAccountIds?.length) {
         baseConditions.push(
            inArray(transaction.bankAccountId, filterConfig.bankAccountIds),
         );
      }
      if (filterConfig?.costCenterIds?.length) {
         baseConditions.push(
            inArray(transaction.costCenterId, filterConfig.costCenterIds),
         );
      }

      const actualResult = await dbClient
         .select({
            totalActual: sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`,
         })
         .from(transaction)
         .where(and(...baseConditions));

      const totalActual = actualResult[0]?.totalActual || 0;
      const variance = totalBudgeted - totalActual;
      const variancePercent =
         totalBudgeted > 0 ? (variance / totalBudgeted) * 100 : 0;

      // Get actual by category
      const actualByCategory = await dbClient
         .select({
            amount: sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`,
            categoryColor: category.color,
            categoryId: category.id,
            categoryName: category.name,
         })
         .from(transaction)
         .innerJoin(
            transactionCategory,
            eq(transaction.id, transactionCategory.transactionId),
         )
         .innerJoin(category, eq(transactionCategory.categoryId, category.id))
         .where(and(...baseConditions))
         .groupBy(category.id, category.name, category.color);

      // Build category comparisons
      const categoryComparisons: BudgetVsActualSnapshotData["categoryComparisons"] =
         [];
      const seenCategories = new Set<string>();

      for (const actual of actualByCategory) {
         seenCategories.add(actual.categoryId);
         const budgetData = budgetByCategory.get(actual.categoryId);
         const budgeted = budgetData?.budgeted || 0;
         const catVariance = budgeted - actual.amount;
         categoryComparisons.push({
            actual: actual.amount,
            budgeted,
            categoryColor: actual.categoryColor || "#8884d8",
            categoryId: actual.categoryId,
            categoryName: actual.categoryName,
            variance: catVariance,
            variancePercent: budgeted > 0 ? (catVariance / budgeted) * 100 : 0,
         });
      }

      // Add categories that have budget but no actual spending
      // Collect all unseen category IDs to fetch in a single query (avoid N+1)
      const unseenCatIds = [...budgetByCategory.keys()].filter(
         (id) => !seenCategories.has(id),
      );

      if (unseenCatIds.length > 0) {
         const unseenCategories = await dbClient.query.category.findMany({
            where: (c, { inArray: inArrayOp }) => inArrayOp(c.id, unseenCatIds),
         });

         const categoryMap = new Map(unseenCategories.map((c) => [c.id, c]));

         for (const catId of unseenCatIds) {
            const cat = categoryMap.get(catId);
            const data = budgetByCategory.get(catId);
            if (cat && data) {
               categoryComparisons.push({
                  actual: 0,
                  budgeted: data.budgeted,
                  categoryColor: cat.color || "#8884d8",
                  categoryId: catId,
                  categoryName: cat.name,
                  variance: data.budgeted,
                  variancePercent: 100,
               });
            }
         }
      }

      // Monthly breakdown with prorated budget calculation
      const monthlyBreakdown: BudgetVsActualSnapshotData["monthlyBreakdown"] =
         [];

      // Helper function to calculate overlap days between a period and a month
      // Returns the number of days the budget period intersects the month (inclusive)
      const getOverlapDays = (
         periodStart: Date,
         periodEnd: Date,
         monthStart: Date,
         monthEnd: Date,
      ): number => {
         const overlapStart = new Date(
            Math.max(periodStart.getTime(), monthStart.getTime()),
         );
         const overlapEnd = new Date(
            Math.min(periodEnd.getTime(), monthEnd.getTime()),
         );

         if (overlapStart > overlapEnd) {
            return 0;
         }

         // Calculate days difference (+1 because both start and end are inclusive)
         const diffMs = overlapEnd.getTime() - overlapStart.getTime();
         return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      };

      // Helper function to get total days in a budget period
      const getTotalDaysInPeriod = (
         periodStart: Date,
         periodEnd: Date,
      ): number => {
         const diffMs = periodEnd.getTime() - periodStart.getTime();
         return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      };

      // Build a map of prorated budgets per month
      // Key format: "YYYY-MM" for consistent lookup
      const proratedBudgetByMonth = new Map<string, number>();

      // Collect all budget periods for prorated calculation
      const allBudgetPeriods: Array<{
         periodStart: Date;
         periodEnd: Date;
         totalAmount: number;
      }> = [];

      for (const b of budgets) {
         for (const period of b.periods) {
            allBudgetPeriods.push({
               periodEnd: new Date(period.periodEnd),
               periodStart: new Date(period.periodStart),
               totalAmount: Number(period.totalAmount),
            });
         }
      }

      // Build list of all months in the report range
      const reportMonths: Array<{
         monthKey: string;
         monthStart: Date;
         monthEnd: Date;
      }> = [];

      const currentMonth = new Date(
         Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1),
      );
      const endDateNormalized = new Date(
         Date.UTC(endDate.getFullYear(), endDate.getMonth() + 1, 0, 23, 59, 59),
      );

      while (currentMonth <= endDateNormalized) {
         const year = currentMonth.getUTCFullYear();
         const month = currentMonth.getUTCMonth();

         // Month start: first day of the month at 00:00:00 UTC
         const monthStart = new Date(Date.UTC(year, month, 1));
         // Month end: last day of the month at 23:59:59 UTC
         const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

         const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
         reportMonths.push({ monthEnd, monthKey, monthStart });

         // Move to next month
         currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
      }

      // Calculate prorated budget for each month
      for (const { monthEnd, monthKey, monthStart } of reportMonths) {
         let monthBudgeted = 0;

         for (const period of allBudgetPeriods) {
            const totalDaysInPeriod = getTotalDaysInPeriod(
               period.periodStart,
               period.periodEnd,
            );

            // Handle edge case of zero-length periods
            if (totalDaysInPeriod <= 0) {
               continue;
            }

            const overlapDays = getOverlapDays(
               period.periodStart,
               period.periodEnd,
               monthStart,
               monthEnd,
            );

            if (overlapDays > 0) {
               // Prorate: (budgetPeriod.amount * overlapDays) / totalDaysInBudgetPeriod
               monthBudgeted +=
                  (period.totalAmount * overlapDays) / totalDaysInPeriod;
            }
         }

         proratedBudgetByMonth.set(monthKey, monthBudgeted);
      }

      const monthlyActual = await dbClient
         .select({
            amount: sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`,
            month: sql<string>`TO_CHAR(${transaction.date}, 'MM')`,
            year: sql<number>`EXTRACT(YEAR FROM ${transaction.date})`,
         })
         .from(transaction)
         .where(and(...baseConditions))
         .groupBy(
            sql`TO_CHAR(${transaction.date}, 'MM')`,
            sql`EXTRACT(YEAR FROM ${transaction.date})`,
         )
         .orderBy(
            sql`EXTRACT(YEAR FROM ${transaction.date})`,
            sql`TO_CHAR(${transaction.date}, 'MM')`,
         );

      // Build a map of actual amounts keyed by month for quick lookup
      const actualByMonth = new Map<string, number>();
      for (const m of monthlyActual) {
         const monthKey = `${m.year}-${m.month}`;
         actualByMonth.set(monthKey, m.amount);
      }

      // Iterate over all months in the report range to include months with budget but no actuals
      for (const { monthKey } of reportMonths) {
         const parts = monthKey.split("-");
         const year = Number(parts[0]);
         const month = parts[1] as string;
         const actual = actualByMonth.get(monthKey) ?? 0;
         const budgeted = proratedBudgetByMonth.get(monthKey) ?? 0;

         monthlyBreakdown.push({
            actual,
            budgeted,
            month,
            variance: budgeted - actual,
            year,
         });
      }

      return {
         categoryComparisons,
         filterMetadata,
         generatedAt: new Date().toISOString(),
         monthlyBreakdown,
         summary: {
            totalActual,
            totalBudgeted,
            variance,
            variancePercent,
         },
         type: "budget_vs_actual",
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to generate Budget vs Actual data: ${(err as Error).message}`,
      );
   }
}

export async function generateSpendingTrendsData(
   dbClient: DatabaseInstance,
   organizationId: string,
   startDate: Date,
   endDate: Date,
   filterConfig?: ReportFilterConfig,
): Promise<SpendingTrendsSnapshotData> {
   try {
      const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);

      const baseConditions = [
         eq(transaction.organizationId, organizationId),
         gte(transaction.date, startDate),
         lte(transaction.date, endDate),
      ];

      if (filterConfig?.bankAccountIds?.length) {
         baseConditions.push(
            inArray(transaction.bankAccountId, filterConfig.bankAccountIds),
         );
      }
      if (filterConfig?.costCenterIds?.length) {
         baseConditions.push(
            inArray(transaction.costCenterId, filterConfig.costCenterIds),
         );
      }

      // Monthly data aggregation
      const monthlyData = await dbClient
         .select({
            expenses: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN CAST(${transaction.amount} AS REAL) ELSE 0 END), 0)`,
            income: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN CAST(${transaction.amount} AS REAL) ELSE 0 END), 0)`,
            month: sql<string>`TO_CHAR(${transaction.date}, 'MM')`,
            year: sql<number>`EXTRACT(YEAR FROM ${transaction.date})`,
         })
         .from(transaction)
         .where(and(...baseConditions))
         .groupBy(
            sql`TO_CHAR(${transaction.date}, 'MM')`,
            sql`EXTRACT(YEAR FROM ${transaction.date})`,
         )
         .orderBy(
            sql`EXTRACT(YEAR FROM ${transaction.date})`,
            sql`TO_CHAR(${transaction.date}, 'MM')`,
         );

      const monthlyDataFormatted: SpendingTrendsSnapshotData["monthlyData"] =
         monthlyData.map((m) => ({
            expenses: m.expenses,
            income: m.income,
            month: m.month,
            net: m.income - m.expenses,
            year: m.year,
         }));

      // Calculate averages and find extremes
      const totalMonths = monthlyDataFormatted.length || 1;
      const totalExpenses = monthlyDataFormatted.reduce(
         (sum, m) => sum + m.expenses,
         0,
      );
      const totalIncome = monthlyDataFormatted.reduce(
         (sum, m) => sum + m.income,
         0,
      );
      const avgMonthlySpending = totalExpenses / totalMonths;
      const avgMonthlyIncome = totalIncome / totalMonths;

      // Find highest and lowest expense months
      let highestExpenseMonth = {
         amount: monthlyDataFormatted[0]?.expenses ?? 0,
         month: monthlyDataFormatted[0]?.month ?? "01",
         year: monthlyDataFormatted[0]?.year ?? new Date().getFullYear(),
      };
      let lowestExpenseMonth = {
         amount: monthlyDataFormatted[0]?.expenses ?? Number.POSITIVE_INFINITY,
         month: monthlyDataFormatted[0]?.month ?? "01",
         year: monthlyDataFormatted[0]?.year ?? new Date().getFullYear(),
      };

      for (const m of monthlyDataFormatted) {
         if (m.expenses > highestExpenseMonth.amount) {
            highestExpenseMonth = {
               amount: m.expenses,
               month: m.month,
               year: m.year,
            };
         }
         if (m.expenses < lowestExpenseMonth.amount) {
            lowestExpenseMonth = {
               amount: m.expenses,
               month: m.month,
               year: m.year,
            };
         }
      }

      // Handle edge case where there's no data
      if (lowestExpenseMonth.amount === Number.POSITIVE_INFINITY) {
         lowestExpenseMonth.amount = 0;
      }

      // Calculate trend (comparing first half to second half)
      const midPoint = Math.floor(monthlyDataFormatted.length / 2);
      const firstHalfExpenses = monthlyDataFormatted
         .slice(0, midPoint)
         .reduce((sum, m) => sum + m.expenses, 0);
      const secondHalfExpenses = monthlyDataFormatted
         .slice(midPoint)
         .reduce((sum, m) => sum + m.expenses, 0);

      let trend: "increasing" | "decreasing" | "stable" = "stable";
      let trendPercent = 0;

      if (firstHalfExpenses > 0) {
         trendPercent =
            ((secondHalfExpenses - firstHalfExpenses) / firstHalfExpenses) *
            100;
         if (trendPercent > 5) trend = "increasing";
         else if (trendPercent < -5) trend = "decreasing";
      }

      // Category trends
      const categoryTrendsRaw = await dbClient
         .select({
            amount: sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`,
            categoryColor: category.color,
            categoryId: category.id,
            categoryName: category.name,
            month: sql<string>`TO_CHAR(${transaction.date}, 'MM')`,
            year: sql<number>`EXTRACT(YEAR FROM ${transaction.date})`,
         })
         .from(transaction)
         .innerJoin(
            transactionCategory,
            eq(transaction.id, transactionCategory.transactionId),
         )
         .innerJoin(category, eq(transactionCategory.categoryId, category.id))
         .where(and(...baseConditions, eq(transaction.type, "expense")))
         .groupBy(
            category.id,
            category.name,
            category.color,
            sql`TO_CHAR(${transaction.date}, 'MM')`,
            sql`EXTRACT(YEAR FROM ${transaction.date})`,
         );

      // Group by category
      const categoryMap = new Map<
         string,
         {
            categoryColor: string;
            categoryName: string;
            monthlyAmounts: Array<{
               month: string;
               year: number;
               amount: number;
            }>;
            totalAmount: number;
         }
      >();

      for (const row of categoryTrendsRaw) {
         const existing = categoryMap.get(row.categoryId) || {
            categoryColor: row.categoryColor || "#8884d8",
            categoryName: row.categoryName,
            monthlyAmounts: [],
            totalAmount: 0,
         };
         existing.monthlyAmounts.push({
            amount: row.amount,
            month: row.month,
            year: row.year,
         });
         existing.totalAmount += row.amount;
         categoryMap.set(row.categoryId, existing);
      }

      const categoryTrends: SpendingTrendsSnapshotData["categoryTrends"] =
         Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
            categoryColor: data.categoryColor,
            categoryId,
            categoryName: data.categoryName,
            monthlyAmounts: data.monthlyAmounts,
            totalAmount: data.totalAmount,
         }));

      // YoY comparison (if we have data from previous year)
      const previousYearStart = new Date(startDate);
      previousYearStart.setFullYear(previousYearStart.getFullYear() - 1);
      const previousYearEnd = new Date(endDate);
      previousYearEnd.setFullYear(previousYearEnd.getFullYear() - 1);

      const prevYearResult = await dbClient
         .select({
            total: sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`,
         })
         .from(transaction)
         .where(
            and(
               eq(transaction.organizationId, organizationId),
               eq(transaction.type, "expense"),
               gte(transaction.date, previousYearStart),
               lte(transaction.date, previousYearEnd),
            ),
         );

      const previousYearTotal = prevYearResult[0]?.total || 0;
      let yoyComparison: SpendingTrendsSnapshotData["yoyComparison"];

      if (previousYearTotal > 0) {
         const change = totalExpenses - previousYearTotal;
         yoyComparison = {
            change,
            changePercent: (change / previousYearTotal) * 100,
            currentYearTotal: totalExpenses,
            previousYearTotal,
         };
      }

      return {
         categoryTrends,
         filterMetadata,
         generatedAt: new Date().toISOString(),
         monthlyData: monthlyDataFormatted,
         summary: {
            avgMonthlyIncome,
            avgMonthlySpending,
            highestExpenseMonth: {
               amount: highestExpenseMonth.amount || 0,
               month: highestExpenseMonth.month,
               year: highestExpenseMonth.year,
            },
            lowestExpenseMonth: {
               amount: lowestExpenseMonth.amount || 0,
               month: lowestExpenseMonth.month,
               year: lowestExpenseMonth.year,
            },
            trend,
            trendPercent,
         },
         type: "spending_trends",
         yoyComparison,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to generate Spending Trends data: ${(err as Error).message}`,
      );
   }
}

export async function generateCashFlowForecastData(
   dbClient: DatabaseInstance,
   organizationId: string,
   startDate: Date,
   forecastDays: number,
   filterConfig?: ReportFilterConfig,
): Promise<CashFlowForecastSnapshotData> {
   try {
      const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + forecastDays);

      // Calculate current balance from transactions
      // Since bank accounts don't store balance, we calculate from transaction history
      const baseTransactionConditions = [
         eq(transaction.organizationId, organizationId),
         lte(transaction.date, startDate),
      ];

      if (filterConfig?.bankAccountIds?.length) {
         baseTransactionConditions.push(
            inArray(transaction.bankAccountId, filterConfig.bankAccountIds),
         );
      }

      const balanceResult = await dbClient
         .select({
            total: sql<number>`COALESCE(
               SUM(CASE
                  WHEN ${transaction.type} = 'income' THEN CAST(${transaction.amount} AS REAL)
                  ELSE -CAST(${transaction.amount} AS REAL)
               END),
               0
            )`,
         })
         .from(transaction)
         .where(and(...baseTransactionConditions));

      const currentBalance = balanceResult[0]?.total || 0;

      // Get upcoming bills
      const billConditions = [
         eq(bill.organizationId, organizationId),
         gte(bill.dueDate, startDate),
         lte(bill.dueDate, endDate),
         sql`${bill.completionDate} IS NULL`,
      ];

      const upcomingBillsRaw = await dbClient
         .select({
            amount: bill.amount,
            counterpartyName: counterparty.name,
            description: bill.description,
            dueDate: bill.dueDate,
            id: bill.id,
            type: bill.type,
         })
         .from(bill)
         .leftJoin(counterparty, eq(bill.counterpartyId, counterparty.id))
         .where(and(...billConditions))
         .orderBy(bill.dueDate);

      const upcomingBills: CashFlowForecastSnapshotData["upcomingBills"] =
         upcomingBillsRaw.map((b) => ({
            amount: Number(b.amount),
            billId: b.id,
            counterpartyName: b.counterpartyName || undefined,
            description: b.description,
            dueDate: b.dueDate.toISOString(),
            type: b.type as "income" | "expense",
         }));

      // Calculate daily projections
      const dailyProjections: CashFlowForecastSnapshotData["dailyProjections"] =
         [];
      let runningBalance = currentBalance;

      // Group bills by date
      const billsByDate = new Map<
         string,
         { income: number; expense: number }
      >();

      for (const b of upcomingBills) {
         const dateKey = b.dueDate.split("T")[0] ?? "";
         if (!dateKey) continue;
         const existing = billsByDate.get(dateKey) || { expense: 0, income: 0 };
         if (b.type === "income") {
            existing.income += b.amount;
         } else {
            existing.expense += b.amount;
         }
         billsByDate.set(dateKey, existing);
      }

      // Generate daily projections
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
         const dateKey = currentDate.toISOString().split("T")[0] ?? "";
         const dayBills = billsByDate.get(dateKey) || { expense: 0, income: 0 };

         runningBalance = runningBalance + dayBills.income - dayBills.expense;

         dailyProjections.push({
            balance: runningBalance,
            date: currentDate.toISOString(),
            projectedExpenses: dayBills.expense,
            projectedIncome: dayBills.income,
         });

         currentDate.setDate(currentDate.getDate() + 1);
      }

      // Get recurring patterns from bills
      const recurringBills = await dbClient
         .select({
            amount: bill.amount,
            description: bill.description,
            recurrencePattern: bill.recurrencePattern,
            type: bill.type,
         })
         .from(bill)
         .where(
            and(
               eq(bill.organizationId, organizationId),
               eq(bill.isRecurring, true),
            ),
         )
         .limit(20);

      const recurringPatterns: CashFlowForecastSnapshotData["recurringPatterns"] =
         recurringBills.map((b) => ({
            amount: Number(b.amount),
            description: b.description,
            frequency: b.recurrencePattern || "monthly",
            type: b.type as "income" | "expense",
         }));

      // Calculate totals
      const totalProjectedIncome = upcomingBills
         .filter((b) => b.type === "income")
         .reduce((sum, b) => sum + b.amount, 0);
      const totalProjectedExpenses = upcomingBills
         .filter((b) => b.type === "expense")
         .reduce((sum, b) => sum + b.amount, 0);
      const projectedBalance =
         currentBalance + totalProjectedIncome - totalProjectedExpenses;

      return {
         dailyProjections,
         filterMetadata,
         generatedAt: new Date().toISOString(),
         recurringPatterns,
         summary: {
            currentBalance,
            projectedBalance,
            projectionDays: forecastDays,
            totalProjectedExpenses,
            totalProjectedIncome,
         },
         type: "cash_flow_forecast",
         upcomingBills,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to generate Cash Flow Forecast data: ${(err as Error).message}`,
      );
   }
}

export async function generateCounterpartyAnalysisData(
   dbClient: DatabaseInstance,
   organizationId: string,
   startDate: Date,
   endDate: Date,
   filterConfig?: ReportFilterConfig,
): Promise<CounterpartyAnalysisSnapshotData> {
   try {
      const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);

      // Get transactions with counterparty info via bills
      const billConditions = [
         eq(bill.organizationId, organizationId),
         gte(bill.dueDate, startDate),
         lte(bill.dueDate, endDate),
         sql`${bill.counterpartyId} IS NOT NULL`,
      ];

      const transactionsWithCounterparty = await dbClient
         .select({
            amount: bill.amount,
            completionDate: bill.completionDate,
            counterpartyId: counterparty.id,
            counterpartyName: counterparty.name,
            counterpartyType: counterparty.type,
            dueDate: bill.dueDate,
            type: bill.type,
         })
         .from(bill)
         .innerJoin(counterparty, eq(bill.counterpartyId, counterparty.id))
         .where(and(...billConditions));

      // Aggregate by counterparty
      const counterpartyStats = new Map<
         string,
         {
            counterpartyName: string;
            counterpartyType: string;
            lastTransactionDate: Date;
            totalAmount: number;
            transactionCount: number;
         }
      >();

      let totalReceived = 0;
      let totalPaid = 0;

      for (const tx of transactionsWithCounterparty) {
         const existing = counterpartyStats.get(tx.counterpartyId) || {
            counterpartyName: tx.counterpartyName,
            counterpartyType: tx.counterpartyType,
            lastTransactionDate: tx.dueDate,
            totalAmount: 0,
            transactionCount: 0,
         };

         const amount = Number(tx.amount);
         existing.totalAmount += amount;
         existing.transactionCount += 1;

         if (tx.dueDate > existing.lastTransactionDate) {
            existing.lastTransactionDate = tx.dueDate;
         }

         if (tx.type === "income") {
            totalReceived += amount;
         } else {
            totalPaid += amount;
         }

         counterpartyStats.set(tx.counterpartyId, existing);
      }

      // Separate into customers and suppliers
      const customers: CounterpartyAnalysisSnapshotData["customers"] = [];
      const suppliers: CounterpartyAnalysisSnapshotData["suppliers"] = [];

      for (const [counterpartyId, stats] of counterpartyStats.entries()) {
         const baseEntry = {
            counterpartyId,
            counterpartyName: stats.counterpartyName,
            lastTransactionDate: stats.lastTransactionDate.toISOString(),
            totalAmount: stats.totalAmount,
            transactionCount: stats.transactionCount,
         };

         if (
            stats.counterpartyType === "client" ||
            stats.counterpartyType === "both"
         ) {
            customers.push({
               ...baseEntry,
               percentOfTotal:
                  totalReceived > 0
                     ? (stats.totalAmount / totalReceived) * 100
                     : 0,
            });
         }
         if (
            stats.counterpartyType === "supplier" ||
            stats.counterpartyType === "both"
         ) {
            suppliers.push({
               ...baseEntry,
               percentOfTotal:
                  totalPaid > 0 ? (stats.totalAmount / totalPaid) * 100 : 0,
            });
         }
      }

      // Sort by total amount
      customers.sort((a, b) => b.totalAmount - a.totalAmount);
      suppliers.sort((a, b) => b.totalAmount - a.totalAmount);

      // Find top customer and supplier
      const topCustomer = customers[0]
         ? {
              id: customers[0].counterpartyId,
              name: customers[0].counterpartyName,
              totalAmount: customers[0].totalAmount,
              transactionCount: customers[0].transactionCount,
           }
         : undefined;

      const topSupplier = suppliers[0]
         ? {
              id: suppliers[0].counterpartyId,
              name: suppliers[0].counterpartyName,
              totalAmount: suppliers[0].totalAmount,
              transactionCount: suppliers[0].transactionCount,
           }
         : undefined;

      // Count unique counterparties
      const allCounterparties = new Set<string>();
      const customerIds = new Set<string>();
      const supplierIds = new Set<string>();

      for (const c of customers) {
         allCounterparties.add(c.counterpartyId);
         customerIds.add(c.counterpartyId);
      }
      for (const s of suppliers) {
         allCounterparties.add(s.counterpartyId);
         supplierIds.add(s.counterpartyId);
      }

      return {
         customers,
         filterMetadata,
         generatedAt: new Date().toISOString(),
         summary: {
            netBalance: totalReceived - totalPaid,
            totalCounterparties: allCounterparties.size,
            totalCustomers: customerIds.size,
            totalPaid,
            totalReceived,
            totalSuppliers: supplierIds.size,
         },
         suppliers,
         topCustomer,
         topSupplier,
         type: "counterparty_analysis",
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to generate Counterparty Analysis data: ${(err as Error).message}`,
      );
   }
}

export async function generateCategoryAnalysisData(
   dbClient: DatabaseInstance,
   organizationId: string,
   startDate: Date,
   endDate: Date,
   filterConfig?: ReportFilterConfig,
): Promise<CategoryAnalysisSnapshotData> {
   try {
      const filterMetadata = await buildFilterMetadata(dbClient, filterConfig);

      // Handle category and tag filters via join tables
      const hasCategoryFilter =
         filterConfig?.categoryIds && filterConfig.categoryIds.length > 0;
      const hasTagFilter =
         filterConfig?.tagIds && filterConfig.tagIds.length > 0;

      let transactionIdsFromCategoryFilter: string[] | null = null;
      if (hasCategoryFilter && filterConfig.categoryIds) {
         const categoryTransactions = await dbClient
            .select({ transactionId: transactionCategory.transactionId })
            .from(transactionCategory)
            .where(
               inArray(transactionCategory.categoryId, filterConfig.categoryIds),
            );
         transactionIdsFromCategoryFilter = categoryTransactions.map(
            (t) => t.transactionId,
         );
      }

      let transactionIdsFromTagFilter: string[] | null = null;
      if (hasTagFilter && filterConfig.tagIds) {
         const tagTransactions = await dbClient
            .select({ transactionId: transactionTag.transactionId })
            .from(transactionTag)
            .where(inArray(transactionTag.tagId, filterConfig.tagIds));
         transactionIdsFromTagFilter = tagTransactions.map(
            (t) => t.transactionId,
         );
      }

      // Build base conditions
      const baseConditions = [
         eq(transaction.organizationId, organizationId),
         gte(transaction.date, startDate),
         lte(transaction.date, endDate),
      ];

      if (filterConfig?.bankAccountIds?.length) {
         baseConditions.push(
            inArray(transaction.bankAccountId, filterConfig.bankAccountIds),
         );
      }
      if (filterConfig?.costCenterIds?.length) {
         baseConditions.push(
            inArray(transaction.costCenterId, filterConfig.costCenterIds),
         );
      }

      if (transactionIdsFromCategoryFilter !== null) {
         if (transactionIdsFromCategoryFilter.length === 0) {
            // No transactions match category filter
            return {
               expenseBreakdown: [],
               filterMetadata,
               generatedAt: new Date().toISOString(),
               incomeBreakdown: [],
               summary: {
                  expenseCategories: 0,
                  incomeCategories: 0,
                  totalExpenses: 0,
                  totalIncome: 0,
                  totalTransactions: 0,
               },
               type: "category_analysis",
            };
         }
         baseConditions.push(
            inArray(transaction.id, transactionIdsFromCategoryFilter),
         );
      }

      if (transactionIdsFromTagFilter !== null) {
         if (transactionIdsFromTagFilter.length === 0) {
            return {
               expenseBreakdown: [],
               filterMetadata,
               generatedAt: new Date().toISOString(),
               incomeBreakdown: [],
               summary: {
                  expenseCategories: 0,
                  incomeCategories: 0,
                  totalExpenses: 0,
                  totalIncome: 0,
                  totalTransactions: 0,
               },
               type: "category_analysis",
            };
         }
         baseConditions.push(
            inArray(transaction.id, transactionIdsFromTagFilter),
         );
      }

      const whereClause = and(...baseConditions);

      // Get totals for income and expenses
      const summaryResult = await dbClient
         .select({
            totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN CAST(${transaction.amount} AS REAL) ELSE 0 END), 0)`,
            totalIncome: sql<number>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN CAST(${transaction.amount} AS REAL) ELSE 0 END), 0)`,
            totalTransactions: sql<number>`COUNT(*)`,
         })
         .from(transaction)
         .where(whereClause);

      const totalIncome = summaryResult[0]?.totalIncome || 0;
      const totalExpenses = summaryResult[0]?.totalExpenses || 0;
      const totalTransactions = summaryResult[0]?.totalTransactions || 0;

      // Build conditions for income breakdown
      const incomeConditions = [...baseConditions, eq(transaction.type, "income")];
      const incomeWhereClause = and(...incomeConditions);

      // Get income breakdown by category
      const incomeByCategory = await dbClient
         .select({
            amount: sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`,
            categoryColor: category.color,
            categoryIcon: category.icon,
            categoryId: category.id,
            categoryName: category.name,
            transactionCount: sql<number>`COUNT(*)`,
         })
         .from(transaction)
         .innerJoin(
            transactionCategory,
            eq(transaction.id, transactionCategory.transactionId),
         )
         .innerJoin(category, eq(transactionCategory.categoryId, category.id))
         .where(incomeWhereClause)
         .groupBy(category.id, category.name, category.color, category.icon);

      // Build conditions for expense breakdown
      const expenseConditions = [
         ...baseConditions,
         eq(transaction.type, "expense"),
      ];
      const expenseWhereClause = and(...expenseConditions);

      // Get expense breakdown by category
      const expenseByCategory = await dbClient
         .select({
            amount: sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`,
            categoryColor: category.color,
            categoryIcon: category.icon,
            categoryId: category.id,
            categoryName: category.name,
            transactionCount: sql<number>`COUNT(*)`,
         })
         .from(transaction)
         .innerJoin(
            transactionCategory,
            eq(transaction.id, transactionCategory.transactionId),
         )
         .innerJoin(category, eq(transactionCategory.categoryId, category.id))
         .where(expenseWhereClause)
         .groupBy(category.id, category.name, category.color, category.icon);

      // Calculate percentages and sort by amount
      const incomeBreakdown = incomeByCategory
         .map((cat) => ({
            amount: cat.amount,
            categoryColor: cat.categoryColor || "#10b981",
            categoryIcon: cat.categoryIcon,
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            percentage: totalIncome > 0 ? (cat.amount / totalIncome) * 100 : 0,
            transactionCount: cat.transactionCount,
         }))
         .sort((a, b) => b.amount - a.amount);

      const expenseBreakdown = expenseByCategory
         .map((cat) => ({
            amount: cat.amount,
            categoryColor: cat.categoryColor || "#ef4444",
            categoryIcon: cat.categoryIcon,
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            percentage:
               totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0,
            transactionCount: cat.transactionCount,
         }))
         .sort((a, b) => b.amount - a.amount);

      return {
         expenseBreakdown,
         filterMetadata,
         generatedAt: new Date().toISOString(),
         incomeBreakdown,
         summary: {
            expenseCategories: expenseBreakdown.length,
            incomeCategories: incomeBreakdown.length,
            totalExpenses,
            totalIncome,
            totalTransactions,
         },
         type: "category_analysis",
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to generate Category Analysis data: ${(err as Error).message}`,
      );
   }
}
