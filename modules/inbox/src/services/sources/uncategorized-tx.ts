import dayjs from "dayjs";
import { Result, TaggedError, type Result as ResultType } from "better-result";
import { defineErrorCatalog } from "evlog";
import { and, count, eq, isNull } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { transactions } from "@core/database/schemas/transactions";
import type { InboxItemDto } from "@modules/inbox/schemas/inbox-item";

const inboxSourceErrors = defineErrorCatalog("inbox.source.uncategorized", {
   LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar transações sem categoria.",
      tags: ["inbox", "uncategorized"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "inbox.source.uncategorized": typeof inboxSourceErrors;
   }
}

type InboxCatalogError = ReturnType<typeof inboxSourceErrors.LOAD_FAILED>;

export class InboxError extends TaggedError("InboxError")<{
   error: InboxCatalogError;
   message: string;
   teamId: string;
}>() {}

export async function fetchUncategorized(
   db: DatabaseInstance,
   teamId: string,
): Promise<ResultType<InboxItemDto[], InboxError>> {
   const rows = await Result.tryPromise({
      try: () =>
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
      catch: () =>
         new InboxError({
            error: inboxSourceErrors.LOAD_FAILED({ internal: { teamId } }),
            message: "Falha ao carregar transações sem categoria.",
            teamId,
         }),
   });

   return rows.map((loadedRows) => {
      const total = Number(loadedRows[0]?.total ?? 0);
      if (total === 0) return [];

      const itemKey = "uncategorized:summary";
      const item: InboxItemDto = {
         id: itemKey,
         itemKey,
         source: "uncategorized",
         severity: "info",
         title: `${total} ${total === 1 ? "transação sem categoria" : "transações sem categoria"}`,
         description:
            "Categorize para melhorar análises e relatórios financeiros.",
         occurredAt: dayjs().toISOString(),
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
      return [item];
   });
}
