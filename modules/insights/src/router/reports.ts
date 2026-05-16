import { of, toDecimal } from "@f-o-t/money";
import dayjs from "dayjs";
import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { createReportSchema, reports } from "@core/database/schemas/reports";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reportStatus = z.enum(["paid", "pending", "all"]);
const optionalUuid = z.string().uuid().optional();

const baseFilters = z.object({
   dateFrom: isoDate,
   dateTo: isoDate,
   status: reportStatus.default("paid"),
   bankAccountId: optionalUuid,
   categoryId: optionalUuid,
   tagId: optionalUuid,
   contactId: optionalUuid,
});

const cashFlowFilters = baseFilters.omit({ contactId: true });
const expensesByCostCenterFilters = baseFilters.omit({ contactId: true });
const agingFilters = z.object({
   type: z.enum(["income", "expense"]).default("income"),
   dateFrom: isoDate,
   dateTo: isoDate,
   contactId: optionalUuid,
   categoryId: optionalUuid,
   tagId: optionalUuid,
   status: z.enum(["open", "overdue", "settled"]).default("open"),
});
const expensesByCategoryFilters = baseFilters.omit({ contactId: true }).extend({
   depth: z.enum(["group", "subcategory"]).default("group"),
   minAmount: z.number().nonnegative().default(0),
});
const idSchema = z.object({ id: z.string().uuid() });

type BaseFilters = z.infer<typeof baseFilters>;

export const get = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.reports.findFirst({
            where: (f, { and, eq }) =>
               and(eq(f.id, input.id), eq(f.teamId, context.teamId)),
         }),
         () => WebAppError.internal("Falha ao carregar relatório."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.notFound("Relatório não encontrado.");
      return result.value;
   });

