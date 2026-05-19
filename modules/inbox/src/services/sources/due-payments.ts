import dayjs from "dayjs";
import { Result, TaggedError, type Result as ResultType } from "better-result";
import { defineErrorCatalog } from "evlog";
import { and, eq, lte } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { transactions } from "@core/database/schemas/transactions";
import type { InboxItemDto } from "@modules/inbox/schemas/inbox-item";

const HORIZON_DAYS = 7;

const inboxSourceErrors = defineErrorCatalog("inbox.source.due-payments", {
   LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar vencimentos.",
      tags: ["inbox", "due-payments"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "inbox.source.due-payments": typeof inboxSourceErrors;
   }
}

type InboxCatalogError = ReturnType<typeof inboxSourceErrors.LOAD_FAILED>;

export class InboxError extends TaggedError("InboxError")<{
   error: InboxCatalogError;
   message: string;
   teamId: string;
}>() {}

function severityFor(daysUntil: number): "urgent" | "warning" | "info" {
   if (daysUntil < 0) return "urgent";
   if (daysUntil <= 3) return "warning";
   return "info";
}

function describe(daysUntil: number, formattedDate: string): string {
   if (daysUntil < 0) {
      const overdue = Math.abs(daysUntil);
      return `Vencida há ${overdue} ${overdue === 1 ? "dia" : "dias"} (${formattedDate}).`;
   }
   if (daysUntil === 0) return `Vence hoje (${formattedDate}).`;
   if (daysUntil === 1) return `Vence amanhã (${formattedDate}).`;
   return `Vence em ${daysUntil} dias (${formattedDate}).`;
}

export async function fetchDuePayments(
   db: DatabaseInstance,
   teamId: string,
): Promise<ResultType<InboxItemDto[], InboxError>> {
   const horizon = dayjs().add(HORIZON_DAYS, "day").format("YYYY-MM-DD");
   const rows = await Result.tryPromise({
      try: () =>
         db
            .select({
               id: transactions.id,
               name: transactions.name,
               dueDate: transactions.dueDate,
               type: transactions.type,
               amount: transactions.amount,
            })
            .from(transactions)
            .where(
               and(
                  eq(transactions.teamId, teamId),
                  eq(transactions.ignored, false),
                  eq(transactions.status, "pending"),
                  lte(transactions.dueDate, horizon),
               ),
            )
            .limit(50),
      catch: () =>
         new InboxError({
            error: inboxSourceErrors.LOAD_FAILED({ internal: { teamId } }),
            message: "Falha ao carregar vencimentos.",
            teamId,
         }),
   });

   return rows.map((loadedRows) => {
      const today = dayjs().startOf("day");
      return loadedRows
         .filter((row) => row.dueDate)
         .map<InboxItemDto>((row) => {
            const due = dayjs(row.dueDate);
            const daysUntil = due.diff(today, "day");
            const formatted = due.format("DD/MM/YYYY");
            const itemKey = `due:transaction:${row.id}`;
            const verb = row.type === "income" ? "Receber" : "Pagar";
            return {
               id: itemKey,
               itemKey,
               source: "due",
               severity: severityFor(daysUntil),
               title: row.name?.trim()
                  ? `${verb}: ${row.name}`
                  : `${verb} R$ ${row.amount}`,
               description: describe(daysUntil, formatted),
               occurredAt: due.toISOString(),
               readAt: null,
               isPersisted: false,
               entity: { type: "transaction", id: row.id },
               actions: [
                  {
                     kind: "navigate",
                     label: "Ver transação",
                     payload: { route: "transactions", id: row.id },
                  },
               ],
            };
         });
   });
}
