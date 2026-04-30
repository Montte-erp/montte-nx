import { sql } from "drizzle-orm";
import {
   index,
   integer,
   jsonb,
   text,
   timestamp,
   uuid,
   varchar,
} from "drizzle-orm/pg-core";
import { agentsSchema } from "@core/database/schemas/schemas";

export const threadRoleEnum = agentsSchema.enum("thread_role", [
   "system",
   "user",
   "assistant",
   "tool",
]);

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

export const threadMessages = agentsSchema.table(
   "thread_messages",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      threadId: uuid("thread_id")
         .notNull()
         .references(() => threads.id, { onDelete: "cascade" }),
      sequence: integer("sequence").notNull(),
      role: threadRoleEnum("role").notNull(),
      parts: jsonb("parts").notNull(),
      toolCallId: varchar("tool_call_id", { length: 128 }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (t) => [index("thread_messages_thread_seq_idx").on(t.threadId, t.sequence)],
);

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type ThreadMessage = typeof threadMessages.$inferSelect;
export type NewThreadMessage = typeof threadMessages.$inferInsert;
