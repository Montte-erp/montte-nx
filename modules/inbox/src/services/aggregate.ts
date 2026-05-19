import dayjs from "dayjs";
import { Result, TaggedError, type Result as ResultType } from "better-result";
import { defineErrorCatalog } from "evlog";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import { inboxItems } from "@core/database/schemas/inbox";
import {
   inboxActionSchema,
   type InboxCounts,
   inboxEntitySchema,
   type InboxItemDto,
   inboxSourceSchema,
} from "@modules/inbox/schemas/inbox-item";
import { fetchDuePayments } from "@modules/inbox/services/sources/due-payments";
import { fetchUncategorized } from "@modules/inbox/services/sources/uncategorized-tx";

const SEVERITY_RANK: Record<InboxItemDto["severity"], number> = {
   urgent: 0,
   warning: 1,
   info: 2,
};

const inboxAggregateErrors = defineErrorCatalog("inbox.aggregate", {
   LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar inbox.",
      tags: ["inbox"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "inbox.aggregate": typeof inboxAggregateErrors;
   }
}

type InboxCatalogError = ReturnType<typeof inboxAggregateErrors.LOAD_FAILED>;

export class InboxError extends TaggedError("InboxError")<{
   error: InboxCatalogError;
   message: string;
   teamId: string;
}>() {}

const inboxPayloadSchema = z
   .object({
      entity: inboxEntitySchema.optional(),
      actions: z.array(inboxActionSchema).optional(),
   })
   .passthrough();

function parsePersistedPayload(payload: Record<string, unknown>) {
   const parsed = inboxPayloadSchema.safeParse(payload);
   if (!parsed.success) return { actions: [] };
   return parsed.data;
}

async function fetchPersisted(
   db: DatabaseInstance,
   teamId: string,
): Promise<ResultType<InboxItemDto[], InboxError>> {
   const now = dayjs().toDate();
   const rows = await Result.tryPromise({
      try: () =>
         db
            .select()
            .from(inboxItems)
            .where(
               and(
                  eq(inboxItems.teamId, teamId),
                  isNull(inboxItems.dismissedAt),
                  or(
                     isNull(inboxItems.snoozeUntil),
                     gt(inboxItems.snoozeUntil, now),
                  ),
               ),
            )
            .limit(50),
      catch: () =>
         new InboxError({
            error: inboxAggregateErrors.LOAD_FAILED({ internal: { teamId } }),
            message: "Falha ao carregar inbox.",
            teamId,
         }),
   });

   return rows.map((loadedRows) =>
      loadedRows.map<InboxItemDto>((row) => {
         const source = inboxSourceSchema.safeParse(row.source);
         const payload = parsePersistedPayload(row.payload);
         return {
            id: row.id,
            itemKey: row.itemKey,
            source: source.success ? source.data : "agent",
            severity: row.severity,
            title: row.title,
            description: row.description ?? null,
            occurredAt: dayjs(row.occurredAt).toISOString(),
            readAt: row.readAt ? dayjs(row.readAt).toISOString() : null,
            isPersisted: true,
            entity: payload.entity ?? { type: "team", id: row.teamId },
            actions: payload.actions ?? [],
         };
      }),
   );
}

async function fetchDismissedKeys(
   db: DatabaseInstance,
   teamId: string,
): Promise<ResultType<Set<string>, InboxError>> {
   const now = dayjs().toDate();
   const rows = await Result.tryPromise({
      try: () =>
         db
            .select({
               itemKey: inboxItems.itemKey,
               dismissedAt: inboxItems.dismissedAt,
               snoozeUntil: inboxItems.snoozeUntil,
            })
            .from(inboxItems)
            .where(eq(inboxItems.teamId, teamId)),
      catch: () =>
         new InboxError({
            error: inboxAggregateErrors.LOAD_FAILED({ internal: { teamId } }),
            message: "Falha ao carregar inbox.",
            teamId,
         }),
   });

   return rows.map(
      (loadedRows) =>
         new Set(
            loadedRows
               .filter(
                  (row) =>
                     row.dismissedAt ||
                     (row.snoozeUntil && row.snoozeUntil > now),
               )
               .map((row) => row.itemKey),
         ),
   );
}

export async function aggregateInbox(db: DatabaseInstance, teamId: string) {
   const [dueResult, uncategorizedResult, persistedResult, dismissedResult] =
      await Promise.all([
         fetchDuePayments(db, teamId),
         fetchUncategorized(db, teamId),
         fetchPersisted(db, teamId),
         fetchDismissedKeys(db, teamId),
      ]);

   return Result.gen(function* () {
      const due = yield* dueResult;
      const uncategorized = yield* uncategorizedResult;
      const persisted = yield* persistedResult;
      const dismissed = yield* dismissedResult;

      const deterministic = [...due, ...uncategorized].filter(
         (item) => !dismissed.has(item.itemKey),
      );
      const merged = [...persisted, ...deterministic];
      const seenKeys = new Set<string>();
      const unique = merged.filter((item) => {
         if (seenKeys.has(item.itemKey)) return false;
         seenKeys.add(item.itemKey);
         return true;
      });
      unique.sort((a, b) => {
         const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
         if (severity !== 0) return severity;
         return dayjs(b.occurredAt).valueOf() - dayjs(a.occurredAt).valueOf();
      });
      const counts: InboxCounts = {
         total: unique.length,
         urgent: unique.filter((item) => item.severity === "urgent").length,
         warning: unique.filter((item) => item.severity === "warning").length,
         info: unique.filter((item) => item.severity === "info").length,
         unread: unique.filter((item) => !item.readAt).length,
      };
      return Result.ok({ items: unique.slice(0, 50), counts });
   });
}
