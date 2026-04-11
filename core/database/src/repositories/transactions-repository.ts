import type { Condition, ConditionGroup } from "@f-o-t/condition-evaluator";
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { of, toDecimal } from "@f-o-t/money";
import {
   and,
   count,
   desc,
   eq,
   getTableColumns,
   gt,
   gte,
   ilike,
   inArray,
   isNotNull,
   isNull,
   lt,
   lte,
   ne,
   or,
   sql,
} from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateTransactionInput,
   type UpdateTransactionInput,
   createTransactionSchema,
   updateTransactionSchema,
   transactionItems,
   transactions,
   transactionTags,
} from "@core/database/schemas/transactions";
import { getBankAccount } from "@core/database/repositories/bank-accounts-repository";
import { getCategory } from "@core/database/repositories/categories-repository";
import { getContact } from "@core/database/repositories/contacts-repository";
import { getTag } from "@core/database/repositories/tags-repository";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";

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
   uncategorized?: boolean;
   creditCardId?: string;
   paymentMethod?: string;
   conditionGroup?: ConditionGroup;
}

function conditionToSql(condition: Condition) {
   const colMap: Record<string, unknown> = {
      categoryId: transactions.categoryId,
      bankAccountId: transactions.bankAccountId,
      creditCardId: transactions.creditCardId,
      amount: transactions.amount,
      name: transactions.name,
      paymentMethod: transactions.paymentMethod,
   };

   const col = colMap[condition.field];
   if (!col) return null;

   const { operator } = condition;
   const value = "value" in condition ? condition.value : undefined;

   switch (operator) {
      case "eq":
         return eq(col as Parameters<typeof eq>[0], value as string);
      case "neq":
         return ne(col as Parameters<typeof ne>[0], value as string);
      case "gt":
         return gt(col as Parameters<typeof gt>[0], value as number);
      case "gte":
         return gte(col as Parameters<typeof gte>[0], value as number);
      case "lt":
         return lt(col as Parameters<typeof lt>[0], value as number);
      case "lte":
         return lte(col as Parameters<typeof lte>[0], value as number);
      case "is_empty":
         return isNull(col as Parameters<typeof isNull>[0]);
      case "is_not_empty":
         return isNotNull(col as Parameters<typeof isNotNull>[0]);
      case "contains":
         return ilike(col as Parameters<typeof ilike>[0], `%${value}%`);
      case "not_contains":
         return sql`${col} NOT ILIKE ${"%" + String(value) + "%"}`;
      case "starts_with":
         return ilike(col as Parameters<typeof ilike>[0], `${value}%`);
      case "ends_with":
         return ilike(col as Parameters<typeof ilike>[0], `%${value}`);
      default:
         return null;
   }
}

export async function ensureTransactionOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const [transaction] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.teamId, teamId)));
   if (!transaction) {
      throw AppError.notFound("Transação não encontrada.");
   }
   return transaction;
}

export async function validateTransactionReferences(
   db: DatabaseInstance,
   teamId: string,
   refs: {
      bankAccountId?: string | null;
      destinationBankAccountId?: string | null;
      categoryId?: string | null;
      contactId?: string | null;
      tagIds?: string[];
      date?: Date | string | null;
   },
) {
   if (refs.bankAccountId) {
      const account = await getBankAccount(db, refs.bankAccountId);
      if (!account || account.teamId !== teamId) {
         throw AppError.validation("Conta bancária inválida.");
      }
      if (account.initialBalanceDate && refs.date) {
         const txDate = new Date(refs.date);
         const balanceDate = new Date(account.initialBalanceDate);
         if (txDate < balanceDate) {
            throw AppError.validation(
               `Não é possível registrar lançamentos antes da data do saldo inicial (${balanceDate.toLocaleDateString("pt-BR")}).`,
            );
         }
      }
   }

   if (refs.destinationBankAccountId) {
      const dest = await getBankAccount(db, refs.destinationBankAccountId);
      if (!dest || dest.teamId !== teamId) {
         throw AppError.validation("Conta de destino inválida.");
      }
      if (dest.initialBalanceDate && refs.date) {
         const txDate = new Date(refs.date);
         const balanceDate = new Date(dest.initialBalanceDate);
         if (txDate < balanceDate) {
            throw AppError.validation(
               `Não é possível registrar lançamentos antes da data do saldo inicial da conta de destino (${balanceDate.toLocaleDateString("pt-BR")}).`,
            );
         }
      }
   }

   if (refs.categoryId) {
      const cat = await getCategory(db, refs.categoryId);
      if (!cat || cat.teamId !== teamId) {
         throw AppError.validation("Categoria inválida.");
      }
   }

   if (refs.tagIds && refs.tagIds.length > 0) {
      for (const tagId of refs.tagIds) {
         const tag = await getTag(db, tagId);
         if (!tag || tag.teamId !== teamId) {
            throw AppError.validation("Tag inválida.");
         }
      }
   }

   if (refs.contactId) {
      const contact = await getContact(db, refs.contactId);
      if (!contact || contact.teamId !== teamId) {
         throw AppError.validation("Contato inválido.");
      }
   }
}

