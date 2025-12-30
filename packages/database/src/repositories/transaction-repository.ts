import { createSearchTokens } from "@packages/encryption/search-index";
import {
   decryptTransactionFields,
   encryptTransactionFields,
} from "@packages/encryption/service";
import { AppError, propagateError } from "@packages/utils/errors";
import type { SQL } from "drizzle-orm";
import {
   and,
   eq,
   exists,
   gte,
   ilike,
   inArray,
   lte,
   or,
   sql,
} from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { category, transactionCategory } from "../schemas/categories";
import { transactionTag } from "../schemas/tags";
import { type CategorySplit, transaction } from "../schemas/transactions";
import { transferLog } from "../schemas/transfers";
import { setTransactionCategories } from "./category-repository";

type TransactionFields = typeof transaction.$inferSelect;
type TransactionColumns = {
   [K in keyof TransactionFields]: (typeof transaction)[K];
};
type DrizzleOperators = {
   eq: typeof eq;
   and: (...conditions: (SQL | undefined)[]) => SQL | undefined;
   ilike: typeof ilike;
};

export type Transaction = typeof transaction.$inferSelect;
export type NewTransaction = typeof transaction.$inferInsert;
export type { CategorySplit };

/**
 * Builds a SQL condition for searching transactions using blind index HMAC tokens.
 * Returns undefined if SEARCH_KEY is not configured or search string produces no tokens.
 */
function buildSearchIndexCondition(
   search: string,
   searchIndexColumn: typeof transaction.searchIndex,
): SQL | undefined {
   const searchKey = process.env.SEARCH_KEY;
   if (!searchKey) {
      return undefined;
   }

   const tokens = createSearchTokens(search, searchKey);
   if (tokens.length === 0) {
      return undefined;
   }

   const tokenConditions = tokens.map((token) =>
      ilike(searchIndexColumn, `%${token}%`),
   );
   return or(...tokenConditions);
}

