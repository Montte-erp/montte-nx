import { sql } from "drizzle-orm";
import {
   index,
   jsonb,
   text,
   timestamp,
   unique,
   uuid,
} from "drizzle-orm/pg-core";
import { organization, team } from "@core/database/schemas/auth";
import { inboxSchema } from "@core/database/schemas/schemas";

export const inboxSeverityEnum = ["urgent", "warning", "info"] as const;
export type InboxSeverity = (typeof inboxSeverityEnum)[number];

export const inboxItems = inboxSchema.table(
   "items",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      itemKey: text("item_key").notNull(),
      source: text("source").notNull(),
      severity: text("severity").notNull().$type<InboxSeverity>(),
      title: text("title").notNull(),
      description: text("description"),
      payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
      occurredAt: timestamp("occurred_at", { withTimezone: true })
         .defaultNow()
         .notNull(),
      readAt: timestamp("read_at", { withTimezone: true }),
      dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
      snoozeUntil: timestamp("snooze_until", { withTimezone: true }),
   },
   (table) => [
      unique("inbox_items_team_key_unique").on(table.teamId, table.itemKey),
      index("inbox_items_team_occurred_idx").on(table.teamId, table.occurredAt),
   ],
);

export type InboxItem = typeof inboxItems.$inferSelect;
export type NewInboxItem = typeof inboxItems.$inferInsert;
