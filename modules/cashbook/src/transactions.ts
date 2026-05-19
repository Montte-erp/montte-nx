import dayjs from "dayjs";
import {
   fromMinorUnits,
   of,
   toMajorUnitsString,
   toMinorUnits,
} from "@f-o-t/money";
import {
   and,
   asc,
   desc,
   eq,
   getTableColumns,
   gte,
   ilike,
   inArray,
   isNull,
   lt,
   lte,
   or,
   sql,
   type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import type { Condition, ConditionGroup } from "@f-o-t/condition-evaluator";
import type { DatabaseInstance } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { creditCards } from "@core/database/schemas/credit-cards";
import { tags } from "@core/database/schemas/tags";
import {
   transactions,
   type TransactionRecurrenceFrequency,
} from "@core/database/schemas/transactions";
import { isIsoDateString } from "@core/utils/dates";

export const transactionRuleErrors = defineErrorCatalog(
   "cashbook.transaction.rule",
   {
      BAD_REQUEST: {
         status: 400,
         message: "Regra de lançamento inválida.",
         tags: ["cashbook"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cashbook.transaction.rule": typeof transactionRuleErrors;
   }
}

type TransactionRuleCatalogError = ReturnType<
   typeof transactionRuleErrors.BAD_REQUEST
>;

export class TransactionRuleError extends TaggedError("TransactionRuleError")<{
   error: TransactionRuleCatalogError;
   message: string;
}>() {}

export type TransactionSortId =
   | "amount"
   | "bankAccountName"
   | "categoryName"
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
      const direction = (() => {
         if (sort.desc) return desc;
         return asc;
      })();

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
      .leftJoin(tagAlias, eq(transactions.tagId, tagAlias.id))
      .leftJoin(
         suggestedTags,
         eq(transactions.suggestedTagId, suggestedTags.id),
      )
      .where(where)
      .orderBy(...orderBy);
}

export interface TransactionFilter {
   teamId: string;
   type?: "income" | "expense" | "transfer";
   bankAccountId?: string;
   categoryId?: string;
   tagId?: string;
   dateFrom?: string;
   dateTo?: string;
   search?: string;
   page?: number;
   pageSize?: number;
   uncategorized?: boolean;
   creditCardId?: string;
   paymentMethod?: string;
   conditionGroup?: ConditionGroup;
   status?: "pending" | "paid" | ("pending" | "paid")[];
   dueDateFrom?: string;
   dueDateTo?: string;
   overdueOnly?: boolean;
   view?: "all" | "payable" | "receivable" | "settled" | "ignored";
   includeIgnored?: boolean;
   ignored?: boolean;
   sorting?: TransactionSortingRule[];
}

const t = transactions;

const COND_COLUMNS = {
   categoryId: { column: t.categoryId, isText: false },
   bankAccountId: { column: t.bankAccountId, isText: false },
   creditCardId: { column: t.creditCardId, isText: false },
   amount: { column: t.amount, isText: false },
   name: { column: t.name, isText: true },
   paymentMethod: { column: t.paymentMethod, isText: true },
};

function isCondColumnKey(value: string): value is keyof typeof COND_COLUMNS {
   return value in COND_COLUMNS;
}

function conditionToSql(c: Condition) {
   if (!isCondColumnKey(c.field)) return null;
   const col = COND_COLUMNS[c.field];
   if (!col) return null;
   const v = (() => {
      if ("value" in c) return c.value;
      return undefined;
   })();
   const s = String(v);
   switch (c.operator) {
      case "eq":
         return sql`${col.column} = ${v}`;
      case "neq":
         return sql`${col.column} <> ${v}`;
      case "gt":
         return sql`${col.column} > ${v}`;
      case "gte":
         return sql`${col.column} >= ${v}`;
      case "lt":
         return sql`${col.column} < ${v}`;
      case "lte":
         return sql`${col.column} <= ${v}`;
      case "is_empty":
         return sql`${col.column} IS NULL`;
      case "is_not_empty":
         return sql`${col.column} IS NOT NULL`;
      case "contains":
         if (!col.isText) return null;
         return sql`${col.column} ILIKE ${`%${s}%`}`;
      case "not_contains":
         if (!col.isText) return null;
         return sql`${col.column} NOT ILIKE ${`%${s}%`}`;
      case "starts_with":
         if (!col.isText) return null;
         return sql`${col.column} ILIKE ${`${s}%`}`;
      case "ends_with":
         if (!col.isText) return null;
         return sql`${col.column} ILIKE ${`%${s}`}`;
      default:
         return null;
   }
}

const VIEW_FILTERS: Record<string, SQL[]> = {
   payable: [eq(t.type, "expense"), eq(t.status, "pending")],
   receivable: [eq(t.type, "income"), eq(t.status, "pending")],
   settled: [eq(t.status, "paid")],
   ignored: [eq(t.ignored, true)],
};

function conditionGroupToSql(group: ConditionGroup) {
   if (group.scoringMode === "weighted") return null;
   const groupExpressions = new Map<ConditionGroup, SQL | null>();
   const stack: { group: ConditionGroup; visited: boolean }[] = [
      { group, visited: false },
   ];

   while (stack.length > 0) {
      const item = stack.pop();
      if (!item) continue;

      if (!item.visited) {
         stack.push({ group: item.group, visited: true });
         for (const condition of item.group.conditions) {
            if (
               "conditions" in condition &&
               condition.scoringMode !== "weighted"
            ) {
               stack.push({ group: condition, visited: false });
            }
         }
         continue;
      }

      const exprs = item.group.conditions
         .map((condition) =>
            "conditions" in condition
               ? (groupExpressions.get(condition) ?? null)
               : conditionToSql(condition),
         )
         .filter((e): e is SQL => e !== null);

      if (exprs.length === 0) {
         groupExpressions.set(item.group, null);
         continue;
      }

      const combined = (() => {
         if (item.group.operator === "AND") return and(...exprs);
         return or(...exprs);
      })();
      groupExpressions.set(item.group, combined ?? null);
   }

   return groupExpressions.get(group) ?? null;
}

export function buildTransactionWhere(f: TransactionFilter) {
   const c: SQL[] = [eq(t.teamId, f.teamId)];
   const viewFilter = (() => {
      if (f.view) return VIEW_FILTERS[f.view];
      return undefined;
   })();
   const filtersIgnoredView = f.view === "ignored";

   if (f.ignored === true) c.push(eq(t.ignored, true));
   else if (!filtersIgnoredView && (f.ignored === false || !f.includeIgnored))
      c.push(eq(t.ignored, false));
   if (f.type) c.push(eq(t.type, f.type));
   if (f.bankAccountId) c.push(eq(t.bankAccountId, f.bankAccountId));
   if (f.categoryId) c.push(eq(t.categoryId, f.categoryId));
   if (f.tagId) c.push(eq(t.tagId, f.tagId));
   if (f.creditCardId) c.push(eq(t.creditCardId, f.creditCardId));
   if (f.dateFrom) c.push(gte(t.date, f.dateFrom));
   if (f.dateTo) c.push(lte(t.date, f.dateTo));
   if (f.dueDateFrom) c.push(gte(t.dueDate, f.dueDateFrom));
   if (f.dueDateTo) c.push(lte(t.dueDate, f.dueDateTo));
   if (f.uncategorized) c.push(isNull(t.categoryId));
   if (f.paymentMethod) c.push(sql`${t.paymentMethod} = ${f.paymentMethod}`);
   if (f.status) {
      if (Array.isArray(f.status) && f.status.length > 0) {
         c.push(inArray(t.status, f.status));
      }
      if (!Array.isArray(f.status)) {
         c.push(eq(t.status, f.status));
      }
   }
   if (f.overdueOnly) {
      c.push(eq(t.status, "pending"));
      c.push(lt(t.dueDate, dayjs().format("YYYY-MM-DD")));
   }
   if (viewFilter) c.push(...viewFilter);

   if (f.search) {
      const p = `%${f.search}%`;
      const cond = or(ilike(t.name, p), ilike(t.description, p));
      if (cond) c.push(cond);
   }

   const cg = f.conditionGroup;
   if (cg && cg.scoringMode !== "weighted") {
      const combined = conditionGroupToSql(cg);
      if (combined) c.push(combined);
   }

   return and(...c) ?? sql`true`;
}

export type InstallmentInput = {
   amount: string;
   date: string;
   dueDate?: string | null;
   count: number;
};

export type InstallmentPreview = {
   number: number;
   count: number;
   amount: string;
   date: string;
   dueDate: string | null;
};

const invalidMoneyMessage = "Valor deve ser um número válido maior que zero.";

function parseMoneyToCents(value: string) {
   const parsed = Result.try({
      try: () => of(value.trim(), "BRL"),
      catch: () =>
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: invalidMoneyMessage,
         }),
   });
   if (Result.isError(parsed)) return Result.err(parsed.error);

   const normalized = toMajorUnitsString(parsed.value);
   const cents = toMinorUnits(of(normalized, "BRL"));

   if (!Number.isSafeInteger(cents) || cents <= 0) {
      return Result.err(
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: invalidMoneyMessage,
         }),
      );
   }

   return Result.ok(cents);
}