export async function createTransaction(
   dbClient: DatabaseInstance,
   data: NewTransaction,
) {
   try {
      // Encrypt sensitive fields before storing
      const encryptedData = encryptTransactionFields(data);

      const result = await dbClient
         .insert(transaction)
         .values(encryptedData)
         .returning();

      if (!result[0]) {
         throw AppError.database("Failed to create transaction");
      }

      const createdId = result[0].id;

      const createdTransaction = await dbClient.query.transaction.findFirst({
         where: (transaction, { eq }) => eq(transaction.id, createdId),
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

      if (!createdTransaction) {
         throw AppError.database("Failed to fetch created transaction");
      }

      // Decrypt sensitive fields before returning
      return decryptTransactionFields(createdTransaction);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create transaction: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionById(
   dbClient: DatabaseInstance,
   transactionId: string,
) {
   try {
      const result = await dbClient.query.transaction.findFirst({
         where: (transaction, { eq }) => eq(transaction.id, transactionId),
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
      // Decrypt sensitive fields before returning
      return result ? decryptTransactionFields(result) : result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transaction by id: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.query.transaction.findMany({
         orderBy: (transaction, { desc }) => desc(transaction.date),
         where: (transaction, { eq }) =>
            eq(transaction.organizationId, organizationId),
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
      // Decrypt sensitive fields before returning
      return result.map(decryptTransactionFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transactions by organization id: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionsByOrganizationIdPaginated(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: {
      page?: number;
      limit?: number;
      type?: "income" | "expense" | "transfer";
      bankAccountId?: string;
      categoryId?: string;
      categoryIds?: string[];
      tagId?: string;
      costCenterId?: string;
      search?: string;
      orderBy?: "date" | "amount";
      orderDirection?: "asc" | "desc";
      startDate?: Date;
      endDate?: Date;
   } = {},
) {
   const {
      page = 1,
      limit = 10,
      type,
      bankAccountId,
      categoryId,
      categoryIds,
      tagId,
      costCenterId,
      search,
      orderBy = "date",
      orderDirection = "desc",
      startDate,
      endDate,
   } = options;

   const offset = (page - 1) * limit;

   try {
      const buildWhereCondition = (
         txn: TransactionColumns,
         { eq: eqOp, and: andOp, ilike: ilikeOp }: DrizzleOperators,
      ) => {
         const conditions: (SQL | undefined)[] = [
            eqOp(txn.organizationId, organizationId),
         ];

         if (bankAccountId && bankAccountId !== "all") {
            conditions.push(eqOp(txn.bankAccountId, bankAccountId));
         }

         if (type) {
            conditions.push(eqOp(txn.type, type));
         }

         if (search) {
            const searchCondition = buildSearchIndexCondition(
               search,
               transaction.searchIndex,
            );
            if (searchCondition) {
               conditions.push(searchCondition);
            }
         }

         if (startDate) {
            conditions.push(gte(txn.date, startDate));
         }

         if (endDate) {
            conditions.push(lte(txn.date, endDate));
         }

         if (categoryIds && categoryIds.length > 0) {
            conditions.push(
               exists(
                  dbClient
                     .select({ one: sql`1` })
                     .from(transactionCategory)
                     .where(
                        and(
                           eq(transactionCategory.transactionId, txn.id),
                           inArray(transactionCategory.categoryId, categoryIds),
                        ),
                     ),
               ),
            );
         } else if (categoryId) {
            conditions.push(
               exists(
                  dbClient
                     .select({ one: sql`1` })
                     .from(transactionCategory)
                     .where(
                        and(
                           eq(transactionCategory.transactionId, txn.id),
                           eq(transactionCategory.categoryId, categoryId),
                        ),
                     ),
               ),
            );
         }

         if (costCenterId) {
            conditions.push(eqOp(txn.costCenterId, costCenterId));
         }

         if (tagId) {
            conditions.push(
               exists(
                  dbClient
                     .select({ one: sql`1` })
                     .from(transactionTag)
                     .where(
                        and(
                           eq(transactionTag.transactionId, txn.id),
                           eq(transactionTag.tagId, tagId),
                        ),
                     ),
               ),
            );
         }

         return andOp(...conditions);
      };

      const [transactions, totalCount] = await Promise.all([
         dbClient.query.transaction.findMany({
            limit,
            offset,
            orderBy: (transaction, { asc, desc }) => {
               const column = transaction[orderBy as keyof typeof transaction];
               return orderDirection === "asc" ? asc(column) : desc(column);
            },
            where: buildWhereCondition,
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
         }),
         dbClient.query.transaction
            .findMany({
               where: buildWhereCondition,
            })
            .then((result) => result.length),
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
         // Decrypt sensitive fields before returning
         transactions: transactions.map(decryptTransactionFields),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transactions by organization id paginated: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionsByBankAccountId(
   dbClient: DatabaseInstance,
   bankAccountId: string,
) {
   try {
      const result = await dbClient.query.transaction.findMany({
         orderBy: (transaction, { desc }) => desc(transaction.date),
         where: (transaction, { eq }) =>
            eq(transaction.bankAccountId, bankAccountId),
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
      // Decrypt sensitive fields before returning
      return result.map(decryptTransactionFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transactions by bank account id: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionsForExport(
   dbClient: DatabaseInstance,
   bankAccountId: string,
   options: {
      startDate?: Date;
      endDate?: Date;
      type?: "income" | "expense" | "transfer";
   } = {},
) {
   const { startDate, endDate, type } = options;

   try {
      const baseConditions = [eq(transaction.bankAccountId, bankAccountId)];

      if (startDate) {
         baseConditions.push(gte(transaction.date, startDate));
      }

      if (endDate) {
         baseConditions.push(lte(transaction.date, endDate));
      }

      if (type) {
         baseConditions.push(eq(transaction.type, type));
      }

      const whereClause = and(...baseConditions);

      const transactions = await dbClient.query.transaction.findMany({
         orderBy: (txn, { desc }) => desc(txn.date),
         where: whereClause,
      });

      // Decrypt sensitive fields before returning
      return transactions.map(decryptTransactionFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transactions for export: ${(err as Error).message}`,
      );
   }
}

export async function findTransactionsByBankAccountIdPaginated(
   dbClient: DatabaseInstance,
   bankAccountId: string,
   options: {
      page?: number;
      limit?: number;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      categoryId?: string;
      type?: "income" | "expense" | "transfer";
   } = {},
) {
   const {
      page = 1,
      limit: pageLimit = 10,
      search,
      startDate,
      endDate,
      categoryId,
      type,
   } = options;
   const offset = (page - 1) * pageLimit;

   try {
      const baseConditions = [eq(transaction.bankAccountId, bankAccountId)];

      if (search) {
         const searchCondition = buildSearchIndexCondition(
            search,
            transaction.searchIndex,
         );
         if (searchCondition) {
            baseConditions.push(searchCondition);
         }
      }

      if (startDate) {
         baseConditions.push(gte(transaction.date, startDate));
      }

      if (endDate) {
         baseConditions.push(lte(transaction.date, endDate));
      }

      if (type) {
         baseConditions.push(eq(transaction.type, type));
      }

      if (categoryId) {
         baseConditions.push(
            exists(
               dbClient
                  .select()
                  .from(transactionCategory)
                  .where(
                     and(
                        eq(transactionCategory.transactionId, transaction.id),
                        eq(transactionCategory.categoryId, categoryId),
                     ),
                  ),
            ),
         );
      }

      const whereClause = and(...baseConditions);

      const [transactions, totalCount] = await Promise.all([
         dbClient.query.transaction.findMany({
            limit: pageLimit,
            offset,
            orderBy: (txn, { desc }) => desc(txn.date),
            where: whereClause,
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
         }),
         dbClient.query.transaction
            .findMany({
               where: whereClause,
            })
            .then((result) => result.length),
      ]);

      const totalPages = Math.ceil(totalCount / pageLimit);

      return {
         pagination: {
            currentPage: page,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            limit: pageLimit,
            totalCount,
            totalPages,
         },
         // Decrypt sensitive fields before returning
         transactions: transactions.map(decryptTransactionFields),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transactions by bank account id paginated: ${(err as Error).message}`,
      );
   }
}

export async function updateTransaction(
   dbClient: DatabaseInstance,
   transactionId: string,
   data: Partial<NewTransaction>,
) {
   try {
      // Encrypt sensitive fields before storing
      const encryptedData = encryptTransactionFields(data);

      const result = await dbClient
         .update(transaction)
         .set(encryptedData)
         .where(eq(transaction.id, transactionId))
         .returning();

      if (!result.length) {
         throw AppError.database("Transaction not found");
      }

      const updatedTransaction = await dbClient.query.transaction.findFirst({
         where: (transaction, { eq }) => eq(transaction.id, transactionId),
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

      if (!updatedTransaction) {
         throw AppError.database("Failed to fetch updated transaction");
      }

      // Decrypt sensitive fields before returning
      return decryptTransactionFields(updatedTransaction);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to update transaction: ${(err as Error).message}`,
      );
   }
}

export async function deleteTransaction(
   dbClient: DatabaseInstance,
   transactionId: string,
) {
   try {
      const result = await dbClient
         .delete(transaction)
         .where(eq(transaction.id, transactionId))
         .returning();

      if (!result.length) {
         throw AppError.database("Transaction not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete transaction: ${(err as Error).message}`,
      );
   }
}

export async function getTotalTransactionsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
   bankAccountId?: string,
   startDate?: Date,
   endDate?: Date,
) {
   try {
      const conditions = [eq(transaction.organizationId, organizationId)];

      if (bankAccountId && bankAccountId !== "all") {
         conditions.push(eq(transaction.bankAccountId, bankAccountId));
      }

      if (startDate) {
         conditions.push(gte(transaction.date, startDate));
      }

      if (endDate) {
         conditions.push(lte(transaction.date, endDate));
      }

      const result = await dbClient
         .select({ count: sql<number>`count(*)` })
         .from(transaction)
         .where(and(...conditions));

      return result[0]?.count || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total transactions count: ${(err as Error).message}`,
      );
   }
}

export async function getTotalIncomeByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
   bankAccountId?: string,
   startDate?: Date,
   endDate?: Date,
) {
   try {
      const conditions = [
         eq(transaction.organizationId, organizationId),
         eq(transaction.type, "income"),
      ];

      if (bankAccountId && bankAccountId !== "all") {
         conditions.push(eq(transaction.bankAccountId, bankAccountId));
      }

      if (startDate) {
         conditions.push(gte(transaction.date, startDate));
      }

      if (endDate) {
         conditions.push(lte(transaction.date, endDate));
      }

      const result = await dbClient
         .select({
            total: sql<number>`COALESCE(sum(CAST(${transaction.amount} AS REAL)), 0)`,
         })
         .from(transaction)
         .where(and(...conditions));

      return result[0]?.total || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total income: ${(err as Error).message}`,
      );
   }
}

export async function getTotalExpensesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
   bankAccountId?: string,
   startDate?: Date,
   endDate?: Date,
) {
   try {
      const conditions = [
         eq(transaction.organizationId, organizationId),
         eq(transaction.type, "expense"),
      ];

      if (startDate) {
         conditions.push(gte(transaction.date, startDate));
      }

      if (endDate) {
         conditions.push(lte(transaction.date, endDate));
      }

      if (bankAccountId && bankAccountId !== "all") {
         conditions.push(eq(transaction.bankAccountId, bankAccountId));
      }

      const result = await dbClient
         .select({
            total: sql<number>`COALESCE(sum(ABS(CAST(${transaction.amount} AS REAL))), 0)`,
         })
         .from(transaction)
         .where(and(...conditions));

      return result[0]?.total || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total expenses: ${(err as Error).message}`,
      );
   }
}

export async function getTotalTransfersByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
   bankAccountId?: string,
   startDate?: Date,
   endDate?: Date,
) {
   try {
      const conditions = [eq(transferLog.organizationId, organizationId)];

      if (startDate || endDate || bankAccountId) {
         const transactionConditions = [];

         if (startDate) {
            transactionConditions.push(gte(transaction.date, startDate));
         }

         if (endDate) {
            transactionConditions.push(lte(transaction.date, endDate));
         }

         if (bankAccountId && bankAccountId !== "all") {
            conditions.push(
               sql`(${transferLog.fromBankAccountId} = ${bankAccountId} OR ${transferLog.toBankAccountId} = ${bankAccountId})`,
            );
         }

         if (transactionConditions.length > 0) {
            const result = await dbClient
               .select({
                  total: sql<number>`COALESCE(sum(ABS(CAST(${transaction.amount} AS REAL))), 0)`,
               })
               .from(transferLog)
               .innerJoin(
                  transaction,
                  eq(transferLog.toTransactionId, transaction.id),
               )
               .where(and(...conditions, ...transactionConditions));

            return result[0]?.total || 0;
         }
      }

      const result = await dbClient
         .select({
            total: sql<number>`COALESCE(sum(ABS(CAST(${transaction.amount} AS REAL))), 0)`,
         })
         .from(transferLog)
         .innerJoin(
            transaction,
            eq(transferLog.toTransactionId, transaction.id),
         )
         .where(and(...conditions));

      return result[0]?.total || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total transfers: ${(err as Error).message}`,
      );
   }
}

export async function deleteTransactions(
   dbClient: DatabaseInstance,
   transactionIds: string[],
) {
   try {
      if (transactionIds.length === 0) {
         return [];
      }

      const result = await dbClient
         .delete(transaction)
         .where(inArray(transaction.id, transactionIds))
         .returning();

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete transactions: ${(err as Error).message}`,
      );
   }
}

export async function updateTransactionsCategory(
   dbClient: DatabaseInstance,
   transactionIds: string[],
   categoryId: string,
) {
   try {
      if (transactionIds.length === 0) {
         return [];
      }

      await dbClient
         .delete(transactionCategory)
         .where(inArray(transactionCategory.transactionId, transactionIds));

      const categoryInserts = transactionIds.map((transactionId) => ({
         categoryId,
         transactionId,
      }));

      await dbClient.insert(transactionCategory).values(categoryInserts);

      const updatedTransactions = await dbClient.query.transaction.findMany({
         where: (txn) => inArray(txn.id, transactionIds),
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

      // Decrypt sensitive fields before returning
      return updatedTransactions.map(decryptTransactionFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to update transactions category: ${(err as Error).message}`,
      );
   }
}

export async function findMatchingTransferTransaction(
   dbClient: DatabaseInstance,
   params: {
      bankAccountId: string;
      amount: number;
      date: Date;
      organizationId: string;
   },
): Promise<Transaction | null> {
   try {
      const dateStart = new Date(params.date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(params.date);
      dateEnd.setHours(23, 59, 59, 999);

      const result = await dbClient.query.transaction.findFirst({
         where: and(
            eq(transaction.bankAccountId, params.bankAccountId),
            eq(transaction.organizationId, params.organizationId),
            eq(transaction.amount, params.amount.toString()),
            gte(transaction.date, dateStart),
            lte(transaction.date, dateEnd),
            sql`${transaction.type} != 'transfer'`,
         ),
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
      // Decrypt sensitive fields before returning
      return result ? decryptTransactionFields(result) : null;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find matching transfer transaction: ${(err as Error).message}`,
      );
   }
}

export type TransferCandidate = {
   transaction: Transaction;
   score: number;
   matchReason: string;
};

export async function findTransferCandidates(
   dbClient: DatabaseInstance,
   params: {
      bankAccountId: string;
      amount: number;
      date: Date;
      description: string;
      organizationId: string;
   },
): Promise<TransferCandidate[]> {
   try {
      const dateStart = new Date(params.date);
      dateStart.setDate(dateStart.getDate() - 7);
      const dateEnd = new Date(params.date);
      dateEnd.setDate(dateEnd.getDate() + 7);

      const candidates = await dbClient.query.transaction.findMany({
         where: and(
            eq(transaction.bankAccountId, params.bankAccountId),
            eq(transaction.organizationId, params.organizationId),
            eq(transaction.amount, params.amount.toString()),
            gte(transaction.date, dateStart),
            lte(transaction.date, dateEnd),
            sql`${transaction.type} != 'transfer'`,
         ),
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

      // Decrypt candidates before processing
      const decryptedCandidates = candidates.map(decryptTransactionFields);

      return decryptedCandidates
         .map((candidate) => {
            let score = 0;
            const reasons: string[] = [];

            const daysDiff = Math.abs(
               Math.floor(
                  (candidate.date.getTime() - params.date.getTime()) /
                     (1000 * 60 * 60 * 24),
               ),
            );
            if (daysDiff === 0) {
               score += 50;
               reasons.push("Mesma data");
            } else if (daysDiff === 1) {
               score += 40;
               reasons.push("1 dia de diferença");
            } else if (daysDiff <= 3) {
               score += 25;
               reasons.push(`${daysDiff} dias de diferença`);
            } else if (daysDiff <= 7) {
               score += 10;
               reasons.push(`${daysDiff} dias de diferença`);
            }

            const descLower = candidate.description.toLowerCase();
            const paramDescLower = params.description.toLowerCase();
            if (descLower === paramDescLower) {
               score += 50;
               reasons.push("Descrição idêntica");
            } else if (
               descLower.includes(paramDescLower) ||
               paramDescLower.includes(descLower)
            ) {
               score += 35;
               reasons.push("Descrição similar");
            } else {
               const candidateWords = new Set(descLower.split(/\s+/));
               const paramWords = paramDescLower.split(/\s+/);
               const commonWords = paramWords.filter(
                  (w) => w.length > 3 && candidateWords.has(w),
               );
               if (commonWords.length > 0) {
                  score += 20;
                  reasons.push("Palavras em comum");
               }
            }

            return {
               matchReason: reasons.join(", "),
               score,
               transaction: candidate,
            };
         })
         .filter((c) => c.score >= 50)
         .sort((a, b) => b.score - a.score);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find transfer candidates: ${(err as Error).message}`,
      );
   }
}

export async function createTransfer(
   dbClient: DatabaseInstance,
   data: {
      amount: number;
      date: Date;
      description: string;
      fromBankAccountId: string;
      toBankAccountId: string;
      organizationId: string;
      notes?: string;
   },
) {
   try {
      return await dbClient.transaction(async (tx) => {
         const transferCategory = await tx.query.category.findFirst({
            where: (cat, { eq, and }) =>
               and(
                  eq(cat.organizationId, data.organizationId),
                  eq(cat.name, "Transfer"),
               ),
         });

         const transferCategoryId = transferCategory?.id || crypto.randomUUID();

         if (!transferCategory) {
            await tx.insert(category).values({
               color: "#6b7280",
               icon: "ArrowLeftRight",
               id: transferCategoryId,
               name: "Transfer",
               organizationId: data.organizationId,
            });
         }

         const fromTransaction = await createTransaction(tx, {
            amount: (-data.amount).toString(),
            bankAccountId: data.fromBankAccountId,
            date: data.date,
            description: data.description,
            id: crypto.randomUUID(),
            organizationId: data.organizationId,
            type: "transfer",
         });

         await setTransactionCategories(tx, fromTransaction.id, [
            transferCategoryId,
         ]);

         const toTransaction = await createTransaction(tx, {
            amount: data.amount.toString(),
            bankAccountId: data.toBankAccountId,
            date: data.date,
            description: data.description,
            id: crypto.randomUUID(),
            organizationId: data.organizationId,
            type: "transfer",
         });

         await setTransactionCategories(tx, toTransaction.id, [
            transferCategoryId,
         ]);

         await tx.insert(transferLog).values({
            fromBankAccountId: data.fromBankAccountId,
            fromTransactionId: fromTransaction.id,
            id: crypto.randomUUID(),
            notes: data.notes || null,
            organizationId: data.organizationId,
            toBankAccountId: data.toBankAccountId,
            toTransactionId: toTransaction.id,
         });

         return [fromTransaction, toTransaction];
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create transfer: ${(err as Error).message}`,
      );
   }
}
