import {
   index,
   jsonb,
   text,
   timestamp,
   uuid,
   varchar,
} from "drizzle-orm/pg-core";
import { platformSchema } from "@core/database/schemas/schemas";

export const chatThreads = platformSchema.table(
   "chat_threads",
   {
      id: uuid("id").primaryKey().defaultRandom(),
      resourceId: varchar("resource_id", { length: 255 }).notNull(),
      title: text("title"),
      metadata: jsonb("metadata"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (t) => [index("chat_threads_resource_id_idx").on(t.resourceId)],
);

export const chatMessages = platformSchema.table(
   "chat_messages",
   {
      id: uuid("id").primaryKey().defaultRandom(),
      threadId: uuid("thread_id")
         .notNull()
         .references(() => chatThreads.id, { onDelete: "cascade" }),
      role: varchar("role", { length: 20 }).notNull(),
      parts: jsonb("parts").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (t) => [index("chat_messages_thread_id_idx").on(t.threadId)],
);

export type ChatThread = typeof chatThreads.$inferSelect;
export type NewChatThread = typeof chatThreads.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
