import { desc, eq, getTableColumns, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DatabaseInstance } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";

export function selectTransactionsWithJoins(db: DatabaseInstance, where: SQL) {
   const suggestedCategories = alias(categories, "suggested_categories");
   const suggestedTags = alias(tags, "suggested_tags");
   const tagAlias = alias(tags, "tag_alias");

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
      .orderBy(desc(transactions.date));
}
