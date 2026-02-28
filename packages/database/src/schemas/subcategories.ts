import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories";

export const subcategories = pgTable(
   "subcategories",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      categoryId: uuid("category_id")
         .notNull()
         .references(() => categories.id, { onDelete: "cascade" }),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      index("subcategories_category_id_idx").on(table.categoryId),
      index("subcategories_team_id_idx").on(table.teamId),
   ],
);

export const subcategoriesRelations = relations(subcategories, ({ one }) => ({
   category: one(categories, {
      fields: [subcategories.categoryId],
      references: [categories.id],
   }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
   subcategories: many(subcategories),
}));

export type Subcategory = typeof subcategories.$inferSelect;
export type NewSubcategory = typeof subcategories.$inferInsert;
