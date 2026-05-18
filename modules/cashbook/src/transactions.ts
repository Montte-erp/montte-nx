import dayjs from "dayjs";
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
import { err, ok, type Result } from "neverthrow";
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
   categoryId: t.categoryId,
   bankAccountId: t.bankAccountId,
   creditCardId: t.creditCardId,
   amount: t.amount,
   name: t.name,
   paymentMethod: t.paymentMethod,
} as const;

function conditionToSql(c: Condition): SQL | null {
   const col = COND_COLUMNS[c.field as keyof typeof COND_COLUMNS];
   if (!col) return null;
   const v = "value" in c ? c.value : undefined;
   const s = String(v);
   switch (c.operator) {
      case "eq":
         return sql`${col} = ${v}`;
      case "neq":
         return sql`${col} <> ${v}`;
      case "gt":
         return sql`${col} > ${v}`;
      case "gte":
         return sql`${col} >= ${v}`;
      case "lt":
         return sql`${col} < ${v}`;
      case "lte":
         return sql`${col} <= ${v}`;
      case "is_empty":
         return sql`${col} IS NULL`;
      case "is_not_empty":
         return sql`${col} IS NOT NULL`;
      case "contains":
         return sql`${col} ILIKE ${`%${s}%`}`;
      case "not_contains":
         return sql`${col} NOT ILIKE ${`%${s}%`}`;
      case "starts_with":
         return sql`${col} ILIKE ${`${s}%`}`;
      case "ends_with":
         return sql`${col} ILIKE ${`%${s}`}`;
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

export function buildTransactionWhere(f: TransactionFilter): SQL {
   const c: SQL[] = [eq(t.teamId, f.teamId)];
   if (f.ignored === true) c.push(eq(t.ignored, true));
   else if (f.ignored === false || !f.includeIgnored)
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
      c.push(
         Array.isArray(f.status)
            ? inArray(t.status, f.status)
            : eq(t.status, f.status),
      );
   }
   if (f.overdueOnly) {
      c.push(eq(t.status, "pending"));
      c.push(lt(t.dueDate, dayjs().format("YYYY-MM-DD")));
   }
   const viewFilter = f.view ? VIEW_FILTERS[f.view] : undefined;
   if (viewFilter) c.push(...viewFilter);

   if (f.search) {
      const p = `%${f.search}%`;
      const cond = or(ilike(t.name, p), ilike(t.description, p));
      if (cond) c.push(cond);
   }

   const cg = f.conditionGroup;
   if (cg && cg.scoringMode !== "weighted") {
      const exprs = cg.conditions
         .filter((x): x is Condition => !("conditions" in x))
         .map(conditionToSql)
         .filter((e): e is SQL => e !== null);
      if (exprs.length > 0) {
         const combined = cg.operator === "AND" ? and(...exprs) : or(...exprs);
         if (combined) c.push(combined);
      }
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

const DECIMAL_REGEX = /^(\d+)(?:\.(\d+))?$/;

function parseMoneyToCents(value: string): Result<number, string> {
   const normalized = value.trim();
   const match = DECIMAL_REGEX.exec(normalized);
   if (!match) return err("Valor deve ser um número válido maior que zero.");

   const [, majorRaw, minorRaw = ""] = match;
   if (!majorRaw) return err("Valor deve ser um número válido maior que zero.");

   const major = Number(majorRaw);
   const centsText = minorRaw.padEnd(3, "0");
   const centsBase = Number(centsText.slice(0, 2));
   const shouldRound = Number(centsText.slice(2, 3)) >= 5;
   const cents = major * 100 + centsBase + (shouldRound ? 1 : 0);

   if (!Number.isSafeInteger(cents) || cents <= 0) {
      return err("Valor deve ser um número válido maior que zero.");
   }

   return ok(cents);
}

function formatCents(cents: number) {
   const major = Math.floor(cents / 100);
   const minor = String(cents % 100).padStart(2, "0");
   return `${major}.${minor}`;
}

export function buildInstallmentPreview(
   input: InstallmentInput,
): Result<InstallmentPreview[], string> {
   if (!Number.isInteger(input.count) || input.count < 2) {
      return err("Número de parcelas deve ser maior que 1.");
   }
   if (!isIsoDateString(input.date)) {
      return err("Data deve estar no formato YYYY-MM-DD.");
   }
   if (input.dueDate && !isIsoDateString(input.dueDate)) {
      return err("Vencimento deve estar no formato YYYY-MM-DD.");
   }

   const parsed = parseMoneyToCents(input.amount);
   if (parsed.isErr()) return err(parsed.error);

   const baseAmount = Math.floor(parsed.value / input.count);
   const remainder = parsed.value % input.count;

   if (baseAmount <= 0) {
      return err("Valor total é baixo demais para o número de parcelas.");
   }

   return ok(
      Array.from({ length: input.count }, (_, index) => {
         const number = index + 1;
         const amount = baseAmount + (index < remainder ? 1 : 0);
         return {
            number,
            count: input.count,
            amount: formatCents(amount),
            date: dayjs(input.date).add(index, "month").format("YYYY-MM-DD"),
            dueDate: input.dueDate
               ? dayjs(input.dueDate).add(index, "month").format("YYYY-MM-DD")
               : null,
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

export function buildRecurrenceOccurrences(
   input: RecurrenceInput,
): Result<RecurrenceOccurrence[], string> {
   if (!isIsoDateString(input.date)) {
      return err("Data deve estar no formato YYYY-MM-DD.");
   }
   if (input.dueDate && !isIsoDateString(input.dueDate)) {
      return err("Vencimento deve estar no formato YYYY-MM-DD.");
   }

   const nextDate = addRecurrencePeriod(input.date, input.frequency);
   return ok([
      { number: 1, date: input.date, dueDate: input.dueDate ?? null },
      {
         number: 2,
         date: nextDate,
         dueDate: input.dueDate
            ? addRecurrencePeriod(input.dueDate, input.frequency)
            : null,
      },
   ]);
}