export const list = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.reports.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         orderBy: (f, { desc }) => [desc(f.createdAt)],
      }),
      () => WebAppError.internal("Falha ao listar relatórios."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const create = protectedProcedure
   .input(createReportSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(reports)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar relatório."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar relatório: insert vazio.");
      return result.value;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const existing = await fromPromise(
         context.db.query.reports.findFirst({
            where: (f, { and, eq }) =>
               and(eq(f.id, input.id), eq(f.teamId, context.teamId)),
         }),
         () => WebAppError.internal("Falha ao verificar relatório."),
      );
      if (existing.isErr()) throw existing.error;
      if (!existing.value)
         throw WebAppError.notFound("Relatório não encontrado.");

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(reports).where(eq(reports.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir relatório."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });

function money(value: string | number | null | undefined) {
   return toDecimal(of(String(value ?? "0"), "BRL"));
}

function numberValue(value: string | number | null | undefined) {
   return Number(value ?? 0);
}

function periodLabel(value: string) {
   return dayjs(value).format("MM/YYYY");
}

function listPeriods(dateFrom: string, dateTo: string) {
   const periods: string[] = [];
   const end = dayjs(dateTo).startOf("month");
   let cursor = dayjs(dateFrom).startOf("month");
   while (cursor.isBefore(end) || cursor.isSame(end)) {
      periods.push(cursor.format("YYYY-MM-DD"));
      cursor = cursor.add(1, "month");
   }
   return periods;
}

function effectiveDateSql() {
   return sql<string>`CASE WHEN ${transactions.status} = 'pending' THEN ${transactions.dueDate} ELSE ${transactions.date} END`;
}

function pushStatusFilter(conditions: SQL[], status: BaseFilters["status"]) {
   if (status === "paid") conditions.push(eq(transactions.status, "paid"));
   if (status === "pending")
      conditions.push(eq(transactions.status, "pending"));
   if (status === "all")
      conditions.push(inArray(transactions.status, ["paid", "pending"]));
}

function baseTransactionConditions(
   input: BaseFilters,
   teamId: string,
   dateExpression: SQL<string>,
) {
   const conditions: SQL[] = [
      eq(transactions.teamId, teamId),
      eq(transactions.ignored, false),
      gte(dateExpression, input.dateFrom),
      lte(dateExpression, input.dateTo),
   ];
   pushStatusFilter(conditions, input.status);
   if (input.bankAccountId)
      conditions.push(eq(transactions.bankAccountId, input.bankAccountId));
   if (input.categoryId)
      conditions.push(eq(transactions.categoryId, input.categoryId));
   if (input.tagId) conditions.push(eq(transactions.tagId, input.tagId));
   if (input.contactId)
      conditions.push(eq(transactions.contactId, input.contactId));
   return conditions;
}

export const profitAndLoss = protectedProcedure
   .input(baseFilters.extend({ dreOnly: z.boolean().default(true) }))
   .handler(async ({ context, input }) => {
      const effectiveDate = effectiveDateSql();
      const conditions = baseTransactionConditions(
         input,
         context.teamId,
         effectiveDate,
      );
      conditions.push(inArray(transactions.type, ["income", "expense"]));
      if (input.dreOnly) conditions.push(eq(categories.participatesDre, true));

      const result = await fromPromise(
         context.db
            .select({
               type: transactions.type,
               groupId: sql<string>`COALESCE(${categories.dreGroupId}, ${categories.name}, 'Sem grupo')`,
               groupName: sql<string>`COALESCE(${categories.dreGroupId}, ${categories.name}, 'Sem grupo')`,
               categoryId: categories.id,
               categoryName: sql<string>`COALESCE(${categories.name}, 'Sem categoria')`,
               period: sql<string>`to_char(date_trunc('month', ${effectiveDate}::date), 'YYYY-MM-01')`,
               amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(tags, eq(transactions.tagId, tags.id))
            .where(and(...conditions))
            .groupBy(
               transactions.type,
               categories.dreGroupId,
               categories.name,
               categories.id,
               sql`date_trunc('month', ${effectiveDate}::date)`,
            )
            .orderBy(
               asc(transactions.type),
               asc(categories.dreGroupId),
               asc(categories.name),
            ),
         () => WebAppError.internal("Falha ao calcular DRE simplificada."),
      );
      if (result.isErr()) throw result.error;

      const periods = listPeriods(input.dateFrom, input.dateTo);
      const groupMap = new Map<
         string,
         {
            id: string;
            name: string;
            type: "income" | "expense" | "transfer";
            total: number;
            periods: Map<string, number>;
            rows: {
               id: string;
               name: string;
               total: number;
               periods: Map<string, number>;
            }[];
         }
      >();

      for (const row of result.value) {
         const key = `${row.type}:${row.groupId}`;
         const existing = groupMap.get(key);
         const group = existing ?? {
            id: key,
            name: row.groupName,
            type: row.type,
            total: 0,
            periods: new Map<string, number>(),
            rows: [],
         };
         const value = numberValue(row.amount);
         const month = row.period;
         group.total += value;
         group.periods.set(month, (group.periods.get(month) ?? 0) + value);
         const childId = row.categoryId ?? `${key}:uncategorized`;
         const child = group.rows.find((item) => item.id === childId);
         if (child) {
            child.total += value;
            child.periods.set(month, (child.periods.get(month) ?? 0) + value);
         } else {
            group.rows.push({
               id: childId,
               name: row.categoryName,
               total: value,
               periods: new Map([[month, value]]),
            });
         }
         groupMap.set(key, group);
      }

      const groups = [...groupMap.values()].map((group) => ({
         id: group.id,
         name: group.name,
         type: group.type,
         total: money(group.total),
         periods: periods.map((period) => ({
            period,
            label: periodLabel(period),
            amount: money(group.periods.get(period)),
         })),
         rows: group.rows.map((row) => ({
            id: row.id,
            name: row.name,
            total: money(row.total),
            periods: periods.map((period) => ({
               period,
               label: periodLabel(period),
               amount: money(row.periods.get(period)),
            })),
         })),
      }));
      const income = result.value
         .filter((row) => row.type === "income")
         .reduce((acc, row) => acc + numberValue(row.amount), 0);
      const expense = result.value
         .filter((row) => row.type === "expense")
         .reduce((acc, row) => acc + numberValue(row.amount), 0);

      return {
         periods: periods.map((period) => ({
            period,
            label: periodLabel(period),
         })),
         groups,
         totals: {
            income: money(income),
            expense: money(expense),
            result: money(income - expense),
         },
      };
   });

export const cashFlow = protectedProcedure
   .input(cashFlowFilters)
   .handler(async ({ context, input }) => {
      const effectiveDate = effectiveDateSql();
      const periods = listPeriods(input.dateFrom, input.dateTo);
      const accountConditions = [
         eq(bankAccounts.teamId, context.teamId),
         eq(bankAccounts.status, "active"),
      ];
      if (input.bankAccountId)
         accountConditions.push(eq(bankAccounts.id, input.bankAccountId));

      const result = await fromPromise(
         (async () => {
            const accounts = await context.db
               .select({
                  id: bankAccounts.id,
                  name: bankAccounts.name,
                  initialBalance: bankAccounts.initialBalance,
                  initialBalanceDate: bankAccounts.initialBalanceDate,
               })
               .from(bankAccounts)
               .where(and(...accountConditions))
               .orderBy(asc(bankAccounts.name));

            const movementConditions = baseTransactionConditions(
               input,
               context.teamId,
               effectiveDate,
            );
            movementConditions.push(
               inArray(transactions.type, ["income", "expense"]),
            );
            movementConditions.push(
               sql`${transactions.bankAccountId} IS NOT NULL`,
            );

            const movements = await context.db
               .select({
                  period: sql<string>`to_char(date_trunc('month', ${effectiveDate}::date), 'YYYY-MM-01')`,
                  accountId: transactions.bankAccountId,
                  income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)::text`,
                  expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)::text`,
               })
               .from(transactions)
               .where(and(...movementConditions))
               .groupBy(
                  transactions.bankAccountId,
                  sql`date_trunc('month', ${effectiveDate}::date)`,
               );

            const openingConditions: SQL[] = [
               eq(transactions.teamId, context.teamId),
               eq(transactions.ignored, false),
               lte(
                  effectiveDate,
                  dayjs(input.dateFrom).subtract(1, "day").format("YYYY-MM-DD"),
               ),
               inArray(transactions.type, ["income", "expense"]),
            ];
            pushStatusFilter(openingConditions, input.status);
            if (input.bankAccountId)
               openingConditions.push(
                  eq(transactions.bankAccountId, input.bankAccountId),
               );
            if (input.categoryId)
               openingConditions.push(
                  eq(transactions.categoryId, input.categoryId),
               );
            if (input.tagId)
               openingConditions.push(eq(transactions.tagId, input.tagId));

            const openings = await context.db
               .select({
                  accountId: transactions.bankAccountId,
                  amount: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} WHEN ${transactions.type} = 'expense' THEN -${transactions.amount} ELSE 0 END), 0)::text`,
               })
               .from(transactions)
               .where(and(...openingConditions))
               .groupBy(transactions.bankAccountId);

            return { accounts, movements, openings };
         })(),
         () => WebAppError.internal("Falha ao calcular fluxo de caixa."),
      );
      if (result.isErr()) throw result.error;

      const openingByAccount = new Map<string, number>();
      for (const account of result.value.accounts) {
         const initialDate = account.initialBalanceDate;
         const initial =
            !initialDate ||
            dayjs(initialDate).isSame(input.dateFrom) ||
            dayjs(initialDate).isBefore(input.dateFrom)
               ? numberValue(account.initialBalance)
               : 0;
         openingByAccount.set(account.id, initial);
      }
      for (const row of result.value.openings) {
         if (!row.accountId) continue;
         openingByAccount.set(
            row.accountId,
            (openingByAccount.get(row.accountId) ?? 0) +
               numberValue(row.amount),
         );
      }

      const movementMap = new Map<
         string,
         { income: number; expense: number }
      >();
      for (const row of result.value.movements) {
         if (!row.accountId) continue;
         movementMap.set(`${row.period}:${row.accountId}`, {
            income: numberValue(row.income),
            expense: numberValue(row.expense),
         });
      }

      const running = new Map(openingByAccount);
      const rows = periods.map((period) => {
         let initialBalance = 0;
         let income = 0;
         let expense = 0;
         const accounts = result.value.accounts.map((account) => {
            const start = running.get(account.id) ?? 0;
            const movement = movementMap.get(`${period}:${account.id}`) ?? {
               income: 0,
               expense: 0,
            };
            const ending = start + movement.income - movement.expense;
            running.set(account.id, ending);
            initialBalance += start;
            income += movement.income;
            expense += movement.expense;
            return {
               id: account.id,
               name: account.name,
               initialBalance: money(start),
               income: money(movement.income),
               expense: money(movement.expense),
               endingBalance: money(ending),
            };
         });
         return {
            period,
            label: periodLabel(period),
            initialBalance: money(initialBalance),
            income: money(income),
            expense: money(expense),
            endingBalance: money(initialBalance + income - expense),
            accounts,
         };
      });

      return { rows };
   });

export const expensesByCostCenter = protectedProcedure
   .input(expensesByCostCenterFilters)
   .handler(async ({ context, input }) => {
      const effectiveDate = effectiveDateSql();
      const conditions = baseTransactionConditions(
         input,
         context.teamId,
         effectiveDate,
      );
      conditions.push(eq(transactions.type, "expense"));

      const result = await fromPromise(
         context.db
            .select({
               tagId: tags.id,
               tagName: sql<string>`COALESCE(${tags.name}, 'Sem Centro de Custo')`,
               tagColor: sql<string>`COALESCE(${tags.color}, '#6366f1')`,
               categoryId: categories.id,
               categoryName: sql<string>`COALESCE(${categories.name}, 'Sem categoria')`,
               amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
            })
            .from(transactions)
            .leftJoin(tags, eq(transactions.tagId, tags.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .where(and(...conditions))
            .groupBy(
               tags.id,
               tags.name,
               tags.color,
               categories.id,
               categories.name,
            )
            .orderBy(asc(tags.name), asc(categories.name)),
         () =>
            WebAppError.internal(
               "Falha ao calcular despesas por Centro de Custo.",
            ),
      );
      if (result.isErr()) throw result.error;

      const total = result.value.reduce(
         (acc, row) => acc + numberValue(row.amount),
         0,
      );
      const byTag = new Map<
         string,
         {
            id: string;
            name: string;
            color: string;
            amount: number;
            categories: { id: string; name: string; amount: number }[];
         }
      >();
      for (const row of result.value) {
         const id = row.tagId ?? "untagged";
         const existing = byTag.get(id);
         const parent = existing ?? {
            id,
            name: row.tagName,
            color: row.tagColor,
            amount: 0,
            categories: [],
         };
         const amount = numberValue(row.amount);
         parent.amount += amount;
         parent.categories.push({
            id: row.categoryId ?? `${id}:uncategorized`,
            name: row.categoryName,
            amount,
         });
         byTag.set(id, parent);
      }

      return {
         total: money(total),
         rows: [...byTag.values()].map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
            amount: money(row.amount),
            percent: total > 0 ? row.amount / total : 0,
            categories: row.categories.map((category) => ({
               id: category.id,
               name: category.name,
               amount: money(category.amount),
               percent: total > 0 ? category.amount / total : 0,
            })),
         })),
      };
   });

export const aging = protectedProcedure
   .input(agingFilters)
   .handler(async ({ context, input }) => {
      const today = dayjs().format("YYYY-MM-DD");
      const conditions: SQL[] = [
         eq(transactions.teamId, context.teamId),
         eq(transactions.ignored, false),
         eq(transactions.type, input.type),
         gte(transactions.dueDate, input.dateFrom),
         lte(transactions.dueDate, input.dateTo),
      ];
      if (input.status === "settled")
         conditions.push(eq(transactions.status, "paid"));
      if (input.status === "open")
         conditions.push(eq(transactions.status, "pending"));
      if (input.status === "overdue") {
         conditions.push(eq(transactions.status, "pending"));
         conditions.push(sql`${transactions.dueDate} < ${today}`);
      }
      if (input.contactId)
         conditions.push(eq(transactions.contactId, input.contactId));
      if (input.categoryId)
         conditions.push(eq(transactions.categoryId, input.categoryId));
      if (input.tagId) conditions.push(eq(transactions.tagId, input.tagId));

      const result = await fromPromise(
         context.db
            .select({
               id: transactions.id,
               name: sql<string>`COALESCE(${transactions.name}, ${transactions.description}, 'Lançamento')`,
               dueDate: transactions.dueDate,
               amount: transactions.amount,
               status: transactions.status,
               contactId: contacts.id,
               contactName: sql<string>`COALESCE(${contacts.name}, 'Sem contato')`,
               contactType: contacts.type,
               tagName: tags.name,
               categoryName: categories.name,
            })
            .from(transactions)
            .leftJoin(contacts, eq(transactions.contactId, contacts.id))
            .leftJoin(tags, eq(transactions.tagId, tags.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .where(and(...conditions))
            .orderBy(asc(transactions.dueDate), asc(contacts.name)),
         () => WebAppError.internal("Falha ao calcular aging."),
      );
      if (result.isErr()) throw result.error;

      const buckets = new Map([
         ["due", 0],
         ["0-30", 0],
         ["31-60", 0],
         [">60", 0],
      ]);
      const rows = result.value.map((row) => {
         const due = dayjs(row.dueDate);
         const days = due.diff(dayjs(today), "day");
         const overdueDays = Math.max(days * -1, 0);
         let bucket = "due";
         if (overdueDays > 60) bucket = ">60";
         else if (overdueDays > 30) bucket = "31-60";
         else if (overdueDays > 0) bucket = "0-30";
         buckets.set(
            bucket,
            (buckets.get(bucket) ?? 0) + numberValue(row.amount),
         );
         return {
            id: row.id,
            name: row.name,
            dueDate: row.dueDate,
            amount: money(row.amount),
            status: row.status,
            contactId: row.contactId,
            contactName: row.contactName,
            contactType: row.contactType,
            tagName: row.tagName,
            categoryName: row.categoryName,
            days,
            bucket,
         };
      });

      return {
         rows,
         buckets: [
            { id: "due", label: "A vencer", amount: money(buckets.get("due")) },
            {
               id: "0-30",
               label: "0-30 dias",
               amount: money(buckets.get("0-30")),
            },
            {
               id: "31-60",
               label: "31-60 dias",
               amount: money(buckets.get("31-60")),
            },
            { id: ">60", label: ">60 dias", amount: money(buckets.get(">60")) },
         ],
      };
   });

export const expensesByCategory = protectedProcedure
   .input(expensesByCategoryFilters)
   .handler(async ({ context, input }) => {
      const parentCategories = alias(categories, "parent_categories");
      const effectiveDate = effectiveDateSql();
      const conditions = baseTransactionConditions(
         input,
         context.teamId,
         effectiveDate,
      );
      conditions.push(eq(transactions.type, "expense"));
      const groupName =
         input.depth === "group"
            ? sql<string>`COALESCE(${parentCategories.name}, ${categories.name}, 'Sem categoria')`
            : sql<string>`COALESCE(${categories.name}, 'Sem categoria')`;
      const groupColor =
         input.depth === "group"
            ? sql<string>`COALESCE(${parentCategories.color}, ${categories.color}, '#6366f1')`
            : sql<string>`COALESCE(${categories.color}, '#6366f1')`;
      const groupId =
         input.depth === "group"
            ? sql<string>`COALESCE(${parentCategories.id}::text, ${categories.id}::text, 'uncategorized')`
            : sql<string>`COALESCE(${categories.id}::text, 'uncategorized')`;

      const result = await fromPromise(
         context.db
            .select({
               id: groupId,
               name: groupName,
               color: groupColor,
               amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
               count: sql<number>`COUNT(*)::int`,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(
               parentCategories,
               eq(categories.parentId, parentCategories.id),
            )
            .where(and(...conditions))
            .groupBy(groupId, groupName, groupColor)
            .having(sql`SUM(${transactions.amount}) >= ${input.minAmount}`)
            .orderBy(sql`SUM(${transactions.amount}) DESC`),
         () =>
            WebAppError.internal("Falha ao calcular despesas por categoria."),
      );
      if (result.isErr()) throw result.error;

      const total = result.value.reduce(
         (acc, row) => acc + numberValue(row.amount),
         0,
      );
      return {
         total: money(total),
         rows: result.value.map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
            amount: money(row.amount),
            percent: total > 0 ? numberValue(row.amount) / total : 0,
            count: row.count,
         })),
      };
   });
