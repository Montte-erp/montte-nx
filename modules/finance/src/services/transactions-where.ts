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
   cancelled: [eq(t.status, "cancelled")],
};

export function buildTransactionWhere(
   f: TransactionFilter,
   includeContactSearch: boolean,
): SQL {
   const c: SQL[] = [eq(t.teamId, f.teamId)];
   if (f.type) c.push(eq(t.type, f.type));
   if (f.bankAccountId) c.push(eq(t.bankAccountId, f.bankAccountId));
   if (f.categoryId) c.push(eq(t.categoryId, f.categoryId));
   if (f.contactId) c.push(eq(t.contactId, f.contactId));
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
      const cond = includeContactSearch
         ? or(
              ilike(t.name, p),
              ilike(t.description, p),
              ilike(contacts.name, p),
           )
         : or(ilike(t.name, p), ilike(t.description, p));
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
