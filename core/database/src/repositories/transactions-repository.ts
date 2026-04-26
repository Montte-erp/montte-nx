import dayjs from "dayjs";
import type { Condition, ConditionGroup } from "@f-o-t/condition-evaluator";
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
import { AppError, validateInput } from "@core/logging/errors";
import { fromPromise } from "neverthrow";
import { of, toDecimal } from "@f-o-t/money";
import { alias } from "drizzle-orm/pg-core";
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
} from "@core/database/schemas/transactions";
import {
   getBankAccount,
   ensureBankAccountOwnership,
} from "@core/database/repositories/bank-accounts-repository";
import { getContact } from "@core/database/repositories/contacts-repository";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { tags } from "@core/database/schemas/tags";
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
   status?:
      | "pending"
      | "paid"
      | "cancelled"
      | ("pending" | "paid" | "cancelled")[];
   dueDateFrom?: string;
   dueDateTo?: string;
   overdueOnly?: boolean;
   view?: "all" | "payable" | "receivable" | "settled" | "cancelled";
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
      tagId?: string | null;
      date?: Date | string | null;
   },
) {
   if (refs.bankAccountId) {
      const account = await getBankAccount(db, refs.bankAccountId);
      if (!account || account.teamId !== teamId) {
         throw AppError.validation("Conta bancária inválida.");
      }
      if (account.initialBalanceDate && refs.date) {
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(account.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw AppError.validation(
               `Não é possível registrar lançamentos antes da data do saldo inicial (${balanceDate.format("DD/MM/YYYY")}).`,
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
         const txDate = dayjs(refs.date);
         const balanceDate = dayjs(dest.initialBalanceDate);
         if (txDate.isBefore(balanceDate)) {
            throw AppError.validation(
               `Não é possível registrar lançamentos antes da data do saldo inicial da conta de destino (${balanceDate.format("DD/MM/YYYY")}).`,
            );
         }
      }
   }

   if (refs.categoryId) {
      const cat = await db.query.categories.findFirst({
         where: (fields, { eq }) => eq(fields.id, refs.categoryId!),
      });
      if (!cat || cat.teamId !== teamId) {
         throw AppError.validation("Categoria inválida.");
      }
   }

   if (refs.tagId) {
      const tag = await db.query.tags.findFirst({
         where: (fields, { eq }) => eq(fields.id, refs.tagId!),
      });
      if (!tag || tag.teamId !== teamId) {
         throw AppError.validation("Tag inválida.");
      }
   }

   if (refs.contactId) {
      const contactResult = await getContact(db, refs.contactId);
      if (contactResult.isErr()) throw contactResult.error;
      if (!contactResult.value || contactResult.value.teamId !== teamId) {
         throw AppError.validation("Contato inválido.");
      }
   }
}

export function createTransaction(
   db: DatabaseInstance,
   teamId: string,
   data: CreateTransactionInput,
   tagId?: string,
) {
   return fromPromise(
      (async () => {
         const validated = validateInput(createTransactionSchema, data);
         const [transaction] = await db
            .insert(transactions)
            .values({ ...validated, teamId, tagId: tagId ?? null })
            .returning();
         if (!transaction)
            throw AppError.database("Falha ao criar lançamento.");
         return transaction;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao criar lançamento.", { cause: e }),
   );
}

export function listTransactions(
   db: DatabaseInstance,
   filter: ListTransactionsFilter,
) {
   return fromPromise(
      (async () => {
         const page = filter.page ?? 1;
         const pageSize = filter.pageSize ?? 50;

         const conditions = [eq(transactions.teamId, filter.teamId)];

         if (filter.tagId) {
            conditions.push(eq(transactions.tagId, filter.tagId));
         }

         if (filter.type) conditions.push(eq(transactions.type, filter.type));
         if (filter.bankAccountId)
            conditions.push(
               eq(transactions.bankAccountId, filter.bankAccountId),
            );
         if (filter.categoryId)
            conditions.push(eq(transactions.categoryId, filter.categoryId));
         if (filter.contactId)
            conditions.push(eq(transactions.contactId, filter.contactId));
         if (filter.dateFrom)
            conditions.push(gte(transactions.date, filter.dateFrom));
         if (filter.dateTo)
            conditions.push(lte(transactions.date, filter.dateTo));
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
         if (filter.status) {
            if (Array.isArray(filter.status)) {
               conditions.push(inArray(transactions.status, filter.status));
            } else {
               conditions.push(eq(transactions.status, filter.status));
            }
         }
         if (filter.dueDateFrom)
            conditions.push(gte(transactions.dueDate, filter.dueDateFrom));
         if (filter.dueDateTo)
            conditions.push(lte(transactions.dueDate, filter.dueDateTo));
         if (filter.overdueOnly) {
            const today = dayjs().format("YYYY-MM-DD");
            conditions.push(eq(transactions.status, "pending"));
            conditions.push(lt(transactions.dueDate, today));
         }
         if (filter.view === "payable") {
            conditions.push(eq(transactions.type, "expense"));
            conditions.push(eq(transactions.status, "pending"));
         } else if (filter.view === "receivable") {
            conditions.push(eq(transactions.type, "income"));
            conditions.push(eq(transactions.status, "pending"));
         } else if (filter.view === "settled") {
            conditions.push(eq(transactions.status, "paid"));
         } else if (filter.view === "cancelled") {
            conditions.push(eq(transactions.status, "cancelled"));
         }

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
            const suggestedCategoriesWeighted = alias(
               categories,
               "suggested_categories",
            );
            const suggestedTagsWeighted = alias(tags, "suggested_tags");
            const tagAliasWeighted = alias(tags, "tag_alias");
            const allRows = await db
               .select({
                  ...getTableColumns(transactions),
                  categoryName: categories.name,
                  creditCardName: creditCards.name,
                  bankAccountName: bankAccounts.name,
                  contactName: contacts.name,
                  suggestedCategoryName: suggestedCategoriesWeighted.name,
                  tagName: tagAliasWeighted.name,
                  suggestedTagName: suggestedTagsWeighted.name,
               })
               .from(transactions)
               .leftJoin(categories, eq(transactions.categoryId, categories.id))
               .leftJoin(
                  suggestedCategoriesWeighted,
                  eq(
                     transactions.suggestedCategoryId,
                     suggestedCategoriesWeighted.id,
                  ),
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
               .leftJoin(
                  tagAliasWeighted,
                  eq(transactions.tagId, tagAliasWeighted.id),
               )
               .leftJoin(
                  suggestedTagsWeighted,
                  eq(transactions.suggestedTagId, suggestedTagsWeighted.id),
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

            const total = filtered.length;
            const offset = (page - 1) * pageSize;
            return { data: filtered.slice(offset, offset + pageSize), total };
         }

         const [countResult] = await db
            .select({ total: count() })
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
            .where(whereClause);

         const suggestedCategories = alias(categories, "suggested_categories");
         const suggestedTags = alias(tags, "suggested_tags");
         const tagAlias = alias(tags, "tag_alias");

         const data = await db
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
            .orderBy(desc(transactions.date))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

         return { data, total: countResult?.total ?? 0 };
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao listar lançamentos.", { cause: e }),
   );
}

export function getTransactionsSummary(
   db: DatabaseInstance,
   filter: ListTransactionsFilter,
) {
   return fromPromise(
      (async () => {
         const conditions = [eq(transactions.teamId, filter.teamId)];

         if (filter.tagId) {
            conditions.push(eq(transactions.tagId, filter.tagId));
         }

         if (filter.type) conditions.push(eq(transactions.type, filter.type));
         if (filter.bankAccountId)
            conditions.push(
               eq(transactions.bankAccountId, filter.bankAccountId),
            );
         if (filter.categoryId)
            conditions.push(eq(transactions.categoryId, filter.categoryId));
         if (filter.contactId)
            conditions.push(eq(transactions.contactId, filter.contactId));
         if (filter.dateFrom)
            conditions.push(gte(transactions.date, filter.dateFrom));
         if (filter.dateTo)
            conditions.push(lte(transactions.date, filter.dateTo));
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
         if (filter.status) {
            if (Array.isArray(filter.status)) {
               conditions.push(inArray(transactions.status, filter.status));
            } else {
               conditions.push(eq(transactions.status, filter.status));
            }
         }
         if (filter.dueDateFrom)
            conditions.push(gte(transactions.dueDate, filter.dueDateFrom));
         if (filter.dueDateTo)
            conditions.push(lte(transactions.dueDate, filter.dueDateTo));
         if (filter.overdueOnly) {
            const today = dayjs().format("YYYY-MM-DD");
            conditions.push(eq(transactions.status, "pending"));
            conditions.push(lt(transactions.dueDate, today));
         }
         if (filter.view === "payable") {
            conditions.push(eq(transactions.type, "expense"));
            conditions.push(eq(transactions.status, "pending"));
         } else if (filter.view === "receivable") {
            conditions.push(eq(transactions.type, "income"));
            conditions.push(eq(transactions.status, "pending"));
         } else if (filter.view === "settled") {
            conditions.push(eq(transactions.status, "paid"));
         } else if (filter.view === "cancelled") {
            conditions.push(eq(transactions.status, "cancelled"));
         }

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
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao buscar resumo dos lançamentos.", {
                 cause: e,
              }),
   );
}

export function getTransactionWithTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      (async () => {
         const [transaction] = await db
            .select()
            .from(transactions)
            .where(eq(transactions.id, id));
         if (!transaction) return null;
         return transaction;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao buscar lançamento.", { cause: e }),
   );
}

export function updateTransaction(
   db: DatabaseInstance,
   id: string,
   data: UpdateTransactionInput,
   tagId?: string | null,
) {
   return fromPromise(
      (async () => {
         const validated = validateInput(updateTransactionSchema, data);
         const [updated] = await db
            .update(transactions)
            .set({
               ...validated,
               ...(tagId !== undefined ? { tagId, suggestedTagId: null } : {}),
               ...(validated.categoryId !== undefined
                  ? { suggestedCategoryId: null }
                  : {}),
            })
            .where(eq(transactions.id, id))
            .returning();
         if (!updated) throw AppError.notFound("Lançamento não encontrado.");
         return updated;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao atualizar lançamento.", { cause: e }),
   );
}

export function markTransactionAsPaid(
   db: DatabaseInstance,
   id: string,
   teamId: string,
   opts: { paidDate?: string; bankAccountId?: string | null } = {},
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const existing = await ensureTransactionOwnership(tx, id, teamId);
         if (existing.status === "paid") {
            throw AppError.conflict("Lançamento já está pago.");
         }
         if (existing.status === "cancelled") {
            throw AppError.validation(
               "Lançamento cancelado não pode ser pago.",
            );
         }
         const paidDate = opts.paidDate ?? dayjs().format("YYYY-MM-DD");
         if (typeof opts.bankAccountId === "string") {
            await ensureBankAccountOwnership(tx, opts.bankAccountId, teamId);
         }
         const [row] = await tx
            .update(transactions)
            .set({
               status: "paid",
               paidAt: dayjs().toDate(),
               date: paidDate,
               ...(opts.bankAccountId !== undefined
                  ? { bankAccountId: opts.bankAccountId }
                  : {}),
            })
            .where(eq(transactions.id, id))
            .returning();
         if (!row) throw AppError.notFound("Lançamento não encontrado.");
         return row;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao marcar lançamento como pago.", {
                 cause: e,
              }),
   );
}

export function markTransactionAsUnpaid(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const existing = await ensureTransactionOwnership(tx, id, teamId);
         if (existing.status !== "paid") {
            throw AppError.conflict(
               "Apenas lançamentos pagos podem ser desmarcados.",
            );
         }
         const [row] = await tx
            .update(transactions)
            .set({ status: "pending", paidAt: null })
            .where(eq(transactions.id, id))
            .returning();
         if (!row) throw AppError.notFound("Lançamento não encontrado.");
         return row;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao desmarcar lançamento.", { cause: e }),
   );
}

export function cancelTransaction(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const existing = await ensureTransactionOwnership(tx, id, teamId);
         if (existing.status === "cancelled") {
            throw AppError.conflict("Lançamento já está cancelado.");
         }
         const [row] = await tx
            .update(transactions)
            .set({ status: "cancelled" })
            .where(eq(transactions.id, id))
            .returning();
         if (!row) throw AppError.notFound("Lançamento não encontrado.");
         return row;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao cancelar lançamento.", { cause: e }),
   );
}

export function reactivateTransaction(
   db: DatabaseInstance,
   id: string,
   teamId: string,
   paid: boolean,
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const existing = await ensureTransactionOwnership(tx, id, teamId);
         if (existing.status !== "cancelled") {
            throw AppError.conflict(
               "Apenas lançamentos cancelados podem ser reativados.",
            );
         }
         const [row] = await tx
            .update(transactions)
            .set({
               status: paid ? "paid" : "pending",
               paidAt: paid ? dayjs().toDate() : null,
            })
            .where(eq(transactions.id, id))
            .returning();
         if (!row) throw AppError.notFound("Lançamento não encontrado.");
         return row;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao reativar lançamento.", { cause: e }),
   );
}

export function bulkMarkTransactionsAsPaid(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
   opts: { paidDate?: string; bankAccountId?: string | null } = {},
) {
   return fromPromise(
      (async () => {
         const results = await Promise.allSettled(
            ids.map((id) =>
               markTransactionAsPaid(db, id, teamId, opts).match(
                  (v) => v,
                  (e) => {
                     throw e;
                  },
               ),
            ),
         );
         return {
            succeeded: results.filter((r) => r.status === "fulfilled").length,
            failed: results.filter((r) => r.status === "rejected").length,
         };
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao marcar lançamentos como pagos.", {
                 cause: e,
              }),
   );
}

export function bulkCreateTransactions(
   db: DatabaseInstance,
   teamId: string,
   rows: Omit<typeof transactions.$inferInsert, "teamId">[],
) {
   return fromPromise(
      db
         .insert(transactions)
         .values(rows.map((r) => ({ ...r, teamId })))
         .returning({
            id: transactions.id,
            name: transactions.name,
            type: transactions.type,
            categoryId: transactions.categoryId,
         }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao importar lançamentos.", { cause: e }),
   );
}

export function deleteTransaction(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.delete(transactions).where(eq(transactions.id, id)),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao excluir lançamento.", { cause: e }),
   );
}

export function createTransactionItems(
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
   if (items.length === 0)
      return fromPromise(Promise.resolve(undefined), (e) =>
         AppError.database("Falha ao criar itens do lançamento.", { cause: e }),
      );
   return fromPromise(
      db.insert(transactionItems).values(
         items.map((item) => ({
            transactionId,
            teamId,
            serviceId: item.serviceId ?? null,
            description: item.description ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
         })),
      ),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao criar itens do lançamento.", {
                 cause: e,
              }),
   );
}

export function getTransactionItems(
   db: DatabaseInstance,
   transactionId: string,
) {
   return fromPromise(
      db
         .select()
         .from(transactionItems)
         .where(eq(transactionItems.transactionId, transactionId)),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao buscar itens do lançamento.", {
                 cause: e,
              }),
   );
}

export function replaceTransactionItems(
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
   return fromPromise(
      (async () => {
         await db
            .delete(transactionItems)
            .where(eq(transactionItems.transactionId, transactionId));
         if (items.length > 0) {
            await createTransactionItems(
               db,
               transactionId,
               teamId,
               items,
            ).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            );
         }
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao substituir itens do lançamento.", {
                 cause: e,
              }),
   );
}

export function updateTransactionCategory(
   db: DatabaseInstance,
   id: string,
   data: {
      categoryId?: string | null;
      suggestedCategoryId?: string | null;
   },
) {
   return fromPromise(
      db
         .update(transactions)
         .set({ ...data, updatedAt: dayjs().toDate() })
         .where(eq(transactions.id, id)),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao atualizar categoria do lançamento.", {
                 cause: e,
              }),
   );
}

export function updateTransactionTag(
   db: DatabaseInstance,
   id: string,
   data: {
      tagId?: string | null;
      suggestedTagId?: string | null;
   },
) {
   return fromPromise(
      db
         .update(transactions)
         .set({ ...data, updatedAt: dayjs().toDate() })
         .where(eq(transactions.id, id)),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database(
                 "Falha ao atualizar centro de custo da transação.",
                 { cause: e },
              ),
   );
}
