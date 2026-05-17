import {
   add,
   greaterThan,
   of,
   subtract,
   toDecimal,
   zero,
   type Money,
} from "@f-o-t/money";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
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

dayjs.extend(customParseFormat);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reportStatus = z.enum(["paid", "pending", "all"]);
const optionalUuid = z.string().uuid().optional();

function isValidIsoDate(value: string) {
   return dayjs(value, "YYYY-MM-DD", true).isValid();
}

function isValidRange(values: { dateFrom: string; dateTo: string }) {
   return !dayjs(values.dateFrom).isAfter(dayjs(values.dateTo));
}

const baseFiltersShape = {
   dateFrom: isoDate,
   dateTo: isoDate,
   status: reportStatus.default("paid"),
   bankAccountId: optionalUuid,
   categoryId: optionalUuid,
   tagId: optionalUuid,
   contactId: optionalUuid,
};

const baseFilters = z
   .object(baseFiltersShape)
   .refine(
      (value) => isValidIsoDate(value.dateFrom) && isValidIsoDate(value.dateTo),
      {
         path: ["dateFrom"],
         message: "Informe datas válidas.",
      },
   )
   .refine(isValidRange, {
      path: ["dateTo"],
      message: "Data final deve ser maior ou igual à inicial.",
   });
const baseFiltersWithoutContactShape = {
   dateFrom: isoDate,
   dateTo: isoDate,
   status: reportStatus.default("paid"),
   bankAccountId: optionalUuid,
   categoryId: optionalUuid,
   tagId: optionalUuid,
};
const cashFlowFilters = z
   .object(baseFiltersWithoutContactShape)
   .refine(
      (value) => isValidIsoDate(value.dateFrom) && isValidIsoDate(value.dateTo),
      {
         path: ["dateFrom"],
         message: "Informe datas válidas.",
      },
   )
   .refine(isValidRange, {
      path: ["dateTo"],
      message: "Data final deve ser maior ou igual à inicial.",
   });
const expensesByCostCenterFilters = cashFlowFilters;
const agingFilters = z
   .object({
      type: z.enum(["income", "expense"]).default("income"),
      dateFrom: isoDate,
      dateTo: isoDate,
      contactId: optionalUuid,
      categoryId: optionalUuid,
      tagId: optionalUuid,
      status: z.enum(["open", "overdue", "settled"]).default("open"),
   })
   .refine(
      (value) => isValidIsoDate(value.dateFrom) && isValidIsoDate(value.dateTo),
      {
         path: ["dateFrom"],
         message: "Informe datas válidas.",
      },
   )
   .refine(isValidRange, {
      path: ["dateTo"],
      message: "Data final deve ser maior ou igual à inicial.",
   });
const expensesByCategoryFilters = z
   .object({
      ...baseFiltersWithoutContactShape,
      depth: z.enum(["group", "subcategory"]).default("group"),
      minAmount: z.number().nonnegative().default(0),
   })
   .refine(
      (value) => isValidIsoDate(value.dateFrom) && isValidIsoDate(value.dateTo),
      {
         path: ["dateFrom"],
         message: "Informe datas válidas.",
      },
   )
   .refine(isValidRange, {
      path: ["dateTo"],
      message: "Data final deve ser maior ou igual à inicial.",
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
   .use(async ({ context, next }, input) => {
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

      return next({ context: { entity: existing.value } });
   })
   .handler(async ({ context }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            return tx
               .delete(reports)
               .where(eq(reports.id, context.entity.id))
               .returning();
         }),
         () => WebAppError.internal("Falha ao excluir relatório."),
      );
      if (result.isErr()) throw result.error;
      if (result.value.length === 0)
         throw WebAppError.internal("Falha ao excluir relatório.");
      return { success: true };
   });

function moneyValue(value: string | number | null | undefined) {
   return of(String(value ?? "0"), "BRL");
}

function money(value: string | number | null | undefined) {
   return toDecimal(of(String(value ?? "0"), "BRL"));
}

function decimal(value: Money) {
   return toDecimal(value);
}

