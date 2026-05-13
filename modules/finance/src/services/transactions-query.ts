import { asc, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DatabaseInstance } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";

export type TransactionSortId =
   | "amount"
   | "bankAccountName"
   | "categoryName"
   | "contactName"
   | "creditCardName"
   | "date"
   | "dueDate"
   | "name"
   | "status"
   | "type";

export interface TransactionSortingRule {
   id: TransactionSortId;
   desc: boolean;
}

function buildTransactionOrderBy(
   sorting: TransactionSortingRule[] | undefined,
): SQL[] {
   const displayDate = sql<string>`CASE WHEN ${transactions.status} = 'pending' AND ${transactions.dueDate} IS NOT NULL THEN ${transactions.dueDate} ELSE ${transactions.date} END`;
   const [sort] = sorting ?? [];
   if (!sort) return [desc(transactions.date), desc(transactions.createdAt)];

   const direction = sort.desc ? desc : asc;

   switch (sort.id) {
      case "amount":
         return [direction(transactions.amount), desc(transactions.createdAt)];
      case "bankAccountName":
         return [direction(bankAccounts.name), desc(transactions.createdAt)];
      case "categoryName":
         return [direction(categories.name), desc(transactions.createdAt)];
      case "contactName":
         return [direction(contacts.name), desc(transactions.createdAt)];
      case "creditCardName":
         return [direction(creditCards.name), desc(transactions.createdAt)];
      case "date":
         return [direction(displayDate), desc(transactions.createdAt)];
      case "dueDate":
         return [direction(transactions.dueDate), desc(transactions.createdAt)];
      case "name":
         return [direction(transactions.name), desc(transactions.createdAt)];
      case "status":
         return [direction(transactions.status), desc(transactions.createdAt)];
      case "type":
         return [direction(transactions.type), desc(transactions.createdAt)];
   }
}

export function selectTransactionsWithJoins(
   db: DatabaseInstance,
   where: SQL,
   sorting?: TransactionSortingRule[],
) {
   const suggestedCategories = alias(categories, "suggested_categories");
   const suggestedTags = alias(tags, "suggested_tags");
   const tagAlias = alias(tags, "tag_alias");
   const orderBy = buildTransactionOrderBy(sorting);

   return db
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
      .leftJoin(bankAccounts, eq(transactions.bankAccountId, bankAccounts.id))
      .leftJoin(contacts, eq(transactions.contactId, contacts.id))
      .leftJoin(tagAlias, eq(transactions.tagId, tagAlias.id))
      .leftJoin(
         suggestedTags,
         eq(transactions.suggestedTagId, suggestedTags.id),
      )
      .where(where)
      .orderBy(...orderBy);
}
