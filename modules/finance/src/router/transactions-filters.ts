import dayjs from "dayjs";
import {
   and,
   eq,
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
import type { Condition, ConditionGroup } from "@f-o-t/condition-evaluator";
import { contacts } from "@core/database/schemas/contacts";
import { transactions } from "@core/database/schemas/transactions";

export interface TransactionFilter {
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

function conditionColumn(field: string) {
   switch (field) {
      case "categoryId":
         return transactions.categoryId;
      case "bankAccountId":
         return transactions.bankAccountId;
      case "creditCardId":
         return transactions.creditCardId;
      case "amount":
         return transactions.amount;
      case "name":
         return transactions.name;
      case "paymentMethod":
         return transactions.paymentMethod;
      default:
         return null;
   }
}

function conditionToSql(condition: Condition): SQL | null {
   const col = conditionColumn(condition.field);
   if (!col) return null;
   const { operator } = condition;
   const value = "value" in condition ? condition.value : undefined;
   const stringVal = String(value);

   switch (operator) {
      case "eq":
         return sql`${col} = ${value}`;
      case "neq":
         return sql`${col} <> ${value}`;
      case "gt":
         return sql`${col} > ${value}`;
      case "gte":
         return sql`${col} >= ${value}`;
      case "lt":
         return sql`${col} < ${value}`;
      case "lte":
         return sql`${col} <= ${value}`;
      case "is_empty":
         return sql`${col} IS NULL`;
      case "is_not_empty":
         return sql`${col} IS NOT NULL`;
      case "contains":
         return sql`${col} ILIKE ${`%${stringVal}%`}`;
      case "not_contains":
         return sql`${col} NOT ILIKE ${`%${stringVal}%`}`;
      case "starts_with":
         return sql`${col} ILIKE ${`${stringVal}%`}`;
      case "ends_with":
         return sql`${col} ILIKE ${`%${stringVal}`}`;
      default:
         return null;
   }
}

export function buildTransactionConditions(
   filter: TransactionFilter,
   includeContactSearch: boolean,
): SQL[] {
   const conds: SQL[] = [eq(transactions.teamId, filter.teamId)];
   if (filter.tagId) conds.push(eq(transactions.tagId, filter.tagId));
   if (filter.type) conds.push(eq(transactions.type, filter.type));
   if (filter.bankAccountId)
      conds.push(eq(transactions.bankAccountId, filter.bankAccountId));
   if (filter.categoryId)
      conds.push(eq(transactions.categoryId, filter.categoryId));
   if (filter.contactId)
      conds.push(eq(transactions.contactId, filter.contactId));
   if (filter.dateFrom) conds.push(gte(transactions.date, filter.dateFrom));
   if (filter.dateTo) conds.push(lte(transactions.date, filter.dateTo));
   if (filter.search) {
      const pattern = `%${filter.search}%`;
      const cond = includeContactSearch
         ? or(
              ilike(transactions.name, pattern),
              ilike(transactions.description, pattern),
              ilike(contacts.name, pattern),
           )
         : or(
              ilike(transactions.name, pattern),
              ilike(transactions.description, pattern),
           );
      if (cond) conds.push(cond);
   }
   if (filter.creditCardId)
      conds.push(eq(transactions.creditCardId, filter.creditCardId));
   if (filter.paymentMethod) {
      conds.push(sql`${transactions.paymentMethod} = ${filter.paymentMethod}`);
   }
   if (filter.uncategorized) conds.push(isNull(transactions.categoryId));
   if (filter.status) {
      if (Array.isArray(filter.status)) {
         conds.push(inArray(transactions.status, filter.status));
      } else {
         conds.push(eq(transactions.status, filter.status));
      }
   }
   if (filter.dueDateFrom)
      conds.push(gte(transactions.dueDate, filter.dueDateFrom));
   if (filter.dueDateTo)
      conds.push(lte(transactions.dueDate, filter.dueDateTo));
   if (filter.overdueOnly) {
      const today = dayjs().format("YYYY-MM-DD");
      conds.push(eq(transactions.status, "pending"));
      conds.push(lt(transactions.dueDate, today));
   }
   if (filter.view === "payable") {
      conds.push(eq(transactions.type, "expense"));
      conds.push(eq(transactions.status, "pending"));
   } else if (filter.view === "receivable") {
      conds.push(eq(transactions.type, "income"));
      conds.push(eq(transactions.status, "pending"));
   } else if (filter.view === "settled") {
      conds.push(eq(transactions.status, "paid"));
   } else if (filter.view === "cancelled") {
      conds.push(eq(transactions.status, "cancelled"));
   }

   const isWeighted = filter.conditionGroup?.scoringMode === "weighted";
   if (filter.conditionGroup && !isWeighted) {
      const group = filter.conditionGroup;
      const sqlExprs = group.conditions
         .filter((c): c is Condition => !("conditions" in c))
         .map((c) => conditionToSql(c))
         .filter((e): e is SQL => e !== null);
      if (sqlExprs.length > 0) {
         const combined =
            group.operator === "AND" ? and(...sqlExprs) : or(...sqlExprs);
         if (combined) conds.push(combined);
      }
   }

   return conds;
}
