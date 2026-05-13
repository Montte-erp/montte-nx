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
) {
   const displayDate = sql<string>`CASE WHEN ${transactions.status} = 'pending' AND ${transactions.dueDate} IS NOT NULL THEN ${transactions.dueDate} ELSE ${transactions.date} END`;
   if (!sorting?.length)
      return [desc(transactions.date), desc(transactions.createdAt)];
   const orderBy: SQL[] = [];

   for (const sort of sorting) {
      const direction = sort.desc ? desc : asc;

      switch (sort.id) {
         case "amount":
            orderBy.push(direction(transactions.amount));
            break;
         case "bankAccountName":
            orderBy.push(direction(bankAccounts.name));
            break;
         case "categoryName":
            orderBy.push(direction(categories.name));
            break;
         case "contactName":
            orderBy.push(direction(contacts.name));
            break;
         case "creditCardName":
            orderBy.push(direction(creditCards.name));
            break;
         case "date":
            orderBy.push(direction(displayDate));
            break;
         case "dueDate":
            orderBy.push(direction(transactions.dueDate));
            break;
         case "name":
            orderBy.push(direction(transactions.name));
            break;
         case "status":
            orderBy.push(direction(transactions.status));
            break;
         case "type":
            orderBy.push(direction(transactions.type));
            break;
      }
   }

   return [...orderBy, desc(transactions.createdAt)];
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
