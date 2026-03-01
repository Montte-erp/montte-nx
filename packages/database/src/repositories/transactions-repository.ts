import { AppError, propagateError } from "@packages/utils/errors";
import {
   and,
   count,
   desc,
   eq,
   gte,
   ilike,
   inArray,
   lte,
   or,
} from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { type NewTransaction, transactions, transactionTags } from "../schema";

export interface ListTransactionsFilter {
   teamId: string;
   type?: "income" | "expense" | "transfer";
   bankAccountId?: string;
   categoryId?: string;
   tagId?: string;
   contactId?: string;
   dateFrom?: string;
   dateTo?: string;
   search?: string;
   page?: number;
   pageSize?: number;
}

export async function createTransaction(
   db: DatabaseInstance,
   data: NewTransaction,
   tagIds?: string[],
) {
   try {
      const [transaction] = await db
         .insert(transactions)
         .values(data)
         .returning();

      if (tagIds && tagIds.length > 0 && transaction) {
         await db.insert(transactionTags).values(
            tagIds.map((tagId) => ({
               transactionId: transaction.id,
               tagId,
            })),
         );
      }

      return transaction;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create transaction");
   }
}

export async function listTransactions(
   db: DatabaseInstance,
   filter: ListTransactionsFilter,
) {
   try {
      const page = filter.page ?? 1;
      const pageSize = filter.pageSize ?? 50;

      const conditions = [eq(transactions.teamId, filter.teamId)];

      if (filter.tagId) {
         const taggedIds = await db
            .select({ transactionId: transactionTags.transactionId })
            .from(transactionTags)
            .where(eq(transactionTags.tagId, filter.tagId));

         if (taggedIds.length === 0) return { data: [], total: 0 };

         conditions.push(
            inArray(
               transactions.id,
               taggedIds.map((r) => r.transactionId),
            ),
         );
      }

      if (filter.type) conditions.push(eq(transactions.type, filter.type));
      if (filter.bankAccountId)
         conditions.push(eq(transactions.bankAccountId, filter.bankAccountId));
      if (filter.categoryId)
         conditions.push(eq(transactions.categoryId, filter.categoryId));
      if (filter.contactId)
         conditions.push(eq(transactions.contactId, filter.contactId));
      if (filter.dateFrom)
         conditions.push(gte(transactions.date, filter.dateFrom));
      if (filter.dateTo) conditions.push(lte(transactions.date, filter.dateTo));
      if (filter.search) {
         const pattern = `%${filter.search}%`;
         const searchCond = or(
            ilike(transactions.name, pattern),
            ilike(transactions.description, pattern),
         );
         if (searchCond) conditions.push(searchCond);
      }

      const whereClause = and(...conditions);

      const [countResult] = await db
         .select({ total: count() })
         .from(transactions)
         .where(whereClause);

      const data = await db
         .select()
         .from(transactions)
         .where(whereClause)
         .orderBy(desc(transactions.date))
         .limit(pageSize)
         .offset((page - 1) * pageSize);

      return { data, total: countResult?.total ?? 0 };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list transactions");
   }
}

export async function getTransactionWithTags(db: DatabaseInstance, id: string) {
   try {
      const [transaction] = await db
         .select()
         .from(transactions)
         .where(eq(transactions.id, id));
      if (!transaction) return null;

      const tagRows = await db
         .select()
         .from(transactionTags)
         .where(eq(transactionTags.transactionId, id));

      return { ...transaction, tagIds: tagRows.map((r) => r.tagId) };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get transaction");
   }
}

export async function updateTransaction(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewTransaction>,
   tagIds?: string[],
) {
   try {
      const [updated] = await db
         .update(transactions)
         .set(data)
         .where(eq(transactions.id, id))
         .returning();

      if (!updated) {
         throw AppError.database("Transaction not found");
      }

      if (tagIds !== undefined) {
         await db
            .delete(transactionTags)
            .where(eq(transactionTags.transactionId, id));
         if (tagIds.length > 0) {
            await db
               .insert(transactionTags)
               .values(tagIds.map((tagId) => ({ transactionId: id, tagId })));
         }
      }

      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update transaction");
   }
}

export async function deleteTransaction(db: DatabaseInstance, id: string) {
   try {
      await db.delete(transactions).where(eq(transactions.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete transaction");
   }
}
