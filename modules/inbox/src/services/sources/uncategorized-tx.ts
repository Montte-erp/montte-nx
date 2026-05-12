import dayjs from "dayjs";
import { and, count, eq, isNull } from "drizzle-orm";
import { fromPromise, ok } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { WebAppError } from "@core/logging/errors";
import { transactions } from "@core/database/schemas/transactions";
import type { InboxItemDto } from "@modules/inbox/schemas/inbox-item";

export function fetchUncategorized(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db
         .select({ total: count() })
         .from(transactions)
         .where(
            and(
               eq(transactions.teamId, teamId),
               eq(transactions.ignored, false),
               isNull(transactions.categoryId),
            ),
         ),
      () => WebAppError.internal("Falha ao carregar transações sem categoria."),
   ).andThen((rows) => {
      const total = Number(rows[0]?.total ?? 0);
      if (total === 0) return ok([] as InboxItemDto[]);
      const itemKey = "uncategorized:summary";
      const item: InboxItemDto = {
         id: itemKey,
         itemKey,
         source: "uncategorized",
         severity: "info",
         title: `${total} ${total === 1 ? "transação sem categoria" : "transações sem categoria"}`,
         description:
            "Categorize para melhorar análises e relatórios financeiros.",
         occurredAt: dayjs().toDate().toISOString(),
         readAt: null,
         isPersisted: false,
         entity: { type: "team", id: teamId },
         actions: [
            {
               kind: "navigate",
               label: "Categorizar",
               payload: { route: "transactions", filter: "uncategorized" },
            },
         ],
      };
      return ok([item]);
   });
}