function ratio(value: Money, total: Money) {
   if (!greaterThan(total, zero("BRL"))) return 0;
   return Number(toDecimal(value)) / Number(toDecimal(total));
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
   .input(
      z
         .object({
            ...baseFiltersShape,
            dreOnly: z.boolean().default(true),
         })
         .refine(
            (value) =>
               isValidIsoDate(value.dateFrom) && isValidIsoDate(value.dateTo),
            {
               path: ["dateFrom"],
               message: "Informe datas válidas.",
            },
         )
         .refine(isValidRange, {
            path: ["dateTo"],
            message: "Data final deve ser maior ou igual à inicial.",
         }),
   )
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
            total: Money;
            periods: Map<string, Money>;
            rows: {
               id: string;
               name: string;
               total: Money;
               periods: Map<string, Money>;
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
            total: zero("BRL"),
            periods: new Map<string, Money>(),
            rows: [],
         };
         const value = moneyValue(row.amount);
         const month = row.period;
         group.total = add(group.total, value);
         group.periods.set(
            month,
            add(group.periods.get(month) ?? zero("BRL"), value),
         );
         const childId = row.categoryId ?? `${key}:uncategorized`;
         const child = group.rows.find((item) => item.id === childId);
         if (child) {
            child.total = add(child.total, value);
            child.periods.set(
               month,
               add(child.periods.get(month) ?? zero("BRL"), value),
            );
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
         total: decimal(group.total),
         periods: periods.map((period) => ({
            period,
            label: periodLabel(period),
            amount: decimal(group.periods.get(period) ?? zero("BRL")),
         })),
         rows: group.rows.map((row) => ({
            id: row.id,
            name: row.name,
            total: decimal(row.total),
            periods: periods.map((period) => ({
               period,
               label: periodLabel(period),
               amount: decimal(row.periods.get(period) ?? zero("BRL")),
            })),
         })),
      }));
      const income = result.value
         .filter((row) => row.type === "income")
         .reduce((acc, row) => add(acc, moneyValue(row.amount)), zero("BRL"));
      const expense = result.value
         .filter((row) => row.type === "expense")
         .reduce((acc, row) => add(acc, moneyValue(row.amount)), zero("BRL"));

      return {
         periods: periods.map((period) => ({
            period,
            label: periodLabel(period),
         })),
         groups,
         totals: {
            income: decimal(income),
            expense: decimal(expense),
            result: decimal(subtract(income, expense)),
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

      const openingByAccount = new Map<string, Money>();
      for (const account of result.value.accounts) {
         const initialDate = account.initialBalanceDate;
         const initial =
            !initialDate ||
            dayjs(initialDate).isSame(input.dateFrom) ||
            dayjs(initialDate).isBefore(input.dateFrom)
               ? moneyValue(account.initialBalance)
               : zero("BRL");
         openingByAccount.set(account.id, initial);
      }
      for (const row of result.value.openings) {
         if (!row.accountId) continue;
         openingByAccount.set(
            row.accountId,
            add(
               openingByAccount.get(row.accountId) ?? zero("BRL"),
               moneyValue(row.amount),
            ),
         );
      }

      const movementMap = new Map<string, { income: Money; expense: Money }>();
      for (const row of result.value.movements) {
         if (!row.accountId) continue;
         movementMap.set(`${row.period}:${row.accountId}`, {
            income: moneyValue(row.income),
            expense: moneyValue(row.expense),
         });
      }

      const running = new Map(openingByAccount);
      const rows = periods.map((period) => {
         let initialBalance = zero("BRL");
         let income = zero("BRL");
         let expense = zero("BRL");
         const accounts = result.value.accounts.map((account) => {
            const start = running.get(account.id) ?? zero("BRL");
            const movement = movementMap.get(`${period}:${account.id}`) ?? {
               income: zero("BRL"),
               expense: zero("BRL"),
            };
            const ending = subtract(
               add(start, movement.income),
               movement.expense,
            );
            running.set(account.id, ending);
            initialBalance = add(initialBalance, start);
            income = add(income, movement.income);
            expense = add(expense, movement.expense);
            return {
               id: account.id,
               name: account.name,
               initialBalance: decimal(start),
               income: decimal(movement.income),
               expense: decimal(movement.expense),
               endingBalance: decimal(ending),
            };
         });
         return {
            period,
            label: periodLabel(period),
            initialBalance: decimal(initialBalance),
            income: decimal(income),
            expense: decimal(expense),
            endingBalance: decimal(
               subtract(add(initialBalance, income), expense),
            ),
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
         (acc, row) => add(acc, moneyValue(row.amount)),
         zero("BRL"),
      );
      const byTag = new Map<
         string,
         {
            id: string;
            name: string;
            color: string;
            amount: Money;
            categories: { id: string; name: string; amount: Money }[];
         }
      >();
      for (const row of result.value) {
         const id = row.tagId ?? "untagged";
         const existing = byTag.get(id);
         const parent = existing ?? {
            id,
            name: row.tagName,
            color: row.tagColor,
            amount: zero("BRL"),
            categories: [],
         };
         const amount = moneyValue(row.amount);
         parent.amount = add(parent.amount, amount);
         parent.categories.push({
            id: row.categoryId ?? `${id}:uncategorized`,
            name: row.categoryName,
            amount,
         });
         byTag.set(id, parent);
      }

      return {
         total: decimal(total),
         rows: [...byTag.values()].map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
            amount: decimal(row.amount),
            percent: ratio(row.amount, total),
            categories: row.categories.map((category) => ({
               id: category.id,
               name: category.name,
               amount: decimal(category.amount),
               percent: ratio(category.amount, total),
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
         ["due", zero("BRL")],
         ["0-30", zero("BRL")],
         ["31-60", zero("BRL")],
         [">60", zero("BRL")],
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
            add(buckets.get(bucket) ?? zero("BRL"), moneyValue(row.amount)),
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
            {
               id: "due",
               label: "A vencer",
               amount: decimal(buckets.get("due") ?? zero("BRL")),
            },
            {
               id: "0-30",
               label: "0-30 dias",
               amount: decimal(buckets.get("0-30") ?? zero("BRL")),
            },
            {
               id: "31-60",
               label: "31-60 dias",
               amount: decimal(buckets.get("31-60") ?? zero("BRL")),
            },
            {
               id: ">60",
               label: ">60 dias",
               amount: decimal(buckets.get(">60") ?? zero("BRL")),
            },
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
         (acc, row) => add(acc, moneyValue(row.amount)),
         zero("BRL"),
      );
      return {
         total: decimal(total),
         rows: result.value.map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
            amount: money(row.amount),
            percent: ratio(moneyValue(row.amount), total),
            count: row.count,
         })),
      };
   });
