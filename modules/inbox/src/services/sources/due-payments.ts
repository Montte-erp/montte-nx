import dayjs from "dayjs";
import { and, eq, lte } from "drizzle-orm";
import { fromPromise, ok } from "neverthrow";
import { transactions } from "@core/database/schemas/transactions";
import type { DatabaseInstance } from "@core/database/client";
import { WebAppError } from "@core/logging/errors";
import type { InboxItemDto } from "@modules/inbox/schemas/inbox-item";

const HORIZON_DAYS = 7;

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

export function fetchDuePayments(db: DatabaseInstance, teamId: string) {
   const horizon = dayjs().add(HORIZON_DAYS, "day").format("YYYY-MM-DD");
   return fromPromise(
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
               eq(transactions.status, "pending"),
               lte(transactions.dueDate, horizon),
            ),
         )
         .limit(50),
      () => WebAppError.internal("Falha ao carregar vencimentos."),
   ).andThen((rows) => {
      const today = dayjs().startOf("day");
      const items = rows
         .filter((r) => r.dueDate)
         .map<InboxItemDto>((r) => {
            const due = dayjs(r.dueDate as string);
            const daysUntil = due.diff(today, "day");
            const formatted = due.format("DD/MM/YYYY");
            const itemKey = `due:transaction:${r.id}`;
            const verb = r.type === "income" ? "Receber" : "Pagar";
            return {
               id: itemKey,
               itemKey,
               source: "due",
               severity: severityFor(daysUntil),
               title: r.name?.trim()
                  ? `${verb}: ${r.name}`
                  : `${verb} R$ ${r.amount}`,
               description: describe(daysUntil, formatted),
               occurredAt: due.toDate().toISOString(),
               readAt: null,
               isPersisted: false,
               entity: { type: "transaction", id: r.id },
               actions: [
                  {
                     kind: "navigate",
                     label: "Ver transação",
                     payload: { route: "transactions", id: r.id },
                  },
               ],
            };
         });
      return ok(items);
   });
}