export async function createTransaction(
   db: DatabaseInstance,
   teamId: string,
   data: CreateTransactionInput,
   tagIds?: string[],
) {
   try {
      const validated = validateInput(createTransactionSchema, data);
      const [transaction] = await db
         .insert(transactions)
         .values({ ...validated, teamId })
         .returning();

      if (!transaction) throw AppError.database("Failed to create transaction");

      if (tagIds && tagIds.length > 0) {
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
            ilike(contacts.name, pattern),
         );
         if (searchCond) conditions.push(searchCond);
      }
      if (filter.creditCardId)
         conditions.push(eq(transactions.creditCardId, filter.creditCardId));
      if (filter.paymentMethod)
         conditions.push(
            eq(
               transactions.paymentMethod,
               filter.paymentMethod as (typeof transactions.paymentMethod.enumValues)[number],
            ),
         );
      if (filter.uncategorized)
         conditions.push(isNull(transactions.categoryId));

      const isWeighted = filter.conditionGroup?.scoringMode === "weighted";

      if (filter.conditionGroup && !isWeighted) {
         const group = filter.conditionGroup;
         const sqlExprs = group.conditions
            .filter((c): c is Condition => !("conditions" in c))
            .map((c) => conditionToSql(c))
            .filter(
               (e): e is NonNullable<ReturnType<typeof conditionToSql>> =>
                  e !== null,
            );

         if (sqlExprs.length > 0) {
            const combined =
               group.operator === "AND" ? and(...sqlExprs) : or(...sqlExprs);
            if (combined) conditions.push(combined);
         }
      }

      const whereClause = and(...conditions);

      if (isWeighted && filter.conditionGroup) {
         const condGroup = filter.conditionGroup;
         const allRows = await db
            .select({
               ...getTableColumns(transactions),
               categoryName: categories.name,
               creditCardName: creditCards.name,
               bankAccountName: bankAccounts.name,
               contactName: contacts.name,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(
               creditCards,
               eq(transactions.creditCardId, creditCards.id),
            )
            .leftJoin(
               bankAccounts,
               eq(transactions.bankAccountId, bankAccounts.id),
            )
            .leftJoin(contacts, eq(transactions.contactId, contacts.id))
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

         const total = filtered.length;
         const offset = (page - 1) * pageSize;
         return { data: filtered.slice(offset, offset + pageSize), total };
      }

      const [countResult] = await db
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

      const data = await db
         .select({
            ...getTableColumns(transactions),
            categoryName: categories.name,
            creditCardName: creditCards.name,
            bankAccountName: bankAccounts.name,
            contactName: contacts.name,
         })
         .from(transactions)
         .leftJoin(categories, eq(transactions.categoryId, categories.id))
         .leftJoin(creditCards, eq(transactions.creditCardId, creditCards.id))
         .leftJoin(
            bankAccounts,
            eq(transactions.bankAccountId, bankAccounts.id),
         )
         .leftJoin(contacts, eq(transactions.contactId, contacts.id))
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

export async function getTransactionsSummary(
   db: DatabaseInstance,
   filter: ListTransactionsFilter,
) {
   try {
      const conditions = [eq(transactions.teamId, filter.teamId)];

      if (filter.tagId) {
         const taggedIds = await db
            .select({ transactionId: transactionTags.transactionId })
            .from(transactionTags)
            .where(eq(transactionTags.tagId, filter.tagId));
         if (taggedIds.length === 0)
            return {
               totalCount: 0,
               incomeTotal: "0",
               expenseTotal: "0",
               balance: "0",
            };
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
      if (filter.creditCardId)
         conditions.push(eq(transactions.creditCardId, filter.creditCardId));
      if (filter.paymentMethod)
         conditions.push(
            eq(
               transactions.paymentMethod,
               filter.paymentMethod as (typeof transactions.paymentMethod.enumValues)[number],
            ),
         );
      if (filter.uncategorized)
         conditions.push(isNull(transactions.categoryId));

      const whereClause = and(...conditions);

      const [result] = await db
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
         totalCount: result?.totalCount ?? 0,
         incomeTotal: toDecimal(of(result?.incomeTotal ?? "0", currency)),
         expenseTotal: toDecimal(of(result?.expenseTotal ?? "0", currency)),
         balance: toDecimal(of(result?.balance ?? "0", currency)),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get transactions summary");
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
   data: UpdateTransactionInput,
   tagIds?: string[],
) {
   try {
      const validated = validateInput(updateTransactionSchema, data);
      const [updated] = await db
         .update(transactions)
         .set(validated)
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

export async function createTransactionItems(
   db: DatabaseInstance,
   transactionId: string,
   teamId: string,
   items: {
      serviceId?: string | null;
      description?: string | null;
      quantity: string;
      unitPrice: string;
   }[],
) {
   if (items.length === 0) return;
   try {
      await db.insert(transactionItems).values(
         items.map((item) => ({
            transactionId,
            teamId,
            serviceId: item.serviceId ?? null,
            description: item.description ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
         })),
      );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create transaction items");
   }
}

export async function getTransactionItems(
   db: DatabaseInstance,
   transactionId: string,
) {
   try {
      return db
         .select()
         .from(transactionItems)
         .where(eq(transactionItems.transactionId, transactionId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get transaction items");
   }
}

export async function replaceTransactionItems(
   db: DatabaseInstance,
   transactionId: string,
   teamId: string,
   items: {
      serviceId?: string | null;
      description?: string | null;
      quantity: string;
      unitPrice: string;
   }[],
) {
   try {
      await db
         .delete(transactionItems)
         .where(eq(transactionItems.transactionId, transactionId));
      if (items.length > 0) {
         await createTransactionItems(db, transactionId, teamId, items);
      }
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to replace transaction items");
   }
}