function formatCents(cents: number) {
   return toMajorUnitsString(fromMinorUnits(cents, "BRL"));
}

export function buildInstallmentPreview(input: InstallmentInput) {
   if (!Number.isInteger(input.count) || input.count < 2) {
      return Result.err(
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: "Número de parcelas deve ser maior que 1.",
         }),
      );
   }
   if (!isIsoDateString(input.date)) {
      return Result.err(
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: "Data deve estar no formato YYYY-MM-DD.",
         }),
      );
   }
   if (input.dueDate && !isIsoDateString(input.dueDate)) {
      return Result.err(
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: "Vencimento deve estar no formato YYYY-MM-DD.",
         }),
      );
   }

   const parsed = parseMoneyToCents(input.amount);
   if (Result.isError(parsed)) return Result.err(parsed.error);

   const baseAmount = Math.floor(parsed.value / input.count);
   const remainder = parsed.value % input.count;

   if (baseAmount <= 0) {
      return Result.err(
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: "Valor total é baixo demais para o número de parcelas.",
         }),
      );
   }

   return Result.ok(
      Array.from({ length: input.count }, (_, index) => {
         const number = index + 1;
         const amount = baseAmount + Number(index < remainder);
         const date = dayjs(input.date)
            .add(index, "month")
            .format("YYYY-MM-DD");
         if (input.dueDate) {
            return {
               number,
               count: input.count,
               amount: formatCents(amount),
               date,
               dueDate: dayjs(input.dueDate)
                  .add(index, "month")
                  .format("YYYY-MM-DD"),
            };
         }
         return {
            number,
            count: input.count,
            amount: formatCents(amount),
            date,
            dueDate: null,
         };
      }),
   );
}

