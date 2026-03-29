import {
   boolean,
   pgTable,
   timestamp,
   uuid,
   varchar,
} from "drizzle-orm/pg-core";
import { tags } from "@core/database/schemas/tags";

export const contactSettings = pgTable("contact_settings", {
   teamId: uuid("team_id").primaryKey(),
   defaultContactType: varchar("default_contact_type", { length: 10 })
      .notNull()
      .default("pj"),
   duplicateDetectionEnabled: boolean("duplicate_detection_enabled")
      .notNull()
      .default(true),
   requireTaxId: boolean("require_tax_id").notNull().default(false),
   defaultTagId: uuid("default_tag_id").references(() => tags.id, {
      onDelete: "set null",
   }),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
});

export type ContactSettings = typeof contactSettings.$inferSelect;
export type NewContactSettings = typeof contactSettings.$inferInsert;
