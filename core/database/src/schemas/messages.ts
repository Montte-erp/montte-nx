import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { index, jsonb, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import type { UIMessage } from "@tanstack/ai";
import { z } from "zod";
import { agentsSchema } from "@core/database/schemas/schemas";
import { threads } from "@core/database/schemas/threads";

export const messageRoleEnum = agentsSchema.enum("message_role", [
   "system",
   "user",
   "assistant",
]);

export const messageMetadataSchema = z.object({
   traceId: z.string().optional(),
   pageContext: z
      .object({
         route: z.string().optional(),
         title: z.string().optional(),
         summary: z.string().optional(),
         skillHint: z.string().optional(),
      })
      .optional(),
});
export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export const messages = agentsSchema.table(
   "messages",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      threadId: uuid("thread_id")
         .notNull()
         .references(() => threads.id, { onDelete: "cascade" }),
      role: messageRoleEnum("role").notNull(),
      parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
      metadata: jsonb("metadata").$type<MessageMetadata>(),
      version: integer("version").notNull().default(1),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (t) => [index("messages_thread_created_idx").on(t.threadId, t.createdAt)],
);

export const messageSchema = createSelectSchema(messages);
export const insertMessageSchema = createInsertSchema(messages);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
