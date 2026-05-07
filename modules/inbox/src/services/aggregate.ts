import { and, eq, gt, isNull, or } from "drizzle-orm";
import { fromPromise, ok, ResultAsync } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { inboxItems } from "@core/database/schemas/inbox";
import { WebAppError } from "@core/logging/errors";
import {
   type InboxCounts,
   type InboxItemDto,
} from "@modules/inbox/schemas/inbox-item";
import { fetchDuePayments } from "@modules/inbox/services/sources/due-payments";
import { fetchUncategorized } from "@modules/inbox/services/sources/uncategorized-tx";

const SEVERITY_RANK = { urgent: 0, warning: 1, info: 2 } as const;

function fetchPersisted(db: DatabaseInstance, teamId: string) {
   const now = new Date();
   return fromPromise(
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
      () => WebAppError.internal("Falha ao carregar inbox."),
   ).andThen((rows) =>
      ok(
         rows.map<InboxItemDto>((r) => ({
            id: r.id,
            itemKey: r.itemKey,
            source: r.source as InboxItemDto["source"],
            severity: r.severity,
            title: r.title,
            description: r.description ?? null,
            occurredAt: r.occurredAt.toISOString(),
            readAt: r.readAt ? r.readAt.toISOString() : null,
            isPersisted: true,
            entity: (r.payload as { entity?: InboxItemDto["entity"] })
               .entity ?? { type: "team", id: r.teamId },
            actions:
               (r.payload as { actions?: InboxItemDto["actions"] }).actions ??
               [],
         })),
      ),
   );
}

function fetchDismissedKeys(db: DatabaseInstance, teamId: string) {
   const now = new Date();
   return fromPromise(
      db
         .select({
            itemKey: inboxItems.itemKey,
            dismissedAt: inboxItems.dismissedAt,
            snoozeUntil: inboxItems.snoozeUntil,
         })
         .from(inboxItems)
         .where(eq(inboxItems.teamId, teamId)),
      () => WebAppError.internal("Falha ao carregar inbox."),
   ).andThen((rows) =>
      ok(
         new Set(
            rows
               .filter(
                  (r) =>
                     r.dismissedAt || (r.snoozeUntil && r.snoozeUntil > now),
               )
               .map((r) => r.itemKey),
         ),
      ),
   );
}

export function aggregateInbox(db: DatabaseInstance, teamId: string) {
   return ResultAsync.combine([
      fetchDuePayments(db, teamId),
      fetchUncategorized(db, teamId),
      fetchPersisted(db, teamId),
      fetchDismissedKeys(db, teamId),
   ]).andThen(([due, uncategorized, persisted, dismissed]) => {
      const deterministic = [...due, ...uncategorized].filter(
         (i) => !dismissed.has(i.itemKey),
      );
      const merged = [...persisted, ...deterministic];
      const seenKeys = new Set<string>();
      const unique = merged.filter((i) => {
         if (seenKeys.has(i.itemKey)) return false;
         seenKeys.add(i.itemKey);
         return true;
      });
      unique.sort((a, b) => {
         const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
         if (sev !== 0) return sev;
         return (
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
         );
      });
      const counts: InboxCounts = {
         total: unique.length,
         urgent: unique.filter((i) => i.severity === "urgent").length,
         warning: unique.filter((i) => i.severity === "warning").length,
         info: unique.filter((i) => i.severity === "info").length,
         unread: unique.filter((i) => !i.readAt).length,
      };
      return ok({ items: unique.slice(0, 50), counts });
   });
}
