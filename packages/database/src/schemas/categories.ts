import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";

export const categories = pgTable(
   "categories",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      isDefault: boolean("is_default").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      index("categories_team_id_idx").on(table.teamId),
   ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
