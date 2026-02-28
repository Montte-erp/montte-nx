import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tags = pgTable(
   "tags",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull().default("#6366f1"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [index("tags_team_id_idx").on(table.teamId)],
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
