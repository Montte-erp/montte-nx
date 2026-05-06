import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
   index,
   integer,
   jsonb,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import type { UIMessage } from "@tanstack/ai";
import { agentsSchema } from "@core/database/schemas/schemas";
import { threads } from "@core/database/schemas/threads";

export const messages = agentsSchema.table(
   "messages",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      threadId: uuid("thread_id")
         .notNull()
         .references(() => threads.id, { onDelete: "cascade" }),
      role: text("role").notNull(),
      parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
      position: integer("position").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (t) => [index("messages_thread_position_idx").on(t.threadId, t.position)],
);

export const messageSchema = createSelectSchema(messages);
export const insertMessageSchema = createInsertSchema(messages);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
