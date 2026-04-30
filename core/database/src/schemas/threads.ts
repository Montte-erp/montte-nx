import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { UIMessage } from "@tanstack/ai";
import { agentsSchema } from "@core/database/schemas/schemas";

export const threads = agentsSchema.table(
   "threads",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      organizationId: text("organization_id").notNull(),
      userId: text("user_id").notNull(),
      title: text("title"),
      messages: jsonb("messages").$type<UIMessage[]>().notNull().default([]),
      lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (t) => [
      index("threads_team_user_idx").on(t.teamId, t.userId),
      index("threads_last_message_idx").on(t.lastMessageAt),
   ],
);

export const threadSchema = createSelectSchema(threads);
export const insertThreadSchema = createInsertSchema(threads);

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