export type RecurrenceInput = {
   date: string;
   dueDate?: string | null;
   frequency: TransactionRecurrenceFrequency;
};

export type RecurrenceOccurrence = {
   number: number;
   date: string;
   dueDate: string | null;
};

export function addRecurrencePeriod(
   date: string,
   frequency: TransactionRecurrenceFrequency,
) {
   if (frequency === "daily") {
      return dayjs(date).add(1, "day").format("YYYY-MM-DD");
   }
   if (frequency === "weekly") {
      return dayjs(date).add(1, "week").format("YYYY-MM-DD");
   }
   if (frequency === "biweekly") {
      return dayjs(date).add(2, "week").format("YYYY-MM-DD");
   }
   return dayjs(date).add(1, "month").format("YYYY-MM-DD");
}

export function buildRecurrenceOccurrences(input: RecurrenceInput) {
   if (!isIsoDateString(input.date)) {
      return Result.err(
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: "Data deve estar no formato YYYY-MM-DD.",
         }),
      );
   }
   if (input.dueDate && !isIsoDateString(input.dueDate)) {
      return Result.err(
         new TransactionRuleError({
            error: transactionRuleErrors.BAD_REQUEST(),
            message: "Vencimento deve estar no formato YYYY-MM-DD.",
         }),
      );
   }

   const nextDate = addRecurrencePeriod(input.date, input.frequency);
   if (input.dueDate) {
      return Result.ok([
         { number: 1, date: input.date, dueDate: input.dueDate },
         {
            number: 2,
            date: nextDate,
            dueDate: addRecurrencePeriod(input.dueDate, input.frequency),
         },
      ]);
   }

   return Result.ok([
      { number: 1, date: input.date, dueDate: null },
      {
         number: 2,
         date: nextDate,
         dueDate: null,
      },
   ]);
}
